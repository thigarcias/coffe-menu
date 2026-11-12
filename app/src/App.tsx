import { useCallback, useMemo, useRef, useState } from 'react'
import menuData from './data/menu.json'
import type { Menu, MenuItem } from './types'
import { Feed, type FeedHandle } from './components/Feed'
import { CategoryBar } from './components/CategoryBar'
import { GridView } from './components/GridView'
import { Sheet } from './components/Sheet'
import { DetailSheet } from './components/DetailSheet'
import { Quiz } from './components/Quiz'
import { ListSheet } from './components/ListSheet'
import { Grid, List, Reels, Sparkle } from './components/Icons'
import { track } from './lib/track'

const menu = menuData as Menu

const FAV_KEY = 'cm.favorites'
const loadFavs = () => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]'))
  } catch {
    return new Set<string>()
  }
}

type Panel = { kind: 'detail'; item: MenuItem } | { kind: 'quiz' } | { kind: 'list' } | null

export default function App() {
  // Itens na ordem das categorias, para o feed passar seção por seção.
  const items = useMemo(() => {
    const order = new Map(menu.categories.map((c, i) => [c.id, i]))
    return [...menu.items].sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99))
  }, [])
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
  const [favorites, setFavorites] = useState(loadFavs)
  const [panel, setPanel] = useState<Panel>(null)

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      const on = !next.has(id)
      if (on) next.add(id)
      else next.delete(id)
      track({ type: 'favorite', itemId: id, on })
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      } catch {
        /* ignora */
      }
      return next
    })
  }, [])

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

  const switchMode = () => {
    const next = mode === 'feed' ? 'grid' : 'feed'
    setMode(next)
    track({ type: 'view_mode', mode: next })
  }

  const favItems = items.filter((i) => favorites.has(i.id))

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
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onDetails={openDetails}
        onActive={onActive}
      />

      {mode === 'grid' && (
        <GridView categories={categories} items={items} favorites={favorites} onOpen={openDetails} />
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
          onClick={() => {
            track({ type: 'quiz_open' })
            setPanel({ kind: 'quiz' })
          }}
        >
          <Sparkle /> <span>Me ajuda a escolher</span>
        </button>
        <div className="glass dock__group">
          <button className="dock__btn" onClick={() => setPanel({ kind: 'list' })} aria-label="Quero provar">
            <List />
            {favorites.size > 0 && <span className="count">{favorites.size}</span>}
          </button>
          <button className="dock__btn" onClick={switchMode} aria-label={mode === 'feed' ? 'Ver tudo' : 'Ver em tela cheia'}>
            {mode === 'feed' ? <Grid /> : <Reels />}
          </button>
        </div>
      </footer>

      <Sheet open={panel?.kind === 'detail'} onClose={() => setPanel(null)} title="Detalhes" fixed>
        {panel?.kind === 'detail' && (
          <DetailSheet
            item={panel.item}
            fav={favorites.has(panel.item.id)}
            onToggleFavorite={toggleFavorite}
            storyNote={menu.cafe.storyNote}
            label={catName(panel.item.subcategory ?? panel.item.category)}
          />
        )}
      </Sheet>
      <Sheet open={panel?.kind === 'quiz'} onClose={() => setPanel(null)} title="Me ajuda a escolher">
        <Quiz items={items} onPick={goToItem} />
      </Sheet>
      <Sheet open={panel?.kind === 'list'} onClose={() => setPanel(null)} title="Quero provar">
        <ListSheet items={favItems} onOpen={goToItem} onRemove={toggleFavorite} />
      </Sheet>
    </div>
  )
}
