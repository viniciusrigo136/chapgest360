import { askConfirm } from '../lib/confirm'
import { useState } from 'react'
import { BookOpen, Car, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { KIND_LABEL } from '../components/ItemsEditor'
import { Button, Empty, ErrorBox, Field, Input, Loading, MoneyInput, PageHeader, Select, Sheet } from '../components/ui'
import { useAction, useApp, useLoad } from '../lib/app'
import { db } from '../lib/db'
import { REGIONS, UNITS } from '../lib/defaults'
import { money } from '../lib/format'
import type { CatalogItem, ItemKind } from '../lib/types'

export function Catalog() {
  const { data } = useLoad(() => db.list('catalog_items', { archived_at: null }))
  const { run } = useAction()
  const [edit, setEdit] = useState<Partial<CatalogItem> | null>(null)
  const [q, setQ] = useState('')
  if (!data) return <Loading />
  const list = data.filter((c) => `${c.description} ${c.region ?? ''}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.description.localeCompare(b.description))
  return (
    <div>
      <PageHeader title="Serviços com preço" back="/config" actions={<Button icon={Plus} className="min-h-11" onClick={() => setEdit({ kind: 'service', unit: 'serv', price: 0, description: '' })}>Novo</Button>} />
      <p className="mb-3 text-sm text-slate-600">Ao digitar no orçamento, esses serviços aparecem como sugestão já com o preço. Os serviços que você usa nos orçamentos também aparecem sozinhos.</p>
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="mb-3" />
      {list.length === 0 ? <Empty icon={BookOpen} title="Nenhum serviço cadastrado" text="Ex.: Pintura de para-choque, Polimento completo, Martelinho de ouro." /> : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-card ring-1 ring-slate-200/70">
          {list.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setEdit(c)} className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-slate-50">
                <span><span className="block font-medium">{c.description}</span><span className="text-xs text-slate-500">{KIND_LABEL[c.kind]}{c.region ? ` • ${c.region}` : ''} • {c.unit}</span></span>
                <strong>{money(c.price)}</strong>
              </button>
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title={edit.id ? 'Editar item' : 'Novo item'}>
          <Field label="Tipo">
            <Select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as ItemKind })}>
              {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          <Field label="Descrição"><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peça/região">
              <Select value={edit.region ?? ''} onChange={(e) => setEdit({ ...edit, region: e.target.value || undefined })}>
                <option value="">—</option>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Unidade">
              <Select value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select>
            </Field>
          </div>
          <Field label="Preço"><MoneyInput value={edit.price ?? 0} onChange={(v) => setEdit({ ...edit, price: v })} /></Field>
          <Button className="w-full" disabled={!edit.description?.trim()} onClick={async () => {
            const r = await run(() => (edit.id ? db.update('catalog_items', edit.id, edit) : db.insert('catalog_items', edit as CatalogItem)), 'Salvo')
            if (r) setEdit(null)
          }}>Salvar</Button>
          {edit.id && <Button variant="danger" className="w-full" onClick={async () => { if (await askConfirm('Excluir do catálogo?', 'Excluir')) { await run(() => db.remove('catalog_items', edit.id!)); setEdit(null) } }}>Excluir</Button>}
        </Sheet>
      )}
    </div>
  )
}

export function Login() {
  const { reloadSession } = useApp()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    setErr('')
    setBusy(true)
    try {
      if (mode === 'in') {
        await db.signIn(email.trim(), pw)
        await reloadSession()
      } else {
        await db.signUp(email.trim(), pw)
        const s = await db.getSession()
        if (s) await reloadSession()
        else setInfo('Conta criada. Confirme o e-mail que enviamos e depois entre.')
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30"><Car size={34} /></span>
      <h1 className="text-center text-3xl font-extrabold tracking-tight">Lataria</h1>
      <p className="-mt-2 text-center text-sm text-slate-500">Orçamentos e serviços de funilaria e pintura, direto do celular</p>
      <Field label="E-mail"><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Senha"><Input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
      {err && <ErrorBox message={err} />}
      {info && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{info}</p>}
      <Button disabled={busy || !email || pw.length < 6} onClick={submit}>{mode === 'in' ? 'Entrar' : 'Criar conta'}</Button>
      <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'Ainda não tem conta? Criar conta' : 'Já tenho conta'}
      </button>
    </div>
  )
}

export function CreateOrganization() {
  const { reloadSession } = useApp()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Qual o nome da sua oficina?</h1>
      <p className="-mt-2 text-sm text-slate-500">Ele aparece nos orçamentos e na página que o cliente recebe.</p>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      {err && <ErrorBox message={err} />}
      <Button disabled={name.trim().length < 2} onClick={async () => {
        try {
          await db.createOrganization(name.trim())
          await reloadSession()
          nav('/config')
        } catch (e) {
          setErr((e as Error).message)
        }
      }}>Continuar</Button>
    </div>
  )
}
