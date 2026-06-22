import { useEffect, useMemo, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

const CATEGORIES = [
  { id: 'lacteos', label: 'Lácteos', color: '#5B8AC4' },
  { id: 'frutas_vegetales', label: 'Frutas y vegetales', color: '#6FAE5E' },
  { id: 'carnes', label: 'Carnes', color: '#C45B5B' },
  { id: 'panaderia', label: 'Panadería', color: '#D9A14B' },
  { id: 'bebidas', label: 'Bebidas', color: '#8B6BC4' },
  { id: 'limpieza', label: 'Limpieza', color: '#2D9C8A' },
  { id: 'otros', label: 'Otros', color: '#8A8A8A' },
]

const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

export default function App() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [connError, setConnError] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: true })
      if (!mounted) return
      if (error) {
        setConnError(true)
      } else {
        setItems(data)
      }
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
        setItems((current) => {
          if (payload.eventType === 'INSERT') {
            if (current.some((i) => i.id === payload.new.id)) return current
            return [...current, payload.new]
          }
          if (payload.eventType === 'UPDATE') {
            return current.map((i) => (i.id === payload.new.id ? payload.new : i))
          }
          if (payload.eventType === 'DELETE') {
            return current.filter((i) => i.id !== payload.old.id)
          }
          return current
        })
      })
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const cat of CATEGORIES) map.set(cat.id, [])
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, [])
      map.get(item.category).push(item)
    }
    return map
  }, [items])

  const pendingCount = items.filter((i) => !i.bought).length

  async function addItem(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const optimisticId = crypto.randomUUID()
    const optimisticItem = {
      id: optimisticId,
      name: trimmed,
      quantity: qty.trim() || null,
      category,
      bought: false,
      created_at: new Date().toISOString(),
    }
    setItems((current) => [...current, optimisticItem])
    setName('')
    setQty('')
    inputRef.current?.focus()

    const { data, error } = await supabase
      .from('items')
      .insert({ name: trimmed, quantity: optimisticItem.quantity, category, bought: false })
      .select()
      .single()

    if (error) {
      setItems((current) => current.filter((i) => i.id !== optimisticId))
      setConnError(true)
    } else {
      setItems((current) => current.map((i) => (i.id === optimisticId ? data : i)))
    }
  }

  async function toggleBought(item) {
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, bought: !i.bought } : i))
    )
    const { error } = await supabase
      .from('items')
      .update({ bought: !item.bought })
      .eq('id', item.id)
    if (error) setConnError(true)
  }

  async function removeItem(item) {
    setItems((current) => current.filter((i) => i.id !== item.id))
    const { error } = await supabase.from('items').delete().eq('id', item.id)
    if (error) setConnError(true)
  }

  async function clearBought() {
    const boughtIds = items.filter((i) => i.bought).map((i) => i.id)
    if (boughtIds.length === 0) return
    setItems((current) => current.filter((i) => !i.bought))
    const { error } = await supabase.from('items').delete().in('id', boughtIds)
    if (error) setConnError(true)
  }

  return (
    <div className="page">
      <header className="header">
        <div className="header-row">
          <h1>La Lista</h1>
          <span className="badge">{pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}</span>
        </div>
        <p className="subtitle">Lo que falta en la despensa, al instante para los dos.</p>
      </header>

      {connError && (
        <div className="error-banner">
          No se pudo conectar a Supabase. Revisa que las variables VITE_SUPABASE_URL y
          VITE_SUPABASE_ANON_KEY estén configuradas correctamente.
        </div>
      )}

      <form className="add-form" onSubmit={addItem}>
        <input
          ref={inputRef}
          className="add-input"
          type="text"
          placeholder="Ej. Leche, detergente, pan..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
        <input
          className="qty-input"
          type="text"
          placeholder="Cant."
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          autoComplete="off"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="cat-select">
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <button type="submit" className="add-button">Añadir</button>
      </form>

      {loading ? (
        <p className="empty-state">Cargando la lista...</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>La despensa está al día. Nada que comprar todavía.</p>
        </div>
      ) : (
        <div className="categories">
          {CATEGORIES.map((cat) => {
            const catItems = grouped.get(cat.id) || []
            if (catItems.length === 0) return null
            const pending = catItems.filter((i) => !i.bought)
            const bought = catItems.filter((i) => i.bought)
            return (
              <section key={cat.id} className="category-block">
                <div className="category-label">
                  <span className="dot" style={{ background: cat.color }} />
                  <span>{cat.label}</span>
                  <span className="count">{pending.length}</span>
                </div>
                <ul className="item-list">
                  {pending.map((item) => (
                    <ItemRow key={item.id} item={item} onToggle={toggleBought} onRemove={removeItem} />
                  ))}
                  {bought.map((item) => (
                    <ItemRow key={item.id} item={item} onToggle={toggleBought} onRemove={removeItem} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {items.some((i) => i.bought) && (
        <button className="clear-button" onClick={clearBought}>
          Quitar comprados ({items.filter((i) => i.bought).length})
        </button>
      )}
    </div>
  )
}

function ItemRow({ item, onToggle, onRemove }) {
  return (
    <li className={`item-row ${item.bought ? 'bought' : ''}`}>
      <button className="check" onClick={() => onToggle(item)} aria-label="Marcar como comprado">
        {item.bought ? '✓' : ''}
      </button>
      <span className="item-name">{item.name}</span>
      {item.quantity && <span className="item-qty">{item.quantity}</span>}
      <button className="remove" onClick={() => onRemove(item)} aria-label="Eliminar">
        ✕
      </button>
    </li>
  )
}
