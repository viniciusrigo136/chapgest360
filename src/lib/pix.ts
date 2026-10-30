// Payload PIX "copia e cola" (BR Code, padrão EMV do Banco Central).

const field = (id: string, value: string) => id + String(value.length).padStart(2, '0') + value

export function crc16(payload: string) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const clean = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, max).toUpperCase()

export function pixPayload(opts: { key: string; name: string; city: string; amountCents?: number; txid?: string }) {
  const account = field('00', 'br.gov.bcb.pix') + field('01', opts.key.trim())
  const txid = (opts.txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  let p =
    field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (opts.amountCents ? field('54', (opts.amountCents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', clean(opts.name, 25) || 'RECEBEDOR') +
    field('60', clean(opts.city, 15) || 'BRASIL') +
    field('62', field('05', txid)) +
    '6304'
  p += crc16(p)
  return p
}
