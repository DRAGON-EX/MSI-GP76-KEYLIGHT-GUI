#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 DRAGON-EX

import json
import os
import pwd
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path("/usr/local/libexec/msi-gp76-keylight")
UNITS = Path("/etc/systemd/system")
PRESETS = {"aqua", "chakra", "default", "disco", "drain", "freeway", "rainbow-split", "roulette"}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def paths(uid):
    if uid < 1000 or uid > 60000:
        raise ValueError("Invalid desktop user.")
    user_home = Path(pwd.getpwuid(uid).pw_dir)
    return (ROOT / str(uid), UNITS / f"msi-gp76-keylight-{uid}.service",
            user_home / ".config/msi-gp76-keylight/startup.json")


def checked_profile(config, extension):
    if not isinstance(config, dict):
        raise ValueError("Invalid startup profile.")
    kind = config.get("type")
    if kind == "builtin":
        preset = config.get("id")
        if preset not in PRESETS:
            raise ValueError("Unknown controller effect.")
        return [str(extension / "gp76-keylight"), "preset", preset], None
    if kind == "custom":
        colors = config.get("colors")
        if not isinstance(colors, dict) or not 0 < len(colors) <= 150:
            raise ValueError("Invalid startup colors.")
        lines = []
        for key, color in colors.items():
            if not isinstance(key, str) or not key.isdecimal() or not isinstance(color, str) or not HEX.fullmatch(color):
                raise ValueError("Invalid startup key color.")
            lines.append(f"{key} steady {color[1:].lower()}\n")
        return [str(extension / "gp76-keylight"), "config"], lines
    raise ValueError("Invalid startup profile type.")


def run(uid):
    target, _, config_path = paths(uid)
    if config_path.is_symlink() or not config_path.is_file() or config_path.stat().st_uid != uid:
        raise ValueError("Startup profile is missing or has the wrong owner.")
    extension = target / "extension"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    command, lines = checked_profile(config, extension)
    if lines is not None:
        with tempfile.NamedTemporaryFile("w", encoding="ascii", prefix="gp76-startup-", suffix=".conf", delete=False) as file:
            file.writelines(lines)
            command.append(file.name)
        temporary = Path(file.name)
    else:
        temporary = None
    try:
        result = subprocess.run(command, cwd=extension, timeout=120, check=False)
        return result.returncode
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def install(uid, source):
    target, unit, _ = paths(uid)
    source = Path(source).resolve(strict=True)
    if not (source / "gp76-keylight").is_file() or not (source / "msi_perkeyrgb/main.py").is_file():
        raise ValueError("The controller extension is incomplete.")
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o755)
    with tempfile.TemporaryDirectory(prefix=f".{uid}-", dir=ROOT) as staging:
        stage = Path(staging)
        shutil.copy2(Path(__file__), stage / "startup_service.py")
        shutil.copytree(source, stage / "extension")
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(stage, target)
    unit.write_text(
        "[Unit]\nDescription=Apply MSI GP76 keyboard lighting at boot\n"
        "After=systemd-udev-settle.service\nWants=systemd-udev-settle.service\nConditionPathExists="
        + str(paths(uid)[2]) + "\n\n[Service]\nType=oneshot\n"
        + f"ExecStart=/usr/bin/python3 {target / 'startup_service.py'} run {uid}\n"
        + "TimeoutStartSec=150\n\n[Install]\nWantedBy=multi-user.target\n",
        encoding="utf-8",
    )
    subprocess.run(["systemctl", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "enable", unit.name], check=True)


def uninstall(uid):
    target, unit, _ = paths(uid)
    subprocess.run(["systemctl", "disable", unit.name], check=False)
    unit.unlink(missing_ok=True)
    if target.exists():
        shutil.rmtree(target)
    subprocess.run(["systemctl", "daemon-reload"], check=True)


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in {"install", "uninstall", "run"}:
        raise ValueError("Usage: startup_service.py install|uninstall|run UID [EXTENSION]")
    action, uid = sys.argv[1], int(sys.argv[2])
    if os.geteuid() != 0:
        raise PermissionError("Root authorization is required.")
    if action in {"install", "uninstall"} and os.environ.get("PKEXEC_UID") != str(uid):
        raise PermissionError("Authorized user does not match the service owner.")
    if action == "run":
        return run(uid)
    if action == "install":
        if len(sys.argv) != 4:
            raise ValueError("Controller extension path required.")
        install(uid, sys.argv[3])
    else:
        uninstall(uid)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Startup service: {error}", file=sys.stderr)
        sys.exit(1)
