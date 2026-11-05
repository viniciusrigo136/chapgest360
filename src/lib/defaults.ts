import type { PaymentMethod, Settings, Stage } from './types'

export const DEFAULT_STAGES: Stage[] = [
  { key: 'recebido', name: 'Veículo recebido', color: '#475569', public: true },
  { key: 'avaliacao', name: 'Avaliação', color: '#2563eb', public: true },
  { key: 'aguardando_aprovacao', name: 'Aguardando aprovação', color: '#b45309', public: true },
  { key: 'aguardando_pecas', name: 'Aguardando peças', color: '#b45309', public: true },
  { key: 'funilaria', name: 'Funilaria', color: '#2563eb', public: true },
  { key: 'preparacao', name: 'Preparação', color: '#2563eb', public: true },
  { key: 'pintura', name: 'Pintura', color: '#2563eb', public: true },
  { key: 'montagem', name: 'Montagem', color: '#2563eb', public: true },
  { key: 'acabamento', name: 'Polimento e acabamento', color: '#2563eb', public: true },
  { key: 'pronto', name: 'Pronto para entrega', color: '#047857', public: true },
  { key: 'entregue', name: 'Entregue', color: '#475569', public: true },
]

export const DEFAULT_SETTINGS: Settings = {
  trade_name: 'Minha Oficina',
  brand_color: '#2563eb',
  max_installments: 10,
  installment_fee_percent: 0,
  cash_discount_percent: 0,
  hourly_rate: 0,
  quote_validity_days: 15,
  general_terms:
    'Orçamento sujeito a alteração caso sejam encontrados danos ocultos após a desmontagem. Peças substituídas ficam à disposição do cliente por 7 dias.',
  warranty_terms: 'Garantia de 90 dias para serviços de funilaria e pintura, contados a partir da entrega, conforme o Código de Defesa do Consumidor.',
  delivery_terms: 'Declaro que recebi o veículo descrito acima com os serviços executados e em perfeitas condições.',
  authorization_terms: 'Autorizo a execução dos serviços descritos neste documento.',
  templates: {
    quote: 'Olá {cliente}! Segue o orçamento {numero} do seu {veiculo} ({placa}): {link}',
    work_order: 'Olá {cliente}! Seu {veiculo} ({placa}) deu entrada na oficina. Acompanhe o serviço por aqui: {link}',
    stage: 'Olá {cliente}! Atualização do seu {veiculo}: etapa "{etapa}". Previsão de entrega: {previsao}. Acompanhe: {link}',
    ready: 'Olá {cliente}! Seu {veiculo} ({placa}) está pronto para retirada. Detalhes: {link}',
  },
  quote_prefix: 'ORC',
  work_order_prefix: 'OS',
  stages: DEFAULT_STAGES,
  show_values_on_portal: true,
}

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  seguradora: 'Seguradora',
}

export const REGIONS = [
  'Para-choque dianteiro', 'Capô', 'Para-lama diant. esq.', 'Para-lama diant. dir.', 'Porta diant. esq.', 'Porta diant. dir.',
  'Porta tras. esq.', 'Porta tras. dir.', 'Lateral tras. esq.', 'Lateral tras. dir.', 'Teto', 'Tampa traseira',
  'Para-choque traseiro', 'Retrovisor esq.', 'Retrovisor dir.', 'Soleira esq.', 'Soleira dir.', 'Coluna', 'Vidros', 'Rodas',
]

export const UNITS = ['un', 'serv', 'h', 'ml', 'L', 'g', 'kg', 'm', 'par']

export const CHECKLIST_ITEMS = ['Estepe', 'Macaco', 'Chave de roda', 'Triângulo', 'Documento (CRLV)', 'Tapetes', 'Rádio/multimídia', 'Antena', 'Calotas', 'Chave reserva']

export const DAMAGE_TYPES = { amassado: 'Amassado', risco: 'Risco', quebrado: 'Quebrado/trincado', ferrugem: 'Ferrugem', pintura: 'Pintura danificada' } as const

export const QUOTE_STATUS = {
  rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700' },
  enviado: { label: 'Esperando cliente', cls: 'bg-amber-50 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-emerald-50 text-emerald-700' },
  recusado: { label: 'Recusado', cls: 'bg-red-50 text-red-600' },
  expirado: { label: 'Expirado', cls: 'bg-amber-50 text-amber-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600' },
} as const

export const COST_CATEGORIES = { tinta: 'Tintas', material: 'Materiais', peca: 'Peças', terceiro: 'Terceirizados', horas: 'Horas próprias', outro: 'Outros' } as const

/** Marcas mais comuns no Brasil e alguns modelos, para sugerir no cadastro do carro. */
export const VEHICLE_MODELS: Record<string, string[]> = {
  Chevrolet: ['Onix', 'Onix Plus', 'Prisma', 'Celta', 'Corsa', 'Cruze', 'Tracker', 'S10', 'Spin', 'Montana', 'Cobalt', 'Agile'],
  Fiat: ['Uno', 'Mobi', 'Argo', 'Cronos', 'Palio', 'Siena', 'Strada', 'Toro', 'Pulse', 'Fastback', 'Fiorino', 'Doblò', 'Punto'],
  Volkswagen: ['Gol', 'Voyage', 'Fox', 'Polo', 'Virtus', 'T-Cross', 'Nivus', 'Saveiro', 'Amarok', 'Jetta', 'Up!', 'Taos'],
  Ford: ['Ka', 'Fiesta', 'Focus', 'EcoSport', 'Ranger', 'Territory', 'Maverick'],
  Toyota: ['Corolla', 'Corolla Cross', 'Yaris', 'Etios', 'Hilux', 'SW4', 'RAV4'],
  Hyundai: ['HB20', 'HB20S', 'Creta', 'Tucson', 'ix35'],
  Honda: ['Civic', 'City', 'Fit', 'HR-V', 'WR-V', 'CR-V'],
  Renault: ['Kwid', 'Sandero', 'Logan', 'Duster', 'Captur', 'Oroch', 'Master'],
  Nissan: ['March', 'Versa', 'Kicks', 'Sentra', 'Frontier'],
  Jeep: ['Renegade', 'Compass', 'Commander'],
  Peugeot: ['208', '2008', '308', '3008', 'Partner'],
  Citroën: ['C3', 'C4 Cactus', 'Aircross', 'Jumpy'],
  Mitsubishi: ['L200', 'Pajero', 'ASX', 'Outlander'],
  'Caoa Chery': ['Tiggo 5x', 'Tiggo 7', 'Tiggo 8', 'Arrizo 6'],
  BYD: ['Dolphin', 'Dolphin Mini', 'Song Plus', 'Seal'],
  Kia: ['Sportage', 'Cerato', 'Picanto', 'Sorento'],
  'Mercedes-Benz': ['Classe A', 'Classe C', 'GLA', 'Sprinter', 'Accelo'],
  BMW: ['Série 3', 'X1', 'X3', '320i'],
  Audi: ['A3', 'A4', 'Q3', 'Q5'],
  Volvo: ['XC40', 'XC60', 'FH'],
  Scania: ['R 450', 'P 360', 'G 410'],
}
export const VEHICLE_BRANDS = Object.keys(VEHICLE_MODELS)
export const VEHICLE_COLORS = ['Branco', 'Preto', 'Prata', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Laranja', 'Marrom', 'Bege', 'Dourado', 'Vinho', 'Grafite']
export const FUELS = ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'GNV', 'Híbrido', 'Elétrico']

/** Junta apelidos de marca ("vw", "gm", "chevrolet") no nome da lista. */
export function normalizeBrand(b?: string) {
  const t = (b ?? '').trim().toLowerCase()
  if (!t) return ''
  const alias: Record<string, string> = { vw: 'Volkswagen', gm: 'Chevrolet', chevy: 'Chevrolet', mercedes: 'Mercedes-Benz', citroen: 'Citroën', chery: 'Caoa Chery' }
  return alias[t] ?? VEHICLE_BRANDS.find((x) => x.toLowerCase().startsWith(t)) ?? ''
}

/** Cores antigas das etapas padrão (antes da identidade TecGest 360), para atualizar configurações já salvas. */
const OLD_STAGE_COLORS: Record<string, string> = { recebido: '#64748b', avaliacao: '#0ea5e9', aguardando_aprovacao: '#f59e0b', aguardando_pecas: '#f97316', funilaria: '#8b5cf6', preparacao: '#a855f7', pintura: '#ec4899', montagem: '#14b8a6', acabamento: '#06b6d4', pronto: '#22c55e', entregue: '#15803d' }

/** Troca as cores antigas padrão pelas novas; cores escolhidas pelo usuário ficam como estão. */
export function upgradeStages(stages: Stage[]): Stage[] {
  return stages.map((st) => {
    const def = DEFAULT_STAGES.find((d) => d.key === st.key)
    return def && OLD_STAGE_COLORS[st.key] === st.color.toLowerCase() ? { ...st, color: def.color } : st
  })
}
