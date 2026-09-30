// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 DRAGON-EX
import { keyboardKeys } from './keyboard'

function hsl(hue, saturation = 88, lightness = 52) {
  const chroma = (1 - Math.abs(2 * lightness / 100 - 1)) * saturation / 100
  const segment = ((hue % 360) + 360) % 360 / 60
  const second = chroma * (1 - Math.abs(segment % 2 - 1))
  const [r, g, b] = segment < 1 ? [chroma, second, 0] : segment < 2 ? [second, chroma, 0] : segment < 3 ? [0, chroma, second] : segment < 4 ? [0, second, chroma] : segment < 5 ? [second, 0, chroma] : [chroma, 0, second]
  const offset = lightness / 100 - chroma / 2
  return `#${[r, g, b].map(channel => Math.round((channel + offset) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

function colorFor(id, key, index, time) {
  const x = key.x + key.w / 2
  const y = key.y
  switch (id) {
    case 'aqua': return hsl(168 + x * 1.2 + Math.sin(x * .55 - time * 2.2 + y * .6) * 8, 88, 43 + Math.sin(x * .7 - time * 2.5 + y) * 11)
    case 'disco': {
      const beat = Math.floor(time * 2.7)
      const seed = (index * 137 + beat * 83 + Math.floor(x * 5) * 31 + Math.floor(y * 7) * 43) % 360
      return hsl(seed, 94, 48 + (index + beat) % 4 * 4)
    }
    case 'freeway': return hsl((Math.floor((x + time * 3 + y * 1.6) / 2.4) * 52 + 12) % 360, 91, 45 + Math.sin(x - time * 3) * 8)
    case 'rainbow-split': return hsl((x * 19 + (y < 3 ? 0 : 125) + time * 26) % 360, 94, 49 + Math.sin(x * .6 - time * 2) * 6)
    case 'chakra': return hsl((Math.atan2(y - 3, x - 10) * 180 / Math.PI + time * 42 + 360) % 360, 84, 47 + Math.sin(time * 2 + x * .4) * 5)
    case 'drain': return hsl((x + time * 3) % 8 < 4 ? 189 : 2, 90, 28 + Math.sin(x * .8 - time * 3 + y) * 18)
    case 'roulette': {
      const marker = (Math.floor(time * 9) + index * 17) % 19
      return hsl((index * 29 + time * 34) % 360, 91, marker < 3 ? 61 : 28)
    }
    default: return hsl(20 + x * 1.5, 82, 39 + Math.sin(time * 1.7 + x * .4 + y * .4) * 10)
  }
}

export function presetPreviewColors(id, time = 0) {
  return Object.fromEntries(keyboardKeys.filter(key => key.code).map((key, index) => [key.code, colorFor(id, key, index, time)]))
}
