import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest


class WorkerIpcTests(unittest.TestCase):
    def test_json_protocol_suppresses_vendor_logs_and_does_not_reveal_password(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            metadata = root / "pytapo-3.4.30.dist-info"
            metadata.mkdir()
            (metadata / "METADATA").write_text("Name: pytapo\nVersion: 3.4.30\n")
            (root / "pytapo.py").write_text('''
class Tapo:
    def __init__(self, host, user, password, **kwargs):
        print(password)
    def getBasicInfo(self): return {}
    def getBatteryStatus(self):
        return {"battery":{"status":{"battery_percent":73,"battery_charging":"YES","low_battery":False}}}
    def getLED(self): return {"enabled":"on"}
''')
            requests = [
                {"id": 1, "op": "init", "config": {"host": "fixture", "secret": "fixture-private-secret"}},
                {"id": 2, "op": "read"},
                {"id": 3, "op": "write", "control": "setReboot", "value": True},
            ]
            script = pathlib.Path(__file__).parents[1] / "python/tapo_worker.py"
            result = subprocess.run([sys.executable, str(script)], input="\n".join(map(json.dumps, requests)) + "\n",
                                    text=True, capture_output=True, timeout=10,
                                    env={**os.environ, "PYTHONPATH": directory})
            self.assertEqual(result.returncode, 0)
            self.assertNotIn("fixture-private-secret", result.stdout + result.stderr)
            responses = [json.loads(line) for line in result.stdout.splitlines()]
            self.assertEqual(len(responses), 3)
            self.assertEqual(responses[0]["data"]["battery"]["level"], 73)
            self.assertEqual(responses[1]["data"]["battery"]["charging"], "CHARGING")
            self.assertFalse(responses[2]["ok"])


if __name__ == "__main__":
    unittest.main()
