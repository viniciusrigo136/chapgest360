import { Link } from 'react-router-dom'
import { Card, LinkButton, Loading } from '../components/ui'
import { useApp, useLoad } from '../lib/app'
import { activePayments, balance } from '../lib/calc'
import { db } from '../lib/db'
import { isQuoteExpired } from '../lib/docs'
import { addDays, date, money, plate, today } from '../lib/format'
import { vehicleLabel } from '../lib/share'

export default function Dashboard() {
  const { settings } = useApp()
  const { data } = useLoad(async () => {
    const [quotes, orders, payments, vehicles] = await Promise.all([
      db.list('quotes', { archived_at: null }),
      db.list('work_orders', { archived_at: null }),
      db.list('payments'),
      db.list('vehicles'),
    ])
    return { quotes, orders, payments, vehicles: new Map(vehicles.map((v) => [v.id, v])) }
  })
  if (!data || !settings) return <Loading />

  const t = today()
  const month = t.slice(0, 7)
  const inShop = data.orders.filter((o) => o.stage !== 'entregue')
  const ready = inShop.filter((o) => o.stage === 'pronto')
  const late = inShop.filter((o) => o.due_date && o.due_date < t && o.stage !== 'pronto')
  const waiting = data.quotes.filter((q) => q.status === 'enviado' && !isQuoteExpired(q))
  const receivable = data.orders.reduce((s, o) => s + balance(o.total, data.payments.filter((p) => p.work_order_id === o.id)).due, 0)
  const lateReceivable = data.orders
    .filter((o) => o.stage === 'entregue')
    .reduce((s, o) => s + balance(o.total, data.payments.filter((p) => p.work_order_id === o.id)).due, 0)
  const receivedMonth = activePayments(data.payments).filter((p) => p.paid_at.startsWith(month)).reduce((s, p) => s + p.amount, 0)
  const monthQuotes = data.quotes.filter((q) => q.created_at.slice(0, 7) === month)
  const approvedMonth = monthQuotes.filter((q) => q.status === 'aprovado').length
  const upcoming = inShop.filter((o) => o.due_date && o.due_date <= addDays(t, 7)).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)).slice(0, 6)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-500">{date(t)}</p>
        <h1 className="text-xl font-bold">{settings.trade_name}</h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <LinkButton to="/orcamentos/novo" className="min-h-14 text-base">+ Orçamento</LinkButton>
        <LinkButton to="/os/nova" variant="secondary" className="min-h-14 text-base">+ Ordem de serviço</LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat to="/os" label="Na oficina" value={inShop.length} />
        <Stat to="/os" label="Prontos p/ entrega" value={ready.length} tone={ready.length ? 'green' : undefined} />
        <Stat to="/orcamentos" label="Aguardando aprovação" value={waiting.length} tone={waiting.length ? 'amber' : undefined} />
        <Stat to="/producao" label="OS atrasadas" value={late.length} tone={late.length ? 'red' : undefined} />
        <Stat label="A receber" value={money(receivable)} />
        <Stat label="Entregues com saldo" value={money(lateReceivable)} tone={lateReceivable ? 'red' : undefined} />
        <Stat label="Recebido no mês" value={money(receivedMonth)} tone="green" />
        <Stat label="Orçamentos aprovados no mês" value={`${approvedMonth}/${monthQuotes.length}`} />
      </div>

      <Card>
        <h2 className="mb-2 font-bold">Próximas entregas (7 dias)</h2>
        {upcoming.length === 0 ? <p className="text-sm text-slate-500">Nenhuma entrega prevista.</p> : (
          <ul className="divide-y divide-slate-100">
            {upcoming.map((o) => {
              const v = data.vehicles.get(o.vehicle_id)
              return (
                <li key={o.id}>
                  <Link to={`/os/${o.id}`} className="flex justify-between py-2 text-sm">
                    <span><strong>{plate(v?.plate)}</strong> {vehicleLabel(v)}</span>
                    <span className={o.due_date! < t ? 'font-bold text-red-700' : ''}>{date(o.due_date)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value, to, tone }: { label: string; value: string | number; to?: string; tone?: 'green' | 'amber' | 'red' }) {
  const color = tone === 'green' ? 'text-green-800' : tone === 'amber' ? 'text-amber-800' : tone === 'red' ? 'text-red-700' : 'text-slate-900'
  const body = (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${color}`}>{value}</div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}
