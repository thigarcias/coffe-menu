import { Fragment, useEffect, useState } from 'react'
import { addBuiltin, hiddenBuiltins, moveItem, removeItem, sameLayout, toggleSpan } from './edit'
import { DEFAULT_LAYOUT, type BuiltinId, type DashSection, type Layout, type LayoutItem } from './model'
import { SpecCard } from './SpecCard'
import type { useLayouts } from './useLayouts'
import { EDIT_SPAN, WIDGETS, type WidgetCtx } from './widgets'
import './layout.css'

type Layouts = ReturnType<typeof useLayouts>

interface Props {
  section: DashSection
  label: string
  sub: string
  layouts: Layouts
  ctx: WidgetCtx
}

const itemLabel = (i: LayoutItem) => (i.kind === 'builtin' ? WIDGETS[i.widget].label : i.spec.title)

function render(item: LayoutItem, ctx: WidgetCtx, wrapped: boolean) {
  return item.kind === 'builtin' ? WIDGETS[item.widget].render(ctx) : <SpecCard spec={item.spec} span={item.span} wrapped={wrapped} />
}

/**
 * Uma seção do Dashboard: mostra o layout salvo da cafeteria (ou o padrão do código) e, no
 * modo "Personalizar", deixa esconder, reordenar e restaurar cartões. As mudanças ficam num
 * rascunho local e só viram uma versão nova ao tocar em Salvar.
 */
export function SectionView({ section, label, sub, layouts, ctx }: Props) {
  const saved: Layout = layouts.layoutOf(section)
  const [draft, setDraft] = useState<Layout | null>(null) // null = não está editando
  const [confirmReset, setConfirmReset] = useState(false)
  const editing = draft !== null
  const canEdit = layouts.status === 'ready'

  // trocar de seção (ou o servidor devolver outra versão) encerra a edição em andamento
  useEffect(() => {
    setDraft(null)
    setConfirmReset(false)
  }, [section])

  const done = (ok: boolean) => {
    if (ok) {
      setDraft(null)
      setConfirmReset(false)
    }
  }
  const dirty = editing && !sameLayout(draft, saved)
  const hidden = editing ? hiddenBuiltins(draft, section) : { home: [], others: [] }
  const shown = editing ? draft : saved

  return (
    <section id={section} className="adm-sec" role="region" aria-labelledby={`h-${section}`}>
      <header className="adm-sec__head adm-sec__head--row">
        <div>
          <h2 id={`h-${section}`}>
            {label}
            {layouts.isCustom(section) && <span className="adm-pill adm-pill--sage">Personalizado</span>}
          </h2>
          <p>{sub}</p>
        </div>
        {canEdit && !editing && (
          <button type="button" className="adm-lb adm-edit-open" onClick={() => setDraft(saved)}>
            Personalizar
          </button>
        )}
      </header>

      {editing && (
        <div className="adm-editbar" role="region" aria-label={`Personalizar ${label}`}>
          <p className="adm-editbar__hint">
            Personalizando <b>{label}</b>. Suba, desça ou esconda os cartões. Vale para toda a equipe depois de <b>Salvar</b>.
          </p>
          <div className="adm-editbar__row adm-editbar__row--sub">
            <button type="button" className="adm-lb adm-lb--ghost" disabled={layouts.busy || !layouts.canUndo(section)} onClick={async () => done(await layouts.undo(section))}>
              Desfazer a última mudança salva
            </button>
            {layouts.isCustom(section) &&
              (confirmReset ? (
                <>
                  <button type="button" className="adm-lb adm-lb--danger" disabled={layouts.busy} onClick={async () => done(await layouts.reset(section))}>
                    Confirmar: voltar ao padrão
                  </button>
                  <button type="button" className="adm-lb adm-lb--ghost" onClick={() => setConfirmReset(false)}>
                    Não
                  </button>
                </>
              ) : (
                <button type="button" className="adm-lb adm-lb--ghost" disabled={layouts.busy} onClick={() => setConfirmReset(true)}>
                  Voltar ao padrão
                </button>
              ))}
          </div>
        </div>
      )}
      {layouts.error && (
        <p className="adm-editerr" role="alert">
          {layouts.error}{' '}
          <button type="button" className="adm-link" onClick={layouts.clearError}>
            Fechar
          </button>
        </p>
      )}

      <div className="adm-grid">
        {shown.length === 0 && <p className="adm-empty">Nenhum cartão aqui. Use “Cartões escondidos” para trazer de volta.</p>}
        {shown.map((item, i) =>
          editing ? (
            <div key={item.id} className={`adm-ed adm-ed--${item.kind === 'builtin' ? EDIT_SPAN[item.widget] : 's' + item.span}`}>
              <div className="adm-ed__bar">
                <span className="adm-ed__name">{itemLabel(item)}</span>
                <button type="button" className="adm-ed__btn" aria-label={`Subir ${itemLabel(item)}`} disabled={i === 0} onClick={() => setDraft(moveItem(draft, i, -1))}>
                  ↑
                </button>
                <button type="button" className="adm-ed__btn" aria-label={`Descer ${itemLabel(item)}`} disabled={i === shown.length - 1} onClick={() => setDraft(moveItem(draft, i, 1))}>
                  ↓
                </button>
                {item.kind === 'spec' && (
                  <button type="button" className="adm-ed__btn adm-ed__btn--text" aria-label={`Largura de ${item.spec.title}`} onClick={() => setDraft(toggleSpan(draft, item.id))}>
                    {item.span === 12 ? 'Inteira' : 'Metade'}
                  </button>
                )}
                <button type="button" className="adm-ed__btn adm-ed__btn--text" aria-label={`Esconder ${itemLabel(item)}`} onClick={() => setDraft(removeItem(draft, item.id))}>
                  Esconder
                </button>
              </div>
              {render(item, ctx, true)}
            </div>
          ) : (
            <Fragment key={item.id}>{render(item, ctx, false)}</Fragment>
          ),
        )}
      </div>

      {editing && (hidden.home.length > 0 || hidden.others.length > 0) && (
        <div className="adm-hidden" role="region" aria-label="Cartões escondidos">
          {hidden.home.length > 0 && (
            <>
              <h3 className="adm-sub">Cartões escondidos</h3>
              <HiddenList ids={hidden.home} onShow={(id) => setDraft(addBuiltin(draft, id))} />
            </>
          )}
          {hidden.others.length > 0 && (
            <details className="adm-hidden__more">
              <summary>Trazer cartões de outras seções</summary>
              <HiddenList ids={hidden.others} onShow={(id) => setDraft(addBuiltin(draft, id))} />
            </details>
          )}
        </div>
      )}
      {editing && (
        <div className="adm-dock" role="group" aria-label="Salvar ou cancelar a personalização">
          <p className="adm-dock__state" aria-live="polite">
            {layouts.busy ? 'Salvando…' : dirty ? 'Mudanças não salvas' : 'Sem mudanças'}
          </p>
          <button type="button" className="adm-lb adm-lb--solid" disabled={!dirty || layouts.busy} onClick={async () => done(await layouts.save(section, draft))}>
            Salvar
          </button>
          <button type="button" className="adm-lb" disabled={layouts.busy} onClick={() => setDraft(null)}>
            Cancelar
          </button>
        </div>
      )}
    </section>
  )
}

function HiddenList({ ids, onShow }: { ids: BuiltinId[]; onShow: (id: BuiltinId) => void }) {
  return (
    <ul>
      {ids.map((id) => (
        <li key={id}>
          <span>{WIDGETS[id].label}</span>
          <button type="button" className="adm-lb" aria-label={`Mostrar ${WIDGETS[id].label}`} onClick={() => onShow(id)}>
            Mostrar
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Usado pelos testes e pela doc: o padrão de cada seção, no código. */
export const defaultLayoutOf = (s: DashSection) => DEFAULT_LAYOUT[s]
