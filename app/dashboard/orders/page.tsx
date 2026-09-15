import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { mockOrders, formatPrice } from '@/lib/data'
export default function DashboardOrdersPage() { return <DashboardShell title="Orders" description="Review incoming orders and keep the kitchen moving."><div className="admin-order-list">{mockOrders.map((order) => <article className="admin-order" key={order.id}><div><span className="dashboard-eyebrow">{order.id}</span><h2>{order.customerName}</h2><p>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}</p></div><span className="status-badge status-preparing">{order.status}</span><strong>{formatPrice(order.total)}</strong><Link href="/getLiveOrder">View details</Link></article>)}</div></DashboardShell> }
