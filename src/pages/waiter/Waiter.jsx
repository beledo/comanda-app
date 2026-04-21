import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

export default function Waiter() {
  const { signOut } = useAuth()
  const [tables, setTables] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)

  useEffect(() => {
    fetchTables()
    fetchProducts()
  }, [])

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('number')
    setTables(data ?? [])
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*')
    setProducts(data ?? [])
  }

  const fetchOrders = async (tableId) => {
    const { data } = await supabase.from('orders').select('*').eq('table_id', tableId)
    setOrders(data ?? [])
  }

  const addToOrder = async (product) => {
    console.log("Intentando agregar:", product.name); // Esto nos dirá si el botón funciona
    
    const { data, error } = await supabase.from('orders').insert({
      table_id: selectedTable.id,
      product_name: product.name,
      price: product.price,
      quantity: 1,
      status: 'pending'
    })
    
    if (error) {
      console.error("Error detallado de Supabase:", error); // ESTO ES LA CLAVE
      alert("No pude agregar el producto. Error: " + error.message);
    } else {
      console.log("¡Éxito! Producto agregado.");
      fetchOrders(selectedTable.id);
    }
  }

  const updateQuantity = async (orderId, newQty) => {
    if (newQty < 1) return
    await supabase.from('orders').update({ quantity: newQty }).eq('id', orderId)
    fetchOrders(selectedTable.id)
  }

  const updateStatus = async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
    fetchOrders(selectedTable.id)
  }

  const deleteOrder = async (orderId) => {
    await supabase.from('orders').delete().eq('id', orderId)
    fetchOrders(selectedTable.id)
  }

  if (selectedTable) {
    return (
      <div style={s.page}>
        <button style={s.backBtn} onClick={() => setSelectedTable(null)}>← Volver</button>
        <h2>Mesa {selectedTable.number}</h2>
        
        <div style={s.section}>
          <h3>Pedidos</h3>
          {orders.map(o => (
            <div key={o.id} style={s.orderItem}>
              <span>{o.product_name} x {o.quantity} (${o.price * o.quantity})</span>
              <button onClick={() => updateQuantity(o.id, o.quantity - 1)}>-</button>
              <button onClick={() => updateQuantity(o.id, o.quantity + 1)}>+</button>
              <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}>
                <option value="pending">Pendiente</option>
                <option value="preparing">Preparando</option>
                <option value="ready">Listo</option>
              </select>
              <button onClick={() => deleteOrder(o.id)} style={s.delBtn}>X</button>
            </div>
          ))}
        </div>

        <h3>Menú</h3>
        <div style={s.grid}>
          {products.map(p => (
            <button key={p.id} style={s.addBtn} onClick={() => addToOrder(p)}>{p.name}</button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <nav style={s.nav}><h2>Mesero</h2><button onClick={signOut}>Salir</button></nav>
      <div style={s.grid}>
        {tables.map(t => (
          <div key={t.id} style={s.card} onClick={() => { setSelectedTable(t); fetchOrders(t.id); }}>
            Mesa {t.number}
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  page: { padding: '20px', background: '#0f172a', minHeight: '100vh', color: '#fff' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  card: { background: '#1e293b', padding: '20px', borderRadius: '8px', cursor: 'pointer' },
  orderItem: { background: '#334155', padding: '10px', marginBottom: '5px', borderRadius: '5px', display: 'flex', gap: '10px' },
  addBtn: { background: '#22c55e', border: 'none', color: '#fff', padding: '10px', borderRadius: '5px' },
  backBtn: { marginBottom: '20px', padding: '10px' },
  delBtn: { background: '#ef4444', border: 'none', color: '#fff', padding: '5px 10px' }
}