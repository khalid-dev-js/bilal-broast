self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const notification = payload.notification || payload
  const title = notification.title || '\u{1F514} New Order Received!'
  const orderId = String(payload.orderId || payload.data?.orderId || '')
  const target = payload.url || payload.data?.url || '/dashboard/live-orders'
  const url = new URL(target, self.location.origin)
  const safeUrl = url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/dashboard/live-orders'

  event.waitUntil(self.registration.showNotification(title, {
    body: notification.body || 'A new order is ready to review.',
    icon: '/bilal-broast-icon.png',
    badge: '/bilal-broast-icon.png',
    tag: orderId ? `new-order-${orderId}` : undefined,
    renotify: false,
    requireInteraction: true,
    vibrate: [250, 100, 250],
    data: { url: safeUrl },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/dashboard/live-orders'
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'navigate' in client) {
        await client.navigate(target)
        return client.focus()
      }
    }
    return self.clients.openWindow(target)
  })())
})
