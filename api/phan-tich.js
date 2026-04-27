import { fetchPage, sendError, sendJson } from '../lib/minhngoc.js'
import * as cheerio from 'cheerio'

const BASE_SITE = 'https://xsmn.mobi'

const TABS = {
  all:  `${BASE_SITE}/du-doan-xo-so`,
  mb:   `${BASE_SITE}/du-doan-xo-so-mien-bac`,
  mn:   `${BASE_SITE}/du-doan-xo-so-mien-nam`,
  mt:   `${BASE_SITE}/du-doan-xo-so-mien-trung`,
}

function parseArticles(html) {
  const $ = cheerio.load(html)
  const articles = []
  $('.list-news').each((_, section) => {
    $(section).find('li').each((_, li) => {
      const h3 = $(li).find('h3').first()
      if (!h3.length) return
      const title = h3.text().trim()
      let link  = h3.find('a').attr('href') || ''
      if (link && link.startsWith('/')) link = BASE_SITE + link
      const imgEl = $(li).find('img').first()
      const img   = imgEl.attr('data-src') || imgEl.attr('src') || ''
      const excerpt = $(li).find('p').first().text().trim()
      if (title && link) articles.push({ title, link, img, excerpt })
    })
  })
  return articles
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
    const tab = (req.query.tab || 'all').toLowerCase()
    const url = TABS[tab] || TABS.all
    const html = await fetchPage(url)
    const articles = parseArticles(html)
    sendJson(res, 200, { ok: true, tab, articles })
  } catch (err) {
    sendError(res, err)
  }
}
