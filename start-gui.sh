#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 DRAGON-EX
set -Eeuo pipefail

here=$(cd "$(dirname "$0")" && pwd -P)
cd "$here"

if [[ ! -f dist/index.html ]]; then
  printf 'React build missing. Run npm install && npm run build first.\n' >&2
  exit 1
fi
if [[ ! -x node_modules/electron/dist/electron ]]; then
  printf 'Electron/Chromium is missing. Run npm install and install the Electron runtime first.\n' >&2
  exit 1
fi

exec node_modules/.bin/electron . "$@"
