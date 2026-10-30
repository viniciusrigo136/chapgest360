import { CarFront, ClipboardList, FilePlus2, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActionTile, Empty, Loading, Plate, RowLink, StatusPill } from '../components/ui'
import { useApp, useLoad } from '../lib/app'
import { activePayments, balance } from '../lib/calc'
import { db } from '../lib/db'
import { isQuoteExpired } from '../lib/docs'
import { date, daysBetween, money, today } from '../lib/format'
import { vehicleLabel } from '../lib/share'

function greeting() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Dashboard() {
  const { settings } = useApp()
  const { data } = useLoad(async () => {
    const [quotes, orders, payments, vehicles, customers] = await Promise.all([
      db.list('quotes', { archived_at: null }),
      db.list('work_orders', { archived_at: null }),
      db.list('payments'),
      db.list('vehicles'),
      db.list('customers'),
    ])
    return { quotes, orders, payments, vehicles: new Map(vehicles.map((v) => [v.id, v])), customers: new Map(customers.map((c) => [c.id, c])) }
  })
  if (!data || !settings) return <Loading />

  const t = today()
  const inShop = data.orders.filter((o) => o.stage !== 'entregue').sort((a, b) => ((a.due_date ?? '9') < (b.due_date ?? '9') ? -1 : 1))
  const ready = inShop.filter((o) => o.stage === 'pronto').length
  const late = inShop.filter((o) => o.due_date && o.due_date < t && o.stage !== 'pronto').length
  const waiting = data.quotes.filter((q) => q.status === 'enviado' && !isQuoteExpired(q))
  const receivable = data.orders.reduce((s, o) => s + balance(o.total, data.payments.filter((p) => p.work_order_id === o.id)).due, 0)
  const receivedMonth = activePayments(data.payments).filter((p) => p.paid_at.startsWith(t.slice(0, 7))).reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{greeting()}</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{settings.trade_name}</h1>
        </div>
        <Link to="/config" aria-label="Configurações" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200 active:bg-slate-50">
          <Settings size={21} />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <ActionTile to="/orcamentos/novo" icon={FilePlus2} label="Novo orçamento" tone="brand" />
        <ActionTile to="/os/nova" icon={ClipboardList} label="Receber um carro" />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-ink p-4 text-white">
        <Stat label="Na oficina" value={String(inShop.length)} />
        <Stat label="Prontos" value={String(ready)} accent={ready ? 'text-emerald-300' : undefined} />
        <Stat label="Atrasados" value={String(late)} accent={late ? 'text-red-300' : undefined} />
        <div className="col-span-3 mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
          <Stat label="A receber" value={money(receivable)} small />
          <Stat label="Recebido no mês" value={money(receivedMonth)} small accent="text-emerald-300" />
        </div>
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold">Carros na oficina</h2>
          {inShop.length > 0 && <Link to="/os" className="text-sm font-semibold text-brand-600">Ver todos</Link>}
        </div>
        {inShop.length === 0 ? (
          <Empty icon={CarFront} title="Nenhum carro na oficina" text="Quando um orçamento for aprovado ou você receber um carro, ele aparece aqui." />
        ) : (
          <ul className="space-y-2">
            {inShop.slice(0, 8).map((o) => {
              const v = data.vehicles.get(o.vehicle_id)
              const st = settings.stages.find((s) => s.key === o.stage)
              const isLate = o.due_date && o.due_date < t && o.stage !== 'pronto'
              return (
                <li key={o.id}>
                  <RowLink to={`/os/${o.id}`}>
                    <div className="flex items-center gap-3">
                      <Plate value={v?.plate} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{vehicleLabel(v)}</div>
                        <div className="truncate text-xs text-slate-500">{data.customers.get(o.customer_id)?.name}</div>
                      </div>
                      <StatusPill color={st?.color ?? '#64748b'}>{st?.name ?? o.stage}</StatusPill>
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>{daysBetween(o.entry_date)} dia(s) aqui</span>
                      <span className={isLate ? 'font-bold text-red-600' : ''}>{o.due_date ? `Entrega ${date(o.due_date)}${isLate ? ' • atrasado' : ''}` : 'Sem previsão'}</span>
                    </div>
                  </RowLink>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {waiting.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-extrabold">Esperando o cliente aprovar</h2>
          <ul className="space-y-2">
            {waiting.slice(0, 5).map((q) => {
              const v = data.vehicles.get(q.vehicle_id)
              return (
                <li key={q.id}>
                  <RowLink to={`/orcamentos/${q.id}`}>
                    <div className="flex items-center gap-3">
                      <Plate value={v?.plate} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{data.customers.get(q.customer_id)?.name}</div>
                        <div className="text-xs text-slate-500">Enviado • válido até {date(q.valid_until)}</div>
                      </div>
                      <strong className="tnum">{money(q.total)}</strong>
                    </div>
                  </RowLink>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, accent, small }: { label: string; value: string; accent?: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`tnum truncate font-extrabold ${small ? 'text-lg' : 'text-3xl'} ${accent ?? ''}`}>{value}</div>
      <div className="text-xs font-medium text-white/60">{label}</div>
    </div>
  )
}
