import { ArrowDownRight, ArrowUpRight, BarChart3, Minus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Card, Loading, PageHeader, Tabs } from '../components/ui'
import { useLoad } from '../lib/app'
import { activePayments, itemSubtotal } from '../lib/calc'
import { db } from '../lib/db'
import { normalizeBrand } from '../lib/defaults'
import { addDays, daysBetween, money, today } from '../lib/format'
import type { WorkOrder } from '../lib/types'

type Range = '7' | '30' | '60' | '90'

const inRange = (d: string, from: string, to: string) => d.slice(0, 10) >= from && d.slice(0, 10) <= to
const compact = (c: number) => (c >= 100000_00 ? `R$ ${Math.round(c / 100000)} mil` : c >= 1000_00 ? `R$ ${(c / 100000).toFixed(1).replace('.', ',')} mil` : money(c))

export default function Indicators() {
  const [range, setRange] = useState<Range>('30')
  const { data } = useLoad(async () => {
    const [orders, payments, customers, vehicles, costs, quotes] = await Promise.all([
      db.list('work_orders', { archived_at: null }), db.list('payments'), db.list('customers'), db.list('vehicles'), db.list('costs'), db.list('quotes', { archived_at: null }),
    ])
    return { orders, payments: activePayments(payments), customers, vehicles: new Map(vehicles.map((v) => [v.id, v])), costs, quotes }
  })

  const m = useMemo(() => {
    if (!data) return null
    const n = Number(range)
    const to = today()
    const from = addDays(to, -(n - 1))
    const pTo = addDays(from, -1)
    const pFrom = addDays(pTo, -(n - 1))
    const period = (f: string, t: string) => {
      const os = data.orders.filter((o) => inRange(o.entry_date, f, t))
      const sales = os.reduce((s, o) => s + o.total, 0)
      const received = data.payments.filter((p) => inRange(p.paid_at, f, t)).reduce((s, p) => s + p.amount, 0)
      const qs = data.quotes.filter((q) => inRange(q.created_at, f, t))
      return {
        os, sales, received, count: os.length, ticket: os.length ? Math.round(sales / os.length) : 0,
        approval: qs.length ? Math.round((qs.filter((q) => q.status === 'aprovado').length / qs.length) * 100) : null,
        newCustomers: data.customers.filter((c) => inRange(c.created_at, f, t)).length,
      }
    }
    const cur = period(from, to)
    const prev = period(pFrom, pTo)
    // vendas por dia, alinhadas pelo dia do período
    const series = Array.from({ length: n }, (_, i) => {
      const d = addDays(from, i)
      const pd = addDays(pFrom, i)
      return { day: d, cur: cur.os.filter((o) => o.entry_date === d).reduce((s, o) => s + o.total, 0), prev: prev.os.filter((o) => o.entry_date === pd).reduce((s, o) => s + o.total, 0) }
    })
    // composição: mão de obra / peças / materiais
    const mix = { service: 0, part: 0, material: 0 }
    for (const o of cur.os) {
      if (o.simple) mix.service += o.subtotal
      else for (const i of o.items) mix[i.kind] += itemSubtotal(i)
    }
    // por marca
    const brands = new Map<string, WorkOrder[]>()
    for (const o of cur.os) {
      const raw = (data.vehicles.get(o.vehicle_id)?.brand ?? '').trim()
      const key = normalizeBrand(raw) || (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Sem marca')
      brands.set(key, [...(brands.get(key) ?? []), o])
    }
    const brandRows = [...brands.entries()].map(([brand, os]) => {
      const total = os.reduce((s, o) => s + o.total, 0)
      const cost = os.reduce((s, o) => s + data.costs.filter((c) => c.work_order_id === o.id).reduce((a, c) => a + c.amount, 0), 0)
      const done = os.filter((o) => o.delivered_at)
      return {
        brand, qty: os.length,
        days: done.length ? done.reduce((s, o) => s + daysBetween(o.entry_date, o.delivered_at!.slice(0, 10)), 0) / done.length : null,
        avg: Math.round(total / os.length), avgCost: Math.round(cost / os.length), avgProfit: Math.round((total - cost) / os.length),
        margin: total ? ((total - cost) / total) * 100 : null,
      }
    }).sort((a, b) => b.qty - a.qty || b.avg - a.avg)
    return { cur, prev, series, mix, brandRows, n }
  }, [data, range])

  if (!data || !m) return <Loading />
  const kpis = [
    { label: 'Vendas (serviços abertos)', value: compact(m.cur.sales), cur: m.cur.sales, prev: m.prev.sales },
    { label: 'Recebido', value: compact(m.cur.received), cur: m.cur.received, prev: m.prev.received },
    { label: 'Serviços', value: String(m.cur.count), cur: m.cur.count, prev: m.prev.count },
    { label: 'Ticket médio', value: compact(m.cur.ticket), cur: m.cur.ticket, prev: m.prev.ticket },
    { label: 'Orçamentos aprovados', value: m.cur.approval === null ? '—' : `${m.cur.approval}%`, cur: m.cur.approval ?? 0, prev: m.prev.approval ?? 0 },
    { label: 'Clientes novos', value: String(m.cur.newCustomers), cur: m.cur.newCustomers, prev: m.prev.newCustomers },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Indicadores" subtitle={`Últimos ${m.n} dias comparados aos ${m.n} dias anteriores`} back="/" />
      <Tabs value={range} onChange={setRange} options={[{ value: '7', label: 'Últ. 7 dias' }, { value: '30', label: 'Últ. 30 dias' }, { value: '60', label: 'Últ. 60 dias' }, { value: '90', label: 'Últ. 90 dias' }]} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => <Kpi key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">Vendas por dia</h2>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-chart-1" /> Atual</span>
              <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-slate-400" /> Período anterior</span>
            </div>
          </div>
          <LineChart series={m.series} />
        </Card>
        <Card>
          <h2 className="mb-3 text-[15px] font-bold">Tipo de atendimento</h2>
          <MixBar mix={m.mix} />
        </Card>
      </div>

      <Card className="p-0">
        <h2 className="px-4 pt-4 text-[15px] font-bold">Serviços por marca</h2>
        <p className="px-4 pb-2 text-xs text-slate-500">Tempo médio conta só os carros já entregues. Lucro = valor do serviço − gastos anotados.</p>
        {m.brandRows.length === 0 ? <p className="px-4 pb-4 text-sm text-slate-500">Sem serviços no período.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Marca</th><th className="px-3 py-2.5 text-right">Qtd.</th><th className="px-3 py-2.5 text-right">Tempo méd.</th>
                  <th className="px-3 py-2.5 text-right">Valor méd.</th><th className="px-3 py-2.5 text-right">Gasto méd.</th><th className="px-3 py-2.5 text-right">Lucro méd.</th><th className="px-4 py-2.5 text-right">Margem</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {m.brandRows.map((r) => (
                  <tr key={r.brand} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{r.brand}</td>
                    <td className="px-3 py-2.5 text-right">{r.qty}</td>
                    <td className="px-3 py-2.5 text-right">{r.days === null ? '—' : `${r.days.toFixed(1).replace('.', ',')} dias`}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.avg)}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.avgCost)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{money(r.avgProfit)}</td>
                    <td className="px-4 py-2.5 text-right">{r.margin === null ? '—' : `${r.margin.toFixed(1).replace('.', ',')}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Kpi({ label, value, cur, prev }: { label: string; value: string; cur: number; prev: number }) {
  const pct = prev ? ((cur - prev) / prev) * 100 : null
  const Icon = pct === null || Math.abs(pct) < 0.5 ? Minus : pct > 0 ? ArrowUpRight : ArrowDownRight
  const tone = pct === null || Math.abs(pct) < 0.5 ? 'bg-slate-100 text-slate-600' : pct > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
  return (
    <div className="rounded-2xl bg-card p-3 ring-1 ring-slate-200">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="tnum mt-1 truncate text-xl font-extrabold">{value}</div>
      <span className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${tone}`}>
        <Icon size={13} /> {pct === null ? (cur ? 'novo' : 'sem dados') : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
      </span>
    </div>
  )
}

/** Linha de vendas por dia: atual (cheia) × período anterior (tracejada), com dica ao passar o dedo/mouse. */
function LineChart({ series }: { series: { day: string; cur: number; prev: number }[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 640, H = 220, L = 52, R = 12, T = 12, B = 26
  const max = Math.max(1, ...series.map((s) => Math.max(s.cur, s.prev)))
  const step = niceStep(max / 4)
  const top = Math.ceil(max / step) * step
  const x = (i: number) => L + (series.length === 1 ? 0 : (i / (series.length - 1)) * (W - L - R))
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const path = (k: 'cur' | 'prev') => series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join('')
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const labelEvery = Math.ceil(series.length / 6)
  const empty = series.every((s) => !s.cur && !s.prev)

  const move = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - L) / (W - L - R)) * (series.length - 1))
    setHover(Math.max(0, Math.min(series.length - 1, i)))
  }
  const h = hover !== null ? series[hover] : null

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y" onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)} role="img" aria-label="Gráfico de vendas por dia">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--color-slate-200)" strokeWidth={1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-slate-500)">{t ? compact(t).replace('R$ ', '') : '0'}</text>
          </g>
        ))}
        {series.map((s, i) => i % labelEvery === 0 && (
          <text key={s.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-slate-500)">{s.day.slice(8, 10)}/{s.day.slice(5, 7)}</text>
        ))}
        <path d={path('prev')} fill="none" stroke="var(--color-slate-400)" strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />
        <path d={path('cur')} fill="none" stroke="var(--color-chart-1)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--color-slate-300)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(series[hover].cur)} r={5} fill="var(--color-chart-1)" stroke="var(--color-card)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {empty && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-500">Sem vendas no período.</p>}
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-xl bg-card px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200" style={{ left: `clamp(0px, calc(${(x(hover!) / W) * 100}% - 70px), calc(100% - 150px))` }}>
          <div className="font-bold">{h.day.slice(8, 10)}/{h.day.slice(5, 7)}</div>
          <div className="tnum flex justify-between gap-3"><span className="text-slate-500">Atual</span><strong>{money(h.cur)}</strong></div>
          <div className="tnum flex justify-between gap-3"><span className="text-slate-500">Anterior</span><span>{money(h.prev)}</span></div>
        </div>
      )}
    </div>
  )
}

function niceStep(raw: number) {
  const base = 10 ** Math.floor(Math.log10(Math.max(raw, 1)))
  const f = raw / base
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * base
}

/** Barra 100% com mão de obra, peças e materiais (+ legenda com valores). */
function MixBar({ mix }: { mix: { service: number; part: number; material: number } }) {
  const parts = [
    { label: 'Mão de obra', value: mix.service, color: 'var(--color-chart-1)' },
    { label: 'Peças', value: mix.part, color: 'var(--color-chart-2)' },
    { label: 'Materiais', value: mix.material, color: 'var(--color-chart-3)' },
  ]
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (!total) return <p className="text-sm text-slate-500">Sem serviços no período.</p>
  return (
    <div className="space-y-4">
      <div className="flex h-5 gap-[2px] overflow-hidden rounded-md">
        {parts.filter((p) => p.value).map((p) => <div key={p.label} title={`${p.label}: ${money(p.value)}`} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} />)}
      </div>
      <ul className="space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span className="flex-1">{p.label}</span>
            <span className="tnum text-slate-500">{Math.round((p.value / total) * 100)}%</span>
            <strong className="tnum w-28 text-right">{money(p.value)}</strong>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-slate-500"><BarChart3 size={14} /> Soma dos serviços abertos no período: {money(total)}</p>
    </div>
  )
}
