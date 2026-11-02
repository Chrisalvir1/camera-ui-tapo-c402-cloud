"""Read-only transport audit. Receive profile JSON on stdin; never print credentials.
Capture decrypted camera TS before go2rtc, inspect codec headers with FFmpeg,
and delete temporary media. No filters or encoder are used.
"""
import asyncio
import json
import os
import subprocess
import sys
import tempfile
import time
from pytapo import Tapo
from pytapo.media_stream._utils import StreamType

async def capture(tapo, path, preview):
    session = tapo.getMediaSession(StreamType.Stream)
    started = time.monotonic()
    count = 0
    async with session:
        payload = json.dumps({"type": "request", "seq": 1,
                              "params": {"preview": preview, "method": "get"}})
        with open(path, "wb") as media:
            async for response in session.transceive(payload, no_data_timeout=6):
                if response.mimetype != "video/mp2t":
                    data = response.json_data or {}
                    code = data.get("params", {}).get("error_code", data.get("error_code", 0))
                    if code:
                        print(json.dumps({"camera_error_code": code}), flush=True)
                        raise RuntimeError("CAMERA_REJECTED_PREVIEW")
                if response.mimetype == "video/mp2t":
                    media.write(response.plaintext)
                    count += len(response.plaintext)
                    if count > 200000 and time.monotonic() - started > 2:
                        break
    if not count:
        raise RuntimeError("NO_NATIVE_MEDIA")
    return count

async def main(tapo):
    ffmpeg = os.environ.get("TAPO_AUDIT_FFMPEG", "ffmpeg")
    variants = [("HD default", {"audio": ["default"], "channels": [0], "resolutions": ["HD"]}),
                ("HD main selector", {"audio": ["default"], "channels": [0], "resolutions": ["HD"], "streams": ["main"]})]
    for name, preview in variants:
        try:
            with tempfile.TemporaryDirectory(prefix="tapo-native-audit-") as directory:
                path = os.path.join(directory, "raw.ts")
                count = await asyncio.wait_for(capture(tapo, path, preview), timeout=12)
                result = subprocess.run([ffmpeg, "-hide_banner", "-i", path,
                                         "-map", "0:v:0", "-frames:v", "1", "-c", "copy", "-f", "null", "-"],
                                        capture_output=True, text=True, timeout=8)
                lines = [line.strip() for line in result.stderr.splitlines() if "Video:" in line]
                print(json.dumps({"preview": name, "bytes": count, "video": lines}), flush=True)
        except Exception:
            print(json.dumps({"preview": name, "error": "Capture unavailable; private details omitted"}), flush=True)
            raise RuntimeError("NATIVE_AUDIT_INCOMPLETE")

if __name__ == "__main__":
    try:
        config = json.load(sys.stdin)
        tapo = Tapo(config["host"], "admin", config["secret"], cloudPassword=config["secret"], printWarnInformation=False, retryStok=False)
        asyncio.run(main(tapo))
    except Exception as error:
        import traceback
        print(json.dumps({"error_type": type(error).__name__, "locations": [f"{os.path.basename(frame.filename)}:{frame.lineno}" for frame in traceback.extract_tb(error.__traceback__)]}))
        sys.exit(1)
