'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing, LoaderCircle } from 'lucide-react'
import { api } from '@/lib/api/client'

type SupportState = 'checking' | 'supported' | 'unsupported'

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function decodeApplicationServerKey(key: string): Uint8Array {
  const padding = '='.repeat((4 - (key.length % 4)) % 4)
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

export function PushNotificationControl() {
  const [support, setSupport] = useState<SupportState>('checking')
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [iosInstallRequired, setIosInstallRequired] = useState(false)

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && Boolean(navigator.standalone))
    const iosInstallRequired = isIOS && !isInstalled
    const supported = !iosInstallRequired
      && window.isSecureContext
      && 'Notification' in window
      && 'serviceWorker' in navigator
      && 'PushManager' in window

    if (!supported) {
      setSupport('unsupported')
      setPermission('unsupported')
      setIosInstallRequired(iosInstallRequired)
      return
    }

    setSupport('supported')
    setPermission(Notification.permission)
    navigator.serviceWorker.getRegistration('/')
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setEnabled(Notification.permission === 'granted' && Boolean(subscription)))
      .catch((error: unknown) => {
        console.error('[push] Unable to inspect this device subscription', error)
        setMessage('Could not check this device. Try reloading the dashboard.')
      })
  }, [])

  async function enableNotifications() {
    setBusy(true)
    setMessage('')
    try {
      if (!vapidPublicKey) {
        throw new Error('Push notifications are not configured for this website yet.')
      }

      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)
      if (permissionResult !== 'granted') {
        setMessage(permissionResult === 'denied'
          ? 'Notifications are blocked. Allow them in your browser or device settings, then try again.'
          : 'Notification permission was not granted.')
        return
      }

      const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeApplicationServerKey(vapidPublicKey) as BufferSource,
        })

      await api.post('/admin/push-subscriptions', subscription.toJSON())
      setEnabled(true)
      setMessage('This device will receive new-order notifications.')
    } catch (error) {
      console.error('[push] Unable to enable notifications', error)
      setMessage(error instanceof Error ? error.message : 'Unable to enable notifications on this device.')
    } finally {
      setBusy(false)
    }
  }

  async function disableNotifications() {
    setBusy(true)
    setMessage('')
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await api.delete('/admin/push-subscriptions', { endpoint: subscription.endpoint })
        setEnabled(false)
        await subscription.unsubscribe()
      }
      setEnabled(false)
      setMessage('Notifications are disabled on this device.')
    } catch (error) {
      console.error('[push] Unable to disable notifications', error)
      setMessage(error instanceof Error ? error.message : 'Unable to disable notifications on this device.')
    } finally {
      setBusy(false)
    }
  }

  if (support === 'checking') return null

  if (support === 'unsupported') {
    return <div style={{ maxWidth: 230, textAlign: 'right' }}>
      <small role="status">
        {iosInstallRequired
          ? 'On iPhone/iPad, install this site to your Home Screen (iOS 16.4+) to enable notifications.'
          : 'Push notifications are not supported in this browser or connection.'}
      </small>
    </div>
  }

  return <div style={{ display: 'grid', justifyItems: 'end', gap: 4, maxWidth: 230 }}>
    {enabled ? (
      <button
        type="button"
        className="dashboard-view-site"
        style={{ marginLeft: 0 }}
        onClick={disableNotifications}
        disabled={busy}
      >
        {busy ? <LoaderCircle className="spin" size={14} /> : <BellRing size={14} />}
        Disable notifications
      </button>
    ) : (
      <button
        type="button"
        className="dashboard-view-site"
        style={{ marginLeft: 0 }}
        onClick={enableNotifications}
        disabled={busy || permission === 'denied'}
      >
        {busy ? <LoaderCircle className="spin" size={14} /> : <Bell size={14} />}
        Enable notifications
      </button>
    )}
    <small role="status" aria-live="polite">
      {message || (permission === 'denied'
        ? 'Blocked in browser settings'
        : enabled ? 'Enabled on this device' : permission === 'granted' ? 'Permission granted; device not registered' : 'Only new orders; this device')}
    </small>
  </div>
}
