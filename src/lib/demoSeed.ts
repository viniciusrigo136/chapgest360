import { db, filePath } from './db'
import { DEFAULT_SETTINGS } from './defaults'
import { convertToWorkOrder, newQuote, setStage, snapshot } from './docs'
import { addDays, randomToken, today, uid } from './format'
import type { DocItem, PaymentMethod, Quote, Settings } from './types'

let running: Promise<void> | null = null

/** Dados de exemplo só para a versão de demonstração (VITE_DEMO). Roda uma vez. */
export const seedDemo = (orgId: string) => (running ??= seed(orgId))

async function seed(orgId: string) {
  if ((await db.list('customers')).length) return
  const s: Settings = {
    ...DEFAULT_SETTINGS,
    trade_name: 'Funilaria Exemplo',
    tagline: 'Funilaria • Pintura • Polimento',
    legal_name: 'Funilaria Exemplo Ltda (dados fictícios)',
    whatsapp: '11900000000',
    phone: '1130000000',
    street: 'Rua de Exemplo',
    number: '100',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    instagram: 'funilariaexemplo',
    opening_hours: 'Seg a sex 8h–18h, sáb 8h–12h',
    pix_key: 'pix@exemplo.com',
    pix_name: 'Funilaria Exemplo',
    hourly_rate: 6000,
  }
  await db.saveSettings(s)

  const people = [
    { name: 'Maria Souza (exemplo)', phone: '11911111111', plate: 'ABC1D23', brand: 'VW', model: 'Gol', color: 'Prata', year: '2018/2019' },
    { name: 'João Pereira (exemplo)', phone: '11922222222', plate: 'BRA2E19', brand: 'Fiat', model: 'Argo', color: 'Branco', year: '2021/2022' },
    { name: 'Ana Lima (exemplo)', phone: '11933333333', plate: 'QWE4R56', brand: 'Toyota', model: 'Corolla', color: 'Preto', year: '2020/2020' },
  ]
  const ids: { c: string; v: string }[] = []
  for (const p of people) {
    const c = await db.insert('customers', { name: p.name, phone: p.phone, whatsapp: p.phone })
    const v = await db.insert('vehicles', { customer_id: c.id, plate: p.plate, brand: p.brand, model: p.model, color: p.color, year: p.year })
    ids.push({ c: c.id, v: v.id })
  }
  const item = (description: string, region: string, unit_price: number, kind: DocItem['kind'] = 'service'): DocItem => ({ id: uid(), kind, description, region, qty: 1, unit: kind === 'service' ? 'serv' : 'un', unit_price })

  const mkQuote = async (i: number, extra: Partial<Quote>) =>
    db.insert('quotes', { ...(newQuote(s) as Quote), number: '', customer_id: ids[i].c, vehicle_id: ids[i].v, ...extra })

  // 1) Orçamento aguardando aprovação, com seguradora e fotos
  const q1 = await mkQuote(0, {
    status: 'enviado',
    estimated_days: 5,
    items: [item('Reparo e pintura da porta dianteira esquerda', 'Porta diant. esq.', 120000), item('Pintura do para-choque dianteiro', 'Para-choque dianteiro', 85000), item('Verniz e materiais', '', 18000, 'material')],
    insurance: { insurer: 'Seguradora Exemplo', claim_number: '2026-00123', deductible: 150000, customer_pays: 150000 },
    payment_terms: { methods: ['pix', 'credito'], installments: 3, down_payment: 0, show_pix_qr: true },
    company_snapshot: snapshot(s),
  })
  await addPhotos(orgId, 'quote', q1.id, ids[0].v, ['Porta amassada', 'Para-choque riscado'])

  // 2) Orçamento aprovado que virou OS em andamento
  const q2 = await mkQuote(1, {
    status: 'aprovado',
    estimated_days: 4,
    items: [item('Martelinho de ouro no capô', 'Capô', 45000), item('Polimento completo', '', 35000)],
    payment_terms: { methods: ['pix', 'dinheiro'], installments: 1, down_payment: 20000, show_pix_qr: true },
  })
  await addPhotos(orgId, 'quote', q2.id, ids[1].v, ['Capô com granizo'])
  let wo = await convertToWorkOrder(q2, orgId, s)
  wo = await setStage(wo, 'funilaria', 'Iniciamos o reparo do capô.', s)
  wo = await setStage(wo, 'pintura', '', s)
  await db.insert('payments', { work_order_id: wo.id, customer_id: ids[1].c, amount: 20000, method: 'pix', paid_at: today(), payer: 'cliente', notes: 'Entrada' })
  await addPhotos(orgId, 'work_order', wo.id, ids[1].v, ['Preparação concluída'], 'pintura')

  // 3) OS pronta para entrega, aberta manualmente, com checklist
  const q3 = await mkQuote(2, { status: 'aprovado', simple: true, simple_description: 'Pintura completa do para-choque traseiro e retoque na lateral direita.', simple_total: 98000 })
  let wo3 = await convertToWorkOrder(q3, orgId, s)
  await db.update('work_orders', wo3.id, {
    due_date: addDays(today(), -1),
    checklist: { km: 42000, fuel: 3, damages: [{ region: 'Para-choque traseiro', type: 'risco' }, { region: 'Lateral tras. dir.', type: 'amassado' }], items: ['Estepe', 'Macaco', 'Documento (CRLV)'] },
  })
  wo3 = (await db.get('work_orders', wo3.id))!
  await setStage(wo3, 'pronto', 'Seu carro está pronto para retirada!', s)

  // 4) Histórico dos últimos 60 dias (para o resumo do dia e os indicadores)
  const extra = [
    { name: 'Carlos Mendes (exemplo)', plate: 'RTA3B45', brand: 'Chevrolet', model: 'Onix', color: 'Vermelho' },
    { name: 'Transportes Sul Ltda (exemplo)', plate: 'MKD7F21', brand: 'Volkswagen', model: 'Saveiro', color: 'Branco', document: '11222333000181' },
    { name: 'Patrícia Rocha (exemplo)', plate: 'PLX2C88', brand: 'Hyundai', model: 'HB20', color: 'Prata' },
  ]
  for (const p of extra) {
    const c = await db.insert('customers', { name: p.name, phone: '11944444444', whatsapp: '11944444444', city: 'São Paulo', document: p.document, source: 'Indicação' })
    const v = await db.insert('vehicles', { customer_id: c.id, plate: p.plate, brand: p.brand, model: p.model, color: p.color })
    ids.push({ c: c.id, v: v.id })
  }
  const jobs: [number, string, number, DocItem[], number][] = [
    [3, 'Para-choque traseiro', 52, [item('Pintura do para-choque traseiro', 'Para-choque traseiro', 70000), item('Para-choque novo', 'Para-choque traseiro', 45000, 'part')], 38000],
    [4, 'Porta', 45, [item('Funilaria e pintura da porta', 'Porta diant. dir.', 110000), item('Verniz e massa', '', 22000, 'material')], 30000],
    [5, 'Polimento', 38, [item('Polimento completo', '', 45000), item('Vitrificação', '', 60000)], 9000],
    [3, 'Capô', 30, [item('Martelinho de ouro no capô', 'Capô', 55000)], 4000],
    [0, 'Lateral', 24, [item('Pintura da lateral esquerda', 'Lateral tras. esq.', 150000), item('Tinta e materiais', '', 28000, 'material')], 52000],
    [4, 'Para-lama', 17, [item('Reparo do para-lama', 'Para-lama diant. esq.', 65000), item('Farol novo', 'Para-choque dianteiro', 48000, 'part')], 41000],
    [5, 'Retrovisor', 9, [item('Troca e pintura do retrovisor', 'Retrovisor dir.', 38000, 'service'), item('Capa do retrovisor', 'Retrovisor dir.', 21000, 'part')], 17000],
    [1, 'Teto', 5, [item('Reparo de granizo no teto', 'Teto', 120000)], 15000],
  ]
  for (const [who, , daysAgo, items, cost] of jobs) {
    const entry = addDays(today(), -daysAgo)
    const out = addDays(entry, 3 + (daysAgo % 4))
    const wo = await db.insert('work_orders', {
      ...newWorkOrderSeed(), number: '', customer_id: ids[who].c, vehicle_id: ids[who].v, items, entry_date: entry, due_date: out,
      stage: 'entregue', delivered_at: `${out}T17:00:00.000Z`, company_snapshot: snapshot(s),
    })
    await db.insert('stage_events', { work_order_id: wo.id, stage: 'entregue', note: 'Entregue' })
    await db.insert('payments', { work_order_id: wo.id, customer_id: ids[who].c, amount: wo.total, method: daysAgo % 2 ? 'pix' : 'credito', paid_at: out, payer: 'cliente' })
    await db.insert('costs', { work_order_id: wo.id, category: 'tinta', description: 'Tinta, verniz e materiais', amount: cost, spent_at: entry })
  }

  // 5) Um carro atrasado na pintura
  const late = await db.insert('work_orders', {
    ...newWorkOrderSeed(), number: '', customer_id: ids[5].c, vehicle_id: ids[5].v, entry_date: addDays(today(), -9), due_date: addDays(today(), -2), stage: 'pintura',
    items: [item('Pintura do capô e para-choque', 'Capô', 140000)],
  })
  await db.insert('stage_events', { work_order_id: late.id, stage: 'pintura', note: 'Aguardando a tinta chegar.' })
}

function newWorkOrderSeed() {
  return { simple: false, discount: 0, surcharge: 0, simple_total: 0, payment_terms: { methods: ["pix", "credito"] as PaymentMethod[], installments: 1, down_payment: 0, show_pix_qr: true }, insurance: null, public_token: randomToken(), public_enabled: true, checklist: null, subtotal: 0, total: 0 }
}

async function addPhotos(orgId: string, parentType: 'quote' | 'work_order', parentId: string, vehicleId: string, captions: string[], stage?: string) {
  for (const [i, caption] of captions.entries()) {
    const path = filePath(orgId)
    await db.uploadFile(path, await sampleImage(caption, i))
    await db.insert('photos', { parent_type: parentType, parent_id: parentId, vehicle_id: vehicleId, path, caption, is_public: true, position: i, stage })
  }
}

function sampleImage(label: string, variant: number): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = 800
  c.height = 600
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 800, 600)
  grad.addColorStop(0, ['#334155', '#1e3a8a', '#3f3f46'][variant % 3])
  grad.addColorStop(1, ['#94a3b8', '#60a5fa', '#a1a1aa'][variant % 3])
  g.fillStyle = grad
  g.fillRect(0, 0, 800, 600)
  // silhueta simples de carro
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.beginPath()
  g.moveTo(140, 380)
  g.lineTo(220, 270)
  g.lineTo(560, 270)
  g.lineTo(660, 380)
  g.lineTo(700, 380)
  g.lineTo(700, 440)
  g.lineTo(100, 440)
  g.lineTo(100, 380)
  g.closePath()
  g.fill()
  g.fillStyle = '#0f172a'
  for (const x of [220, 580]) {
    g.beginPath()
    g.arc(x, 445, 48, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#fff'
  g.font = 'bold 34px Arial'
  g.textAlign = 'center'
  g.fillText(label, 400, 110)
  g.font = '22px Arial'
  g.fillText('Foto de exemplo', 400, 150)
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.8))
}
