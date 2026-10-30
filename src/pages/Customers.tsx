import { askConfirm } from '../lib/confirm'
import { Car, FilePlus2, Plus, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CustomerForm, VehicleForm } from '../components/CustomerForm'
import { Thumb } from '../components/PhotoManager'
import { Badge, Button, Card, Empty, ErrorBox, LinkButton, Loading, PageHeader, Plate, RowLink, SearchInput, Section, Sheet } from '../components/ui'
import { useAction, useLoad } from '../lib/app'
import { balance } from '../lib/calc'
import { db } from '../lib/db'
import { QUOTE_STATUS } from '../lib/defaults'
import { date, digits, documentFmt, money, normalizePlate, phone } from '../lib/format'
import { vehicleLabel, whatsappUrl } from '../lib/share'

export function CustomerList() {
  const nav = useNavigate()
  const { data } = useLoad(async () => {
    const [customers, vehicles] = await Promise.all([db.list('customers', { archived_at: null }), db.list('vehicles', { archived_at: null })])
    return { customers: customers.sort((a, b) => a.name.localeCompare(b.name)), vehicles }
  })
  const [q, setQ] = useState('')
  const [params] = useSearchParams()
  const [adding, setAdding] = useState(params.get('novo') === '1')
  const list = useMemo(() => {
    if (!data) return []
    const t = q.trim().toLowerCase(), p = normalizePlate(q), d = digits(q)
    return data.customers.filter((c) => !t || c.name.toLowerCase().includes(t) || (d.length >= 4 && digits(c.phone).includes(d)) ||
      (p.length >= 3 && data.vehicles.some((v) => v.customer_id === c.id && v.plate.includes(p))))
  }, [data, q])
  if (!data) return <Loading />
  return (
    <div>
      <PageHeader title="Clientes" actions={<Button icon={UserPlus} className="min-h-11" onClick={() => setAdding(true)}>Novo</Button>} />
      <SearchInput value={q} onChange={setQ} placeholder="Nome, telefone ou placa" />
      {list.length === 0 ? <Empty icon={Users} title={data.customers.length ? 'Nada encontrado' : 'Nenhum cliente ainda'} text="Você também pode cadastrar o cliente na hora de fazer o orçamento." /> : (
        <ul className="space-y-2">
          {list.map((c) => {
            const vs = data.vehicles.filter((v) => v.customer_id === c.id)
            return (
              <li key={c.id}>
                <RowLink to={`/clientes/${c.id}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 font-extrabold text-brand-700">{c.name.trim()[0]?.toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{c.name}</div>
                      <div className="text-xs text-slate-500">{phone(c.phone) || 'Sem telefone'}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">{vs.slice(0, 2).map((v) => <Plate key={v.id} value={v.plate} size="sm" />)}</div>
                  </div>
                </RowLink>
              </li>
            )
          })}
        </ul>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Novo cliente">
        <CustomerForm onSaved={(c) => nav(`/clientes/${c.id}`)} />
      </Sheet>
    </div>
  )
}

export function CustomerDetail() {
  const { id } = useParams() as { id: string }
  const nav = useNavigate()
  const { run } = useAction()
  const [editing, setEditing] = useState(false)
  const [addVehicle, setAddVehicle] = useState(false)
  const { data, error } = useLoad(async () => {
    const c = await db.get('customers', id)
    if (!c) throw new Error('Cliente não encontrado')
    const [vehicles, quotes, orders, payments] = await Promise.all([
      db.list('vehicles', { customer_id: id }), db.list('quotes', { customer_id: id }), db.list('work_orders', { customer_id: id }), db.list('payments', { customer_id: id }),
    ])
    return { c, vehicles, quotes, orders, payments }
  }, [id])
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const { c, vehicles, quotes, orders, payments } = data
  const due = orders.filter((o) => !o.archived_at).reduce((s, o) => s + balance(o.total, payments.filter((p) => p.work_order_id === o.id)).due, 0)

  return (
    <div className="space-y-4">
      <PageHeader title={c.name} back="/clientes" actions={<Button variant="secondary" onClick={() => setEditing(true)}>Editar</Button>} />
      <Card className="space-y-1 text-sm">
        {c.phone && <div>Telefone: <a href={`tel:${c.phone}`} className="font-semibold text-brand-700">{phone(c.phone)}</a></div>}
        {c.document && <div>CPF/CNPJ: {documentFmt(c.document)}</div>}
        {c.email && <div>E-mail: {c.email}</div>}
        {c.address && <div>Endereço: {c.address}</div>}
        {c.notes && <div className="text-slate-600">{c.notes}</div>}
        <div>Saldo em aberto: <strong className={due ? 'text-amber-800' : ''}>{money(due)}</strong></div>
        {(c.whatsapp || c.phone) && <a href={whatsappUrl(c.whatsapp || c.phone, '')} target="_blank" rel="noreferrer" className="mt-2 flex min-h-11 items-center justify-center rounded-lg bg-green-600 font-bold text-white">WhatsApp</a>}
      </Card>

      <Section title="Carros" icon={Car} right={<Button variant="ghost" icon={Plus} className="min-h-10 px-2" onClick={() => setAddVehicle(true)}>Carro</Button>}>
        {vehicles.length === 0 ? <p className="text-sm text-slate-500">Nenhum carro cadastrado.</p> : (
          <ul className="divide-y divide-slate-100">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-2.5">
                <Link to={`/veiculos/${v.id}`} className="flex min-w-0 flex-1 items-center gap-3"><Plate value={v.plate} size="sm" /><span className="truncate text-sm font-semibold">{vehicleLabel(v)}</span></Link>
                <LinkButton variant="ghost" icon={FilePlus2} className="min-h-10 px-2" to={`/orcamentos/novo?cliente=${c.id}&veiculo=${v.id}`}>Orçar</LinkButton>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Histórico">
        {quotes.length + orders.length === 0 ? <p className="text-sm text-slate-500">Nenhum serviço ainda.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {orders.map((o) => <li key={o.id}><Link to={`/os/${o.id}`} className="flex justify-between py-2"><span>{o.number} • {date(o.entry_date)}</span><strong>{money(o.total)}</strong></Link></li>)}
            {quotes.map((q) => <li key={q.id}><Link to={`/orcamentos/${q.id}`} className="flex justify-between py-2"><span>{q.number} • {date(q.created_at)} <Badge className={QUOTE_STATUS[q.status].cls}>{QUOTE_STATUS[q.status].label}</Badge></span><strong>{money(q.total)}</strong></Link></li>)}
          </ul>
        )}
      </Section>

      <Button variant="danger" className="w-full" onClick={async () => await askConfirm('Arquivar este cliente? Ele some das buscas, mas o histórico é mantido.') && run(() => db.update('customers', c.id, { archived_at: new Date().toISOString() }), 'Cliente arquivado').then(() => nav('/clientes'))}>
        Arquivar cliente
      </Button>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Editar cliente"><CustomerForm initial={c} onSaved={() => setEditing(false)} /></Sheet>
      <Sheet open={addVehicle} onClose={() => setAddVehicle(false)} title="Novo veículo"><VehicleForm customerId={c.id} onSaved={() => setAddVehicle(false)} /></Sheet>
    </div>
  )
}

export function VehicleDetail() {
  const { id } = useParams() as { id: string }
  const [editing, setEditing] = useState(false)
  const { data, error } = useLoad(async () => {
    const v = await db.get('vehicles', id)
    if (!v) throw new Error('Veículo não encontrado')
    const [customer, quotes, orders, photos] = await Promise.all([db.get('customers', v.customer_id), db.list('quotes', { vehicle_id: id }), db.list('work_orders', { vehicle_id: id }), db.list('photos', { vehicle_id: id })])
    return { v, customer, quotes, orders, photos }
  }, [id])
  if (error) return <ErrorBox message={error} />
  if (!data) return <Loading />
  const { v, customer, quotes, orders, photos } = data
  return (
    <div className="space-y-4">
      <PageHeader title={<Plate value={v.plate} size="lg" />} back={`/clientes/${v.customer_id}`} actions={<Button variant="secondary" onClick={() => setEditing(true)}>Editar</Button>} />
      <Card className="space-y-1 text-sm">
        <div className="text-base font-semibold">{vehicleLabel(v)} {v.year}</div>
        <div>Proprietário: <Link className="font-semibold text-brand-700" to={`/clientes/${v.customer_id}`}>{customer?.name}</Link></div>
        {v.km ? <div>Km: {v.km.toLocaleString('pt-BR')}</div> : null}
        {v.paint_code && <div>Cód. cor: {v.paint_code}</div>}
        {v.vin && <div>Chassi: {v.vin}</div>}
        {v.notes && <div className="text-slate-600">{v.notes}</div>}
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <LinkButton to={`/orcamentos/novo?cliente=${v.customer_id}&veiculo=${v.id}`}>+ Orçamento</LinkButton>
        <LinkButton variant="secondary" to={`/os/nova?cliente=${v.customer_id}&veiculo=${v.id}`}>+ OS</LinkButton>
      </div>
      <Section title="Serviços">
        <ul className="divide-y divide-slate-100 text-sm">
          {orders.map((o) => <li key={o.id}><Link to={`/os/${o.id}`} className="flex justify-between py-2"><span>{o.number} • {date(o.entry_date)}</span><strong>{money(o.total)}</strong></Link></li>)}
          {quotes.map((q) => <li key={q.id}><Link to={`/orcamentos/${q.id}`} className="flex justify-between py-2"><span>{q.number} • {date(q.created_at)}</span><strong>{money(q.total)}</strong></Link></li>)}
        </ul>
        {orders.length + quotes.length === 0 && <p className="text-sm text-slate-500">Nenhum serviço ainda.</p>}
      </Section>
      <Section title={`Fotos (${photos.length})`}>
        {photos.length === 0 ? <p className="text-sm text-slate-500">As fotos dos orçamentos e OS aparecem aqui.</p> : (
          <div className="grid grid-cols-3 gap-2">{photos.map((p) => <Thumb key={p.id} path={p.path} className="aspect-square w-full rounded-lg" />)}</div>
        )}
      </Section>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Editar veículo"><VehicleForm customerId={v.customer_id} initial={v} onSaved={() => setEditing(false)} /></Sheet>
    </div>
  )
}
