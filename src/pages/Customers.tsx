import { askConfirm } from '../lib/confirm'
import { Building2, Cake, Car, FilePlus2, FileSpreadsheet, Plus, UserPlus, UserRound, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CustomerForm, VehicleForm } from '../components/CustomerForm'
import { Thumb } from '../components/PhotoManager'
import { WaIcon } from '../components/ShareBox'
import { Badge, Button, Card, Empty, ErrorBox, Input, LinkButton, Loading, PageHeader, Plate, Section, Select, Sheet } from '../components/ui'
import { useAction, useLoad } from '../lib/app'
import { balance } from '../lib/calc'
import { db } from '../lib/db'
import { QUOTE_STATUS } from '../lib/defaults'
import { date, digits, documentFmt, money, normalizePlate, phone, today } from '../lib/format'
import { vehicleLabel, whatsappUrl } from '../lib/share'
import type { Customer, Vehicle } from '../lib/types'

type Tipo = 'todos' | 'pf' | 'pj'
const tipoOf = (doc?: string) => (digits(doc).length === 14 ? 'pj' : 'pf')

/** Exporta a lista para CSV (abre no Excel em português). */
function exportCsv(rows: { c: Customer; vs: Vehicle[] }[]) {
  const head = ['Nome', 'Tipo', 'CPF/CNPJ', 'Celular', 'E-mail', 'Cidade', 'Origem', 'Placas', 'Cadastro']
  const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
  const lines = rows.map(({ c, vs }) => [c.name, tipoOf(c.document) === 'pj' ? 'PJ' : 'PF', documentFmt(c.document), phone(c.phone), c.email ?? '', c.city ?? '', c.source ?? '', vs.map((v) => v.plate).join(' '), date(c.created_at)].map(esc).join(';'))
  const blob = new Blob(['\ufeff' + [head.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `clientes-${today()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function CustomerList() {
  const nav = useNavigate()
  const { data } = useLoad(async () => {
    const [customers, vehicles] = await Promise.all([db.list('customers', { archived_at: null }), db.list('vehicles', { archived_at: null })])
    return { customers: customers.sort((a, b) => a.name.localeCompare(b.name)), vehicles }
  })
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState<Tipo>('todos')
  const [origem, setOrigem] = useState('')
  const [bday, setBday] = useState(false)
  const [params] = useSearchParams()
  const [adding, setAdding] = useState(params.get('novo') === '1')

  const rows = useMemo(() => (data?.customers ?? []).map((c) => ({ c, vs: data!.vehicles.filter((v) => v.customer_id === c.id) })), [data])
  const list = useMemo(() => {
    const t = q.trim().toLowerCase(), p = normalizePlate(q), d = digits(q)
    const month = today().slice(5, 7)
    return rows.filter(({ c, vs }) =>
      (tipo === 'todos' || tipoOf(c.document) === tipo) &&
      (!origem || c.source === origem) &&
      (!bday || c.birth_date?.slice(5, 7) === month) &&
      (!t || c.name.toLowerCase().includes(t) || (c.email ?? '').toLowerCase().includes(t) || (c.city ?? '').toLowerCase().includes(t) ||
        (d.length >= 4 && (digits(c.phone).includes(d) || digits(c.document).includes(d))) ||
        (p.length >= 3 && vs.some((v) => v.plate.includes(p)))))
  }, [rows, q, tipo, origem, bday])

  if (!data) return <Loading />
  const month = today().slice(0, 7)
  const stats = [
    { label: 'Total', value: rows.length, icon: Users, cls: 'bg-slate-100 text-slate-600' },
    { label: 'Pessoa física', value: rows.filter((r) => tipoOf(r.c.document) === 'pf').length, icon: UserRound, cls: 'bg-brand-50 text-brand-600' },
    { label: 'Pessoa jurídica', value: rows.filter((r) => tipoOf(r.c.document) === 'pj').length, icon: Building2, cls: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300' },
    { label: 'Novos este mês', value: rows.filter((r) => r.c.created_at.slice(0, 7) === month).length, icon: UserPlus, cls: 'bg-emerald-50 text-emerald-700' },
  ]
  const origins = [...new Set(rows.map((r) => r.c.source).filter(Boolean))] as string[]
  const wa = (c: Customer) => c.whatsapp || c.phone

  return (
    <div className="space-y-4">
      <PageHeader title="Clientes" actions={
        <div className="flex gap-2">
          <Button variant="secondary" icon={FileSpreadsheet} className="hidden min-h-11 sm:inline-flex" onClick={() => exportCsv(list)} disabled={!list.length}>Gerar Excel</Button>
          <Button icon={UserPlus} className="min-h-11" onClick={() => setAdding(true)}>Novo</Button>
        </div>
      } />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map((st) => (
          <div key={st.label} className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-slate-200/70">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${st.cls}`}><st.icon size={20} /></span>
            <span><span className="tnum block text-xl font-extrabold leading-tight">{st.value}</span><span className="block text-xs text-slate-500">{st.label}</span></span>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-slate-200/70">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, CPF/CNPJ, telefone, e-mail, cidade ou placa" />
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} aria-label="Tipo">
            <option value="todos">Todos os tipos</option>
            <option value="pf">Pessoa física</option>
            <option value="pj">Pessoa jurídica</option>
          </Select>
          <Select value={origem} onChange={(e) => setOrigem(e.target.value)} aria-label="Por onde nos encontrou">
            <option value="">Todas as origens</option>
            {origins.map((o) => <option key={o}>{o}</option>)}
          </Select>
          <label className="col-span-2 flex min-h-11 items-center gap-2 px-1 text-sm lg:col-span-1">
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={bday} onChange={(e) => setBday(e.target.checked)} />
            <Cake size={17} className="text-slate-400" /> Aniversariantes do mês
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Lista de clientes</span>
        <span>{list.length} registro(s)</span>
      </div>

      {list.length === 0 ? <Empty icon={Users} title={rows.length ? 'Nada encontrado' : 'Nenhum cliente ainda'} text="Você também pode cadastrar o cliente na hora de fazer o orçamento." /> : (
        <>
          {/* Celular: cartões */}
          <ul className="space-y-2 lg:hidden">
            {list.map(({ c, vs }) => (
              <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-card p-3 ring-1 ring-slate-200/70">
                <Link to={`/clientes/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 font-extrabold text-brand-700">{c.name.trim()[0]?.toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{c.name}</span>
                    <span className="block truncate text-xs text-slate-500">{[phone(c.phone), c.city].filter(Boolean).join(' • ') || 'Sem telefone'}</span>
                    {vs.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{vs.slice(0, 3).map((v) => <Plate key={v.id} value={v.plate} size="sm" />)}</span>}
                  </span>
                </Link>
                {wa(c) && <a href={whatsappUrl(wa(c), '')} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wa text-white"><WaIcon /></a>}
              </li>
            ))}
          </ul>

          {/* Computador: tabela */}
          <div className="hidden overflow-x-auto rounded-2xl bg-card ring-1 ring-slate-200/70 lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Nome</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Celular</th><th className="px-3 py-3">Cidade</th><th className="px-3 py-3">Carros</th><th className="px-3 py-3">Origem</th><th className="px-4 py-3 text-right">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {list.map(({ c, vs }) => (
                  <tr key={c.id} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50" onClick={() => nav(`/clientes/${c.id}`)}>
                    <td className="px-4 py-2.5 font-semibold"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />{c.name}</td>
                    <td className="px-3 py-2.5"><Badge className={tipoOf(c.document) === 'pj' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' : 'bg-brand-50 text-brand-700'}>{tipoOf(c.document) === 'pj' ? 'PJ' : 'PF'}</Badge></td>
                    <td className="tnum px-3 py-2.5">{phone(c.phone) || '—'}</td>
                    <td className="px-3 py-2.5">{c.city || '—'}</td>
                    <td className="px-3 py-2.5"><span className="flex flex-wrap gap-1">{vs.slice(0, 2).map((v) => <Plate key={v.id} value={v.plate} size="sm" />)}{vs.length > 2 && <span className="text-xs text-slate-500">+{vs.length - 2}</span>}</span></td>
                    <td className="px-3 py-2.5 text-slate-500">{c.source || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {wa(c) ? <a href={whatsappUrl(wa(c), '')} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="WhatsApp" className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-wa text-white"><WaIcon size={18} /></a> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="secondary" icon={FileSpreadsheet} className="w-full sm:hidden" onClick={() => exportCsv(list)}>Gerar Excel da lista</Button>
        </>
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
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={c.name} back="/clientes" actions={<Button variant="secondary" onClick={() => setEditing(true)}>Editar</Button>} />
      <Card className="space-y-1 text-sm">
        {c.phone && <div>Telefone: <a href={`tel:${c.phone}`} className="font-semibold text-brand-700">{phone(c.phone)}</a></div>}
        {c.document && <div>CPF/CNPJ: {documentFmt(c.document)}</div>}
        {c.email && <div>E-mail: {c.email}</div>}
        {c.address && <div>Endereço: {c.address}</div>}
        {c.city && <div>Cidade: {c.city}</div>}
        {c.birth_date && <div>Aniversário: {date(c.birth_date).slice(0, 5)}</div>}
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
        {v.fuel && <div>Combustível: {v.fuel}</div>}
        {v.renavam && <div>Renavam: {v.renavam}</div>}
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
