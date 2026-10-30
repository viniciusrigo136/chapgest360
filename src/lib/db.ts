import type { Backend } from './backend'
import { createCloudBackend } from './cloudBackend'
import { local } from './localBackend'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Lovable Cloud usa VITE_SUPABASE_PUBLISHABLE_KEY; Supabase direto costuma usar VITE_SUPABASE_ANON_KEY.
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined

export const db: Backend = url && key ? createCloudBackend(url, key) : local

/** Arquivos ficam em <organization_id>/<uuid>.jpg (exigido pelas políticas do Storage). */
export const filePath = (organizationId: string, ext = 'jpg') => `${organizationId}/${crypto.randomUUID()}.${ext}`
