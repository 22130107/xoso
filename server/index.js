import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── In-memory cache ───────────────────────────────────────────────────────────
const pageCache = new Map()   // url → { html, ts }
const statsCache = new Map()  // cacheKey → { data, ts }
const PAGE_TTL = 60 * 60 * 1000   // 1 hour for individual date pages
const STATS_TTL = 30 * 60 * 1000   // 30 min for computed stats
const thongKeCookies = new Map()

async function fetchPageCached(url) {
  const cached = pageCache.get(url)
  if (cached && Date.now() - cached.ts < PAGE_TTL) return cached.html
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const html = await res.text()
  pageCache.set(url, { html, ts: Date.now() })
  return html
}

function saveCookieForUrl(url, headers) {
  const setCookie = headers.raw?.()['set-cookie'] || []
  if (!setCookie.length) return
  const cookie = setCookie.map(item => item.split(';')[0]).join('; ')
  thongKeCookies.set(url, cookie)
}

function appendFormParams(params, key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const childKey in value) {
      appendFormParams(params, `${key}[${childKey}]`, value[childKey])
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach(item => params.append(key, String(item)))
    return
  }

  if (value !== undefined && value !== null) {
    params.append(key, String(value))
  }
}

const BASE = 'https://www.minhngoc.net.vn/free'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'vi-VN,vi;q=0.9',
  'Referer': 'https://www.minhngoc.net.vn/',
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

function normalizeDaySlug(day) {
  if (!day) return ''
  return DAY_SLUGS[day] || day
}

// ── Fetch & parse lottery results HTML ───────────────────────────────────────
async function fetchPage(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const html = await res.text()
  return html
}

function parseResults(html) {
  const $ = cheerio.load(html)
  const results = []

  // minhngoc uses .box_kqxs or .kqxs table per province
  $('.box_kqxs, .kqxs_box, .rightcol').each((_, box) => {
    const title = $(box).find('.tinh_kqxs, .tinh, h3, .title').first().text().trim()
    const date = $(box).find('.ngay, .date, .header_kqxs').first().text().trim()

    const prizes = {}

    // Giải đặc biệt
    const db = $(box).find('.giaiDB, .db, [class*="dac-biet"]').first().text().trim()
    if (db) prizes['ĐB'] = [db]

    // Parse all prize rows
    $(box).find('tr, .row').each((_, row) => {
      const label = $(row).find('.giai_name, td:first-child, .prize-label').first().text().trim()
      const nums = []
      $(row).find('.so_giai, .number, td:not(:first-child)').each((_, el) => {
        const t = $(el).text().trim()
        if (/^\d{2,6}$/.test(t)) nums.push(t)
      })
      if (label && nums.length > 0) prizes[label] = nums
    })

    if (title || Object.keys(prizes).length > 0) {
      results.push({ title, date, prizes })
    }
  })

  // Fallback: try table-based parsing
  if (results.length === 0) {
    $('table.tb_kqxs, table[class*="kqxs"]').each((_, table) => {
      const title = $(table).find('th, caption').first().text().trim()
      const prizes = {}
      $(table).find('tr').each((_, row) => {
        const cells = $(row).find('td')
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim()
          const nums = []
          cells.slice(1).each((_, cell) => {
            const t = $(cell).text().trim()
            if (t) nums.push(...t.split(/\s+/).filter(n => /^\d+$/.test(n)))
          })
          if (label && nums.length > 0) prizes[label] = nums
        }
      })
      if (Object.keys(prizes).length > 0) {
        results.push({ title, prizes })
      }
    })
  }

  return results
}

// ── Routes ───────────────────────────────────────────────────────────────────

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

function splitNumbers(text, digits) {
  const clean = text.replace(/\D/g, '')
  const nums = []
  for (let i = 0; i + digits <= clean.length; i += digits) {
    nums.push(clean.slice(i, i + digits))
  }
  return nums
}

function parseMienNam(html) {
  const $ = cheerio.load(html)
  const firstBlock = $('table.bkqmiennam').first()
  const date = firstBlock.find('.leftcl td.ngay').first().text().trim()
  const thu = firstBlock.find('.leftcl td.thu').first().text().trim()
  const provinces = []
  firstBlock.find('.rightcl').each((_, box) => {
    const title = $(box).find('td.tinh').first().text().trim()
    if (!title) return
    const prizes = {}
    PRIZE_ORDER_MN.forEach(cls => {
      const nums = []
      $(box).find(`td.${cls} div`).each((_, el) => {
        const t = $(el).text().trim()
        if (/^\d{2,6}$/.test(t)) nums.push(t)
      })
      if (nums.length === 0) {
        const t = $(box).find(`td.${cls}`).text().trim()
        if (/^\d{2,6}$/.test(t)) nums.push(t)
      }
      prizes[cls] = nums
    })
    provinces.push({ title, prizes })
  })
  return { date, thu, provinces, prizeOrder: PRIZE_ORDER_MN, prizeLabels: PRIZE_LABELS_MN }
}

function parseMienBac(html) {
  const $ = cheerio.load(html)
  // Day-filter pages (thu-2..chu-nhat) may not have table.bkqmiennam.
  const tinhTable = $('table.bkqtinhmienbac').first()
  if (!tinhTable.length) {
    return {
      date: '',
      thu: '',
      provinces: [{ title: 'Ha Noi', prizes: {} }],
      prizeOrder: PRIZE_ORDER_MB,
      prizeLabels: PRIZE_LABELS_MB
    }
  }

  // Row 0: col0=thu, col1=ngay+title
  const firstRow = tinhTable.find('tr').first()
  const ngayText = firstRow.find('td.ngay').text().trim()
  const dateMatch = ngayText.match(/(\d{2}\/\d{2}\/\d{4})/)
  const date = dateMatch ? dateMatch[1] : ''
  const title = 'Ha Noi'

  const prizes = {}
  tinhTable.find('tr').each((_, row) => {
    const tds = $(row).find('td')
    if (tds.length < 2) return
    const numTd = $(tds[1])
    const cls = numTd.attr('class') || ''
    if (!PRIZE_ORDER_MB.includes(cls)) return
    prizes[cls] = splitNumbers(numTd.text().trim(), PRIZE_DIGITS_MB[cls])
  })

  const provinces = [{ title, prizes }]
  return { date, thu: '', provinces, prizeOrder: PRIZE_ORDER_MB, prizeLabels: PRIZE_LABELS_MB }
}

function cleanProvinceTitle(rawTitle, fallback) {
  if (!rawTitle) return fallback
  return rawTitle
    .replace(/^K[ẾE]T\s+QU[ẢA]\s+X[ỔO]\s+S[ỐO]\s*/i, '')
    .replace(/\s*-\s*\d{2}\/\d{2}\/\d{4}.*/, '')
    .trim() || fallback
}

function parseProvince(html, region, slug) {
  const $ = cheerio.load(html)
  const fallbackTitle = (slug || '').replace(/-/g, ' ') || 'Ket qua'
  const parsedTitle = cleanProvinceTitle(parseResults(html)[0]?.title || '', fallbackTitle)

  if (region === 'mien-bac') {
    const table = $('table.bkqtinhmienbac').first()
    const ngayText = table.find('tr').first().find('td.ngay').text().trim()
    const date = (ngayText.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] || ''
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
  const date = (ngayText.match(/(\d{2}\/\d{2}\/\d{4})/) || [])[1] || ''
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

// GET /api/results
app.get('/api/results', async (req, res) => {
  try {
    const { region = 'mien-nam', day } = req.query
    let url = `${BASE}/ket-qua-xo-so/${region}.html`
    if (day) url = `${BASE}/ket-qua-xo-so/${region}/${normalizeDaySlug(day)}.html`
    const html = await fetchPage(url)
    const result = region === 'mien-bac' ? parseMienBac(html) : parseMienNam(html)
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/province?slug=tp-hcm&region=mien-nam
app.get('/api/province', async (req, res) => {
  try {
    const { slug, region = 'mien-nam' } = req.query
    const url = `${BASE}/ket-qua-xo-so/${region}/${slug}.html`
    const html = await fetchPage(url)
    const result = parseProvince(html, String(region), String(slug || ''))
    res.json({ ok: true, url, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/proxy?url=<encoded-url>  — proxy bất kỳ trang /free/...
app.get('/api/proxy', async (req, res) => {
  try {
    const { url } = req.query
    if (!url || !url.includes('minhngoc.net.vn')) {
      return res.status(400).json({ ok: false, error: 'Invalid URL' })
    }
    const html = await fetchPage(url)
    const $ = cheerio.load(html)

    // Remove header/footer/nav to get just content
    $('header, nav, .menu, .navbar, footer, script, style, link').remove()
    const content = $('#content, .main-content, body').html() || html

    res.json({ ok: true, html: content })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/phan-tich?tab=all|mb|mn|mt
const PHAN_TICH_TABS = {
  all: 'https://xsmn.mobi/du-doan-xo-so',
  mb: 'https://xsmn.mobi/du-doan-mb',
  mn: 'https://xsmn.mobi/du-doan-mn',
  mt: 'https://xsmn.mobi/du-doan-mt',
}

function parsePhanTich(html) {
  const $ = cheerio.load(html)
  const articles = []
  $('.list-news').each((_, section) => {
    $(section).find('li').each((_, li) => {
      const h3 = $(li).find('h3').first()
      if (!h3.length) return
      const title = h3.text().trim()
      const link = h3.find('a').attr('href') || ''
      const imgEl = $(li).find('img').first()
      const img = imgEl.attr('data-src') || imgEl.attr('src') || ''
      const excerpt = $(li).find('p').first().text().trim()
      if (title && link) articles.push({ title, link, img, excerpt })
    })
  })
  return articles
}

app.get('/api/phan-tich', async (req, res) => {
  try {
    const tab = (req.query.tab || 'all').toLowerCase()
    const url = PHAN_TICH_TABS[tab] || PHAN_TICH_TABS.all
    const html = await fetchPage(url)
    const articles = parsePhanTich(html)
    res.json({ ok: true, tab, articles })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/vietlott  — proxy Vietlott từ xsmn.mobi
app.get('/api/vietlott', async (req, res) => {
  try {
    const type = (req.query.type || 'all').toLowerCase()
    let targetUrl = 'https://xsmn.mobi/xs-vietlott.html'
    if (type === 'mega') targetUrl = 'https://xsmn.mobi/xs-mega.html'
    else if (type === 'power') targetUrl = 'https://xsmn.mobi/xs-power.html'
    else if (type === 'max 3d') targetUrl = 'https://xsmn.mobi/xs-max3d.html'
    else if (type === 'max 3d pro') targetUrl = 'https://xsmn.mobi/xs-max-3d-pro.html'
    else if (type === 'lotto 5/35') targetUrl = 'https://xsmn.mobi/xs-lotto-5-35.html'

    const html = await fetchPage(targetUrl)
    const $ = cheerio.load(html)
    const boxes = []

    // Main content area to avoid sidebar widgets
    const content = $('.col-l').length ? $('.col-l') : $('body')
    content.find('.box').each((_, el) => {
      // Exclude sidebar blocks
      if ($(el).find('.title-r').length > 0) return

      let h = $(el).find('h2, h3').first().text().trim()
      if (!h) {
        // Fallback for SEO text block or others without h2/h3
        h = 'Thông tin thêm'
      }

      // Fix image/link paths if any
      $(el).find('a').each((_, a) => {
        const href = $(a).attr('href')
        if (href && href.startsWith('/')) {
          $(a).attr('href', 'https://xsmn.mobi' + href)
        }
      })
      boxes.push({ title: h, html: $(el).html() })
    })
    res.json({ ok: true, boxes })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET/POST /api/thong-ke
app.all('/api/thong-ke', async (req, res) => {
  try {
    const targetUrl = req.query.url || 'https://xsmn.mobi/thong-ke-2-so-cuoi-giai-dac-biet-mien-bac.html'

    let html = '';
    if (req.method === 'POST') {
      const params = new URLSearchParams()
      for (const key in req.body) {
        appendFormParams(params, key, req.body[key])
      }
      let cookie = thongKeCookies.get(targetUrl)
      if (!cookie) {
        const bootstrapResp = await fetch(targetUrl, {
          headers: {
            ...HEADERS,
            'Referer': targetUrl,
          }
        })
        saveCookieForUrl(targetUrl, bootstrapResp.headers)
        cookie = thongKeCookies.get(targetUrl)
      }
      const resp = await fetch(targetUrl, {
        method: 'POST',
        body: params,
        headers: {
          ...HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://xsmn.mobi',
          'Referer': targetUrl,
          ...(cookie ? { Cookie: cookie } : {}),
        }
      })
      saveCookieForUrl(targetUrl, resp.headers)
      html = await resp.text()
    } else {
      const resp = await fetch(targetUrl, { headers: HEADERS })
      saveCookieForUrl(targetUrl, resp.headers)
      html = await resp.text()
    }

    const $ = cheerio.load(html)

    const content = $('.col-l').length ? $('.col-l') : $('#content')
    // Remove sidebar widgets if any
    content.find('.box-right').remove()
    content.find('.title-r').parent().remove()

    // Fix links to be absolute so React can intercept them
    content.find('a').each((_, a) => {
      let href = $(a).attr('href')
      if (href) {
        if (href.startsWith('/')) href = 'https://xsmn.mobi' + href
        $(a).attr('href', href)
      }
      $(a).removeAttr('onclick') // Remove inline scripts
    })

    // Forms
    content.find('form').attr('action', (i, val) => {
      if (val && val.startsWith('/')) return 'https://xsmn.mobi' + val
      return val
    })
    content.find('form, select, input, button').removeAttr('onchange').removeAttr('onclick').removeAttr('onsubmit')

    res.json({ ok: true, html: content.html() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// GET /api/home  — trang chủ tổng hợp
app.get('/api/home', async (req, res) => {
  try {
    const [mn, mb, mt] = await Promise.all([
      fetchPage(`${BASE}/xo-so-mien-nam.html`),
      fetchPage(`${BASE}/xo-so-mien-bac.html`),
      fetchPage(`${BASE}/xo-so-mien-trung.html`),
    ])
    res.json({
      ok: true,
      mienNam: parseResults(mn),
      mienBac: parseResults(mb),
      mienTrung: parseResults(mt),
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Helper: extract all 2-digit loto numbers from a parsed results array ─────
function extractAllLoto(results) {
  const all = []
  for (const province of results) {
    for (const nums of Object.values(province.prizes)) {
      for (const n of nums) {
        const digits = n.replace(/\D/g, '')
        if (digits.length >= 2) {
          all.push(digits.slice(-2))
        }
      }
    }
  }
  return all
}

// ── Helper: extract loto numbers from FIRST day block only in raw HTML ────────
function extractLotoFromHtml(html) {
  const $ = cheerio.load(html)
  const all = []
  // Each day is wrapped in table.bkqmiennam — take only the first one
  const firstBlock = $('table.bkqmiennam').first()
  const target = firstBlock.length ? firstBlock : $('body')
  target.find('.rightcl tr td').each((_, td) => {
    const cls = $(td).attr('class') || ''
    if (!cls || cls === 'tinh' || cls === 'matinh' || cls === 'thu' || cls === 'ngay') return
    $(td).find('div').each((_, div) => {
      const t = $(div).text().trim()
      if (/^\d{2,6}$/.test(t)) all.push(t.slice(-2))
    })
    if ($(td).find('div').length === 0) {
      const t = $(td).text().trim()
      if (/^\d{2,6}$/.test(t)) all.push(t.slice(-2))
    }
  })
  return all
}

// ── Helper: build dau-duoi table from today's results ────────────────────────
// Returns { provinces: string[], rows: { dau: number, duoi: { [tinh]: string[] } }[] }
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

// ── Helper: get the JS day-of-week (0=Sun..6=Sat) for a day slug ─────────────
function daySlugToWeekday(slug) {
  // Returns JS getDay() value, or null if "today"
  const map = { 'thu-2': 1, 'thu-3': 2, 'thu-4': 3, 'thu-5': 4, 'thu-6': 5, 'thu-7': 6, 'chu-nhat': 0 }
  return slug ? (map[slug] ?? null) : null
}

// ── Helper: get last N dates matching a given weekday (JS 0-6) ───────────────
function getLastNDatesForWeekday(weekday, n) {
  const dates = []
  const d = new Date()
  // step back until we find the weekday
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1)
  for (let i = 0; i < n; i++) {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    dates.push(`${dd}-${mm}-${yyyy}`)
    d.setDate(d.getDate() - 7) // same weekday, previous week
  }
  return dates
}

// GET /api/stats?region=mien-nam&day=thu-7  — đầu đuôi + thống kê nhanh 30 lần quay
app.get('/api/stats', async (req, res) => {
  try {
    const { region = 'mien-nam', day = '' } = req.query
    const cacheKey = `${region}__${day}`

    // Return cached stats if fresh
    const cached = statsCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < STATS_TTL) {
      return res.json(cached.data)
    }

    // ── Fetch the "current" page for dau-duoi (today or specific day) ──────────
    let currentUrl = `${BASE}/ket-qua-xo-so/${region}.html`
    if (day) {
      currentUrl = `${BASE}/ket-qua-xo-so/${region}/${normalizeDaySlug(day)}.html`
    }
    const currentHtml = await fetchPageCached(currentUrl)
    const $ = cheerio.load(currentHtml)

    // Get only the FIRST date block — minhngoc wraps each day in table.bkqmiennam
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

    // ── Fetch 30 rounds for thong ke nhanh ──────────────────────────────────────
    // If a specific weekday is requested, fetch 30 occurrences of that weekday.
    // Otherwise (today/hôm nay), fetch last 30 calendar days.
    const ROUNDS = 30
    let dateUrls = []

    const weekday = daySlugToWeekday(day)
    if (weekday !== null) {
      // Specific weekday: get last 30 dates for that weekday
      const dates = getLastNDatesForWeekday(weekday, ROUNDS)
      dateUrls = dates.map(d => `${BASE}/ket-qua-xo-so/${region}/${d}.html`)
    } else {
      // Today: use the current page (has ~7 days) + fetch remaining by date
      const today = new Date()
      const dates = []
      for (let i = 0; i < ROUNDS; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dd = String(d.getDate()).padStart(2, '0')
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const yyyy = d.getFullYear()
        dates.push(`${dd}-${mm}-${yyyy}`)
      }
      dateUrls = dates.map(d => `${BASE}/ket-qua-xo-so/${region}/${d}.html`)
    }

    // Fetch all in parallel (with error suppression) — use cache
    const htmlPages = await Promise.all(
      dateUrls.map(url => fetchPageCached(url).catch(() => null))
    )

    // Build per-round loto sets for frequency + gan calculation
    const roundSets = []
    for (const html of htmlPages) {
      if (!html) continue
      const nums = new Set(extractLotoFromHtml(html))
      roundSets.push(nums)
    }

    // Count frequency across all rounds
    const freq = {}
    for (const set of roundSets) {
      for (const n of set) {
        freq[n] = (freq[n] || 0) + 1
      }
    }

    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([so, count]) => ({ so, count }))

    // Gan: how many rounds since each number last appeared
    const lastSeen = {}
    for (let roundIdx = 0; roundIdx < roundSets.length; roundIdx++) {
      for (const n of roundSets[roundIdx]) {
        if (lastSeen[n] === undefined) lastSeen[n] = roundIdx
      }
    }

    const ganList = []
    for (let n = 0; n <= 99; n++) {
      const key = String(n).padStart(2, '0')
      const luot = lastSeen[key] !== undefined ? lastSeen[key] : roundSets.length
      ganList.push({ so: key, luot })
    }
    ganList.sort((a, b) => b.luot - a.luot)
    const topGan = ganList.slice(0, 10)

    const responseData = {
      ok: true,
      dauDuoi,
      thongKeNhanh: {
        nhieu: sorted,
        gan: topGan,
      },
    }

    // Save to cache
    statsCache.set(cacheKey, { data: responseData, ts: Date.now() })

    res.json(responseData)
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running at http://localhost:${PORT}`)
})


