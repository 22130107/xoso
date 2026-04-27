import { extractMainContent, fetchPage, firstParam, sendError, sendJson } from '../lib/minhngoc.js'

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
    const url = firstParam(req.query.url)

    if (!url || !url.includes('minhngoc.net.vn')) {
      sendJson(res, 400, { ok: false, error: 'Invalid URL' })
      return
    }

    const html = await fetchPage(url)
    const content = extractMainContent(html)

    sendJson(res, 200, { ok: true, html: content })
  } catch (err) {
    sendError(res, err)
  }
}
