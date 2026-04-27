import { sendError, sendJson } from '../lib/minhngoc.js'
import * as cheerio from 'cheerio'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'vi-VN,vi;q=0.9',
  'Referer': 'https://xsmn.mobi/',
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
    const targetUrl = req.query.url || 'https://xsmn.mobi/thong-ke-2-so-cuoi-giai-dac-biet-mien-bac.html'

    let html = '';
    if (req.method === 'POST') {
      const params = new URLSearchParams()
      for (const key in req.body) {
        appendFormParams(params, key, req.body[key])
      }

      // Bootstrap to get cookie
      const bootstrapResp = await fetch(targetUrl, {
        headers: {
          ...HEADERS,
          'Referer': targetUrl,
        }
      })
      
      const setCookie = bootstrapResp.headers.get('set-cookie')
      const cookie = setCookie ? setCookie.split(';')[0] : ''

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
      html = await resp.text()
    } else {
      const resp = await fetch(targetUrl, { headers: HEADERS })
      html = await resp.text()
    }

    const $ = cheerio.load(html)
    const content = $('.col-l').length ? $('.col-l') : $('#content')
    
    // Remove sidebar widgets
    content.find('.box-right').remove()
    content.find('.title-r').parent().remove()

    // Fix links
    content.find('a').each((_, a) => {
      let href = $(a).attr('href')
      if (href) {
        if (href.startsWith('/')) href = 'https://xsmn.mobi' + href
        $(a).attr('href', href)
      }
      $(a).removeAttr('onclick')
    })

    // Forms
    content.find('form').attr('action', (i, val) => {
      if (val && val.startsWith('/')) return 'https://xsmn.mobi' + val
      return val
    })
    content.find('form, select, input, button').removeAttr('onchange').removeAttr('onclick').removeAttr('onsubmit')

    sendJson(res, 200, { ok: true, html: content.html() })
  } catch (err) {
    sendError(res, err)
  }
}
