import { date, digits, plate } from './format'
import type { Customer, Settings, Vehicle } from './types'

export const publicUrl = (token: string) => `${location.origin}/c/${token}`

export function vehicleLabel(v?: Pick<Vehicle, 'brand' | 'model' | 'color'> | null) {
  return [v?.brand, v?.model, v?.color].filter(Boolean).join(' ') || 'veículo'
}

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m)
}

export function messageVars(opts: { customer?: Customer | null; vehicle?: Vehicle | null; number: string; token: string; stage?: string; due?: string | null }) {
  return {
    cliente: (opts.customer?.name ?? '').split(' ')[0],
    veiculo: vehicleLabel(opts.vehicle),
    placa: plate(opts.vehicle?.plate),
    numero: opts.number,
    link: publicUrl(opts.token),
    etapa: opts.stage ?? '',
    previsao: opts.due ? date(opts.due) : 'a definir',
  }
}

/** Abre o WhatsApp com a mensagem. Sem número, o usuário escolhe o contato. */
export function whatsappUrl(phone: string | undefined, text: string) {
  let d = digits(phone)
  if (d && d.length <= 11) d = '55' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`
}

export function companyAddress(s: Partial<Settings>) {
  const l1 = [s.street, s.number].filter(Boolean).join(', ')
  const l2 = [s.district, [s.city, s.state].filter(Boolean).join('/')].filter(Boolean).join(' – ')
  return [l1, l2, s.zip ? `CEP ${s.zip}` : ''].filter(Boolean).join(' – ')
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
