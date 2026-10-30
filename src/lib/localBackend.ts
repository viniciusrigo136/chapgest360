import { openDB, type IDBPDatabase } from 'idb'
import { publicCompany, type Backend, type Filter, type NewRow, type PublicRaw, type Row } from './backend'
import { computeTotals } from './calc'
import { DEFAULT_SETTINGS } from './defaults'
import { uid } from './format'
import type { DocCommon, Quote, Settings, TableName, WorkOrder } from './types'

/**
 * Modo local: dados ficam só neste navegador (IndexedDB). Serve para testar o sistema
 * sem configurar a nuvem. Para uso real, configure o Supabase (ver README).
 */
const TABLES: TableName[] = ['customers', 'vehicles', 'quotes', 'work_orders', 'stage_events', 'payments', 'photos', 'catalog_items', 'costs']
const ORG = 'local'

let dbp: Promise<IDBPDatabase> | null = null
const db = () =>
  (dbp ??= openDB('lataria', 1, {
    upgrade(d) {
      for (const t of TABLES) d.createObjectStore(t, { keyPath: 'id' })
      d.createObjectStore('meta')
      d.createObjectStore('files')
    },
  }))

const now = () => new Date().toISOString()

function matches(row: Record<string, unknown>, filter?: Filter) {
  if (!filter) return true
  return Object.entries(filter).every(([k, v]) => (v === null ? row[k] == null : row[k] === v))
}

function withTotals<T>(table: TableName, row: T): T {
  if (table !== 'quotes' && table !== 'work_orders') return row
  const d = row as unknown as DocCommon
  return { ...row, ...computeTotals(d) }
}

async function nextNumber(kind: 'quote' | 'work_order') {
  const d = await db()
  const s = await local.getSettings()
  const year = new Date().getFullYear()
  const key = `counter_${kind}_${year}`
  const n = ((await d.get('meta', key)) ?? 0) + 1
  await d.put('meta', n, key)
  const prefix = kind === 'quote' ? s.quote_prefix : s.work_order_prefix
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`
}

const fileUrls = new Map<string, string>()

export const local: Backend = {
  mode: 'local',
  async getSession() {
    return { userId: 'local', email: 'modo local', organizationId: ORG }
  },
  async signIn() {},
  async signUp() {},
  async signOut() {},
  async createOrganization() {},

  async list(table, filter) {
    const all = (await (await db()).getAll(table)) as Row<typeof table>[]
    return all.filter((r) => matches(r as unknown as Record<string, unknown>, filter)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  },
  async get(table, id) {
    return ((await (await db()).get(table, id)) ?? null) as Row<typeof table> | null
  },
  async insert<T extends TableName>(table: T, row: NewRow<T>) {
    const t = now()
    let full = { ...row, id: row.id ?? uid(), organization_id: ORG, created_at: t, updated_at: t } as unknown as Row<T>
    if (table === 'quotes' || table === 'work_orders') {
      const doc = full as unknown as DocCommon
      if (!doc.number) doc.number = await nextNumber(table === 'quotes' ? 'quote' : 'work_order')
      full = withTotals(table, full)
    }
    await (await db()).put(table, full)
    return full
  },
  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
    const d = await db()
    const cur = await d.get(table, id)
    if (!cur) throw new Error('Registro não encontrado')
    const next = withTotals(table, { ...cur, ...patch, id, organization_id: ORG, updated_at: now() }) as Row<T>
    await d.put(table, next)
    return next
  },
  async remove(table, id) {
    await (await db()).delete(table, id)
  },

  async getSettings() {
    const s = (await (await db()).get('meta', 'settings')) as Settings | undefined
    return { ...DEFAULT_SETTINGS, ...s, templates: { ...DEFAULT_SETTINGS.templates, ...s?.templates } }
  },
  async saveSettings(s) {
    await (await db()).put('meta', s, 'settings')
  },

  async uploadFile(path, blob) {
    await (await db()).put('files', blob, path)
  },
  async fileUrl(path) {
    const cached = fileUrls.get(path)
    if (cached) return cached
    const blob = (await (await db()).get('files', path)) as Blob | undefined
    if (!blob) return ''
    const url = URL.createObjectURL(blob)
    fileUrls.set(path, url)
    return url
  },
  async deleteFile(path) {
    await (await db()).delete('files', path)
  },
  async copyFile(from, to) {
    const d = await db()
    await d.put('files', await d.get('files', from), to)
  },

  async publicDocument(token) {
    const quotes = await local.list('quotes', { public_token: token })
    const orders = await local.list('work_orders', { public_token: token })
    const quote = quotes[0] as Quote | undefined
    const wo = orders[0] as WorkOrder | undefined
    const doc = quote ?? wo
    if (!doc || !doc.public_enabled || doc.archived_at) return null
    await local.update(quote ? 'quotes' : 'work_orders', doc.id, { last_viewed_at: now() })
    const [customer, vehicle, settings] = await Promise.all([local.get('customers', doc.customer_id), local.get('vehicles', doc.vehicle_id), local.getSettings()])
    const photos = (await local.list('photos', { parent_id: doc.id, is_public: true })).sort((a, b) => a.position - b.position)
    const events = wo ? (await local.list('stage_events', { work_order_id: wo.id })).reverse() : []
    const payments = wo ? await local.list('payments', { work_order_id: wo.id }) : []
    const company = doc.company_snapshot ?? settings
    const raw: PublicRaw = {
      kind: quote ? 'quote' : 'work_order',
      doc: {
        number: doc.number,
        status: quote?.status,
        stage: wo?.stage,
        simple: doc.simple,
        simple_description: doc.simple_description,
        items: doc.items.map(({ description, region, qty, unit, unit_price, kind }) => ({ description, region, qty, unit, unit_price, kind })),
        subtotal: doc.subtotal,
        discount: doc.discount,
        surcharge: doc.surcharge,
        total: doc.total,
        payment_terms: doc.payment_terms,
        insurance: doc.insurance,
        customer_notes: doc.customer_notes,
        valid_until: quote?.valid_until,
        estimated_days: quote?.estimated_days,
        decision_by: quote?.decision_by,
        decision_at: quote?.decision_at,
        entry_date: wo?.entry_date,
        due_date: wo?.due_date,
        delivered_at: wo?.delivered_at,
        public_note: wo?.public_note,
        created_at: doc.created_at,
      },
      customer_name: (customer?.name ?? '').split(' ')[0],
      vehicle: { brand: vehicle?.brand, model: vehicle?.model, year: vehicle?.year, color: vehicle?.color, plate: vehicle?.plate ?? '' },
      company: publicCompany({ ...company, stages: settings.stages, show_values_on_portal: settings.show_values_on_portal }),
      events: events.map(({ stage, note, created_at }) => ({ stage, note, created_at })),
      photos: photos.map(({ path, caption, stage }) => ({ path, caption, stage })),
      paid: payments.filter((p) => !p.reversed_at).reduce((s, p) => s + p.amount, 0),
    }
    return raw
  },
  async publicDecision(token, approve, name, note) {
    const [q] = await local.list('quotes', { public_token: token })
    if (!q || !q.public_enabled || !['enviado', 'rascunho'].includes(q.status)) throw new Error('Este orçamento não pode mais ser respondido.')
    await local.update('quotes', q.id, { status: approve ? 'aprovado' : 'recusado', decision_by: name, decision_at: now(), decision_note: note })
  },
  async publicFileUrl(_token, path) {
    return local.fileUrl(path)
  },
}
