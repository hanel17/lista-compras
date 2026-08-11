
import { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabaseClient'

function fmtRD(n) {
  if (!n) return null
  return 'RD$ ' + Number(n).toLocaleString('es-DO', { minimumFractionDigits: 0 })
}
const CAT_ICONS = { dormir:'🛏️',ropa:'👕',higiene:'🧼',alimentacion:'🍼',transporte:'🚗',habitacion:'🏠',hospital:'🏥',mama:'👩‍🍼',documentos:'📄',otros:'🧰' }
const CAT_LABELS = { dormir:'Dormir',ropa:'Ropa',higiene:'Higiene',alimentacion:'Alimentación',transporte:'Transporte',habitacion:'Habitación',hospital:'Hospital',mama:'Mamá',documentos:'Documentos',otros:'Otros' }
function getAvailable(item, reservations) {
  const reserved = reservations.filter(r => r.baby_item_id === item.id).reduce((s,r)=>s+(r.qty_reserved||1),0)
  return Math.max(0,(item.qty_needed||1)-(item.qty_bought||0)-reserved)
}

export default function BabyRegistry() {
  const [items,setItems]=useState([])
  const [reservations,setReservations]=useState([])
  const [settings,setSettings]=useState(null)
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('needed')
  const [catFilter,setCatFilter]=useState('all')
  const [reservingItem,setReservingItem]=useState(null)
  const [successItem,setSuccessItem]=useState(null)

  useEffect(()=>{
    async function load(){
      const [{ data: its },{ data: res },{ data: set }] = await Promise.all([
        supabase.from('baby_items').select('*').order('created_at',{ascending:true}),
        supabase.from('baby_reservations').select('*'),
        supabase.from('app_settings').select('*').eq('id',1).single(),
      ])
      setItems(its||[])
      setReservations(res||[])
      setSettings(set)
      setLoading(false)
    }
    load()
    const ch1=supabase.channel('reg-items').on('postgres_changes',{event:'*',schema:'public',table:'baby_items'},p=>{
      setItems(cur=>{
        if(p.eventType==='INSERT') return [...cur,p.new]
        if(p.eventType==='UPDATE') return cur.map(i=>i.id===p.new.id?p.new:i)
        if(p.eventType==='DELETE') return cur.filter(i=>i.id!==p.old.id)
        return cur
      })
    }).subscribe()
    const ch2=supabase.channel('reg-reservations').on('postgres_changes',{event:'*',schema:'public',table:'baby_reservations'},p=>{
      setReservations(cur=>{
        if(p.eventType==='INSERT') return [...cur,p.new]
        if(p.eventType==='DELETE') return cur.filter(r=>r.id!==p.old.id)
        return cur
      })
    }).subscribe()
    return()=>{ supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  },[])

  const stats=useMemo(()=>{
    const active=items.filter(i=>i.status!=='no_necesario')
    const bought=active.filter(i=>i.status==='comprado')
    const pct=active.length?Math.round((bought.length/active.length)*100):0
    return{total:active.length,bought:bought.length,needed:active.length-bought.length,pct}
  },[items])

  const categories=useMemo(()=>[...new Set(items.filter(i=>i.status!=='comprado'&&i.status!=='no_necesario').map(i=>i.category))],[items])

  const filtered=useMemo(()=>{
    let list=items.filter(i=>i.status!=='no_necesario')
    if(filter==='needed') list=list.filter(i=>i.status!=='comprado')
    if(filter==='essential') list=list.filter(i=>i.priority==='esencial'&&i.status!=='comprado')
    if(filter==='owned') list=list.filter(i=>i.status==='comprado')
    if(catFilter!=='all') list=list.filter(i=>i.category===catFilter)
    return list
  },[items,filter,catFilter])

  async function handleReserve(item,name,message,qty){
    if(!name.trim()) return
    const available=getAvailable(item,reservations)
    if(available<=0){alert('Este regalo acaba de ser elegido por otra persona.');return}
    const qtyToReserve=Math.min(qty,available)
    const{error}=await supabase.from('baby_reservations').insert({baby_item_id:item.id,reserver_name:name.trim(),reserver_message:message.trim()||null,qty_reserved:qtyToReserve})
    if(error){alert('Ocurrió un problema. Intenta de nuevo.');return}
    await supabase.from('baby_items').update({ status: 'reservado', updated_at: new Date().toISOString() }).eq('id', item.id)
    setReservingItem(null)
    setSuccessItem({item,name,qty:qtyToReserve})
  }

  function shareList(){
    const url=window.location.href
    if(navigator.share){navigator.share({title:'Lista de regalos Familia Ramírez',url})}
    else{navigator.clipboard?.writeText(url);alert('Enlace copiado!')}
  }

  if(loading) return <div className="reg-loading"><div className="reg-spinner"/><p>Cargando lista...</p></div>
  if(successItem) return <SuccessScreen item={successItem.item} name={successItem.name} qty={successItem.qty} onClose={()=>setSuccessItem(null)}/>
  if(reservingItem) return <ReserveModal item={reservingItem} available={getAvailable(reservingItem,reservations)} onConfirm={handleReserve} onClose={()=>setReservingItem(null)}/>

  return(
    <div className="reg-page">
      <header className="reg-header">
        <div className="reg-header__badge">Baby Registry</div>
        <h1 className="reg-header__title">Familia Ramírez</h1>
        <div className="reg-header__baby">Gael está en camino</div>
        <p className="reg-header__msg">{settings?.registry_message||'Estamos preparando la llegada de nuestro bebé con mucho amor. Si quieres ayudarnos con algún regalito, puedes elegir uno de la lista.'}</p>
        <button className="reg-share-btn" onClick={shareList}>Compartir lista</button>
      </header>

      <div className="reg-progress-card">
        <div className="reg-stats">
          <div className="reg-stat"><span className="reg-stat__num">{stats.total}</span><span className="reg-stat__lbl">Total</span></div>
          <div className="reg-stat reg-stat--green"><span className="reg-stat__num">{stats.bought}</span><span className="reg-stat__lbl">Ya tenemos</span></div>
          <div className="reg-stat reg-stat--blue"><span className="reg-stat__num">{stats.needed}</span><span className="reg-stat__lbl">Nos faltan</span></div>
        </div>
        <div className="reg-progress-bar"><div className="reg-progress-bar__fill" style={{width:stats.pct+'%'}}/></div>
        <p className="reg-progress-label">{stats.pct}% completado</p>
      </div>

      <div className="reg-filters">
        <div className="reg-filter-tabs">
          {[{id:'needed',label:'Nos faltan'},{id:'essential',label:'Esenciales'},{id:'owned',label:'Ya tenemos'},{id:'all',label:'Todos'}].map(f=>(
            <button key={f.id} className={'reg-filter-tab'+(filter===f.id?' reg-filter-tab--active':'')} onClick={()=>setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        {categories.length>0&&(
          <select className="reg-cat-select" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
            <option value="all">Todas las categorias</option>
            {categories.map(c=><option key={c} value={c}>{CAT_ICONS[c]} {CAT_LABELS[c]||c}</option>)}
          </select>
        )}
      </div>

      <div className="reg-section-title">{filter==='owned'?'Ya tenemos':'Lo que todavia necesitamos'}</div>
      {filtered.length===0?<div className="reg-empty"><p>No hay productos en esta seccion.</p></div>:(
        <div className="reg-grid">
          {filtered.map(item=><RegistryCard key={item.id} item={item} reservations={reservations.filter(r=>r.baby_item_id===item.id)} available={getAvailable(item,reservations)} onReserve={()=>setReservingItem(item)}/>)}
        </div>
      )}

      <footer className="reg-footer">
        <p>Hecho con amor para Gael</p>
        <button className="reg-print-btn" onClick={()=>window.print()}>Descargar PDF</button>
      </footer>
    </div>
  )
}

function RegistryCard({item,reservations,available,onReserve}){
  const isOwned=item.status==='comprado'
  const isReserved=available<=0&&!isOwned
  const totalReserved=reservations.reduce((s,r)=>s+(r.qty_reserved||1),0)
  const cat=CAT_ICONS[item.category]||'📦'
  return(
    <div className={'reg-card'+(isOwned?' reg-card--owned':'')+(isReserved?' reg-card--reserved':'')}>
      <div className="reg-card__photo">
        {item.photo_url?<img src={item.photo_url} alt={item.name}/>:<span className="reg-card__icon">{cat}</span>}
        {item.priority==='esencial'&&<span className="reg-card__badge">Esencial</span>}
        {isOwned&&<span className="reg-card__badge reg-card__badge--owned">Ya tenemos</span>}
        {isReserved&&<span className="reg-card__badge reg-card__badge--reserved">Reservado</span>}
      </div>
      <div className="reg-card__body">
        <div className="reg-card__cat">{cat} {CAT_LABELS[item.category]||item.category}</div>
        <h3 className="reg-card__name">{item.name}</h3>
        <div className="reg-card__meta">
          {fmtRD(item.price_estimated)&&<span className="reg-card__price">{fmtRD(item.price_estimated)}</span>}
          {item.qty_needed>1&&<span className="reg-card__qty">Necesitamos: {item.qty_needed}{totalReserved>0&&' · Reservados: '+totalReserved}{available>0&&' · Disponibles: '+available}</span>}
        </div>
        {item.notes&&<p className="reg-card__notes">{item.notes}</p>}
        {reservations.length>0&&!isOwned&&(
          <div className="reg-card__reservations">
            {reservations.map(r=><div key={r.id} className="reg-card__reservation">Elegido por <strong>{r.reserver_name}</strong>{r.qty_reserved>1&&' ('+r.qty_reserved+' unidades)'}</div>)}
          </div>
        )}
        <div className="reg-card__actions">
          {item.buy_link&&<a href={item.buy_link} target="_blank" rel="noopener noreferrer" className="reg-btn reg-btn--link">Ver producto</a>}
          {!isOwned&&available>0&&<button className="reg-btn reg-btn--primary" onClick={onReserve}>Yo lo voy a comprar</button>}
          {!isOwned&&available<=0&&<div className="reg-btn reg-btn--taken">Este regalo ya fue elegido</div>}
        </div>
      </div>
    </div>
  )
}

function ReserveModal({item,available,onConfirm,onClose}){
  const [name,setName]=useState('')
  const [message,setMessage]=useState('')
  const [qty,setQty]=useState(1)
  const [loading,setLoading]=useState(false)
  async function submit(e){
    e.preventDefault()
    if(!name.trim()) return
    setLoading(true)
    await onConfirm(item,name,message,qty)
    setLoading(false)
  }
  return(
    <div className="reg-modal-overlay" onClick={onClose}>
      <div className="reg-modal" onClick={e=>e.stopPropagation()}>
        <button className="reg-modal__close" onClick={onClose}>X</button>
        <div className="reg-modal__photo">{item.photo_url?<img src={item.photo_url} alt={item.name}/>:<span>{CAT_ICONS[item.category]||'📦'}</span>}</div>
        <h2 className="reg-modal__title">Que bonito!</h2>
        <p className="reg-modal__subtitle">Quieres regalar <strong>{item.name}</strong></p>
        <form onSubmit={submit} className="reg-modal__form">
          <label>Tu nombre *<input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Maria Garcia" required autoFocus/></label>
          {available>1&&<label>Cuantas unidades? (max {available})<input type="number" min={1} max={available} value={qty} onChange={e=>setQty(Number(e.target.value))}/></label>}
          <label>Mensaje opcional<textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Con mucho carino para el bebe!" rows={3}/></label>
          <button type="submit" className="reg-btn reg-btn--primary reg-btn--full" disabled={loading||!name.trim()}>{loading?'Guardando...':'Confirmar que lo comprare'}</button>
        </form>
      </div>
    </div>
  )
}

function SuccessScreen({item,name,qty,onClose}){
  return(
    <div className="reg-success">
      <div className="reg-success__card">
        <div className="reg-success__emoji">🎉</div>
        <h2>Gracias, {name}!</h2>
        <p>Has elegido <strong>{item.name}</strong> para nuestro bebe.</p>
        {qty>1&&<p className="reg-success__qty">{qty} unidades</p>}
        <p className="reg-success__msg">Con mucho amor, Familia Ramirez</p>
        <div className="reg-success__actions">
          {item.buy_link&&<a href={item.buy_link} target="_blank" rel="noopener noreferrer" className="reg-btn reg-btn--primary">Comprar este regalo</a>}
          <button className="reg-btn reg-btn--outline" onClick={onClose}>Ver mas regalos</button>
        </div>
      </div>
    </div>
  )
}
