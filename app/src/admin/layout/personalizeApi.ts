import { supabase } from '../../lib/adminAuth'
import type { DashSection, Layout } from './model'

export type PersonalizeResult = { ok: true; layout: Layout; changes: string[] } | { ok: false; kind: string; message: string }

/** Pede à IA uma proposta de layout. Nada é gravado: a proposta só vira rascunho na tela. */
export async function askPersonalize(section: DashSection, prompt: string, current: Layout, signal?: AbortSignal): Promise<PersonalizeResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, kind: 'sessao', message: 'Sua sessão expirou. Entre novamente para continuar.' }
  try {
    const response = await fetch('/api/admin-personalize', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ section, prompt, current }),
    })
    const body = (await response.json().catch(() => null)) as (PersonalizeResult & { error?: string }) | null
    if (response.ok && body && typeof body === 'object' && 'ok' in body) return body
    // só repassa o aviso do servidor quando é um erro de acesso (login, permissão); o resto vira a mensagem padrão
    const friendly = [400, 401, 403, 413].includes(response.status) && typeof body?.error === 'string' ? body.error : null
    return { ok: false, kind: 'indisponivel', message: friendly ?? 'A IA não está disponível agora. Você ainda pode personalizar o painel à mão.' }
  } catch (e) {
    if (signal?.aborted) return { ok: false, kind: 'cancelado', message: '' }
    return { ok: false, kind: 'indisponivel', message: 'A IA não está disponível agora. Você ainda pode personalizar o painel à mão.' }
  }
}

/** Pedidos prontos para tocar (o dono não precisa saber o que escrever). */
export const PERSONALIZE_SUGGESTIONS: Record<DashSection, string[]> = {
  visao: ['Só os indicadores de vendas e pedidos', 'Mostrar vendas por categoria aqui', 'Traz “Por que vendeu” para o topo'],
  vendas: ['Troca o gráfico de vendas por barras por dia da semana', 'Só os gelados, por hora', 'Traz o funil para o topo'],
  produtos: ['Mostra só os 5 mais vendidos', 'Vendas por origem das visitas', 'Esconde a vitrine'],
  ia: ['Mostra só os pedidos que usaram a IA', 'Traz Parecidos para o topo', 'Esconde a recomendação da IA'],
  trafego: ['Pedidos por hora só dos gelados', 'Mostra de onde vêm as vendas', 'Esconde o mapa de calor'],
}
