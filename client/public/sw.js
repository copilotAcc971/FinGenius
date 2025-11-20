const CACHE_NAME = 'copilot-accountant-v1';
const OFFLINE_QUEUE_NAME = 'offline-queue';
const CACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.png',
];

const CACHEABLE_ROUTES = [
  '/api/tenants',
  '/api/auth/user',
  '/api/invoices',
  '/api/bills',
  '/api/customers',
  '/api/vendors',
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const isCacheableRoute = CACHEABLE_ROUTES.some(route => url.pathname.startsWith(route));

    if (isCacheableRoute) {
      event.respondWith(
        caches.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseToCache);
                });
              }
              return networkResponse;
            })
            .catch(() => {
              return cachedResponse || new Response(
                JSON.stringify({ error: 'Offline - data unavailable' }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });

          return cachedResponse || fetchPromise;
        })
      );
    } else {
      event.respondWith(
        fetch(request).catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || new Response(
              'Offline',
              { status: 503, statusText: 'Service Unavailable' }
            );
          });
        })
      );
    }
  } else if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH' || request.method === 'DELETE') {
    event.respondWith(
      fetch(request).catch(async (error) => {
        console.log('[Service Worker] Request failed, queuing for background sync:', request.url);
        
        const clonedRequest = request.clone();
        const body = await clonedRequest.text();
        
        const queueEntry = {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body: body,
          timestamp: Date.now(),
        };

        const db = await openDB();
        await addToQueue(db, queueEntry);

        if ('sync' in self.registration) {
          await self.registration.sync.register('sync-offline-queue');
        }

        return new Response(
          JSON.stringify({ 
            queued: true, 
            message: 'Request queued for background sync' 
          }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
  }
});

self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received:', event);
  
  let notificationData = {
    title: 'Copilot Accountant',
    body: 'You have a new notification',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        data: payload.data || {},
        tag: payload.tag || 'general',
        requireInteraction: payload.requireInteraction || false,
      };
    } catch (e) {
      console.error('[Service Worker] Error parsing push data:', e);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.notification.data);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_QUEUE_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function addToQueue(db, entry) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');
    const request = store.add(entry);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getQueueEntries(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readonly');
    const store = transaction.objectStore('queue');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeFromQueue(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function syncOfflineQueue() {
  console.log('[Service Worker] Syncing offline queue...');
  
  try {
    const db = await openDB();
    const entries = await getQueueEntries(db);
    
    console.log(`[Service Worker] Found ${entries.length} queued requests`);
    
    for (const entry of entries) {
      try {
        const response = await fetch(entry.url, {
          method: entry.method,
          headers: entry.headers,
          body: entry.body,
        });
        
        if (response.ok) {
          console.log('[Service Worker] Successfully synced request:', entry.url);
          await removeFromQueue(db, entry.id);
        } else {
          console.warn('[Service Worker] Failed to sync request (will retry):', entry.url, response.status);
        }
      } catch (error) {
        console.error('[Service Worker] Error syncing request (will retry):', entry.url, error);
      }
    }
    
    console.log('[Service Worker] Offline queue sync complete');
  } catch (error) {
    console.error('[Service Worker] Error during queue sync:', error);
    throw error;
  }
}
