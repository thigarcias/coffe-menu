import { useState, type FormEvent } from 'react'
import './team.css'

type Member = { name: string; email: string; role: string; status: 'Ativa' | 'Convite pendente'; permissions: string[] }
const options = ['Cardápio', 'Pedidos', 'Relatórios', 'Equipe e acessos']
const initial: Member[] = [
  { name: 'Ana Costa', email: 'ana@exemplo.com', role: 'Proprietária', status: 'Ativa', permissions: options },
  { name: 'Bruno Martins', email: 'bruno@exemplo.com', role: 'Gerente', status: 'Ativa', permissions: options.slice(0, 3) },
  { name: 'Julia Lima', email: 'julia@exemplo.com', role: 'Atendente', status: 'Convite pendente', permissions: options.slice(0, 2) },
]
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()

export function Team() {
  const [people, setPeople] = useState(initial)
  const [filter, setFilter] = useState('Todas')
  const [editing, setEditing] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState(['Ana alterou o acesso de Bruno · versão 3', 'Ana convidou Julia · versão 1'])
  const [showHistory, setShowHistory] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Personalizado')
  const [permissions, setPermissions] = useState<string[]>([])
  const [error, setError] = useState('')
  const visible = people.map((person, index) => ({ person, index })).filter(({ person }) => filter === 'Todas' || (filter === 'Ativas' ? person.status === 'Ativa' : person.status === 'Convite pendente'))
  function begin(index: number | null) {
    const p = index === null ? null : people[index]
    setEditing(index); setName(p?.name ?? ''); setEmail(p?.email ?? ''); setRole(p?.role ?? 'Personalizado'); setPermissions(p?.permissions ?? []); setError(''); setOpen(true)
  }
  function save(event: FormEvent) {
    event.preventDefault()
    if (people.some((p, i) => i !== editing && p.email.toLowerCase() === email.trim().toLowerCase())) { setError('Este e-mail já aparece na demonstração.'); return }
    const person: Member = { name: name.trim(), email: email.trim(), role, permissions, status: editing === null ? 'Convite pendente' : people[editing].status }
    if (editing === null) { setPeople([...people, person]); setHistory([`Convite de exemplo para ${person.name}`, ...history]) }
    else { setPeople(people.map((p, i) => i === editing ? person : p)); setHistory([`Acesso de exemplo de ${person.name} atualizado`, ...history]) }
    setOpen(false)
  }
  return <section id="equipe" className="adm-sec team" role="tabpanel" aria-labelledby="tab-equipe">
    <div className="team__intro"><div><p className="team__eyebrow">PESSOAS E PERMISSÕES</p><h2 id="h-equipe">Sua equipe, do seu jeito.</h2><p>Convide pessoas e escolha o que cada uma pode acessar.</p></div><button className="team__primary" onClick={() => begin(null)}>＋ Convidar pessoa</button></div>
    <p className="team__demo" role="status"><strong>Demonstração:</strong> dados fictícios. Alterações ficam apenas nesta tela e não enviam convites.</p>
    <div className="team__layout"><section className="adm-card team__card"><div className="team__head"><div><h3>Equipe</h3><p>Pessoas com acesso à cafeteria</p></div><span className="team__badge">{people.length} pessoas</span></div>
      <div className="team__filters" aria-label="Filtrar equipe">{['Todas', 'Ativas', 'Convites'].map((item) => <button key={item} className={filter === item ? 'is-on' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
      {visible.length === 0 && <p className="team__empty">Nenhuma pessoa nesta lista.</p>}
      {visible.map(({person, index}) => <div className="team__person" key={person.email}><span className="team__avatar">{initials(person.name)}</span><div className="team__person-info"><strong>{person.name}{index === 0 ? ' · você' : ''}</strong><small>{person.email}</small></div><span className="team__badge">{person.status === 'Convite pendente' ? person.status : person.role}</span>{index !== 0 && <button className="team__edit" onClick={() => begin(index)}>Editar</button>}</div>)}
    </section><div className="team__side"><section className="adm-card team__card"><h3>Perfis de acesso</h3><p>Um ponto de partida para cada pessoa.</p>{[['✦', 'Gerente', 'Cuida do cardápio e acompanha resultados.'], ['◌', 'Atendente', 'Acompanha pedidos e consulta o cardápio.'], ['◇', 'Personalizado', 'Escolha as permissões individualmente.']].map(([icon, title, description]) => <div className="team__role" key={title}><span>{icon}</span><div><strong>{title}</strong><small>{description}</small></div></div>)}</section>
      <section className="adm-card team__card"><h3>Atividade recente</h3><p>Alterações de acesso da equipe.</p>{history.slice(0, showHistory ? undefined : 2).map((event, i) => <div className="team__event" key={`${event}-${i}`}><span>●</span>{event}</div>)}<button className="team__link" onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Mostrar menos' : 'Ver histórico completo'} →</button></section></div></div>
    {open && <div className="team__overlay" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><div className="team__dialog" role="dialog" aria-modal="true" aria-labelledby="team-dialog-title"><div className="team__head"><div><p className="team__eyebrow">EQUIPE E ACESSOS</p><h2 id="team-dialog-title">{editing === null ? 'Convidar para a equipe' : 'Editar acesso'}</h2><p>Preencha os dados e escolha as permissões.</p></div><button className="team__close" onClick={() => setOpen(false)} aria-label="Fechar">×</button></div><form onSubmit={save}><label>Nome<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label><label>E-mail<input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Perfil inicial<select value={role} onChange={(e) => { const next = e.target.value; setRole(next); if (next === 'Gerente') setPermissions(options.slice(0, 3)); else if (next === 'Atendente') setPermissions(options.slice(0, 2)); else if (next === 'Sócio') setPermissions(options); }}><option>Personalizado</option><option>Gerente</option><option>Atendente</option><option>Sócio</option></select></label><strong>Permissões</strong>{options.map((option) => <label className="team__permission" key={option}><span>{option}</span><input type="checkbox" checked={permissions.includes(option)} onChange={(e) => { setRole('Personalizado'); setPermissions(e.target.checked ? [...permissions, option] : permissions.filter((p) => p !== option)) }} /></label>)}{error && <p role="alert">{error}</p>}<button className="team__primary" type="submit">{editing === null ? 'Simular convite' : 'Salvar na demonstração'}</button><p className="team__disclaimer">Demonstração: nenhum acesso real será alterado.</p></form></div></div>}
  </section>
}


