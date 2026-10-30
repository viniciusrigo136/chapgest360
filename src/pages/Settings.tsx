import { BookOpen, Building2, ChevronRight, CreditCard, FileText, ImagePlus, ListOrdered, LogOut, MapPin, MessageCircle, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { askConfirm } from '../lib/confirm'
import { Thumb } from '../components/PhotoManager'
import { Button, Card, Collapsible, Field, Input, Loading, MoneyInput, PageHeader, TextArea } from '../components/ui'
import { useAction, useApp } from '../lib/app'
import { db, filePath } from '../lib/db'
import { digits, isValidDocument } from '../lib/format'
import { compressImage } from '../lib/image'
import type { Settings as S, Stage } from '../lib/types'

const SYSTEM_STAGES = ['recebido', 'pronto', 'entregue']

export default function Settings() {
  const { settings, saveSettings, session, reloadSession } = useApp()
  const { busy, run } = useAction()
  const [s, setS] = useState<S | null>(settings)
  const logoRef = useRef<HTMLInputElement>(null)
  if (!s) return <Loading />
  const set = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v })
  const text = (k: keyof S, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label}>
      <Input value={(s[k] as string) ?? ''} onChange={(e) => set(k, e.target.value as never)} {...props} />
    </Field>
  )

  async function fillCep() {
    const cep = digits(s!.zip)
    if (cep.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((x) => x.json())
      if (!r.erro) setS((x) => ({ ...x!, street: r.logradouro || x!.street, district: r.bairro || x!.district, city: r.localidade || x!.city, state: r.uf || x!.state }))
    } catch {
      /* sem internet: preenche manualmente */
    }
  }

  async function uploadLogo(f?: File) {
    if (!f) return
    await run(async () => {
      const blob = await compressImage(f, 600, 0.9)
      const path = filePath(session!.organizationId!)
      await db.uploadFile(path, blob)
      setS((x) => ({ ...x!, logo_url: path }))
    }, 'Logo carregado — toque em Salvar')
  }

  const setStage = (i: number, patch: Partial<Stage>) => set('stages', s.stages.map((st, j) => (j === i ? { ...st, ...patch } : st)))

  return (
    <div className="space-y-3 pb-28">
      <PageHeader title="Configurações" subtitle="Aparece nos orçamentos, serviços e na página do cliente" back="/" />

      <Collapsible title="Sua oficina" subtitle="Nome, logo, WhatsApp e PIX" icon={Building2} defaultOpen>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => logoRef.current?.click()} className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200" aria-label="Escolher logo">
            {s.logo_url ? <Thumb path={s.logo_url} className="h-full w-full !object-contain" /> : <ImagePlus className="text-slate-400" />}
          </button>
          <div className="space-y-1">
            <Button variant="secondary" className="min-h-10" onClick={() => logoRef.current?.click()}>{s.logo_url ? 'Trocar logo' : 'Colocar logo'}</Button>
            {s.logo_url && <button type="button" className="block text-sm font-semibold text-red-600" onClick={() => set('logo_url', undefined)}>Remover logo</button>}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
        </div>
        {text('trade_name', 'Nome fantasia *')}
        {text('tagline', 'Especialidade / slogan', { placeholder: 'Funilaria • Pintura • Polimento' })}
        <div className="grid grid-cols-2 gap-3">
          {text('whatsapp', 'WhatsApp', { type: 'tel', inputMode: 'tel' })}
          {text('city', 'Cidade')}
        </div>
        {text('pix_key', 'Chave PIX', { placeholder: 'CPF, CNPJ, e-mail, celular ou chave aleatória' })}
      </Collapsible>

      <Collapsible title="Endereço e documentos" subtitle="CNPJ, endereço, Instagram, cor da marca" icon={MapPin}>
        {text('legal_name', 'Razão social')}
        <div className="grid grid-cols-2 gap-3">
          <Field label="CNPJ ou CPF" error={s.document && !isValidDocument(s.document) ? 'Documento inválido' : null}>
            <Input inputMode="numeric" value={s.document ?? ''} onChange={(e) => set('document', e.target.value)} />
          </Field>
          {text('state_registration', 'Inscrição estadual')}
          {text('phone', 'Telefone fixo', { type: 'tel', inputMode: 'tel' })}
          {text('instagram', 'Instagram', { placeholder: '@suaoficina' })}
        </div>
        {text('email', 'E-mail', { type: 'email' })}
        <Field label="CEP" hint="Preenche o endereço sozinho">
          <Input inputMode="numeric" value={s.zip ?? ''} onChange={(e) => set('zip', e.target.value)} onBlur={fillCep} />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          {text('street', 'Rua')}
          {text('number', 'Número')}
        </div>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          {text('district', 'Bairro')}
          {text('state', 'UF', { maxLength: 2, className: 'uppercase' })}
        </div>
        {text('opening_hours', 'Horário de funcionamento', { placeholder: 'Seg a sex 8h–18h, sáb 8h–12h' })}
        {text('website', 'Site')}
        <Field label="Cor da marca (documentos e página do cliente)">
          <input type="color" value={s.brand_color} onChange={(e) => set('brand_color', e.target.value)} className="h-12 w-20 rounded-xl ring-1 ring-slate-200" />
        </Field>
      </Collapsible>

      <Collapsible title="Pagamento e parcelas" subtitle="Parcelamento, desconto à vista, sua hora" icon={CreditCard}>
        {text('pix_name', 'Nome de quem recebe o PIX')}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Até quantas vezes"><Input inputMode="numeric" value={s.max_installments} onChange={(e) => set('max_installments', Math.min(24, Math.max(1, Number(digits(e.target.value)) || 1)))} /></Field>
          <Field label="Juros parc. %"><Input inputMode="decimal" value={s.installment_fee_percent} onChange={(e) => set('installment_fee_percent', Number(e.target.value.replace(',', '.')) || 0)} /></Field>
          <Field label="Desc. à vista %"><Input inputMode="decimal" value={s.cash_discount_percent} onChange={(e) => set('cash_discount_percent', Number(e.target.value.replace(',', '.')) || 0)} /></Field>
        </div>
        <Field label="Quanto vale sua hora de trabalho" hint="Usado para anotar horas nos gastos do serviço">
          <MoneyInput value={s.hourly_rate} onChange={(v) => set('hourly_rate', v)} />
        </Field>
      </Collapsible>

      <Collapsible title="Textos dos documentos" subtitle="Garantia, condições, validade" icon={FileText}>
        <Field label="Garantia"><TextArea value={s.warranty_terms} onChange={(e) => set('warranty_terms', e.target.value)} /></Field>
        <Field label="Condições gerais"><TextArea value={s.general_terms} onChange={(e) => set('general_terms', e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Validade (dias)"><Input inputMode="numeric" value={s.quote_validity_days} onChange={(e) => set('quote_validity_days', Number(digits(e.target.value)) || 1)} /></Field>
          {text('quote_prefix', 'Sigla orç.')}
          {text('work_order_prefix', 'Sigla OS')}
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={s.show_values_on_portal} onChange={(e) => set('show_values_on_portal', e.target.checked)} />
          <span className="text-sm">Mostrar valores e quanto falta pagar na página do cliente</span>
        </label>
      </Collapsible>

      <Collapsible title="Mensagens do WhatsApp" subtitle="O texto que vai junto com o link" icon={MessageCircle}>
        <p className="text-xs text-slate-500">Palavras trocadas sozinhas: {'{cliente} {veiculo} {placa} {numero} {link} {etapa} {previsao}'}</p>
        <Field label="Ao mandar orçamento"><TextArea value={s.templates.quote} onChange={(e) => set('templates', { ...s.templates, quote: e.target.value })} /></Field>
        <Field label="Ao receber o carro"><TextArea value={s.templates.work_order} onChange={(e) => set('templates', { ...s.templates, work_order: e.target.value })} /></Field>
        <Field label="Ao mudar de etapa"><TextArea value={s.templates.stage} onChange={(e) => set('templates', { ...s.templates, stage: e.target.value })} /></Field>
        <Field label="Carro pronto"><TextArea value={s.templates.ready} onChange={(e) => set('templates', { ...s.templates, ready: e.target.value })} /></Field>
      </Collapsible>

      <Collapsible title="Etapas do serviço" subtitle={`${s.stages.length} etapas`} icon={ListOrdered}>
        <ul className="space-y-2">
          {s.stages.map((st, i) => (
            <li key={st.key} className="flex items-center gap-2">
              <input type="color" value={st.color} onChange={(e) => setStage(i, { color: e.target.value })} className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-slate-200" aria-label="Cor da etapa" />
              <Input value={st.name} onChange={(e) => setStage(i, { name: e.target.value })} />
              {!SYSTEM_STAGES.includes(st.key) ? (
                <button type="button" aria-label="Remover etapa" className="flex h-11 w-9 shrink-0 items-center justify-center text-red-600" onClick={async () => (await askConfirm(`Remover a etapa "${st.name}"?`, 'Remover')) && set('stages', s.stages.filter((_, j) => j !== i))}><X size={18} /></button>
              ) : <span className="w-9 shrink-0" />}
            </li>
          ))}
        </ul>
        <Button variant="secondary" icon={Plus} onClick={() => set('stages', [...s.stages.slice(0, -2), { key: `etapa_${Date.now()}`, name: 'Nova etapa', color: '#64748b', public: true }, ...s.stages.slice(-2)])}>Etapa</Button>
      </Collapsible>

      <Link to="/catalogo" className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-4 shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70 active:bg-slate-50">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><BookOpen size={18} /></span>
        <span className="flex-1"><span className="block text-[15px] font-bold">Serviços com preço</span><span className="block text-xs text-slate-500">Aparecem como sugestão no orçamento</span></span>
        <ChevronRight size={20} className="text-slate-400" />
      </Link>

      <Card className="text-sm text-slate-600">
        {db.mode === 'local' ? (
          <p><strong>Modo de teste:</strong> os dados ficam só neste navegador.</p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">Conectado como {session?.email}</span>
            <Button variant="secondary" icon={LogOut} className="min-h-10" onClick={async () => { await db.signOut(); await reloadSession() }}>Sair</Button>
          </div>
        )}
      </Card>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:bottom-0 lg:left-60">
        <Button className="mx-auto flex w-full max-w-xl lg:max-w-3xl" disabled={busy || !s.trade_name.trim()} onClick={() => run(() => saveSettings(s), 'Configurações salvas')}>
          Salvar configurações
        </Button>
      </div>
    </div>
  )
}
