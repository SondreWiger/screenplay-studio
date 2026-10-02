'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// VAPID public key - in production, generate your own with web-push
// For now this is a placeholder that enables the UI
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushNotifications(userId: string | undefined) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  // Why the last attempt to turn notifications on failed, in plain words
  const [error, setError] = useState<string | null>(null);
  // Without a VAPID key the server can't send pushes, so the switch can't work
  const isConfigured = !!VAPID_PUBLIC_KEY;

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      }
    } catch {
      // SW not registered yet
    }
  };

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return reg;
    } catch (err) {
      console.error('SW registration failed:', err);
      return null;
    }
  };

  const subscribe = useCallback(async () => {
    setError(null);
    if (!isSupported) { setError("This browser doesn't support device notifications."); return false; }
    if (!userId) { setError('Sign in to turn on device notifications.'); return false; }
    if (!VAPID_PUBLIC_KEY) { setError("Device notifications aren't available yet."); return false; }
    setLoading(true);

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError(perm === 'denied'
          ? 'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.'
          : 'Notifications were not allowed. Try again and choose “Allow”.');
        setLoading(false);
        return false;
      }

      // Register service worker
      const reg = await registerServiceWorker();
      if (!reg) {
        setError('Could not set up notifications in this browser.');
        setLoading(false);
        return false;
      }

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Store subscription in database
      const supabase = createClient();
      const { error: saveError } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: sub.endpoint,
        keys: JSON.stringify(sub.toJSON().keys),
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id,endpoint' });
      if (saveError) {
        // The server couldn't record it, so pushes would never arrive
        await sub.unsubscribe().catch(() => {});
        setError('Could not save the notification setting. Please try again.');
        setLoading(false);
        return false;
      }

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      setError('Could not turn on device notifications. Please try again.');
      setLoading(false);
      return false;
    }
  }, [isSupported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setError(null);
    setLoading(true);

    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          // Remove from database
          const supabase = createClient();
          await supabase.from('push_subscriptions').delete()
            .eq('user_id', userId)
            .eq('endpoint', sub.endpoint);
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
    setLoading(false);
  }, [isSupported, userId]);

  // Send a local notification (for testing / immediate feedback)
  const sendLocal = useCallback(async (title: string, body: string, url?: string) => {
    if (!isSupported || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192',
          tag: 'local-' + Date.now(),
          data: { url: url || '/dashboard' },
        });
      }
    } catch {
      // Fallback to basic Notification API
      new Notification(title, { body, icon: '/icon-192' });
    }
  }, [isSupported]);

  return {
    isSupported,
    isConfigured,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendLocal,
  };
}
