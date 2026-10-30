import { describe, expect, it } from 'vitest'
import { balance, computeTotals, installments, insuranceSplit } from '../src/lib/calc'
import { isValidCNPJ, isValidCPF, isValidPlate, maskedPlate, parseMoney, plate } from '../src/lib/format'
import { crc16, pixPayload } from '../src/lib/pix'
import type { Payment } from '../src/lib/types'

describe('dinheiro e totais', () => {
  it('converte texto em centavos', () => {
    expect(parseMoney('1.234,56')).toBe(123456)
    expect(parseMoney('R$ 10')).toBe(1000)
    expect(parseMoney('0,1')).toBe(10)
    expect(parseMoney('')).toBe(0)
  })
  it('calcula total igual ao trigger do banco', () => {
    const items = [
      { id: '1', kind: 'service' as const, description: 'a', qty: 2, unit: 'un', unit_price: 15050 },
      { id: '2', kind: 'part' as const, description: 'b', qty: 1.5, unit: 'un', unit_price: 1001 },
    ]
    expect(computeTotals({ simple: false, items, discount: 500, surcharge: 0 })).toEqual({ subtotal: 31602, total: 31102 })
    expect(computeTotals({ simple: true, simple_total: 1000, items, discount: 2000, surcharge: 0 }).total).toBe(0)
  })
  it('divide seguradora e cliente', () => {
    expect(insuranceSplit(500000, { insurer: 'X', deductible: 150000, customer_pays: 150000 })).toEqual({ customer: 150000, insurer: 350000 })
    expect(insuranceSplit(100000, { insurer: 'X', deductible: 150000, customer_pays: 150000 })).toEqual({ customer: 100000, insurer: 0 })
    expect(insuranceSplit(1000, null)).toEqual({ customer: 1000, insurer: 0 })
  })
  it('parcela sem perder centavos', () => {
    const r = installments(10000, 3)
    expect(r.values).toEqual([3333, 3333, 3334])
    expect(installments(10000, 2, 5).total).toBe(10500)
  })
  it('ignora pagamentos estornados no saldo', () => {
    const ps = [{ amount: 3000 }, { amount: 2000, reversed_at: 'x' }] as Payment[]
    expect(balance(10000, ps)).toEqual({ paid: 3000, due: 7000 })
  })
})

describe('validações', () => {
  it('placas', () => {
    expect(isValidPlate('abc-1234')).toBe(true)
    expect(isValidPlate('ABC1D23')).toBe(true)
    expect(isValidPlate('AB12345')).toBe(false)
    expect(plate('abc1234')).toBe('ABC-1234')
    expect(maskedPlate('ABC1D23')).toBe('ABC-1**3')
  })
  it('CPF e CNPJ', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true)
    expect(isValidCPF('111.111.111-11')).toBe(false)
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true)
    expect(isValidCNPJ('11.222.333/0001-82')).toBe(false)
  })
})

describe('PIX', () => {
  it('CRC16 confere com o exemplo do manual do BC', () => {
    const p = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'
    expect(crc16(p)).toBe('1D3D')
  })
  it('monta payload com valor', () => {
    const p = pixPayload({ key: 'oficina@email.com', name: 'Funilária São José', city: 'São Paulo', amountCents: 150000, txid: 'OS20260001' })
    expect(p).toContain('54071500.00')
    expect(p).toContain('5918FUNILARIA SAO JOSE')
    expect(p.slice(-8, -4)).toBe('6304')
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4))
  })
})
