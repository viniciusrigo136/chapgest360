import type { Cents, DocCommon, DocItem, Insurance, Payment } from './types'

export const itemSubtotal = (i: Pick<DocItem, 'qty' | 'unit_price'>) => Math.round(i.qty * i.unit_price)

type TotalsInput = Pick<DocCommon, 'simple' | 'simple_total' | 'items' | 'discount' | 'surcharge'>

/** Mesma regra do trigger `compute_doc_totals` no banco. */
export function computeTotals(d: TotalsInput): { subtotal: Cents; total: Cents } {
  const subtotal = d.simple ? Math.max(0, d.simple_total ?? 0) : d.items.reduce((s, i) => s + itemSubtotal(i), 0)
  const total = Math.max(0, subtotal - (d.discount || 0) + (d.surcharge || 0))
  return { subtotal, total }
}

export function insuranceSplit(total: Cents, ins?: Insurance | null) {
  if (!ins) return { customer: total, insurer: 0 }
  const customer = Math.min(Math.max(0, ins.customer_pays), total)
  return { customer, insurer: total - customer }
}

/** Parcelas com taxa simples (%) sobre o valor parcelado. A última absorve o arredondamento. */
export function installments(amount: Cents, n: number, feePercent = 0) {
  if (n <= 1) return { total: amount, values: [amount] }
  const total = Math.round(amount * (1 + feePercent / 100))
  const base = Math.floor(total / n)
  const values = Array.from({ length: n }, (_, i) => (i === n - 1 ? total - base * (n - 1) : base))
  return { total, values }
}

export const activePayments = (ps: Payment[]) => ps.filter((p) => !p.reversed_at)

export function balance(total: Cents, ps: Payment[]) {
  const paid = activePayments(ps).reduce((s, p) => s + p.amount, 0)
  return { paid, due: Math.max(0, total - paid) }
}
