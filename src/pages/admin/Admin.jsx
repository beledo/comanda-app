import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

export default function Admin() {
  const { user, signOut } = useAuth()
  
  const [activeTab, setActiveTab] = useState('inicio')
  const [tables, setTables] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedTable, setSelectedTable] = useState(null)
  
  const [newTable, setNewTable] = useState('')
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')

  useEffect(() => { 
    fetchTables()
    fetchProducts()
  }, [])

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('number')
    setTables(data || [])
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*')
    setProducts(data || [])
  }

  const fetchOrders = async (tableId) => {
    const { data } = await supabase.from('orders').select('*').eq('table_id', tableId)
    setOrders(data || [])
  }

  // --- Lógica de Pedidos ---
  const addToOrder = async (product) => {
    const { error } = await supabase.from('orders').insert({
      table_id: selectedTable.id,
      product_name: product.name,
      price: product.price,
      quantity: 1,
      status: 'pending'
    })
    if (error) alert("Error: " + error.message)
    else fetchOrders(selectedTable.id)
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

  // --- NUEVA FUNCIÓN: TRANSFERIR MESA ---
  const transferTable = async () => {
    const targetNum = prompt("¿A qué número de mesa deseas transferir los pedidos?")
    if (!targetNum) return
    
    const targetTable = tables.find(t => t.number.toString() === targetNum.toString())
    if (!targetTable) { 
      alert("No existe una mesa con el número " + targetNum)
      return 
    }

    const { error } = await supabase
      .from('orders')
      .update({ table_id: targetTable.id })
      .eq('table_id', selectedTable.id)

    if (error) alert("Error al transferir: " + error.message)
    else {
      alert("Transferido exitosamente a Mesa " + targetNum)
      setSelectedTable(null) // Cerramos la vista de la mesa actual
    }
  }

  // --- CRUD Mesas y Productos ---
  const addTable = async () => {
    const { error } = await supabase.from('tables').insert({ number: newTable, status: 'free' })
    if (error) alert(error.message)
    else { setNewTable(''); fetchTables() }
  }

  const addProduct = async () => {
    const { error } = await supabase.from('products').insert({ name: newName, price: parseFloat(newPrice) })
    if (error) alert(error.message)
    else { setNewName(''); setNewPrice(''); fetchProducts() }
  }

  const deleteItem = async (table, id) => {
    await supabase.from(table).delete().eq('id', id)
    table === 'tables' ? fetchTables() : fetchProducts()
  }

  return (
    <div style={s.page}>
      <nav style={s.nav}><h1>Panel Admin</h1><button onClick={signOut} style={s.logoutBtn}>Salir</button></nav>

      <div style={s.tabs}>
        <button onClick={() => { setActiveTab('inicio'); setSelectedTable(null); }} style={activeTab === 'inicio' ? s.activeTab : s.tab}>Inicio</button>
        <button onClick={() => setActiveTab('mesas')} style={activeTab === 'mesas' ? s.activeTab : s.tab}>Mesas</button>
        <button onClick={() => setActiveTab('menu')} style={activeTab === 'menu' ? s.activeTab : s.tab}>Menú</button>
      </div>

      <div style={s.content}>
        {activeTab === 'inicio' && (
          !selectedTable ? (
            <div>
              <h3>Mesas Activas</h3>
              <div style={s.grid}>
                {tables.map(t => <button key={t.id} onClick={() => {setSelectedTable(t); fetchOrders(t.id)}} style={s.card}>Mesa {t.number}</button>)}
              </div>
            </div>
          ) : (
            <div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <button onClick={() => setSelectedTable(null)} style={s.backBtn}>← Volver</button>
                <button onClick={transferTable} style={s.transferBtn}>Transferir Mesa ↔</button>
              </div>
              
              <h3>Mesa {selectedTable.number} | Total: ${orders.reduce((acc, o) => acc + (o.price * o.quantity), 0)}</h3>
              
              <h4>Pedidos actuales</h4>
              {orders.map(o => (
                <div key={o.id} style={s.item}>
                  {o.product_name} x {o.quantity} (${o.price * o.quantity})
                  <div>
                    <button onClick={() => updateQuantity(o.id, o.quantity - 1)}>-</button>
                    <button onClick={() => updateQuantity(o.id, o.quantity + 1)}>+</button>
                    <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}>
                      <option value="pending">Pendiente</option>
                      <option value="preparing">Preparando</option>
                      <option value="ready">Listo</option>
                    </select>
                    <button onClick={() => deleteOrder(o.id)} style={s.delBtn}>X</button>
                  </div>
                </div>
              ))}

              <h4>Agregar al pedido</h4>
              <div style={s.grid}>
                {products.map(p => <button key={p.id} style={s.addBtn} onClick={() => addToOrder(p)}>{p.name}</button>)}
              </div>
            </div>
          )
        )}

        {activeTab === 'mesas' && (
          <div>
            <h3>Agregar nueva mesa</h3>
            <div style={s.row}><input value={newTable} onChange={e => setNewTable(e.target.value)} placeholder="Nº Mesa" style={s.input} /> <button onClick={addTable} style={s.btn}>Agregar</button></div>
            {tables.map(t => <div key={t.id} style={s.item}>Mesa {t.number} <button onClick={() => deleteItem('tables', t.id)} style={s.delBtn}>Eliminar</button></div>)}
          </div>
        )}
        
        {activeTab === 'menu' && (
          <div>
            <h3>Agregar producto al menú</h3>
            <div style={s.row}><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre" style={s.input} /> <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Precio" style={s.input} /> <button onClick={addProduct} style={s.btn}>Agregar</button></div>
            {products.map(p => <div key={p.id} style={s.item}>{p.name} - ${p.price} <button onClick={() => deleteItem('products', p.id)} style={s.delBtn}>Eliminar</button></div>)}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0f172a', color: '#fff', padding: '20px' },
  nav: { display: 'flex', justifyContent: 'space-between', paddingBottom: '20px' },
  tabs: { display: 'flex', gap: '10px' },
  tab: { background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' },
  activeTab: { background: '#3b82f6', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' },
  content: { marginTop: '30px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
  card: { background: '#1e293b', padding: '20px', borderRadius: '8px', cursor: 'pointer', border: 'none', color: '#fff' },
  row: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: { padding: '10px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#fff' },
  btn: { padding: '10px 20px', borderRadius: '8px', background: '#22c55e', border: 'none', color: '#fff', cursor: 'pointer' },
  addBtn: { background: '#22c55e', border: 'none', color: '#fff', padding: '10px', borderRadius: '5px', cursor: 'pointer' },
  transferBtn: { background: '#f59e0b', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' },
  item: { background: '#1e293b', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  delBtn: { background: '#ef4444', border: 'none', padding: '5px 10px', borderRadius: '4px', color: '#fff', cursor: 'pointer', marginLeft: '10px' },
  backBtn: { marginBottom: '15px', padding: '8px', cursor: 'pointer' },
  logoutBtn: { background: '#334155', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }
}