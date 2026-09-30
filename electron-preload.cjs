// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 DRAGON-EX
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('gp76App', {
  close: () => ipcRenderer.send('gp76:close-app'),
  openLink: link => ipcRenderer.send('gp76:open-link', link),
  integrationStatus: () => ipcRenderer.invoke('gp76:integration-status'),
  integrationChoice: choice => ipcRenderer.invoke('gp76:integration-choice', choice),
})
