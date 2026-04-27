import { fetchPage, sendError, sendJson } from '../lib/minhngoc.js'
import * as cheerio from 'cheerio'

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
        h = 'Thông tin thêm'
      }

      // Fix image/link paths
      $(el).find('a').each((_, a) => {
        const href = $(a).attr('href')
        if (href && href.startsWith('/')) {
          $(a).attr('href', 'https://xsmn.mobi' + href)
        }
      })
      boxes.push({ title: h, html: $(el).html() })
    })

    sendJson(res, 200, { ok: true, boxes })
  } catch (err) {
    sendError(res, err)
  }
}
