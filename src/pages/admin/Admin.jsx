import { useEffect, useState } from 'react'
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

  const [isMobile, setIsMobile] = useState(false)
  const [transferringOrder, setTransferringOrder] = useState(null)
  const [transferTargetTableId, setTransferTargetTableId] = useState('')

  const [editingNoteOrder, setEditingNoteOrder] = useState(null)
  const [editedOrderNote, setEditedOrderNote] = useState('')

  const categories = ['Todos', 'Bebidas', 'Platos', 'Postres', 'Otros']
  const menuCategories = categories.slice(1)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    fetchTables()
    fetchProducts()
    fetchHistory()
    fetchAllOrders()
  }, [])

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('number', { ascending: true })
    setTables(data || [])
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name', { ascending: true })
    setProducts(data || [])
  }

  const fetchOrders = async (tableId) => {
    const { data } = await supabase.from('orders').select('*').eq('table_id', tableId).order('id', { ascending: true })
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

  const refreshTablesAndOrders = async (tableId = selectedTable?.id) => {
    const tasks = [fetchTables(), fetchAllOrders()]
    if (tableId) tasks.push(fetchOrders(tableId))
    await Promise.all(tasks)
  }

  const refreshMenu = async () => {
    await fetchProducts()
  }

  const syncTableStatus = async (tableId) => {
    const { data } = await supabase.from('orders').select('id').eq('table_id', tableId)
    const hasOrders = (data || []).length > 0
    await supabase.from('tables').update({ status: hasOrders ? 'busy' : 'free' }).eq('id', tableId)
  }

  const addToOrder = async (product) => {
    if (!selectedTable) return

    const { error } = await supabase.from('orders').insert([{
      table_id: selectedTable.id,
      product_name: product.name,
      price: Number(product.price),
      quantity: 1,
      notes: orderNote.trim() || null
    }])

    if (error) return alert(error.message)

    await supabase.from('tables').update({ status: 'busy' }).eq('id', selectedTable.id)

    setOrderNote('')
    await refreshTablesAndOrders(selectedTable.id)
  }

  const changeOrderQuantity = async (order, delta) => {
    const currentQty = Number(order.quantity || 1)
    const nextQty = currentQty + delta

    if (nextQty <= 0) {
      const { error } = await supabase.from('orders').delete().eq('id', order.id)
      if (error) return alert(error.message)
    } else {
      const { error } = await supabase.from('orders').update({ quantity: nextQty }).eq('id', order.id)
      if (error) return alert(error.message)
    }

    await syncTableStatus(order.table_id)
    await refreshTablesAndOrders(selectedTable?.id || order.table_id)
  }

  const openNoteEditor = (order) => {
    setEditingNoteOrder(order)
    setEditedOrderNote(order.notes || '')
  }

  const saveOrderNote = async () => {
    if (!editingNoteOrder) return

    const { error } = await supabase
      .from('orders')
      .update({ notes: editedOrderNote.trim() || null })
      .eq('id', editingNoteOrder.id)

    if (error) return alert(error.message)

    setEditingNoteOrder(null)
    setEditedOrderNote('')
    await refreshTablesAndOrders(selectedTable?.id || editingNoteOrder.table_id)
  }

  const deleteOrderNote = async (order) => {
    const { error } = await supabase
      .from('orders')
      .update({ notes: null })
      .eq('id', order.id)

    if (error) return alert(error.message)

    await refreshTablesAndOrders(selectedTable?.id || order.table_id)
  }

  const handleAddTable = async () => {
    if (!newTableName.trim()) return

    const { error } = await supabase.from('tables').insert([{ number: newTableName.trim(), status: 'free' }])
    if (error) return alert(error.message)

    setNewTableName('')
    await fetchTables()
  }

  const handleDeleteTable = async (id) => {
    const { error } = await supabase.from('tables').delete().eq('id', id)
    if (error) return alert(error.message)

    await fetchTables()
    await fetchAllOrders()
  }

  const addProduct = async () => {
    const { error } = await supabase.from('products').insert([newProd])
    if (error) return alert(error.message)

    setNewProd({ name: '', price: '', category: 'Bebidas' })
    await refreshMenu()
  }

  const deleteProduct = async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) return alert(error.message)
    await refreshMenu()
  }

  const startEditPrice = (product) => {
    setEditingProductId(product.id)
    setEditedPrice(String(product.price))
  }

  const saveProductPrice = async (id) => {
    const { error } = await supabase.from('products').update({ price: Number(editedPrice) }).eq('id', id)
    if (error) return alert(error.message)

    setEditingProductId(null)
    setEditedPrice('')
    await refreshMenu()
  }

  const cancelEditPrice = () => {
    setEditingProductId(null)
    setEditedPrice('')
  }

  const finalizePayment = async () => {
    if (!selectedTable) return

    const total = orders.reduce((acc, o) => acc + Number(o.price) * Number(o.quantity), 0)

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

    await Promise.all([fetchTables(), fetchAllOrders(), fetchHistory()])
  }

  const openTransferModal = (order) => {
    setTransferringOrder(order)
    setTransferTargetTableId('')
  }

  const confirmTransfer = async () => {
    if (!transferringOrder || !transferTargetTableId) return
    if (Number(transferTargetTableId) === Number(transferringOrder.table_id)) return

    const sourceTableId = transferringOrder.table_id

    const { error } = await supabase
      .from('orders')
      .update({ table_id: Number(transferTargetTableId) })
      .eq('id', transferringOrder.id)

    if (error) return alert(error.message)

    await syncTableStatus(sourceTableId)
    await syncTableStatus(Number(transferTargetTableId))
    await refreshTablesAndOrders(selectedTable?.id || sourceTableId)

    setTransferringOrder(null)
    setTransferTargetTableId('')
  }

  const navStyle = isMobile ? s.navMobile : s.nav
  const navLinksStyle = isMobile ? s.navLinksMobile : s.navLinks
  const mainStyle = isMobile ? s.mainMobile : s.main
  const pageStyle = isMobile ? s.pageMobile : s.page
  const orderContainerStyle = isMobile ? s.responsiveOrderContainerMobile : s.responsiveOrderContainer
  const gridStyle = isMobile ? s.gridMobile : s.grid
  const productGridStyle = isMobile ? s.productGridMobile : s.productGrid

  return (
    <div style={pageStyle}>
      {isCobrando && selectedTable && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h2>Cobrar Mesa {selectedTable.number}</h2>
            <p>Total: <strong>${orders.reduce((acc, o) => acc + Number(o.price) * Number(o.quantity), 0)}</strong></p>
            <select style={s.input} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option>Efectivo</option>
              <option>Tarjeta</option>
              <option>Bizum</option>
            </select>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
              <button onClick={() => setIsCobrando(false)} style={s.btnSmall}>Cancelar</button>
              <button onClick={finalizePayment} style={s.addBtn}>Confirmar Pago</button>
            </div>
          </div>
        </div>
      )}

      {transferringOrder && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h2>Transferir producto</h2>
            <p><strong>{transferringOrder.product_name}</strong></p>
            <select
              style={s.input}
              value={transferTargetTableId}
              onChange={(e) => setTransferTargetTableId(e.target.value)}
            >
              <option value="">Selecciona una mesa</option>
              {tables
                .filter(t => Number(t.id) !== Number(transferringOrder.table_id))
                .map(t => (
                  <option key={t.id} value={t.id}>Mesa {t.number}</option>
                ))}
            </select>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
              <button onClick={() => setTransferringOrder(null)} style={s.btnSmall}>Cancelar</button>
              <button onClick={confirmTransfer} style={s.addBtn}>Transferir</button>
            </div>
          </div>
        </div>
      )}

      {editingNoteOrder && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h2>Editar observación</h2>
            <p><strong>{editingNoteOrder.product_name}</strong></p>
            <textarea
              rows={4}
              style={{ ...s.input, resize: 'vertical' }}
              value={editedOrderNote}
              onChange={(e) => setEditedOrderNote(e.target.value)}
              placeholder="Escribe la observación"
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setEditingNoteOrder(null)} style={s.btnSmall}>Cancelar</button>
              <button onClick={saveOrderNote} style={s.addBtn}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      <nav style={navStyle}>
        <div style={s.logo}>POS SYSTEM</div>

        {isMobile ? (
          <div style={s.mobileTopBar}>
            <div style={s.navLinksMobile}>
              <button onClick={() => { setActiveTab('inicio'); setSelectedTable(null) }} style={activeTab === 'inicio' ? s.navBtnActiveMobile : s.navBtnMobile}>📊</button>
              <button onClick={() => setActiveTab('mesas')} style={activeTab === 'mesas' ? s.navBtnActiveMobile : s.navBtnMobile}>🪑</button>
              <button onClick={() => setActiveTab('menu')} style={activeTab === 'menu' ? s.navBtnActiveMobile : s.navBtnMobile}>🍔</button>
              <button onClick={() => setActiveTab('historial')} style={activeTab === 'historial' ? s.navBtnActiveMobile : s.navBtnMobile}>📜</button>
            </div>

            <button onClick={signOut} style={s.logoutBtnMobile} aria-label="Salir">
              <span style={s.logoutIcon}>🚪</span>
            </button>
          </div>
        ) : (
          <>
            <div style={s.navLinks}>
              <button onClick={() => { setActiveTab('inicio'); setSelectedTable(null) }} style={activeTab === 'inicio' ? s.navBtnActive : s.navBtn}>📊 Salón</button>
              <button onClick={() => setActiveTab('mesas')} style={activeTab === 'mesas' ? s.navBtnActive : s.navBtn}>🪑 Mesas</button>
              <button onClick={() => setActiveTab('menu')} style={activeTab === 'menu' ? s.navBtnActive : s.navBtn}>🍔 Menú</button>
              <button onClick={() => setActiveTab('historial')} style={activeTab === 'historial' ? s.navBtnActive : s.navBtn}>📜 Historial</button>
            </div>
            <button onClick={signOut} style={s.logoutBtn} aria-label="Salir">
              <span style={s.logoutIcon}>🚪</span>
              <span>Salir</span>
            </button>
          </>
        )}
      </nav>

      <main style={mainStyle}>
        {activeTab === 'inicio' && !selectedTable ? (
          <div style={gridStyle}>
            {tables.map(t => {
              const hasOrders = allOrders.some(o => o.table_id === t.id)
              const isBusy = t.status === 'busy' || hasOrders

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTable(t)
                    fetchOrders(t.id)
                  }}
                  style={{
                    ...s.tableCard,
                    backgroundColor: isBusy ? '#452222' : '#1e293b',
                    borderColor: isBusy ? '#ef4444' : '#22c55e'
                  }}
                >
                  <span style={s.tNum}>{t.number}</span>
                  <small>{isBusy ? 'OCUPADA' : 'LIBRE'}</small>
                </div>
              )
            })}
          </div>
        ) : activeTab === 'inicio' && selectedTable ? (
          <div style={orderContainerStyle}>
            <div style={s.orderCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <button onClick={() => setSelectedTable(null)} style={s.btnSmall}>← Volver</button>
                <button onClick={() => setIsCobrando(true)} style={s.cobrarBtn}>COBRAR $</button>
              </div>
              <h3>Mesa {selectedTable.number}</h3>
              <div style={s.scrollArea}>
                {orders.map(o => (
                  <div key={o.id} style={s.orderItemBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>{o.product_name}</strong>
                      <span>${Number(o.price) * Number(o.quantity || 1)}</span>
                    </div>
                    <small style={{ color: '#94a3b8' }}>Cantidad: {o.quantity || 1}</small>
                    {o.notes && <div style={{ color: '#94a3b8', marginTop: '4px' }}>Obs: {o.notes}</div>}

                    <div style={s.orderActions}>
                      <button onClick={() => changeOrderQuantity(o, -1)} style={s.qtyBtn}>−1</button>
                      <button onClick={() => changeOrderQuantity(o, 1)} style={s.qtyBtn}>+1</button>
                      <button onClick={() => openTransferModal(o)} style={s.btnSmall}>Transferir</button>
                      <button onClick={() => openNoteEditor(o)} style={s.btnSmall}>Editar obs</button>
                      <button onClick={() => deleteOrderNote(o)} style={s.btnSmall}>Borrar obs</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={s.totalText}>Total: ${orders.reduce((acc, o) => acc + Number(o.price) * Number(o.quantity), 0)}</div>
            </div>

            <div style={s.menuSelection}>
              <input
                placeholder="Nota opcional..."
                style={s.inputNote}
                value={orderNote}
                onChange={e => setOrderNote(e.target.value)}
              />

              <div style={s.categoryBar}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={selectedCategory === cat ? s.catBtnActive : s.catBtn}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={productGridStyle}>
                {products
                  .filter(p => selectedCategory === 'Todos' || p.category === selectedCategory)
                  .map(p => (
                    <button key={p.id} onClick={() => addToOrder(p)} style={s.productBtn}>
                      {p.name}<br />
                      <small>${p.price}</small>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'mesas' ? (
          <div style={s.adminView}>
            <h2>Gestión de Mesas</h2>
            <div style={s.formCard}>
              <input
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                placeholder="Ej: Mesa 1"
                style={s.input}
              />
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
              <input
                placeholder="Nombre"
                style={s.input}
                value={newProd.name}
                onChange={e => setNewProd({ ...newProd, name: e.target.value })}
              />
              <input
                placeholder="Precio"
                type="number"
                style={s.input}
                value={newProd.price}
                onChange={e => setNewProd({ ...newProd, price: e.target.value })}
              />
              <select
                style={s.input}
                value={newProd.category}
                onChange={e => setNewProd({ ...newProd, category: e.target.value })}
              >
                {menuCategories.map(c => <option key={c}>{c}</option>)}
              </select>
              <button onClick={addProduct} style={s.addBtn}>Guardar Producto</button>
            </div>

            <div style={s.categoryGrid}>
              {menuCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setOpenMenuCategory(openMenuCategory === cat ? null : cat)}
                  style={openMenuCategory === cat ? s.catBtnActive : s.catBtn}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div style={{ marginTop: '16px' }}>
              {menuCategories.map(cat => {
                const categoryProducts = products.filter(p => p.category === cat)
                const isOpen = openMenuCategory === cat

                if (!isOpen) return null

                return (
                  <div key={cat} style={s.sectionCard}>
                    <h3 style={{ marginTop: 0 }}>{cat}</h3>
                    {categoryProducts.map(p => (
                      <div key={p.id} style={s.listItem}>
                        <div>
                          <strong>{p.name}</strong><br />
                          <small>Categoría: {p.category}</small>
                        </div>

                        {editingProductId === p.id ? (
                          <div style={s.inlineActions}>
                            <input
                              type="number"
                              value={editedPrice}
                              onChange={e => setEditedPrice(e.target.value)}
                              style={{ width: '100px', ...s.input }}
                            />
                            <button onClick={() => saveProductPrice(p.id)} style={s.addBtn}>Guardar</button>
                            <button onClick={cancelEditPrice} style={s.btnSmall}>Cancelar</button>
                          </div>
                        ) : (
                          <div style={s.inlineActions}>
                            <span>${p.price}</span>
                            <button onClick={() => startEditPrice(p)} style={s.btnSmall}>Editar precio</button>
                            <button onClick={() => deleteProduct(p.id)} style={s.delBtn}>🗑️</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ) : activeTab === 'historial' ? (
          <div style={s.adminView}>
            <h2>Historial de Ventas</h2>
            {history.map(h => (
              <div key={h.id} style={s.listItem}>
                <div>
                  <strong>Mesa {h.table_number}</strong> - ${h.total} ({h.payment_method})<br />
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
  page: { display: 'flex', minHeight: '100vh', background: '#0f172a', color: '#fff', flexDirection: 'row' },
  pageMobile: { display: 'flex', minHeight: '100vh', background: '#0f172a', color: '#fff', flexDirection: 'column' },

  nav: { width: '220px', background: '#1e293b', display: 'flex', flexDirection: 'column', padding: '20px', gap: '10px', minHeight: '100vh', flexShrink: 0 },
  navMobile: { width: '100%', background: '#1e293b', display: 'flex', flexDirection: 'column', padding: '12px 14px', gap: '10px', position: 'sticky', top: 0, zIndex: 20 },

  logo: { fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: '6px', textAlign: 'center' },

  navLinks: { display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  navLinksMobile: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', flex: 1 },

  navBtn: { padding: '12px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' },
  navBtnActive: { padding: '12px', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' },
  navBtnMobile: { padding: '10px 0', background: 'transparent', border: '1px solid #334155', color: '#cbd5e1', borderRadius: '10px', cursor: 'pointer', textAlign: 'center', minWidth: 0 },
  navBtnActiveMobile: { padding: '10px 0', background: '#3b82f6', border: '1px solid #3b82f6', color: '#fff', borderRadius: '10px', cursor: 'pointer', textAlign: 'center', minWidth: 0, fontWeight: 'bold' },

  mobileTopBar: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' },

  main: { flex: 1, padding: '30px', overflowY: 'auto', minWidth: 0 },
  mainMobile: { flex: 1, padding: '14px', overflowY: 'auto', minWidth: 0 },

  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '16px' },
  modal: { background: '#1e293b', padding: '24px', borderRadius: '15px', width: '100%', maxWidth: '360px', textAlign: 'center' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '15px' },
  gridMobile: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))', gap: '10px' },

  tableCard: { padding: '20px', borderRadius: '12px', border: '2px solid', textAlign: 'center', cursor: 'pointer' },
  tNum: { fontSize: '1.5rem', display: 'block', fontWeight: 'bold' },

  responsiveOrderContainer: { display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px', alignItems: 'start' },
  responsiveOrderContainerMobile: { display: 'grid', gridTemplateColumns: '1fr', gap: '16px' },

  orderCard: { background: '#1e293b', padding: '15px', borderRadius: '12px' },
  scrollArea: { height: '350px', overflowY: 'auto', margin: '15px 0' },
  orderItemBox: { padding: '10px 0', borderBottom: '1px solid #334155' },
  orderActions: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' },
  qtyBtn: { background: '#475569', border: 'none', color: '#fff', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  cobrarBtn: { background: '#eab308', color: '#000', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },

  inputNote: { padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #3b82f6', color: '#fff', marginBottom: '10px', width: '100%' },
  totalText: { fontSize: '1.4rem', fontWeight: 'bold', color: '#22c55e', textAlign: 'right' },

  menuSelection: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 },
  categoryBar: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-start' },
  categoryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginTop: '8px' },
  catBtn: { padding: '10px 18px', borderRadius: '25px', background: '#334155', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', width: '100%' },
  catBtnActive: { padding: '10px 18px', borderRadius: '25px', background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer', width: '100%' },
  sectionCard: { background: '#1e293b', padding: '14px', borderRadius: '12px', marginTop: '14px' },
  inlineActions: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },

  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' },
  productGridMobile: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '10px' },
  productBtn: { padding: '15px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '10px', cursor: 'pointer' },

  adminView: { maxWidth: '900px', margin: '0 auto', width: '100%' },
  formCard: { background: '#1e293b', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' },
  input: { padding: '12px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', width: '100%' },
  addBtn: { background: '#22c55e', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  listItem: { background: '#1e293b', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  delBtn: { color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' },
  logoutBtn: { background: '#ef4444', color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' },
  logoutBtnMobile: { background: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '999px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', flex: '0 0 auto' },
  logoutIcon: { fontSize: '1.1rem', lineHeight: 1 },
  btnSmall: { background: '#334155', border: 'none', color: '#fff', padding: '8px', borderRadius: '6px', cursor: 'pointer' }
}
