import type { Cents } from './types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const money = (c: Cents | null | undefined) => brl.format((c ?? 0) / 100)

/** "1.234,56" | "1234.5" | "R$ 10" → centavos */
export function parseMoney(input: string): Cents {
  const s = input.replace(/[^\d,.-]/g, '')
  if (!s) return 0
  let normalized = s
  if (s.includes(',')) normalized = s.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** centavos → "1234,56" para edição */
export const moneyInput = (c: Cents) => (c / 100).toFixed(2).replace('.', ',')

export const today = () => toISODate(new Date())

export function toISODate(d: Date) {
  const tz = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const m = String(tz.getMonth() + 1).padStart(2, '0')
  const day = String(tz.getDate()).padStart(2, '0')
  return `${tz.getFullYear()}-${m}-${day}`
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Data AAAA-MM-DD ou ISO completo → DD/MM/AAAA */
export function date(iso?: string | null) {
  if (!iso) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function dateTime(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function daysBetween(fromIso: string, toIso: string = today()) {
  const a = new Date(fromIso.slice(0, 10) + 'T12:00:00').getTime()
  const b = new Date(toIso.slice(0, 10) + 'T12:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export const digits = (s?: string) => (s ?? '').replace(/\D/g, '')

export function phone(s?: string) {
  const d = digits(s)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return s ?? ''
}

/** Placa antiga (ABC1234) ou Mercosul (ABC1D23) */
export function normalizePlate(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}
export const isValidPlate = (s: string) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(normalizePlate(s))
export function plate(s?: string) {
  const p = normalizePlate(s ?? '')
  return /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p
}
/** ABC1D23 → ABC-1**3 (portal público) */
export function maskedPlate(s?: string) {
  const p = normalizePlate(s ?? '')
  if (p.length < 7) return p
  return `${p.slice(0, 3)}-${p[3]}**${p[6]}`
}

export function isValidCPF(v: string) {
  const c = digits(v)
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false
  for (const len of [9, 10]) {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(c[i]) * (len + 1 - i)
    const dv = ((sum * 10) % 11) % 10
    if (dv !== Number(c[len])) return false
  }
  return true
}

export function isValidCNPJ(v: string) {
  const c = digits(v)
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = w.reduce((acc, wi, i) => acc + Number(c[i]) * wi, 0)
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13])
}

export const isValidDocument = (v: string) => {
  const d = digits(v)
  return d.length === 11 ? isValidCPF(d) : d.length === 14 ? isValidCNPJ(d) : false
}

export function documentFmt(v?: string) {
  const d = digits(v)
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v ?? ''
}

export const uid = () => crypto.randomUUID()

/** Token público com 128 bits aleatórios, em base64url */
export function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
