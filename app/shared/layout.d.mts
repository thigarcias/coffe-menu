export const DASH_SECTIONS: readonly ['visao', 'vendas', 'produtos', 'ia', 'trafego']
export const SECTION_LABEL: Record<(typeof DASH_SECTIONS)[number], string>
export const SPANS: readonly [4, 5, 6, 7, 8, 12]
export const BUILTIN_INFO: Record<string, { label: string; home: (typeof DASH_SECTIONS)[number]; about: string }>
export const BUILTIN_IDS: string[]
