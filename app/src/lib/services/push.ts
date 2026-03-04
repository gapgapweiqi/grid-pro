/**
 * Push Notification client-side utilities.
 * Handles subscription management and permission requests.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') : null;
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
}

/** Check if push notifications are supported */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Get current notification permission status */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/** Request notification permission from the user */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return 'denied';
  return Notification.requestPermission();
}

/** Fetch VAPID public key from server */
async function getVapidPublicKey(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/api/push/vapid-public-key`);
    const data = await res.json();
    return data?.data?.publicKey || '';
  } catch (err) {
    console.error('[push] Failed to fetch VAPID key:', err);
    return '';
  }
}

/** Convert URL-safe base64 to Uint8Array (for applicationServerKey) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Subscribe to push notifications */
export async function subscribePush(tags?: string[]): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;

    const permission = await requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      console.warn('[push] No VAPID public key available');
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });

    const subJson = subscription.toJSON();
    const res = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        tags: tags || [],
      }),
    });

    const data = await res.json();
    if (data.ok) {
      localStorage.setItem('push.subscribed', 'true');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[push] Subscribe error:', err);
    return false;
  }
}

/** Unsubscribe from push notifications */
export async function unsubscribePush(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch(`${API_BASE}/api/push/unsubscribe`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ endpoint }),
      });
    }

    localStorage.removeItem('push.subscribed');
    return true;
  } catch (err) {
    console.error('[push] Unsubscribe error:', err);
    return false;
  }
}

/** Check if user is currently subscribed */
export async function isSubscribed(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/** Test: Send test push to yourself */
export async function testPush(): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/push/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Admin: Send notification */
export async function sendNotification(params: {
  targetType: 'broadcast' | 'user' | 'tag';
  targetValue?: string;
  title: string;
  body?: string;
  imageUrl?: string;
  url?: string;
}): Promise<{ ok: boolean; sentCount?: number; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/push/send`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data.ok ? { ok: true, sentCount: data.data?.sentCount } : { ok: false, error: data.error || 'Failed' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Admin: Get notification history */
export async function getNotificationLog(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/push/log`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.ok ? data.data : [];
  } catch {
    return [];
  }
}

/** Admin: Get subscribers */
export async function getSubscribers(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/api/push/subscribers`, { headers: getAuthHeaders() });
    const data = await res.json();
    return data.ok ? data.data : [];
  } catch {
    return [];
  }
}

/** Admin: Delete a single notification log entry */
export async function deleteLogEntry(logId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/push/log/${logId}`, { method: 'DELETE', headers: getAuthHeaders() });
    const data = await res.json();
    return data.ok;
  } catch {
    return false;
  }
}

/** Admin: Clear all notification history */
export async function clearAllLogs(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/push/log-all`, { method: 'DELETE', headers: getAuthHeaders() });
    const data = await res.json();
    return data.ok;
  } catch {
    return false;
  }
}

/** Admin: Update subscriber tags */
export async function updateSubscriberTags(endpoint: string, tags: string[]): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/push/subscribers/tags`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ endpoint, tags }),
    });
    const data = await res.json();
    return data.ok;
  } catch {
    return false;
  }
}

/** Upload notification image to R2 */
export async function uploadNotificationImage(file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('refType', 'notification');
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') : null;
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE}/api/images/upload`, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, url: `${API_BASE}${data.data.url}` };
    }
    return { ok: false, error: data.error?.message || 'Upload failed' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
