import { Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { insuranceSplit, itemSubtotal } from '../lib/calc'
import { PAYMENT_METHODS } from '../lib/defaults'
import { money, phone } from '../lib/format'
import { vehicleLabel } from '../lib/share'
import type { Customer, DocCommon, Vehicle } from '../lib/types'
import { Card, Plate } from './ui'

/** Cabeçalho do documento: placa, carro e cliente, com o total em destaque. */
export function DocHero({ customer, vehicle, total, label, extra }: { customer?: Customer | null; vehicle?: Vehicle | null; total: number; label: string; extra?: React.ReactNode }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <Plate value={vehicle?.plate} size="lg" />
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold leading-tight">{vehicleLabel(vehicle)}</div>
          <div className="text-sm text-slate-500">{vehicle?.year}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="min-w-0">
          {customer ? <Link to={`/clientes/${customer.id}`} className="block truncate font-bold text-brand-700">{customer.name}</Link> : '—'}
          {customer?.phone && <span className="flex items-center gap-1 text-sm text-slate-500"><Phone size={13} /> {phone(customer.phone)}</span>}
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="tnum text-2xl font-extrabold">{money(total)}</div>
        </div>
      </div>
      {extra}
    </Card>
  )
}

export function ItemsSummary({ doc }: { doc: DocCommon }) {
  const split = insuranceSplit(doc.total, doc.insurance)
  return (
    <div className="space-y-2 text-sm">
      {doc.simple ? (
        <p className="whitespace-pre-wrap">{doc.simple_description}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {doc.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2.5">
              <span>
                <span className="font-medium">{i.description}</span>
                {(i.qty !== 1 || i.region) && <span className="block text-xs text-slate-500">{[i.region, i.qty !== 1 ? `${String(i.qty).replace('.', ',')} ${i.unit} × ${money(i.unit_price)}` : ''].filter(Boolean).join(' • ')}</span>}
              </span>
              <span className="tnum font-semibold">{money(itemSubtotal(i))}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1 border-t border-slate-200 pt-2">
        {(doc.discount > 0 || doc.surcharge > 0) && <Row label="Subtotal" value={money(doc.subtotal)} />}
        {doc.discount > 0 && <Row label="Desconto" value={`− ${money(doc.discount)}`} />}
        {doc.surcharge > 0 && <Row label="Acréscimo" value={money(doc.surcharge)} />}
        <Row label="Total" value={money(doc.total)} strong />
        {doc.insurance && (
          <>
            <Row label={`Seguradora (${doc.insurance.insurer})`} value={money(split.insurer)} />
            <Row label="Cliente paga" value={money(split.customer)} />
            {doc.insurance.claim_number && <Row label="Sinistro" value={doc.insurance.claim_number} />}
          </>
        )}
      </div>
      {doc.payment_terms.methods.length > 0 && (
        <p className="text-xs text-slate-500">Pagamento: {doc.payment_terms.methods.map((m) => PAYMENT_METHODS[m]).join(', ')}{doc.payment_terms.installments > 1 ? ` • até ${doc.payment_terms.installments}x` : ''}</p>
      )}
    </div>
  )
}

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex justify-between ${strong ? 'text-base font-extrabold' : 'text-slate-600'}`}>
    <span>{label}</span>
    <span className="tnum">{value}</span>
  </div>
)
