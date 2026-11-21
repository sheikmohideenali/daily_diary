const KEY = 'thakos-data-v1'
const PIN_KEY = 'thakos-pin-hash-v1'
const DEVICE_KEY = 'thakos-device-id'

const defaultData = {
  settings: { companyName: 'THAKOS INDUSTRIES', currency: 'INR', startingBalance: 0, pinConfigured: false },
  diaries: [],
  transactions: []
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...defaultData, ...JSON.parse(raw) } : structuredClone(defaultData)
  } catch {
    return structuredClone(defaultData)
  }
}
export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('thakos-data-changed'))
}
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id) }
  return id
}
export async function hashPin(pin) {
  const bytes = new TextEncoder().encode(pin + '::thakos-local-pin-v1')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('')
}
export async function setPin(pin) {
  localStorage.setItem(PIN_KEY, await hashPin(pin))
}
export async function verifyPin(pin) {
  const saved = localStorage.getItem(PIN_KEY)
  return !!saved && saved === await hashPin(pin)
}
export function hasPin() { return !!localStorage.getItem(PIN_KEY) }
export function exportBackup(data) {
  const blob = new Blob([JSON.stringify({ app: 'THAKOS', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `thakos-backup-${new Date().toISOString().slice(0,10)}.json`; a.click()
  URL.revokeObjectURL(url)
}
export async function importBackup(file) {
  const parsed = JSON.parse(await file.text())
  if (parsed?.app !== 'THAKOS' || !parsed?.data?.diaries || !parsed?.data?.transactions) throw new Error('This is not a valid THAKOS backup.')
  saveData(parsed.data)
  return parsed.data
}