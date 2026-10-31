import { ChevronRight, Plus, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLoad } from '../lib/app'
import { db } from '../lib/db'
import { digits, normalizePlate, phone } from '../lib/format'
import { vehicleLabel } from '../lib/share'
import type { Customer, Vehicle } from '../lib/types'
import { CustomerForm, VehicleForm } from './CustomerForm'
import { Button, Input, Plate, Sheet } from './ui'

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
      <button type="button" onClick={start} className={`flex min-h-18 w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-[0_1px_2px_rgba(19,32,58,0.06)] active:bg-slate-50 ${customer ? 'ring-1 ring-slate-200' : 'ring-2 ring-brand-500'}`}>
        {customer ? (
          <>
            {vehicle ? <Plate value={vehicle.plate} /> : <UserRound className="text-slate-400" />}
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{customer.name}</div>
              <div className="truncate text-sm text-slate-500">{vehicle ? vehicleLabel(vehicle) : 'Escolha o carro'}</div>
            </div>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><UserRound size={22} /></span>
            <span className="flex-1">
              <span className="block font-bold text-brand-700">Escolher cliente e carro</span>
              <span className="block text-sm text-slate-500">Busque pelo nome ou placa</span>
            </span>
          </>
        )}
        <ChevronRight size={20} className="text-slate-400" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={step === 'new-customer' ? 'Novo cliente' : step === 'search' ? 'Qual cliente?' : `Carro de ${picked?.name.split(' ')[0]}`}>
        {step === 'search' && (
          <>
            <Input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, telefone ou placa" />
            <Button className="w-full" variant="secondary" icon={Plus} onClick={() => setStep('new-customer')}>
              Novo cliente
            </Button>
            <ul className="divide-y divide-slate-100">
              {results.map(({ c, vs }) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pickCustomer(c)} className="w-full py-3 text-left active:bg-slate-50">
                    <div className="font-semibold">{c.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                      {vs.map((v) => <Plate key={v.id} value={v.plate} size="sm" />)}
                      <span>{phone(c.phone) || (vs.length ? '' : 'Sem carro')}</span>
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
                  <button type="button" onClick={() => finish(v)} className="flex w-full items-center gap-3 py-3 text-left active:bg-slate-50">
                    <Plate value={v.plate} />
                    <span className="font-semibold">{vehicleLabel(v)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Button className="w-full" variant="secondary" icon={Plus} onClick={() => setStep('new-vehicle')}>
              Outro carro
            </Button>
          </>
        )}
        {step === 'new-vehicle' && picked && <VehicleForm customerId={picked.id} onSaved={finish} />}
      </Sheet>
    </>
  )
}
