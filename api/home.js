import { BASE, fetchPage, parseResults, sendError, sendJson } from '../lib/minhngoc.js'

// Cache for concurrent requests
const requestCache = new Map()

async function fetchWithDeduplication(url) {
  if (requestCache.has(url)) {
    return requestCache.get(url)
  }
  
  const promise = fetchPage(url)
  requestCache.set(url, promise)
  
  // Clean up after request completes
  promise.finally(() => {
    setTimeout(() => requestCache.delete(url), 1000)
  })
  
  return promise
}

export default async function handler(_req, res) {
  // Early CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (_req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const startTime = Date.now()

  try {
    // Parallel fetch with timeout
    const fetchPromises = [
      fetchWithDeduplication(`${BASE}/xo-so-mien-nam.html`),
      fetchWithDeduplication(`${BASE}/xo-so-mien-bac.html`),
      fetchWithDeduplication(`${BASE}/xo-so-mien-trung.html`),
    ]

    const [mn, mb, mt] = await Promise.all(fetchPromises)

    // Parallel parsing
    const parsePromises = [
      Promise.resolve(parseResults(mn)),
      Promise.resolve(parseResults(mb)),
      Promise.resolve(parseResults(mt)),
    ]

    const [mienNam, mienBac, mienTrung] = await Promise.all(parsePromises)

    const responseTime = Date.now() - startTime
    res.setHeader('X-Response-Time', `${responseTime}ms`)

    sendJson(res, 200, {
      ok: true,
      mienNam,
      mienBac,
      mienTrung,
      meta: {
        responseTime,
        cached: false
      }
    })
  } catch (err) {
    const responseTime = Date.now() - startTime
    res.setHeader('X-Response-Time', `${responseTime}ms`)
    sendError(res, err)
  }
}
