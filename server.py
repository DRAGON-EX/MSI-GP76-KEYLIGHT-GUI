#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 DRAGON-EX

from __future__ import annotations

import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
EXTENSION = Path(os.environ.get("GP76_EXTENSION_DIR") or ROOT / "vendor/GP76 Extension").resolve()
RUNTIME_DIR = None
if os.environ.get("GP76_STAGE_EXTENSION") == "1":
    RUNTIME_DIR = tempfile.TemporaryDirectory(prefix="gp76-keylight-")
    staged_extension = Path(RUNTIME_DIR.name) / "GP76 Extension"
    shutil.copytree(EXTENSION, staged_extension)
    EXTENSION = staged_extension
    shutil.copy2(ROOT / "startup_service.py", Path(RUNTIME_DIR.name) / "startup_service.py")
WRAPPER = EXTENSION / "gp76-keylight"
STARTUP_HELPER = (Path(RUNTIME_DIR.name) if RUNTIME_DIR else ROOT) / "startup_service.py"
PRESETS_SOURCE = EXTENSION / "msi_perkeyrgb/protocol_data/presets/1.json"
KEYMAP_SOURCE = EXTENSION / "msi_perkeyrgb/protocol_data/msi_keymaps.py"
STORAGE = Path(os.environ.get("GP76_GUI_DATA_DIR", ROOT / "data")) / "presets.json"
STARTUP = Path.home() / ".config/msi-gp76-keylight/startup.json"
PORT = int(os.environ.get("GP76_GUI_PORT", "8765"))
COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
NAME = re.compile(r"^[^\x00-\x1f<>]{1,40}$")
WRITE_LOCK = threading.Lock()
APPLY_LOCK = threading.Lock()
LAST_APPLY = 0.0
COOLDOWN_SECONDS = 20


def load_keymap():
    scope = {"__name__": "gp76_keymap"}
    exec(KEYMAP_SOURCE.read_text(encoding="utf-8"), scope)
    return next(mapping for models, mapping in scope["AVAILABLE_MSI_KEYMAPS"] if "GE75" in models)


def builtin_presets():
    source = json.loads(PRESETS_SOURCE.read_text(encoding="utf-8"))
    return [{"id": slug, "name": slug.replace("-", " ").title(), "colors": {}, "type": "builtin"} for slug in source]


def read_custom():
    if not STORAGE.exists():
        return []
    data = json.loads(STORAGE.read_text(encoding="utf-8"))
    return data if isinstance(data, list) else []


def save_custom(items):
    STORAGE.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=STORAGE.parent, prefix=".presets-", delete=False) as file:
        json.dump(items, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temporary = Path(file.name)
    os.replace(temporary, STORAGE)


def startup_enabled():
    unit = f"msi-gp76-keylight-{os.getuid()}.service"
    try:
        result = subprocess.run(["systemctl", "is-enabled", "--quiet", unit], timeout=3, check=False)
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def startup_selection(kind, preset_id):
    if kind == "builtin":
        if preset_id not in {item["id"] for item in builtin_presets()}:
            raise ValueError("Unknown controller effect.")
        return {"type": "builtin", "id": preset_id}
    if kind == "custom":
        item = next((item for item in read_custom() if item["id"] == preset_id), None)
        if not item or not item.get("colors"):
            raise ValueError("Save at least one key color before selecting this startup preset.")
        _, colors = validate_profile(item)
        return {"type": "custom", "id": preset_id, "colors": colors}
    raise ValueError("Invalid startup preset type.")


def save_startup(profile):
    STARTUP.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=STARTUP.parent, prefix=".startup-", delete=False) as file:
        os.fchmod(file.fileno(), 0o600)
        json.dump(profile, file)
        file.write("\n")
        temporary = Path(file.name)
    os.replace(temporary, STARTUP)


def install_startup(action):
    command = ["pkexec", sys.executable, str(STARTUP_HELPER), action, str(os.getuid())]
    if action == "install":
        command.append(str(EXTENSION))
    result = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
    if result.returncode:
        raise OSError((result.stderr or result.stdout or "Authorization was cancelled or service setup failed.").strip()[-500:])


def validate_profile(payload):
    name = payload.get("name")
    colors = payload.get("colors")
    if not isinstance(name, str) or not NAME.fullmatch(name.strip()):
        raise ValueError("Preset name must be 1 to 40 characters long.")
    if not isinstance(colors, dict) or len(colors) > 150:
        raise ValueError("Invalid key colors.")
    keymap = load_keymap()
    valid = {str(code) for code in keymap}
    for code, color in colors.items():
        if code not in valid or not isinstance(color, str) or not COLOR.fullmatch(color):
            raise ValueError("Invalid key or color.")
    return name.strip(), {code: value.upper() for code, value in colors.items()}


def controller_info():
    for device in Path("/sys/bus/usb/devices").glob("*"):
        try:
            if (device / "idVendor").read_text().strip() == "1038" and (device / "idProduct").read_text().strip() == "113a":
                manufacturer = (device / "manufacturer").read_text().strip() if (device / "manufacturer").is_file() else ""
                product = (device / "product").read_text().strip() if (device / "product").is_file() else ""
                name = product if product.lower().startswith(manufacturer.lower()) else " ".join(part for part in (manufacturer, product) if part)
                name = name or "USB 1038:113a"
                try:
                    result = subprocess.run(["lsusb", "-d", "1038:113a"], capture_output=True, text=True, timeout=2, check=False)
                    if result.returncode == 0:
                        line = next((line for line in result.stdout.splitlines() if "ID 1038:113a " in line), "")
                        if line:
                            lsusb_name = line.split("ID 1038:113a ", 1)[1].strip()
                            if lsusb_name:
                                name = product if product and product.casefold() in lsusb_name.casefold() else lsusb_name
                except (OSError, subprocess.TimeoutExpired):
                    pass
                return {"present": True, "name": name, "usbId": "1038:113a"}
        except (FileNotFoundError, PermissionError, OSError):
            continue
    return {"present": False, "name": None, "usbId": None}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[web] " + fmt % args)

    def reply(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/state":
            try:
                controller = controller_info()
                self.reply(200, {"builtins": builtin_presets(), "custom": read_custom(), "controllerPresent": controller["present"], "controllerName": controller["name"], "controllerUsbId": controller["usbId"], "hardwareAvailable": WRAPPER.is_file(), "startupEnabled": startup_enabled(), "startupSelection": json.loads(STARTUP.read_text(encoding="utf-8")) if STARTUP.is_file() else None})
            except (OSError, ValueError, KeyError) as error:
                self.reply(500, {"error": str(error)})
            return
        candidate = (ROOT / "dist" / path.lstrip("/")).resolve()
        dist = (ROOT / "dist").resolve()
        if path == "/" or not candidate.is_file() or dist not in candidate.parents:
            candidate = dist / "index.html"
        if not candidate.is_file():
            self.reply(404, {"error": "GUI has not been built. Run npm run build."})
            return
        import mimetypes
        content = candidate.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        global LAST_APPLY
        origin = self.headers.get("Origin", "")
        allowed = {f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}", "http://127.0.0.1:5173", "http://localhost:5173"}
        host = self.headers.get("Host", "")
        if origin not in allowed or host not in {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}:
            self.reply(403, {"error": "Local origin required."})
            return
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            self.reply(415, {"error": "JSON required."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 65536:
                raise ValueError("Invalid request size.")
            payload = json.loads(self.rfile.read(length))
            path = urlsplit(self.path).path
            if path == "/api/presets":
                name, colors = validate_profile(payload)
                requested_id = payload.get("id")
                with WRITE_LOCK:
                    items = read_custom()
                    if requested_id:
                        item = next((item for item in items if item["id"] == requested_id), None)
                        if item is None:
                            raise ValueError("Custom preset not found.")
                        item.update(name=name, colors=colors)
                    else:
                        item = {"id": str(uuid.uuid4()), "name": name, "colors": colors, "type": "custom"}
                        items.append(item)
                    save_custom(items)
                    if STARTUP.is_file():
                        try:
                            selected = json.loads(STARTUP.read_text(encoding="utf-8"))
                            if selected.get("type") == "custom" and selected.get("id") == item["id"] and colors:
                                save_startup(startup_selection("custom", item["id"]))
                        except (ValueError, KeyError, json.JSONDecodeError):
                            pass
                self.reply(200, {"preset": item, "custom": items})
            elif path == "/api/startup":
                action = payload.get("action")
                if action == "select":
                    profile = startup_selection(payload.get("type"), payload.get("id"))
                    save_startup(profile)
                    self.reply(200, {"enabled": startup_enabled(), "selection": profile})
                elif action == "enable":
                    profile = startup_selection(payload.get("type"), payload.get("id"))
                    save_startup(profile)
                    install_startup("install")
                    self.reply(200, {"enabled": True, "selection": profile})
                elif action == "disable":
                    install_startup("uninstall")
                    self.reply(200, {"enabled": False})
                else:
                    raise ValueError("Invalid startup action.")
            elif path == "/api/apply":
                kind, preset_id = payload.get("type"), payload.get("id")
                if kind == "builtin":
                    if preset_id not in {item["id"] for item in builtin_presets()}:
                        raise ValueError("Unknown controller preset.")
                    command = [str(WRAPPER), "preset", preset_id]
                elif kind == "custom":
                    item = next((item for item in read_custom() if item["id"] == preset_id), None)
                    if item is None or not item["colors"]:
                        raise ValueError("Preset is missing or has no colors.")
                    _, colors = validate_profile(item)
                    command = None
                else:
                    raise ValueError("Invalid preset type.")
                if not WRAPPER.is_file():
                    raise ValueError("GP76 Extension was not found.")
                if not APPLY_LOCK.acquire(blocking=False):
                    self.reply(429, {"error": "A lighting command is already running."})
                    return
                try:
                    remaining = COOLDOWN_SECONDS - (time.monotonic() - LAST_APPLY)
                    if remaining > 0:
                        self.reply(429, {"error": f"Please wait {int(remaining) + 1} more seconds before sending another controller command."})
                        return
                    config_path = None
                    try:
                        if kind == "custom":
                            with tempfile.NamedTemporaryFile("w", encoding="ascii", prefix="gp76-gui-", suffix=".conf", delete=False) as config:
                                config.writelines(f"{code} steady {color[1:].lower()}\n" for code, color in colors.items())
                                config_path = config.name
                            command = [str(WRAPPER), "config", config_path]
                        if os.geteuid() != 0:
                            command = ["pkexec", *command]
                        LAST_APPLY = time.monotonic()
                        result = subprocess.run(command, cwd=EXTENSION, capture_output=True, text=True, timeout=120, check=False)
                        if result.returncode:
                            self.reply(502, {"error": (result.stderr or result.stdout or "Lighting command failed.").strip()[-500:]})
                        else:
                            self.reply(200, {"message": "Preset was sent to the controller.", "output": result.stdout.strip()})
                    finally:
                        if config_path:
                            Path(config_path).unlink(missing_ok=True)
                finally:
                    APPLY_LOCK.release()
            else:
                self.reply(404, {"error": "Unknown API path."})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            self.reply(400, {"error": str(error)})
        except (OSError, subprocess.TimeoutExpired) as error:
            self.reply(502, {"error": str(error)})


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, signal.default_int_handler)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"MSI-GP76-KEYLIGHT: http://127.0.0.1:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if RUNTIME_DIR is not None:
            RUNTIME_DIR.cleanup()
