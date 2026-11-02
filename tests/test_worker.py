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


if __name__ == "__main__":
    unittest.main()
