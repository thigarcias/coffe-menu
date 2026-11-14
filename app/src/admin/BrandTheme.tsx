import { THEMES, THEME_FIELDS, presetOf, resolveTheme, themeWarnings, type ThemeBranding, type ThemeField } from '../lib/theme'

const FIELD_INFO: Record<ThemeField, { label: string; hint: string }> = {
  accent_color: { label: 'Principal', hint: 'Rótulos, botões, passos do pedido e o nome no topo.' },
  secondary_color: { label: 'Secundária', hint: 'Detalhes quentes e a descrição abaixo do nome.' },
  background_color: { label: 'Fundo', hint: 'O fundo atrás de tudo, inclusive o tom suave das fotos.' },
  soft_color: { label: 'Chips e seleção', hint: 'Opções marcadas, etiquetas e caixas de destaque.' },
}

interface Props {
  branding?: ThemeBranding | null
  onChange: (patch: ThemeBranding) => void
}

/** Escolha do tema do cardápio: temas prontos e, em "Ajustar cada cor", o controle fino. */
export function BrandTheme({ branding, onChange }: Props) {
  const current = resolveTheme(branding)
  const preset = presetOf(branding?.theme)
  const custom = !!current && !preset
  const warnings = themeWarnings(branding)

  const pick = (id: string) => {
    const t = THEMES.find((x) => x.id === id)
    if (t) onChange({ theme: t.id, accent_color: t.accent, secondary_color: t.secondary, background_color: t.background, soft_color: t.soft })
  }
  const setField = (field: ThemeField, value: string) => {
    // Cores que o dono ainda não definiu são fixadas com o valor que ele está vendo, para não mudarem sozinhas.
    const base: ThemeBranding = {
      accent_color: current?.accent ?? null,
      secondary_color: current?.secondary ?? null,
      background_color: current?.background ?? null,
      soft_color: current?.soft ?? null,
    }
    onChange({ ...base, ...(branding ?? {}), theme: null, [field]: value })
  }
  const colorOf = (field: ThemeField) =>
    (branding?.[field] as string | null | undefined) ||
    (current ? { accent_color: current.accent, secondary_color: current.secondary, background_color: current.background, soft_color: current.soft }[field] : '')

  return (
    <div className="menu-editor__theme menu-editor__wide">
      <div className="menu-editor__theme-head">
        <strong>Cores do cardápio</strong>
        <small>{preset ? `Tema ${preset.name}` : custom ? 'Cores personalizadas' : 'Visual padrão (Matcha)'}</small>
      </div>
      <div className="menu-editor__themes" role="group" aria-label="Temas prontos">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="menu-editor__theme-chip"
            aria-pressed={preset?.id === t.id}
            onClick={() => pick(t.id)}
          >
            <span className="menu-editor__swatch" aria-hidden>
              <i style={{ background: t.background }} />
              <i style={{ background: t.soft }} />
              <i style={{ background: t.accent }} />
              <i style={{ background: t.secondary }} />
            </span>
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      <details className="menu-editor__theme-adv" open={custom}>
        <summary>Ajustar cada cor</summary>
        <div className="menu-editor__theme-fields">
          {THEME_FIELDS.map((field) => (
            <label key={field}>
              <span>{FIELD_INFO[field].label}</span>
              <small>{FIELD_INFO[field].hint}</small>
              <div className="menu-editor__color-field">
                <input type="color" aria-label={`Escolher cor ${FIELD_INFO[field].label.toLowerCase()}`} value={colorOf(field) || '#4f7f64'} onChange={(e) => setField(field, e.target.value)} />
                <input
                  aria-label={`Código da cor ${FIELD_INFO[field].label.toLowerCase()}`}
                  value={(branding?.[field] as string | null | undefined) ?? ''}
                  maxLength={7}
                  placeholder={colorOf(field) || '#4F7F64'}
                  onChange={(e) => onChange({ theme: null, [field]: e.target.value })}
                />
              </div>
            </label>
          ))}
        </div>
        {(branding?.theme || custom) && (
          <button
            type="button"
            className="menu-editor__text-button"
            onClick={() => onChange({ theme: null, accent_color: null, secondary_color: null, background_color: null, soft_color: null })}
          >
            Voltar ao visual padrão
          </button>
        )}
      </details>
      {warnings.map((w) => (
        <p key={w} className="menu-editor__theme-warn" role="status">{w}</p>
      ))}
    </div>
  )
}
