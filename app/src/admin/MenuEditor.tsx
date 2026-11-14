import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent } from 'react'
import QRCode from 'qrcode'
import App from '../App'
import menuReference from '../data/menu.json'
import type { Category, Choice, Menu, MenuItem, OptionGroup, OptionSet, Price, TagGroup } from '../types'
import { supabase } from '../lib/adminAuth'
import './menu-editor.css'

type Branding = {
  logo_key?: string | null
  logo_url?: string
  accent_color?: string | null
  secondary_color?: string | null
}

type EditorMenu = Omit<Menu, 'cafe'> & {
  cafe: Menu['cafe'] & { description?: string | null; branding?: Branding }
}

type CafeSummary = { id: string; slug: string; name: string }
type DraftVersion = { id: string; version: number; saved_at: string; saved_by?: string | null }
type MenuDraftRecord = {
  id: string
  name: string
  created_at: string
  updated_at: string
  current_version: number
  current_version_id: string
  menu: EditorMenu
  versions: DraftVersion[]
}
type Publication = {
  publication_id: string
  draft_id: string
  draft_name: string
  version_id: string
  version: number
  published_at: string
  published_by?: string | null
  menu?: EditorMenu
}
type Availability = { product_id: string; available: boolean; quantity?: number | null; note?: string | null; updated_at?: string }
type StockStatus = 'todos' | 'disponiveis' | 'indisponiveis' | 'baixo' | 'sem-controle'
type StockEntry = { available: boolean; quantity: number | null; note: string | null }
type PublishedMenu = Publication & { menu: EditorMenu }
type EditorWorkspace = {
  cafe: CafeSummary
  published: PublishedMenu | null
  drafts: MenuDraftRecord[]
  publications: Publication[]
  availability: Availability[] | Record<string, boolean | { available: boolean; quantity?: number | null; note?: string | null }>
}

type ProductForm = {
  id: string
  name: string
  category: string
  subcategory: string
  description: string
  lookalike: string
  image: string
  options: string
  badges: string
  allergens: string
  allergensVerified: boolean
  ingredients: string
  prices: { size: string; ml: string; price: string }[]
  tags: { sweet: string; bitter: string; milk: string; iced: string; caffeine: string; hunger: string }
  labels: string[]
  customLabels: string[]
}

type AiFill = {
  name: string; description: string; lookalike: string; ingredients: string[]; allergens: string[]
  labels: string[]; newLabels: string[]
  tags: { sweet: string; bitter: string; hunger: string; milk: string; iced: string; caffeine: string }
}

const PreviewApp = App as ComponentType<{ menu: Menu }>
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function blankMenu(cafe: CafeSummary): EditorMenu {
  return {
    cafe: { name: cafe.name, description: '', branding: { logo_key: null, accent_color: null, secondary_color: null }, orderBy: 'nome' },
    categories: [],
    subcategories: [],
    items: [],
    extras: [],
    optionSets: {},
    tagGroups: clone(menuReference.tagGroups),
  }
}

function normalizeMenu(menu: EditorMenu, cafe: CafeSummary): EditorMenu {
  const next = clone(menu)
  next.cafe ??= { name: cafe.name }
  next.cafe.name ||= cafe.name
  next.cafe.branding ??= { logo_key: null, accent_color: null, secondary_color: null }
  next.categories ??= []
  next.subcategories ??= []
  next.items ??= []
  next.extras ??= []
  next.optionSets ??= {}
  if (!next.tagGroups?.length) next.tagGroups = clone(menuReference.tagGroups)
  return next
}

function idFromName(name: string, prefix: string) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const fallback = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : String(Date.now())
  return `${prefix}-${slug || fallback}`
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
  return data.session.access_token
}

async function callRpc<T>(rpc: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch('/api/menu-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rpc, args }),
  })
  const result = await response.json().catch(() => null) as ({ message?: string } & object) | T | null
  if (!response.ok) {
    if (response.status === 409) throw new Error('Este rascunho mudou em outra tela. Recarregue-o antes de salvar de novo.')
    const message = result && typeof result === 'object' && 'message' in result ? String(result.message ?? '') : ''
    throw new Error(message || 'Não foi possível atualizar o cardápio. Tente novamente.')
  }
  return result as T
}

async function readFileAsBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler a imagem.'))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
  return dataUrl.slice(dataUrl.indexOf(',') + 1)
}

async function uploadImage(cafeId: string, file: File) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.')
  if (file.size > 3 * 1024 * 1024) throw new Error('A imagem precisa ter até 3 MB.')
  const token = await getAccessToken()
  const response = await fetch('/api/menu-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cafeId, data: await readFileAsBase64(file), type: file.type }),
  })
  const result = await response.json().catch(() => null) as { key?: string; message?: string } | null
  if (!response.ok || !result?.key) throw new Error(result?.message || 'Não foi possível enviar a imagem.')
  return result.key
}

async function resolvePrivateImage(cafeId: string, key: string) {
  const token = await getAccessToken()
  const response = await fetch('/api/menu-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cafeId, action: 'preview', key }),
  })
  const result = await response.json().catch(() => null) as { url?: string; message?: string } | null
  if (!response.ok || !result?.url) throw new Error(result?.message || 'Não foi possível abrir esta imagem.')
  return result.url
}

async function requestFill(cafeId: string, form: ProductForm, brief: string, tagGroups: TagGroupLite[]): Promise<AiFill> {
  const token = await getAccessToken()
  const response = await fetch('/api/menu-suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ cafeId, mode: 'fill', tagGroups, product: { brief, name: form.name, description: form.description, ingredients: csv(form.ingredients) } }),
  })
  const result = await response.json().catch(() => null) as (AiFill & { message?: string }) | null
  if (!response.ok || !result) throw new Error(result?.message || 'Não foi possível preencher com a IA agora.')
  return { ...result, allergens: result.allergens ?? [], labels: result.labels ?? [], newLabels: result.newLabels ?? [], ingredients: result.ingredients ?? [] }
}

/** Aplica a proposta da IA só nos campos vazios: o que a pessoa já escreveu nunca é sobrescrito. */
function applyFill(form: ProductForm, fill: AiFill) {
  const changed: string[] = []
  const next: ProductForm = { ...form, tags: { ...form.tags }, labels: [...form.labels], customLabels: [...form.customLabels] }
  if (!next.name.trim() && fill.name) { next.name = fill.name; changed.push('nome') }
  if (!next.description.trim() && fill.description) { next.description = fill.description; changed.push('descrição') }
  if (!next.lookalike.trim() && fill.lookalike) { next.lookalike = fill.lookalike; changed.push('“com o que se parece”') }
  if (!next.ingredients.trim() && fill.ingredients.length) { next.ingredients = fill.ingredients.join(', '); changed.push('ingredientes') }
  const tagNames = { sweet: 'doçura', bitter: 'amargor', hunger: 'fome', milk: 'leite', iced: 'gelado', caffeine: 'cafeína' } as const
  const filled: string[] = []
  for (const key of Object.keys(tagNames) as (keyof typeof tagNames)[]) if (next.tags[key] === '' && fill.tags[key] !== '') { next.tags[key] = fill.tags[key]; filled.push(tagNames[key]) }
  if (filled.length) changed.push('características')
  const addedLabels = fill.labels.filter((id) => !next.labels.includes(id))
  const addedCustom = fill.newLabels.filter((label) => !next.customLabels.some((item) => item.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR')))
  next.labels.push(...addedLabels)
  next.customLabels.push(...addedCustom)
  if (addedLabels.length + addedCustom.length) changed.push(`${addedLabels.length + addedCustom.length} ${addedLabels.length + addedCustom.length === 1 ? 'etiqueta' : 'etiquetas'}`)
  return { next, changed }
}

type TagGroupLite = { id: string; tags: { id: string; label: string }[] }

function editorFriendlyError(error: unknown, fallback: string) {
  if (error instanceof Error && (error.message.includes('sessão expirou') || error.message.includes('mudou em outra tela') || error.message.includes('Use uma imagem') || error.message.includes('3 MB'))) return error.message
  return error instanceof Error && error.message ? error.message : fallback
}

function dateLabel(value?: string) {
  if (!value) return 'Data indisponível'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : dateTime.format(date)
}

function isPrivateKey(cafeId: string, value: string | null | undefined) {
  return Boolean(value && value.startsWith(`${cafeId}/`))
}

function stockMap(value: EditorWorkspace['availability']) {
  const entry = (available: boolean, quantity?: number | null, note?: string | null): StockEntry => ({ available, quantity: quantity ?? null, note: note ?? null })
  if (Array.isArray(value)) return new Map(value.map((row) => [row.product_id, entry(row.available, row.quantity, row.note)]))
  return new Map(Object.entries(value ?? {}).map(([id, item]) => [id, typeof item === 'boolean' ? entry(item) : entry(item.available, item.quantity, item.note)]))
}

function availabilityMap(value: EditorWorkspace['availability']) {
  return new Map([...stockMap(value)].map(([id, entry]) => [id, entry.available]))
}

function makeProductForm(item?: MenuItem): ProductForm {
  return {
    id: item?.id ?? '',
    name: item?.name ?? '',
    category: item?.category ?? '',
    subcategory: item?.subcategory ?? '',
    description: item?.description ?? '',
    lookalike: item?.lookalike ?? '',
    image: item?.image ?? '',
    options: item?.options ?? '',
    badges: (item?.badges ?? []).join(', '),
    allergens: (item?.allergens ?? []).join(', '),
    allergensVerified: (item as (MenuItem & { allergensVerified?: boolean }) | undefined)?.allergensVerified === true,
    ingredients: (item?.ingredients ?? []).join(', '),
    prices: item?.prices?.length ? item.prices.map((price) => ({ size: price.size, ml: price.ml == null ? '' : String(price.ml), price: price.price == null ? '' : String(price.price) })) : [{ size: '', ml: '', price: '' }],
    tags: {
      sweet: item ? String(item.tags.sweet) : '',
      bitter: item ? String(item.tags.bitter) : '',
      milk: item ? String(item.tags.milk) : '',
      iced: item ? String(item.tags.iced) : '',
      caffeine: item ? String(item.tags.caffeine) : '',
      hunger: item ? String(item.tags.hunger) : '',
    },
    labels: [...(item?.labels ?? [])],
    customLabels: [],
  }
}

function csv(value: string) {
  return value.split(',').map((part) => part.trim()).filter(Boolean)
}

function itemFromForm(form: ProductForm): MenuItem & { allergensVerified: boolean } {
  const prices: Price[] = form.prices.filter((price) => price.size.trim()).map((price) => ({
    size: price.size.trim(),
    ml: price.ml.trim() ? Number(price.ml) : null,
    price: price.price.trim() ? Number(price.price) : null,
  }))
  return {
    id: form.id,
    name: form.name.trim(),
    category: form.category,
    ...(form.subcategory.trim() ? { subcategory: form.subcategory.trim() } : {}),
    description: form.description.trim(),
    lookalike: form.lookalike.trim(),
    image: form.image.trim() || null,
    ...(form.options ? { options: form.options } : {}),
    prices,
    badges: csv(form.badges),
    allergens: csv(form.allergens),
    allergensVerified: form.allergensVerified,
    ingredients: csv(form.ingredients),
    tags: {
      sweet: Number(form.tags.sweet),
      bitter: Number(form.tags.bitter),
      milk: form.tags.milk === 'true',
      iced: form.tags.iced === 'true',
      caffeine: form.tags.caffeine === 'true',
      hunger: Number(form.tags.hunger),
    },
    labels: [...new Set(form.labels)],
  }
}

function detailsSummary(form: ProductForm) {
  const filled = [form.lookalike.trim() && 'parecido com', form.ingredients.trim() && 'ingredientes', form.badges.trim() && 'rótulos', form.options && 'personalização'].filter(Boolean)
  return filled.length ? `preenchido: ${filled.join(', ')}` : 'opcional'
}

function isValidProductForm(form: ProductForm) {
  return Boolean(form.name.trim())
}

function publishIssues(menu: EditorMenu) {
  if (!menu.categories.length || !menu.items.length) return ['Crie ao menos uma categoria e um produto.']
  return menu.items.flatMap((item) => {
    const missing: string[] = []
    if (!item.name.trim()) missing.push('nome')
    if (!menu.categories.some((category) => category.id === item.category)) missing.push('categoria')
    if (!item.prices.some((price) => price.price != null && Number.isFinite(price.price) && price.price >= 0)) missing.push('preço')
    if (!item.image?.trim()) missing.push('foto')
    return missing.length ? [`${item.name || 'Produto sem nome'}: ${missing.join(', ')}`] : []
  })
}

export function MenuEditor() {
  const [cafes, setCafes] = useState<CafeSummary[]>([])
  const [cafeId, setCafeId] = useState('')
  const [workspace, setWorkspace] = useState<EditorWorkspace | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [workingMenu, setWorkingMenu] = useState<EditorMenu | null>(null)
  const [activeTab, setActiveTab] = useState<'conteudo' | 'marca' | 'disponibilidade' | 'avancado'>('conteudo')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newDraftName, setNewDraftName] = useState('')
  const [search, setSearch] = useState('')
  const [stockSearch, setStockSearch] = useState('')
  const [stockStatus, setStockStatus] = useState<StockStatus>('todos')
  const [stockCategory, setStockCategory] = useState('')
  const [stockSort, setStockSort] = useState<'nome' | 'menos' | 'mais'>('nome')
  const [lowLimit, setLowLimit] = useState(5)
  const [addingCategory, setAddingCategory] = useState(false)
  const [collapsedCats, setCollapsedCats] = useState<string[]>([])
  const [productEditorOpen, setProductEditorOpen] = useState(false)
  const [productForm, setProductForm] = useState<ProductForm | null>(null)
  const [productIsNew, setProductIsNew] = useState(false)
  const [productError, setProductError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [localImageUrl, setLocalImageUrl] = useState('')
  const [fillBrief, setFillBrief] = useState('')
  const [fillBusy, setFillBusy] = useState(false)
  const [fillError, setFillError] = useState('')
  const [fillNote, setFillNote] = useState('')
  const [fillUndo, setFillUndo] = useState<ProductForm | null>(null)
  const [aiAllergens, setAiAllergens] = useState<string[]>([])
  const [selectedAiAllergens, setSelectedAiAllergens] = useState<string[]>([])
  const [confirmedAiAllergens, setConfirmedAiAllergens] = useState(false)
  const [newLabelText, setNewLabelText] = useState('')
  const [heroUrl, setHeroUrl] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [selectedOptionSetId, setSelectedOptionSetId] = useState('')
  const [newOptionSetName, setNewOptionSetName] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMenu, setPreviewMenu] = useState<Menu | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrBusy, setQrBusy] = useState(false)
  const [qrError, setQrError] = useState('')

  const selectedCafe = cafes.find((cafe) => cafe.id === cafeId) ?? null
  const selectedDraft = workspace?.drafts.find((draft) => draft.id === selectedDraftId) ?? null
  const dirty = Boolean(workingMenu && selectedDraft && JSON.stringify(workingMenu) !== JSON.stringify(selectedDraft.menu))
  const optionSets = workingMenu?.optionSets ?? {}

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    void callRpc<CafeSummary[]>('list_my_cafes').then((result) => {
      if (cancelled) return
      setCafes(Array.isArray(result) ? result : [])
      setCafeId((current) => current || result[0]?.id || '')
      setLoading(false)
    }).catch((reason: unknown) => {
      if (cancelled) return
      setError(editorFriendlyError(reason, 'Não foi possível carregar suas cafeterias.'))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!cafeId) {
      setWorkspace(null)
      setSelectedDraftId('')
      setWorkingMenu(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void callRpc<EditorWorkspace>('get_menu_editor', { p_cafe_id: cafeId }).then((result) => {
      if (cancelled) return
      const normalized = { ...result, drafts: (result.drafts ?? []).map((draft) => ({ ...draft, menu: normalizeMenu(draft.menu, result.cafe) })) }
      setWorkspace(normalized)
      const firstDraft = normalized.drafts[0]
      setSelectedDraftId(firstDraft?.id ?? '')
      setWorkingMenu(firstDraft ? normalizeMenu(firstDraft.menu, result.cafe) : null)
      setLoading(false)
    }).catch((reason: unknown) => {
      if (cancelled) return
      setError(editorFriendlyError(reason, 'Não foi possível carregar o editor deste cardápio.'))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [cafeId])

  useEffect(() => {
    if (!localImageUrl) return
    return () => URL.revokeObjectURL(localImageUrl)
  }, [localImageUrl])

  // foto do produto no começo do diálogo: arquivo escolhido agora, foto privada já salva ou foto do cardápio de referência
  useEffect(() => {
    const image = productForm?.image ?? ''
    if (!productEditorOpen || !image || localImageUrl || !workspace) { setHeroUrl(''); return }
    if (!isPrivateKey(workspace.cafe.id, image)) { setHeroUrl(/^(https?:|blob:|data:)/.test(image) ? image : `${import.meta.env.BASE_URL}${image}`); return }
    let cancelled = false
    void resolvePrivateImage(workspace.cafe.id, image).then((url) => { if (!cancelled) setHeroUrl(url) }).catch(() => { if (!cancelled) setHeroUrl('') })
    return () => { cancelled = true }
  }, [productEditorOpen, productForm?.image, localImageUrl, workspace?.cafe.id])

  const labels = useMemo(() => {
    const result = new Map<string, string>()
    for (const group of workingMenu?.tagGroups ?? []) for (const tag of group.tags) result.set(tag.id, tag.label)
    return result
  }, [workingMenu?.tagGroups])

  const shownItems = useMemo(() => {
    const items = workingMenu?.items ?? []
    const query = search.trim().toLocaleLowerCase('pt-BR')
    if (!query) return items
    return items.filter((item) => `${item.name} ${item.category} ${item.subcategory ?? ''}`.toLocaleLowerCase('pt-BR').includes(query))
  }, [workingMenu?.items, search])

  function updateMenu(change: (menu: EditorMenu) => EditorMenu) {
    setWorkingMenu((current) => current ? change(clone(current)) : current)
    setNotice('')
  }

  async function reloadWorkspace(draftToSelect = selectedDraftId, cafeToLoad = cafeId) {
    const result = await callRpc<EditorWorkspace>('get_menu_editor', { p_cafe_id: cafeToLoad })
    const normalized = { ...result, drafts: result.drafts.map((draft) => ({ ...draft, menu: normalizeMenu(draft.menu, result.cafe) })) }
    setWorkspace(normalized)
    const selected = normalized.drafts.find((draft) => draft.id === draftToSelect) ?? normalized.drafts[0]
    setSelectedDraftId(selected?.id ?? '')
    setWorkingMenu(selected ? selected.menu : null)
  }

  async function saveCurrentDraft() {
    if (!workingMenu || !selectedDraft || !workspace) return false
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await callRpc('save_menu_draft', {
        p_cafe_id: workspace.cafe.id,
        p_draft_id: selectedDraft.id,
        p_expected_version: selectedDraft.current_version,
        p_menu: workingMenu,
      })
      await reloadWorkspace(selectedDraft.id)
      setNotice('Rascunho salvo como uma nova versão.')
      return true
    } catch (reason) {
      setError(editorFriendlyError(reason, 'Não foi possível salvar o rascunho.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (dirty) { setError('Salve suas alterações antes de criar outro rascunho.'); return }
    const name = newDraftName.trim()
    if (!workspace || !selectedCafe || !name) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const sourceMenu = workingMenu ?? workspace.published?.menu ?? blankMenu(selectedCafe)
      const created = await callRpc<{ draft_id: string }>('create_menu_draft', { p_cafe_id: workspace.cafe.id, p_name: name, p_menu: sourceMenu })
      setNewDraftName('')
      await reloadWorkspace(created.draft_id)
      setActiveTab('conteudo')
      setNotice('Rascunho criado. Suas mudanças ainda não foram publicadas.')
    } catch (reason) {
      setError(editorFriendlyError(reason, 'Não foi possível criar o rascunho.'))
    } finally {
      setBusy(false)
    }
  }

  async function renameDraft() {
    if (!workspace || !selectedDraft) return
    const name = window.prompt('Nome deste rascunho', selectedDraft.name)?.trim()
    if (!name || name === selectedDraft.name) return
    setBusy(true)
    setError('')
    try {
      await callRpc('rename_menu_draft', { p_cafe_id: workspace.cafe.id, p_draft_id: selectedDraft.id, p_name: name })
      await reloadWorkspace(selectedDraft.id)
      setNotice('Nome do rascunho atualizado.')
    } catch (reason) {
      setError(editorFriendlyError(reason, 'Não foi possível renomear o rascunho.'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteDraft() {
    if (!workspace || !selectedDraft || !window.confirm(`Excluir o rascunho “${selectedDraft.name}”? O histórico de versões será preservado.`)) return
    setBusy(true)
    setError('')
    try {
      await callRpc('delete_menu_draft', { p_cafe_id: workspace.cafe.id, p_draft_id: selectedDraft.id, p_expected_version: selectedDraft.current_version })
      await reloadWorkspace('')
      setNotice('Rascunho removido da lista. O histórico continua disponível.')
    } catch (reason) {
      setError(editorFriendlyError(reason, 'Não foi possível excluir o rascunho.'))
    } finally {
      setBusy(false)
    }
  }

  async function publishDraft() {
    if (!workspace || !selectedDraft || !workingMenu) return
    const issues = publishIssues(workingMenu)
    if (issues.length) {
      const shown = issues.slice(0, 3).join(' · ')
      setError(`Complete nome, categoria, preço e foto antes de publicar. ${shown}${issues.length > 3 ? ` · e mais ${issues.length - 3} produto(s)` : ''}`)
      setActiveTab('conteudo')
      return
    }
    if (!window.confirm(`Publicar “${selectedDraft.name}”? Esta versão ficará visível no cardápio da cafeteria.`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      let expectedVersion = selectedDraft.current_version
      if (dirty) {
        const saved = await callRpc<{ version: number }>('save_menu_draft', {
          p_cafe_id: workspace.cafe.id,
          p_draft_id: selectedDraft.id,
          p_expected_version: expectedVersion,
          p_menu: workingMenu,
        })
        expectedVersion = saved.version
      }
      await callRpc('publish_menu_draft', { p_cafe_id: workspace.cafe.id, p_draft_id: selectedDraft.id, p_expected_version: expectedVersion })
      await reloadWorkspace(selectedDraft.id)
      setNotice('Cardápio publicado.')
      setActiveTab('avancado')
    } catch (reason) {
      setError(editorFriendlyError(reason, 'Não foi possível publicar o cardápio.'))
    } finally {
      setBusy(false)
    }
  }

  async function restoreVersion(versionId: string, versionNumber: number, sourceDraftId = selectedDraft?.id) {
    if (!workspace || !sourceDraftId) return
    if (dirty) { setError('Salve suas alterações antes de restaurar uma versão.'); return }
    if (!window.confirm(`Restaurar a versão ${versionNumber}? Um novo rascunho será criado sem alterar os demais.`)) return
    setBusy(true)
    setError('')
    try {
      const restored = await callRpc<{ draft_id: string }>('restore_menu_draft_version', {
        p_cafe_id: workspace.cafe.id,
        p_draft_id: sourceDraftId,
        p_version_id: versionId,
      })
      await reloadWorkspace(restored.draft_id)
      setNotice(`Versão ${versionNumber} restaurada em um novo rascunho. O original foi preservado.`)
    } catch (reason) {
      setError(editorFriendlyError(reason, 'Não foi possível restaurar esta versão.'))
    } finally {
      setBusy(false)
    }
  }

  function selectDraft(id: string) {
    if (dirty && !window.confirm('Há mudanças sem salvar. Descartar essas mudanças e abrir outro rascunho?')) return
    const draft = workspace?.drafts.find((item) => item.id === id)
    if (!draft || !workspace) return
    setSelectedDraftId(id)
    setWorkingMenu(normalizeMenu(draft.menu, workspace.cafe))
    setNotice('')
    setError('')
  }

  async function setStock(productId: string, change: { available: boolean; quantity: number | null }) {
    if (!workspace) return
    setBusy(true)
    setError('')
    try {
      await callRpc('set_product_stock', { p_cafe_id: workspace.cafe.id, p_product_id: productId, p_available: change.available, p_quantity: change.quantity })
      await reloadWorkspace(selectedDraftId)
      if (dirty && workingMenu) setWorkingMenu(workingMenu)
      setNotice(change.quantity === 0 ? 'Estoque zerado: produto marcado como indisponível.' : change.available ? 'Produto disponível.' : 'Produto marcado como indisponível.')
    } catch (reason) {
      setError(editorFriendlyError(reason, 'Não foi possível atualizar a disponibilidade.'))
    } finally {
      setBusy(false)
    }
  }

  async function openPreview() {
    if (!workspace) return
    const source = workingMenu ?? workspace.published?.menu
    if (!source) return
    setPreviewBusy(true)
    setPreviewError('')
    setPreviewOpen(true)
    try {
      const next = clone(source)
      const availability = availabilityMap(workspace.availability)
      next.items = next.items.map((item) => ({ ...item, available: availability.get(item.id) !== false }))
      const privateKeys = new Set<string>()
      for (const item of next.items) if (isPrivateKey(workspace.cafe.id, item.image)) privateKeys.add(item.image as string)
      const logoKey = next.cafe.branding?.logo_key
      if (isPrivateKey(workspace.cafe.id, logoKey)) privateKeys.add(logoKey as string)
      const urls = new Map<string, string>()
      await Promise.all([...privateKeys].map(async (key) => urls.set(key, await resolvePrivateImage(workspace.cafe.id, key))))
      for (const item of next.items) if (item.image && urls.has(item.image)) item.image = urls.get(item.image) as string
      if (next.cafe.branding?.logo_key && urls.has(next.cafe.branding.logo_key)) next.cafe.branding.logo_url = urls.get(next.cafe.branding.logo_key) as string
      setPreviewMenu(next as Menu)
    } catch (reason) {
      setPreviewError(editorFriendlyError(reason, 'Não foi possível preparar a prévia do cardápio.'))
    } finally {
      setPreviewBusy(false)
    }
  }

  function openProduct(item?: MenuItem) {
    if (!workingMenu) return
    setProductForm(makeProductForm(item))
    setProductIsNew(!item)
    setProductError('')
    setFillBrief('')
    setFillError('')
    setFillNote('')
    setFillUndo(null)
    setAiAllergens([])
    setSelectedAiAllergens([])
    setConfirmedAiAllergens(false)
    setNewLabelText('')
    setHeroUrl('')
    setLocalImageUrl('')
    setProductEditorOpen(true)
  }

  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workingMenu || !productForm) return
    if (!isValidProductForm(productForm)) {
      setProductError('Informe o nome do produto para adicioná-lo ao rascunho.')
      return
    }
    const id = productForm.id || idFromName(productForm.name, 'produto')
    if (workingMenu.items.some((item) => item.id === id && item.id !== productForm.id)) {
      setProductError('Já existe um produto com este identificador. Edite o nome para criar outro.')
      return
    }
    // etiquetas novas viram parte do catálogo do cardápio (família "Minhas etiquetas")
    const groups: TagGroup[] = clone(workingMenu.tagGroups ?? [])
    const allTags = () => groups.flatMap((group) => group.tags)
    const labelIds = [...productForm.labels]
    for (const label of productForm.customLabels) {
      const found = allTags().find((tag) => tag.label.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))
      if (found) { labelIds.push(found.id); continue }
      let tagId = idFromName(label, 'etiqueta')
      while (allTags().some((tag) => tag.id === tagId)) tagId = `${tagId}-2`
      let own = groups.find((group) => group.id === 'minhas-etiquetas')
      if (!own) { own = { id: 'minhas-etiquetas', name: 'Minhas etiquetas', weight: 2, tags: [] }; groups.push(own) }
      own.tags.push({ id: tagId, label })
      labelIds.push(tagId)
    }
    const product = itemFromForm({ ...productForm, id, labels: labelIds })
    updateMenu((menu) => ({ ...menu, tagGroups: groups, items: productIsNew ? [...menu.items, product] : menu.items.map((item) => item.id === product.id ? product : item) }))
    setProductEditorOpen(false)
    setProductForm(null)
  }

  function deleteProduct(item: MenuItem) {
    if (!window.confirm(`Remover “${item.name}” deste rascunho?`)) return
    updateMenu((menu) => ({ ...menu, items: menu.items.filter((product) => product.id !== item.id) }))
  }

  async function uploadProductImage(file?: File) {
    if (!file || !workspace || !productForm) return
    setImageBusy(true)
    setProductError('')
    try {
      const key = await uploadImage(workspace.cafe.id, file)
      setLocalImageUrl(URL.createObjectURL(file))
      setProductForm((current) => current ? { ...current, image: key } : current)
    } catch (reason) {
      setProductError(editorFriendlyError(reason, 'Não foi possível enviar a foto.'))
    } finally {
      setImageBusy(false)
    }
  }

  async function fillWithAi() {
    if (!workspace || !productForm) return
    if (!fillBrief.trim() && !productForm.name.trim()) {
      setFillError('Escreva uma frase sobre o produto ou digite o nome antes de pedir à IA.')
      return
    }
    setFillBusy(true)
    setFillError('')
    setFillNote('')
    try {
      const groups = (workingMenu?.tagGroups ?? []).map((group) => ({ id: group.id, tags: group.tags }))
      const result = await requestFill(workspace.cafe.id, productForm, fillBrief, groups)
      const { next, changed } = applyFill(productForm, result)
      setFillUndo(productForm)
      setProductForm(next)
      setAiAllergens(result.allergens)
      setSelectedAiAllergens([])
      setConfirmedAiAllergens(false)
      setFillNote(changed.length ? `A IA preencheu: ${changed.join(', ')}. Revise antes de salvar; o que você já tinha escrito não foi alterado.` : 'A IA não encontrou nada novo para preencher: os campos já estavam completos.')
    } catch (reason) {
      setFillError(editorFriendlyError(reason, 'Não foi possível preencher com a IA agora.'))
    } finally {
      setFillBusy(false)
    }
  }

  function undoFill() {
    if (!fillUndo) return
    setProductForm(fillUndo)
    setFillUndo(null)
    setFillNote('Preenchimento da IA desfeito.')
    setAiAllergens([])
  }

  function applyAiAllergens() {
    if (!productForm) return
    if (selectedAiAllergens.length && !confirmedAiAllergens) {
      setFillError('Confirme cada alerta de alérgeno em uma fonte da cafeteria antes de aplicar.')
      return
    }
    setProductForm({
      ...productForm,
      allergens: [...new Set([...csv(productForm.allergens), ...selectedAiAllergens])].join(', '),
      allergensVerified: selectedAiAllergens.length ? true : productForm.allergensVerified,
    })
    setAiAllergens([])
    setFillError('')
  }

  function addCustomLabel() {
    const label = newLabelText.trim()
    if (!productForm || !label) return
    const exists = [...labels.values(), ...productForm.customLabels].some((item) => item.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))
    if (!exists) setProductForm({ ...productForm, customLabels: [...productForm.customLabels, label.slice(0, 40)] })
    else {
      const id = [...labels].find(([, text]) => text.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))?.[0]
      if (id && !productForm.labels.includes(id)) setProductForm({ ...productForm, labels: [...productForm.labels, id] })
    }
    setNewLabelText('')
  }

  async function uploadLogo(file?: File) {
    if (!file || !workspace) return
    setImageBusy(true)
    setError('')
    try {
      const key = await uploadImage(workspace.cafe.id, file)
      updateMenu((menu) => ({ ...menu, cafe: { ...menu.cafe, branding: { ...menu.cafe.branding, logo_key: key } } }))
      setNotice('Logo enviada ao rascunho. Salve para registrar a mudança.')
    } catch (reason) {
      setError(editorFriendlyError(reason, 'Não foi possível enviar o logo.'))
    } finally {
      setImageBusy(false)
    }
  }

  async function createOptionSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newOptionSetName.trim()
    if (!name) return
    let id = idFromName(name, 'opcoes')
    while (workingMenu?.optionSets?.[id]) id = `${id}-${Date.now().toString(36)}`
    updateMenu((menu) => ({ ...menu, optionSets: { ...(menu.optionSets ?? {}), [id]: { name, groups: [] } } }))
    setSelectedOptionSetId(id)
    setNewOptionSetName('')
  }

  function updateOptionSet(id: string, change: (current: OptionSet) => OptionSet) {
    updateMenu((menu) => {
      const current = menu.optionSets?.[id]
      if (!current) return menu
      return { ...menu, optionSets: { ...menu.optionSets, [id]: change(current) } }
    })
  }

  function addOptionGroup(setId: string) {
    const id = `grupo-${crypto.randomUUID()}`
    updateOptionSet(setId, (current) => ({ ...current, groups: [...current.groups, { id, name: 'Novo grupo', kind: 'single', required: false, max: 1, options: [], default: null }] }))
  }

  function removeOptionSet(setId: string) {
    if (!workingMenu || !window.confirm('Excluir este conjunto de opções do rascunho? Produtos ligados a ele ficarão sem conjunto.')) return
    updateMenu((menu) => {
      const optionSets = { ...(menu.optionSets ?? {}) }
      delete optionSets[setId]
      return { ...menu, optionSets, items: menu.items.map((item) => item.options === setId ? { ...item, options: undefined } : item) }
    })
    setSelectedOptionSetId('')
  }

  function editCategory(categoryId: string, change: (category: Category) => Category) {
    updateMenu((menu) => ({ ...menu, categories: menu.categories.map((category) => category.id === categoryId ? change(category) : category) }))
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = categoryName.trim()
    if (!name || !workingMenu) return
    let id = idFromName(name, 'categoria')
    while (workingMenu.categories.some((category) => category.id === id)) id = `${id}-${Date.now().toString(36)}`
    updateMenu((menu) => ({ ...menu, categories: [...menu.categories, { id, name }] }))
    setCategoryName('')
  }

  function moveCategory(index: number, direction: -1 | 1) {
    updateMenu((menu) => {
      const next = [...menu.categories]
      const target = index + direction
      if (target < 0 || target >= next.length) return menu
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...menu, categories: next }
    })
  }

  function removeCategory(category: Category) {
    if (!workingMenu || workingMenu.items.some((item) => item.category === category.id) || !window.confirm(`Remover a categoria “${category.name}” deste rascunho?`)) return
    updateMenu((menu) => ({ ...menu, categories: menu.categories.filter((item) => item.id !== category.id), subcategories: (menu.subcategories ?? []).filter((item) => item.group !== category.id) }))
  }

  async function generateQr() {
    if (!workspace) return
    setQrBusy(true)
    setQrError('')
    try {
      const url = new URL('/', window.location.origin)
      url.searchParams.set('unidade', workspace.cafe.slug)
      setQrDataUrl(await QRCode.toDataURL(url.toString(), { width: 640, margin: 3, errorCorrectionLevel: 'Q' }))
    } catch {
      setQrError('Não foi possível gerar o QR desta unidade.')
    } finally {
      setQrBusy(false)
    }
  }

  async function copyMenuUrl() {
    if (!workspace) return
    const url = new URL('/', window.location.origin)
    url.searchParams.set('unidade', workspace.cafe.slug)
    try {
      await navigator.clipboard.writeText(url.toString())
      setNotice('Endereço do cardápio copiado.')
    } catch {
      setQrError('Não foi possível copiar o endereço neste navegador.')
    }
  }

  const availablePublishedItems = workspace?.published?.menu.items ?? []
  const stock = workspace ? stockMap(workspace.availability) : new Map<string, StockEntry>()
  const isLow = (entry: StockEntry | undefined) => entry?.quantity != null && entry.quantity > 0 && entry.quantity <= lowLimit
  const stockRows = useMemo(() => {
    const query = stockSearch.trim().toLocaleLowerCase('pt-BR')
    const entryOf = (id: string): StockEntry => stock.get(id) ?? { available: true, quantity: null, note: null }
    const rows = availablePublishedItems.filter((item) => {
      const entry = entryOf(item.id)
      if (query && !item.name.toLocaleLowerCase('pt-BR').includes(query)) return false
      if (stockCategory && item.category !== stockCategory) return false
      if (stockStatus === 'disponiveis') return entry.available && entry.quantity !== 0
      if (stockStatus === 'indisponiveis') return !entry.available || entry.quantity === 0
      if (stockStatus === 'baixo') return isLow(entry)
      if (stockStatus === 'sem-controle') return entry.quantity == null
      return true
    })
    // sem controle de estoque vai para o fim quando se ordena por quantidade
    const qty = (id: string, empty: number) => entryOf(id).quantity ?? empty
    if (stockSort === 'menos') rows.sort((a, b) => qty(a.id, Infinity) - qty(b.id, Infinity) || a.name.localeCompare(b.name, 'pt-BR'))
    else if (stockSort === 'mais') rows.sort((a, b) => qty(b.id, -1) - qty(a.id, -1) || a.name.localeCompare(b.name, 'pt-BR'))
    return rows
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePublishedItems, workspace?.availability, stockSearch, stockCategory, stockStatus, stockSort, lowLimit])

  if (loading && !workspace && !cafes.length) return <section className="adm-sec menu-editor" aria-labelledby="menu-editor-title"><div className="adm-card menu-editor__loading" role="status">Carregando suas cafeterias…</div></section>
  if (error && !workspace && !loading) return <section className="adm-sec menu-editor" aria-labelledby="menu-editor-title"><div className="adm-card"><h2 id="menu-editor-title">Editor de cardápio</h2><p className="menu-editor__error" role="alert">{error}</p></div></section>
  if (!cafes.length && !loading) return <section className="adm-sec menu-editor" aria-labelledby="menu-editor-title"><div className="menu-editor__intro"><div><p className="menu-editor__eyebrow">CARDÁPIO DA CAFETERIA</p><h2 id="menu-editor-title">Seu cardápio, do seu jeito.</h2><p>Quando uma cafeteria estiver vinculada à sua conta, ela aparecerá aqui para edição.</p></div></div><div className="adm-card menu-editor__empty"><h3>Nenhuma cafeteria vinculada</h3><p>A conta não tem uma cafeteria disponível para editar. Peça à equipe para vincular uma unidade ao seu acesso.</p></div></section>

  return <section className="adm-sec menu-editor" aria-labelledby="menu-editor-title">
    {error && <p className="menu-editor__error" role="alert">{error}</p>}
    {notice && <p className="menu-editor__notice" role="status">{notice}</p>}
    {loading && <p className="menu-editor__loading" role="status">Carregando dados da cafeteria…</p>}
    {!loading && workspace && <>
      <header className="menu-editor__bar">
        <div className="menu-editor__bar-title">
          <h2 id="menu-editor-title">{selectedDraft?.name ?? 'Cardápio'}</h2>
          <p>
            <span className={workspace.published ? 'menu-editor__chip is-published' : 'menu-editor__chip is-unpublished'}>{workspace.published ? `No ar · v${workspace.published.version}` : 'Ainda não publicado'}</span>
            {selectedDraft && <span className={dirty ? 'menu-editor__dirty' : 'menu-editor__saved'}>{dirty ? 'Há mudanças sem salvar' : 'Tudo salvo'}</span>}
          </p>
        </div>
        <div className="menu-editor__bar-actions">
          <button type="button" className="menu-editor__secondary" onClick={() => void openPreview()} disabled={!workspace || (!workingMenu && !workspace.published) || previewBusy}>{previewBusy ? 'Preparando…' : 'Abrir prévia'}</button>
          {selectedDraft && <button type="button" className="menu-editor__secondary" onClick={() => void saveCurrentDraft()} disabled={busy || !dirty}>{busy ? 'Salvando…' : 'Salvar rascunho'}</button>}
          {selectedDraft && <button type="button" className="menu-editor__primary" onClick={() => void publishDraft()} disabled={busy || !workingMenu}>{busy ? 'Publicando…' : 'Publicar cardápio'}</button>}
        </div>
      </header>

      <details className="menu-editor__drafts" open={!selectedDraft || undefined}>
        <summary>Cafeteria e rascunhos</summary>
        <div className="menu-editor__drafts-body">
          <label className="menu-editor__cafe-select"><span>Cafeteria</span><select value={cafeId} disabled={cafes.length < 2 || busy} onChange={(event) => { if (dirty && !window.confirm('Há mudanças sem salvar. Descartar essas mudanças e trocar de cafeteria?')) return; setQrDataUrl(''); setPreviewOpen(false); setCafeId(event.target.value) }}>{cafes.map((cafe) => <option key={cafe.id} value={cafe.id}>{cafe.id === cafeId && workspace?.published ? workspace.published.menu.cafe.name : cafe.name}</option>)}</select></label>
          {workspace.drafts.length > 0 && <label className="menu-editor__draft-select"><span>Rascunho aberto</span><select value={selectedDraftId} disabled={busy} onChange={(event) => selectDraft(event.target.value)}>{workspace.drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.name} · v{draft.current_version}</option>)}</select></label>}
          <form className="menu-editor__new-draft" onSubmit={(event) => void createDraft(event)}><label><span>Novo rascunho</span><input value={newDraftName} maxLength={80} placeholder="Nome do rascunho" onChange={(event) => setNewDraftName(event.target.value)} /></label><button type="submit" className="menu-editor__secondary" disabled={busy || !newDraftName.trim()}>{busy ? 'Aguarde…' : 'Criar'}</button></form>
          {selectedDraft && <div className="menu-editor__drafts-actions"><button type="button" className="menu-editor__secondary" onClick={() => void renameDraft()} disabled={busy}>Renomear</button><button type="button" className="menu-editor__secondary menu-editor__danger" onClick={() => void deleteDraft()} disabled={busy}>Excluir rascunho</button></div>}
        </div>
      </details>

      <nav className="menu-editor__tabs" role="tablist" aria-label="Editor de cardápio">
        {([['conteudo', 'Produtos'], ['marca', 'Marca'], ['disponibilidade', 'Disponibilidade'], ['avancado', 'Avançado']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'is-on' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}
      </nav>

      {activeTab === 'conteudo' && <section className="adm-card menu-editor__products" aria-label="Produtos do cardápio">
        <div className="menu-editor__toolbar">
          <label className="menu-editor__search"><span className="menu-editor__sr-only">Buscar produto</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto" aria-label="Buscar produto" /></label>
          {(workingMenu?.categories.length ?? 0) > 1 && <button type="button" className="menu-editor__secondary" onClick={() => setCollapsedCats(collapsedCats.length ? [] : (workingMenu?.categories ?? []).map((category) => category.id))}>{collapsedCats.length ? 'Expandir todas' : 'Recolher todas'}</button>}
          <button type="button" className="menu-editor__secondary" onClick={() => setAddingCategory((open) => !open)} disabled={!workingMenu} aria-expanded={addingCategory || !workingMenu?.categories.length}>Nova categoria</button>
          <button type="button" className="menu-editor__primary" onClick={() => openProduct()} disabled={!selectedDraft || !workingMenu?.categories.length}>Adicionar produto</button>
        </div>
        {(addingCategory || !workingMenu?.categories.length) && <form className="menu-editor__category-add" onSubmit={(event) => { addCategory(event); setAddingCategory(false) }}><label><span>Nova categoria</span><input value={categoryName} maxLength={60} placeholder="Ex.: Cafés" onChange={(event) => setCategoryName(event.target.value)} disabled={!workingMenu} /></label><button type="submit" className="menu-editor__secondary" disabled={!workingMenu || !categoryName.trim()}>Adicionar</button></form>}
        {!workingMenu?.categories.length && <p className="menu-editor__empty-note">Comece criando uma categoria, como “Cafés”. Depois é só adicionar os produtos.</p>}
        {(workingMenu?.categories ?? []).map((category, index) => {
          const count = workingMenu?.items.filter((item) => item.category === category.id).length ?? 0
          const rows = shownItems.filter((item) => item.category === category.id)
          if (search.trim() && !rows.length) return null
          const collapsed = collapsedCats.includes(category.id) && !search.trim()
          return <section key={category.id} className={collapsed ? 'menu-editor__group is-collapsed' : 'menu-editor__group'} aria-label={`Categoria ${category.name}`}>
            <header className="menu-editor__group-head">
              <h3><button type="button" className="menu-editor__group-toggle" aria-expanded={!collapsed} onClick={() => setCollapsedCats(collapsed ? collapsedCats.filter((id) => id !== category.id) : [...collapsedCats, category.id])}>
                <svg className="menu-editor__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                <span>{category.name}</span>
                <span className="menu-editor__count">{count}</span>
                <span className="menu-editor__toggle-hint">{collapsed ? 'Expandir' : 'Recolher'}</span>
              </button></h3>
              <details className="menu-editor__cat-menu">
                <summary>Editar categoria</summary>
                <div className="menu-editor__cat-body">
                  <label><span>Nome da categoria</span><input value={category.name} maxLength={60} onChange={(event) => editCategory(category.id, (current) => ({ ...current, name: event.target.value }))} /></label>
                  <div>
                    <button type="button" className="menu-editor__secondary" aria-label={`Mover ${category.name} para cima`} onClick={() => moveCategory(index, -1)} disabled={index === 0}>↑ Subir</button>
                    <button type="button" className="menu-editor__secondary" aria-label={`Mover ${category.name} para baixo`} onClick={() => moveCategory(index, 1)} disabled={index === (workingMenu?.categories.length ?? 1) - 1}>↓ Descer</button>
                    <button type="button" className="menu-editor__secondary menu-editor__danger" onClick={() => removeCategory(category)} disabled={count > 0} title={count ? 'Mova os produtos para outra categoria antes de excluir.' : undefined}>Remover</button>
                  </div>
                </div>
              </details>
            </header>
            {!collapsed && !rows.length && <p className="menu-editor__empty-note">Nenhum produto aqui ainda.</p>}
            {!collapsed && <ul className="menu-editor__product-list">{rows.map((item) => <li key={item.id}><div className="menu-editor__product-copy"><strong>{item.name}</strong><small>{item.prices?.[0]?.price == null ? 'Preço não definido' : brl.format(item.prices[0].price)}</small></div><button type="button" className="menu-editor__secondary" onClick={() => openProduct(item)} disabled={!selectedDraft}>Editar</button><button type="button" className="menu-editor__text-button" onClick={() => deleteProduct(item)} disabled={!selectedDraft}>Remover</button></li>)}</ul>}
          </section>
        })}
        {workingMenu?.items.length ? !shownItems.length && <p className="menu-editor__empty-note">Nenhum produto corresponde à busca.</p> : null}
      </section>}

      {activeTab === 'marca' && <section className="adm-card menu-editor__brand">
        <header className="menu-editor__section-head"><div><h3>Marca da cafeteria</h3><p>Esses campos entram no mesmo rascunho e só aparecem depois da publicação.</p></div></header>
        {!workingMenu && <p className="menu-editor__empty-note">Crie ou selecione um rascunho para editar a marca.</p>}
        {workingMenu && <div className="menu-editor__brand-grid">
          <label><span>Nome exibido</span><input value={workingMenu.cafe.name} maxLength={100} onChange={(event) => updateMenu((menu) => ({ ...menu, cafe: { ...menu.cafe, name: event.target.value } }))} /></label>
          <label className="menu-editor__wide"><span>Descrição curta</span><textarea value={workingMenu.cafe.description ?? ''} maxLength={240} rows={3} placeholder="Conte em poucas palavras sobre a cafeteria." onChange={(event) => updateMenu((menu) => ({ ...menu, cafe: { ...menu.cafe, description: event.target.value } }))} /></label>
          <label><span>Cor principal</span><div className="menu-editor__color-field"><input type="color" aria-label="Escolher cor principal" value={workingMenu.cafe.branding?.accent_color || '#4f7f64'} onChange={(event) => updateMenu((menu) => ({ ...menu, cafe: { ...menu.cafe, branding: { ...menu.cafe.branding, accent_color: event.target.value } } }))} /><input aria-label="Código da cor principal" value={workingMenu.cafe.branding?.accent_color ?? ''} maxLength={7} placeholder="#4F7F64" onChange={(event) => updateMenu((menu) => ({ ...menu, cafe: { ...menu.cafe, branding: { ...menu.cafe.branding, accent_color: event.target.value } } }))} /></div></label>
          <label><span>Cor secundária</span><div className="menu-editor__color-field"><input type="color" aria-label="Escolher cor secundária" value={workingMenu.cafe.branding?.secondary_color || '#dcebe2'} onChange={(event) => updateMenu((menu) => ({ ...menu, cafe: { ...menu.cafe, branding: { ...menu.cafe.branding, secondary_color: event.target.value } } }))} /><input aria-label="Código da cor secundária" value={workingMenu.cafe.branding?.secondary_color ?? ''} maxLength={7} placeholder="#DCEBE2" onChange={(event) => updateMenu((menu) => ({ ...menu, cafe: { ...menu.cafe, branding: { ...menu.cafe.branding, secondary_color: event.target.value } } }))} /></div></label>
          <div className="menu-editor__logo menu-editor__wide"><div><strong>Logo</strong><small>JPG, PNG ou WebP · até 3 MB</small>{workingMenu.cafe.branding?.logo_key && <small>Arquivo atual: {workingMenu.cafe.branding.logo_key.split('/').at(-1)}</small>}</div><label className="menu-editor__secondary menu-editor__file-button">{imageBusy ? 'Enviando…' : workingMenu.cafe.branding?.logo_key ? 'Trocar logo' : 'Enviar logo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadLogo(event.target.files?.[0])} disabled={imageBusy} /></label>{workingMenu.cafe.branding?.logo_key && <button type="button" className="menu-editor__text-button" onClick={() => updateMenu((menu) => ({ ...menu, cafe: { ...menu.cafe, branding: { ...menu.cafe.branding, logo_key: null } } }))}>Remover logo</button>}</div>
          <p className="menu-editor__note menu-editor__wide">As cores e o logo são guardados junto com a versão do cardápio. A prévia usa uma URL temporária apenas para exibir o arquivo.</p>
          <section className="menu-editor__qr menu-editor__wide" aria-labelledby="menu-editor-qr-title"><div><h4 id="menu-editor-qr-title">QR da unidade</h4><p>O código abre o cardápio em <code>/?unidade={workspace.cafe.slug}</code>.</p></div><div className="menu-editor__qr-actions"><button type="button" className="menu-editor__secondary" onClick={() => void generateQr()} disabled={qrBusy}>{qrBusy ? 'Gerando…' : qrDataUrl ? 'Atualizar QR' : 'Gerar QR'}</button>{qrDataUrl && <><a className="menu-editor__secondary" href={qrDataUrl} download={`qr-${workspace.cafe.slug}.png`}>Baixar PNG</a><button type="button" className="menu-editor__secondary" onClick={() => void copyMenuUrl()}>Copiar endereço</button></>}</div>{qrError && <p className="menu-editor__error" role="alert">{qrError}</p>}{qrDataUrl && <img src={qrDataUrl} alt={`Código QR para o cardápio de ${workingMenu?.cafe.name ?? workspace.cafe.name}`} />}</section>
        </div>}
      </section>}

      {activeTab === 'disponibilidade' && <section className="adm-card menu-editor__availability">
        <header className="menu-editor__section-head"><div><h3>Disponibilidade e estoque</h3><p>Valem para o cardápio já publicado e entram no ar na hora. Com a quantidade em 0, o produto fica indisponível sozinho.</p></div></header>
        {!workspace.published && <div className="menu-editor__empty-note"><p>Publique o primeiro cardápio para controlar a disponibilidade e o estoque dos produtos.</p>{selectedDraft && <button type="button" className="menu-editor__primary" onClick={() => void publishDraft()} disabled={busy || !workingMenu}>Publicar cardápio agora</button>}</div>}
        {workspace.published && !availablePublishedItems.length && <p className="menu-editor__empty-note">O cardápio publicado não tem produtos.</p>}
        {workspace.published && availablePublishedItems.length > 0 && <>
          <div className="menu-editor__stock-summary">
            <span><strong>{availablePublishedItems.length}</strong> produtos</span>
            <span><strong>{availablePublishedItems.filter((item) => stock.get(item.id)?.available === false || stock.get(item.id)?.quantity === 0).length}</strong> indisponíveis</span>
            <span><strong>{availablePublishedItems.filter((item) => isLow(stock.get(item.id))).length}</strong> perto de acabar</span>
            <span><strong>{availablePublishedItems.filter((item) => stock.get(item.id)?.quantity != null).length}</strong> com estoque controlado</span>
          </div>
          <div className="menu-editor__stock-filters" role="group" aria-label="Filtros da disponibilidade">
            <label className="menu-editor__search"><span className="menu-editor__sr-only">Buscar produto na disponibilidade</span><input type="search" value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} placeholder="Buscar produto" aria-label="Buscar produto na disponibilidade" /></label>
            <div className="menu-editor__chips" role="group" aria-label="Situação do estoque">
              {([['todos', 'Todos'], ['baixo', 'Perto de acabar'], ['indisponiveis', 'Indisponíveis'], ['disponiveis', 'Disponíveis'], ['sem-controle', 'Sem controle']] as const).map(([id, label]) => <button key={id} type="button" className={stockStatus === id ? 'menu-editor__chip-button is-on' : 'menu-editor__chip-button'} aria-pressed={stockStatus === id} onClick={() => setStockStatus(id)}>{label}</button>)}
            </div>
            <div className="menu-editor__filter-row">
              <label><span>Categoria</span><select aria-label="Filtrar por categoria" value={stockCategory} onChange={(event) => setStockCategory(event.target.value)}><option value="">Todas</option>{(workspace.published.menu.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label><span>Ordenar por</span><select aria-label="Ordenar produtos" value={stockSort} onChange={(event) => setStockSort(event.target.value as 'nome' | 'menos' | 'mais')}><option value="nome">Nome</option><option value="menos">Menos estoque primeiro</option><option value="mais">Mais estoque primeiro</option></select></label>
              <label><span>Perto de acabar: até</span><input inputMode="numeric" value={lowLimit} aria-label="Perto de acabar: até quantas unidades" onChange={(event) => setLowLimit(Math.min(1000, Number(event.target.value.replace(/[^0-9]/g, '')) || 0))} /></label>
            </div>
            <p className="menu-editor__filter-count" role="status">{stockRows.length === availablePublishedItems.length ? `Mostrando todos os ${stockRows.length} produtos` : `Mostrando ${stockRows.length} de ${availablePublishedItems.length} produtos`}{(stockStatus !== 'todos' || stockCategory || stockSearch.trim()) && <button type="button" className="menu-editor__text-button" onClick={() => { setStockStatus('todos'); setStockCategory(''); setStockSearch(''); setStockSort('nome') }}>Limpar filtros</button>}</p>
          </div>
          {!stockRows.length && <p className="menu-editor__empty-note">Nenhum produto com esses filtros.</p>}
          <ul className="menu-editor__availability-list">{stockRows.map((item) => (
            <StockRow key={`${item.id}:${stock.get(item.id)?.quantity ?? 'x'}`} name={item.name} image={item.image ?? null} cafeId={workspace.cafe.id} low={isLow(stock.get(item.id))} entry={stock.get(item.id) ?? { available: true, quantity: null, note: null }} busy={busy} onChange={(change) => void setStock(item.id, change)} />
          ))}</ul>
        </>}
      </section>}

      {activeTab === 'avancado' && <div className="menu-editor__advanced">
      <details className="menu-editor__more" open={!!selectedOptionSetId || undefined}><summary>Opções de personalização</summary><div className="menu-editor__options-layout">
        <section className="adm-card menu-editor__options-list"><header className="menu-editor__section-head"><div><h3>Conjuntos de opções</h3><p>Personalizações disponíveis nos produtos.</p></div><span>{Object.keys(optionSets).length}</span></header>
          <form className="menu-editor__category-add" onSubmit={(event) => void createOptionSet(event)}><label><span>Novo conjunto</span><input value={newOptionSetName} maxLength={60} placeholder="Ex.: Personalização de bebidas" onChange={(event) => setNewOptionSetName(event.target.value)} disabled={!workingMenu} /></label><button type="submit" className="menu-editor__secondary" disabled={!workingMenu || !newOptionSetName.trim()}>Criar</button></form>
          {!Object.keys(optionSets).length && <p className="menu-editor__empty-note">Ainda não há conjuntos de opções neste rascunho.</p>}
          <ul className="menu-editor__set-list">{Object.entries(optionSets).map(([id, set]) => <li key={id}><button type="button" className={id === selectedOptionSetId ? 'is-on' : ''} onClick={() => setSelectedOptionSetId(id)}>{set.name}<small>{set.groups.length} {set.groups.length === 1 ? 'grupo' : 'grupos'}</small></button></li>)}</ul>
        </section>
        {selectedOptionSetId && optionSets[selectedOptionSetId] ? <section className="adm-card menu-editor__option-detail"><header className="menu-editor__section-head"><div><h3>Editar conjunto</h3><p>Adicione grupos e escolhas para o produto.</p></div><button type="button" className="menu-editor__text-button" onClick={() => removeOptionSet(selectedOptionSetId)}>Excluir conjunto</button></header>
          <label className="menu-editor__option-name"><span>Nome do conjunto</span><input value={optionSets[selectedOptionSetId].name} maxLength={60} onChange={(event) => updateOptionSet(selectedOptionSetId, (current) => ({ ...current, name: event.target.value }))} /></label>
          <div className="menu-editor__option-groups">{optionSets[selectedOptionSetId].groups.map((group, groupIndex) => <OptionGroupEditor key={group.id} group={group} groupIndex={groupIndex} onChange={(change) => updateOptionSet(selectedOptionSetId, (current) => ({ ...current, groups: current.groups.map((item) => item.id === group.id ? change(item) : item) }))} onRemove={() => updateOptionSet(selectedOptionSetId, (current) => ({ ...current, groups: current.groups.filter((item) => item.id !== group.id) }))} />)}</div>
          {!optionSets[selectedOptionSetId].groups.length && <p className="menu-editor__empty-note">Este conjunto ainda não tem grupos.</p>}
          <button type="button" className="menu-editor__secondary" onClick={() => addOptionGroup(selectedOptionSetId)}>Adicionar grupo</button>
        </section> : <section className="adm-card menu-editor__option-detail"><p className="menu-editor__empty-note">Selecione um conjunto para editar ou crie um novo.</p></section>}
      </div></details>

      <details className="menu-editor__more"><summary>Histórico de versões</summary><div className="menu-editor__history-layout">
        <section className="adm-card menu-editor__history-card"><header className="menu-editor__section-head"><div><h3>Publicações</h3><p>Versões que já foram colocadas no ar.</p></div><span>{workspace.publications.length}</span></header>
          {!workspace.publications.length && <p className="menu-editor__empty-note">Nenhuma versão foi publicada ainda.</p>}
          <ol className="menu-editor__timeline">{workspace.publications.map((publication) => <li key={publication.publication_id}><span className="menu-editor__timeline-dot" /><div><strong>{publication.draft_name} · versão {publication.version}</strong><small>{dateLabel(publication.published_at)}{publication.published_by ? ' · publicada pela equipe' : ''}</small></div><button type="button" className="menu-editor__secondary" disabled={busy} onClick={() => void restoreVersion(publication.version_id, publication.version, publication.draft_id)}>Restaurar</button></li>)}</ol>
        </section>
        <section className="adm-card menu-editor__history-card"><header className="menu-editor__section-head"><div><h3>Versões do rascunho</h3><p>Restaure uma versão para continuar editando.</p></div></header>
          {!selectedDraft && <p className="menu-editor__empty-note">Selecione um rascunho para ver suas versões.</p>}
          {selectedDraft && !selectedDraft.versions.length && <p className="menu-editor__empty-note">Este rascunho ainda não tem versões salvas.</p>}
          <ol className="menu-editor__versions">{[...(selectedDraft?.versions ?? [])].sort((a, b) => b.version - a.version).map((version) => <li key={version.id}><div><strong>Versão {version.version}{version.version === selectedDraft?.current_version ? ' · atual' : ''}</strong><small>{dateLabel(version.saved_at)}</small></div>{version.version !== selectedDraft?.current_version && <button type="button" className="menu-editor__secondary" onClick={() => void restoreVersion(version.id, version.version)} disabled={busy}>Restaurar</button>}</li>)}</ol>
        </section>
      </div></details>
      </div>}
    </>}

    {productEditorOpen && productForm && <div className="menu-editor__overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductEditorOpen(false) }}><form className="menu-editor__dialog" role="dialog" aria-modal="true" aria-labelledby="menu-product-title" onSubmit={saveProduct}>
      <header className="menu-editor__dialog-head"><div><p className="menu-editor__eyebrow">PRODUTO DO RASCUNHO</p><h2 id="menu-product-title">{productIsNew ? 'Adicionar produto' : 'Editar produto'}</h2><p>Confira os dados antes de salvar no rascunho.</p></div><button type="button" className="menu-editor__close" aria-label="Fechar" onClick={() => setProductEditorOpen(false)}>×</button></header>
      <section className="menu-editor__hero" aria-label="Foto e identificação do produto">
        <div className="menu-editor__photo">
          <div className="menu-editor__photo-frame">{localImageUrl || heroUrl ? <img src={localImageUrl || heroUrl} alt={productForm.name ? `Foto de ${productForm.name}` : 'Foto do produto'} /> : <div className="menu-editor__photo-empty"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg><span>Sem foto ainda</span></div>}</div>
          <div className="menu-editor__photo-actions">
            <label className="menu-editor__secondary menu-editor__file-button">{imageBusy ? 'Enviando…' : productForm.image ? 'Trocar foto' : 'Enviar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto do produto" onChange={(event) => void uploadProductImage(event.target.files?.[0])} disabled={imageBusy} /></label>
            {productForm.image && <button type="button" className="menu-editor__text-button" onClick={() => { setProductForm({ ...productForm, image: '' }); setLocalImageUrl('') }}>Remover foto</button>}
          </div>
          <small>JPG, PNG ou WebP · até 3 MB</small>
        </div>
        <div className="menu-editor__hero-fields">
        <label><span>Nome do produto</span><input required maxLength={100} value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} /></label>
        <label><span>Categoria · pode definir depois</span><select value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}><option value="">Sem categoria</option>{(workingMenu?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        </div>
      </section>

      <section className="menu-editor__ai-fill" aria-label="Preencher com IA">
        <div className="menu-editor__ai-head"><span className="menu-editor__ai-badge" aria-hidden><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg></span><div><strong>Preencher com IA</strong><small>Conte em uma frase o que é o produto. A IA escreve a descrição e sugere ingredientes, etiquetas e características. Você só revisa.</small></div></div>
        <label><span className="menu-editor__sr-only">Descreva o produto para a IA</span><textarea rows={2} maxLength={1500} value={fillBrief} placeholder="Ex.: Latte de pistache com leite de aveia, cremoso e adocicado, servido gelado" onChange={(event) => setFillBrief(event.target.value)} /></label>
        <div className="menu-editor__ai-actions"><button type="button" className="menu-editor__primary" onClick={() => void fillWithAi()} disabled={fillBusy}>{fillBusy ? 'Preenchendo…' : 'Preencher com IA'}</button>{fillUndo && <button type="button" className="menu-editor__secondary" onClick={undoFill}>Desfazer</button>}</div>
        <small>Só preenche o que está vazio. Preço e foto ficam com você; alérgenos a IA apenas sugere.</small>
        {fillError && <p className="menu-editor__error" role="alert">{fillError}</p>}
        {fillNote && <p className="menu-editor__notice" role="status">{fillNote}</p>}
        {aiAllergens.length > 0 && <div className="menu-editor__ai-results"><div><strong>Possíveis alérgenos · a IA não confirma, você confere</strong>{aiAllergens.map((allergen) => <label key={allergen}><input type="checkbox" checked={selectedAiAllergens.includes(allergen)} onChange={(event) => setSelectedAiAllergens(event.target.checked ? [...selectedAiAllergens, allergen] : selectedAiAllergens.filter((value) => value !== allergen))} />{allergen}</label>)}<label className="menu-editor__ai-confirm"><input type="checkbox" checked={confirmedAiAllergens} onChange={(event) => setConfirmedAiAllergens(event.target.checked)} />Conferi os alérgenos selecionados com uma fonte da cafeteria.</label></div><button type="button" className="menu-editor__secondary" onClick={applyAiAllergens} disabled={!selectedAiAllergens.length}>Usar alérgenos selecionados</button></div>}
      </section>

      <div className="menu-editor__product-form-grid">
        <label className="menu-editor__wide"><span>Descrição (opcional)</span><textarea maxLength={600} rows={3} value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} /></label>
        <div className="menu-editor__wide menu-editor__prices"><div className="menu-editor__field-head"><div><strong>Tamanhos e preços</strong><small>Deixe o preço vazio se ainda não foi definido.</small></div><button type="button" className="menu-editor__secondary" onClick={() => setProductForm({ ...productForm, prices: [...productForm.prices, { size: '', ml: '', price: '' }] })}>Adicionar tamanho</button></div>
          {productForm.prices.map((price, index) => <div className="menu-editor__price-row" key={index}><label><span>Tamanho</span><input value={price.size} maxLength={40} onChange={(event) => setProductForm({ ...productForm, prices: productForm.prices.map((item, i) => i === index ? { ...item, size: event.target.value } : item) })} /></label><label><span>Volume (ml)</span><input type="number" min="0" value={price.ml} onChange={(event) => setProductForm({ ...productForm, prices: productForm.prices.map((item, i) => i === index ? { ...item, ml: event.target.value } : item) })} /></label><label><span>Preço (R$)</span><input type="number" min="0" step="0.01" value={price.price} onChange={(event) => setProductForm({ ...productForm, prices: productForm.prices.map((item, i) => i === index ? { ...item, price: event.target.value } : item) })} /></label><button type="button" className="menu-editor__text-button" onClick={() => setProductForm({ ...productForm, prices: productForm.prices.filter((_, i) => i !== index) })} disabled={productForm.prices.length === 1}>Remover</button></div>)}
        </div>
      </div>

      <details className="menu-editor__more menu-editor__section">
        <summary>Detalhes para o cliente<small>{detailsSummary(productForm)}</small></summary>
        <div className="menu-editor__product-form-grid">
        <label className="menu-editor__wide"><span>Com o que se parece</span><textarea maxLength={300} rows={2} value={productForm.lookalike} onChange={(event) => setProductForm({ ...productForm, lookalike: event.target.value })} /></label>
        <label><span>Ingredientes (separados por vírgula)</span><textarea rows={2} value={productForm.ingredients} onChange={(event) => setProductForm({ ...productForm, ingredients: event.target.value })} /></label>
        <label><span>Subcategoria (opcional)</span><input maxLength={60} value={productForm.subcategory} onChange={(event) => setProductForm({ ...productForm, subcategory: event.target.value })} /></label>
        <label><span>Rótulos (separados por vírgula)</span><input value={productForm.badges} placeholder="Ex.: Novo, Vegano" onChange={(event) => setProductForm({ ...productForm, badges: event.target.value })} /></label>
        <label><span>Conjunto de opções</span><select value={productForm.options} onChange={(event) => setProductForm({ ...productForm, options: event.target.value })}><option value="">Sem personalização</option>{Object.entries(optionSets).map(([id, set]) => <option key={id} value={id}>{set.name}</option>)}</select></label>
        </div>
      </details>

      <details className="menu-editor__more menu-editor__section">
        <summary>Alérgenos<small>{productForm.allergens.trim() ? (productForm.allergensVerified ? 'informados e conferidos' : 'informados, falta conferir') : 'opcional'}</small></summary>
        <div className="menu-editor__product-form-grid">
          <label><span>Alérgenos informados pela cafeteria</span><input value={productForm.allergens} placeholder="Separados por vírgula" onChange={(event) => setProductForm({ ...productForm, allergens: event.target.value, allergensVerified: false })} /><small>As sugestões da IA não confirmam alérgenos.</small></label>
          <label className="menu-editor__verified"><input type="checkbox" checked={productForm.allergensVerified} onChange={(event) => setProductForm({ ...productForm, allergensVerified: event.target.checked })} />Conferi a lista de alérgenos com uma fonte confiável da cafeteria.</label>
        </div>
      </details>

      <details className="menu-editor__more menu-editor__section">
        <summary>Etiquetas e características<small>{productForm.labels.length + productForm.customLabels.length ? `${productForm.labels.length + productForm.customLabels.length} ${productForm.labels.length + productForm.customLabels.length === 1 ? 'etiqueta' : 'etiquetas'}` : 'opcional · ajudam nas sugestões'}</small></summary>
        <div className="menu-editor__product-form-grid">
          <fieldset className="menu-editor__wide menu-editor__labels"><legend>Etiquetas de sabor, perfil e ocasião</legend><p>Marque as que descrevem o produto. Faltou alguma? Crie a sua logo abaixo.</p>{workingMenu?.tagGroups?.length ? workingMenu.tagGroups.map((group) => <div className="menu-editor__label-group" key={group.id}><strong>{group.name}</strong><div>{group.tags.map((tag) => <label key={tag.id}><input type="checkbox" checked={productForm.labels.includes(tag.id)} onChange={(event) => setProductForm({ ...productForm, labels: event.target.checked ? [...productForm.labels, tag.id] : productForm.labels.filter((id) => id !== tag.id) })} />{tag.label}</label>)}</div></div>) : <p className="menu-editor__empty-note">Este rascunho ainda não tem etiquetas. Crie as suas abaixo.</p>}
            <div className="menu-editor__label-group"><strong>Novas etiquetas deste produto</strong><div>{productForm.customLabels.map((label) => <label key={label}><input type="checkbox" checked onChange={() => setProductForm({ ...productForm, customLabels: productForm.customLabels.filter((item) => item !== label) })} />{label}</label>)}</div>
              <div className="menu-editor__new-label"><label><span>Nova etiqueta</span><input value={newLabelText} maxLength={40} placeholder="Ex.: Sem açúcar, Pistache, Para dividir" onChange={(event) => setNewLabelText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomLabel() } }} /></label><button type="button" className="menu-editor__secondary" onClick={addCustomLabel} disabled={!newLabelText.trim()}>Criar etiqueta</button></div>
              <small>Etiquetas novas entram na família “Minhas etiquetas” e ficam disponíveis para todos os produtos.</small></div>
          </fieldset>
        <fieldset className="menu-editor__wide menu-editor__tags"><legend>Características para as sugestões</legend><p>Esses campos influenciam recomendações. Se não preencher, escalas ficam em 0 e as opções sim/não ficam em “não”; revise com a ficha real do produto.</p><div className="menu-editor__tag-grid">
          <label><span>Doçura (0 a 3)</span><select value={productForm.tags.sweet} onChange={(event) => setProductForm({ ...productForm, tags: { ...productForm.tags, sweet: event.target.value } })}><option value="">Sem avaliação</option>{[0, 1, 2, 3].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Amargor (0 a 3)</span><select value={productForm.tags.bitter} onChange={(event) => setProductForm({ ...productForm, tags: { ...productForm.tags, bitter: event.target.value } })}><option value="">Sem avaliação</option>{[0, 1, 2, 3].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Fome (0 a 3)</span><select value={productForm.tags.hunger} onChange={(event) => setProductForm({ ...productForm, tags: { ...productForm.tags, hunger: event.target.value } })}><option value="">Sem avaliação</option>{[0, 1, 2, 3].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          {([['milk', 'Contém leite?'], ['iced', 'É gelado?'], ['caffeine', 'Tem cafeína?']] as const).map(([key, label]) => <label key={key}><span>{label}</span><select value={productForm.tags[key]} onChange={(event) => setProductForm({ ...productForm, tags: { ...productForm.tags, [key]: event.target.value } })}><option value="">Sem avaliação</option><option value="true">Sim</option><option value="false">Não</option></select></label>)}
        </div></fieldset>
        </div>
      </details>
      {productError && <p className="menu-editor__error" role="alert">{productError}</p>}
      <div className="menu-editor__dialog-actions"><button type="button" className="menu-editor__secondary" onClick={() => setProductEditorOpen(false)}>Cancelar</button><button type="submit" className="menu-editor__primary" disabled={imageBusy}>{productIsNew ? 'Adicionar ao rascunho' : 'Salvar produto no rascunho'}</button></div>
    </form></div>}

    {previewOpen && <div className="menu-editor__preview-overlay"><header className="menu-editor__preview-bar"><div><strong>Prévia do cardápio</strong><small>Itens indisponíveis aparecem identificados.</small></div><button type="button" className="menu-editor__secondary" onClick={() => { setPreviewOpen(false); setPreviewMenu(null); setPreviewError('') }}>Fechar prévia</button></header>{previewBusy && <p className="menu-editor__preview-status" role="status">Preparando fotos privadas…</p>}{previewError && <p className="menu-editor__error menu-editor__preview-status" role="alert">{previewError}</p>}{previewMenu && !previewBusy && (previewMenu.items.length ? <PreviewApp menu={previewMenu} /> : <p className="menu-editor__preview-status" role="status">Adicione produtos ao rascunho para visualizá-los.</p>)}</div>}
  </section>
}

/** Miniatura do produto: só busca a foto privada quando a linha aparece na tela. */
function Thumb({ image, cafeId }: { image: string | null; cafeId: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!image) return
    if (!isPrivateKey(cafeId, image)) { setUrl(/^(https?:|blob:|data:)/.test(image) ? image : `${import.meta.env.BASE_URL}${image}`); return }
    const node = ref.current
    if (!node) return
    let cancelled = false
    const load = () => void resolvePrivateImage(cafeId, image).then((next) => { if (!cancelled) setUrl(next) }).catch(() => {})
    if (typeof IntersectionObserver === 'undefined') { load(); return () => { cancelled = true } }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load() } })
    observer.observe(node)
    return () => { cancelled = true; observer.disconnect() }
  }, [image, cafeId])
  return <span className="menu-editor__thumb" ref={ref}>{url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <span className="menu-editor__thumb-empty" aria-hidden>☕</span>}</span>
}

function StockRow({ name, image, cafeId, low, entry, busy, onChange }: { name: string; image: string | null; cafeId: string; low: boolean; entry: StockEntry; busy: boolean; onChange: (change: { available: boolean; quantity: number | null }) => void }) {
  const [draft, setDraft] = useState(entry.quantity == null ? '' : String(entry.quantity))
  const commit = (value: string) => {
    const clean = value.trim()
    const quantity = clean === '' ? null : Math.min(100000, Math.max(0, Math.floor(Number(clean))))
    if (clean !== '' && !Number.isFinite(quantity)) { setDraft(entry.quantity == null ? '' : String(entry.quantity)); return }
    if (quantity === entry.quantity) return
    onChange({ available: entry.available || quantity === null ? true : entry.available, quantity })
  }
  const step = (delta: number) => onChange({ available: true, quantity: Math.max(0, (entry.quantity ?? 0) + delta) })
  const label = entry.quantity === 0 ? 'Esgotado' : entry.available ? 'Disponível' : 'Indisponível'
  return <li className="menu-editor__stock-row">
    <div className="menu-editor__stock-product"><Thumb image={image} cafeId={cafeId} /><div className="menu-editor__stock-name"><strong>{name}</strong><small className={low ? 'is-low' : undefined}>{entry.quantity == null ? 'Sem controle de estoque' : low ? `Perto de acabar · ${entry.quantity} em estoque` : `${entry.quantity} em estoque`}</small></div></div>
    <div className="menu-editor__stepper" role="group" aria-label={`Quantidade de ${name}`}>
      <button type="button" className="menu-editor__secondary" aria-label={`Diminuir estoque de ${name}`} onClick={() => step(-1)} disabled={busy || entry.quantity == null || entry.quantity <= 0}>−</button>
      <input inputMode="numeric" aria-label={`Quantidade em estoque de ${name}`} placeholder="Qtd." value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))} onBlur={(event) => commit(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit((event.target as HTMLInputElement).value) } }} />
      <button type="button" className="menu-editor__secondary" aria-label={`Aumentar estoque de ${name}`} onClick={() => step(1)} disabled={busy}>+</button>
    </div>
    <button type="button" className={entry.available && entry.quantity !== 0 ? 'menu-editor__availability-button is-available' : 'menu-editor__availability-button is-unavailable'} aria-pressed={entry.available && entry.quantity !== 0} onClick={() => onChange({ available: !(entry.available && entry.quantity !== 0), quantity: entry.quantity === 0 ? null : entry.quantity })} disabled={busy}>{label}</button>
  </li>
}

function OptionGroupEditor({ group, groupIndex, onChange, onRemove }: { group: OptionGroup; groupIndex: number; onChange: (change: (group: OptionGroup) => OptionGroup) => void; onRemove: () => void }) {
  function updateChoice(choiceId: string, change: (choice: Choice) => Choice) {
    onChange((current) => ({ ...current, options: current.options.map((choice) => choice.id === choiceId ? change(choice) : choice) }))
  }
  function addChoice() {
    const id = `opcao-${crypto.randomUUID()}`
    onChange((current) => ({ ...current, options: [...current.options, { id, name: '', add: 0 }] }))
  }
  return <fieldset className="menu-editor__option-group"><legend>Grupo {groupIndex + 1}</legend><div className="menu-editor__option-group-head"><label><span>Nome do grupo</span><input value={group.name} maxLength={60} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} /></label><button type="button" className="menu-editor__text-button" onClick={onRemove}>Remover grupo</button></div>
    <div className="menu-editor__option-settings"><label><span>Tipo</span><select value={group.kind} onChange={(event) => onChange((current) => ({ ...current, kind: event.target.value as OptionGroup['kind'] }))}><option value="size">Tamanho</option><option value="single">Uma escolha</option><option value="extras">Adicionais</option><option value="toggle">Ativar ou desativar</option></select></label><label><span>Máximo de escolhas</span><input type="number" min="1" max="20" value={group.max} onChange={(event) => onChange((current) => ({ ...current, max: Math.max(1, Number(event.target.value)) }))} /></label><label className="menu-editor__checkbox"><input type="checkbox" checked={group.required} onChange={(event) => onChange((current) => ({ ...current, required: event.target.checked }))} />Obrigatório</label><label><span>Escolha padrão</span><select value={group.default ?? ''} onChange={(event) => onChange((current) => ({ ...current, default: event.target.value || null }))}><option value="">Sem escolha padrão</option>{group.options.map((choice) => <option key={choice.id} value={choice.id}>{choice.name || 'Opção sem nome'}</option>)}</select></label></div>
    <div className="menu-editor__choices"><div className="menu-editor__field-head"><strong>Escolhas</strong><button type="button" className="menu-editor__secondary" onClick={addChoice}>Adicionar escolha</button></div>{!group.options.length && <p className="menu-editor__empty-note">Este grupo ainda não tem escolhas.</p>}{group.options.map((choice) => <div className="menu-editor__choice-row" key={choice.id}><label><span>Nome</span><input value={choice.name} maxLength={60} onChange={(event) => updateChoice(choice.id, (current) => ({ ...current, name: event.target.value }))} /></label><label><span>Nome curto (opcional)</span><input value={choice.short ?? ''} maxLength={24} onChange={(event) => updateChoice(choice.id, (current) => ({ ...current, short: event.target.value }))} /></label><label><span>Acréscimo (R$)</span><input type="number" min="0" step="0.01" value={choice.add} onChange={(event) => updateChoice(choice.id, (current) => ({ ...current, add: Number(event.target.value) }))} /></label><button type="button" className="menu-editor__text-button" onClick={() => onChange((current) => ({ ...current, options: current.options.filter((item) => item.id !== choice.id), default: current.default === choice.id ? null : current.default }))}>Remover</button></div>)}</div>
  </fieldset>
}

export default MenuEditor

