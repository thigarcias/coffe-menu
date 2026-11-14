import { supabase } from '../lib/adminAuth'

export interface SuggestedPalette {
  name: string
  note: string
  accent: string
  secondary: string
  background: string
  soft: string
}
export type PaletteResult = { ok: true; palettes: SuggestedPalette[]; source: string } | { ok: false; message: string }

const FALLBACK = 'Não consegui sugerir paletas agora. Escolha um tema pronto ou ajuste as cores à mão.'

/** Pede 3 paletas à IA. Nada é gravado: o dono escolhe uma e vê na prévia antes de salvar. */
export async function askPalettes(colors: string[], images: string[]): Promise<PaletteResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, message: 'Sua sessão expirou. Entre novamente para continuar.' }
  try {
    const response = await fetch('/api/admin-palette', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ colors: colors.map((hex) => ({ hex })), images }),
    })
    const body = (await response.json().catch(() => null)) as (PaletteResult & { error?: string }) | null
    if (response.ok && body && 'ok' in body) return body
    const friendly = [400, 401, 403, 413].includes(response.status) && typeof body?.error === 'string' ? body.error : null
    return { ok: false, message: friendly ?? FALLBACK }
  } catch {
    return { ok: false, message: FALLBACK }
  }
}
