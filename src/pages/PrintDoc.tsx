import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CarDiagram } from '../components/Checklist'
import { KIND_LABEL } from '../components/ItemsEditor'
import { usePhotoUrl } from '../components/PhotoManager'
import { useQr } from '../components/ShareBox'
import { Button, ErrorBox, Loading } from '../components/ui'
import { useApp, useLoad } from '../lib/app'
import { activePayments, installments, insuranceSplit, itemSubtotal } from '../lib/calc'
import { db } from '../lib/db'
import { DAMAGE_TYPES, PAYMENT_METHODS } from '../lib/defaults'
import { companyFor } from '../lib/docs'
import { date, dateTime, documentFmt, money, phone, plate } from '../lib/format'
import { pixPayload } from '../lib/pix'
import { companyAddress, publicUrl, vehicleLabel } from '../lib/share'
import type { Customer, DocCommon, DocItem, ItemKind, Payment, Photo, Quote, Settings, Vehicle, WorkOrder } from '../lib/types'

type Kind = 'quote' | 'work_order' | 'recibo'

export default function PrintDoc() {
  const { kind, id } = useParams() as { kind: Kind; id: string }
  const nav = useNavigate()
  const { settings } = useApp()
  const { data, error } = useLoad(async () => {
    const doc = kind === 'quote' ? await db.get('quotes', id) : await db.get('work_orders', id)
    if (!doc) throw new Error('Documento não encontrado')
    const [customer, vehicle, photos, payments] = await Promise.all([
      db.get('customers', doc.customer_id),
      db.get('vehicles', doc.vehicle_id),
      kind === 'recibo' ? Promise.resolve([] as Photo[]) : db.list('photos', { parent_id: doc.id, is_public: true }),
      kind === 'quote' ? Promise.resolve([] as Payment[]) : db.list('payments', { work_order_id: doc.id }),
    ])
    return { doc, customer, vehicle, photos: photos.sort((a, b) => a.position - b.position), payments }
  }, [kind, id])
  const [loaded, setLoaded] = useState(0)

  // A folha A4 sempre em modo claro (impressão e PDF), mesmo com o app no escuro.
  useEffect(() => {
    const el = document.documentElement
    const wasDark = el.classList.contains('dark')
    el.classList.remove('dark')
    return () => {
      if (wasDark) el.classList.add('dark')
    }
  }, [])

  useEffect(() => {
    if (!data) return
    const prev = document.title
    const label = kind === 'recibo' ? `Recibo-${data.doc.number}` : data.doc.number
    document.title = `${label}_Placa-${plate(data.vehicle?.plate)}`
    return () => {
      document.title = prev
    }
  }, [data, kind])

  if (error) return <ErrorBox message={error} />
  if (!data || !settings) return <Loading />
  const ready = loaded >= data.photos.length

  return (
    <div className="print-root">
      <div className="sticky top-0 z-20 flex gap-2 border-b border-slate-200 bg-card p-3 print:hidden">
        <Button variant="secondary" onClick={() => nav(-1)}>‹ Voltar</Button>
        <Button className="flex-1" disabled={!ready} onClick={() => window.print()}>{ready ? 'Imprimir / Salvar PDF' : 'Carregando fotos…'}</Button>
      </div>
      <p className="px-4 pt-3 text-center text-xs text-slate-500 print:hidden">
        {import.meta.env.VITE_DEMO
          ? 'Na demonstração a janela de impressão fica bloqueada pelo navegador. No sistema publicado, o botão abre a impressão e "Salvar como PDF".'
          : 'No celular, escolha "Salvar como PDF" na tela de impressão para gerar o arquivo e compartilhar.'}
      </p>
      <ScaledA4>
        {kind === 'recibo' ? (
          <Receipt doc={data.doc as WorkOrder} customer={data.customer} vehicle={data.vehicle} payments={data.payments} settings={settings} />
        ) : (
          <DocumentA4 kind={kind} doc={data.doc} customer={data.customer} vehicle={data.vehicle} photos={data.photos} payments={data.payments} settings={settings} onImg={() => setLoaded((n) => n + 1)} />
        )}
      </ScaledA4>
    </div>
  )
}

/** Mostra a folha A4 em tamanho real, reduzida para caber na tela do celular. Na impressão, sem escala. */
function ScaledA4({ children }: { children: ReactNode }) {
  const [z, setZ] = useState(1)
  useEffect(() => {
    const f = () => setZ(Math.min(1, (window.innerWidth - 16) / 794))
    f()
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return (
    <div className="flex justify-center py-4 print:block print:p-0">
      <div className="a4" style={{ ['--z' as string]: z }}>{children}</div>
    </div>
  )
}

function Header({ s, title, number, lines }: { s: Partial<Settings>; title: string; number: string; lines: [string, string][] }) {
  const logo = usePhotoUrl(s.logo_url)
  const color = s.brand_color || '#1d4ed8'
  return (
    <header className="avoid-break mb-4 border-b-4 pb-3" style={{ borderColor: color }}>
      <div className="flex items-start gap-4">
        {logo && <img src={logo} alt="" className="h-20 w-20 object-contain" />}
        <div className="flex-1 text-[9pt] leading-snug text-slate-700">
          <div className="text-[15pt] font-bold leading-tight text-slate-900">{s.trade_name}</div>
          {s.tagline && <div className="font-semibold" style={{ color }}>{s.tagline}</div>}
          {s.legal_name && <div>{s.legal_name}</div>}
          {s.document && <div>CNPJ/CPF: {documentFmt(s.document)}{s.state_registration ? ` • IE: ${s.state_registration}` : ''}</div>}
          {companyAddress(s) && <div>{companyAddress(s)}</div>}
          <div>{[s.phone && `Tel: ${phone(s.phone)}`, s.whatsapp && `WhatsApp: ${phone(s.whatsapp)}`].filter(Boolean).join(' • ')}</div>
          <div>{[s.email, s.instagram && `@${s.instagram.replace(/^@/, '')}`, s.website].filter(Boolean).join(' • ')}</div>
        </div>
        <div className="min-w-[46mm] rounded-md border-2 p-2 text-right" style={{ borderColor: color }}>
          <div className="text-[13pt] font-extrabold uppercase" style={{ color }}>{title}</div>
          <div className="text-[12pt] font-bold">Nº {number}</div>
          {lines.map(([k, v]) => <div key={k} className="text-[9pt]"><span className="text-slate-500">{k}:</span> <strong>{v}</strong></div>)}
        </div>
      </div>
    </header>
  )
}

function Parties({ customer, vehicle, doc }: { customer?: Customer | null; vehicle?: Vehicle | null; doc: DocCommon }) {
  return (
    <div className="avoid-break mb-4 grid grid-cols-2 gap-3 text-[9pt]">
      <Box title="Cliente">
        <div className="font-bold">{customer?.name}</div>
        {customer?.document && <div>CPF/CNPJ: {documentFmt(customer.document)}</div>}
        {customer?.phone && <div>Telefone: {phone(customer.phone)}</div>}
        {customer?.email && <div>{customer.email}</div>}
        {customer?.address && <div>{customer.address}</div>}
      </Box>
      <Box title="Veículo">
        <div className="font-bold">{vehicleLabel(vehicle)}{vehicle?.year ? ` • ${vehicle.year}` : ''}</div>
        <div>Placa: <strong>{plate(vehicle?.plate)}</strong>{vehicle?.km ? ` • Km: ${vehicle.km.toLocaleString('pt-BR')}` : ''}</div>
        {vehicle?.paint_code && <div>Cód. cor: {vehicle.paint_code}</div>}
        {vehicle?.vin && <div>Chassi: {vehicle.vin}</div>}
      </Box>
      {doc.insurance && (
        <Box title="Seguradora" className="col-span-2">
          <div className="flex gap-6">
            <span><strong>{doc.insurance.insurer}</strong></span>
            {doc.insurance.claim_number && <span>Sinistro: <strong>{doc.insurance.claim_number}</strong></span>}
            <span>Franquia: <strong>{money(doc.insurance.deductible)}</strong></span>
          </div>
        </Box>
      )}
    </div>
  )
}

const Box = ({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) => (
  <div className={`rounded-md border border-slate-300 p-2 ${className}`}>
    <div className="mb-1 text-[8pt] font-bold uppercase tracking-wide text-slate-500">{title}</div>
    {children}
  </div>
)

function ItemsTable({ items }: { items: DocItem[] }) {
  const groups = (['service', 'part', 'material'] as ItemKind[]).map((k) => ({ k, list: items.filter((i) => i.kind === k) })).filter((g) => g.list.length)
  return (
    <table className="mb-3 w-full border-collapse text-[9pt]">
      <thead>
        <tr className="bg-slate-100 text-left">
          <th className="border border-slate-300 px-2 py-1">Descrição</th>
          <th className="border border-slate-300 px-2 py-1">Peça/região</th>
          <th className="border border-slate-300 px-2 py-1 text-right">Qtd</th>
          <th className="border border-slate-300 px-2 py-1 text-right">Unitário</th>
          <th className="border border-slate-300 px-2 py-1 text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => [
          <tr key={g.k} className="avoid-break"><td colSpan={5} className="border border-slate-300 bg-slate-50 px-2 py-1 font-bold">{KIND_LABEL[g.k]}</td></tr>,
          ...g.list.map((i) => (
            <tr key={i.id} className="avoid-break">
              <td className="border border-slate-300 px-2 py-1">{i.description}</td>
              <td className="border border-slate-300 px-2 py-1">{i.region ?? ''}</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{String(i.qty).replace('.', ',')} {i.unit}</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{money(i.unit_price)}</td>
              <td className="border border-slate-300 px-2 py-1 text-right">{money(itemSubtotal(i))}</td>
            </tr>
          )),
        ])}
      </tbody>
    </table>
  )
}

function Totals({ doc, s, paid }: { doc: DocCommon; s: Partial<Settings>; paid?: number }) {
  const split = insuranceSplit(doc.total, doc.insurance)
  const t = doc.payment_terms
  const financed = Math.max(0, split.customer - t.down_payment)
  const inst = installments(financed, t.installments, t.installments > 1 ? s.installment_fee_percent ?? 0 : 0)
  const pixAmount = Math.max(0, split.customer - (paid ?? 0))
  const pix = useQr(t.show_pix_qr && s.pix_key && pixAmount > 0 ? pixPayload({ key: s.pix_key, name: s.pix_name || s.trade_name || '', city: s.city || '', amountCents: pixAmount, txid: doc.number.replace(/\W/g, '') }) : '', 240)
  return (
    <div className="avoid-break mb-4 grid grid-cols-[1fr_68mm] gap-3 text-[9pt]">
      <Box title="Forma de pagamento">
        <div className="flex gap-3">
          <div className="flex-1 space-y-0.5">
            {t.methods.length > 0 && <div>{t.methods.map((m) => PAYMENT_METHODS[m]).join(' • ')}</div>}
            {t.down_payment > 0 && <div>Entrada: <strong>{money(t.down_payment)}</strong></div>}
            {financed > 0 && (t.installments > 1
              ? <div>Parcelado: <strong>{t.installments}x de {money(inst.values[0])}</strong>{inst.total !== financed ? ` (total ${money(inst.total)})` : ''}</div>
              : <div>{t.down_payment > 0 ? 'Saldo' : 'Valor'}: <strong>{money(financed)}</strong> à vista</div>)}
            {t.notes && <div>{t.notes}</div>}
            {s.pix_key && t.methods.includes('pix') && <div>Chave PIX: <strong>{s.pix_key}</strong>{s.pix_name ? ` (${s.pix_name})` : ''}</div>}
          </div>
          {pix && (
            <div className="text-center text-[7pt]">
              <img src={pix} alt="QR PIX" className="h-[26mm] w-[26mm]" />
              PIX {money(pixAmount)}
            </div>
          )}
        </div>
      </Box>
      <div className="rounded-md border border-slate-300 p-2">
        {(doc.discount > 0 || doc.surcharge > 0) && <TRow k="Subtotal" v={money(doc.subtotal)} />}
        {doc.discount > 0 && <TRow k="Desconto" v={`− ${money(doc.discount)}`} />}
        {doc.surcharge > 0 && <TRow k="Acréscimo" v={money(doc.surcharge)} />}
        <div className="mt-1 flex justify-between rounded px-2 py-1 text-[12pt] font-extrabold text-white" style={{ background: s.brand_color || '#1d4ed8' }}>
          <span>TOTAL</span><span>{money(doc.total)}</span>
        </div>
        {doc.insurance && (
          <>
            <TRow k="Seguradora paga" v={money(split.insurer)} />
            <TRow k="Cliente paga" v={money(split.customer)} bold />
          </>
        )}
        {paid !== undefined && paid > 0 && (
          <>
            <TRow k="Recebido" v={money(paid)} />
            <TRow k="Saldo" v={money(Math.max(0, doc.total - paid))} bold />
          </>
        )}
      </div>
    </div>
  )
}

const TRow = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={`flex justify-between px-2 py-0.5 ${bold ? 'font-bold' : ''}`}><span>{k}</span><span>{v}</span></div>
)

function PrintPhoto({ p, onLoad }: { p: Photo; onLoad: () => void }) {
  const url = usePhotoUrl(p.path)
  return (
    <figure className="avoid-break">
      {url ? <img src={url} alt="" onLoad={onLoad} onError={onLoad} className="h-[52mm] w-full rounded border border-slate-300 object-cover" /> : <div className="h-[52mm] rounded bg-slate-100" />}
      {p.caption && <figcaption className="mt-0.5 text-[8pt] text-slate-600">{p.caption}</figcaption>}
    </figure>
  )
}

function DocumentA4({ kind, doc, customer, vehicle, photos, payments, settings, onImg }: {
  kind: 'quote' | 'work_order'; doc: Quote | WorkOrder; customer?: Customer | null; vehicle?: Vehicle | null; photos: Photo[]; payments: Payment[]; settings: Settings; onImg: () => void
}) {
  const s = companyFor(doc, settings)
  const qr = useQr(doc.public_enabled ? publicUrl(doc.public_token) : '', 200)
  const q = kind === 'quote' ? (doc as Quote) : null
  const w = kind === 'work_order' ? (doc as WorkOrder) : null
  const paid = activePayments(payments).reduce((a, p) => a + p.amount, 0)
  const lines: [string, string][] = q
    ? [['Emissão', date(q.created_at)], ['Validade', date(q.valid_until)], ...(q.estimated_days ? [['Prazo', `${q.estimated_days} dias`] as [string, string]] : [])]
    : [['Entrada', date(w!.entry_date)], ['Previsão', date(w!.due_date)], ...(w!.delivered_at ? [['Entrega', date(w!.delivered_at)] as [string, string]] : [])]

  return (
    <>
      <Header s={s} title={q ? 'Orçamento' : 'Ordem de serviço'} number={doc.number} lines={lines} />
      <Parties customer={customer} vehicle={vehicle} doc={doc} />

      <h3 className="mb-1 text-[10pt] font-bold uppercase">Serviços</h3>
      {doc.simple ? <div className="avoid-break mb-3 whitespace-pre-wrap rounded-md border border-slate-300 p-2 text-[9pt]">{doc.simple_description}</div> : <ItemsTable items={doc.items} />}
      <Totals doc={doc} s={s} paid={w ? paid : undefined} />

      {w?.checklist && (
        <div className="avoid-break mb-4">
          <h3 className="mb-1 text-[10pt] font-bold uppercase">Checklist de entrada</h3>
          <div className="flex gap-4 rounded-md border border-slate-300 p-2 text-[9pt]">
            <CarDiagram damages={w.checklist.damages} small />
            <div className="flex-1 space-y-0.5">
              <div>Km: <strong>{w.checklist.km ?? '—'}</strong> • Combustível: <strong>{['Vazio', '1/4', '1/2', '3/4', 'Cheio'][w.checklist.fuel]}</strong></div>
              {w.checklist.damages.length > 0 ? w.checklist.damages.map((d, i) => <div key={i}>• {d.region}: {DAMAGE_TYPES[d.type]}{d.note ? ` (${d.note})` : ''}</div>) : <div>Sem avarias registradas.</div>}
              {w.checklist.items.length > 0 && <div>Itens no veículo: {w.checklist.items.join(', ')}</div>}
              {w.checklist.belongings && <div>Objetos: {w.checklist.belongings}</div>}
              {w.checklist.notes && <div>Obs.: {w.checklist.notes}</div>}
              {w.checklist.signature && (
                <div className="pt-1"><img src={w.checklist.signature} alt="" className="h-10" /><div className="text-[8pt]">{w.checklist.signed_by} • {dateTime(w.checklist.signed_at)}</div></div>
              )}
            </div>
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-[10pt] font-bold uppercase">Fotos</h3>
          <div className="grid grid-cols-3 gap-2">{photos.map((p) => <PrintPhoto key={p.id} p={p} onLoad={onImg} />)}</div>
        </div>
      )}

      {doc.customer_notes && <div className="avoid-break mb-3 rounded-md border border-slate-300 p-2 text-[9pt]"><strong>Observações:</strong> {doc.customer_notes}</div>}

      <footer className="mt-4 space-y-2 text-[8pt] text-slate-700">
        {s.general_terms && <p><strong>Condições gerais:</strong> {s.general_terms}</p>}
        {s.warranty_terms && <p><strong>Garantia:</strong> {s.warranty_terms}</p>}
        {q && <p>Orçamento válido até {date(q.valid_until)}.</p>}
        <div className="avoid-break flex items-end gap-6 pt-8">
          <Sign label={q ? 'Aprovação do cliente' : 'Cliente'} img={w?.delivery_signature ?? undefined} />
          <Sign label={s.trade_name ?? 'Oficina'} />
          {qr && (
            <div className="text-center text-[7pt]">
              <img src={qr} alt="" className="h-[24mm] w-[24mm]" />
              {q ? 'Ver e aprovar online' : 'Acompanhe seu veículo'}
            </div>
          )}
        </div>
        {q?.decision_at && q.status === 'aprovado' && <p>Aprovado online por {q.decision_by} em {dateTime(q.decision_at)}.</p>}
      </footer>
    </>
  )
}

const Sign = ({ label, img }: { label: string; img?: string }) => (
  <div className="flex-1 text-center">
    {img && <img src={img} alt="" className="mx-auto -mb-2 h-12" />}
    <div className="border-t border-slate-500 pt-1">{label}</div>
  </div>
)

function Receipt({ doc, customer, vehicle, payments, settings }: { doc: WorkOrder; customer?: Customer | null; vehicle?: Vehicle | null; payments: Payment[]; settings: Settings }) {
  const s = companyFor(doc, settings)
  const ps = activePayments(payments).sort((a, b) => (a.paid_at < b.paid_at ? -1 : 1))
  const paid = ps.reduce((a, p) => a + p.amount, 0)
  return (
    <>
      <Header s={s} title="Recibo" number={doc.number} lines={[['Data', date(new Date().toISOString())], ['Valor', money(paid)]]} />
      <p className="mb-4 text-[11pt] leading-relaxed">
        Recebemos de <strong>{customer?.name}</strong>{customer?.document ? ` (CPF/CNPJ ${documentFmt(customer.document)})` : ''} a quantia de{' '}
        <strong>{money(paid)}</strong>, referente aos serviços da ordem de serviço <strong>{doc.number}</strong> no veículo{' '}
        <strong>{vehicleLabel(vehicle)} – placa {plate(vehicle?.plate)}</strong>.
      </p>
      <table className="mb-4 w-full border-collapse text-[9pt]">
        <thead><tr className="bg-slate-100 text-left"><th className="border border-slate-300 px-2 py-1">Data</th><th className="border border-slate-300 px-2 py-1">Forma</th><th className="border border-slate-300 px-2 py-1">Obs.</th><th className="border border-slate-300 px-2 py-1 text-right">Valor</th></tr></thead>
        <tbody>
          {ps.map((p) => (
            <tr key={p.id}><td className="border border-slate-300 px-2 py-1">{date(p.paid_at)}</td><td className="border border-slate-300 px-2 py-1">{PAYMENT_METHODS[p.method]}</td><td className="border border-slate-300 px-2 py-1">{p.notes}</td><td className="border border-slate-300 px-2 py-1 text-right">{money(p.amount)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="text-[9pt]">Total do serviço: {money(doc.total)} • Recebido: {money(paid)} • Saldo: {money(Math.max(0, doc.total - paid))}</p>
      <div className="flex gap-6 pt-16 text-[9pt]"><Sign label={s.trade_name ?? ''} /></div>
    </>
  )
}
