import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Keyboard } from '@capacitor/keyboard'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { LocalNotifications } from '@capacitor/local-notifications'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'

// ── 1. Storage adapter (petites données : entrées, réglages) ──
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

// ── 1b. Stockage fichiers (photos / PDF) ──────────────────────
// v1.4.0 : les pièces jointes sont des fichiers dans le dossier privé de l'app,
// et non plus dans Preferences (prévu pour de petits réglages, lent avec des photos).
const DOCS_DIR = 'docs'
window.fileStore = {
  async write(name, data) {
    await Filesystem.writeFile({ path: `${DOCS_DIR}/${name}`, data, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true })
  },
  async read(name) {
    const r = await Filesystem.readFile({ path: `${DOCS_DIR}/${name}`, directory: Directory.Data, encoding: Encoding.UTF8 })
    return typeof r.data === 'string' ? r.data : await r.data.text()
  },
  async remove(name) {
    try { await Filesystem.deleteFile({ path: `${DOCS_DIR}/${name}`, directory: Directory.Data }) } catch (_) {}
  },
  async list() {
    try {
      const r = await Filesystem.readdir({ path: DOCS_DIR, directory: Directory.Data })
      return r.files.map(f => (typeof f === 'string' ? f : f.name))
    } catch (_) { return [] }
  }
}

// ── 2. Status bar (couleurs du thème Material You) ───────────
window.__applyStatusBar = async (isDark) => {
  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({ color: isDark ? '#111418' : '#F9F9FF' })
  } catch (_) {}
}
// Avant : premier lancement = barre claire alors que l'app démarre en sombre
Preferences.get({ key: 'tr-dark' })
  .then(({ value }) => window.__applyStatusBar(value === null ? true : (value === 'true' || value === '1')))
  .catch(() => window.__applyStatusBar(true))

// ── 3. Export via partage Android natif ──────────────────────
window.__exportData = async (text, fileName) => {
  try {
    await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
    await Share.share({ url: uri, title: 'Suivi Divers — ' + fileName, dialogTitle: 'Enregistrer ou envoyer le fichier' })
    return { ok: true }
  } catch (e) {
    if (e?.message?.includes('cancel') || e?.message?.includes('dismiss')) return { ok: false, canceled: true }
    console.warn('Export error:', e)
    return { ok: false, error: e?.message }
  }
}

// ── 3b. Ouvrir un lien externe (Google Agenda) ───────────────
// Capacitor ouvre automatiquement les URL externes dans l'app/navigateur du système
window.__openUrl = (url) => { window.location.href = url }

// ── 4. Notifications locales ──────────────────────────────────
window.__getNotifPermission = async () => {
  try { const { display } = await LocalNotifications.checkPermissions(); return display } catch (_) { return 'denied' }
}
window.__requestNotifPermission = async () => {
  try { const { display } = await LocalNotifications.requestPermissions(); return display } catch (_) { return 'denied' }
}

const parseLocal = (s) => { const [y, m, d] = (s || '').split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }

// Avant : un seul rappel le jour J, et seulement pour les RDV à moins de 3 jours
// au moment de la programmation → un RDV dans 10 jours n'avait aucun rappel.
// Maintenant : rappel J-3 à 9h + rappel le jour J à 8h, pour TOUS les RDV futurs.
window.__scheduleNotifications = async (entries) => {
  try {
    await window.__cancelAllNotifications()
    const now = Date.now()
    const list = []
    for (const entry of entries) {
      if (!entry.next) continue
      const day = parseLocal(entry.next)
      const j3 = new Date(day); j3.setDate(j3.getDate() - 3); j3.setHours(9, 0, 0, 0)
      const j0 = new Date(day); j0.setHours(8, 0, 0, 0)
      if (j3.getTime() > now) list.push({ at: j3, body: 'Dans 3 jours : ' + entry.title, entryId: entry.id })
      if (j0.getTime() > now) list.push({ at: j0, body: "Aujourd'hui : " + entry.title, entryId: entry.id })
    }
    // Android limite le nombre d'alarmes : on garde les 60 plus proches
    list.sort((a, b) => a.at - b.at)
    const toSchedule = list.slice(0, 60).map((n, i) => ({
      id: 3000 + i, title: 'Suivi Divers', body: n.body, schedule: { at: n.at, allowWhileIdle: true }, extra: { entryId: n.entryId }
    }))
    if (toSchedule.length) await LocalNotifications.schedule({ notifications: toSchedule })
    return toSchedule.length
  } catch (e) { console.warn('Notif error:', e); return 0 }
}

window.__cancelAllNotifications = async () => {
  try {
    const { notifications: pending } = await LocalNotifications.getPending()
    if (pending.length > 0) await LocalNotifications.cancel({ notifications: pending })
  } catch (e) { console.warn('Cancel notif error:', e) }
}

// Toucher une notification ouvre directement l'entrée concernée
LocalNotifications.addListener('localNotificationActionPerformed', (ev) => {
  const id = ev?.notification?.extra?.entryId
  if (id == null) return
  const tryOpen = (n = 0) => {
    if (window.__openEntry) window.__openEntry(id)
    else if (n < 20) setTimeout(() => tryOpen(n + 1), 250)
  }
  tryOpen()
}).catch?.(() => {})

window.__getNotifPermission().then(p => { window.__notifPermission = p })

// ── 4b. Verrouillage par empreinte / code du téléphone ───────
window.__biometric = Capacitor.isNativePlatform() ? {
  async available() {
    try {
      const r = await BiometricAuth.checkBiometry()
      return !!(r.isAvailable || r.deviceIsSecure)
    } catch (_) { return false }
  },
  async authenticate() {
    try {
      await BiometricAuth.authenticate({
        reason: 'Déverrouiller Suivi Divers',
        cancelTitle: 'Annuler',
        allowDeviceCredential: true, // code PIN / schéma en secours
        androidTitle: 'Suivi Divers',
        androidSubtitle: 'Déverrouille avec ton empreinte',
      })
      return true
    } catch (_) { return false }
  }
} : null

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
