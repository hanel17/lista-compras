import BabyRegistry from './BabyRegistry.jsx'
import './BabyRegistry.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { uploadFamilyPhoto } from './cloudinary'
import BabySection from './BabySection.jsx'
import './BabySection.css'

const DEFAULT_THEME = { ink: '#1C2B1E', paperSoft: '#F4F8F2', accent: '#4C9A5B' }

const DEFAULT_CATEGORIES = [
  { id: 'sin_categoria',    label: 'Sin categoría',      color: '#8A8F85', locked: true },
  { id: 'emergencias',      label: 'Emergencias',         color: '#C43B3B', locked: true },
  { id: 'lacteos',          label: 'Lácteos',             color: '#5B8AC4' },
  { id: 'frutas_vegetales', label: 'Frutas y vegetales',  color: '#6FAE5E' },
  { id: 'carnes',           label: 'Carnes',              color: '#C45B5B' },
  { id: 'panaderia',        label: 'Panadería',           color: '#D9A14B' },
  { id: 'bebidas',          label: 'Bebidas',             color: '#8B6BC4' },
  { id: 'limpieza',         label: 'Limpieza',            color: '#2D9C8A' },
]

function slugify(label) {
  const base = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `${base || 'cat'}_${Math.random().toString(36).slice(2, 6)}`
}

function useHash() {
  const [hash, setHash] = window.__hashState || [window.location.hash, null]
  if (!window.__hashState) {
    const [h, setH] = [window.location.hash, (v) => { window.location.hash = v }]
    return h
  }
  return hash
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  window.__setHash = setHash

  if (hash === '#/registry') {
    return <BabyRegistry onBack={() => { window.location.hash = ''; setHash('') }} />
  }

  const [activeTab, setActiveTab] = useState('lista')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [categoryId, setCategoryId] = useState('sin_categoria')
  const [connError, setConnError] = useState(false)
  const inputRef = useRef(null)
  const [settings, setSettings] = useState({ family_photo_url: null, categories: DEFAULT_CATEGORIES, theme: DEFAULT_THEME })
  const [adminOpen, setAdminOpen] = useState(false)
  const tapTimestamps = useRef([])

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: true })
      if (!mounted) return
      if (error) setConnError(true)
      else setItems(data)
      setLoading(false)
    }
    load()
    const channel = supabase.channel('items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
        setItems((current) => {
          if (payload.eventType === 'INSERT') { if (current.some((i) => i.id === payload.new.id)) return current; return [...current, payload.new] }
          if (payload.eventType === 'UPDATE') return current.map((i) => i.id === payload.new.id ? payload.new : i)
          if (payload.eventType === 'DELETE') return current.filter((i) => i.id !== payload.old.id)
          return current
        })
      }).subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadSettings() {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single()
      if (!mounted) return
      if (!error && data) setSettings({ family_photo_url: data.family_photo_url, categories: data.categories?.length ? data.categories : DEFAULT_CATEGORIES, theme: { ...DEFAULT_THEME, ...(data.theme || {}) } })
    }
    loadSettings()
    const channel = supabase.channel('settings-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings' }, (payload) => {
        setSettings({ family_photo_url: payload.new.family_photo_url, categories: payload.new.categories?.length ? payload.new.categories : DEFAULT_CATEGORIES, theme: { ...DEFAULT_THEME, ...(payload.new.theme || {}) } })
      }).subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [])

  const categoryById = useMemo(() => Object.fromEntries(settings.categories.map((c) => [c.id, c])), [settings.categories])
  function resolveCategoryId(id) { return categoryById[id] ? id : 'sin_categoria' }
  const orderedCategoryIds = useMemo(() => { const ids = settings.categories.map((c) => c.id); return ['sin_categoria', ...ids.filter((id) => id !== 'sin_categoria')] }, [settings.categories])
  const grouped = useMemo(() => {
    const map = new Map()
    for (const id of orderedCategoryIds) map.set(id, [])
    for (const item of items) { const r = resolveCategoryId(item.category); if (!map.has(r)) map.set(r, []); map.get(r).push(item) }
    return map
  }, [items, orderedCategoryIds, categoryById])

  const pendingCount = items.filter((i) => !i.bought).length
  const emergencyColor = categoryById['emergencias']?.color || '#C43B3B'

  async function addItem(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const optimisticId = crypto.randomUUID()
    setItems((cur) => [...cur, { id: optimisticId, name: trimmed, quantity: qty.trim() || null, category: categoryId, bought: false, created_at: new Date().toISOString() }])
    setName(''); setQty('')
    inputRef.current?.focus()
    const { data, error } = await supabase.from('items').insert({ name: trimmed, quantity: qty.trim() || null, category: categoryId, bought: false }).select().single()
    if (error) { setItems((cur) => cur.filter((i) => i.id !== optimisticId)); setConnError(true) }
    else setItems((cur) => cur.map((i) => i.id === optimisticId ? data : i))
  }

  async function toggleBought(item) {
    setItems((cur) => cur.map((i) => i.id === item.id ? { ...i, bought: !i.bought } : i))
    await supabase.from('items').update({ bought: !item.bought }).eq('id', item.id)
  }

  async function removeItem(item) {
    setItems((cur) => cur.filter((i) => i.id !== item.id))
    await supabase.from('items').delete().eq('id', item.id)
  }

  async function clearBought() {
    const ids = items.filter((i) => i.bought).map((i) => i.id)
    if (!ids.length) return
    setItems((cur) => cur.filter((i) => !i.bought))
    await supabase.from('items').delete().in('id', ids)
  }

  function handlePhotoTap() {
    const now = Date.now()
    tapTimestamps.current = [...tapTimestamps.current, now].filter((t) => now - t < 3000)
    if (tapTimestamps.current.length >= 5) { tapTimestamps.current = []; setAdminOpen(true) }
  }

  return (
    <div className="page" style={{ '--ink': settings.theme.ink, '--paper-soft': settings.theme.paperSoft, '--accent': settings.theme.accent }}>
      <header className="header">
        <div className="header-row">
          <div className="title-area">
            <button className="family-photo" onClick={handlePhotoTap} aria-label="Foto de familia">
              {settings.family_photo_url ? <img src={settings.family_photo_url} alt="Familia" /> : <span className="family-photo-placeholder">🏠</span>}
            </button>
            <h1>Lista de compra Fam Ramírez</h1>
          </div>
          <span className="badge">{pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}</span>
        </div>
        <p className="subtitle">Lo que falta en la despensa, al instante para los dos.</p>
      </header>

      <div className="app-tabs">
        <button className={`app-tab ${activeTab === 'lista' ? 'app-tab--active' : ''}`} onClick={() => setActiveTab('lista')}>🛒 La Lista</button>
        <button className={`app-tab ${activeTab === 'bebe' ? 'app-tab--active' : ''}`} onClick={() => setActiveTab('bebe')}>👶 Bebé</button>
      </div>

      {activeTab === 'lista' && <>
        {connError && <div className="error-banner">No se pudo conectar a Supabase.</div>}
        <form className="add-form" onSubmit={addItem}>
          <input ref={inputRef} className="add-input" type="text" placeholder="Ej. Leche, detergente, pan..." value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <input className="qty-input" type="text" placeholder="Cant." value={qty} onChange={(e) => setQty(e.target.value)} autoComplete="off" />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="cat-select">
            {orderedCategoryIds.map((id) => <option key={id} value={id}>{categoryById[id]?.label || id}</option>)}
          </select>
          <button type="submit" className="add-button">Añadir</button>
        </form>
        {loading ? <p className="empty-state">Cargando...</p> : items.length === 0 ? <div className="empty-state"><p>La despensa está al día.</p></div> : (
          <div className="categories">
            {orderedCategoryIds.map((id) => {
              const catItems = grouped.get(id) || []
              if (!catItems.length) return null
              const cat = categoryById[id]
              return (
                <section key={id} className="category-block">
                  <div className="category-label"><span className="dot" style={{ background: cat.color }} /><span>{cat.label}</span><span className="count">{catItems.filter(i => !i.bought).length}</span></div>
                  <ul className="item-list">
                    {catItems.filter(i => !i.bought).map(item => <ItemRow key={item.id} item={item} urgent={id === 'emergencias'} urgentColor={emergencyColor} onToggle={toggleBought} onRemove={removeItem} />)}
                    {catItems.filter(i => i.bought).map(item => <ItemRow key={item.id} item={item} urgent={false} urgentColor={emergencyColor} onToggle={toggleBought} onRemove={removeItem} />)}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
        {items.some((i) => i.bought) && <button className="clear-button" onClick={clearBought}>Quitar comprados ({items.filter((i) => i.bought).length})</button>}
      </>}

      {activeTab === 'bebe' && <BabySection />}

      {adminOpen && <AdminPanel settings={settings} onClose={() => setAdminOpen(false)} onSettingsSaved={(next) => setSettings(next)} />}
    </div>
  )
}

function ItemRow({ item, urgent, urgentColor, onToggle, onRemove }) {
  return (
    <li className={`item-row ${item.bought ? 'bought' : ''} ${urgent ? 'urgent' : ''}`} style={urgent ? { borderLeft: `3px solid ${urgentColor}` } : undefined}>
      <button className="check" onClick={() => onToggle(item)}>{item.bought ? '✓' : ''}</button>
      <span className="item-name" style={urgent ? { color: urgentColor, fontWeight: 600 } : undefined}>{item.name}</span>
      {item.quantity && <span className="item-qty">{item.quantity}</span>}
      <button className="remove" onClick={() => onRemove(item)}>✕</button>
    </li>
  )
}

function AdminPanel({ settings, onClose, onSettingsSaved }) {
  const [draftCategories, setDraftCategories] = useState(settings.categories.map((c) => ({ ...c })))
  const [draftTheme, setDraftTheme] = useState({ ...settings.theme })
  const [photoUrl, setPhotoUrl] = useState(settings.family_photo_url)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setError(null)
    try { const url = await uploadFamilyPhoto(file); setPhotoUrl(url); await supabase.from('app_settings').update({ family_photo_url: url }).eq('id', 1) }
    catch { setError('No se pudo subir la foto.') }
    finally { setUploading(false) }
  }

  function updateCategory(id, field, value) { setDraftCategories((cur) => cur.map((c) => c.id === id ? { ...c, [field]: value } : c)) }
  function addCategory() { setDraftCategories((cur) => [...cur, { id: slugify('Nueva categoría'), label: 'Nueva categoría', color: '#5B8AC4' }]) }
  function removeCategory(id) { setDraftCategories((cur) => cur.filter((c) => c.id !== id)) }

  async function saveAll() {
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('app_settings').update({ categories: draftCategories, theme: draftTheme }).eq('id', 1)
    setSaving(false)
    if (err) { setError('No se pudo guardar.'); return }
    onSettingsSaved({ family_photo_url: photoUrl, categories: draftCategories, theme: draftTheme })
    onClose()
  }

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header"><h2>Panel de administración</h2><button className="admin-close" onClick={onClose}>✕</button></div>
        {error && <div className="error-banner">{error}</div>}
        <section className="admin-section">
          <h3>Foto de familia</h3>
          <div className="photo-row">
            <div className="photo-preview">{photoUrl ? <img src={photoUrl} alt="Familia" /> : <span>🏠</span>}</div>
            <label className="upload-button">{uploading ? 'Subiendo...' : 'Subir foto'}<input type="file" accept="image/*" onChange={handlePhotoChange} hidden disabled={uploading} /></label>
          </div>
        </section>
        <section className="admin-section">
          <h3>Categorías</h3>
          <ul className="admin-category-list">
            {draftCategories.map((cat) => (
              <li key={cat.id} className="admin-category-row">
                <input type="color" value={cat.color} onChange={(e) => updateCategory(cat.id, 'color', e.target.value)} className="color-input" />
                <input type="text" value={cat.label} onChange={(e) => updateCategory(cat.id, 'label', e.target.value)} className="cat-label-input" disabled={cat.locked} />
                {!cat.locked && <button className="remove" onClick={() => removeCategory(cat.id)}>✕</button>}
              </li>
            ))}
          </ul>
          <button className="add-category-button" onClick={addCategory}>+ Agregar categoría</button>
        </section>
        <section className="admin-section">
          <h3>Colores de la app</h3>
          <div className="theme-row">
            <label>Fondo<input type="color" value={draftTheme.paperSoft} onChange={(e) => setDraftTheme((t) => ({ ...t, paperSoft: e.target.value }))} /></label>
            <label>Texto<input type="color" value={draftTheme.ink} onChange={(e) => setDraftTheme((t) => ({ ...t, ink: e.target.value }))} /></label>
            <label>Acento<input type="color" value={draftTheme.accent} onChange={(e) => setDraftTheme((t) => ({ ...t, accent: e.target.value }))} /></label>
          </div>
        </section>
        <button className="save-button" onClick={saveAll} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
      </div>
    </div>
  )
}