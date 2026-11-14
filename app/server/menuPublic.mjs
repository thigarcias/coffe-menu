// A API pública só chama a função que devolve a versão publicada da unidade.
export async function handlePublicMenu(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(JSON.stringify({ error: 'Método não permitido.' })) }
  const slug = new URL(req.url, 'http://localhost').searchParams.get('slug')
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'Unidade inválida.' })) }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'Cardápio indisponível.' })) }
  try {
    const response = await fetch(new URL('/rest/v1/rpc/get_published_menu', url), { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_slug: slug }), signal: AbortSignal.timeout(8000) })
    if (!response.ok) { res.statusCode = 502; return res.end(JSON.stringify({ error: 'Cardápio indisponível.' })) }
    const data = await response.json()
    if (!data) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'Unidade não encontrada.' })) }
    // Foto enviada pelo editor (chave privada no Storage): vira URL desta API. Arquivo do próprio app
    // (cardápio de referência: menu/x.jpg, video/x.mp4): vai como caminho absoluto do site.
    const mediaUrl = (key) => typeof key === 'string' && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(key)
      ? `/api/menu-media?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(key)}` : null
    const staticAsset = (path, kinds) => typeof path === 'string' && new RegExp(`^(${kinds})/[A-Za-z0-9._-]+$`).test(path) && !path.includes('..') ? `/${path}` : null
    if (data.menu && Array.isArray(data.menu.items)) {
      for (const item of data.menu.items) {
        item.image = mediaUrl(item.image) ?? staticAsset(item.image, 'menu')
        item.video = staticAsset(item.video, 'video') ?? undefined
        if (item.video === undefined) delete item.video
      }
      const branding = data.menu.cafe?.branding
      if (branding) { branding.logo_url = mediaUrl(branding.logo_key); delete branding.logo_key }
    }
    return res.end(JSON.stringify(data))
  } catch { res.statusCode = 503; return res.end(JSON.stringify({ error: 'Cardápio indisponível.' })) }
}

