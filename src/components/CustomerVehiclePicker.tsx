import { useMemo, useState } from 'react'
import { useLoad } from '../lib/app'
import { db } from '../lib/db'
import { digits, normalizePlate, phone, plate } from '../lib/format'
import { vehicleLabel } from '../lib/share'
import type { Customer, Vehicle } from '../lib/types'
import { CustomerForm, VehicleForm } from './CustomerForm'
import { Button, Input, Sheet } from './ui'

type Step = 'search' | 'new-customer' | 'vehicle' | 'new-vehicle'

export function CustomerVehiclePicker({ customerId, vehicleId, onChange }: {
  customerId?: string; vehicleId?: string; onChange: (customerId: string, vehicleId: string) => void
}) {
  const { data } = useLoad(async () => {
    const [customers, vehicles] = await Promise.all([db.list('customers', { archived_at: null }), db.list('vehicles', { archived_at: null })])
    return { customers, vehicles }
  })
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('search')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Customer | null>(null)

  const customer = data?.customers.find((c) => c.id === customerId)
  const vehicle = data?.vehicles.find((v) => v.id === vehicleId)

  const results = useMemo(() => {
    if (!data) return []
    const term = q.trim().toLowerCase()
    const tplate = normalizePlate(q)
    const tdig = digits(q)
    return data.customers
      .map((c) => ({ c, vs: data.vehicles.filter((v) => v.customer_id === c.id) }))
      .filter(({ c, vs }) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        (tdig.length >= 4 && digits(c.phone).includes(tdig)) ||
        (tplate.length >= 3 && vs.some((v) => v.plate.includes(tplate))) ||
        vs.some((v) => `${v.brand ?? ''} ${v.model ?? ''}`.toLowerCase().includes(term)),
      )
      .slice(0, 30)
  }, [data, q])

  const start = () => {
    setStep('search')
    setQ('')
    setPicked(null)
    setOpen(true)
  }
  const pickCustomer = (c: Customer) => {
    setPicked(c)
    const vs = data?.vehicles.filter((v) => v.customer_id === c.id) ?? []
    setStep(vs.length ? 'vehicle' : 'new-vehicle')
  }
  const finish = (v: Vehicle) => {
    onChange(v.customer_id, v.id)
    setOpen(false)
  }

  return (
    <>
      <button type="button" onClick={start} className="flex min-h-16 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left active:bg-slate-50">
        {customer ? (
          <div>
            <div className="font-semibold text-slate-900">{customer.name}</div>
            <div className="text-sm text-slate-600">
              {vehicle ? `${vehicleLabel(vehicle)} • ${plate(vehicle.plate)}` : 'Escolha o veículo'}
            </div>
          </div>
        ) : (
          <span className="font-semibold text-blue-700">Escolher cliente e veículo *</span>
        )}
        <span className="text-slate-400">›</span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={step === 'new-customer' ? 'Novo cliente' : step === 'search' ? 'Cliente' : `Veículo de ${picked?.name}`}>
        {step === 'search' && (
          <>
            <Input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, telefone ou placa" />
            <Button className="w-full" variant="secondary" onClick={() => setStep('new-customer')}>
              + Novo cliente
            </Button>
            <ul className="divide-y divide-slate-100">
              {results.map(({ c, vs }) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pickCustomer(c)} className="w-full py-3 text-left active:bg-slate-50">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-sm text-slate-600">
                      {[phone(c.phone), vs.map((v) => plate(v.plate)).join(', ')].filter(Boolean).join(' • ') || 'Sem veículo'}
                    </div>
                  </button>
                </li>
              ))}
              {data && results.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Nenhum cliente encontrado.</li>}
            </ul>
          </>
        )}
        {step === 'new-customer' && <CustomerForm onSaved={(c) => { setPicked(c); setStep('new-vehicle') }} />}
        {step === 'vehicle' && picked && (
          <>
            <ul className="divide-y divide-slate-100">
              {data?.vehicles.filter((v) => v.customer_id === picked.id).map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => finish(v)} className="w-full py-3 text-left active:bg-slate-50">
                    <div className="font-semibold">{plate(v.plate)}</div>
                    <div className="text-sm text-slate-600">{vehicleLabel(v)}</div>
                  </button>
                </li>
              ))}
            </ul>
            <Button className="w-full" variant="secondary" onClick={() => setStep('new-vehicle')}>
              + Outro veículo
            </Button>
          </>
        )}
        {step === 'new-vehicle' && picked && <VehicleForm customerId={picked.id} onSaved={finish} />}
      </Sheet>
    </>
  )
}
