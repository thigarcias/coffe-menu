import { supabase } from '../../lib/adminAuth'
import { isDashSection, type DashSection, type Layout } from './model'

/** Estado salvo de uma seção: `items` nulo = padrão do código. */
export interface SectionState {
  version: number
  items: Layout | null
  source?: string
  saved_at?: string
}
export interface HistoryEntry {
  version: number
  source: 'manual' | 'ia' | 'reset' | 'restore'
  saved_at: string
  is_default: boolean
}
export interface LayoutsPayload {
  cafe_id: string
  sections: Partial<Record<DashSection, SectionState>>
  history: Partial<Record<DashSection, HistoryEntry[]>>
}

export class ConflictError extends Error {}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
  const response = await fetch('/api/menu-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ rpc: name, args }),
  })
  const body = (await response.json().catch(() => null)) as { message?: string } | T | null
  if (!response.ok) {
    if (response.status === 409) throw new ConflictError('O painel mudou em outra tela. Atualizamos para a versão mais recente.')
    const message = body && typeof body === 'object' && 'message' in body ? String((body as { message?: string }).message ?? '') : ''
    throw new Error(message || 'Não foi possível salvar o painel. Tente de novo.')
  }
  return body as T
}

/** Só aceita o que o servidor devolveu no formato esperado; o resto vira "padrão". */
function cleanPayload(raw: unknown, cafeId: string): LayoutsPayload {
  const out: LayoutsPayload = { cafe_id: cafeId, sections: {}, history: {} }
  const r = raw as Partial<LayoutsPayload> | null
  for (const [k, v] of Object.entries(r?.sections ?? {})) {
    if (!isDashSection(k) || !v || typeof v.version !== 'number') continue
    out.sections[k] = { version: v.version, items: Array.isArray(v.items) ? (v.items as Layout) : null, source: v.source, saved_at: v.saved_at }
  }
  for (const [k, v] of Object.entries(r?.history ?? {})) {
    if (isDashSection(k) && Array.isArray(v)) out.history[k] = v as HistoryEntry[]
  }
  return out
}

/** Acha a cafeteria da conta (a primeira, por enquanto) e carrega os painéis salvos dela. */
export async function loadLayouts(): Promise<LayoutsPayload> {
  const cafes = await rpc<{ id: string }[]>('list_my_cafes')
  const cafeId = cafes?.[0]?.id
  if (!cafeId) throw new Error('Nenhuma cafeteria vinculada a esta conta.')
  return cleanPayload(await rpc('get_dashboard_layouts', { p_cafe_id: cafeId }), cafeId)
}

export async function saveLayout(cafeId: string, section: DashSection, expectedVersion: number, items: Layout | null, source: 'manual' | 'ia' | 'reset') {
  return rpc<{ section: DashSection; version: number }>('save_dashboard_layout', { p_cafe_id: cafeId, p_section: section, p_expected_version: expectedVersion, p_items: items, p_source: source })
}

export async function restoreLayout(cafeId: string, section: DashSection, expectedVersion: number, version: number) {
  return rpc<{ section: DashSection; version: number }>('restore_dashboard_layout', { p_cafe_id: cafeId, p_section: section, p_expected_version: expectedVersion, p_version: version })
}
