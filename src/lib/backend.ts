import type { PaymentTerms, Settings, TableMap, TableName } from './types'

export interface Session {
  userId: string
  email: string
  organizationId: string | null
}

export type Row<T extends TableName> = TableMap[T]
export type NewRow<T extends TableName> = Omit<Row<T>, 'id' | 'organization_id' | 'created_at' | 'updated_at'> & { id?: string }
export type Filter = Record<string, string | number | boolean | null>

/**
 * Dados brutos (apenas campos permitidos) que a página pública recebe.
 * No Supabase vêm da função `public_document(token)`; no modo local são montados do IndexedDB.
 */
export interface PublicRaw {
  kind: 'quote' | 'work_order'
  doc: {
    number: string
    status?: string
    stage?: string
    simple: boolean
    simple_description?: string
    items: { description: string; region?: string; qty: number; unit: string; unit_price: number; kind: string }[]
    subtotal: number
    discount: number
    surcharge: number
    total: number
    payment_terms: PaymentTerms
    insurance?: { insurer: string; claim_number?: string; deductible: number; customer_pays: number } | null
    customer_notes?: string
    valid_until?: string
    estimated_days?: number | null
    decision_by?: string | null
    decision_at?: string | null
    entry_date?: string
    due_date?: string | null
    delivered_at?: string | null
    public_note?: string
    created_at: string
  }
  customer_name: string
  vehicle: { brand?: string; model?: string; year?: string; color?: string; plate: string }
  company: Partial<Settings>
  events: { stage: string; note?: string; created_at: string }[]
  photos: { path: string; caption?: string; stage?: string }[]
  paid: number
}

export interface Backend {
  mode: 'local' | 'cloud'
  getSession(): Promise<Session | null>
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  createOrganization(name: string): Promise<void>

  list<T extends TableName>(table: T, filter?: Filter): Promise<Row<T>[]>
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>>
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>
  /** Só para registros não financeiros (ex.: fotos). Os demais são arquivados. */
  remove(table: 'photos' | 'catalog_items' | 'costs', id: string): Promise<void>

  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<void>

  uploadFile(path: string, blob: Blob): Promise<void>
  fileUrl(path: string): Promise<string>
  deleteFile(path: string): Promise<void>
  copyFile(from: string, to: string): Promise<void>

  publicDocument(token: string): Promise<PublicRaw | null>
  publicDecision(token: string, approve: boolean, name: string, note: string): Promise<void>
  publicFileUrl(token: string, path: string): Promise<string>
}

/** Campos da empresa que podem aparecer na página pública (mesma lista da função SQL). */
export const PUBLIC_COMPANY_FIELDS = [
  'logo_url', 'trade_name', 'legal_name', 'document', 'tagline', 'brand_color', 'street', 'number', 'district', 'city', 'state', 'zip',
  'phone', 'whatsapp', 'email', 'website', 'instagram', 'opening_hours', 'pix_key', 'pix_name', 'max_installments',
  'installment_fee_percent', 'cash_discount_percent', 'general_terms', 'warranty_terms', 'stages', 'show_values_on_portal',
] as const

export function publicCompany(s: Partial<Settings>): Partial<Settings> {
  const out: Record<string, unknown> = {}
  for (const k of PUBLIC_COMPANY_FIELDS) if (s[k] !== undefined) out[k] = s[k]
  return out as Partial<Settings>
}
