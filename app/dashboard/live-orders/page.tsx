'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, Clock3, Printer, Search, X } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { formatPrice, type Order } from '@/lib/data'
import { api } from '@/lib/api/client'
import { getSocket } from '@/lib/api/socket'
import { useEffect } from 'react'

type LiveStatus = 'In progress' | 'Done'
type ReceiptOrder = Order & { subtotal: number; deliveryFee: number; paymentMethod: string }

const getLiveStatus = (status: string): LiveStatus => ['delivered', 'cancelled', 'Delivered', 'Cancelled'].includes(status) ? 'Done' : 'In progress'

function mapOrder(raw: any): ReceiptOrder {
  return { id: raw._id || raw.id || raw.orderNumber, customerName: raw.customerSnapshot?.name || raw.customer?.name || raw.customerName || 'Customer', phone: raw.customerSnapshot?.phone || raw.customer?.phone || raw.phone || '', address: raw.deliveryAddress?.address || raw.address || 'Pickup order', deliveryInstructions: raw.deliveryAddress?.notes || raw.deliveryInstructions || '', total: Number(raw.grandTotal ?? raw.total ?? 0), subtotal: Number(raw.subtotal ?? raw.grandTotal ?? raw.total ?? 0), deliveryFee: Number(raw.deliveryFee ?? 0), paymentMethod: raw.paymentMethod || 'cod', status: raw.orderStatus || raw.status || 'pending', createdAt: raw.createdAt ? new Date(raw.createdAt).toLocaleString() : '', items: (raw.items || []).map((item: any) => ({ id: item.product?._id || item.product || item.id || item.name, name: item.name || item.product?.name || item.nameSnapshot || 'Item', price: Number(item.price ?? item.priceSnapshot ?? 0), quantity: Number(item.quantity || 1) })) }
}

export default function LiveOrdersPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'All' | LiveStatus>('All')
  const [orders, setOrders] = useState<ReceiptOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [printed, setPrinted] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [socketState, setSocketState] = useState('connecting')
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => { try { const result = await api.get<any>('/admin/orders?page=1&limit=100&sort=newest'); const list = Array.isArray(result) ? result : result?.orders || result?.items || []; if (active) setOrders(list.map(mapOrder)) } catch (error) { console.error('[v0] Failed to load live orders', error) } finally { if (active) setLoading(false) } }
    load()
    const socket = getSocket()
    if (!socket) return () => { active = false }
    const onConnect = () => { setSocketState('live'); socket.emit('admin:join'); load() }
    const onDisconnect = () => setSocketState('offline')
    const upsert = (raw: any) => { const next = mapOrder(raw); setOrders((current) => { const index = current.findIndex((item) => item.id === next.id); if (index < 0) return [next, ...current]; const copy = [...current]; copy[index] = { ...copy[index], ...next }; return copy }) }
    const onCancel = (raw: any) => upsert({ ...raw, orderStatus: 'cancelled' })
    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); socket.on('connect_error', onDisconnect); socket.on('order:new', upsert); socket.on('order:status-updated', upsert); socket.on('order:payment-updated', upsert); socket.on('order:cancelled', onCancel)
    socket.connect()
    const refreshTimer = window.setInterval(load, 10000)
    return () => { active = false; window.clearInterval(refreshTimer); socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('connect_error', onDisconnect); socket.off('order:new', upsert); socket.off('order:status-updated', upsert); socket.off('order:payment-updated', upsert); socket.off('order:cancelled', onCancel); socket.disconnect() }
  }, [])
  const [selectedOrder, setSelectedOrder] = useState<ReceiptOrder | null>(null)

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesQuery = `${order.id} ${order.customerName} ${order.phone} ${order.address}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (status === 'All' || getLiveStatus(order.status) === status)
  }), [orders, query, status])

  async function toggleStatus(id: string) {
    const order = orders.find((item) => item.id === id)
    if (!order) return
    const nextStatus = getLiveStatus(order.status) === 'Done' ? 'preparing' : 'delivered'
    setUpdating(id)
    try { const updated = await api.patch<any>(`/admin/orders/${id}/status`, { orderStatus: nextStatus }); setOrders((current) => current.map((item) => item.id === id ? mapOrder(updated?.order || updated) : item)); setSelectedOrder((current) => current?.id === id ? mapOrder(updated?.order || updated) : current) } catch (error) { console.error('[v0] Failed to update live order status', error) } finally { setUpdating(null) }
  }

  function printSlip(id: string) {
    const order = orders.find((item) => item.id === id)
    if (!order) return
    setSelectedOrder(order)
    setPrinted(id)
    window.setTimeout(() => setPrinted(null), 1800)
    window.setTimeout(() => {
      if (typeof window.print !== 'function') {
        setToast('Printer connect nahi hai ya print service available nahi hai.')
        window.setTimeout(() => setToast(''), 3500)
        return
      }
      window.print()
    }, 120)
  }

  return <DashboardShell title="Live orders" description="A clear view of every order moving through the restaurant.">
    <section className="live-orders-page">
      <div className="live-orders-toolbar">
        <label className="live-search"><Search size={16} /><span className="sr-only">Search live orders</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer or phone" /></label>
        <div className="live-status-tabs" role="tablist" aria-label="Order status filter">
          {(['All', 'In progress', 'Done'] as const).map((item) => <button key={item} className={status === item ? 'is-active' : ''} onClick={() => setStatus(item)} role="tab" aria-selected={status === item}>{item}<span>{item === 'All' ? orders.length : orders.filter((order) => getLiveStatus(order.status) === item).length}</span></button>)}
        </div>
      </div>
      <div className="live-orders-meta"><div><span className="live-dot" />Live order board <strong>{filteredOrders.length} orders</strong><small className="live-connection-state">{socketState === 'live' ? 'Live' : socketState === 'offline' ? 'REST fallback' : 'Connecting...'}</small></div><button className="live-refresh" onClick={() => setQuery('')}><Clock3 size={14} /> Latest first</button></div>
      <div className="live-orders-table-wrap">
        <table className="live-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={7} className="live-table-state">Loading live orders...</td></tr> : filteredOrders.map((order) => { const done = getLiveStatus(order.status) === 'Done'; return <tr className={!done ? 'is-in-progress' : ''} key={order.id}><td data-label="Order"><strong>{order.id}</strong><small>{order.createdAt}</small></td><td data-label="Customer"><strong>{order.customerName}</strong><small>{order.phone}</small></td><td data-label="Items"><strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)} items</strong><small>{order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}</small></td><td data-label="Delivery"><small>{order.address}</small></td><td data-label="Total"><strong>{formatPrice(order.total)}</strong></td><td data-label="Status"><button disabled={updating === order.id} aria-label={done ? `Order ${order.id} is done` : `Mark order ${order.id} as done`} title={done ? 'Order completed' : 'Click to mark as done'} className={`live-status ${done ? 'is-done' : 'is-in-progress'}`} onClick={() => toggleStatus(order.id)}>{done ? <Check size={13} /> : <Clock3 size={13} />}{updating === order.id ? 'Updating...' : done ? 'Done' : 'In progress'}{!done && <span className="live-status-action">Mark as done</span>}<ChevronDown size={12} /></button></td><td data-label="Actions"><div className="live-order-actions"><button className="view-order" onClick={() => setSelectedOrder(order)}>Details</button><button className="print-slip" onClick={() => printSlip(order.id)}><Printer size={14} /> {printed === order.id ? 'Ready to print' : 'Print slip'}</button></div></td></tr> })}</tbody>
        </table>
        {!filteredOrders.length && <div className="live-empty"><X size={20} /><h3>No orders found</h3><p>Try another search or status filter.</p></div>}
      </div>
    </section>
    {selectedOrder && <div className="receipt-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null) }}>
      <section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <div className="receipt-actions"><button className="receipt-close" onClick={() => setSelectedOrder(null)} aria-label="Close receipt"><X size={18} /></button><button className="receipt-print-button" onClick={() => printSlip(selectedOrder.id)}><Printer size={15} /> {printed === selectedOrder.id ? 'Print dialog...' : 'Print receipt'}</button></div>
        <div className="receipt-slip" id="receipt-slip">
          <div className="receipt-brand"><div className="receipt-logo">BB</div><div><strong>Bilal Broast</strong><span>Health &amp; Taste</span></div></div>
          <div className="receipt-rule" /><p className="receipt-address">Fresh food, prepared with care<br />Karachi, Pakistan</p>
          <div className="receipt-rule" /><div className="receipt-title-row"><div><span>INVOICE</span><h2 id="receipt-title">#{selectedOrder.id}</h2></div><span className={`receipt-status ${getLiveStatus(selectedOrder.status) === 'Done' ? 'is-done' : ''}`}>{getLiveStatus(selectedOrder.status)}</span></div>
          <div className="receipt-meta"><span><b>Date</b>{selectedOrder.createdAt}</span><span><b>Customer</b>{selectedOrder.customerName}</span><span><b>Phone</b>{selectedOrder.phone}</span><span><b>Deliver to</b>{selectedOrder.address}</span></div>
          <div className="receipt-rule" /><div className="receipt-items-head"><span>ITEM</span><span>QTY</span><span>AMOUNT</span></div><div className="receipt-items">{selectedOrder.items.map((item) => <div key={item.name}><span>{item.name}</span><b>x {item.quantity}</b><strong>{formatPrice(item.price * item.quantity)}</strong></div>)}</div>
          <div className="receipt-rule" /><div className="receipt-totals"><span>Subtotal <b>{formatPrice(selectedOrder.subtotal)}</b></span><span>Delivery fee <b>{formatPrice(selectedOrder.deliveryFee)}</b></span><span>Payment <b>{selectedOrder.paymentMethod === 'online' ? 'Online' : 'Cash'}</b></span><strong>Total due <b>{formatPrice(selectedOrder.total)}</b></strong></div>
          <p className="receipt-thanks">Thank you for choosing Bilal Broast!<br />Please visit again.</p>
        </div>
      </section>
    </div>}
    {toast && <div className="receipt-toast" role="alert">{toast}</div>}
  </DashboardShell>
}
