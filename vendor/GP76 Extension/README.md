# GP76 Extension for msi-perkeyrgb

This folder contains the GP76-specific setup that worked on an MSI GP76 Leopard 11UG running CachyOS. It includes a copy of the original project:

https://github.com/Askannz/msi-perkeyrgb

Compared with the upstream source, only hidapi_wrapping.py differs: it opens the selected HID path from GP76_HIDRAW and increases the delay between HID reports from 0.01 to 0.1 seconds. The change is also saved as gp76-hidapi.patch.

## Use

Open a terminal in this GP76 Extension folder. The command requires sudo to bind and release the USB controller. Choose one lighting command for a run:

    sudo ./gp76-keylight color red
    sudo ./gp76-keylight color red numpad
    sudo ./gp76-keylight color '#0080ff' win
    sudo ./gp76-keylight color 080000 133
    sudo ./gp76-keylight preset rainbow-split

The first color command targets the whole keyboard. Other supported targets are listed by:

    ./gp76-keylight --help

The supported named colors are red, green, blue, white, yellow, cyan, magenta, orange, purple, black, and off. A six-digit RGB value is also accepted. For example, 080000 is a very dim red.

The wrapper checks the arguments before touching the controller. It finds the SteelSeries KLC device (USB 1038:113a), binds it if needed, waits for udev and another two seconds, finds its HID interface, makes one msi-perkeyrgb program invocation with the GE75 layout, and releases the USB binding it created. A lock prevents two copies of the wrapper from running at the same time.

## Controller behavior

This particular GP76 controller has become unresponsive after repeated or poorly timed RGB updates. On this machine, a reboot was needed to restore it. The wrapper makes one program invocation per command and does not retry. A preset or whole-keyboard update can still contain multiple HID reports within that invocation. Avoid running several lighting commands back-to-back.

The numpad color, left Windows key color, and rainbow-split preset were tried successfully with this setup. The whole-keyboard color command uses the same source code but has not been tried on this machine.

## Files

- gp76-keylight: manual color and preset command.
- msi_perkeyrgb/: copy of the locally working Python package and its preset data.
- gp76-hidapi.patch: the exact Python source difference from the cloned upstream project.
- LICENSE-GPL-3.0-only.txt: license for the original GP76 wrapper.
- msi_perkeyrgb/LICENSE: original MIT license of the copied controller package.

## License

Copyright © 2026 [DRAGON-EX](https://github.com/DRAGON-EX). The GP76 wrapper and this documentation are licensed under GNU GPL version 3 only; see LICENSE-GPL-3.0-only.txt. The copied msi_perkeyrgb package and its patch retain the MIT License and copyright © 2018 Askannz; see msi_perkeyrgb/LICENSE. Keep that notice when distributing the package.
