import { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { uploadPhoto } from './cloudinary'
import { BABY_CATEGORIES, STATUSES, PRIORITIES, RESPONSIBLES, CATEGORY_MAP, STATUS_MAP, PRIORITY_MAP, INITIAL_CHECKLIST } from './babyData'

function fmtRD(n) {
  if (n == null || n === '') return '—'
  return 'RD$ ' + Number(n).toLocaleString('es-DO', { minimumFractionDigits: 0 })
}
function isOverdue(due) {
  if (!due) return false
  return new Date(due + 'T23:59:59') < new Date()
}
function isSoon(due) {
  if (!due) return false
  const diff = new Date(due + 'T23:59:59') - new Date()
  return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000
}
function validateUrl(s) {
  if (!s) return true
  try { new URL(s); return true } catch { return false }
}

export default function BabySection() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [editing, setEditing] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sortBy, setSortBy] = useState('priority')

  useEffect(() => {
    let mounted = true
    supabase.from('baby_items').select('*').order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return
        if (!error) setItems(data || [])
        setLoading(false)
      })
    const ch = supabase.channel('baby-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'baby_items' }, payload => {
        setItems(cur => {
          if (payload.eventType === 'INSERT') { if (cur.some(i => i.id === payload.new.id)) return cur; return [...cur, payload.new] }
          if (payload.eventType === 'UPDATE') return cur.map(i => i.id === payload.new.id ? payload.new : i)
          if (payload.eventType === 'DELETE') return cur.filter(i => i.id !== payload.old.id)
          return cur
        })
      }).subscribe()
    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [])

  const stats = useMemo(() => {
    const active = items.filter(i => i.status !== 'no_necesario')
    const bought = active.filter(i => i.status === 'comprado')
    const esenciales = active.filter(i => i.priority === 'esencial' && i.status !== 'comprado')
    const totalEst = active.reduce((s, i) => s + (Number(i.price_estimated) || 0) * (i.qty_needed || 1), 0)
    const totalPaid = active.reduce((s, i) => s + (Number(i.price_paid) || 0) * (i.qty_bought || 0), 0)
    const pct = active.length ? Math.round((bought.length / active.length) * 100) : 0
    const overdueCnt = active.filter(i => isOverdue(i.due_date) && i.status !== 'comprado').length
    const soonCnt = active.filter(i => isSoon(i.due_date) && i.status !== 'comprado').length
    return { total: active.length, bought: bought.length, pending: active.length - bought.length, esenciales: esenciales.length, pct, totalEst, totalPaid, overdueCnt, soonCnt }
  }, [items])

  const filtered = useMemo(() => {
    let list = [...items]
    if (filterStatus !== 'all') list = list.filter(i => i.status === filterStatus)
    if (filterPriority !== 'all') list = list.filter(i => i.priority === filterPriority)
    if (filterCategory !== 'all') list = list.filter(i => i.category === filterCategory)
    if (search.trim()) list = list.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    const PORDER = { esencial: 0, importante: 1, opcional: 2 }
    const SORDER = { pendiente: 0, por_comprar: 1, comprado: 2, para_despues: 3, no_necesario: 4 }
    if (sortBy === 'priority') list.sort((a, b) => PORDER[a.priority] - PORDER[b.priority])
    else if (sortBy === 'status') list.sort((a, b) => SORDER[a.status] - SORDER[b.status])
    else if (sortBy === 'category') list.sort((a, b) => a.category.localeCompare(b.category))
    else if (sortBy === 'price') list.sort((a, b) => (b.price_estimated || 0) - (a.price_estimated || 0))
    else if (sortBy === 'due') list.sort((a, b) => { if (!a.due_date) return 1; if (!b.due_date) return -1; return a.due_date.localeCompare(b.due_date) })
    else if (sortBy === 'recent') list.sort((a, b) => b.created_at?.localeCompare(a.created_at))
    return list
  }, [items, filterStatus, filterPriority, filterCategory, search, sortBy])

  async function saveItem(data) {
    if (editing) {
      const { data: updated } = await supabase.from('baby_items').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editing.id).select().single()
      if (updated) setItems(cur => cur.map(i => i.id === updated.id ? updated : i))
    } else {
      const { data: created } = await supabase.from('baby_items').insert(data).select().single()
      if (created) setItems(cur => [...cur, created])
    }
    setView('list'); setEditing(null)
  }

  async function deleteItem(id) {
    await supabase.from('baby_items').delete().eq('id', id)
    setItems(cur => cur.filter(i => i.id !== id))
    setView('list'); setDetailItem(null)
  }

  async function createChecklist() {
    const existing = items.map(i => i.name.toLowerCase())
    const toInsert = INITIAL_CHECKLIST.filter(i => !existing.includes(i.name.toLowerCase())).map(i => ({ ...i, status: 'pendiente', qty_bought: 0, responsible: 'ambos' }))
    if (!toInsert.length) return alert('La checklist inicial ya fue creada.')
    const { data: created } = await supabase.from('baby_items').insert(toInsert).select()
    if (created) setItems(cur => [...cur, ...created])
  }

  function openEdit(item) { setEditing(item); setView('form') }
  function openDetail(item) { setDetailItem(item); setView('detail') }

  if (view === 'form') return <BabyForm initial={editing} onSave={saveItem} onCancel={() => { setView('list'); setEditing(null) }} />

  if (view === 'detail' && detailItem) {
    const live = items.find(i => i.id === detailItem.id) || detailItem
    return <BabyDetail item={live} onEdit={() => openEdit(live)} onDelete={() => deleteItem(live.id)} onBack={() => setView('list')}
      onToggleBought={async () => {
        const next = live.status === 'comprado' ? 'pendiente' : 'comprado'
        await supabase.from('baby_items').update({ status: next, qty_bought: next === 'comprado' ? live.qty_needed : 0, updated_at: new Date().toISOString() }).eq('id', live.id)
      }} />
  }

  return (
    <div className="baby-page">
      <BabyDashboard stats={stats} onCreateChecklist={createChecklist} hasItems={items.length > 0} />
      {stats.esenciales > 0 && <div className="baby-alert">Tienes <strong>{stats.esenciales}</strong> esenciales pendientes.</div>}
      {stats.overdueCnt > 0 && <div className="baby-alert baby-alert--red"><strong>{stats.overdueCnt}</strong> tarea(s) vencida(s).</div>}
      {stats.soonCnt > 0 && <div className="baby-alert baby-alert--yellow"><strong>{stats.soonCnt}</strong> tarea(s) vence esta semana.</div>}
      {stats.esenciales > 0 && <WhatsMissing items={items} />}
      <div className="baby-controls">
        <div className="baby-search-row">
          <input className="baby-search" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="baby-add-btn" onClick={() => { setEditing(null); setView('form') }}>+ Agregar</button>
        </div>
        <div className="baby-filters">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">Todos los estados</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">Todas las prioridades</option>
            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="all">Todas las categorias</option>
            {BABY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="priority">Prioridad</option>
            <option value="status">Estado</option>
            <option value="category">Categoria</option>
            <option value="price">Precio</option>
            <option value="due">Fecha limite</option>
            <option value="recent">Mas recientes</option>
          </select>
        </div>
      </div>
      {loading ? <p className="baby-empty">Cargando...</p> : filtered.length === 0 ? (
        <div className="baby-empty">
          {items.length === 0 ? <><p>No hay productos todavia.</p><button className="baby-checklist-btn" onClick={createChecklist}>Crear checklist inicial</button></> : <p>No hay productos con estos filtros.</p>}
        </div>
      ) : (
        <div className="baby-grid">{filtered.map(item => <BabyCard key={item.id} item={item} onClick={() => openDetail(item)} />)}</div>
      )}
    </div>
  )
}

function BabyDetail({ item, onEdit, onDelete, onBack, onToggleBought }) {
  const cat = CATEGORY_MAP[item.category]
  const priority = PRIORITY_MAP[item.priority]
  const status = STATUS_MAP[item.status]
  const resp = RESPONSIBLES.find(r => r.id === item.responsible)
  const diff = (item.price_estimated && item.price_paid) ? Number(item.price_estimated) - Number(item.price_paid) : null
  return (
    <div className="baby-detail">
      <button className="baby-back" onClick={onBack}>← Volver</button>
      <div className="baby-detail__photo">
        {item.photo_url ? <img src={item.photo_url} alt={item.name} /> : <span>{cat?.icon || '📦'}</span>}
      </div>
      <h2>{priority?.emoji} {item.name}</h2>
      <div className="baby-detail__tags">
        <span className="baby-tag" style={{ background: (status?.color || '#888') + '22', color: status?.color }}>{status?.label}</span>
        <span className="baby-tag">{cat?.icon} {cat?.label}</span>
        <span className="baby-tag">👤 {resp?.label || item.responsible}</span>
      </div>
      <div className="baby-detail__grid">
        <div><span>Cantidad necesaria</span><strong>{item.qty_needed}</strong></div>
        <div><span>Cantidad comprada</span><strong>{item.qty_bought || 0}</strong></div>
        <div><span>Faltan</span><strong>{Math.max(0, (item.qty_needed || 1) - (item.qty_bought || 0))}</strong></div>
        {item.price_estimated && <div><span>Precio estimado</span><strong>{fmtRD(item.price_estimated)}</strong></div>}
        {item.price_paid && <div><span>Precio pagado</span><strong>{fmtRD(item.price_paid)}</strong></div>}
        {diff !== null && <div><span>{diff >= 0 ? 'Ahorro' : 'Sobrecosto'}</span><strong style={{ color: diff >= 0 ? '#4C9A5B' : '#C43B3B' }}>{fmtRD(Math.abs(diff))}</strong></div>}
        {item.due_date && <div><span>Fecha limite</span><strong>{item.due_date}</strong></div>}
      </div>
      {item.notes && <div className="baby-detail__notes"><span>Notas</span><p>{item.notes}</p></div>}
      {item.buy_link && <a className="baby-detail__link" href={item.buy_link} target="_blank" rel="noopener noreferrer">Ver producto</a>}
      <div className="baby-detail__actions">
        <button className="baby-btn baby-btn--primary" onClick={onToggleBought}>{item.status === 'comprado' ? 'Marcar pendiente' : 'Marcar comprado'}</button>
        <button className="baby-btn baby-btn--outline" onClick={onEdit}>Editar</button>
        <button className="baby-btn baby-btn--danger" onClick={() => { if (window.confirm('Eliminar este producto?')) onDelete() }}>Eliminar</button>
      </div>
    </div>
  )
}

const EMPTY = { name: '', category: 'otros', qty_needed: 1, qty_bought: 0, price_estimated: '', price_paid: '', status: 'pendiente', priority: 'importante', photo_url: '', buy_link: '', notes: '', due_date: '', responsible: 'ambos' }

function BabyForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? {
    name: initial.name || '', category: initial.category || 'otros',
    qty_needed: initial.qty_needed ?? 1, qty_bought: initial.qty_bought ?? 0,
    price_estimated: initial.price_estimated ?? '', price_paid: initial.price_paid ?? '',
    status: initial.status || 'pendiente', priority: initial.priority || 'importante',
    photo_url: initial.photo_url || '', buy_link: initial.buy_link || '',
    notes: initial.notes || '', due_date: initial.due_date || '', responsible: initial.responsible || 'ambos',
  } : { ...EMPTY })
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState({})

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { set('photo_url', await uploadPhoto(file)) }
    catch { alert('No se pudo subir la foto.') }
    finally { setUploading(false) }
  }

  function validate() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'El nombre es requerido.'
    if (form.buy_link && !validateUrl(form.buy_link)) errs.buy_link = 'URL invalida.'
    if (Number(form.qty_bought) > Number(form.qty_needed)) errs.qty_bought = 'No puede ser mayor que la cantidad necesaria.'
    setErrors(errs)
    return !Object.keys(errs).length
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSave({
      name: form.name.trim(), category: form.category,
      qty_needed: Number(form.qty_needed) || 1, qty_bought: Number(form.qty_bought) || 0,
      price_estimated: form.price_estimated !== '' ? Number(form.price_estimated) : null,
      price_paid: form.price_paid !== '' ? Number(form.price_paid) : null,
      status: form.status, priority: form.priority,
      photo_url: form.photo_url || null, buy_link: form.buy_link || null,
      notes: form.notes || null, due_date: form.due_date || null, responsible: form.responsible,
    })
  }

  return (
    <div className="baby-form-page">
      <button className="baby-back" onClick={onCancel}>← Cancelar</button>
      <h2>{initial ? 'Editar producto' : 'Nuevo producto'}</h2>
      <form onSubmit={handleSubmit} className="baby-form">
        <label>Nombre *
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej. Panales recien nacido" />
          {errors.name && <span className="baby-form__error">{errors.name}</span>}
        </label>
        <div className="baby-form__row">
          <label>Categoria
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {BABY_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </label>
          <label>Prioridad
            <select value={form.priority} onChange={e => set('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.label}</option>)}
            </select>
          </label>
        </div>
        <div className="baby-form__row">
          <label>Estado
            <select value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label>Responsable
            <select value={form.responsible} onChange={e => set('responsible', e.target.value)}>
              {RESPONSIBLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        </div>
        <div className="baby-form__row">
          <label>Cantidad necesaria
            <input type="number" min="1" value={form.qty_needed} onChange={e => set('qty_needed', e.target.value)} />
          </label>
          <label>Cantidad comprada
            <input type="number" min="0" value={form.qty_bought} onChange={e => set('qty_bought', e.target.value)} />
            {errors.qty_bought && <span className="baby-form__error">{errors.qty_bought}</span>}
          </label>
        </div>
        <div className="baby-form__row">
          <label>Precio estimado (RD$)
            <input type="number" min="0" step="0.01" value={form.price_estimated} onChange={e => set('price_estimated', e.target.value)} placeholder="0.00" />
          </label>
          <label>Precio pagado (RD$)
            <input type="number" min="0" step="0.01" value={form.price_paid} onChange={e => set('price_paid', e.target.value)} placeholder="0.00" />
          </label>
        </div>
        <label>Fecha limite
          <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </label>
        <label>Link de compra
          <input type="url" value={form.buy_link} onChange={e => set('buy_link', e.target.value)} placeholder="https://..." />
          {errors.buy_link && <span className="baby-form__error">{errors.buy_link}</span>}
        </label>
        <label>Notas
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Ej. Talla 0-3 meses, preferiblemente algodon..." />
        </label>
        <label>Foto
          <div className="baby-form__photo">
            {form.photo_url && <img src={form.photo_url} alt="preview" />}
            <label className="upload-button">
              {uploading ? 'Subiendo...' : form.photo_url ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/*" onChange={handlePhoto} hidden disabled={uploading} />
            </label>
          </div>
        </label>
        <button type="submit" className="save-button" disabled={uploading}>
          {uploading ? 'Subiendo foto...' : initial ? 'Guardar cambios' : 'Agregar producto'}
        </button>
      </form>
    </div>
  )
}

function BabyDashboard({ stats, onCreateChecklist, hasItems }) {
  return (
    <div className="baby-dashboard">
      <div className="baby-dashboard__header">
        <h2>Preparacion para el bebe</h2>
        {!hasItems && <button className="baby-checklist-btn" onClick={onCreateChecklist}>Crear checklist inicial</button>}
      </div>
      <div className="baby-progress-bar"><div className="baby-progress-bar__fill" style={{ width: stats.pct + '%' }} /></div>
      <p className="baby-progress-label">{stats.pct}% preparado - {stats.bought} de {stats.total} completados</p>
      <div className="baby-stats-row">
        <div className="baby-stat"><span className="baby-stat__num">{stats.pending}</span><span className="baby-stat__lbl">pendientes</span></div>
        <div className="baby-stat"><span className="baby-stat__num baby-stat__num--red">{stats.esenciales}</span><span className="baby-stat__lbl">esenciales</span></div>
        <div className="baby-stat"><span className="baby-stat__num">{stats.bought}</span><span className="baby-stat__lbl">comprados</span></div>
      </div>
      <div className="baby-budget">
        <div className="baby-budget__row"><span>Estimado</span><strong>{fmtRD(stats.totalEst)}</strong></div>
        <div className="baby-budget__row"><span>Gastado</span><strong style={{ color: 'var(--accent)' }}>{fmtRD(stats.totalPaid)}</strong></div>
        <div className="baby-budget__row"><span>Pendiente</span><strong>{fmtRD(stats.totalEst - stats.totalPaid)}</strong></div>
      </div>
    </div>
  )
}
function WhatsMissing({ items }) {
  const missing = items.filter(i => i.priority === 'esencial' && i.status !== 'comprado' && i.status !== 'no_necesario').slice(0, 8)
  if (!missing.length) return null
  return (
    <div className="baby-missing">
      <h3>Que nos falta</h3>
      <ul>
        {missing.map(item => {
          const p = PRIORITY_MAP[item.priority]
          const s = STATUS_MAP[item.status]
          const falta = (item.qty_needed || 1) - (item.qty_bought || 0)
          return (
            <li key={item.id}>
              <span>{p?.emoji}</span>
              <span className="baby-missing__name">{item.name}</span>
              <span className="baby-missing__meta">{falta > 0 ? 'Faltan ' + falta : s?.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
function BabyCard({ item, onClick }) {
  const cat = CATEGORY_MAP[item.category]
  const priority = PRIORITY_MAP[item.priority]
  const status = STATUS_MAP[item.status]
  const overdue = isOverdue(item.due_date) && item.status !== 'comprado'
  const soon = isSoon(item.due_date) && item.status !== 'comprado'
  return (
    <div className={'baby-card' + (item.status === 'comprado' ? ' baby-card--done' : '') + (overdue ? ' baby-card--overdue' : '')} onClick={onClick}>
      <div className="baby-card__photo">
        {item.photo_url ? <img src={item.photo_url} alt={item.name} /> : <span>{cat?.icon || '📦'}</span>}
      </div>
      <div className="baby-card__body">
        <div className="baby-card__top">
          <span className="baby-card__priority">{priority?.emoji}</span>
          <span className="baby-card__name">{item.name}</span>
          {item.status === 'comprado' && <span className="baby-card__check">✓</span>}
        </div>
        <div className="baby-card__meta">
          <span className="baby-tag" style={{ background: (status?.color || '#888') + '22', color: status?.color }}>{status?.label}</span>
          <span className="baby-tag">{cat?.icon} {cat?.label}</span>
        </div>
        <div className="baby-card__bottom">
          {item.qty_needed > 1 && <span className="baby-card__qty">{item.qty_bought || 0}/{item.qty_needed}</span>}
          {item.price_estimated && <span className="baby-card__price">{fmtRD(item.price_estimated)}</span>}
          {overdue && <span className="baby-card__due baby-card__due--red">Vencido</span>}
          {soon && !overdue && <span className="baby-card__due baby-card__due--yellow">Esta semana</span>}
        </div>
      </div>
    </div>
  )
}

