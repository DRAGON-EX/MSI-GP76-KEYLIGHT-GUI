// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 DRAGON-EX
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: { '/api': 'http://127.0.0.1:8765' },
  },
})
