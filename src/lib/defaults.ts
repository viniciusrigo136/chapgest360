import type { PaymentMethod, Settings, Stage } from './types'

export const DEFAULT_STAGES: Stage[] = [
  { key: 'recebido', name: 'Veículo recebido', color: '#64748b', public: true },
  { key: 'avaliacao', name: 'Avaliação', color: '#0ea5e9', public: true },
  { key: 'aguardando_aprovacao', name: 'Aguardando aprovação', color: '#f59e0b', public: true },
  { key: 'aguardando_pecas', name: 'Aguardando peças', color: '#f97316', public: true },
  { key: 'funilaria', name: 'Funilaria', color: '#8b5cf6', public: true },
  { key: 'preparacao', name: 'Preparação', color: '#a855f7', public: true },
  { key: 'pintura', name: 'Pintura', color: '#ec4899', public: true },
  { key: 'montagem', name: 'Montagem', color: '#14b8a6', public: true },
  { key: 'acabamento', name: 'Polimento e acabamento', color: '#06b6d4', public: true },
  { key: 'pronto', name: 'Pronto para entrega', color: '#22c55e', public: true },
  { key: 'entregue', name: 'Entregue', color: '#15803d', public: true },
]

export const DEFAULT_SETTINGS: Settings = {
  trade_name: 'Minha Oficina',
  brand_color: '#1d4ed8',
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
  rascunho: { label: 'Rascunho', cls: 'bg-slate-200 text-slate-800' },
  enviado: { label: 'Aguardando aprovação', cls: 'bg-amber-100 text-amber-900' },
  aprovado: { label: 'Aprovado', cls: 'bg-green-100 text-green-900' },
  recusado: { label: 'Recusado', cls: 'bg-red-100 text-red-900' },
  expirado: { label: 'Expirado', cls: 'bg-orange-100 text-orange-900' },
  cancelado: { label: 'Cancelado', cls: 'bg-slate-300 text-slate-700' },
} as const

export const COST_CATEGORIES = { tinta: 'Tintas', material: 'Materiais', peca: 'Peças', terceiro: 'Terceirizados', horas: 'Horas próprias', outro: 'Outros' } as const
