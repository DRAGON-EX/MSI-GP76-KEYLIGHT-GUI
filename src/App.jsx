// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 DRAGON-EX
import { useEffect, useMemo, useRef, useState } from 'react'
import { hexFromRgb, keyboardKeys, keyCodes, keyName, normalizeHex, rgbFromHex } from './keyboard'
import { presetPreviewColors } from './presetPreview'
import appIcon from '../icon.png'

const PRESET_NAMES = { 'rainbow-split': 'Rainbow Split', aqua: 'Aqua', chakra: 'Chakra', default: 'Default', disco: 'Disco', drain: 'Drain', freeway: 'Freeway', roulette: 'Roulette' }
const EMPTY_COLOR = '#12100F'
const PROFILE_LINKS = [
  { id: 'github', label: 'GitHub', url: 'https://github.com/DRAGON-EX' },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@FireDragonX3' },
  { id: 'mixcloud', label: 'Mixcloud', url: 'https://www.mixcloud.com/DRAGON-X/' },
]

const previewColor = hex => hex || EMPTY_COLOR

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Action failed.')
  return body
}

function Keyboard({ colors, effectId, selectedCodes, onSelect, editable, mode }) {
  const board = useRef(null)
  const frame = useRef(null)
  const [unit, setUnit] = useState(34)
  const [drag, setDrag] = useState(null)
  const [animationTime, setAnimationTime] = useState(0)
  const selected = new Set(selectedCodes)
  const displayedColors = useMemo(() => effectId ? presetPreviewColors(effectId, animationTime) : colors, [effectId, animationTime, colors])

  useEffect(() => {
    if (!effectId) return undefined
    const started = performance.now()
    const timer = window.setInterval(() => setAnimationTime((performance.now() - started) / 1000), 450)
    return () => window.clearInterval(timer)
  }, [effectId])

  useEffect(() => {
    const space = frame.current?.parentElement
    if (!space) return undefined
    const resize = () => setUnit(Math.max(20, Math.min((space.clientWidth - 32) / 20, (space.clientHeight - 32) / 6.13)))
    const observer = new ResizeObserver(resize)
    observer.observe(space)
    resize()
    return () => observer.disconnect()
  }, [])

  function point(event) {
    const bounds = board.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(20, (event.clientX - bounds.left) / bounds.width * 20)),
      y: Math.max(0, Math.min(6.13, (event.clientY - bounds.top) / bounds.height * 6.13)),
    }
  }

  function startDrag(event) {
    if (!editable || mode !== 'box' || event.button !== 0) return
    const start = point(event)
    setDrag({ start, end: start })
    board.current.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function moveDrag(event) {
    if (drag) setDrag(previous => ({ ...previous, end: point(event) }))
  }

  function finishDrag(event) {
    if (!drag) return
    const end = point(event)
    const left = Math.min(drag.start.x, end.x)
    const right = Math.max(drag.start.x, end.x)
    const top = Math.min(drag.start.y, end.y)
    const bottom = Math.max(drag.start.y, end.y)
    const click = right - left < .15 && bottom - top < .15
    const chosen = keyboardKeys.filter(key => key.code && (click
      ? end.x >= key.x && end.x <= key.x + key.w && end.y >= key.y && end.y <= key.y + key.h
      : key.x + key.w / 2 >= left && key.x + key.w / 2 <= right && key.y + key.h / 2 >= top && key.y + key.h / 2 <= bottom
    )).map(key => key.code)
    onSelect(chosen)
    setDrag(null)
    if (board.current.hasPointerCapture(event.pointerId)) board.current.releasePointerCapture(event.pointerId)
  }

  const rect = drag && {
    x: Math.min(drag.start.x, drag.end.x), y: Math.min(drag.start.y, drag.end.y),
    w: Math.abs(drag.start.x - drag.end.x), h: Math.abs(drag.start.y - drag.end.y),
  }

  return <div ref={frame} className="keyboard-frame" style={{ '--u': `${unit}px` }}><div ref={board} className={`keyboard-board ${editable && mode === 'box' ? 'box-mode' : ''}`} role="group" aria-label="GP76 keyboard preview" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={() => setDrag(null)}>
    {keyboardKeys.map((item, index) => <button type="button" key={`${item.code}-${index}`} disabled={!editable || !item.code} className={`keyboard-key ${selected.has(item.code) && editable ? 'selected' : ''} ${item.w > 1.3 ? 'wide-key' : ''} ${item.h < 1 ? 'function-key' : ''} ${!editable && item.code ? 'preview-key' : ''}`} title={item.code ? `${item.label} · key ${item.code}` : 'No GE75 mapping'} aria-label={item.code === '133' ? 'Windows key' : item.code ? `${item.label}, key ${item.code}` : item.label} onClick={() => { if (mode === 'single') onSelect([item.code]) }} style={{ '--x': item.x, '--y': item.y, '--w': item.w, '--h': item.h, '--light': previewColor(displayedColors[item.code]) }}><span>{item.code === '133' ? <svg className="windows-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 4.2 10.6 3v8H2zm10  -1.4L22 1.4V11H12zM2 12.6h8.6v8L2 19.4zm10 0h10v9.6l-10-1.4z" /></svg> : item.label}</span></button>)}
    {rect && <div className="selection-rectangle" style={{ '--rx': rect.x, '--ry': rect.y, '--rw': rect.w, '--rh': rect.h }} />}
  </div></div>
}

function SelectionIcon({ mode }) {
  return mode === 'single'
    ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2.5v13l3.3-3.2 2.3 4.9 2.4-1.1-2.3-4.9 4.7-.2z" /></svg>
    : <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3" width="15" height="13.5" rx="1" strokeDasharray="2 2" /><path d="M7 8h6v4H7z" /></svg>
}

function ProfileIcon({ id }) {
  if (id === 'youtube') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 6 3-6 3z" /></svg>
  if (id === 'mixcloud') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18H5a3 3 0 0 1-.2-6A7 7 0 0 1 18 11a3.5 3.5 0 0 1 .5 7H15" /><path d="M9 13v5m3-7v7" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-5 1-5-2-7-2m14 4v-3.5a3.3 3.3 0 0 0-.9-2.5c3-.3 6-1.5 6-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.4-.4-3.7 1.4a13 13 0 0 0-7 0C6.6.7 5.2 1.1 5.2 1.1a4.8 4.8 0 0 0-.1 3.6A5.2 5.2 0 0 0 3.7 8.3c0 5.2 3 6.4 6 6.7a3.3 3.3 0 0 0-.9 2.5V21" /></svg>
}

function ExternalLink({ id, url, children, className }) {
  return <a className={className} href={url} target="_blank" rel="noopener noreferrer" onClick={event => { if (window.gp76App?.openLink) { event.preventDefault(); window.gp76App.openLink(id) } }}>{children}</a>
}

function NewPreset({ baseName, defaultName, onClose, onCreate }) {
  const [name, setName] = useState(defaultName)
  const [copy, setCopy] = useState(Boolean(baseName))
  return <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="new-preset-title">
    <h2 id="new-preset-title">New preset</h2><p>Choose a name for your lighting profile.</p>
    <label htmlFor="preset-name">Name</label><input id="preset-name" autoFocus maxLength={40} value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && name.trim()) onCreate(name.trim(), copy) }} />
    {baseName && <label className="copy-option"><input type="checkbox" checked={copy} onChange={event => setCopy(event.target.checked)} /> Copy colors from the current preset</label>}
    <div className="dialog-actions"><button className="subtle-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!name.trim()} onClick={() => onCreate(name.trim(), copy)}>Create</button></div>
  </div></div>
}

export default function App() {
  const [data, setData] = useState({ builtins: [], custom: [], controllerPresent: false })
  const [controllerChecked, setControllerChecked] = useState(false)
  const [active, setActive] = useState(null)
  const [draft, setDraft] = useState(null)
  const [selectedCodes, setSelectedCodes] = useState([])
  const [selectionMode, setSelectionMode] = useState('single')
  const [hexText, setHexText] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [integrationChecked, setIntegrationChecked] = useState(!window.gp76App?.integrationStatus)
  const [integrationOpen, setIntegrationOpen] = useState(false)
  const [integrationBusy, setIntegrationBusy] = useState(false)
  const [integrationError, setIntegrationError] = useState('')
  const [startupBusy, setStartupBusy] = useState(false)
  const [startupError, setStartupError] = useState('')
  const [startupWarningOpen, setStartupWarningOpen] = useState(() => new URLSearchParams(window.location.search).get('suppressWarning') !== '1')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const all = [...data.builtins, ...data.custom]
  const saved = all.find(item => item.id === active?.id && item.type === active?.type)
  const preset = draft || saved
  const previewColors = useMemo(() => preset?.type === 'builtin' ? presetPreviewColors(preset.id) : null, [preset?.type, preset?.id])
  const colors = previewColors || preset?.colors || {}
  const selected = selectedCodes[0]
  const color = colors[selected] || '#000000'
  const rgb = rgbFromHex(color)
  const editable = Boolean(preset && preset.type !== 'builtin')
  const coloredCount = useMemo(() => Object.keys(colors).filter(code => keyCodes.includes(code)).length, [colors])
  const controllerName = data.controllerName || 'keyboard'
  const nextPresetName = useMemo(() => {
    let number = 1
    const used = new Set(data.custom.map(item => item.name.toLowerCase()))
    while (used.has(`custom preset ${number}`)) number++
    return `Custom Preset ${number}`
  }, [data.custom])

  useEffect(() => {
    api('/api/state').then(result => {
      setData(result)
      const stored = result.startupSelection
      const first = [...result.builtins, ...result.custom].find(item => item.id === stored?.id && item.type === stored?.type)
        || result.builtins.find(item => item.id === 'rainbow-split') || result.builtins[0]
      if (first) setActive({ id: first.id, type: first.type })
    }).catch(error => setNotice(`Server unavailable: ${error.message}`)).finally(() => setControllerChecked(true))
  }, [])
  useEffect(() => {
    if (!window.gp76App?.integrationStatus) return
    window.gp76App.integrationStatus().then(result => setIntegrationOpen(Boolean(result.prompt))).catch(error => setNotice(`Launcher setup: ${error.message}`)).finally(() => setIntegrationChecked(true))
  }, [])
  useEffect(() => setHexText(color), [color, selected])

  async function chooseIntegration(choice) {
    setIntegrationBusy(true)
    setIntegrationError('')
    try {
      const result = await window.gp76App.integrationChoice(choice)
      setIntegrationOpen(false)
      if (result.installed) setNotice('Added to your applications menu.')
    } catch (error) {
      setIntegrationError(error.message)
    } finally {
      setIntegrationBusy(false)
    }
  }

  function selectPreset(value) {
    if (value === 'draft') return
    if (dirty && !window.confirm('Discard unsaved changes?')) return
    const [type, id] = value.split(':')
    setActive({ type, id })
    setDraft(null)
    setSelectedCodes(type === 'builtin' ? [] : ['133'])
    setSelectionMode('single')
    setDirty(false)
    setNotice('')
    if (data.startupEnabled) {
      api('/api/startup', { method: 'POST', body: JSON.stringify({ action: 'select', type, id }) })
        .then(result => setData(previous => ({ ...previous, startupSelection: result.selection })))
        .catch(error => setNotice(`Startup preset: ${error.message}`))
    }
  }

  function createPreset(name, copy) {
    setDraft({ id: null, type: 'draft', name, colors: copy ? { ...colors } : {} })
    setActive(null)
    setSelectedCodes(['133'])
    setSelectionMode('single')
    setDirty(true)
    setNewOpen(false)
    setNotice('Draft created. Choose key colors, then save the preset.')
  }

  function changeColor(next) {
    if (!editable || !selectedCodes.length) return
    setDraft({ ...preset, colors: { ...colors, ...Object.fromEntries(selectedCodes.map(code => [code, next])) } })
    setDirty(true)
  }

  function setChannel(channel, value) {
    const next = [...rgb]
    next[channel] = Number(value)
    changeColor(hexFromRgb(next))
  }

  async function savePreset() {
    if (!editable || busy) return
    setBusy(true)
    try {
      const result = await api('/api/presets', { method: 'POST', body: JSON.stringify({ id: preset.type === 'custom' ? preset.id : undefined, name: preset.name, colors }) })
      setData(previous => ({ ...previous, custom: result.custom }))
      setActive({ id: result.preset.id, type: 'custom' })
      setDraft(null)
      setDirty(false)
      setNotice('Preset saved. No command was sent to the keyboard.')
      if (data.startupEnabled && Object.keys(colors).length) {
        const startupResult = await api('/api/startup', { method: 'POST', body: JSON.stringify({ action: 'select', type: 'custom', id: result.preset.id }) })
        setData(previous => ({ ...previous, startupSelection: startupResult.selection }))
        setNotice('Preset saved and startup colors updated. No command was sent to the keyboard.')
      }
    } catch (error) { setNotice(error.message) }
    finally { setBusy(false) }
  }

  async function applyPreset() {
    if (!preset || dirty || busy) return
    setBusy(true)
    setNotice('Sending command …')
    try {
      const result = await api('/api/apply', { method: 'POST', body: JSON.stringify({ type: preset.type, id: preset.id }) })
      setNotice(result.message)
    } catch (error) { setNotice(error.message) }
    finally { setBusy(false) }
  }

  async function toggleStartup() {
    if (startupBusy) return
    setStartupBusy(true)
    setStartupError('')
    try {
      const result = await api('/api/startup', { method: 'POST', body: JSON.stringify({ action: data.startupEnabled ? 'disable' : 'enable', type: preset?.type, id: preset?.id }) })
      setData(previous => ({ ...previous, startupEnabled: result.enabled, startupSelection: result.selection || previous.startupSelection }))
      setNotice(result.enabled ? 'Current preset will be applied at system startup.' : 'Automatic startup lighting disabled.')
    } catch (error) { setStartupError(error.message) }
    finally { setStartupBusy(false) }
  }

  return <div className="app">
    <header className="app-header"><img className="app-logo" src={appIcon} alt="" /><div className="app-title"><strong>MSI-GP76-KEYLIGHT</strong><span>GP76 Leopard · Lighting control</span></div><div className="header-spacer" /><span className={`device-indicator ${data.controllerPresent ? 'connected' : ''}`}><i />{data.controllerPresent ? `${controllerName} connected` : 'No compatible controller detected'}</span><button className="icon-button" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}>⚙</button></header>

    <div className="preset-bar"><div className="preset-picker"><label htmlFor="preset-select">PRESET</label><select id="preset-select" value={draft?.type === 'draft' ? 'draft' : active ? `${active.type}:${active.id}` : ''} onChange={event => selectPreset(event.target.value)}>
      {draft?.type === 'draft' && <option value="draft">{draft.name} · Draft</option>}
      <optgroup label="Controller">{data.builtins.map(item => <option key={item.id} value={`builtin:${item.id}`}>{PRESET_NAMES[item.id] || item.name}</option>)}</optgroup>
      {data.custom.length > 0 && <optgroup label="My presets">{data.custom.map(item => <option key={item.id} value={`custom:${item.id}`}>{item.name}</option>)}</optgroup>}
    </select></div><button className="outline-button new-button" onClick={() => setNewOpen(true)}>＋ New preset</button></div>

    <div className="workspace"><section className="keyboard-panel"><div className="panel-heading"><div className="keyboard-tools"><span>{coloredCount} / {keyCodes.length} keys</span><div className="selection-tools" aria-label="Selection tools">
      <button type="button" className={`tool-button ${selectionMode === 'single' && editable ? 'active' : ''}`} aria-label="Select one key" title="Select one key" aria-pressed={selectionMode === 'single' && editable} disabled={!editable} onClick={() => setSelectionMode('single')}><SelectionIcon mode="single" /></button>
      <button type="button" className={`tool-button ${selectionMode === 'box' && editable ? 'active' : ''}`} aria-label="Select multiple keys with a rectangle" title="Select multiple keys with a rectangle" aria-pressed={selectionMode === 'box' && editable} disabled={!editable} onClick={() => setSelectionMode('box')}><SelectionIcon mode="box" /></button>
    </div></div></div><div className="keyboard-space"><Keyboard colors={colors} effectId={preset?.type === 'builtin' ? preset.id : null} selectedCodes={selectedCodes} onSelect={setSelectedCodes} editable={editable} mode={selectionMode} /></div></section>
      <aside className="color-panel">{preset?.type === 'builtin' ? <>
        <div className="color-heading"><div><span className="controller-effect-tag">CONTROLLER EFFECT</span><h2>{PRESET_NAMES[preset.id] || preset.name}</h2></div><div className="controller-led" /></div>
        <div className="controller-content"><div className="effect-strip">{[2, 20, 38, 56, 74, 92].map(index => <i key={index} style={{ background: Object.values(colors)[index] }} />)}</div><p className="controller-description">Stored in the {controllerName} controller. This preset cannot be edited.</p></div>
        <div className="editor-bottom"><button className="primary-button full" onClick={() => createPreset(nextPresetName, true)}>Edit as {nextPresetName}</button></div>
      </> : <>
        <div className="color-heading"><div><span>EDIT COLOR</span><h2>{selectedCodes.length > 1 ? `${selectedCodes.length} keys` : selected ? keyName(selected) : 'No key selected'}</h2><small>{selectedCodes.length > 1 ? 'Shared color' : selected ? `Key ${selected}` : 'Select a key'}</small></div><div className="color-square" style={{ background: color }} /></div>
        <div className="editor-fields"><div className="hex-row"><label htmlFor="hex-color">HEX</label><div><span>#</span><input id="hex-color" value={hexText.replace(/^#/, '')} maxLength={6} disabled={!editable || !selectedCodes.length} spellCheck={false} onChange={event => { setHexText(event.target.value); const valid = normalizeHex(event.target.value); if (valid) changeColor(valid) }} onBlur={() => setHexText(color)} /><input type="color" aria-label="Choose color" value={color} disabled={!editable || !selectedCodes.length} onChange={event => changeColor(event.target.value.toUpperCase())} /></div></div>
          {['Red', 'Green', 'Blue'].map((label, index) => <label className={`channel channel-${index}`} key={label}><span>{label}<b>{rgb[index]}</b></span><input type="range" min="0" max="255" value={rgb[index]} disabled={!editable || !selectedCodes.length} onChange={event => setChannel(index, event.target.value)} style={{ '--value': `${rgb[index] / 255 * 100}%` }} /></label>)}
        </div><div className="editor-bottom"><button className="outline-button full" disabled={!editable || busy} onClick={savePreset}>{preset?.type === 'draft' ? 'Save preset' : 'Save changes'}</button></div>
      </>}</aside></div>

    <footer className="app-footer"><span className={`footer-message ${!data.controllerPresent ? 'disconnected' : ''}`} role="status">{!data.controllerPresent && <i className="footer-status-dot" />}{!data.controllerPresent ? `No compatible controller detected.${notice ? ` ${notice}` : ''}` : notice || (preset?.type === 'builtin' ? 'Controller effect ready. Wait 20 seconds between applications.' : 'Changes are sent only when you press Apply.')}</span><button className="primary-button apply-button" disabled={!data.controllerPresent || !preset || dirty || busy || preset.type === 'draft' || (preset.type === 'custom' && !Object.keys(colors).length)} onClick={applyPreset}>{busy ? 'Please wait …' : 'Apply to keyboard'}</button></footer>

    {newOpen && <NewPreset baseName={preset?.name} defaultName={nextPresetName} onClose={() => setNewOpen(false)} onCreate={createPreset} />}
    {settingsOpen && <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
      <div className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <h2 id="settings-title">Settings</h2>
        <label htmlFor="language">Language</label><select id="language" defaultValue="en"><option value="en">English</option></select>
        <p>More languages will be added later.</p>
        <label htmlFor="keyboard-layout">Keyboard layout</label><select id="keyboard-layout" defaultValue="de"><option value="de">German (QWERTZ)</option></select>
        <label className="startup-setting"><input type="checkbox" checked={Boolean(data.startupEnabled)} disabled={startupBusy || !preset || dirty || preset.type === 'draft' || (preset.type === 'custom' && !Object.keys(colors).length)} onChange={toggleStartup} /><span><strong>Apply on startup</strong><small>Apply the selected preset when your system starts. Enabling this requires administrator permission.</small></span></label>
        {startupError && <p className="startup-error" role="alert">{startupError}</p>}
        <div className="settings-device">MSI GP76 Leopard<br /><small>{data.controllerPresent ? `${controllerName} · USB ${data.controllerUsbId}` : 'No compatible controller detected'}<br />GE75 protocol</small></div>
        <section className="settings-about" aria-labelledby="about-title">
          <h3 id="about-title">About MSI-GP76-KEYLIGHT</h3>
          <p className="about-license">This app is licensed under the GNU GPL v3. Distributed modified versions must make their corresponding source code available.</p>
          <p className="about-copyright">Copyright © 2026 <ExternalLink id="github" url="https://github.com/DRAGON-EX">DRAGON-EX</ExternalLink>.</p>
          <p className="no-warranty"><strong>THIS SOFTWARE COMES WITH NO WARRANTY.</strong></p>
          <p className="about-upstream">Controller code: <ExternalLink id="upstream" url="https://github.com/Askannz/msi-perkeyrgb">msi-perkeyrgb</ExternalLink> © 2018 Askannz, MIT License.</p>
          <div className="profile-links">{PROFILE_LINKS.map(link => <ExternalLink key={link.id} id={link.id} url={link.url} className="profile-link"><ProfileIcon id={link.id} /><span>{link.label}</span></ExternalLink>)}</div>
        </section>
        <div className="dialog-actions"><button className="primary-button" onClick={() => setSettingsOpen(false)}>Done</button></div>
      </div>
    </div>}
    {integrationOpen && <div className="overlay"><div className="dialog warning-dialog integration-dialog" role="dialog" aria-modal="true" aria-labelledby="integration-title" aria-describedby="integration-description"><img src={appIcon} alt="" /><span className="warning-eyebrow">FIRST LAUNCH</span><h2 id="integration-title">Add MSI-GP76-KEYLIGHT to your applications menu?</h2><div id="integration-description"><p>This adds a launcher with the dragon icon for your user account. You can still run the AppImage directly.</p></div>{integrationError && <p className="integration-error" role="alert">{integrationError}</p>}<div className="dialog-actions"><button className="subtle-button" disabled={integrationBusy} onClick={() => chooseIntegration('skipped')}>Not now</button><button className="primary-button" autoFocus disabled={integrationBusy} onClick={() => chooseIntegration('installed')}>{integrationBusy ? 'Please wait …' : 'Add to menu'}</button></div></div></div>}
    {startupWarningOpen && controllerChecked && integrationChecked && !integrationOpen && <div className="overlay"><div className="dialog warning-dialog" role="alertdialog" aria-modal="true" aria-labelledby="warning-title" aria-describedby="warning-description">{data.controllerPresent ? <><span className="warning-eyebrow">HARDWARE NOTICE</span><h2 id="warning-title">Use the controller carefully</h2><p className="warning-device">{controllerName} · USB {data.controllerUsbId}</p><div id="warning-description"><p>This lighting controller is sensitive. Incorrect or rapidly repeated commands may leave it unresponsive. Apply one preset at a time and wait at least 20 seconds before applying another.</p><p>If the keyboard stops responding or its lights go out, a reboot may help; sometimes an EC reset is needed. Use at your own risk. We cannot accept liability for damage.</p></div><div className="dialog-actions"><button className="primary-button" autoFocus onClick={() => setStartupWarningOpen(false)}>I understand</button></div></> : <><span className="warning-eyebrow">CONTROLLER NOT FOUND</span><h2 id="warning-title">No SteelSeries controller found</h2><div id="warning-description"><p>Are you sure you’re on the right notebook, mate? :D</p><p>You can still explore presets, but the keyboard cannot be controlled until a compatible controller is connected.</p></div><div className="dialog-actions"><button className="subtle-button" onClick={() => { if (window.gp76App?.close) window.gp76App.close(); else window.close() }}>Close app</button><button className="primary-button" autoFocus onClick={() => setStartupWarningOpen(false)}>Continue</button></div></>}</div></div>}
  </div>
}
