import {
  BASE,
  fetchPage,
  firstParam,
  normalizeDaySlug,
  sendError,
  sendJson,
} from '../lib/minhngoc.js'
import * as cheerio from 'cheerio'

// Build dau-duoi table from today's province results
function buildDauDuoi(results) {
  const provinces = results.map(r => r.title || '?')
  const rows = Array.from({ length: 10 }, (_, dau) => {
    const duoi = {}
    for (const province of results) {
      const name = province.title || '?'
      duoi[name] = []
      for (const nums of Object.values(province.prizes)) {
        for (const n of nums) {
          const digits = n.replace(/\D/g, '')
          if (digits.length >= 2) {
            const lastTwo = digits.slice(-2)
            if (parseInt(lastTwo[0], 10) === dau) {
              duoi[name].push(lastTwo[1])
            }
          }
        }
      }
    }
    return { dau, duoi }
  })
  return { provinces, rows }
}

export default async function handler(req, res) {
  // Set CORS headers
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

    // Fetch the page for the requested day (or today)
    let url = `${BASE}/ket-qua-xo-so/${region}.html`
    if (day) {
      url = `${BASE}/ket-qua-xo-so/${region}/${normalizeDaySlug(day)}.html`
    }

    const html = await fetchPage(url)
    const $ = cheerio.load(html)

    // Get only the FIRST date block (today/selected day)
    const firstDayBlock = $('table.bkqmiennam').first()
    const todayResults = []

    firstDayBlock.find('.rightcl').each((_, box) => {
      const title = $(box).find('.tinh').first().text().trim()
      if (!title) return
      const prizes = {}
      $(box).find('tr').each((_, row) => {
        const $row = $(row)
        const td = $row.find('td').first()
        const tdClass = td.attr('class') || ''
        if (!tdClass || tdClass === 'tinh' || tdClass === 'matinh') return
        const nums = []
        $row.find('td div').each((_, el) => {
          const t = $(el).text().trim()
          if (/^\d{2,6}$/.test(t)) nums.push(t)
        })
        if (nums.length === 0) {
          $row.find('td').each((i, el) => {
            if (i === 0) return
            const t = $(el).text().trim()
            if (/^\d{2,6}$/.test(t)) nums.push(t)
          })
        }
        if (nums.length > 0) prizes[tdClass] = nums
      })
      todayResults.push({ title, prizes })
    })

    const dauDuoi = buildDauDuoi(todayResults)

    sendJson(res, 200, { ok: true, dauDuoi })
  } catch (err) {
    sendError(res, err)
  }
}
