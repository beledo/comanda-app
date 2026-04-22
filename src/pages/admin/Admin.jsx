import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../context/AuthContext'

export default function Admin() {
  const { signOut } = useAuth()

  const [activeTab, setActiveTab] = useState('inicio')
  const [tables, setTables] = useState([])
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [history, setHistory] = useState([])

  const [selectedTable, setSelectedTable] = useState(null)
  const [isCobrando, setIsCobrando] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')

  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [openMenuCategory, setOpenMenuCategory] = useState(null)

  const [newTableName, setNewTableName] = useState('')
  const [newProd, setNewProd] = useState({ name: '', price: '', category: 'Bebidas' })

  const [orderNote, setOrderNote] = useState('')

  const [editingProductId, setEditingProductId] = useState(null)
  const [editedPrice, setEditedPrice] = useState('')

  const categories = ['Todos', 'Bebidas', 'Platos', 'Postres', 'Otros']

  useEffect(() => {
    fetchTables()
    fetchProducts()
    fetchHistory()
    fetchAllOrders()
  }, [])

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('number')
    setTables(data || [])
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data || [])
  }

  const fetchOrders = async (tableId) => {
    const { data } = await supabase.from('orders').select('*').eq('table_id', tableId)
    setOrders(data || [])
  }

  const fetchAllOrders = async () => {
    const { data } = await supabase.from('orders').select('*')
    setAllOrders(data || [])
  }

  const fetchHistory = async () => {
    const { data } = await supabase.from('sales_history').select('*').order('created_at', { ascending: false })
    setHistory(data || [])
  }

  const addToOrder = async (product) => {
    const { error } = await supabase.from('orders').insert([{
      table_id: selectedTable.id,
      product_name: product.name,
      price: Number(product.price),
      quantity: 1,
      notes: orderNote
    }])

    if (error) return alert(error.message)

    await supabase.from('tables').update({ status: 'busy' }).eq('id', selectedTable.id)

    setOrderNote('')
    await fetchOrders(selectedTable.id)
    await fetchTables()
    await fetchAllOrders()
  }

  const handleAddTable = async () => {
    if (!newTableName.trim()) return

    const { error } = await supabase.from('tables').insert([{ number: newTableName, status: 'free' }])
    if (error) return alert(error.message)

    setNewTableName('')
    fetchTables()
  }

  const handleDeleteTable = async (id) => {
    const { error } = await supabase.from('tables').delete().eq('id', id)
    if (error) return alert(error.message)
    fetchTables()
  }

  const addProduct = async () => {
    const { error } = await supabase.from('products').insert([newProd])
    if (error) return alert(error.message)

    setNewProd({ name: '', price: '', category: 'Bebidas' })
    fetchProducts()
  }

  const startEditPrice = (p) => {
    setEditingProductId(p.id)
    setEditedPrice(p.price)
  }

  const saveProductPrice = async (id) => {
    const { error } = await supabase.from('products').update({ price: Number(editedPrice) }).eq('id', id)
    if (error) return alert(error.message)

    setEditingProductId(null)
    setEditedPrice('')
    fetchProducts()
  }

  const cancelEditPrice = () => {
    setEditingProductId(null)
    setEditedPrice('')
  }

  const finalizePayment = async () => {
    const total = orders.reduce((acc, o) => acc + o.price * o.quantity, 0)

    const { error } = await supabase.from('sales_history').insert([{
      table_number: selectedTable.number,
      total,
      payment_method: paymentMethod,
      items: orders
    }])

    if (error) return alert(error.message)

    await supabase.from('orders').delete().eq('table_id', selectedTable.id)
    await supabase.from('tables').update({ status: 'free' }).eq('id', selectedTable.id)

    setIsCobrando(false)
    setSelectedTable(null)

    fetchTables()
    fetchAllOrders()
    fetchHistory()
  }

  return (
    <div style={s.page}>
      {isCobrando && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h2>Cobrar Mesa {selectedTable.number}</h2>
            <p>Total: <strong>${orders.reduce((acc, o) => acc + o.price * o.quantity, 0)}</strong></p>
            <select style={s.input} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option>Efectivo</option>
              <option>Tarjeta</option>
              <option>Bizum</option>
            </select>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
              <button onClick={() => setIsCobrando(false)} style={s.btnSmall}>Cancelar</button>
              <button onClick={finalizePayment} style={s.addBtn}>Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}

      <nav style={s.nav}>
        <div style={s.logo}>POS SYSTEM</div>
        <div style={s.navLinks}>
          <button onClick={() => {setActiveTab('inicio'); setSelectedTable(null)}} style={activeTab === 'inicio' ? s.navBtnActive : s.navBtn}>📊 Salón</button>
          <button onClick={() => setActiveTab('mesas')} style={activeTab === 'mesas' ? s.navBtnActive : s.navBtn}>🪑 Mesas</button>
          <button onClick={() => setActiveTab('menu')} style={activeTab === 'menu' ? s.navBtnActive : s.navBtn}>🍔 Menú</button>
          <button onClick={() => setActiveTab('historial')} style={activeTab === 'historial' ? s.navBtnActive : s.navBtn}>📜 Historial</button>
        </div>
        <button onClick={signOut} style={s.logoutBtn}>Salir</button>
      </nav>

      <main style={s.main}>
        {activeTab === 'inicio' && !selectedTable ? (
          <div style={s.grid}>
            {tables.map(t => {
              const hasOrders = allOrders.some(o => o.table_id === t.id)
              const isBusy = t.status === 'busy' || hasOrders

              return (
                <div key={t.id}
                  onClick={() => { setSelectedTable(t); fetchOrders(t.id) }}
                  style={{...s.tableCard, backgroundColor: isBusy ? '#452222' : '#1e293b', borderColor: isBusy ? '#ef4444' : '#22c55e'}}>
                  <span style={s.tNum}>{t.number}</span>
                  <small>{isBusy ? 'OCUPADA' : 'LIBRE'}</small>
                </div>
              )
            })}
          </div>
        ) : activeTab === 'inicio' && selectedTable ? (
          <div style={s.responsiveOrderContainer}>
            <div style={s.orderCard}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <button onClick={() => setSelectedTable(null)} style={s.btnSmall}>← Volver</button>
                <button onClick={() => setIsCobrando(true)} style={s.cobrarBtn}>COBRAR $</button>
              </div>
              <h3>Mesa {selectedTable.number}</h3>
              <div style={s.scrollArea}>
                {orders.map(o => (
                  <div key={o.id} style={s.orderItemBox}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                      <strong>{o.product_name}</strong>
                      <span>${o.price}</span>
                    </div>
                    {o.notes && <small style={{color:'#94a3b8'}}>Obs: {o.notes}</small>}
                  </div>
                ))}
              </div>
              <div style={s.totalText}>Total: ${orders.reduce((acc, o) => acc + o.price * o.quantity, 0)}</div>
            </div>

            <div style={s.menuSelection}>
              <input placeholder="Nota opcional..." style={s.inputNote} value={orderNote} onChange={e => setOrderNote(e.target.value)} />

              <div style={s.categoryBar}>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} style={selectedCategory === cat ? s.catBtnActive : s.catBtn}>{cat}</button>
                ))}
              </div>

              <div style={s.productGrid}>
                {products.filter(p => selectedCategory === 'Todos' || p.category === selectedCategory).map(p => (
                  <button key={p.id} onClick={() => addToOrder(p)} style={s.productBtn}>
                    {p.name}<br/><small>${p.price}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'mesas' ? (
          <div style={s.adminView}>
            <h2>Gestión de Mesas</h2>
            <div style={s.formCard}>
              <input value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="Ej: Mesa 1" style={s.input}/>
              <button onClick={handleAddTable} style={s.addBtn}>+ Agregar Mesa</button>
            </div>

            {tables.map(t => (
              <div key={t.id} style={s.listItem}>
                <span>Mesa {t.number}</span>
                <button onClick={() => handleDeleteTable(t.id)} style={s.delBtn}>Eliminar 🗑️</button>
              </div>
            ))}
          </div>
        ) : activeTab === 'menu' ? (
          <div style={s.adminView}>
            <h2>Gestión del Menú</h2>

            <div style={s.formCard}>
              <input placeholder="Nombre" style={s.input} value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} />
              <input placeholder="Precio" type="number" style={s.input} value={newProd.price} onChange={e => setNewProd({...newProd, price: e.target.value})} />
              <select style={s.input} onChange={e => setNewProd({...newProd, category: e.target.value})}>
                {categories.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={addProduct} style={s.addBtn}>Guardar Producto</button>
            </div>

            {categories.slice(1).map(cat => (
              <div key={cat}>
                <button onClick={() => setOpenMenuCategory(openMenuCategory === cat ? null : cat)} style={openMenuCategory === cat ? s.catBtnActive : s.catBtn}>{cat}</button>

                {openMenuCategory === cat && (
                  <div>
                    {products.filter(p => p.category === cat).map(p => (
                      <div key={p.id} style={s.listItem}>
                        <span>{p.name}</span>

                        {editingProductId === p.id ? (
                          <>
                            <input type="number" value={editedPrice} onChange={e => setEditedPrice(e.target.value)} style={{width:'80px', ...s.input}} />
                            <button onClick={() => saveProductPrice(p.id)} style={s.addBtn}>Guardar</button>
                            <button onClick={cancelEditPrice} style={s.btnSmall}>X</button>
                          </>
                        ) : (
                          <>
                            <span>${p.price}</span>
                            <button onClick={() => startEditPrice(p)} style={s.btnSmall}>Editar</button>
                            <button onClick={() => deleteProduct(p.id)} style={s.delBtn}>🗑️</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : activeTab === 'historial' ? (
          <div style={s.adminView}>
            <h2>Historial de Ventas</h2>
            {history.map(h => (
              <div key={h.id} style={s.listItem}>
                <div>
                  <strong>Mesa {h.table_number}</strong> - ${h.total} ({h.payment_method})<br/>
                  <small>{new Date(h.created_at).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  )
}

const s = {
  page: { display: 'flex', minHeight: '100vh', background: '#0f172a', color: '#fff' },
  nav: { width: '220px', background: '#1e293b', display: 'flex', flexDirection: 'column', padding: '20px', gap: '10px' },
  logo: { fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: '20px', textAlign: 'center' },
  navLinks: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  navBtn: { padding: '12px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' },
  navBtnActive: { padding: '12px', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
  main: { flex: 1, padding: '30px', overflowY: 'auto' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: '#1e293b', padding: '30px', borderRadius: '15px', width: '320px', textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' },
  tableCard: { padding: '20px', borderRadius: '12px', border: '2px solid', textAlign: 'center', cursor: 'pointer' },
  tNum: { fontSize: '1.5rem', display: 'block', fontWeight: 'bold' },
  responsiveOrderContainer: { display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' },
  orderCard: { background: '#1e293b', padding: '15px', borderRadius: '12px' },
  scrollArea: { height: '350px', overflowY: 'auto', margin: '15px 0' },
  orderItemBox: { padding: '10px 0', borderBottom: '1px solid #334155' },
  cobrarBtn: { background: '#eab308', color: '#000', border: 'none', padding: '5px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  inputNote: { padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #3b82f6', color: '#fff', marginBottom: '10px', width: '100%' },
  totalText: { fontSize: '1.4rem', fontWeight: 'bold', color: '#22c55e', textAlign: 'right' },
  menuSelection: { display: 'flex', flexDirection: 'column', gap: '10px' },
  categoryBar: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  catBtn: { padding: '8px 16px', borderRadius: '20px', background: '#334155', color: '#fff', border: 'none', cursor: 'pointer' },
  catBtnActive: { padding: '8px 16px', borderRadius: '20px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold' },
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' },
  productBtn: { padding: '15px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '10px', cursor: 'pointer' },
  adminView: { maxWidth: '600px', margin: '0 auto' },
  formCard: { background: '#1e293b', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  input: { padding: '12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', width: '100%' },
  addBtn: { background: '#22c55e', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  listItem: { background: '#1e293b', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' },
  delBtn: { color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' },
  logoutBtn: { background: '#ef4444', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' },
  btnSmall: { background: '#334155', border: 'none', color: '#fff', padding: '8px', borderRadius: '6px', cursor: 'pointer' }
}
