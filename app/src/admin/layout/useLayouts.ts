import { useCallback, useEffect, useRef, useState } from 'react'
import { ConflictError, loadLayouts, restoreLayout, saveLayout, type LayoutsPayload } from './api'
import { DEFAULT_LAYOUT, type DashSection, type Layout } from './model'

export type LayoutsStatus = 'loading' | 'ready' | 'unavailable'

/**
 * Painéis personalizados da cafeteria. Sem o servidor (ou sem cafeteria), o painel
 * continua no padrão e o modo editar fica indisponível: nunca quebra a tela.
 */
export function useLayouts() {
  const [status, setStatus] = useState<LayoutsStatus>('loading')
  const [data, setData] = useState<LayoutsPayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  const reload = useCallback(async () => {
    try {
      const next = await loadLayouts()
      if (!alive.current) return
      setData(next)
      setStatus('ready')
    } catch {
      if (!alive.current) return
      setStatus('unavailable')
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void reload()
    return () => {
      alive.current = false
    }
  }, [reload])

  /** Cartões que a seção mostra agora: o salvo ou, se não houver, o padrão. */
  const layoutOf = useCallback((section: DashSection): Layout => data?.sections[section]?.items ?? DEFAULT_LAYOUT[section], [data])
  const isCustom = useCallback((section: DashSection) => !!data?.sections[section]?.items, [data])
  const versionOf = useCallback((section: DashSection) => data?.sections[section]?.version ?? 0, [data])

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true)
      setError(null)
      try {
        await fn()
        await reload()
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Não foi possível salvar o painel.')
        if (e instanceof ConflictError) await reload()
        return false
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [reload],
  )

  const save = useCallback(
    (section: DashSection, items: Layout, source: 'manual' | 'ia' = 'manual') => (data ? run(() => saveLayout(data.cafe_id, section, versionOf(section), items, source)) : Promise.resolve(false)),
    [data, run, versionOf],
  )
  /** Voltar ao padrão: a seção deixa de ter versão personalizada (o histórico fica). */
  const reset = useCallback((section: DashSection) => (data ? run(() => saveLayout(data.cafe_id, section, versionOf(section), null, 'reset')) : Promise.resolve(false)), [data, run, versionOf])
  const restore = useCallback((section: DashSection, version: number) => (data ? run(() => restoreLayout(data.cafe_id, section, versionOf(section), version)) : Promise.resolve(false)), [data, run, versionOf])
  /** Desfazer: volta para a versão imediatamente anterior à atual. */
  const undo = useCallback(
    (section: DashSection) => {
      const history = data?.history[section] ?? []
      const prev = history.find((h) => h.version < versionOf(section))
      return prev ? restore(section, prev.version) : Promise.resolve(false)
    },
    [data, restore, versionOf],
  )
  const canUndo = useCallback((section: DashSection) => (data?.history[section] ?? []).some((h) => h.version < versionOf(section)), [data, versionOf])

  return { status, busy, error, clearError: () => setError(null), data, layoutOf, isCustom, versionOf, save, reset, restore, undo, canUndo }
}
