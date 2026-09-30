// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 DRAGON-EX
const key = (code, label, w = 1, h = 1) => ({ code: code == null ? null : String(code), label, w, h })
const top = (code, label) => key(code, label, 1, .72)
const space = w => ({ space: w })

function place(y, x, entries) {
  return entries.flatMap(item => {
    const current = x
    x += item.space || item.w
    return item.space ? [] : [{ ...item, x: current, y }]
  })
}

export const keyboardKeys = [
  ...place(0, 0, [top(9, 'Esc'), top(67, 'F1'), top(68, 'F2'), top(69, 'F3'), top(70, 'F4'), top(71, 'F5'), top(72, 'F6'), top(73, 'F7'), top(74, 'F8'), top(75, 'F9'), top(76, 'F10'), top(95, 'F11'), top(96, 'F12'), top(78, 'Roll'), top(118, 'Einfg'), top(119, 'Entf'), top(107, 'Druck'), top(112, 'Bild↑'), top(117, 'Bild↓'), top(null, 'Power')]),
  ...place(1.13, 0, [key(49, '^'), key(10, '1'), key(11, '2'), key(12, '3'), key(13, '4'), key(14, '5'), key(15, '6'), key(16, '7'), key(17, '8'), key(18, '9'), key(19, '0'), key(20, 'ß'), key(21, '´'), key(22, 'Back', 2.3)]),
  ...place(1.13, 15.8, [key(77, 'Num'), key(106, '/'), key(63, '*'), key(82, '−')]),
  ...place(2.13, 0, [key(23, 'Tab', 1.5), key(24, 'Q'), key(25, 'W'), key(26, 'E'), key(27, 'R'), key(28, 'T'), key(29, 'Z'), key(30, 'U'), key(31, 'I'), key(32, 'O'), key(33, 'P'), key(34, 'Ü'), key(35, '+'), key(51, '#', 1.8)]),
  ...place(2.13, 15.8, [key(79, '7'), key(80, '8'), key(81, '9'), key(86, '+', 1, 2)]),
  ...place(3.13, 0, [key(66, 'Caps', 1.75), key(38, 'A'), key(39, 'S'), key(40, 'D'), key(41, 'F'), key(42, 'G'), key(43, 'H'), key(44, 'J'), key(45, 'K'), key(46, 'L'), key(47, 'Ö'), key(48, 'Ä'), key(36, 'Enter', 2.55)]),
  ...place(3.13, 15.8, [key(83, '4'), key(84, '5'), key(85, '6')]),
  ...place(4.13, 0, [key(50, 'Shift', 1.6), key(52, 'Y'), key(53, 'X'), key(54, 'C'), key(55, 'V'), key(56, 'B'), key(57, 'N'), key(58, 'M'), key(59, ','), key(60, '.'), key(61, '−'), key(62, 'Shift', 2.9)]),
  ...place(4.13, 14.8, [key(111, '↑')]),
  ...place(4.13, 15.8, [key(87, '1'), key(88, '2'), key(89, '3'), key(104, 'Enter', 1, 2)]),
  ...place(5.13, 0, [key(37, 'Strg', 1.1), key(133, 'Win', 1.1), key(64, 'Alt', 1.1), key(65, 'Space', 6.3), key(108, 'Alt Gr', 1.1), key(94, '<'), key('fn', 'Fn'), key(105, 'Strg', 1.1)]),
  ...place(5.13, 13.8, [key(113, '←'), key(116, '↓'), key(114, '→')]),
  ...place(5.13, 16.8, [key(90, '0'), key(91, ',')]),
]

export const keyCodes = [...new Set(keyboardKeys.filter(item => item.code).map(item => item.code))]
export const keyName = code => keyboardKeys.find(item => item.code === code)?.label ?? code
export const normalizeHex = value => {
  const clean = value.trim().replace(/^#/, '').toUpperCase()
  return /^[0-9A-F]{6}$/.test(clean) ? `#${clean}` : null
}
export const rgbFromHex = hex => [0, 2, 4].map(i => parseInt(hex.slice(i + 1, i + 3), 16))
export const hexFromRgb = rgb => `#${rgb.map(v => Number(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
