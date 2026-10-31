import { CarFront, Eye, FileClock, HandCoins, Sparkles, Target, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { activePayments, balance } from '../lib/calc'
import { isQuoteExpired } from '../lib/docs'
import { addDays, date, daysBetween, money, today } from '../lib/format'
import { fillTemplate, messageVars, vehicleLabel, whatsappUrl } from '../lib/share'
import type { Customer, Payment, Quote, Settings, Vehicle, WorkOrder } from '../lib/types'
import { WaIcon } from './ShareBox'
import { Button, Sheet } from './ui'

const KEY = 'lataria-resumo'

/** Mostra o resumo uma vez por dia, a não ser que o usuário peça "Nunca mostrar". */
export function shouldShowSummary() {
  try {
    const v = localStorage.getItem(KEY)
    return v !== 'nunca' && v !== today()
  } catch {
    return false
  }
}
function remember(v: string) {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* sem armazenamento */
  }
}

interface Data {
  quotes: Quote[]
  orders: WorkOrder[]
  payments: Payment[]
  vehicles: Map<string, Vehicle>
  customers: Map<string, Customer>
}

type Urgency = { id: string; level: 'red' | 'amber'; icon: typeof Truck; title: string; text: string; tip: string; to: string; wa?: string }

export function buildSummary(d: Data, s: Settings) {
  const t = today()
  const y = addDays(t, -1)
  const pays = activePayments(d.payments)
  const inShop = d.orders.filter((o) => o.stage !== 'entregue')
  const dueOf = (o: WorkOrder) => balance(o.total, pays.filter((p) => p.work_order_id === o.id)).due
  const label = (o: { vehicle_id: string; customer_id: string }) => `${vehicleLabel(d.vehicles.get(o.vehicle_id))} (${d.vehicles.get(o.vehicle_id)?.plate ?? ''}) de ${d.customers.get(o.customer_id)?.name ?? 'cliente'}`
  const waFor = (o: WorkOrder, tpl: string) => {
    const c = d.customers.get(o.customer_id)
    const st = s.stages.find((x) => x.key === o.stage)
    const phone = c?.whatsapp || c?.phone
    return phone ? whatsappUrl(phone, fillTemplate(tpl, messageVars({ customer: c, vehicle: d.vehicles.get(o.vehicle_id), number: o.number, token: o.public_token, stage: st?.name, due: o.due_date }))) : undefined
  }

  const late = inShop.filter((o) => o.due_date && o.due_date < t && o.stage !== 'pronto')
  const longStay = inShop.filter((o) => !late.includes(o) && o.stage !== 'pronto' && daysBetween(o.entry_date) >= 7)
  const charging = d.orders.filter((o) => (o.stage === 'pronto' || o.stage === 'entregue') && dueOf(o) > 0)
  const waiting = d.quotes.filter((q) => q.status === 'enviado' && !isQuoteExpired(q) && daysBetween(q.updated_at.slice(0, 10)) >= 3)

  const urgencies: Urgency[] = [
    ...late.map((o): Urgency => ({ id: o.id, level: 'red', icon: Truck, title: `Entrega atrasada há ${daysBetween(o.due_date!)} dia(s)`, text: `${label(o)} — previsão era ${date(o.due_date)}.`, tip: 'Avise o cliente e combine nova data.', to: `/os/${o.id}`, wa: waFor(o, s.templates.stage) })),
    ...charging.map((o): Urgency => ({ id: o.id, level: 'amber', icon: HandCoins, title: `Falta receber ${money(dueOf(o))}`, text: `${label(o)} — ${o.stage === 'pronto' ? 'pronto para entrega' : 'já entregue'}.`, tip: 'Cobre o saldo antes ou na entrega.', to: `/os/${o.id}`, wa: waFor(o, s.templates.ready) })),
    ...longStay.map((o): Urgency => ({ id: o.id, level: 'amber', icon: CarFront, title: `Carro na oficina há ${daysBetween(o.entry_date)} dias`, text: `${label(o)} — etapa ${s.stages.find((x) => x.key === o.stage)?.name ?? o.stage}.`, tip: 'Dê um retorno ao cliente e destrave o que está segurando o serviço.', to: `/os/${o.id}`, wa: waFor(o, s.templates.stage) })),
    ...waiting.map((q): Urgency => ({ id: q.id, level: 'amber', icon: FileClock, title: `Orçamento sem resposta há ${daysBetween(q.updated_at.slice(0, 10))} dias`, text: `${label(q)} — ${money(q.total)}.`, tip: 'Mande uma mensagem perguntando se ficou alguma dúvida.', to: `/orcamentos/${q.id}` })),
  ]

  const deliveredY = d.orders.filter((o) => o.delivered_at?.slice(0, 10) === y)
  const receivedY = pays.filter((p) => p.paid_at === y).reduce((a, p) => a + p.amount, 0)
  const opened7 = d.orders.filter((o) => o.entry_date > addDays(t, -7)).length
  const openedPrev7 = d.orders.filter((o) => o.entry_date <= addDays(t, -7) && o.entry_date > addDays(t, -14)).length

  const priority = late.length
    ? `Prioridade hoje: dar retorno sobre ${late.length} carro(s) com entrega atrasada.`
    : charging.length
      ? `Prioridade hoje: receber de ${charging.length} cliente(s) com saldo em aberto.`
      : waiting.length
        ? `Prioridade hoje: cobrar resposta de ${waiting.length} orçamento(s).`
        : inShop.length
          ? `Tudo em dia. ${inShop.length} carro(s) na oficina.`
          : 'Oficina livre: bom dia para mandar orçamentos e chamar clientes antigos.'

  return { urgencies, priority, deliveredY, receivedY, opened7, openedPrev7, inShop: inShop.length }
}

export function DailySummary({ open, onClose, data, settings }: { open: boolean; onClose: () => void; data: Data; settings: Settings }) {
  const sm = buildSummary(data, settings)
  const now = new Date()
  const h = Number(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  const wd = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' })
  const weekday = wd.charAt(0).toUpperCase() + wd.slice(1)
  const pct = sm.openedPrev7 ? Math.round(((sm.opened7 - sm.openedPrev7) / sm.openedPrev7) * 100) : null
  const close = (v: string) => {
    remember(v)
    onClose()
  }
  return (
    <Sheet open={open} onClose={() => close(today())} title="Resumo do dia">
      <div>
        <div className="text-xl font-extrabold">{h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}</div>
        <div className="text-sm text-slate-500">{weekday}</div>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-sm font-medium text-brand-800">
        <Target size={18} className="mt-0.5 shrink-0" /> {sm.priority}
      </div>

      <div>
        <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Ontem</div>
        <div className="rounded-xl p-3 ring-1 ring-slate-200">
          <p className="text-sm text-slate-600">
            {sm.deliveredY.length ? `Foram entregues ${sm.deliveredY.length} carro(s) somando ${money(sm.deliveredY.reduce((a, o) => a + o.total, 0))}` : 'Nenhum carro entregue'}
            {` e entraram ${money(sm.receivedY)} em pagamentos.`}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Mini value={sm.deliveredY.length} label="entregues ontem" />
            <Mini value={sm.opened7} label="serviços em 7 dias" badge={pct === null ? undefined : `${pct > 0 ? '+' : ''}${pct}%`} good={pct !== null && pct >= 0} />
            <Mini value={sm.inShop} label="na oficina agora" />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Urgências</span><span className="rounded-full bg-slate-100 px-2 py-0.5">{sm.urgencies.length}</span>
        </div>
        {sm.urgencies.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><Sparkles size={18} /> Nada urgente. Bom trabalho!</p>
        ) : (
          <ul className="space-y-2">
            {sm.urgencies.slice(0, 8).map((u) => (
              <li key={u.id + u.title} className="rounded-xl p-3 ring-1 ring-slate-200">
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${u.level === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold"><u.icon size={16} className="shrink-0 text-slate-500" /> {u.title}</div>
                    <p className="text-sm text-slate-600">{u.text}</p>
                    <p className="mt-0.5 text-xs font-medium text-brand-700">{u.tip}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Link to={u.to} onClick={() => close(today())} aria-label="Ver" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Eye size={18} /></Link>
                    {u.wa && <a href={u.wa} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-lg text-wa hover:bg-slate-100"><WaIcon size={18} /></a>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button type="button" className="text-sm font-semibold text-slate-500" onClick={() => close('nunca')}>Nunca mostrar</button>
        <Button className="px-8" onClick={() => close(today())}>Entendi</Button>
      </div>
    </Sheet>
  )
}

const Mini = ({ value, label, badge, good }: { value: number; label: string; badge?: string; good?: boolean }) => (
  <div>
    <div className="flex items-center gap-1.5">
      <span className="tnum text-xl font-extrabold">{value}</span>
      {badge && <span className={`rounded-full px-1.5 text-[11px] font-bold ${good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{badge}</span>}
    </div>
    <div className="text-xs text-slate-500">{label}</div>
  </div>
)
