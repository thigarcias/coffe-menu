import { lazy, StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { PublishedMenuResponse } from './types'
import { App } from './App.tsx'
import { fetchPublishedMenu, PublicMenuError } from './lib/publicMenu'
import './index.css'

// /admin continua separado e lazy: o cardápio público não baixa o painel.
const Admin = lazy(() => import('./OwnerArea.tsx'))

function PublicUnitMenu({ slug }: { slug: string }) {
  const [result, setResult] = useState<PublishedMenuResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setError(null)
    setPreparing(false)
    void fetchPublishedMenu(slug, controller.signal)
      .then((published) => setResult(published))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        if (reason instanceof PublicMenuError) {
          setError(reason.message)
          setPreparing(reason.preparing)
        } else {
          setError('Não foi possível carregar este cardápio.')
        }
      })
    return () => controller.abort()
  }, [slug, attempt])

  useEffect(() => {
    const refresh = () => { if (!document.hidden) void fetchPublishedMenu(slug).then((latest) => { setResult(latest); setError(null); setPreparing(false) }).catch(() => {}) }
    const timer = window.setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [slug])

  if (error) {
    if (preparing) {
      return (
        <main className="public-state">
          <section className="public-state__content" role="status">
            <span className="public-state__mark" aria-hidden>☕</span>
            <h1>Cardápio em preparação</h1>
            <p>{error}</p>
          </section>
        </main>
      )
    }
    return (
      <main className="public-state">
        <section className="public-state__content" role="alert">
          <h1>Cardápio indisponível</h1>
          <p>{error}</p>
          <button className="cta" onClick={() => setAttempt((n) => n + 1)}>Tentar novamente</button>
        </section>
      </main>
    )
  }

  if (!result) {
    return (
      <main className="public-state" role="status" aria-live="polite">
        <section className="public-state__content">
          <span className="public-state__mark" aria-hidden>☕</span>
          <p>Carregando cardápio…</p>
        </section>
      </main>
    )
  }

  return <App menu={result.menu} storageScope={`unit:${result.cafe.id}`} refreshMenu={async () => { const latest = await fetchPublishedMenu(slug); setResult(latest); return latest.menu }} />
}

function RouteNotFound() {
  return (
    <main className="public-state">
      <section className="public-state__content" role="status">
        <h1>Endereço não encontrado</h1>
        <p>Confira o QR Code ou o link do cardápio.</p>
      </section>
    </main>
  )
}

const pathname = window.location.pathname
const isAdmin = /^\/admin\/?$/.test(pathname)
const isRoot = pathname === '/'
const unitSlug = isRoot ? new URLSearchParams(window.location.search).get('unidade')?.trim() : ''
const hasUnitSlug = Boolean(unitSlug)
const root = createRoot(document.getElementById('root')!)

root.render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={null}><Admin /></Suspense>
    ) : hasUnitSlug ? (
      <PublicUnitMenu slug={unitSlug!} />
    ) : isRoot ? (
      // O menu local de referência continua exclusivamente na raiz sem unidade.
      <App />
    ) : (
      <RouteNotFound />
    )}
  </StrictMode>,
)

