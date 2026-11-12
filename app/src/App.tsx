import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import menuData from './data/menu.json'
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

const menu = menuData as Menu
const orderBy: OrderBy = menu.cafe.orderBy ?? 'nome'
const tags = tagIndex(menu.tagGroups)

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

export default function App() {
  // Itens na ordem das categorias, para o feed passar seção por seção.
  const items = useMemo(() => {
    const order = new Map(menu.categories.map((c, i) => [c.id, i]))
    return [...menu.items].sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99))
  }, [])
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const categories = useMemo(
    () => menu.categories.filter((c) => items.some((i) => i.category === c.id)),
    [items],
  )
  const catName = useCallback(
    (id: string) => (menu.subcategories ?? []).find((c) => c.id === id)?.name ?? menu.categories.find((c) => c.id === id)?.name ?? id,
    [],
  )

  const feed = useRef<FeedHandle>(null)
  const [mode, setMode] = useState<'feed' | 'grid'>('feed')
  const [activeCat, setActiveCat] = useState<string | null>(categories[0]?.id ?? null)
  const [panel, setPanel] = useState<Panel>(null)
  // filtro por tag na grade ("tudo com caramelo")
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const gridItems = useMemo(() => (tagFilter ? withTag(items, tagFilter) : items), [items, tagFilter])
  const gridCats = useMemo(() => categories.filter((c) => gridItems.some((i) => i.category === c.id)), [categories, gridItems])

  // Sacola e pedido ficam guardados no celular.
  const [cart, setCart] = useState<CartLine[]>(() => loadCart(items))
  const [order, setOrder] = useState<Order | null>(() => loadOrder(items))
  useEffect(() => saveCart(cart), [cart])
  useEffect(() => saveOrder(order), [order])
  const stage = useStage(order)

  const count = cartCount(cart)
  const total = cartTotal(cart, byId)
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
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(20, l.qty + delta)) } : l)))
  }, [])

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
      const set = optionSetOf(item)
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
    [undoAdd],
  )

  const saveCustom = (choices: Choices, note: string) => {
    if (panel?.kind !== 'customize') return
    const { key, fromAdd, back } = panel
    const line = cart.find((l) => l.key === key)
    if (line) {
      const item = byId.get(line.itemId)!
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

  const sendOrder = (name: string, table: string) => {
    const sent: Order = { code: newCode(), name, table, lines: cart, total, sentAt: Date.now() }
    track({ type: 'order_sent', items: count, total, by: orderBy })
    setOrder(sent)
    setCart([])
    setPanel({ kind: 'order' })
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

  const pickCategory = (id: string) => {
    setActiveCat(id)
    track({ type: 'category', categoryId: id })
    if (mode === 'grid') {
      document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      const first = items.find((i) => i.category === id)
      if (first) feed.current?.scrollTo(first.id, false)
    }
  }

  const goToItem = (item: MenuItem) => {
    setPanel(null)
    setMode('feed')
    requestAnimationFrame(() => feed.current?.scrollTo(item.id, false))
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
    <div className="app">
      <header className="top">
        <span className="brand">{menu.cafe.name}</span>
        <CategoryBar categories={categories} active={activeCat} onPick={pickCategory} />
      </header>

      <Feed
        ref={feed}
        items={items}
        categoryName={catName}
        counts={counts}
        onAdd={(item) => addToCart(item, 'feed')}
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

      <footer className={`dock ${panel ? 'dock--hidden' : ''}`}>
        <button
          className="glass capsule capsule--lg dock__help"
          aria-label="Me ajuda a escolher"
          onClick={() => {
            track({ type: 'quiz_open' })
            setPanel({ kind: 'quiz' })
          }}
        >
          <Sparkle /> <span>Me ajuda a escolher</span>
        </button>
        <div className="glass dock__group">
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
            key={panel.item.id}
            item={panel.item}
            onAdd={(item) => {
              addToCart(item, 'detail')
              setPanel(null)
            }}
            storyNote={menu.cafe.storyNote}
            label={catName(panel.item.subcategory ?? panel.item.category)}
            tags={(panel.item.labels ?? []).flatMap((t) => tags.get(t) ?? [])}
            related={related(panel.item, items, tags)}
            onTag={pickTag}
            onOpenItem={openRelated}
          />
        )}
      </Sheet>
      <Sheet open={panel?.kind === 'quiz'} onClose={closePanel} title="Me ajuda a escolher">
        <Quiz items={items} onPick={goToItem} counts={counts} onAdd={(item) => addToCart(item, 'quiz')} />
      </Sheet>
      <Sheet open={panel?.kind === 'cart'} onClose={closePanel} title="Sacola" tall>
        <CartSheet
          lines={cart}
          byId={byId}
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
