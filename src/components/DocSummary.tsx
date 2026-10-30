import { Link } from 'react-router-dom'
import { insuranceSplit, itemSubtotal } from '../lib/calc'
import { PAYMENT_METHODS } from '../lib/defaults'
import { money, phone, plate } from '../lib/format'
import { vehicleLabel } from '../lib/share'
import type { Customer, DocCommon, Vehicle } from '../lib/types'
import { KIND_LABEL } from './ItemsEditor'
import { Card } from './ui'

export function PartiesCard({ customer, vehicle }: { customer?: Customer | null; vehicle?: Vehicle | null }) {
  return (
    <Card className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Cliente</div>
        {customer ? <Link to={`/clientes/${customer.id}`} className="font-semibold text-blue-700">{customer.name}</Link> : '—'}
        <div className="text-slate-600">{phone(customer?.phone)}</div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Veículo</div>
        <div className="font-semibold">{plate(vehicle?.plate)}</div>
        <div className="text-slate-600">{vehicleLabel(vehicle)} {vehicle?.year}</div>
      </div>
    </Card>
  )
}

export function ItemsSummary({ doc }: { doc: DocCommon }) {
  const split = insuranceSplit(doc.total, doc.insurance)
  return (
    <Card className="space-y-2 text-sm">
      {doc.simple ? (
        <p className="whitespace-pre-wrap">{doc.simple_description}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {doc.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2 py-2">
              <span>
                {i.description}
                <span className="block text-xs text-slate-500">{KIND_LABEL[i.kind]}{i.region ? ` • ${i.region}` : ''} • {i.qty} {i.unit} × {money(i.unit_price)}</span>
              </span>
              <span className="font-medium">{money(itemSubtotal(i))}</span>
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
        <p className="text-xs text-slate-600">Pagamento: {doc.payment_terms.methods.map((m) => PAYMENT_METHODS[m]).join(', ')}{doc.payment_terms.installments > 1 ? ` • até ${doc.payment_terms.installments}x` : ''}</p>
      )}
    </Card>
  )
}

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex justify-between ${strong ? 'text-base font-bold' : ''}`}>
    <span>{label}</span>
    <span>{value}</span>
  </div>
)
