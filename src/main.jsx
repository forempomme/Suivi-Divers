import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Preferences } from '@capacitor/preferences'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Keyboard } from '@capacitor/keyboard'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { LocalNotifications } from '@capacitor/local-notifications'

// ── 1. Storage adapter ────────────────────────────────────────
window.storage = {
  async get(key) {
    const { value } = await Preferences.get({ key })
    if (value === null) throw new Error('Key not found: ' + key)
    return { key, value }
  },
  async set(key, value) {
    await Preferences.set({ key, value: String(value) })
    return { key, value }
  },
  async delete(key) {
    await Preferences.remove({ key })
    return { key, deleted: true }
  },
  async list(prefix = '') {
    const { keys } = await Preferences.keys()
    return { keys: prefix ? keys.filter(k => k.startsWith(prefix)) : keys }
  }
}

// ── 2. Status bar ─────────────────────────────────────────────
window.__applyStatusBar = async (isDark) => {
  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({ color: isDark ? '#111113' : '#F0F0EA' })
  } catch (_) {}
}
Preferences.get({ key: 'tr-dark' })
  .then(({ value }) => window.__applyStatusBar(value === 'true' || value === '1'))
  .catch(() => window.__applyStatusBar(false))

// ── 3. Export via partage Android natif ──────────────────────
// App.jsx appelle window.__exportData(jsonStr, fileName)
window.__exportData = async (jsonStr, fileName) => {
  try {
    await Filesystem.writeFile({
      path: fileName,
      data: jsonStr,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    const { uri } = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    })
    await Share.share({
      url: uri,
      title: 'Suivi Divers — Sauvegarde',
      dialogTitle: 'Enregistrer ou envoyer la sauvegarde',
    })
    return { ok: true }
  } catch (e) {
    if (e?.message?.includes('cancel') || e?.message?.includes('dismiss')) {
      return { ok: false, canceled: true }
    }
    console.warn('Export error:', e)
    return { ok: false, error: e?.message }
  }
}

// ── 4. Notifications locales ──────────────────────────────────
// App.jsx appelle window.__requestNotifPermission()
window.__getNotifPermission = async () => {
  try {
    const { display } = await LocalNotifications.checkPermissions()
    return display
  } catch (_) { return 'denied' }
}

window.__requestNotifPermission = async () => {
  try {
    const { display } = await LocalNotifications.requestPermissions()
    return display
  } catch (_) { return 'denied' }
}

window.__scheduleNotifications = async (entries) => {
  try {
    const { notifications: pending } = await LocalNotifications.getPending()
    if (pending.length > 0) await LocalNotifications.cancel({ notifications: pending })
    const toSchedule = []
    let id = 3000
    for (const entry of entries) {
      if (!entry.next) continue
      const rdv = new Date(entry.next)
      rdv.setHours(9, 0, 0, 0)
      const daysLeft = Math.round((rdv - new Date()) / 86400000)
      if (daysLeft < 0 || daysLeft > 3) continue
      const body = daysLeft === 0 ? "Aujourd'hui : " + entry.title
        : daysLeft === 1 ? 'Demain : ' + entry.title
        : 'Dans ' + daysLeft + ' jours : ' + entry.title
      toSchedule.push({ id: id++, title: 'Suivi Divers', body, schedule: { at: rdv } })
    }
    if (toSchedule.length > 0) await LocalNotifications.schedule({ notifications: toSchedule })
    return toSchedule.length
  } catch (e) { console.warn('Notif error:', e); return 0 }
}

window.__cancelAllNotifications = async () => {
  try {
    const { notifications: pending } = await LocalNotifications.getPending()
    if (pending.length > 0) await LocalNotifications.cancel({ notifications: pending })
  } catch (e) { console.warn('Cancel notif error:', e) }
}

window.__getNotifPermission().then(p => { window.__notifPermission = p })

// ── 5. Bouton retour Android ──────────────────────────────────
CapApp.addListener('backButton', () => {
  if (window.__goBack && window.__goBack()) return
  CapApp.exitApp()
})

// ── 6. Clavier virtuel ───────────────────────────────────────
Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {})
Keyboard.addListener('keyboardWillShow', (info) => {
  document.getElementById('root').style.height = 'calc(100vh - ' + info.keyboardHeight + 'px)'
})
Keyboard.addListener('keyboardWillHide', () => {
  document.getElementById('root').style.height = ''
})

// ── 7. Rendu ─────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null, React.createElement(App))
)
