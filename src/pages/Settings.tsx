import { askConfirm } from '../lib/confirm'
import { useRef, useState } from 'react'
import { Thumb } from '../components/PhotoManager'
import { Button, Field, Input, Loading, MoneyInput, PageHeader, Section, TextArea } from '../components/ui'
import { useAction, useApp } from '../lib/app'
import { db, filePath } from '../lib/db'
import { digits, isValidDocument } from '../lib/format'
import { compressImage } from '../lib/image'
import type { Settings as S, Stage } from '../lib/types'

const SYSTEM_STAGES = ['recebido', 'pronto', 'entregue']

export default function Settings() {
  const { settings, saveSettings, session } = useApp()
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
    <div className="space-y-4 pb-24">
      <PageHeader title="Configurações" back="/mais" />
      <p className="text-sm text-slate-600">Esses dados aparecem no cabeçalho dos orçamentos, OS, recibos e na página do cliente.</p>

      <Section title="Empresa">
        <div className="flex items-center gap-3">
          {s.logo_url ? <Thumb path={s.logo_url} className="h-20 w-20 rounded-lg border border-slate-200 bg-white !object-contain" /> : <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-400">Logo</div>}
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={() => logoRef.current?.click()}>Escolher logo</Button>
            {s.logo_url && <button type="button" className="text-sm text-red-700" onClick={() => set('logo_url', undefined)}>Remover</button>}
          </div>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadLogo(e.target.files?.[0])} />
        </div>
        {text('trade_name', 'Nome fantasia *')}
        {text('tagline', 'Especialidade / slogan', { placeholder: 'Funilaria • Pintura • Polimento' })}
        {text('legal_name', 'Razão social')}
        <div className="grid grid-cols-2 gap-3">
          <Field label="CNPJ ou CPF" error={s.document && !isValidDocument(s.document) ? 'Documento inválido' : null}>
            <Input inputMode="numeric" value={s.document ?? ''} onChange={(e) => set('document', e.target.value)} />
          </Field>
          {text('state_registration', 'Inscrição estadual')}
        </div>
        <Field label="Cor da marca">
          <div className="flex items-center gap-3">
            <input type="color" value={s.brand_color} onChange={(e) => set('brand_color', e.target.value)} className="h-11 w-16 rounded border border-slate-300" />
            <span className="text-sm text-slate-600">Usada no cabeçalho dos documentos e na página do cliente</span>
          </div>
        </Field>
      </Section>

      <Section title="Contato e endereço">
        <div className="grid grid-cols-2 gap-3">
          {text('phone', 'Telefone', { type: 'tel', inputMode: 'tel' })}
          {text('whatsapp', 'WhatsApp', { type: 'tel', inputMode: 'tel' })}
        </div>
        {text('email', 'E-mail', { type: 'email' })}
        <div className="grid grid-cols-2 gap-3">
          {text('instagram', 'Instagram', { placeholder: '@suaoficina' })}
          {text('website', 'Site')}
        </div>
        <Field label="CEP" hint="Preenche o endereço automaticamente">
          <Input inputMode="numeric" value={s.zip ?? ''} onChange={(e) => set('zip', e.target.value)} onBlur={fillCep} />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          {text('street', 'Rua')}
          {text('number', 'Número')}
        </div>
        {text('district', 'Bairro')}
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          {text('city', 'Cidade')}
          {text('state', 'UF', { maxLength: 2, className: 'uppercase' })}
        </div>
        {text('opening_hours', 'Horário de funcionamento', { placeholder: 'Seg a sex 8h–18h, sáb 8h–12h' })}
      </Section>

      <Section title="Pagamento">
        <div className="grid grid-cols-2 gap-3">
          {text('pix_key', 'Chave PIX')}
          {text('pix_name', 'Nome do favorecido')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Máx. parcelas"><Input inputMode="numeric" value={s.max_installments} onChange={(e) => set('max_installments', Math.min(24, Math.max(1, Number(digits(e.target.value)) || 1)))} /></Field>
          <Field label="Taxa parcel. %"><Input inputMode="decimal" value={s.installment_fee_percent} onChange={(e) => set('installment_fee_percent', Number(e.target.value.replace(',', '.')) || 0)} /></Field>
          <Field label="Desc. à vista %"><Input inputMode="decimal" value={s.cash_discount_percent} onChange={(e) => set('cash_discount_percent', Number(e.target.value.replace(',', '.')) || 0)} /></Field>
        </div>
        <Field label="Valor da sua hora de trabalho" hint="Usado no lançamento de horas nos custos da OS">
          <MoneyInput value={s.hourly_rate} onChange={(v) => set('hourly_rate', v)} />
        </Field>
      </Section>

      <Section title="Documentos">
        <div className="grid grid-cols-3 gap-3">
          {text('quote_prefix', 'Prefixo orç.')}
          {text('work_order_prefix', 'Prefixo OS')}
          <Field label="Validade (dias)"><Input inputMode="numeric" value={s.quote_validity_days} onChange={(e) => set('quote_validity_days', Number(digits(e.target.value)) || 1)} /></Field>
        </div>
        <Field label="Condições gerais"><TextArea value={s.general_terms} onChange={(e) => set('general_terms', e.target.value)} /></Field>
        <Field label="Garantia"><TextArea value={s.warranty_terms} onChange={(e) => set('warranty_terms', e.target.value)} /></Field>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={s.show_values_on_portal} onChange={(e) => set('show_values_on_portal', e.target.checked)} />
          <span className="text-sm">Mostrar valores e saldo na página de acompanhamento da OS</span>
        </label>
      </Section>

      <Section title="Mensagens de WhatsApp">
        <p className="text-xs text-slate-500">Variáveis: {'{cliente} {veiculo} {placa} {numero} {link} {etapa} {previsao}'}</p>
        <Field label="Envio de orçamento"><TextArea value={s.templates.quote} onChange={(e) => set('templates', { ...s.templates, quote: e.target.value })} /></Field>
        <Field label="Envio de OS"><TextArea value={s.templates.work_order} onChange={(e) => set('templates', { ...s.templates, work_order: e.target.value })} /></Field>
        <Field label="Mudança de etapa"><TextArea value={s.templates.stage} onChange={(e) => set('templates', { ...s.templates, stage: e.target.value })} /></Field>
        <Field label="Veículo pronto"><TextArea value={s.templates.ready} onChange={(e) => set('templates', { ...s.templates, ready: e.target.value })} /></Field>
      </Section>

      <Section title="Etapas da OS">
        <ul className="space-y-2">
          {s.stages.map((st, i) => (
            <li key={st.key} className="flex items-center gap-2">
              <input type="color" value={st.color} onChange={(e) => setStage(i, { color: e.target.value })} className="h-10 w-10 shrink-0 rounded border border-slate-300" />
              <Input value={st.name} onChange={(e) => setStage(i, { name: e.target.value })} />
              <label className="flex shrink-0 items-center gap-1 text-xs" title="Visível para o cliente">
                <input type="checkbox" checked={st.public} onChange={(e) => setStage(i, { public: e.target.checked })} className="h-5 w-5" /> cliente
              </label>
              {!SYSTEM_STAGES.includes(st.key) && (
                <button type="button" aria-label="Remover etapa" className="h-10 w-8 shrink-0 text-red-600" onClick={async () => await askConfirm(`Remover a etapa "${st.name}"?`) && set('stages', s.stages.filter((_, j) => j !== i))}>✕</button>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">"Veículo recebido", "Pronto para entrega" e "Entregue" são usadas pelo sistema e não podem ser removidas.</p>
        <Button variant="secondary" onClick={() => set('stages', [...s.stages.slice(0, -2), { key: `etapa_${Date.now()}`, name: 'Nova etapa', color: '#64748b', public: true }, ...s.stages.slice(-2)])}>+ Etapa</Button>
      </Section>

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-slate-200 bg-white p-3 lg:bottom-0 lg:left-60">
        <Button className="mx-auto flex w-full max-w-3xl" disabled={busy || !s.trade_name.trim()} onClick={() => run(() => saveSettings(s), 'Configurações salvas')}>
          Salvar configurações
        </Button>
      </div>
    </div>
  )
}
