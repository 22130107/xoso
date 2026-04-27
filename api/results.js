import {
  BASE,
  fetchPage,
  firstParam,
  normalizeDaySlug,
  sendError,
  sendJson,
} from '../lib/minhngoc.js'
import * as cheerio from 'cheerio'

// Pre-compiled regex for better performance
const NUMBER_REGEX = /^\d{2,6}$/
const DATE_REGEX = /(\d{2}\/\d{2}\/\d{4})/

// ── Miền Nam / Miền Trung ─────────────────────────────────────────────────────
const PRIZE_ORDER_MN = ['giai8','giai7','giai6','giai5','giai4','giai3','giai2','giai1','giaidb']
const PRIZE_LABELS_MN = {
  giai8: 'G8', giai7: 'G7', giai6: 'G6', giai5: 'G5',
  giai4: 'G4', giai3: 'G3', giai2: 'G2', giai1: 'G1', giaidb: 'ĐB'
}

function parseMienNam(html) {
  const $ = cheerio.load(html)
  const firstBlock = $('table.bkqmiennam').first()
  const date = firstBlock.find('.leftcl td.ngay').first().text().trim()
  const thu = firstBlock.find('.leftcl td.thu').first().text().trim()

  const provinces = []
  firstBlock.find('.rightcl').each((_, box) => {
    const $box = $(box)
    const title = $box.find('td.tinh').first().text().trim()
    if (!title) return
    
    const prizes = {}
    PRIZE_ORDER_MN.forEach(cls => {
      const nums = []
      $box.find(`td.${cls} div`).each((_, el) => {
        const t = $(el).text().trim()
        if (NUMBER_REGEX.test(t)) nums.push(t)
      })
      if (nums.length === 0) {
        const t = $box.find(`td.${cls}`).text().trim()
        if (NUMBER_REGEX.test(t)) nums.push(t)
      }
      prizes[cls] = nums
    })
    provinces.push({ title, prizes })
  })

  return { date, thu, provinces, prizeOrder: PRIZE_ORDER_MN, prizeLabels: PRIZE_LABELS_MN }
}

const PRIZE_ORDER_MB = ['giaidb','giai1','giai2','giai3','giai4','giai5','giai6','giai7']
const PRIZE_LABELS_MB = {
  giaidb: 'ĐB', giai1: 'G1', giai2: 'G2', giai3: 'G3',
  giai4: 'G4', giai5: 'G5', giai6: 'G6', giai7: 'G7'
}
const PRIZE_DIGITS_MB = {
  giaidb: 5, giai1: 5, giai2: 5, giai3: 5,
  giai4: 4, giai5: 4, giai6: 3, giai7: 2
}

function splitNumbers(text, digits) {
  const clean = text.replace(/\D/g, '')
  const nums = []
  for (let i = 0; i + digits <= clean.length; i += digits) {
    nums.push(clean.slice(i, i + digits))
  }
  return nums
}

function parseMienBac(html) {
  const $ = cheerio.load(html)
  const tinhTable = $('table.bkqtinhmienbac').first()

  const firstRow = tinhTable.find('tr').first()
  const ngayText = firstRow.find('td.ngay').text().trim()
  const dateMatch = ngayText.match(DATE_REGEX)
  const date = dateMatch ? dateMatch[1] : ''
  const title = ngayText.replace(/Ngày:\s*\d{2}\/\d{2}\/\d{4}/, '').trim() || 'Hà Nội'

  const prizes = {}
  tinhTable.find('tr').each((_, row) => {
    const tds = $(row).find('td')
    if (tds.length < 2) return
    const numTd = $(tds[1])
    const cls = numTd.attr('class') || ''
    if (!PRIZE_ORDER_MB.includes(cls)) return
    prizes[cls] = splitNumbers(numTd.text().trim(), PRIZE_DIGITS_MB[cls])
  })

  return { date, thu: '', provinces: [{ title, prizes }], prizeOrder: PRIZE_ORDER_MB, prizeLabels: PRIZE_LABELS_MB }
}

// ── Handler ───────────────────────────────────────────────────────────────────
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
    const region = firstParam(req.query.region, 'mien-nam')
    const day = firstParam(req.query.day)
    
    let url = `${BASE}/ket-qua-xo-so/${region}.html`
    if (day) {
      url = `${BASE}/ket-qua-xo-so/${region}/${normalizeDaySlug(day)}.html`
    }

    const html = await fetchPage(url)
    const result = region === 'mien-bac' ? parseMienBac(html) : parseMienNam(html)

    const responseTime = Date.now() - startTime
    res.setHeader('X-Response-Time', `${responseTime}ms`)

    sendJson(res, 200, { 
      ok: true, 
      ...result,
      meta: {
        region,
        day,
        responseTime,
        url
      }
    })
  } catch (err) {
    const responseTime = Date.now() - startTime
    res.setHeader('X-Response-Time', `${responseTime}ms`)
    sendError(res, err)
  }
}
