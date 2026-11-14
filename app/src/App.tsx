import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import menuData from './data/menu.json'
import { themeVars } from './lib/theme'
import type { Menu, MenuItem, OrderBy } from './types'
import { Feed, type FeedHandle } from './components/Feed'
import { CategoryBar } from './components/CategoryBar'
import { GridView } from './components/GridView'
import { Sheet } from './components/Sheet'
import { DetailSheet } from './components/DetailSheet'
import { Quiz } from './components/Quiz'
import { CartSheet } from './components/CartSheet'
import { CustomizeSheet } from './components/CustomizeSheet'
import { OrderSheet } from './components/OrderSheet'
import { Toast, type ToastData } from './components/Toast'
import { Bag, Grid, Reels, Sparkle } from './components/Icons'
import { money } from './lib/format'
import { track } from './lib/track'
import { related, tagIndex, withTag } from './lib/related'
import {
  cartCount,
  cartTotal,
  defaultChoices,
  loadCart,
  loadOrder,
  makeLine,
  newCode,
  optionSetOf,
  saveCart,
  saveOrder,
  stageOf,
  STAGES,
  type CartLine,
  type Choices,
  type Order,
  type Stage,
} from './lib/cart'

const defaultMenu = menuData as Menu

type From = 'feed' | 'grid' | 'detail' | 'quiz'
type Panel =
  | { kind: 'detail'; item: MenuItem }
  | { kind: 'quiz' }
  | { kind: 'cart' }
  | { kind: 'order' }
  | { kind: 'customize'; key: string; /** acabou de entrar na sacola: personaliza só 1 unidade */ fromAdd: boolean; back: boolean }
  | null

/** Soma a linha na sacola: se já existe uma igual, só aumenta a quantidade. */
function upsert(lines: CartLine[], line: CartLine, at?: number): CartLine[] {
  const i = lines.findIndex((l) => l.key === line.key)
  if (i >= 0) return lines.map((l, j) => (j === i ? { ...l, qty: l.qty + line.qty } : l))
  const out = [...lines]
  out.splice(at ?? out.length, 0, line)
  return out
}

/** Andamento do pedido, a partir de sentAt (sobrevive a recarregar a página). */
function useStage(order: Order | null): Stage | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!order) return
    const tick = () => {
      const n = Date.now()
      setNow(n)
      if (stageOf(order, n) === 2) clearInterval(id)
    }
    const id = setInterval(tick, 1000)
    tick()
    return () => clearInterval(id)
  }, [order])
  return order ? stageOf(order, now) : null
}

export interface AppProps {
  /** Menu por instância, usado no cardápio publicado e na prévia do painel. */
  menu?: Menu
  /** Namespace da sacola e do pedido; omitido, usa o estado legado da raiz. */
  storageScope?: string
  refreshMenu?: () => Promise<Menu>
}

const available = (item: MenuItem) => item.available !== false

export function App({ menu: menuProp, storageScope, refreshMenu }: AppProps = {}) {
  const menu = menuProp ?? defaultMenu
  const orderBy: OrderBy = menu.cafe.orderBy ?? 'nome'
  const cartScope = storageScope ?? (menuProp ? `preview:${menu.cafe.id ?? menu.cafe.slug ?? 'draft'}` : 'default')
  const tags = useMemo(() => tagIndex(menu.tagGroups), [menu.tagGroups])
  const themeStyle = themeVars(menu.cafe.branding) as CSSProperties

  // Itens na ordem das categorias, para o feed passar seção por seção.
  const items = useMemo(() => {
    const order = new Map(menu.categories.map((c, i) => [c.id, i]))
    return [...menu.items].sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99))
  }, [menu])
  // Um produto removido enquanto está na sacola continua visível para remoção,
  // marcado como indisponível; não volta a aparecer no cardápio.
  const previousItems = useRef(new Map<string, MenuItem>())
  const byId = useMemo(() => {
    const current = new Map(items.map((item) => [item.id, item]))
    for (const [id, item] of previousItems.current) if (!current.has(id)) current.set(id, { ...item, available: false })
    previousItems.current = current
    return current
  }, [items])
  const availableItems = useMemo(() => items.filter(available), [items])
  const categories = useMemo(
    () => menu.categories.filter((c) => items.some((i) => i.category === c.id)),
    [items, menu.categories],
  )
  const catName = useCallback(
    (id: string) => (menu.subcategories ?? []).find((c) => c.id === id)?.name ?? menu.categories.find((c) => c.id === id)?.name ?? id,
    [menu],
  )

  const feed = useRef<FeedHandle>(null)
  const [mode, setMode] = useState<'feed' | 'grid'>('feed')
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id ?? null)
  useEffect(() => setActiveCat(categories[0]?.id ?? null), [categories])
  const [panel, setPanel] = useState<Panel>(null)
  // filtro por tag na grade ("tudo com caramelo")
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const gridItems = useMemo(() => (tagFilter ? withTag(items, tagFilter) : items), [items, tagFilter])
  const gridCats = useMemo(() => categories.filter((c) => gridItems.some((i) => i.category === c.id)), [categories, gridItems])

  // Sacola e pedido ficam guardados no celular.
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(items, cartScope))
  const [order, setOrder] = useState<Order | null>(() => loadOrder(items, cartScope))
  useEffect(() => saveCart(cart, cartScope), [cart, cartScope])
  useEffect(() => saveOrder(order, cartScope), [order, cartScope])
  const stage = useStage(order)

  const count = cartCount(cart)
  const total = cartTotal(cart, byId, menu)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of cart) m.set(l.itemId, (m.get(l.itemId) ?? 0) + l.qty)
    return m
  }, [cart])

  // ---------- aviso ("Adicionado à sacola") ----------
  const [toast, setToast] = useState<ToastData | null>(null)
  const closeToast = useCallback(() => setToast(null), [])
  // abrir um painel (sacola, quiz…) tira o aviso da frente
  useEffect(() => {
    if (panel) setToast(null)
  }, [panel?.kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const changeQty = useCallback((key: string, delta: number) => {
    const line = cartRef.current.find((item) => item.key === key)
    if (delta > 0 && line && byId.get(line.itemId)?.available === false) return
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(20, l.qty + delta)) } : l)))
  }, [byId])

  // o aviso guarda funções criadas antes; a ref dá a elas a sacola de agora
  const cartRef = useRef(cart)
  cartRef.current = cart

  const removeLine = useCallback((key: string) => {
    const line = cartRef.current.find((l) => l.key === key)
    if (line) track({ type: 'cart_remove', itemId: line.itemId })
    setCart((prev) => prev.filter((l) => l.key !== key))
  }, [])

  /** Desfaz o "adicionar": tira uma unidade e, se era a única, a linha toda. */
  const undoAdd = useCallback(
    (key: string) => {
      const line = cartRef.current.find((l) => l.key === key)
      if (!line) return
      if (line.qty > 1) setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: l.qty - 1 } : l)))
      else removeLine(key)
    },
    [removeLine],
  )

  const addToCart = useCallback(
    (item: MenuItem, from: From) => {
      if (!available(item) || !byId.has(item.id) || !available(byId.get(item.id)!)) return
      const set = optionSetOf(item, menu)
      const line = makeLine(item, defaultChoices(item, set))
      setCart((prev) => upsert(prev, line))
      track({ type: 'cart_add', itemId: item.id, from, customized: false })
      if (set) {
        // bebida: entra com o padrão; a pessoa pode aceitar ou personalizar
        setToast({
          id: Date.now(),
          title: 'Adicionado à sacola',
          text: item.name,
          actions: [
            { label: 'Usar o padrão', onClick: () => {} },
            { label: 'Personalizar', primary: true, onClick: () => setPanel({ kind: 'customize', key: line.key, fromAdd: true, back: false }) },
          ],
        })
      } else {
        setToast({
          id: Date.now(),
          title: 'Adicionado à sacola',
          text: item.name,
          actions: [{ label: 'Desfazer', onClick: () => undoAdd(line.key) }],
        })
      }
    },
    [menu, undoAdd, byId],
  )

  const saveCustom = (choices: Choices, note: string) => {
    if (panel?.kind !== 'customize') return
    const { key, fromAdd, back } = panel
    const line = cart.find((l) => l.key === key)
    if (line) {
      const item = byId.get(line.itemId)
      if (!item || !available(item)) {
        setPanel(back ? { kind: 'cart' } : null)
        return
      }
      track({ type: 'cart_customize', itemId: item.id, choices })
      setCart((prev) => {
        const cur = prev.find((l) => l.key === key)
        if (!cur) return prev
        const at = prev.indexOf(cur)
        if (fromAdd && cur.qty > 1) {
          // das várias unidades, só a que acabou de entrar é personalizada
          const rest = prev.map((l) => (l.key === key ? { ...l, qty: l.qty - 1 } : l))
          return upsert(rest, makeLine(item, choices, note, 1))
        }
        const next = makeLine(item, choices, note, cur.qty)
        return upsert(prev.filter((l) => l.key !== key), next, at)
      })
    }
    setPanel(back ? { kind: 'cart' } : null)
  }

  const closePanel = () => setPanel(panel?.kind === 'customize' && panel.back ? { kind: 'cart' } : null)

  const sendingOrder = useRef(false)
  const sendOrder = async (name: string, table: string) => {
    if (sendingOrder.current) return
    sendingOrder.current = true
    let currentItems = byId
    if (refreshMenu) {
      try {
        const latest = await refreshMenu()
        currentItems = new Map(latest.items.map((item) => [item.id, item]))
        if (cart.some((line) => JSON.stringify(byId.get(line.itemId)?.prices) !== JSON.stringify(currentItems.get(line.itemId)?.prices) || JSON.stringify(menu.optionSets?.[byId.get(line.itemId)?.options ?? '']) !== JSON.stringify(latest.optionSets?.[currentItems.get(line.itemId)?.options ?? '']))) {
          window.alert('O cardápio mudou. Revise os itens e os preços antes de enviar o pedido.')
          setPanel({ kind: 'cart' }); sendingOrder.current = false; return
        }
      } catch {
        window.alert('Não foi possível confirmar a disponibilidade. Tente novamente quando estiver conectado.')
        sendingOrder.current = false; return
      }
    }
    if (cart.some((line) => !currentItems.has(line.itemId) || currentItems.get(line.itemId)?.available === false)) {
      window.alert('Um item da sacola ficou indisponível. Revise sua sacola antes de enviar.')
      setPanel({ kind: 'cart' })
      sendingOrder.current = false
      return
    }
    const sent: Order = { code: newCode(), name, table, lines: cart, total, sentAt: Date.now() }
    track({ type: 'order_sent', items: count, total, by: orderBy })
    setOrder(sent)
    setCart([])
    setPanel({ kind: 'order' })
    sendingOrder.current = false
  }

  // Dica "deslize": aparece enquanto a pessoa está no primeiro produto.
  const [atFirst, setAtFirst] = useState(true)
  const onActive = useCallback(
    (item: MenuItem) => {
      setActiveCat(item.category)
      setAtFirst(item.id === items[0]?.id)
    },
    [items],
  )

  // O feed mostra UMA categoria por vez e termina com um cartão "você viu tudo": sem rolagem sem fim.
  const feedItems = useMemo(() => items.filter((i) => i.category === activeCat), [items, activeCat])
  const catIndex = categories.findIndex((c) => c.id === activeCat)
  const nextCat = categories.length > 1 && catIndex >= 0 ? categories[(catIndex + 1) % categories.length] : null
  // rolar até um produto de OUTRA categoria: troca a categoria e rola quando o feed novo estiver na tela
  const pendingScroll = useRef<string | null>(null)
  useEffect(() => {
    if (pendingScroll.current && mode === 'feed') {
      feed.current?.scrollTo(pendingScroll.current, false)
      pendingScroll.current = null
    }
  }, [activeCat, mode])

  const pickCategory = (id: string) => {
    setActiveCat(id)
    track({ type: 'category', categoryId: id })
    if (mode === 'grid') {
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      const first = items.find((i) => i.category === id)
      if (first) {
        if (id === activeCat) feed.current?.scrollTo(first.id, false)
        else pendingScroll.current = first.id
      }
    }
  }

  const goToItem = (item: MenuItem) => {
    setPanel(null)
    pendingScroll.current = item.id
    setActiveCat(item.category)
    setMode('feed')
  }

  const openDetails = (item: MenuItem) => {
    track({ type: 'open_details', itemId: item.id })
    setPanel({ kind: 'detail', item })
  }

  const pickTag = (tagId: string) => {
    track({ type: 'tag', tagId, from: panel?.kind === 'detail' ? panel.item.id : null })
    setTagFilter(tagId)
    setPanel(null)
    setMode('grid')
    requestAnimationFrame(() => document.querySelector('.grid-view')?.scrollTo({ top: 0 }))
  }

  const openRelated = (item: MenuItem) => {
    if (panel?.kind === 'detail') track({ type: 'related_open', fromId: panel.item.id, itemId: item.id })
    openDetails(item)
  }

  // Na grade, o dock some ao rolar para baixo e volta ao rolar para cima ou ao parar.
  const [scrollingDown, setScrollingDown] = useState(false)
  const lastTop = useRef(0)
  const stopTimer = useRef<number | undefined>(undefined)
  const dockAway = mode === 'grid' && scrollingDown
  useEffect(() => {
    setScrollingDown(false)
    if (mode !== 'grid') return
    const el = document.querySelector<HTMLElement>('.grid-view')
    if (!el) return
    lastTop.current = el.scrollTop
    const onScroll = () => {
      const top = el.scrollTop
      const dy = top - lastTop.current
      lastTop.current = top
      if (dy > 4 && top > 40) setScrollingDown(true)
      else if (dy < -4 || top <= 40) setScrollingDown(false)
      window.clearTimeout(stopTimer.current)
      stopTimer.current = window.setTimeout(() => setScrollingDown(false), 800)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.clearTimeout(stopTimer.current)
    }
  }, [mode])

  const switchMode = () => {
    const next = mode === 'feed' ? 'grid' : 'feed'
    setTagFilter(null)
    setMode(next)
    track({ type: 'view_mode', mode: next })
  }

  // O botão do dock abre a sacola; sem nada nela e com pedido em andamento, abre o pedido.
  const openBag = () => setPanel(!count && order ? { kind: 'order' } : { kind: 'cart' })
  const showStatus = !count && order && stage != null
  const bagLabel = [
    'Sacola',
    count ? `${count} ${count === 1 ? 'item' : 'itens'}, ${money(total)}` : order && stage != null ? `pedido ${STAGES[stage]}` : 'vazia',
  ].join(': ')
  const editing = panel?.kind === 'customize' ? cart.find((l) => l.key === panel.key) : undefined

  return (
    <div className="app" style={themeStyle}>
      <header className="top">
        {menuProp ? <div className="brand brand--custom">
          {menu.cafe.branding?.logo_url && <img className="brand__logo" src={menu.cafe.branding.logo_url} alt="" />}
          <span className="brand__copy">
            <span className="brand__name">{menu.cafe.name}</span>
            {(menu.cafe.description ?? menu.cafe.branding?.description) && (
              <small className="brand__description">{menu.cafe.description ?? menu.cafe.branding?.description}</small>
            )}
          </span>
        </div> : <span className="brand">{menu.cafe.name}</span>}
        <CategoryBar categories={categories} active={activeCat} onPick={pickCategory} />
      </header>

      <Feed
        ref={feed}
        key={activeCat ?? 'todas'}
        items={feedItems}
        categoryLabel={catName(activeCat ?? '')}
        nextCategory={nextCat}
        wraps={catIndex === categories.length - 1}
        onNextCategory={() => nextCat && pickCategory(nextCat.id)}
        onGrid={switchMode}
        firstId={items[0]?.id}
        onEnd={() => { setAtFirst(false); if (activeCat) track({ type: 'category_end', categoryId: activeCat }) }}
        categoryName={catName}
        counts={counts}
        onDetails={openDetails}
        onActive={onActive}
      />

      {mode === 'grid' && (
        <GridView
          categories={gridCats}
          items={gridItems}
          counts={counts}
          onOpen={openDetails}
          onAdd={(item) => addToCart(item, 'grid')}
          filter={tagFilter ? { label: tags.get(tagFilter)?.label ?? tagFilter, count: gridItems.length } : null}
          onClearFilter={() => setTagFilter(null)}
        />
      )}

      {atFirst && mode === 'feed' && !panel && (
        <div className="swipe-hint" aria-hidden>
          <span>deslize</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      )}

      <footer className={`dock ${panel || dockAway ? 'dock--hidden' : ''}`}>
        <div className="glass dock__group">
          <button
            className="dock__btn dock__help"
            aria-label="Me ajuda a escolher"
            onClick={() => {
              track({ type: 'quiz_open' })
              setPanel({ kind: 'quiz' })
            }}
          >
            <Sparkle />
            <span className="dock__lbl">Me ajuda</span>
          </button>
          <button className="dock__btn dock__bag" onClick={openBag} aria-label={bagLabel}>
            <Bag />
            {count > 0 && <span className="count">{count}</span>}
            <span className={`dock__lbl ${count ? 'dock__total' : showStatus ? 'dock__status' : ''}`}>
              {count ? money(total) : showStatus ? `${STAGES[stage]}${stage < 2 ? '…' : '!'}` : 'Sacola'}
            </span>
          </button>
          <button className="dock__btn" onClick={switchMode} aria-label={mode === 'feed' ? 'Ver tudo' : 'Ver em tela cheia'}>
            {mode === 'feed' ? <Grid /> : <Reels />}
            <span className="dock__lbl">{mode === 'feed' ? 'Ver tudo' : 'Tela cheia'}</span>
          </button>
        </div>
      </footer>

      <Toast toast={toast} onClose={closeToast} top={!panel} />

      <Sheet open={panel?.kind === 'detail'} onClose={closePanel} title="Detalhes" fixed>
        {panel?.kind === 'detail' && (
          <DetailSheet
            reviewAllergens={menuProp !== undefined}
            key={panel.item.id}
            item={panel.item}
            menu={menu}
            onAdd={(item) => {
              addToCart(item, 'detail')
              setPanel(null)
            }}
            storyNote={menu.cafe.storyNote}
            label={catName(panel.item.subcategory ?? panel.item.category)}
            tags={(panel.item.labels ?? []).flatMap((t) => tags.get(t) ?? [])}
            related={related(panel.item, availableItems, tags)}
            onTag={pickTag}
            onOpenItem={openRelated}
          />
        )}
      </Sheet>
      <Sheet open={panel?.kind === 'quiz'} onClose={closePanel} title="Me ajuda a escolher">
        <Quiz
          items={availableItems}
          onPick={goToItem}
          counts={counts}
          onAdd={(item) => addToCart(item, 'quiz')}
          tagGroups={menu.tagGroups}
          localOnly={menuProp !== undefined}
        />
      </Sheet>
      <Sheet open={panel?.kind === 'cart'} onClose={closePanel} title="Sacola" tall>
        <CartSheet
          reviewAllergens={menuProp !== undefined}
          lines={cart}
          byId={byId}
          menu={menu}
          scope={cartScope}
          orderBy={orderBy}
          order={order}
          stage={stage}
          onQty={changeQty}
          onRemove={removeLine}
          onEdit={(key) => setPanel({ kind: 'customize', key, fromAdd: false, back: true })}
          onOpenItem={goToItem}
          onOpenOrder={() => setPanel({ kind: 'order' })}
          onCheckout={() => track({ type: 'checkout_start', items: count, total })}
          onSend={sendOrder}
        />
      </Sheet>
      <Sheet open={panel?.kind === 'customize'} onClose={closePanel} title="Personalizar" tall>
        {panel?.kind === 'customize' && editing && (
          <CustomizeSheet
            key={panel.key}
            item={byId.get(editing.itemId)!}
            menu={menu}
            initial={{ choices: editing.choices, note: editing.note }}
            qty={panel.fromAdd ? 1 : editing.qty}
            onSave={saveCustom}
          />
        )}
      </Sheet>
      <Sheet open={panel?.kind === 'order'} onClose={closePanel} title="Pedido" tall>
        {order && stage != null && (
          <OrderSheet
            order={order}
            stage={stage}
            menu={menu}
            byId={byId}
            onMore={() => {
              setOrder(null)
              setPanel(null)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

export default App

