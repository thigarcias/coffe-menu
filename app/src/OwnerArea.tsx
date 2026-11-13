import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/adminAuth'
import './owner.css'

const Admin = lazy(() => import('./admin/Admin'))

export default function OwnerArea() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) {
      setError(authError.status === 400 || authError.status === 401
        ? 'Não foi possível entrar. Confira seu e-mail e sua senha e tente novamente.'
        : 'O acesso está indisponível no momento. Tente novamente em instantes.')
    }
    setPassword('')
    setBusy(false)
  }

  async function signOut() {
    setBusy(true)
    setError('')
    const { error: authError } = await supabase.auth.signOut({ scope: 'local' })
    if (authError) setError('Não foi possível sair. Tente novamente.')
    setBusy(false)
  }

  if (session?.user.app_metadata.coffe_admin === true && !session.user.is_anonymous) {
    return <>
      <Suspense fallback={<p role="status">Carregando painel…</p>}><Admin onSignOut={() => void signOut()} signingOut={busy} /></Suspense>
    </>
  }

  return <main className="owner"><div className="owner__card">
    <a className="owner__back" href="/">← Voltar ao cardápio</a>
    <p className="owner__eyebrow">ÁREA DA CAFETERIA</p>
    {loading ? <p role="status">Verificando acesso…</p> : session ? <>
      <h1>Acesso ainda não liberado</h1><p>Solicite a liberação do painel à equipe da Coffe Menu.</p>
      {error && <p role="alert" className="owner__error">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void signOut()}>Sair</button>
    </> : <>
      <h1>Entre na sua conta</h1><p>Acesse a área da sua cafeteria.</p>
      <form onSubmit={(event) => void signIn(event)}>
        <label htmlFor="owner-email">E-mail</label>
        <input id="owner-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <label htmlFor="owner-password">Senha</label>
        <input id="owner-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <p role="alert" className="owner__error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </>}
  </div></main>
}
