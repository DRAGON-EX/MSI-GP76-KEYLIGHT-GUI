# MSI-GP76-KEYLIGHT

<img src="icon.png" width="128" alt="MSI-GP76-KEYLIGHT app icon">

A compact Linux Electron/React app for the MSI GP76 per-key keyboard lighting controller. Preview controller effects, create custom key colors, and apply a preset to the keyboard on demand.

I wanted to build this app because the keyboard backlight on my MSI GP76 wasn't working on Windows. That led me to create a friendly Linux app with a clean GUI for choosing effects and making my own lighting presets. 🐉✨

![MSI-GP76-KEYLIGHT showing the Rainbow Split controller effect](docs/app-screenshot.png)

## Requirements 🧰

- Linux x86-64; Node.js 20.19+ or 22.12+ and npm to build.
- For hardware access: Python 3, Bash, `lsusb` (`usbutils`), `udevadm` (`udev`), `flock` (`util-linux`), `ldconfig`, `libhidapi-hidraw`, and `pkexec` (polkit).
- The compatible SteelSeries KLC USB controller (`1038:113a`). The interface works in preview mode without it.
- `systemd` only if you enable **Apply on startup**.

## Build it yourself 🛠️

```bash
npm ci
npm run build
npm run app
```

To produce a portable Linux AppImage:

```bash
npm ci
npm run build:appimage
chmod +x release/MSI-GP76-KEYLIGHT-1.0.0-x86_64.AppImage
./release/MSI-GP76-KEYLIGHT-1.0.0-x86_64.AppImage
```

The AppImage bundles Electron, the React interface, and the GP76 controller code; it still uses the host hardware tools and library listed above. On first launch it can add an application-menu entry. Controller effects stay read-only; custom presets are saved in the user's app data directory. Applying colors requires an explicit action and authorization through `pkexec`. The controller can become unresponsive after poorly timed updates, so read the startup warning before sending commands.

## Paths and local configuration

The source checkout can live in any directory. Run `./start-gui.sh` after building; it locates the app relative to the script. The controller code is loaded from `vendor/GP76 Extension` in the app directory. A standalone `python3 server.py` can use `GP76_EXTENSION_DIR` to select another controller directory explicitly.

The AppImage generates its menu launcher using its current location and installs the icon and launcher under `XDG_DATA_HOME` (or `~/.local/share`). It refreshes an installed launcher when started from a new location. The checked-in `MSI-GP76-KEYLIGHT.desktop` is a generic packaging entry for an installed `msi-gp76-keylight` executable on `PATH` and an installed icon of the same name; use the AppImage's menu integration for an AppImage installation.

Custom presets use Electron's user data directory in the AppImage and `data/` in a source checkout. For a standalone backend, `GP76_GUI_DATA_DIR` overrides the preset directory and `GP76_GUI_PORT` overrides the default port `8765`. Set the same port when running `npm run dev` so its API proxy reaches the backend. Local `.env` files are ignored by Git; set these variables in the process environment.

The startup profile stays in `~/.config/msi-gp76-keylight/startup.json`, with the user's home resolved from the operating system by the privileged helper. Its system service and controller copy use `/etc/systemd/system` and `/usr/local/libexec/msi-gp76-keylight`. USB detection uses Linux's `/sys` and `/dev` interfaces. These are Linux installation locations, not paths tied to a particular user or checkout.

## License 📄

Copyright © 2026 [DRAGON-EX](https://github.com/DRAGON-EX). Original app code and artwork are licensed under [GNU GPL v3 only](LICENSE). The bundled `msi_perkeyrgb` code retains the upstream MIT notice in [THIRD_PARTY_LICENSES/msi-perkeyrgb-MIT.txt](THIRD_PARTY_LICENSES/msi-perkeyrgb-MIT.txt). Distributions of this app or modified versions must provide the corresponding source code under GPLv3.

**THIS SOFTWARE COMES WITH NO WARRANTY.**
