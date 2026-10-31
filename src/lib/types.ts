// Valores monetários sempre em centavos (inteiros).
export type Cents = number

export interface Base {
  id: string
  organization_id: string
  created_at: string
  updated_at: string
  archived_at?: string | null
}

export interface Stage {
  key: string
  name: string
  color: string
  public: boolean
}

export interface MessageTemplates {
  quote: string
  work_order: string
  stage: string
  ready: string
}

export interface Settings {
  logo_url?: string
  trade_name: string
  legal_name?: string
  document?: string // CNPJ ou CPF
  state_registration?: string
  tagline?: string
  brand_color: string
  zip?: string
  street?: string
  number?: string
  district?: string
  city?: string
  state?: string
  phone?: string
  whatsapp?: string
  email?: string
  website?: string
  instagram?: string
  opening_hours?: string
  pix_key?: string
  pix_name?: string
  max_installments: number
  installment_fee_percent: number
  cash_discount_percent: number
  hourly_rate: Cents
  quote_validity_days: number
  general_terms: string
  warranty_terms: string
  delivery_terms: string
  authorization_terms: string
  templates: MessageTemplates
  quote_prefix: string
  work_order_prefix: string
  stages: Stage[]
  show_values_on_portal: boolean
}

export interface Customer extends Base {
  name: string
  phone?: string
  whatsapp?: string
  email?: string
  document?: string
  zip?: string
  address?: string
  city?: string
  birth_date?: string | null
  source?: string
  notes?: string
}

export interface Vehicle extends Base {
  customer_id: string
  plate: string
  brand?: string
  model?: string
  year?: string
  color?: string
  paint_code?: string
  vin?: string
  km?: number | null
  fuel?: string
  renavam?: string
  notes?: string
}

export type ItemKind = 'service' | 'part' | 'material'

export interface DocItem {
  id: string
  kind: ItemKind
  description: string
  region?: string
  qty: number
  unit: string
  unit_price: Cents
}

export type PaymentMethod = 'pix' | 'dinheiro' | 'debito' | 'credito' | 'boleto' | 'transferencia' | 'seguradora'

export interface PaymentTerms {
  methods: PaymentMethod[]
  installments: number // 1 = à vista
  down_payment: Cents // entrada
  notes?: string
  show_pix_qr: boolean
}

export interface Insurance {
  insurer: string
  claim_number?: string
  deductible: Cents // franquia
  // quanto o cliente paga; o restante fica com a seguradora
  customer_pays: Cents
}

export type DamageType = 'amassado' | 'risco' | 'quebrado' | 'ferrugem' | 'pintura'

export interface Checklist {
  km?: number | null
  fuel: number // 0 a 4 (vazio, 1/4, 1/2, 3/4, cheio)
  damages: { region: string; type: DamageType; note?: string }[]
  items: string[] // estepe, macaco...
  belongings?: string
  notes?: string
  signature?: string // data URL PNG
  signed_by?: string
  signed_at?: string
}

export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado' | 'cancelado'

export interface DocCommon extends Base {
  number: string
  customer_id: string
  vehicle_id: string
  simple: boolean
  simple_description?: string
  simple_total?: Cents
  items: DocItem[]
  discount: Cents
  surcharge: Cents
  subtotal: Cents
  total: Cents
  payment_terms: PaymentTerms
  insurance?: Insurance | null
  customer_notes?: string
  internal_notes?: string
  public_token: string
  public_enabled: boolean
  last_viewed_at?: string | null
  company_snapshot?: Partial<Settings> | null
}

export interface Quote extends DocCommon {
  status: QuoteStatus
  valid_until: string // AAAA-MM-DD
  estimated_days?: number | null
  decision_by?: string | null
  decision_at?: string | null
  decision_note?: string | null
  work_order_id?: string | null
}

export interface WorkOrder extends DocCommon {
  quote_id?: string | null
  stage: string
  entry_date: string
  due_date?: string | null
  delivered_at?: string | null
  checklist?: Checklist | null
  public_note?: string
  delivery_signature?: string | null
}

export interface StageEvent extends Base {
  work_order_id: string
  stage: string
  note?: string
}

export interface Payment extends Base {
  work_order_id?: string | null
  quote_id?: string | null
  customer_id: string
  paid_at: string
  amount: Cents
  method: PaymentMethod
  payer: 'cliente' | 'seguradora'
  notes?: string
  reversed_at?: string | null
}

export type PhotoParent = 'quote' | 'work_order' | 'vehicle'

export interface Photo extends Base {
  parent_type: PhotoParent
  parent_id: string
  vehicle_id?: string | null
  path: string
  stage?: string
  caption?: string
  is_public: boolean
  position: number
}

export interface CatalogItem extends Base {
  kind: ItemKind
  description: string
  region?: string
  unit: string
  price: Cents
}

export interface Cost extends Base {
  work_order_id: string
  category: 'tinta' | 'material' | 'peca' | 'terceiro' | 'horas' | 'outro'
  description: string
  amount: Cents
  hours?: number | null
  spent_at: string
}

export interface TableMap {
  customers: Customer
  vehicles: Vehicle
  quotes: Quote
  work_orders: WorkOrder
  stage_events: StageEvent
  payments: Payment
  photos: Photo
  catalog_items: CatalogItem
  costs: Cost
}
export type TableName = keyof TableMap
