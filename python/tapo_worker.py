"""Private JSON-lines IPC. No credentials in argv and no raw vendor responses in stdout."""
import contextlib
import json
import os
import sys
import time


def enabled(value):
    if value is True or value == "on":
        return True
    if value is False or value == "off":
        return False
    return None


def battery_snapshot(status, basic):
    current = status.get("battery", {}).get("status", {}) if isinstance(status, dict) else {}
    base = basic.get("device_info", {}).get("basic_info", {}) if isinstance(basic, dict) else {}
    data = current if "battery_percent" in current else base
    output = {}
    level = data.get("battery_percent")
    if type(level) in (int, float) and 0 <= level <= 100:
        output["level"] = level
    # NO/YES observed protocol values. Never derive charging from percentage or power mode.
    charge = data.get("battery_charging")
    if charge in ("YES", "NO"):
        output["charging"] = "CHARGING" if charge == "YES" else "NOT_CHARGING"
    if type(data.get("low_battery")) is bool:
        output["low"] = data["low_battery"]
    if type(base.get("battery_overheated")) is bool:
        output["overheated"] = base["battery_overheated"]
    # Keep unit-unverified telemetry as diagnostic values, not ambient temperature sensors.
    diagnostic = {}
    for key in ("battery_temperature", "battery_voltage", "power_mode"):
        value = data.get(key)
        if type(value) in (int, float) or (key == "power_mode" and value in ("BATTERY", "MAINS")):
            diagnostic[key] = value
    return output, diagnostic


READERS = {
    "privacy": "getPrivacyMode", "led": "getLED",
    "motionEnabled": "getMotionDetection", "personEnabled": "getPersonDetection",
    "petEnabled": "getPetDetection", "vehicleEnabled": "getVehicleDetection",
    "whiteLight": "getWhitelampStatus",
    "recordAudio": "getAudioConfig",
}
SETTERS = {
    "privacy": "setPrivacyMode", "led": "setLEDEnabled",
    "motionEnabled": "setMotionDetection", "personEnabled": "setPersonDetection",
    "petEnabled": "setPetDetection", "vehicleEnabled": "setVehicleDetection",
    "recordAudio": "setRecordAudio",
}


ALARM_KEYS = {"alarmArmed", "alarmLight", "alarmSound"}
MANUAL_ALARM_KEY = "manualAlarm"


def alarm_controls(info):
    if not isinstance(info, dict):
        return {}
    armed = enabled(info.get("enabled"))
    modes = info.get("alarm_mode")
    if armed is None or not isinstance(modes, list) or not modes:
        return {}
    if any(not isinstance(mode, str) or mode not in ("light", "sound") for mode in modes):
        return {}
    return {"alarmArmed": armed, "alarmLight": "light" in modes, "alarmSound": "sound" in modes}


def control_value(key, response):
    if not isinstance(response, dict):
        return None
    if key == "whiteLight":
        value = response.get("status")
        return bool(value) if type(value) is int and value in (0, 1) else None
    if key == "recordAudio":
        record = response.get("audio_config", {}).get("record_audio", {})
        return enabled(record.get("enabled"))
    return enabled(response.get("enabled"))


class Session:
    def __init__(self, client):
        self.client = client
        self.supported = None
        self.video_diagnostic = None
        self.manual_alarm_until = None

    def read(self):
        basic = self.client.getBasicInfo()
        try:
            status = self.client.getBatteryStatus()
        except Exception:
            status = {}
        battery, diagnostic = battery_snapshot(status, basic)
        # Firmware can advertise 1080p while encoding different frame dimensions.
        # Preserve both reports; never infer native sensor resolution from either.
        if self.video_diagnostic is None:
            self.video_diagnostic = {}
            try:
                main = self.client.getVideoQualities().get("video", {}).get("main", {})
                # Publish the configured profile, not undocumented vendor labels
                # as camera specifications. Encoded dimensions are measured separately.
                for source, target in (("resolution", "configured_resolution"),):
                    value = main.get(source)
                    if isinstance(value, str) and len(value) <= 32:
                        self.video_diagnostic[target] = value
            except Exception:
                pass
        diagnostic.update(self.video_diagnostic)
        controls = {}
        try:
            alarm_info = getattr(self.client, "getAlarm")()
            if isinstance(alarm_info, dict):
                controls.update(alarm_controls(alarm_info))
                if "alarmArmed" in controls:
                    manual_active = self.manual_alarm_until is not None and time.monotonic() < self.manual_alarm_until
                    controls[MANUAL_ALARM_KEY] = manual_active
                    if not manual_active:
                        self.manual_alarm_until = None
                modes = alarm_info.get("alarm_mode")
                if isinstance(modes, list):
                    diagnostic["alarm_mode"] = ",".join(modes)
                if "alarm_volume" in alarm_info:
                    diagnostic["alarm_volume"] = str(alarm_info["alarm_volume"])
        except Exception:
            pass
        for key, method in READERS.items():
            if self.supported is not None and key not in self.supported and key != "whiteLight":
                continue
            try:
                value = control_value(key, getattr(self.client, method)())
                if value is not None:
                    controls[key] = value
            except Exception:
                pass
        if self.supported is None:
            self.supported = set(controls)
        elif "whiteLight" in controls:
            self.supported.add("whiteLight")
        return {"battery": battery, "controls": controls, "diagnostic": diagnostic,
                "observedAt": int(time.time() * 1000)}

    def write(self, key, value):
        if type(value) is not bool or (key not in READERS and key not in ALARM_KEYS and key != MANUAL_ALARM_KEY):
            raise ValueError("INVALID_CONTROL")
        if self.supported is None or key not in self.supported:
            raise ValueError("UNSUPPORTED_CONTROL")
        if key in ALARM_KEYS:
            return self.write_alarm(key, value)
        if key == MANUAL_ALARM_KEY:
            return self.write_manual_alarm(value)
        before = control_value(key, getattr(self.client, READERS[key])())
        if before is None:
            raise ValueError("CONTROL_UNAVAILABLE")
        if before != value:
            if key == "whiteLight":
                # Toggle is serialized and based on a fresh read, never blind or retried automatically.
                self.client.reverseWhitelampStatus()
            elif key == "recordAudio":
                self.client.setRecordAudio(value)
            else:
                getattr(self.client, SETTERS[key])(value)
        after = control_value(key, getattr(self.client, READERS[key])())
        if key == "whiteLight" and before != value:
            # Some firmware initially reports the previous state while the LED changes.
            # Re-read the reported state without repeating the non-idempotent toggle.
            for pause in (0.2, 0.4, 0.8, 1.2):
                if after is value:
                    break
                time.sleep(pause)
                after = control_value(key, getattr(self.client, READERS[key])())
        if after is not value:
            raise ValueError("READBACK_FAILED")
        return {"control": key, "value": after}

    def write_alarm(self, key, value):
        info = self.client.getAlarm()
        state = alarm_controls(info)
        if not state:
            raise ValueError("CONTROL_UNAVAILABLE")
        if state[key] is value:
            return {"control": key, "value": value}
        state[key] = value
        modes = [mode for mode, field in (("light", "alarmLight"), ("sound", "alarmSound"))
                 if state[field]]
        if not modes:
            raise ValueError("ALARM_MODE_REQUIRED")
        config = {k: info[k] for k in ("alarm_type", "light_type", "alarm_volume", "alarm_duration") if k in info}
        config.update(enabled="on" if state["alarmArmed"] else "off", alarm_mode=modes)
        self.client.performRequest({"method": "set", "msg_alarm": {"chn1_msg_alarm_info": config}})
        if alarm_controls(self.client.getAlarm()) != state:
            raise ValueError("READBACK_FAILED")
        return {"control": key, "value": value}

    def write_manual_alarm(self, value):
        action = "start" if value else "stop"
        response = None
        for command in ("manual_msg_alarm", "manual_alarm"):
            try:
                response = self.client.performRequest({
                    "method": "do", "msg_alarm": {command: {"action": action}},
                })
                break
            except Exception as error:
                # Recent firmware renamed manual_msg_alarm to manual_alarm.
                if "-40106" not in str(error) or command == "manual_alarm":
                    raise ValueError("DEVICE_ERROR") from None
        if value:
            timer = 30
            if isinstance(response, dict):
                for candidate in (response, response.get("result")):
                    if isinstance(candidate, dict) and type(candidate.get("timer")) in (int, float):
                        timer = min(300, max(1, int(candidate["timer"])))
                        break
            self.manual_alarm_until = time.monotonic() + timer
            return {"control": MANUAL_ALARM_KEY, "value": True, "durationSeconds": timer}
        self.manual_alarm_until = None
        return {"control": MANUAL_ALARM_KEY, "value": False}


def main():
    session = None
    initialized = False
    for line in sys.stdin:
        request_id = None
        try:
            request = json.loads(line)
            request_id = request["id"]
            with open(os.devnull, "w") as sink, contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
                operation = request.get("op")
                if operation == "init" and not initialized:
                    initialized = True
                    from importlib.metadata import version
                    if version("pytapo") != "3.4.32":
                        raise ValueError("DEPENDENCY_VERSION")
                    from pytapo import Tapo
                    config = request["config"]
                    secret = config["secret"]
                    client = Tapo(config["host"], "admin", secret, cloudPassword=secret,
                                  retryStok=True, printWarnInformation=False,
                                  controlPort=config.get("controlPort", 443),
                                  streamPort=config.get("port", 8800))
                    session = Session(client)
                    result = session.read()
                elif operation == "read" and session:
                    result = session.read()
                elif operation == "write" and session:
                    result = session.write(request.get("control"), request.get("value"))
                else:
                    raise ValueError("NOT_INITIALIZED")
            print(json.dumps({"id": request_id, "ok": True, "data": result}), flush=True)
        except Exception as error:
            # Exceptions from third-party libraries may contain secrets; only export fixed codes.
            code = str(error) if type(error) is ValueError and str(error) in {
                "INVALID_CONTROL", "UNSUPPORTED_CONTROL", "CONTROL_UNAVAILABLE", "READBACK_FAILED",
                "NOT_INITIALIZED", "DEPENDENCY_VERSION", "ALARM_MODE_REQUIRED",
            } else "DEPENDENCY_MISSING" if isinstance(error, ImportError) else "DEVICE_ERROR"
            print(json.dumps({"id": request_id, "ok": False, "code": code}), flush=True)


if __name__ == "__main__":
    main()
