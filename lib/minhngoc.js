import * as cheerio from 'cheerio'

export const BASE = 'https://www.minhngoc.net.vn/free'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'vi-VN,vi;q=0.9',
  Referer: 'https://www.minhngoc.net.vn/',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive'
}

const DAY_SLUGS = {
  'thu-2': 'thu-hai',
  'thu-3': 'thu-ba',
  'thu-4': 'thu-tu',
  'thu-5': 'thu-nam',
  'thu-6': 'thu-sau',
  'thu-7': 'thu-bay',
  'chu-nhat': 'chu-nhat',
}

// In-memory cache for 5 minutes
const cache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCacheKey(url) {
  return `fetch:${url}`
}

function isValidCacheEntry(entry) {
  return entry && (Date.now() - entry.timestamp) < CACHE_TTL
}

export function firstParam(value, fallback = '') {
  if (Array.isArray(value)) return value[0] || fallback
  return value || fallback
}

export function normalizeDaySlug(day) {
  if (!day) return ''
  return DAY_SLUGS[day] || day
}

export async function fetchPage(url) {
  const cacheKey = getCacheKey(url)
  const cached = cache.get(cacheKey)
  
  if (isValidCacheEntry(cached)) {
    return cached.data
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8s timeout
    
    const res = await fetch(url, { 
      headers: HEADERS,
      signal: controller.signal,
      // Enable compression
      compress: true
    })
    
    clearTimeout(timeoutId)
    
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    
    const html = await res.text()
    
    // Cache the result
    cache.set(cacheKey, {
      data: html,
      timestamp: Date.now()
    })
    
    // Clean old cache entries (simple cleanup)
    if (cache.size > 100) {
      const entries = Array.from(cache.entries())
      entries.slice(0, 50).forEach(([key]) => cache.delete(key))
    }
    
    return html
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout for ${url}`)
    }
    throw error
  }
}

// Optimized parseResults with early returns
export function parseResults(html) {
  const $ = cheerio.load(html)
  const results = []

  // Try primary selectors first
  const primaryBoxes = $('.box_kqxs, .kqxs_box, .rightcol')
  if (primaryBoxes.length > 0) {
    primaryBoxes.each((_, box) => {
      const $box = $(box)
      const title = $box.find('.tinh_kqxs, .tinh, h3, .title').first().text().trim()
      const date = $box.find('.ngay, .date, .header_kqxs').first().text().trim()
      const prizes = {}

      const db = $box.find('.giaiDB, .db, [class*="dac-biet"]').first().text().trim()
      if (db) prizes['ĐB'] = [db]

      $box.find('tr, .row').each((_, row) => {
        const $row = $(row)
        const label = $row.find('.giai_name, td:first-child, .prize-label').first().text().trim()
        const nums = []

        $row.find('.so_giai, .number, td:not(:first-child)').each((_, el) => {
          const text = $(el).text().trim()
          if (/^\d{2,6}$/.test(text)) nums.push(text)
        })

        if (label && nums.length > 0) prizes[label] = nums
      })

      if (title || Object.keys(prizes).length > 0) {
        results.push({ title, date, prizes })
      }
    })
    
    if (results.length > 0) return results
  }

  // Fallback to table parsing only if primary method failed
  $('table.tb_kqxs, table[class*="kqxs"]').each((_, table) => {
    const $table = $(table)
    const title = $table.find('th, caption').first().text().trim()
    const prizes = {}

    $table.find('tr').each((_, row) => {
      const cells = $(row).find('td')
      if (cells.length < 2) return

      const label = $(cells[0]).text().trim()
      const nums = []

      cells.slice(1).each((_, cell) => {
        const text = $(cell).text().trim()
        if (text) {
          // Optimized regex split
          const numbers = text.split(/\s+/).filter(num => /^\d+$/.test(num))
          nums.push(...numbers)
        }
      })

      if (label && nums.length > 0) prizes[label] = nums
    })

    if (Object.keys(prizes).length > 0) {
      results.push({ title, prizes })
    }
  })

  return results
}

export function extractTableHtml(html) {
  const $ = cheerio.load(html)
  return $('.box_kqxs, .kqxs_wrap, #content').html() || ''
}

export function extractMainContent(html) {
  const $ = cheerio.load(html)
  // Remove unnecessary elements in one go
  $('header, nav, .menu, .navbar, footer, script, style, link').remove()
  return $('#content, .main-content, body').html() || html
}

export function sendJson(res, status, payload) {
  // Enhanced caching headers
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60, max-age=60')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Response-Time', Date.now())
  res.status(status).json(payload)
}

export function sendError(res, err) {
  console.error('API Error:', err)
  sendJson(res, 500, { 
    ok: false, 
    error: err instanceof Error ? err.message : String(err),
    timestamp: new Date().toISOString()
  })
}
