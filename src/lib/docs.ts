import { publicCompany, type NewRow } from './backend'
import { db, filePath } from './db'
import { addDays, randomToken, today } from './format'
import type { DocCommon, PaymentTerms, Quote, Settings, WorkOrder } from './types'

export const emptyTerms = (): PaymentTerms => ({ methods: ['pix', 'dinheiro', 'credito'], installments: 1, down_payment: 0, show_pix_qr: true })

type DocBase = Omit<DocCommon, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'number' | 'subtotal' | 'total'>

function base(): DocBase {
  return {
    customer_id: '',
    vehicle_id: '',
    simple: false,
    items: [],
    discount: 0,
    surcharge: 0,
    simple_total: 0,
    payment_terms: emptyTerms(),
    insurance: null,
    public_token: randomToken(),
    public_enabled: true,
  }
}

export function newQuote(s: Settings): Partial<Quote> {
  return { ...base(), status: 'rascunho', valid_until: addDays(today(), s.quote_validity_days) }
}

export function newWorkOrder(): Partial<WorkOrder> {
  return { ...base(), stage: 'recebido', entry_date: today(), due_date: null, checklist: null }
}

/** Dados da empresa congelados no documento (usado ao enviar/entregar). */
export const snapshot = (s: Settings) => publicCompany(s)
export const companyFor = (doc: Pick<DocCommon, 'company_snapshot'>, s: Settings): Partial<Settings> => ({ ...s, ...(doc.company_snapshot ?? {}) })

async function copyPhotos(fromParent: string, toParent: string, parentType: 'quote' | 'work_order', orgId: string, stage?: string) {
  const photos = await db.list('photos', { parent_id: fromParent })
  for (const p of photos) {
    const path = filePath(orgId)
    await db.copyFile(p.path, path)
    await db.insert('photos', { parent_type: parentType, parent_id: toParent, vehicle_id: p.vehicle_id, path, caption: p.caption, is_public: p.is_public, position: p.position, stage: p.stage ?? stage })
  }
}

export async function convertToWorkOrder(q: Quote, orgId: string, s: Settings) {
  if (q.work_order_id) throw new Error('Este orçamento já virou uma OS')
  const row: NewRow<'work_orders'> = {
    ...(newWorkOrder() as NewRow<'work_orders'>),
    customer_id: q.customer_id,
    vehicle_id: q.vehicle_id,
    quote_id: q.id,
    simple: q.simple,
    simple_description: q.simple_description,
    simple_total: q.simple_total,
    items: q.items,
    discount: q.discount,
    surcharge: q.surcharge,
    payment_terms: q.payment_terms,
    insurance: q.insurance,
    customer_notes: q.customer_notes,
    internal_notes: q.internal_notes,
    due_date: q.estimated_days ? addDays(today(), q.estimated_days) : null,
    number: '',
  }
  const wo = await db.insert('work_orders', row)
  await db.insert('stage_events', { work_order_id: wo.id, stage: wo.stage, note: `Aberta a partir do orçamento ${q.number}` })
  await db.update('quotes', q.id, { work_order_id: wo.id, status: 'aprovado', company_snapshot: q.company_snapshot ?? snapshot(s) })
  await copyPhotos(q.id, wo.id, 'work_order', orgId, 'avaliacao')
  return wo
}

export async function duplicateQuote(q: Quote, orgId: string, s: Settings) {
  const { id: _id, organization_id: _o, created_at: _c, updated_at: _u, number: _n, subtotal: _s, total: _t, ...rest } = q
  const copy = await db.insert('quotes', {
    ...rest,
    number: '',
    status: 'rascunho',
    valid_until: addDays(today(), s.quote_validity_days),
    public_token: randomToken(),
    public_enabled: true,
    work_order_id: null,
    decision_by: null,
    decision_at: null,
    decision_note: null,
    last_viewed_at: null,
    company_snapshot: null,
    archived_at: null,
  } as NewRow<'quotes'>)
  await copyPhotos(q.id, copy.id, 'quote', orgId)
  return copy
}

export async function setStage(wo: WorkOrder, stage: string, note: string, s: Settings) {
  const patch: Partial<WorkOrder> = { stage }
  if (note) patch.public_note = note
  if (stage === 'entregue') {
    patch.delivered_at = new Date().toISOString()
    patch.company_snapshot = wo.company_snapshot ?? snapshot(s)
  }
  const next = await db.update('work_orders', wo.id, patch)
  await db.insert('stage_events', { work_order_id: wo.id, stage, note: note || undefined })
  return next
}

export const isQuoteExpired = (q: Quote) => ['rascunho', 'enviado'].includes(q.status) && q.valid_until < today()
