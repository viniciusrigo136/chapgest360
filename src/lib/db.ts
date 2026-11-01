import type { Backend } from './backend'
import { createCloudBackend } from './cloudBackend'
import { local } from './localBackend'

const env = import.meta.env
// Aceita os nomes VITE_ (Lovable/Vite) e NEXT_PUBLIC_ (integração Supabase da Vercel).
const url = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined
const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string | undefined

export const db: Backend = url && key ? createCloudBackend(url, key) : local

/** Arquivos ficam em <organization_id>/<uuid>.jpg (exigido pelas políticas do Storage). */
export const filePath = (organizationId: string, ext = 'jpg') => `${organizationId}/${crypto.randomUUID()}.${ext}`
