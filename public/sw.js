// Service Worker for XSMN - Offline & Performance
const CACHE_NAME = 'xsmn-v1'
const API_CACHE_NAME = 'xsmn-api-v1'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml'
]

// API endpoints to prefetch
const API_ENDPOINTS = [
  '/api/results?region=mien-nam',
  '/api/results?region=mien-bac',
  '/api/results?region=mien-trung',
  '/api/stats?region=mien-nam',
  '/api/stats?region=mien-bac',
  '/api/stats?region=mien-trung'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS)
    }).then(() => {
      // Prefetch API data
      return caches.open(API_CACHE_NAME).then((cache) => {
        console.log('[SW] Prefetching API data')
        return Promise.all(
          API_ENDPOINTS.map(url => 
            fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response)
                }
              })
              .catch(err => console.log('[SW] Prefetch failed:', url, err))
          )
        )
      })
    }).then(() => {
      console.log('[SW] Installation complete')
      return self.skipWaiting()
    })
  )
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      console.log('[SW] Activation complete')
      return self.clients.claim()
    })
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // API requests - Cache-first with network fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Check if cache is still fresh
          if (cachedResponse) {
            const cachedDate = new Date(cachedResponse.headers.get('date'))
            const now = new Date()
            const age = now - cachedDate

            // Return cached if fresh
            if (age < CACHE_DURATION) {
              console.log('[SW] Serving from cache:', url.pathname)
              
              // Update cache in background
              fetch(request).then((networkResponse) => {
                if (networkResponse.ok) {
                  cache.put(request, networkResponse.clone())
                }
              }).catch(() => {})
              
              return cachedResponse
            }
          }

          // Fetch from network and update cache
          console.log('[SW] Fetching from network:', url.pathname)
          return fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone())
            }
            return networkResponse
          }).catch(() => {
            // Return stale cache if network fails
            if (cachedResponse) {
              console.log('[SW] Network failed, serving stale cache:', url.pathname)
              return cachedResponse
            }
            throw new Error('Network failed and no cache available')
          })
        })
      })
    )
    return
  }

  // Static assets - Cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Serving static from cache:', url.pathname)
          return cachedResponse
        }

        return fetch(request).then((networkResponse) => {
          // Cache successful responses
          if (networkResponse.ok) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone())
              return networkResponse
            })
          }
          return networkResponse
        })
      })
    )
    return
  }

  // External resources - Network-first
  event.respondWith(fetch(request))
})

// Message event - manual cache refresh
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'REFRESH_CACHE') {
    console.log('[SW] Manual cache refresh requested')
    event.waitUntil(
      caches.open(API_CACHE_NAME).then((cache) => {
        return Promise.all(
          API_ENDPOINTS.map(url => 
            fetch(url).then(response => {
              if (response.ok) {
                return cache.put(url, response)
              }
            })
          )
        )
      }).then(() => {
        event.ports[0].postMessage({ success: true })
      })
    )
  }
})

console.log('[SW] Service Worker loaded')