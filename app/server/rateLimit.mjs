// Limite de tentativas por IP, em memória. Em servidor sem estado (Vercel) cada instância tem a sua
// contagem, então é uma barreira de melhor esforço contra tentativa em massa, não uma garantia.
export function createLimiter({ max, windowMs }) {
  const hits = new Map()
  return function limited(key, now = Date.now()) {
    if (hits.size > 5000) for (const [k, list] of hits) if (!list.some((t) => now - t < windowMs)) hits.delete(k)
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      hits.set(key, recent)
      return Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000))
    }
    recent.push(now)
    hits.set(key, recent)
    return 0
  }
}

export function clientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first || req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || 'desconhecido'
}
