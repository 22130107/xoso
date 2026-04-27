import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import './vietlott.css'
import './thongke.css'

const BASE_API = '/api'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Province {
  title: string
  prizes: Record<string, string[]>
}

interface ResultData {
  date: string
  thu: string
  provinces: Province[]
  prizeOrder: string[]
  prizeLabels: Record<string, string>
}

interface DauDuoiRow {
  dau: number
  duoi: Record<string, string[]>
}

interface StatsData {
  dauDuoi: {
    provinces: string[]
    rows: DauDuoiRow[]
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function regionSlug(region: string) {
  return region === 'Miền Bắc' ? 'mien-bac' : region === 'Miền Trung' ? 'mien-trung' : 'mien-nam'
}

function daySlug(day: string) {
  const map: Record<string, string> = {
    'Thứ 2': 'thu-2', 'Thứ 3': 'thu-3', 'Thứ 4': 'thu-4',
    'Thứ 5': 'thu-5', 'Thứ 6': 'thu-6', 'Thứ 7': 'thu-7', 'CN': 'chu-nhat'
  }
  return map[day] || ''
}

function regionCode(region: string) {
  return region === 'Miền Bắc' ? 'MB' : region === 'Miền Trung' ? 'MT' : 'MN'
}
const REGION_RESULT_PREFIX: Record<string, string> = {
  'Miền Nam': 'xsmn',
  'Miền Bắc': 'xsmb',
  'Miền Trung': 'xsmt'
}

// ─── KetQuaTable component ────────────────────────────────────────────────────
function KetQuaTable({ data, filterMode, highlightDigit }: {
  data: ResultData
  filterMode: string
  highlightDigit: string | null
}) {
  const { provinces, prizeOrder, prizeLabels } = data

  function processNum(original: string): string {
    if (filterMode === '2' || filterMode === '3') {
      const n = parseInt(filterMode)
      return original.replace(/\d+/g, m => m.length >= n ? m.slice(-n) : m)
    }
    return original
  }

  function renderCell(original: string) {
    const display = processNum(original)
    if (highlightDigit === null) return <span>{display}</span>

    const origDigits = original.replace(/\D/g, '')
    const lastTwo = origDigits.slice(-2)
    if (!lastTwo.includes(highlightDigit)) return <span>{display}</span>

    // highlight last 2 digits
    const dispDigits = display.replace(/\D/g, '')
    const offset = Math.max(origDigits.length - dispDigits.length, 0)
    const lastTwoStart = Math.max(origDigits.length - 2, 0)
    let di = -1
    const chars = Array.from(display).map(ch => {
      if (!/\d/.test(ch)) return ch
      di++
      const origIdx = offset + di
      if (origIdx >= lastTwoStart) return `<hl>${ch}</hl>`
      return ch
    })
    const html = chars.join('')
    return <span dangerouslySetInnerHTML={{ __html: html.replace(/<hl>/g, '<span class="highlight-red">').replace(/<\/hl>/g, '</span>') }} />
  }

  return (
    <table className="kq-table">
      <thead>
        <tr>
          <th className="kq-th-giai">Giải</th>
          {provinces.map(p => (
            <th key={p.title} className="kq-th-tinh">{p.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {prizeOrder.map(cls => (
          <tr key={cls} className={`kq-row kq-row-${cls}`}>
            <td className="kq-td-giai">{prizeLabels[cls]}</td>
            {provinces.map(p => {
              const nums = p.prizes[cls] || []
              return (
                <td key={p.title} className={`kq-td-num ${cls}`}>
                  {nums.map((n, i) => (
                    <div key={i} className="kq-num">{renderCell(n)}</div>
                  ))}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── KetQuaMienBac component ─────────────────────────────────────────────────
const MB_COLS: Record<string, number> = {
  giaidb: 1, giai1: 1, giai2: 2, giai3: 3, giai4: 4, giai5: 3, giai6: 3, giai7: 4
}
// Use 12 virtual columns (LCM of 1,2,3,4) so all splits are equal
const MB_TOTAL_COLS = 12

function KetQuaMienBac({ data, filterMode, highlightDigit }: {
  data: ResultData
  filterMode: string
  highlightDigit: string | null
}) {
  const province = data.provinces[0]
  if (!province) return null
  const { prizeOrder, prizeLabels } = data

  function processNum(original: string): string {
    if (filterMode === '2' || filterMode === '3') {
      const n = parseInt(filterMode)
      return original.replace(/\d+/g, m => m.length >= n ? m.slice(-n) : m)
    }
    return original
  }

  function renderNum(original: string) {
    const display = processNum(original)
    if (highlightDigit === null) return <span>{display}</span>
    const origDigits = original.replace(/\D/g, '')
    const lastTwo = origDigits.slice(-2)
    if (!lastTwo.includes(highlightDigit)) return <span>{display}</span>
    const lastTwoStart = Math.max(origDigits.length - 2, 0)
    const dispDigits = display.replace(/\D/g, '')
    const offset = Math.max(origDigits.length - dispDigits.length, 0)
    let di = -1
    const chars = Array.from(display).map(ch => {
      if (!/\d/.test(ch)) return ch
      di++
      if (offset + di >= lastTwoStart) return `<hl>${ch}</hl>`
      return ch
    })
    return <span dangerouslySetInnerHTML={{ __html: chars.join('').replace(/<hl>/g, '<span class="highlight-red">').replace(/<\/hl>/g, '</span>') }} />
  }

  return (
    <table className="kq-table kq-mb-table">
      <thead>
        <tr>
          <th className="kq-th-giai">Giải</th>
          <th className="kq-th-tinh" colSpan={MB_TOTAL_COLS}>{province.title}</th>
        </tr>
      </thead>
      <tbody>
        {prizeOrder.map(cls => {
          const nums = province.prizes[cls] || []
          const cols = MB_COLS[cls] || 1
          // Split nums into rows of `cols` each
          const rows: string[][] = []
          for (let i = 0; i < nums.length; i += cols) {
            rows.push(nums.slice(i, i + cols))
          }
          const isSpecial = cls === 'giaidb'
          const isG7 = cls === 'giai7'
          return rows.map((row, ri) => (
            <tr key={`${cls}-${ri}`} className={`kq-row kq-row-${cls}`}>
              {ri === 0 && (
                <td className="kq-td-giai" rowSpan={rows.length}>{prizeLabels[cls]}</td>
              )}
              {row.map((n, ci) => {
                const span = MB_TOTAL_COLS / cols  // always integer: 12/1=12, 12/2=6, 12/3=4, 12/4=3
                return (
                  <td key={ci}
                    className={`kq-td-num kq-mb-num ${isSpecial ? 'giaidb' : ''} ${isG7 ? 'giai7' : ''}`}
                    colSpan={span}>
                    <div className="kq-num">{renderNum(n)}</div>
                  </td>
                )
              })}
            </tr>
          ))
        })}
      </tbody>
    </table>
  )
}

// ─── TrucTiepPage component ──────────────────────────────────────────────────
const LIVE_REGIONS = [
  { label: 'Miền Nam', slug: 'mien-nam', code: 'MN' },
  { label: 'Miền Bắc', slug: 'mien-bac', code: 'MB' },
  { label: 'Miền Trung', slug: 'mien-trung', code: 'MT' },
]

// 3 states based on current time
// 'before'  : before 17:00 → show blurred table + countdown to 17:00
// 'live'    : 17:00–20:00  → fetch once, show results normally
// 'after'   : after 20:00  → show blurred results + countdown to tomorrow 17:00
function getLiveState(): 'before' | 'live' | 'after' {
  const h = new Date().getHours()
  if (h < 17) return 'before'
  if (h < 20) return 'live'
  return 'after'
}

function getCountdownTarget(): Date {
  const now = new Date()
  const target = new Date(now)
  if (now.getHours() < 17) {
    target.setHours(17, 0, 0, 0)
  } else {
    // after 20h → countdown to tomorrow 17:00
    target.setDate(target.getDate() + 1)
    target.setHours(17, 0, 0, 0)
  }
  return target
}

function useCountdown() {
  const [cd, setCd] = useState({ h: 0, m: 0, s: 0 })
  useEffect(() => {
    function calc() {
      const now = new Date()
      const target = getCountdownTarget()
      const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000))
      setCd({
        h: Math.floor(diff / 3600),
        m: Math.floor((diff % 3600) / 60),
        s: diff % 60,
      })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [])
  return cd
}

function TrucTiepPage() {
  const [activeRegion, setActiveRegion] = useState('mien-nam')
  const [data, setData] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [liveState, setLiveState] = useState<'before' | 'live' | 'after'>(getLiveState)
  const fetchedRef = useRef<string | null>(null)
  const countdown = useCountdown()

  // Re-check state every minute (handles crossing 17h / 20h boundary)
  useEffect(() => {
    const id = setInterval(() => setLiveState(getLiveState()), 60000)
    return () => clearInterval(id)
  }, [])

  // Fetch when region changes or state becomes 'live'
  useEffect(() => {
    const key = `${activeRegion}-${liveState}`
    if (fetchedRef.current === key) return
    fetchedRef.current = key
    setLoading(true)
    fetch(`${BASE_API}/results?region=${activeRegion}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setData(json) })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [activeRegion, liveState])

  const regionInfo = LIVE_REGIONS.find(r => r.slug === activeRegion)!
  const today = new Date()
  const dateStr = `${today.getDate()}-${today.getMonth() + 1}-${today.getFullYear()}`
  const blurred = liveState !== 'live'

  const countdownLabel = liveState === 'before'
    ? 'Trực tiếp kết quả sau'
    : 'Kết quả tiếp theo sau'

  return (
    <div className="truc-tiep-page">
      {/* Region tabs */}
      <div className="tt-tabs">
        <div className="tt-tab tt-tab-label">Trực tiếp</div>
        {LIVE_REGIONS.map(r => (
          <div
            key={r.slug}
            className={`tt-tab ${activeRegion === r.slug ? 'active' : ''}`}
            onClick={() => { setActiveRegion(r.slug); fetchedRef.current = null }}
          >
            {r.label}
          </div>
        ))}
      </div>

      <div className="tt-header">Xổ số trực tiếp {regionInfo.label.toLowerCase()}</div>
      <div className="tt-subheader">
        XS{regionInfo.code} » XS{regionInfo.code} hôm nay » XS{regionInfo.code} ngày {dateStr}
      </div>

      <div className="tt-table-wrap">
        {loading ? (
          <div className="loading"><div className="spinner"></div><p>Đang tải...</p></div>
        ) : data ? (
          <div className={`tt-content ${blurred ? 'tt-blurred' : ''}`}>
            <div className="table-scroll-wrap">
              {activeRegion === 'mien-bac'
                ? <TrucTiepMienBac data={data} />
                : <TrucTiepMienNamTrung data={data} />
              }
            </div>

            {/* Countdown overlay — shown when blurred */}
            {blurred && (
              <div className="tt-countdown-overlay">
                <div className="tt-countdown-box">
                  <div className="tt-countdown-label">{countdownLabel}</div>
                  <div className="tt-countdown-digits">
                    <div className="tt-digit-block">
                      <span>{String(countdown.h).padStart(2, '0')}</span>
                      <label>Giờ</label>
                    </div>
                    <span className="tt-colon">:</span>
                    <div className="tt-digit-block">
                      <span>{String(countdown.m).padStart(2, '0')}</span>
                      <label>Phút</label>
                    </div>
                    <span className="tt-colon">:</span>
                    <div className="tt-digit-block">
                      <span>{String(countdown.s).padStart(2, '0')}</span>
                      <label>Giây</label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// Pending cell icon
function PendingIcon() {
  return <span className="tt-pending">🌸</span>
}

function TrucTiepMienNamTrung({ data }: { data: ResultData }) {
  const { provinces, prizeOrder, prizeLabels } = data
  return (
    <table className="kq-table tt-table">
      <thead>
        <tr>
          <th className="kq-th-giai"></th>
          {provinces.map(p => <th key={p.title} className="kq-th-tinh">{p.title}</th>)}
        </tr>
      </thead>
      <tbody>
        {prizeOrder.map(cls => (
          <tr key={cls} className={`kq-row kq-row-${cls}`}>
            <td className="kq-td-giai">{prizeLabels[cls]}</td>
            {provinces.map(p => {
              const nums = p.prizes[cls] || []
              const expectedCount = cls === 'giai6' ? 3 : cls === 'giai4' ? 7 : cls === 'giai3' ? 2 : 1
              return (
                <td key={p.title} className={`kq-td-num ${cls}`}>
                  {nums.length > 0
                    ? nums.map((n, i) => <div key={i} className="kq-num">{n}</div>)
                    : Array.from({ length: expectedCount }).map((_, i) => <div key={i} className="kq-num"><PendingIcon /></div>)
                  }
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const TT_MB_COLS: Record<string, number> = {
  giaidb: 1, giai1: 1, giai2: 2, giai3: 6, giai4: 4, giai5: 6, giai6: 3, giai7: 4
}
const TT_MB_TOTAL_COLS = 12

function TrucTiepMienBac({ data }: { data: ResultData }) {
  const province = data.provinces[0]
  if (!province) return null
  const { prizeOrder, prizeLabels } = data
  return (
    <table className="kq-table kq-mb-table tt-table">
      <thead>
        <tr>
          <th className="kq-th-giai">Giải</th>
          <th className="kq-th-tinh" colSpan={TT_MB_TOTAL_COLS}>{province.title}</th>
        </tr>
      </thead>
      <tbody>
        {prizeOrder.map(cls => {
          const nums = province.prizes[cls] || []
          const cols = TT_MB_COLS[cls] || 1
          const expectedRows = cls === 'giai3' ? 2 : cls === 'giai5' ? 2 : 1
          const rows: (string | null)[][] = []
          for (let i = 0; i < expectedRows; i++) {
            const row: (string | null)[] = []
            for (let j = 0; j < cols; j++) {
              row.push(nums[i * cols + j] ?? null)
            }
            rows.push(row)
          }
          return rows.map((row, ri) => (
            <tr key={`${cls}-${ri}`} className={`kq-row kq-row-${cls}`}>
              {ri === 0 && <td className="kq-td-giai" rowSpan={rows.length}>{prizeLabels[cls]}</td>}
              {row.map((n, ci) => {
                const span = TT_MB_TOTAL_COLS / cols
                return (
                  <td key={ci} className={`kq-td-num kq-mb-num ${cls === 'giaidb' ? 'giaidb' : ''}`} colSpan={span}>
                    <div className="kq-num">{n ? n : <PendingIcon />}</div>
                  </td>
                )
              })}
            </tr>
          ))
        })}
      </tbody>
    </table>
  )
}


// ─── Shared province data ────────────────────────────────────────────────────
const TINH_DATA = [
  {
    label: 'XỔ SỐ MIỀN BẮC', region: 'Miền Bắc', slug: 'mien-bac',
    tinh: [
      ['thai-binh', 'Thái Bình'], ['ha-noi', 'Hà Nội'],
      ['quang-ninh', 'Quảng Ninh'], ['bac-ninh', 'Bắc Ninh'],
      ['hai-phong', 'Hải Phòng'], ['nam-dinh', 'Nam Định'],
    ]
  },
  {
    label: 'XỔ SỐ MIỀN NAM', region: 'Miền Nam', slug: 'mien-nam',
    tinh: [
      ['da-lat', 'Đà Lạt'], ['kien-giang', 'Kiên Giang'],
      ['tien-giang', 'Tiền Giang'], ['an-giang', 'An Giang'],
      ['bac-lieu', 'Bạc Liêu'], ['ben-tre', 'Bến Tre'],
      ['binh-duong', 'Bình Dương'], ['binh-phuoc', 'Bình Phước'],
      ['binh-thuan', 'Bình Thuận'], ['ca-mau', 'Cà Mau'],
      ['can-tho', 'Cần Thơ'], ['dong-nai', 'Đồng Nai'],
      ['dong-thap', 'Đồng Tháp'], ['hau-giang', 'Hậu Giang'],
      ['tp-hcm', 'TP Hồ Chí Minh'], ['long-an', 'Long An'],
      ['soc-trang', 'Sóc Trăng'], ['tay-ninh', 'Tây Ninh'],
      ['tra-vinh', 'Trà Vinh'], ['vinh-long', 'Vĩnh Long'],
      ['vung-tau', 'Vũng Tàu'],
    ]
  },
  {
    label: 'XỔ SỐ MIỀN TRUNG', region: 'Miền Trung', slug: 'mien-trung',
    tinh: [
      ['khanh-hoa', 'Khánh Hòa'], ['kon-tum', 'Kon Tum'],
      ['hue', 'Thừa Thiên Huế'], ['binh-dinh', 'Bình Định'],
      ['da-nang', 'Đà Nẵng'], ['dak-lak', 'Đắk Lắk'],
      ['dak-nong', 'Đắk Nông'], ['gia-lai', 'Gia Lai'],
      ['ninh-thuan', 'Ninh Thuận'], ['phu-yen', 'Phú Yên'],
      ['quang-binh', 'Quảng Bình'], ['quang-ngai', 'Quảng Ngãi'],
      ['quang-nam', 'Quảng Nam'], ['quang-tri', 'Quảng Trị'],
    ]
  },
]

// ─── PhanTichPage component ──────────────────────────────────────────────────
interface PhanTichArticle {
  title: string
  link: string
  img: string
  excerpt: string
}

const PT_TABS = [
  { key: 'all', label: 'Phân tích' },
  { key: 'mb', label: 'Phân tích MB' },
  { key: 'mn', label: 'Phân tích MN' },
  { key: 'mt', label: 'Phân tích MT' },
]

function PhanTichPage({ initialTab = 'all' }: { initialTab?: string }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [articles, setArticles] = useState<PhanTichArticle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    setLoading(true)
    setArticles([])
    fetch(`${BASE_API}/phan-tich?tab=${activeTab}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setArticles(json.articles) })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [activeTab])

  return (
    <div className="phan-tich-page">
      {/* Tabs */}
      <div className="pt-tabs">
        {PT_TABS.map(t => (
          <div
            key={t.key}
            className={`pt-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="pt-header">Phân tích kết quả <span>xổ số ba miền</span></div>

      {loading ? (
        <div className="loading"><div className="spinner"></div><p>Đang tải...</p></div>
      ) : (
        <ul className="pt-list">
          {articles.map((a, i) => (
            <li key={i} className="pt-item">
              <a href={a.link} target="_blank" rel="noopener noreferrer" className="pt-title">{a.title}</a>
              <div className="pt-body">
                {a.img && (
                  <a href={a.link} target="_blank" rel="noopener noreferrer" className="pt-thumb">
                    <img src={a.img} alt={`Phân tích xổ số: ${a.title}`} loading="lazy" width="150" height="100" />
                  </a>
                )}
                <p className="pt-excerpt">{a.excerpt}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Province list section — shown only when no sidebar (e.g. mobile stacked) */}
    </div>
  )
}

const VIETLOTT_TABS = [
  { id: 'all', label: 'Vietlott' },
  { id: 'Mega', label: 'Mega' },
  { id: 'Power', label: 'Power' },
  { id: 'Max 3D', label: 'Max 3D' },
  { id: 'Max 3D Pro', label: 'Max 3D Pro' },
  { id: 'Lotto 5/35', label: 'Lotto 5/35' }
]

// ─── VietlottPage component ──────────────────────────────────────────────────
function VietlottPage({ initialTab = 'all' }: { initialTab?: string }) {
  const [boxes, setBoxes] = useState<{ title: string, html: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    setLoading(true)
    fetch(`${BASE_API}/vietlott?type=${encodeURIComponent(activeTab)}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setBoxes(data.boxes)
        } else {
          setError('Không thể tải dữ liệu Vietlott')
        }
      })
      .catch(() => setError('Lỗi kết nối máy chủ'))
      .finally(() => setLoading(false))
  }, [activeTab])

  return (
    <div className="vietlott-page">
      <ul className="v-tabs">
        {VIETLOTT_TABS.map(tab => (
          <li
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </li>
        ))}
      </ul>
      {loading ? (
        <div className="loading"><div className="spinner"></div><p>Đang tải dữ liệu Vietlott...</p></div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="vietlott-content">
          {boxes.map((box, i) => (
            <div key={i} className="vietlott-box" dangerouslySetInnerHTML={{ __html: box.html }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ThongKePage component ──────────────────────────────────────────────────
type TkFilters = {
  dau: boolean;
  duoi: boolean;
  loto: boolean;
  tong: boolean;
  tongchan: boolean;
  tongle: boolean
}

type LotoGanControls = {
  parity: 'all' | 'even' | 'odd'
  byNumber: boolean
}

const DEFAULT_TK_FILTERS: TkFilters = {
  dau: false,
  duoi: false,
  loto: false,
  tong: false,
  tongchan: false,
  tongle: false
}

const TK_FILTER_CLASS_MAP: Record<string, keyof TkFilters> = {
  dau: 'dau',
  duoi: 'duoi',
  loto: 'loto',
  tong: 'tong',
  'even-sum': 'tongchan',
  'odd-sum': 'tongle'
}

const DEFAULT_THONG_KE_URL = 'https://xsmn.mobi/thong-ke-2-so-cuoi-giai-dac-biet-mien-bac.html'
const DEFAULT_QUAY_THU_URL = 'https://xsmn.mobi/quay-thu-xo-so-mien-nam.html'

const THONG_KE_NAV_ITEMS = [
  { label: 'Thống kê 2 số cuối ĐB', url: 'https://xsmn.mobi/thong-ke-2-so-cuoi-giai-dac-biet-mien-bac.html' },
  { label: 'Thống kê lô tô gan', url: 'https://xsmn.mobi/lo-gan-mb.html' },
  { label: 'Thống kê tần suất lô tô', url: 'https://xsmn.mobi/thong-ke-tan-suat-lo-to-mien-bac.html' },
  { label: 'Thống kê đầu đuôi lô tô', url: 'https://xsmn.mobi/thong-ke-dau-duoi-lo-to-mien-bac.html' },
  { label: 'TK ĐB miền Trung', url: 'https://xsmn.mobi/thong-ke-giai-dac-biet-mien-trung.html' },
  { label: 'TK ĐB miền Nam', url: 'https://xsmn.mobi/thong-ke-giai-dac-biet-mien-nam.html' }
]

const QUAY_THU_NAV_ITEMS = [
  { label: 'Quay thử miền Bắc', url: 'https://xsmn.mobi/quay-thu-xo-so-mien-bac.html' },
  { label: 'Quay thử miền Trung', url: 'https://xsmn.mobi/quay-thu-xo-so-mien-trung.html' },
  { label: 'Quay thử miền Nam', url: 'https://xsmn.mobi/quay-thu-xo-so-mien-nam.html' },
  { label: 'Quay thử Vietlott', url: 'https://xsmn.mobi/quay-thu-vietlott.html' }
]

const TK_PROVINCE_SLUGS: Record<string, string> = {
  'An Giang': 'an-giang',
  'Bạc Liêu': 'bac-lieu',
  'Bến Tre': 'ben-tre',
  'Bình Dương': 'binh-duong',
  'Bình Định': 'binh-dinh',
  'Bình Phước': 'binh-phuoc',
  'Bình Thuận': 'binh-thuan',
  'Cà Mau': 'ca-mau',
  'Cần Thơ': 'can-tho',
  'Đà Lạt': 'da-lat',
  'Đà Nẵng': 'da-nang',
  'Đắc Lắc': 'dak-lak',
  'Đắc Nông': 'dak-nong',
  'Đồng Nai': 'dong-nai',
  'Đồng Tháp': 'dong-thap',
  'Gia Lai': 'gia-lai',
  'Hậu Giang': 'hau-giang',
  'Huế': 'thua-thien-hue',
  'Khánh Hòa': 'khanh-hoa',
  'Kiên Giang': 'kien-giang',
  'Kon Tum': 'kon-tum',
  'Long An': 'long-an',
  'Ninh Thuận': 'ninh-thuan',
  'Phú Yên': 'phu-yen',
  'Quảng Bình': 'quang-binh',
  'Quảng Nam': 'quang-nam',
  'Quảng Ngãi': 'quang-ngai',
  'Quảng Trị': 'quang-tri',
  'Sóc Trăng': 'soc-trang',
  'Tây Ninh': 'tay-ninh',
  'Thừa Thiên Huế': 'thua-thien-hue',
  'Tiền Giang': 'tien-giang',
  'TP Hồ Chí Minh': 'tp-hcm',
  'Trà Vinh': 'tra-vinh',
  'Vĩnh Long': 'vinh-long',
  'Vũng Tàu': 'vung-tau'
}

const LO_GAN_PROVINCE_CODES: Record<string, string> = {
  '2': 'ag',
  '3': 'bl',
  '4': 'bt',
  '5': 'bd',
  '6': 'bp',
  '7': 'bth',
  '8': 'cm',
  '9': 'ct',
  '10': 'dl',
  '11': 'dn',
  '12': 'dt',
  '13': 'hg',
  '14': 'hcm',
  '15': 'kg',
  '16': 'la',
  '17': 'st',
  '18': 'tn',
  '19': 'tg',
  '20': 'tv',
  '21': 'vl',
  '22': 'vt',
  '23': 'bdi',
  '24': 'dng',
  '25': 'dlk',
  '26': 'dno',
  '27': 'gl',
  '28': 'kh',
  '29': 'kt',
  '30': 'nt',
  '31': 'py',
  '32': 'qb',
  '33': 'qng',
  '34': 'qnm',
  '35': 'qt',
  '36': 'tth'
}

function getTkFilterGroupKey(toggleButtons: Element) {
  const existingKey = toggleButtons.getAttribute('data-tk-filter-group')
  if (existingKey) return existingKey

  const inputId = toggleButtons.querySelector<HTMLInputElement>('input[id]')?.id || ''
  const match = inputId.match(/^(.+?)-(?:dau|duoi|loto|tong|even-sum|odd-sum)-toggle-input$/)
  return match?.[1] || inputId || 'default'
}

function getProvinceStatsUrl(select: HTMLSelectElement) {
  const provinceName = select.options[select.selectedIndex]?.text.trim()
  if (!provinceName || provinceName === 'Miền Bắc') return DEFAULT_THONG_KE_URL

  const slug = TK_PROVINCE_SLUGS[provinceName]
  return slug ? `https://xsmn.mobi/thong-ke-giai-dac-biet-${slug}.html` : null
}

function getLoGanProvinceUrl(select: HTMLSelectElement) {
  if (select.value === '1') return 'https://xsmn.mobi/lo-gan-mb.html'

  const code = LO_GAN_PROVINCE_CODES[select.value]
  return code ? `https://xsmn.mobi/lo-gan-${code}.html` : null
}

function randomDigits(length: number) {
  let value = ''
  for (let i = 0; i < length; i++) {
    value += Math.floor(Math.random() * 10)
  }
  return value
}

function pickUniqueNumbers(max: number, count: number) {
  const pool = Array.from({ length: max }, (_, index) => index + 1)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count).sort((a, b) => a - b)
}

function padVietlottNumber(value: number) {
  return value.toString().padStart(2, '0')
}

function randomMegaNumbers() {
  return pickUniqueNumbers(45, 6).map(padVietlottNumber)
}

function randomPowerNumbers() {
  const main = pickUniqueNumbers(55, 6)
  const taken = new Set(main)
  let bonus = Math.floor(Math.random() * 55) + 1
  while (taken.has(bonus)) {
    bonus = Math.floor(Math.random() * 55) + 1
  }
  return [...main.map(padVietlottNumber), padVietlottNumber(bonus)]
}

function getVietlottBallNodes(root: HTMLElement, type: 'mega' | 'power') {
  const rowSelector = type === 'mega' ? '#load_kq_mega_0' : '#load_kq_power_0'
  const row = root.querySelector<HTMLElement>(rowSelector)
  if (row) {
    const nodes = Array.from(row.querySelectorAll<HTMLElement>('table.data tr:last-child td i'))
    if (nodes.length) return nodes
  }

  const fallbackSelector = type === 'mega'
    ? '.mega645.box:not(.power655) .results table.data tr:last-child td i'
    : '.mega645.power655.box .results table.data tr:last-child td i'

  return Array.from(root.querySelectorAll<HTMLElement>(fallbackSelector))
}

function startVietlottTrial(root: HTMLElement, type: 'mega' | 'power') {
  clearTrialRollTimers()
  const expectedCells = type === 'mega' ? 6 : 7
  const nodes = getVietlottBallNodes(root, type).slice(0, expectedCells)
  if (nodes.length < expectedCells) return

  nodes.forEach(node => {
    node.className = 'imgloadig'
    node.textContent = ''
  })

  const numbers = type === 'mega' ? randomMegaNumbers() : randomPowerNumbers()

  numbers.forEach((value, index) => {
    const timer = setTimeout(() => {
      const node = nodes[index]
      if (!node) return
      node.classList.remove('imgloadig')
      node.textContent = value
    }, 250 + index * 350)
    trialRollTimers.push(timer)
  })
}

const TRIAL_PRIZE_ORDER = ['g8', 'g7', 'g6', 'g5', 'g4', 'g3', 'g2', 'g1', 'gdb', 'jackpot', 'prize1', 'prize2', 'prize3']
let trialRollTimers: ReturnType<typeof setTimeout>[] = []

function clearTrialRollTimers() {
  trialRollTimers.forEach(timer => clearTimeout(timer))
  trialRollTimers = []
}

function getTrialPrizeSpans(root: HTMLElement, prize: string) {
  // Broaden selector to find spans, strongs, or i tags that represent prizes
  const selectors = [
    `.v-${prize}`,
    `[class*="v-${prize}"]`,
    `.v-giai.number span`,
    `.v-giai.number strong`,
    `.v-giai.number i`
  ]
  if (prize === 'gdb') selectors.push('.v-gdb', '.v-giai-db')
  
  return Array.from(root.querySelectorAll<HTMLElement>(selectors.join(','))).filter(el => {
    const classList = Array.from(el.classList)
    if (prize === 'gdb') {
      return classList.some(c => c === 'v-gdb' || c === 'v-giai-db' || c.startsWith('v-gdb'))
    }
    return classList.some(c => c === `v-${prize}` || c.startsWith(`v-${prize}-`) || c.includes(`v-${prize}`))
  })
}

function getTrialDigitMode(root: HTMLElement) {
  return root.querySelector<HTMLInputElement>('input[name="showed-digits"]:checked')?.value || '0'
}

function applyTrialDigitMode(root: HTMLElement) {
  const mode = getTrialDigitMode(root)

  root.querySelectorAll<HTMLElement>('.v-giai.number span[data-full-number]').forEach(span => {
    const fullNumber = span.dataset.fullNumber || ''
    if (!fullNumber) return

    span.textContent = mode === '2'
      ? fullNumber.slice(-2)
      : mode === '3'
        ? fullNumber.slice(-3)
        : fullNumber
  })

  root.querySelectorAll<HTMLLabelElement>('.digits-form label.radio').forEach(label => {
    const input = label.querySelector<HTMLInputElement>('input[name="showed-digits"]')
    label.classList.toggle('active', Boolean(input?.checked))
    const text = label.querySelector('span')
    if (text && input) {
      text.textContent = input.value === '0' ? 'Đầy đủ' : `${input.value} số`
    }
  })
}

function fillTrialLoto(root: HTMLElement, numbers: string[]) {
  const dauRows = Array.from({ length: 10 }, () => [] as string[])
  const duoiRows = Array.from({ length: 10 }, () => [] as string[])

  numbers.forEach(number => {
    const loto = number.slice(-2)
    const dau = Number(loto[0])
    const duoi = Number(loto[1])
    dauRows[dau].push(duoi.toString())
    duoiRows[duoi].push(dau.toString())
  })

  for (let i = 0; i <= 9; i++) {
    const dauCell = root.querySelector<HTMLElement>(`.v-loto-dau-${i}`)
    const duoiCell = root.querySelector<HTMLElement>(`.v-loto-duoi-${i}`)
    if (dauCell) dauCell.textContent = dauRows[i].join(', ')
    if (duoiCell) duoiCell.textContent = duoiRows[i].join(', ')
  }
}

function resetTrialResult(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-nc]').forEach(span => {
    span.textContent = ''
    span.removeAttribute('data-full-number')
    span.classList.add('trial-rolling')
    span.classList.remove('imgloadig')
  })

  for (let i = 0; i <= 9; i++) {
    const dauCell = root.querySelector<HTMLElement>(`.v-loto-dau-${i}`)
    const duoiCell = root.querySelector<HTMLElement>(`.v-loto-duoi-${i}`)
    if (dauCell) dauCell.textContent = ''
    if (duoiCell) duoiCell.textContent = ''
  }
}

function prepareTrialResult(root: HTMLElement) {
  clearTrialRollTimers()
  root.querySelectorAll<HTMLElement>('.v-giai.number span[data-nc]').forEach(span => {
    span.textContent = ''
    span.removeAttribute('data-full-number')
    span.removeAttribute('data-next-number')
    span.classList.remove('trial-rolling', 'imgloadig')
  })

  for (let i = 0; i <= 9; i++) {
    const dauCell = root.querySelector<HTMLElement>(`.v-loto-dau-${i}`)
    const duoiCell = root.querySelector<HTMLElement>(`.v-loto-duoi-${i}`)
    if (dauCell) dauCell.textContent = ''
    if (duoiCell) duoiCell.textContent = ''
  }

  applyTrialDigitMode(root)
}

function startTrialRoll(root: HTMLElement) {
  clearTrialRollTimers()
  resetTrialResult(root)
  applyTrialDigitMode(root)

  const numbers: string[] = []
  root.querySelectorAll<HTMLElement>('[data-nc]').forEach(span => {
    const length = Number(span.dataset.nc || 5)
    span.dataset.nextNumber = randomDigits(length)
  })

  TRIAL_PRIZE_ORDER.forEach((prize, index) => {
    const timer = setTimeout(() => {
      getTrialPrizeSpans(root, prize).forEach(span => {
        const fullNumber = span.dataset.nextNumber || randomDigits(Number(span.dataset.nc || 5))
        span.dataset.fullNumber = fullNumber
        span.removeAttribute('data-next-number')
        span.classList.remove('trial-rolling')
        numbers.push(fullNumber)
      })

      applyTrialDigitMode(root)

      if (prize === 'gdb') {
        fillTrialLoto(root, numbers)
      }
    }, 700 + index * 650)

    trialRollTimers.push(timer)
  })
}

function ThongKePage({ initialUrl = DEFAULT_THONG_KE_URL }: { initialUrl?: string }) {
  const [htmlContent, setHtmlContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUrl, setCurrentUrl] = useState(initialUrl)
  const isOriginResultPage = /xsmn\.mobi\/(?:xsmn|xsmb|xsmt)-/i.test(currentUrl)

  useEffect(() => {
    setCurrentUrl(initialUrl)
  }, [initialUrl])
  const [filterGroups, setFilterGroups] = useState<Record<string, TkFilters>>({})
  const [lotoGanControls, setLotoGanControls] = useState<LotoGanControls>({ parity: 'all', byNumber: false })
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${BASE_API}/thong-ke?url=${encodeURIComponent(currentUrl)}`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) setHtmlContent(data.html)
        else setError('Không thể tải dữ liệu Thống Kê')
      })
      .catch(() => setError('Lỗi kết nối máy chủ'))
      .finally(() => setLoading(false))
  }, [currentUrl])

  // Apply each native filter row to the table box it belongs to.
  useEffect(() => {
    if (!contentRef.current) return
    const root = contentRef.current

    root.querySelectorAll<HTMLElement>('.toggle-buttons').forEach(toggleButtons => {
      const groupKey = getTkFilterGroupKey(toggleButtons)
      const activeFilters = filterGroups[groupKey] || DEFAULT_TK_FILTERS
      const wrapper = toggleButtons.closest<HTMLElement>('.pad5, .toggle-container')
      const scope = toggleButtons.closest('.box') || root

      toggleButtons.setAttribute('data-tk-filter-group', groupKey)
      toggleButtons.style.display = ''
      if (wrapper) wrapper.style.display = ''

      toggleButtons.querySelectorAll<HTMLInputElement>('input[data-class]').forEach(input => {
        const filterKey = TK_FILTER_CLASS_MAP[input.getAttribute('data-class') || '']
        const enabled = filterKey ? activeFilters[filterKey] : false
        input.checked = enabled
        input.closest('.toggle-button')?.classList.toggle('active', enabled)
      })

      scope.querySelectorAll('td').forEach(td => {
        const ngayQuay = td.querySelector('.ngay-quay')
        if (!ngayQuay) return

        const lotoSpan = td.querySelector('span.loto') as HTMLElement | null
        const numberDiv = td.querySelector('.s16.bold') as HTMLElement | null
        const dauDiv = td.querySelector('.dau') as HTMLElement | null
        const duoiDiv = td.querySelector('.duoi') as HTMLElement | null
        const tongDiv = td.querySelector('.tong') as HTMLElement | null
        const oddSum = td.querySelector('.odd-sum') as HTMLElement | null
        const evenSum = td.querySelector('.even-sum') as HTMLElement | null

        if (lotoSpan) lotoSpan.style.display = activeFilters.loto ? 'none' : ''

        if (numberDiv) numberDiv.style.display = ''
        if (dauDiv) dauDiv.style.display = activeFilters.dau ? 'block' : 'none'
        if (duoiDiv) duoiDiv.style.display = activeFilters.duoi ? 'block' : 'none'
        if (tongDiv) tongDiv.style.display = activeFilters.tong ? 'block' : 'none'

        let bgColor = ''
        if (evenSum) {
          evenSum.style.display = activeFilters.tongchan ? 'block' : 'none'
          if (activeFilters.tongchan) bgColor = '#fff8b0'
        }
        if (oddSum) {
          oddSum.style.display = activeFilters.tongle ? 'block' : 'none'
          if (activeFilters.tongle) bgColor = '#eeeeee'
        }

        td.style.backgroundColor = bgColor
      })
    })
  }, [filterGroups, htmlContent])

  useEffect(() => {
    const root = contentRef.current
    if (!root?.querySelector('#trial-box')) return

    const firstRadio = root.querySelector<HTMLInputElement>('.digits-form input[name="showed-digits"][value="0"]')
    if (firstRadio) firstRadio.checked = true
    prepareTrialResult(root)

    return () => clearTrialRollTimers()
  }, [htmlContent])

  useEffect(() => {
    if (!contentRef.current) return
    const root = contentRef.current
    const table = root.querySelector<HTMLTableElement>('#loto-gan-statistic-table')
    if (!table) return

    const tbody = table.tBodies[0]
    if (!tbody) return

    const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>('tr.loto-gan-row'))
    rows.forEach((row, index) => {
      if (!row.dataset.originalIndex) row.dataset.originalIndex = String(index)
    })

    const orderedRows = [...rows].sort((a, b) => {
      if (lotoGanControls.byNumber) {
        return Number(a.dataset.boso || 0) - Number(b.dataset.boso || 0)
      }

      return Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0)
    })

    orderedRows.forEach(row => {
      const number = Number(row.dataset.boso || 0)
      const isEven = number % 2 === 0
      const visible =
        lotoGanControls.parity === 'all' ||
        (lotoGanControls.parity === 'even' && isEven) ||
        (lotoGanControls.parity === 'odd' && !isEven)

      row.style.display = visible ? '' : 'none'
      tbody.appendChild(row)
    })

    root.querySelectorAll<HTMLInputElement>('input[name="loto-gan-parity"]').forEach(input => {
      input.checked = input.value === lotoGanControls.parity
      input.closest('.button')?.classList.toggle('active', input.checked)
    })

    const orderToggle = root.querySelector<HTMLInputElement>('#loto-gan-number-order-toggle')
    if (orderToggle) {
      orderToggle.checked = lotoGanControls.byNumber
      orderToggle.closest('.toggle-button')?.classList.toggle('active', lotoGanControls.byNumber)
    }
  }, [htmlContent, lotoGanControls])

  const toggle = (groupKey: string, key: keyof TkFilters) => {
    setFilterGroups(prev => {
      const currentFilters = prev[groupKey] || DEFAULT_TK_FILTERS
      return {
        ...prev,
        [groupKey]: {
          ...currentFilters,
          [key]: !currentFilters[key]
        }
      }
    })
  }

  const submitTkForm = useCallback((form: HTMLFormElement, changedField?: HTMLSelectElement) => {
    const formData = new FormData()
    const params = new URLSearchParams()
    const csrf = form.querySelector<HTMLInputElement>('input[name="_csrf"]')?.value
    let requestUrl = form.action && form.action.includes('xsmn.mobi') ? form.action : currentUrl

    if (csrf) formData.append('_csrf', csrf)

    if (form.action.includes('lo-gan') && (changedField?.id === 'statisticform-provinceid' || changedField?.id === 'statisticform-numofday')) {
      const provinceSelect = form.querySelector<HTMLSelectElement>('#statisticform-provinceid')
      const provinceUrl = provinceSelect ? getLoGanProvinceUrl(provinceSelect) : null

      if (provinceUrl) requestUrl = provinceUrl
      new FormData(form).forEach((value, key) => formData.append(key, value.toString()))
    } else if (form.id === 'trial_form' && changedField?.id === 'province_name') {
      const provinceValue = changedField.value
      requestUrl = provinceValue
        ? `https://xsmn.mobi/quay-thu-xo-so-${provinceValue}.html`
        : form.action
      new FormData(form).forEach((value, key) => formData.append(key, value.toString()))
    } else if (changedField?.id === 'statisticform-provinceid' || changedField?.id === 'statisticform-numofweek') {
      const provinceSelect = form.querySelector<HTMLSelectElement>('#statisticform-provinceid')
      const provinceId = provinceSelect?.value
      const numOfWeek = form.querySelector<HTMLSelectElement>('#statisticform-numofweek')?.value
      const provinceUrl = provinceSelect ? getProvinceStatsUrl(provinceSelect) : null

      if (provinceUrl) requestUrl = provinceUrl
      if (provinceId) formData.append('StatisticForm[provinceId]', provinceId)
      if (numOfWeek) formData.append('StatisticForm[numOfWeek]', numOfWeek)
    } else {
      new FormData(form).forEach((value, key) => formData.append(key, value.toString()))
    }

    formData.forEach((value, key) => params.append(key, value.toString()))
    setLoading(true)
    setError('')
    fetch(`${BASE_API}/thong-ke?url=${encodeURIComponent(requestUrl)}`, {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) setHtmlContent(data.html)
        else setError('Không thể tải dữ liệu Thống Kê')
      })
      .catch(() => setError('Lỗi kết nối máy chủ'))
      .finally(() => setLoading(false))
  }, [currentUrl])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const vietlottButton = target.closest<HTMLButtonElement>('#quaythu_mega_btn, #quaythu_power_btn')
    const rawToggle = target.closest('.toggle-button')
    const toggleButtons = rawToggle?.closest('.toggle-buttons')

    if (vietlottButton) {
      e.preventDefault()
      if (!contentRef.current) return
      startVietlottTrial(contentRef.current, vietlottButton.id === 'quaythu_mega_btn' ? 'mega' : 'power')
      return
    }

    if (rawToggle && toggleButtons) {
      e.preventDefault()
      const input = rawToggle.querySelector<HTMLInputElement>('input[data-class]')
      const filterKey = input ? TK_FILTER_CLASS_MAP[input.getAttribute('data-class') || ''] : null
      const orderToggle = rawToggle.querySelector<HTMLInputElement>('#loto-gan-number-order-toggle')

      if (orderToggle) {
        setLotoGanControls(prev => ({ ...prev, byNumber: !prev.byNumber }))
        return
      }

      if (filterKey) toggle(getTkFilterGroupKey(toggleButtons), filterKey)
      return
    }

    const a = target.closest('a')
    if (a && a.href && a.href.includes('/quay-thu-xo-so-')) {
      e.preventDefault()
      clearTrialRollTimers()
      setCurrentUrl(a.href)
      return
    }

    if (a && a.href && a.href.includes('xsmn.mobi')) {
      e.preventDefault()
      setCurrentUrl(a.href)
    }
  }

  useEffect(() => {
    const root = contentRef.current
    if (!root) return

    const onChange = (event: Event) => {
      const target = event.target as HTMLElement
      if (target instanceof HTMLInputElement && target.name === 'showed-digits') {
        applyTrialDigitMode(root)
        return
      }

      if (target instanceof HTMLInputElement && target.name === 'loto-gan-parity') {
        setLotoGanControls(prev => ({
          ...prev,
          parity: target.value === 'even' || target.value === 'odd' ? target.value : 'all'
        }))
        return
      }

      if (target.tagName !== 'SELECT') return

      const form = target.closest('form')
      if (form) submitTkForm(form as HTMLFormElement, target as HTMLSelectElement)
    }

    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault()
      if (event.target instanceof HTMLFormElement && event.target.id === 'trial_form') {
        startTrialRoll(root)
        return
      }

      if (event.target instanceof HTMLFormElement) submitTkForm(event.target)
    }

    root.addEventListener('change', onChange)
    root.addEventListener('submit', onSubmit)

    return () => {
      root.removeEventListener('change', onChange)
      root.removeEventListener('submit', onSubmit)
    }
  }, [htmlContent, submitTkForm])

  return (
    <div className={`thongke-page${isOriginResultPage ? ' thongke-origin-result' : ''}`}>
      <div className="pt-header">Thống Kê <span>Xổ số</span></div>
      {loading ? (
        <div className="loading"><div className="spinner"></div><p>Đang tải dữ liệu Thống Kê...</p></div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          <div
            ref={contentRef}
            className={`thongke-content${isOriginResultPage ? ' origin-content' : ''}`}
            onClick={handleClick}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </>
      )}
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState<'results' | 'live' | 'phanTich' | 'vietlott' | 'thongKe' | 'quayThu'>('results')
  const [activePhanTichTab, setActivePhanTichTab] = useState('all')
  const [activeVietlottTab, setActiveVietlottTab] = useState('all')
  const [thongKeInitialUrl, setThongKeInitialUrl] = useState(DEFAULT_THONG_KE_URL)
  const [quayThuInitialUrl, setQuayThuInitialUrl] = useState(DEFAULT_QUAY_THU_URL)
  const [activeTitle, setActiveTitle] = useState('Kết Quả Xổ Số Miền Nam')
  const [activeRegion, setActiveRegion] = useState('Miền Nam')
  const [activeDay, setActiveDay] = useState('Hôm nay')
  const [loading, setLoading] = useState(true)
  const [resultData, setResultData] = useState<ResultData | null>(null)
  const [error, setError] = useState('')
  const [filterMode, setFilterMode] = useState('0')
  const [highlightDigit, setHighlightDigit] = useState<string | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dayTabsRef = useRef<HTMLUListElement>(null)

  const fetchStats = useCallback(async (region: string, day: string) => {
    setStatsLoading(true)
    setStats(null)
    try {
      const ds = daySlug(day)
      const url = `${BASE_API}/stats?region=${regionSlug(region)}${ds ? `&day=${ds}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.ok) setStats(data)
    } catch { /* fail silently */ }
    finally { setStatsLoading(false) }
  }, [])

  const fetchResult = useCallback(async (path: string, title: string, region: string, day: string) => {
    setActiveTitle(title)
    setActiveRegion(region)
    setActiveDay(day)
    setLoading(true)
    setError('')
    setResultData(null)
    
    // Update document title dynamically
    const regionCode = region === 'Miền Bắc' ? 'XSMB' : region === 'Miền Trung' ? 'XSMT' : 'XSMN'
    const dayText = day === 'Hôm nay' ? 'Hôm Nay' : day
    document.title = `${regionCode} ${dayText} - ${title} | XSKT`
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', `Kết quả ${regionCode} ${dayText.toLowerCase()} - ${title}. Xem trực tiếp kết quả xổ số ${region.toLowerCase()} nhanh nhất, chính xác nhất.`)
    }
    
    try {
      const res = await fetch(`${BASE_API}${path}`)
      const data = await res.json()
      if (data.ok && data.provinces) {
        setResultData(data)
      } else {
        setError('Không thể tải dữ liệu. Vui lòng thử lại.')
      }
    } catch {
      setError('Lỗi kết nối máy chủ dữ liệu.')
    } finally {
      setLoading(false)
    }
    fetchStats(region, day)
  }, [fetchStats])

  useEffect(() => {
    fetchResult('/results?region=mien-nam', 'Kết Quả Xổ Số Miền Nam', 'Miền Nam', 'Hôm nay')
    
    // Update document title and meta description dynamically
    document.title = 'XSMN - Kết Quả Xổ Số Miền Nam, Miền Bắc, Miền Trung Trực Tiếp'
    
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Kết quả xổ số XSMN, XSMB, XSMT trực tiếp nhanh nhất. Thống kê, phân tích xổ số chuyên nghiệp. Cập nhật kết quả xổ số 3 miền hàng ngày.')
    }
    
    // Prefetch all regions data in background
    const prefetchData = async () => {
      const regions = ['mien-bac', 'mien-trung']
      const days = ['thu-2', 'thu-3', 'thu-4', 'thu-5', 'thu-6', 'thu-7', 'chu-nhat']
      
      // Prefetch other regions
      regions.forEach(region => {
        fetch(`${BASE_API}/results?region=${region}`)
          .then(r => r.json())
          .catch(() => {})
        
        fetch(`${BASE_API}/stats?region=${region}`)
          .then(r => r.json())
          .catch(() => {})
      })
      
      // Prefetch common days for current region
      days.slice(0, 3).forEach(day => {
        fetch(`${BASE_API}/results?region=mien-nam&day=${day}`)
          .then(r => r.json())
          .catch(() => {})
      })
      
      // Prefetch common provinces
      const provinces = ['tp-hcm', 'ha-noi', 'da-nang', 'can-tho', 'dong-nai']
      provinces.forEach(slug => {
        fetch(`${BASE_API}/province?region=mien-nam&slug=${slug}`)
          .then(r => r.json())
          .catch(() => {})
      })
    }
    
    // Start prefetching after 2 seconds (after initial load)
    const prefetchTimer = setTimeout(prefetchData, 2000)
    
    return () => clearTimeout(prefetchTimer)
  }, [fetchResult])

  // Sync URL with page state for SEO
  useEffect(() => {
    let url = '/'
    
    if (activePage === 'results') {
      const regionSlugMap: Record<string, string> = {
        'Miền Nam': 'xsmn',
        'Miền Bắc': 'xsmb',
        'Miền Trung': 'xsmt'
      }
      const daySlugMap: Record<string, string> = {
        'Hôm nay': '',
        'Thứ 2': 'thu-2',
        'Thứ 3': 'thu-3',
        'Thứ 4': 'thu-4',
        'Thứ 5': 'thu-5',
        'Thứ 6': 'thu-6',
        'Thứ 7': 'thu-7',
        'CN': 'chu-nhat'
      }
      
      const regionUrl = regionSlugMap[activeRegion] || 'xsmn'
      const dayUrl = daySlugMap[activeDay] || ''
      
      url = dayUrl ? `/${regionUrl}/${dayUrl}` : `/${regionUrl}`
    } else if (activePage === 'live') {
      url = '/truc-tiep'
    } else if (activePage === 'phanTich') {
      url = activePhanTichTab && activePhanTichTab !== 'all' 
        ? `/phan-tich/${activePhanTichTab}` 
        : '/phan-tich'
    } else if (activePage === 'vietlott') {
      url = activeVietlottTab && activeVietlottTab !== 'all'
        ? `/vietlott/${activeVietlottTab.toLowerCase().replace(/\s+/g, '-')}`
        : '/vietlott'
    } else if (activePage === 'thongKe') {
      url = '/thong-ke'
    } else if (activePage === 'quayThu') {
      url = '/quay-thu'
    }
    
    // Update URL without page reload
    if (window.location.pathname !== url) {
      window.history.pushState({}, '', url)
    }
  }, [activePage, activeRegion, activeDay, activePhanTichTab, activeVietlottTab])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  // Scroll active day tab into view
  useEffect(() => {
    if (dayTabsRef.current) {
      const activeTab = dayTabsRef.current.querySelector('li.active') as HTMLElement | null
      activeTab?.scrollIntoView({ block: 'nearest', inline: 'center' })
    }
  }, [activeDay])

  const openPhanTich = (tab: string = 'all') => {
    setActivePhanTichTab(tab)
    setActivePage('phanTich')
  }

  const openVietlott = (tab: string = 'all') => {
    setActiveVietlottTab(tab)
    setActivePage('vietlott')
  }

  const openThongKe = (url: string = DEFAULT_THONG_KE_URL) => {
    setThongKeInitialUrl(url)
    setActivePage('thongKe')
  }

  const openQuayThu = (url: string = DEFAULT_QUAY_THU_URL) => {
    setQuayThuInitialUrl(url)
    setActivePage('quayThu')
  }

  const rc = regionCode(activeRegion)
  const rs = regionSlug(activeRegion)

  return (
    <div className="xsmn-app">
      {/* ─── HEADER ─── */}
      <header className="xsmn-header" role="banner">
        <div className="xsmn-container header-inner">
          <h1 className="logo" onClick={() => fetchResult('/results?region=mien-nam', 'Kết Quả Xổ Số Miền Nam', 'Miền Nam', 'Hôm nay')}>
            XSKT
          </h1>
          <div className="header-right">
            <span>Kết quả xổ số kiến thiết trực tiếp nhanh nhất</span>
          </div>
        </div>
      </header>

      {/* ─── NAV ─── */}
      <nav className="xsmn-nav" role="navigation" aria-label="Menu chính">
        <div className="xsmn-container nav-inner">
          <ul className="nav-menu" role="menubar">
            {(['XSMN', 'XSMB', 'XSMT'] as const).map(code => {
              const reg = code === 'XSMN' ? 'Miền Nam' : code === 'XSMB' ? 'Miền Bắc' : 'Miền Trung'
              return (
                <li key={code}
                  className={`has-dropdown ${activePage === 'thongKe' && thongKeInitialUrl.includes(`/${REGION_RESULT_PREFIX[reg] || ''}-`) ? 'active' : ''}`}
                  onClick={() => { const rs = regionSlug(reg); fetchResult(`/results?region=${rs}`, `Kết Quả Xổ Số ${reg}`, reg, 'Hôm nay'); setActivePage('results'); }}>
                  <span>{code}</span>
                  <ul className="dropdown">
                    {[['Thứ 2', 'thu-2'], ['Thứ 3', 'thu-3'], ['Thứ 4', 'thu-4'], ['Thứ 5', 'thu-5'], ['Thứ 6', 'thu-6'], ['Thứ 7', 'thu-7'], ['Chủ nhật', 'chu-nhat']].map(([label, ds]) => (
                      <li key={ds} onClick={e => { e.stopPropagation(); const rs = regionSlug(reg); const rc = regionCode(reg); fetchResult(`/results?region=${rs}&day=${ds}`, `XS${rc} ${label}`, reg, label); setActivePage('results'); }}>{label}</li>
                    ))}
                  </ul>
                </li>
              )
            })}
            <li className={`has-dropdown ${activePage === 'live' ? 'active' : ''}`} onClick={() => setActivePage('live')}>
              <span>TRỰC TIẾP</span>
              <ul className="dropdown">
                <li onClick={e => { e.stopPropagation(); setActivePage('live') }}>Trực tiếp 3 miền</li>
              </ul>
            </li>

            <li className={`has-dropdown ${activePage === 'phanTich' ? 'active' : ''}`} onClick={() => openPhanTich('all')}>
              <span>PHÂN TÍCH</span>
              <ul className="dropdown">
                {PT_TABS.map(tab => (
                  <li key={tab.key} onClick={e => { e.stopPropagation(); openPhanTich(tab.key) }}>{tab.label}</li>
                ))}
              </ul>
            </li>

            <li className={`has-dropdown ${activePage === 'thongKe' ? 'active' : ''}`} onClick={() => openThongKe()}>
              <span>THỐNG KÊ</span>
              <ul className="dropdown">
                {THONG_KE_NAV_ITEMS.map(item => (
                  <li key={item.url} onClick={e => { e.stopPropagation(); openThongKe(item.url) }}>{item.label}</li>
                ))}
              </ul>
            </li>

            <li className={`has-dropdown ${activePage === 'quayThu' ? 'active' : ''}`} onClick={() => openQuayThu()}>
              <span>QUAY THỬ</span>
              <ul className="dropdown">
                {QUAY_THU_NAV_ITEMS.map(item => (
                  <li key={item.url} onClick={e => { e.stopPropagation(); openQuayThu(item.url) }}>{item.label}</li>
                ))}
              </ul>
            </li>

            <li className={`has-dropdown ${activePage === 'vietlott' ? 'active' : ''}`} onClick={() => openVietlott('all')}>
              <span>VIETLOTT</span>
              <ul className="dropdown">
                {VIETLOTT_TABS.map(tab => (
                  <li key={tab.id} onClick={e => { e.stopPropagation(); openVietlott(tab.id) }}>{tab.label}</li>
                ))}
              </ul>
            </li>
          </ul>
          {/* Hamburger button - mobile only */}
          <button className="hamburger-btn" aria-label="Mở menu" onClick={() => setMobileMenuOpen(o => !o)}>
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      {/* ─── MOBILE MENU OVERLAY ─── */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={e => e.stopPropagation()}>
            <div className="mobile-menu-header">
              <span className="mobile-menu-logo">XSKT</span>
              <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>✕</button>
            </div>
            <ul className="mobile-menu-list">
              {(['XSMN', 'XSMB', 'XSMT'] as const).map(code => {
                const reg = code === 'XSMN' ? 'Miền Nam' : code === 'XSMB' ? 'Miền Bắc' : 'Miền Trung'
                const isOpen = openDropdown === code
                return (
                  <li key={code} className="mobile-menu-item">
                    <div className="mobile-menu-row" onClick={() => setOpenDropdown(isOpen ? null : code)}>
                      <span onClick={(e) => { e.stopPropagation(); const rs = regionSlug(reg); fetchResult(`/results?region=${rs}`, `Kết Quả Xổ Số ${reg}`, reg, 'Hôm nay'); setActivePage('results'); setMobileMenuOpen(false); }}>{code}</span>
                      <span className={`mobile-arrow ${isOpen ? 'open' : ''}`}>›</span>
                    </div>
                    {isOpen && (
                      <ul className="mobile-submenu">
                        {[['Thứ 2', 'thu-2'], ['Thứ 3', 'thu-3'], ['Thứ 4', 'thu-4'], ['Thứ 5', 'thu-5'], ['Thứ 6', 'thu-6'], ['Thứ 7', 'thu-7'], ['Chủ nhật', 'chu-nhat']].map(([label, ds]) => (
                          <li key={ds} onClick={() => { const rs = regionSlug(reg); const rc = regionCode(reg); fetchResult(`/results?region=${rs}&day=${ds}`, `XS${rc} ${label}`, reg, label); setActivePage('results'); setMobileMenuOpen(false); }}>{label}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
              {['TRỰC TIẾP', 'PHÂN TÍCH', 'THỐNG KÊ', 'QUAY THỬ', 'VIETLOTT'].map(m => (
                <li key={m} className="mobile-menu-item" onClick={() => {
                  if (m === 'TRỰC TIẾP') setActivePage('live')
                  else if (m === 'PHÂN TÍCH') openPhanTich('all')
                  else if (m === 'VIETLOTT') openVietlott('all')
                  else if (m === 'THỐNG KÊ') openThongKe()
                  else if (m === 'QUAY THỬ') openQuayThu()
                  setMobileMenuOpen(false)
                }}>
                  <div className="mobile-menu-row"><span>{m}</span></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ─── MAIN ─── */}
      <div className="xsmn-container xsmn-main">
        {activePage === 'live' || activePage === 'phanTich' || activePage === 'vietlott' || activePage === 'thongKe' || activePage === 'quayThu' ? (
          <>
            <div className="breadcrumb">
              <a href="#" onClick={() => setActivePage('results')}>XSKT</a> » <span>{activePage === 'live' ? 'Trực Tiếp Xổ Số' : activePage === 'phanTich' ? 'Phân Tích Xổ Số' : activePage === 'vietlott' ? 'Xổ Số Vietlott' : activePage === 'quayThu' ? 'Quay Thử Xổ Số' : 'Thống Kê Xổ Số'}</span>
            </div>
            <div className="xsmn-columns">
              <div className="xsmn-content">
                {activePage === 'live'
                  ? <TrucTiepPage />
                  : activePage === 'phanTich'
                    ? <PhanTichPage initialTab={activePhanTichTab} />
                    : activePage === 'vietlott'
                      ? <VietlottPage initialTab={activeVietlottTab} />
                      : activePage === 'thongKe'
                        ? <ThongKePage initialUrl={thongKeInitialUrl} />
                        : <ThongKePage initialUrl={quayThuInitialUrl} />
                }
              </div>
              <div className="xsmn-sidebar">
                {TINH_DATA.map(({ label, region, slug, tinh }) => (
                  <div key={slug} className="widget sidebar-tinh-block">
                    <div className="sidebar-tinh-title">
                      <span className="tinh-icon">●</span>
                      {label}
                    </div>
                    <ul className="tinh-list">
                      {tinh.map(([tslug, name]) => (
                        <li key={tslug} onClick={() => { setActivePage('results'); fetchResult(`/province?region=${slug}&slug=${tslug}`, name, region, 'Hôm nay') }}>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="breadcrumb">
              <a href="#" onClick={() => setActivePage('results')}>XSKT</a> » <span>{activeTitle}</span>
            </div>

            <div className="xsmn-columns">
              <div className="xsmn-content">

                {/* DAY TABS */}
                <ul className="day-tabs" ref={dayTabsRef}>
                  <li className={activeDay === 'Hôm nay' ? 'active' : ''} onClick={() => fetchResult(`/results?region=${rs}`, `Kết Quả Xổ Số ${activeRegion}`, activeRegion, 'Hôm nay')}>{activeRegion}</li>
                  {[['Thứ 2', 'thu-2'], ['Thứ 3', 'thu-3'], ['Thứ 4', 'thu-4'], ['Thứ 5', 'thu-5'], ['Thứ 6', 'thu-6'], ['Thứ 7', 'thu-7'], ['CN', 'chu-nhat']].map(([label, ds]) => (
                    <li key={ds} className={activeDay === label ? 'active' : ''} onClick={() => fetchResult(`/results?region=${rs}&day=${ds}`, `XS${rc} ${label}`, activeRegion, label)}>{label}</li>
                  ))}
                </ul>

                <div className="results-container">
                  <div className="table-header-title">{activeTitle} - Xổ số {activeRegion.toLowerCase()} {activeDay.toLowerCase()}</div>
                  <div className="table-header-breadcrumb">XS{rc} » XS{rc} {activeDay}</div>

                  {loading ? (
                    <div className="loading"><div className="spinner"></div><p>Đang tải dữ liệu xổ số...</p></div>
                  ) : error ? (
                    <div className="error">{error}</div>
                  ) : resultData ? (
                    <>
                      <div className="table-scroll-wrap">
                        {activeRegion === 'Miền Bắc'
                          ? <KetQuaMienBac data={resultData} filterMode={filterMode} highlightDigit={highlightDigit} />
                          : <KetQuaTable data={resultData} filterMode={filterMode} highlightDigit={highlightDigit} />
                        }
                      </div>

                      {/* CONTROL PANEL */}
                      <div className="xsmn-control-panel">
                        <div className="control-top">
                          <div className="radio-group">
                            {[['0', 'Đầy đủ'], ['2', '2 số'], ['3', '3 số']].map(([val, label]) => (
                              <label key={val}>
                                <input type="radio" name="filterMode" checked={filterMode === val} onChange={() => setFilterMode(val)} />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="control-bottom">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <div key={num} className={`digit-btn ${highlightDigit === String(num) ? 'active' : ''}`}
                              onClick={() => setHighlightDigit(highlightDigit === String(num) ? null : String(num))}>
                              {num}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="seo-text">
                  <p><strong>Xổ số Miền Nam</strong> được tường thuật trực tiếp vào khung giờ từ: 16h15' - 16h30' hàng ngày.</p>
                  
                  {/* Structured Data for Lottery Results */}
                  {resultData && (
                    <script type="application/ld+json" dangerouslySetInnerHTML={{
                      __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Event",
                        "name": `${activeTitle} - ${activeDay}`,
                        "description": `Kết quả xổ số ${activeRegion} ngày ${new Date().toLocaleDateString('vi-VN')}`,
                        "startDate": new Date().toISOString().split('T')[0],
                        "endDate": new Date().toISOString().split('T')[0],
                        "eventStatus": "https://schema.org/EventScheduled",
                        "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
                        "location": {
                          "@type": "VirtualLocation",
                          "url": window.location.href
                        },
                        "organizer": {
                          "@type": "Organization",
                          "name": "XSKT",
                          "url": "https://xsmn-lottery.pages.dev"
                        },
                        "offers": {
                          "@type": "Offer",
                          "price": "0",
                          "priceCurrency": "VND",
                          "availability": "https://schema.org/InStock"
                        }
                      })
                    }} />
                  )}
                </div>

                {/* BẢNG ĐẦU ĐUÔI */}
                {statsLoading && <div className="stats-loading">Đang tải thống kê...</div>}
                {!statsLoading && stats?.dauDuoi && stats.dauDuoi.provinces.length > 0 && (
                  <div className="dau-duoi-section">
                    <div className="stats-title">Bảng Đầu Đuôi {activeTitle}</div>
                    <div className="dau-duoi-scroll">
                      <table className="dau-duoi-table">
                        <thead>
                          <tr>
                            <th className="dau-col">Đầu</th>
                            {stats.dauDuoi.provinces.map(p => <th key={p}>{p}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.dauDuoi.rows.map(row => (
                            <tr key={row.dau}>
                              <td className="dau-cell">{row.dau}</td>
                              {stats.dauDuoi.provinces.map(p => (
                                <td key={p} className="duoi-cell">{(row.duoi[p] || []).join(',')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* SIDEBAR */}
              <div className="xsmn-sidebar">
                {TINH_DATA.map(({ label, region, slug, tinh }) => (
                  <div key={slug} className="widget sidebar-tinh-block">
                    <div className="sidebar-tinh-title">
                      <span className="tinh-icon">●</span>
                      {label}
                    </div>
                    <ul className="tinh-list">
                      {tinh.map(([tslug, name]) => (
                        <li key={tslug} onClick={() => fetchResult(`/province?region=${slug}&slug=${tslug}`, name, region, 'Hôm nay')}>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>







    </div>
  )
}

export default App











