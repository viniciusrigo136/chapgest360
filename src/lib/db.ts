import type { Backend } from './backend'
import { createCloudBackend } from './cloudBackend'
import { local } from './localBackend'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const db: Backend = url && key ? createCloudBackend(url, key) : local

/** Arquivos ficam em <organization_id>/<uuid>.jpg (exigido pelas políticas do Storage). */
export const filePath = (organizationId: string, ext = 'jpg') => `${organizationId}/${crypto.randomUUID()}.${ext}`
