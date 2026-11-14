import type { Menu, PublicMenuLookupResponse, PublishedMenuResponse } from '../types'

export class PublicMenuError extends Error {
  readonly status?: number
  readonly preparing: boolean

  constructor(message: string, status?: number, preparing = false) {
    super(message)
    this.name = 'PublicMenuError'
    this.status = status
    this.preparing = preparing
  }
}

/** Aplica os overrides da unidade; produto sem override continua disponível. */
export function withAvailability(menu: Menu, availability: Record<string, boolean> = {}): Menu {
  return {
    ...menu,
    items: menu.items.map((item) => ({ ...item, available: availability[item.id] !== false })),
  }
}

/** Contrato público: GET /api/menu-public?slug=...; não usa o menu local como reserva. */
export async function fetchPublishedMenu(slug: string, signal?: AbortSignal): Promise<PublishedMenuResponse> {
  const query = new URLSearchParams({ slug })
  let response: Response
  try {
    response = await fetch(`/api/menu-public?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new PublicMenuError('Não foi possível conectar ao cardápio.')
  }

  if (!response.ok) {
    const message = response.status === 404
      ? 'Este cardápio não está publicado ou não foi encontrado.'
      : 'Não foi possível carregar este cardápio.'
    throw new PublicMenuError(message, response.status)
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new PublicMenuError('O servidor devolveu um cardápio inválido.')
  }

  if (!data || typeof data !== 'object') throw new PublicMenuError('O servidor devolveu um cardápio inválido.')
  const payload = data as Partial<PublicMenuLookupResponse>
  if (
    !payload.cafe || typeof payload.cafe.id !== 'string' || typeof payload.cafe.slug !== 'string' ||
    typeof payload.cafe.name !== 'string'
  ) {
    throw new PublicMenuError('O servidor devolveu um cardápio inválido.')
  }
  if (!payload.menu || !payload.revision) {
    throw new PublicMenuError('Esta unidade ainda está preparando o cardápio.', 404, true)
  }
  if (
    !payload.menu.cafe || !Array.isArray(payload.menu.items) || !Array.isArray(payload.menu.categories) ||
    typeof payload.revision.publication_id !== 'string' || typeof payload.revision.version_id !== 'string' ||
    typeof payload.revision.version !== 'number' || typeof payload.revision.published_at !== 'string'
  ) throw new PublicMenuError('O servidor devolveu um cardápio inválido.')

  const availability = payload.availability && typeof payload.availability === 'object' ? payload.availability : {}
  const menu = withAvailability(
    {
      ...payload.menu,
      cafe: { ...payload.menu.cafe, id: payload.cafe.id, slug: payload.cafe.slug },
    },
    availability,
  )

  return { ...payload, menu, availability } as PublishedMenuResponse
}

