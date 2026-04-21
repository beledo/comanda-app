// Componente compartido por Kitchen.jsx y Bar.jsx
// station: 'kitchen' | 'bar'
import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

const STATUS = {
  pending:   { label: 'Pendiente',  color: '#f59e0b', bg: '#fffbeb', nextLabel: '🔥 Empezar',   next: 'preparing' },
  preparing: { label: 'Preparando', color: '#3b82f6', bg: '#eff6ff', nextLabel: '✅ Listo',      next: 'ready'     },
  ready:     { label: 'Listo',      color: '#10b981', bg: '#ecfdf5', nextLabel: '🛎️ Entregado',  next: 'delivered' },
  delivered: { label: 'Entregado',  color: '#94a3b8', bg: '#f8fafc', nextLabel: null,            next: null        },
  cancelled: { label: 'Cancelado',  color: '#ef4444', bg: '#fff1f2', nextLabel: null,            next: null        },
}

const THEME = {
  kitchen: { accent: '#f59e0b', icon: '👨‍🍳', title: 'Cocina', dark: '#1c1410' },
  bar:     { accent: '#818cf8', icon: '🍸',   title: 'Barra',  dark: '#0f0f1a' },
}

export default function StationDisplay({ station }) {
  const { profile, logout } = useAuth()
  const theme = THEME[station]

  const [orders,  setOrders]  = useState([])  // agrupados por order_id
  const [filter,  setFilter]  = useState('active') // active | all
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()

    const channel = supabase.channel(`station-${station}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchItems)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },      fetchItems)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const fetchItems = async () => {
    const { data } = await supabase
      .from('order_items')
      .select(`
        *,
        menu_items(name),
        orders!inner(id, created_at, notes, tables(number), profiles(name))
      `)
      .eq('station', station)
      .order('created_at', { ascending: true })

    if (!data) { setLoading(false); return }

    // Agrupar por order
    const grouped = {}
    for (const item of data) {
      const oid = item.order_id
      if (!grouped[oid]) {
        grouped[oid] = {
          order_id:    oid,
          table:       item.orders?.tables?.number,
          waiter:      item.orders?.profiles?.name,
          order_notes: item.orders?.notes,
          created_at:  item.orders?.created_at,
          items:       [],
        }
      }
      grouped[oid].items.push(item)
    }

    setOrders(Object.values(grouped))
    setLoading(false)
  }

  const updateItem = async (itemId, newStatus) => {
    await supabase.from('order_items').update({ status: newStatus }).eq('id', itemId)
    fetchItems()
  }

  const timeAgo = (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000)
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.floor(s/60)}min`
    return `${Math.floor(s/3600)}h`
  }

  const visible = filter === 'active'
    ? orders.filter(o => o.items.some(i => i.status !== 'delivered' && i.status !== 'cancelled'))
    : orders

  const counts = {
    pending:   orders.flatMap(o => o.items).filter(i => i.status === 'pending').length,
    preparing: orders.flatMap(o => o.items).filter(i => i.status === 'preparing').length,
    ready:     orders.flatMap(o => o.items).filter(i => i.status === 'ready').length,
  }

  return (
    <div style={{ ...k.page, background: theme.dark }}>
      {/* NAV */}
      <nav style={k.nav}>
        <div style={k.navL}>
          <span style={k.navIcon}>{theme.icon}</span>
          <span style={k.navTitle}>{theme.title}</span>
          <span style={{ ...k.live, color: theme.accent }}>● EN VIVO</span>
        </div>
        <div style={k.navR}>
          <button style={{ ...k.fBtn, ...(filter==='active' ? { ...k.fBtnA, borderColor: theme.accent, color: theme.accent } : {}) }}
            onClick={() => setFilter('active')}>Activos</button>
          <button style={{ ...k.fBtn, ...(filter==='all' ? { ...k.fBtnA, borderColor: theme.accent, color: theme.accent } : {}) }}
            onClick={() => setFilter('all')}>Todos</button>
          <button style={k.logoutBtn} onClick={logout}>Salir</button>
        </div>
      </nav>

      {/* STATS */}
      <div style={k.stats}>
        {[['Pendientes', counts.pending, '#f59e0b'], ['Preparando', counts.preparing, '#3b82f6'], ['Listos', counts.ready, '#10b981']].map(([label, num, color]) => (
          <div key={label} style={k.stat}>
            <span style={{ ...k.dot, background: color }} />
            <span style={k.statLabel}>{label}:</span>
            <span style={k.statNum}>{num}</span>
          </div>
        ))}
      </div>

      {/* GRID DE TICKETS */}
      <div style={k.grid}>
        {loading && <p style={k.msg}>Cargando…</p>}
        {!loading && visible.length === 0 && <p style={k.msg}>🎉 Sin comandas pendientes</p>}
        {visible.map(order => (
          <div key={order.order_id} style={k.ticket}>
            {/* Header */}
            <div style={k.ticketHead}>
              <div>
                <span style={k.mesa}>Mesa {order.table ?? '—'}</span>
                <span style={k.ordId}> · #{order.order_id.slice(0,6)}</span>
              </div>
              <span style={k.ago}>{timeAgo(order.created_at)}</span>
            </div>
            {order.waiter && <p style={k.waiter}>🛎️ {order.waiter}</p>}

            {/* Items */}
            <div style={k.items}>
              {order.items.map(item => {
                const st = STATUS[item.status] ?? STATUS.pending
                return (
                  <div key={item.id} style={{ ...k.itemRow, borderLeft: `3px solid ${st.color}` }}>
                    <div style={k.itemInfo}>
                      <span style={k.itemQty}>×{item.quantity}</span>
                      <span style={k.itemName}>{item.menu_items?.name}</span>
                      {item.notes && <span style={k.itemNote}>{item.notes}</span>}
                    </div>
                    {st.next && (
                      <button onClick={() => updateItem(item.id, st.next)}
                        style={{ ...k.stBtn, background: STATUS[st.next].color }}>
                        {st.nextLabel}
                      </button>
                    )}
                    {!st.next && (
                      <span style={{ ...k.pill, background: st.bg, color: st.color }}>{st.label}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {order.order_notes && (
              <div style={k.noteBox}>📝 {order.order_notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const k = {
  page:      { minHeight: '100vh', fontFamily: "'Segoe UI',sans-serif" },
  nav:       { background: 'rgba(0,0,0,0.4)', height: '58px', padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  navL:      { display: 'flex', alignItems: 'center', gap: '10px' },
  navIcon:   { fontSize: '22px' },
  navTitle:  { color: '#fff', fontWeight: '700', fontSize: '18px' },
  live:      { fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' },
  navR:      { display: 'flex', gap: '8px', alignItems: 'center' },
  fBtn:      { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', padding: '5px 13px', cursor: 'pointer', fontSize: '12px' },
  fBtnA:     { background: 'rgba(255,255,255,0.08)', color: '#fff' },
  logoutBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'rgba(255,255,255,0.3)', padding: '5px 11px', cursor: 'pointer', fontSize: '11px' },
  stats:     { display: 'flex', gap: '20px', padding: '12px 20px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  stat:      { display: 'flex', alignItems: 'center', gap: '6px' },
  dot:       { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '12px' },
  statNum:   { color: '#fff', fontWeight: '700', fontSize: '15px' },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: '14px', padding: '18px' },
  msg:       { color: 'rgba(255,255,255,0.25)', textAlign: 'center', gridColumn: '1/-1', marginTop: '80px', fontSize: '16px' },
  ticket:    { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
  ticketHead:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  mesa:      { color: '#fff', fontWeight: '800', fontSize: '18px' },
  ordId:     { color: 'rgba(255,255,255,0.3)', fontSize: '12px' },
  ago:       { color: 'rgba(255,255,255,0.3)', fontSize: '11px' },
  waiter:    { margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '12px' },
  items:     { display: 'flex', flexDirection: 'column', gap: '8px' },
  itemRow:   { background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' },
  itemInfo:  { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', flex: 1 },
  itemQty:   { background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' },
  itemName:  { color: '#e2e8f0', fontSize: '14px', fontWeight: '500' },
  itemNote:  { color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontStyle: 'italic', width: '100%' },
  stBtn:     { border: 'none', borderRadius: '8px', padding: '7px 12px', color: '#fff', fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },
  pill:      { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', flexShrink: 0 },
  noteBox:   { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '8px 11px', color: '#fbbf24', fontSize: '12px' },
}