import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("tapo_worker", pathlib.Path(__file__).parents[1] / "python/tapo_worker.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class WorkerTests(unittest.TestCase):
    def test_actual_c402_battery_schema(self):
        battery, diagnostic = worker.battery_snapshot({"battery": {"status": {
            "power_mode": "BATTERY", "battery_percent": 100, "low_battery": False,
            "battery_charging": "NO", "battery_voltage": 4225, "battery_temperature": 46,
        }}}, {})
        self.assertEqual(battery, {"level": 100, "charging": "NOT_CHARGING", "low": False})
        self.assertEqual(diagnostic["battery_temperature"], 46)
        self.assertNotIn("temperature", battery)

    def test_charging_does_not_depend_on_level_or_external_power(self):
        battery, _ = worker.battery_snapshot({"battery": {"status": {
            "battery_percent": 100, "battery_charging": "YES", "power_mode": "BATTERY",
        }}}, {})
        self.assertEqual(battery["charging"], "CHARGING")

    def test_unknown_states_and_invalid_levels_are_not_invented(self):
        battery, _ = worker.battery_snapshot({"battery": {"status": {
            "battery_percent": -1, "battery_charging": "maybe", "low_battery": "false",
        }}}, {})
        self.assertEqual(battery, {})

    def test_basic_info_fallback(self):
        battery, _ = worker.battery_snapshot({}, {"device_info": {"basic_info": {
            "battery_percent": 55, "battery_charging": "NO", "low_battery": False,
        }}})
        self.assertEqual(battery["level"], 55)

    def test_boolean_values_not_coerced(self):
        self.assertIsNone(worker.control_value("privacy", {"enabled": "maybe"}))
        self.assertIsNone(worker.control_value("whiteLight", {"status": 2}))
        self.assertIs(worker.control_value("led", {"enabled": "on"}), True)

    def test_controls_read_back_and_do_not_write_on_poll(self):
        class Fake:
            state = False
            writes = 0

            def getBasicInfo(self):
                return {}

            def getBatteryStatus(self):
                return {}

            def getLED(self):
                return {"enabled": "on" if self.state else "off"}

            def setLEDEnabled(self, state):
                self.writes += 1
                self.state = state

        client = Fake()
        session = worker.Session(client)
        self.assertEqual(session.read()["controls"], {"led": False})
        self.assertEqual(client.writes, 0)
        self.assertEqual(session.write("led", True), {"control": "led", "value": True})
        self.assertEqual(client.writes, 1)
        session.write("led", True)
        self.assertEqual(client.writes, 1)
        with self.assertRaises(ValueError):
            session.write("setReboot", True)
        with self.assertRaises(ValueError):
            session.write("led", "on")

    def test_spotlight_recovers_after_the_first_read_fails(self):
        class Fake:
            attempts = 0
            state = False

            def getBasicInfo(self):
                return {}

            def getWhitelampStatus(self):
                self.attempts += 1
                if self.attempts == 1:
                    raise TimeoutError()
                return {"status": int(self.state)}

            def reverseWhitelampStatus(self):
                self.state = not self.state

        session = worker.Session(Fake())
        self.assertNotIn("whiteLight", session.read()["controls"])
        self.assertIs(session.read()["controls"]["whiteLight"], False)
        self.assertIs(session.write("whiteLight", True)["value"], True)

    def test_failed_write_is_not_reported_as_success(self):
        class Fake:
            def getLED(self):
                return {"enabled": "off"}

            def setLEDEnabled(self, state):
                pass

        session = worker.Session(Fake())
        session.supported = {"led"}
        with self.assertRaisesRegex(ValueError, "READBACK_FAILED"):
            session.write("led", True)

    def test_manual_alarm_falls_back_to_new_firmware_key_without_arming_detection(self):
        class Fake:
            requests = []
            alarm = {"enabled": "off", "alarm_mode": ["light"]}

            def getBasicInfo(self):
                return {}

            def getBatteryStatus(self):
                return {}

            def getAlarm(self):
                return self.alarm

            def performRequest(self, request):
                self.requests.append(request)
                command = next(iter(request["msg_alarm"]))
                if command == "manual_msg_alarm":
                    raise RuntimeError("Parameter does not exist (-40106)")
                return {"result": {"timer": 30}, "error_code": 0}

        client = Fake()
        session = worker.Session(client)
        before = session.read()["controls"]
        self.assertIs(before["alarmArmed"], False)
        self.assertIs(before["manualAlarm"], False)

        result = session.write("manualAlarm", True)
        self.assertEqual(result, {"control": "manualAlarm", "value": True, "durationSeconds": 30})
        self.assertEqual([next(iter(request["msg_alarm"])) for request in client.requests],
                         ["manual_msg_alarm", "manual_alarm"])
        active = session.read()["controls"]
        self.assertIs(active["manualAlarm"], True)
        self.assertIs(active["alarmArmed"], False)

        session.manual_alarm_until = worker.time.monotonic() - 1
        expired = session.read()["controls"]
        self.assertIs(expired["manualAlarm"], False)
        self.assertIs(expired["alarmArmed"], False)


if __name__ == "__main__":
    unittest.main()
