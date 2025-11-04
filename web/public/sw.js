// Service Worker для оффлайн режима
const CACHE_NAME = 'innesi-reader-v1'
const STATIC_CACHE_NAME = 'innesi-reader-static-v1'

// Ресурсы для кеширования при установке
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/ui/App.tsx'
]

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err)
      })
    })
  )
  self.skipWaiting()
})

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем старые кеши
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// Обработка fetch запросов
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Пропускаем не-GET запросы и chrome-extension
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return
  }

  // API запросы - Network First, fallback на кеш
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }

  // Статические ресурсы (JS, CSS, изображения) - Cache First
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // HTML - Network First с fallback на кеш
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request))
    return
  }

  // По умолчанию - Network First
  event.respondWith(networkFirst(request))
})

// Стратегия Cache First для статики
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.warn('[SW] Cache First failed:', error)
    // Если это HTML и нет кеша, вернуть оффлайн страницу
    if (request.headers.get('accept')?.includes('text/html')) {
      const cached = await caches.match('/index.html')
      if (cached) return cached
    }
    throw error
  }
}

// Стратегия Network First для API и HTML
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      // Кешируем успешные ответы
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.warn('[SW] Network First failed, trying cache:', error)
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Для HTML возвращаем index.html из кеша
    if (request.headers.get('accept')?.includes('text/html')) {
      const cached = await caches.match('/index.html')
      if (cached) return cached
    }
    
    throw error
  }
}

