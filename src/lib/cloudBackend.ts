import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend, NewRow, PublicRaw, Row, Session } from './backend'
import { DEFAULT_SETTINGS } from './defaults'
import type { Settings, TableName } from './types'

const BUCKET = 'photos'

export function createCloudBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey)
  let orgId: string | null = null
  const urlCache = new Map<string, { url: string; exp: number }>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const check = (r: { data: unknown; error: { message: string } | null }): any => {
    if (r.error) throw new Error(translate(r.error.message))
    return r.data
  }

  const org = () => {
    if (!orgId) throw new Error('Oficina não carregada')
    return orgId
  }

  async function signed(path: string) {
    const c = urlCache.get(path)
    if (c && c.exp > Date.now()) return c.url
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (error || !data) return ''
    urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 })
    return data.signedUrl
  }

  const backend: Backend = {
    mode: 'cloud',
    async getSession(): Promise<Session | null> {
      const { data } = await sb.auth.getSession()
      const user = data.session?.user
      if (!user) return null
      const m = await sb.from('memberships').select('organization_id').eq('user_id', user.id).limit(1)
      orgId = (m.data?.[0]?.organization_id as string | undefined) ?? null
      return { userId: user.id, email: user.email ?? '', organizationId: orgId }
    },
    async signIn(email, password) {
      check(await sb.auth.signInWithPassword({ email, password }))
    },
    async signUp(email, password) {
      // O link de confirmação do e-mail volta para o endereço onde o sistema está aberto.
      check(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } }))
    },
    async signOut() {
      await sb.auth.signOut()
      orgId = null
    },
    async createOrganization(name) {
      orgId = check(await sb.rpc('create_organization', { org_name: name })) as string
    },

    async list(table, filter) {
      let q = sb.from(table).select('*').eq('organization_id', org())
      for (const [k, v] of Object.entries(filter ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v)
      return check(await q.order('created_at', { ascending: false }).limit(5000)) as Row<typeof table>[]
    },
    async get(table, id) {
      return check(await sb.from(table).select('*').eq('id', id).maybeSingle()) as Row<typeof table> | null
    },
    async insert<T extends TableName>(table: T, row: NewRow<T>) {
      return check(await sb.from(table).insert({ ...row, organization_id: org() }).select().single()) as Row<T>
    },
    async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
      const { id: _i, organization_id: _o, created_at: _c, updated_at: _u, ...rest } = patch as Record<string, unknown>
      return check(await sb.from(table).update(rest).eq('id', id).select().single()) as Row<T>
    },
    async remove(table, id) {
      check(await sb.from(table).delete().eq('id', id))
    },

    async getSettings() {
      const s = check(await sb.from('organizations').select('settings').eq('id', org()).single()) as { settings: Partial<Settings> }
      return { ...DEFAULT_SETTINGS, ...s.settings, templates: { ...DEFAULT_SETTINGS.templates, ...s.settings.templates } }
    },
    async saveSettings(s) {
      check(await sb.from('organizations').update({ settings: s, name: s.trade_name }).eq('id', org()))
    },

    async uploadFile(path, blob) {
      check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false }))
    },
    async fileUrl(path) {
      return signed(path)
    },
    async deleteFile(path) {
      await sb.storage.from(BUCKET).remove([path])
    },
    async copyFile(from, to) {
      check(await sb.storage.from(BUCKET).copy(from, to))
    },

    async publicDocument(token) {
      return check(await sb.rpc('public_document', { token })) as PublicRaw | null
    },
    async publicDecision(token, approve, name, note) {
      check(await sb.rpc('public_decision', { token, approve, signer: name, note }))
    },
    async publicFileUrl(_token, path) {
      return signed(path)
    },
  }
  return backend
}

function translate(msg: string) {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos'
  if (msg.includes('User already registered')) return 'Este e-mail já tem cadastro'
  if (msg.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres'
  if (msg.includes('Failed to fetch')) return 'Sem conexão com a internet. Tente novamente.'
  return msg
}
