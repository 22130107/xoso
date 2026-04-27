import {
  BASE,
  fetchPage,
  firstParam,
  parseResults,
  sendError,
  sendJson,
} from '../lib/minhngoc.js'
import * as cheerio from 'cheerio'

// Pre-compiled constants for performance
const PRIZE_ORDER_MN = ['giai8', 'giai7', 'giai6', 'giai5', 'giai4', 'giai3', 'giai2', 'giai1', 'giaidb']
const PRIZE_LABELS_MN = {
  giai8: 'G8', giai7: 'G7', giai6: 'G6', giai5: 'G5',
  giai4: 'G4', giai3: 'G3', giai2: 'G2', giai1: 'G1', giaidb: 'ĐB'
}
const PRIZE_DIGITS_MN = {
  giai8: 2, giai7: 3, giai6: 4, giai5: 4,
  giai4: 5, giai3: 5, giai2: 5, giai1: 5, giaidb: 6
}

const PRIZE_ORDER_MB = ['giaidb', 'giai1', 'giai2', 'giai3', 'giai4', 'giai5', 'giai6', 'giai7']
const PRIZE_LABELS_MB = {
  giaidb: 'ĐB', giai1: 'G1', giai2: 'G2', giai3: 'G3',
  giai4: 'G4', giai5: 'G5', giai6: 'G6', giai7: 'G7'
}
const PRIZE_DIGITS_MB = {
  giaidb: 5, giai1: 5, giai2: 5, giai3: 5,
  giai4: 4, giai5: 4, giai6: 3, giai7: 2
}

// Pre-compiled regex
const DATE_REGEX = /(\d{2}\/\d{2}\/\d{4})/
const TITLE_CLEANUP_REGEX = /^K[ẾE]T\s+QU[ẢA]\s+X[ỔO]\s+S[ỐO]\s*/i
const DATE_CLEANUP_REGEX = /\s*-\s*\d{2}\/\d{2}\/\d{4}.*/

function splitNumbers(text, digits) {
  const clean = text.replace(/\D/g, '')
  const numbers = []
  for (let i = 0; i + digits <= clean.length; i += digits) {
    numbers.push(clean.slice(i, i + digits))
  }
  return numbers
}

function cleanProvinceTitle(rawTitle, fallback) {
  if (!rawTitle) return fallback
  return rawTitle
    .replace(TITLE_CLEANUP_REGEX, '')
    .replace(DATE_CLEANUP_REGEX, '')
    .trim() || fallback
}

function parseProvince(html, region, slug) {
  const $ = cheerio.load(html)
  const fallbackTitle = (slug || '').replace(/-/g, ' ') || 'Ket qua'
  const parsedTitle = cleanProvinceTitle(parseResults(html)[0]?.title || '', fallbackTitle)

  if (region === 'mien-bac') {
    const table = $('table.bkqtinhmienbac').first()
    const ngayText = table.find('tr').first().find('td.ngay').text().trim()
    const date = (ngayText.match(DATE_REGEX) || [])[1] || ''
    const prizes = {}

    table.find('tr').each((_, row) => {
      const tds = $(row).find('td')
      if (tds.length < 2) return
      const numTd = $(tds[1])
      const cls = numTd.attr('class') || ''
      if (!PRIZE_ORDER_MB.includes(cls)) return
      prizes[cls] = splitNumbers(numTd.text().trim(), PRIZE_DIGITS_MB[cls])
    })

    return {
      date,
      thu: '',
      provinces: [{ title: parsedTitle || 'Ha Noi', prizes }],
      prizeOrder: PRIZE_ORDER_MB,
      prizeLabels: PRIZE_LABELS_MB
    }
  }

  const table = $('table.bkqtinhmiennam').first()
  const firstRow = table.find('tr').first()
  const ngayText = firstRow.find('td.ngay').text().trim()
  const date = (ngayText.match(DATE_REGEX) || [])[1] || ''
  const thu = firstRow.find('td.thu').text().trim()
  const prizes = {}

  table.find('tr').each((_, row) => {
    const tds = $(row).find('td')
    if (tds.length < 2) return
    const numTd = $(tds[1])
    const cls = numTd.attr('class') || ''
    if (!PRIZE_ORDER_MN.includes(cls)) return
    prizes[cls] = splitNumbers(numTd.text().trim(), PRIZE_DIGITS_MN[cls] || 2)
  })

  return {
    date,
    thu,
    provinces: [{ title: parsedTitle, prizes }],
    prizeOrder: PRIZE_ORDER_MN,
    prizeLabels: PRIZE_LABELS_MN
  }
}

export default async function handler(req, res) {
  const startTime = Date.now()
  
  // Early CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const slug = firstParam(req.query.slug)
    const region = firstParam(req.query.region, 'mien-nam')

    // Early validation
    if (!slug) {
      const responseTime = Date.now() - startTime
      res.setHeader('X-Response-Time', `${responseTime}ms`)
      sendJson(res, 400, { ok: false, error: 'Missing province slug' })
      return
    }

    // Validate region
    const validRegions = ['mien-nam', 'mien-bac', 'mien-trung']
    if (!validRegions.includes(region)) {
      const responseTime = Date.now() - startTime
      res.setHeader('X-Response-Time', `${responseTime}ms`)
      sendJson(res, 400, { ok: false, error: 'Invalid region' })
      return
    }

    const url = `${BASE}/ket-qua-xo-so/${region}/${slug}.html`
    const html = await fetchPage(url)
    const result = parseProvince(html, region, slug)

    const responseTime = Date.now() - startTime
    res.setHeader('X-Response-Time', `${responseTime}ms`)

    sendJson(res, 200, { 
      ok: true, 
      url, 
      ...result,
      meta: {
        slug,
        region,
        responseTime
      }
    })
  } catch (err) {
    const responseTime = Date.now() - startTime
    res.setHeader('X-Response-Time', `${responseTime}ms`)
    sendError(res, err)
  }
}
