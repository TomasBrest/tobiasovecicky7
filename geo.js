// KARGO – mestá, letiská, prístavy, trasy a odhad polohy balíka
// [lat, lng]
const P = (lat, lng, n, ...al) => ({ lat, lng, n, al: [n, ...al].map((x) => x.toLowerCase()) })

const CN_AIR = {
  PVG: P(31.143, 121.805, 'Shanghai PVG', 'shanghai', 'pudong', 'pvg'),
  HGH: P(30.229, 120.434, 'Hangzhou HGH', 'hangzhou', 'hgh', 'yiwu', 'jinhua', 'ningbo'),
  CAN: P(23.392, 113.299, 'Guangzhou CAN', 'guangzhou', 'baiyun', 'can'),
  SZX: P(22.639, 113.811, 'Shenzhen SZX', 'shenzhen', 'szx', 'bao an', "bao'an", 'dongguan'),
  HKG: P(22.308, 113.918, 'Hong Kong HKG', 'hong kong', 'hongkong', 'hkg'),
  CGO: P(34.519, 113.841, 'Zhengzhou CGO', 'zhengzhou', 'cgo'),
  CTU: P(30.578, 103.947, 'Chengdu CTU', 'chengdu', 'ctu'),
  XMN: P(24.544, 118.128, 'Xiamen XMN', 'xiamen', 'xmn'),
  PEK: P(40.080, 116.584, 'Beijing PEK', 'beijing', 'pek', 'pkx'),
}
export const EU_HUBS = {
  LEJ: P(51.432, 12.241, 'Leipzig LEJ (DHL hub)', 'leipzig', 'lej', 'halle', 'schkeuditz'),
  FRA: P(50.037, 8.562, 'Frankfurt FRA', 'frankfurt', 'fra'),
  CGN: P(50.866, 7.143, 'Cologne CGN (UPS)', 'koln', 'köln', 'cologne', 'cgn', 'bonn'),
  MUC: P(48.354, 11.786, 'Munich MUC', 'munich', 'münchen', 'munchen', 'muc'),
  HAM: P(53.630, 9.988, 'Hamburg HAM', 'hamburg', 'ham'),
  LGG: P(50.637, 5.443, 'Liège LGG (Cainiao)', 'liege', 'liège', 'lgg', 'luik', 'belgium'),
  AMS: P(52.310, 4.768, 'Amsterdam AMS', 'amsterdam', 'schiphol', 'ams', 'netherlands'),
  BUD: P(47.439, 19.262, 'Budapest BUD', 'budapest', 'bud', 'hungary'),
  PRG: P(50.101, 14.260, 'Praha PRG', 'prague', 'praha', 'prg'),
  VIE: P(48.110, 16.570, 'Vienna VIE', 'vienna', 'wien', 'vie', 'schwechat'),
  WAW: P(52.165, 20.967, 'Warsaw WAW', 'warsaw', 'warszawa', 'waw'),
}
const PORTS = {
  YTN: P(22.57, 114.27, 'Port of Yantian', 'yantian'),
  NGB: P(29.93, 121.85, 'Port of Ningbo', 'ningbo port', 'beilun'),
  SHA: P(30.63, 122.07, 'Port of Shanghai', 'yangshan'),
  HAMP: P(53.54, 9.97, 'Port of Hamburg', 'hamburg port'),
  RTM: P(51.95, 4.05, 'Port of Rotterdam', 'rotterdam'),
  KOP: P(45.55, 13.73, 'Port of Koper', 'koper', 'slovenia'),
}
const SEA_WP = [[1.25, 103.8], [5.8, 80.5], [12.6, 43.4], [20.5, 38.5], [29.9, 32.55], [31.3, 32.35]]
const SEA_KOP = [[34.6, 24.5], [37.5, 20.0], [40.2, 19.0], [43.5, 15.5]]
const SEA_NORTH = [[33.8, 12.0], [37.3, 2.0], [36.0, -5.6], [37.0, -9.8], [43.5, -10.0], [48.6, -6.0], [50.0, -1.5], [51.3, 2.0]]
const RAIL_WP = [[34.27, 108.94], [43.8, 87.6], [44.2, 80.4], [51.17, 71.45], [53.9, 27.56], [52.03, 23.5]]

// ďalšie mestá pre odhad polohy z textu udalostí
const CITIES = [
  P(29.31, 120.07, 'Yiwu', 'yiwu'), P(23.02, 113.75, 'Dongguan', 'dongguan'), P(22.27, 113.57, 'Zhuhai', 'zhuhai'),
  P(30.27, 120.15, 'Hangzhou', 'hangzhou'), P(29.87, 121.54, 'Ningbo', 'ningbo'), P(31.23, 121.47, 'Shanghai', 'shanghai'),
  P(23.13, 113.26, 'Guangzhou', 'guangzhou'), P(22.54, 114.06, 'Shenzhen', 'shenzhen'), P(22.52, 113.39, 'Zhongshan', 'zhongshan'),
  P(23.02, 113.12, 'Foshan', 'foshan'), P(32.06, 118.8, 'Nanjing', 'nanjing'), P(31.3, 120.6, 'Suzhou', 'suzhou'),
  P(36.07, 120.38, 'Qingdao', 'qingdao'), P(39.08, 117.2, 'Tianjin', 'tianjin'), P(26.07, 119.3, 'Fuzhou', 'fuzhou'),
  P(24.87, 118.68, 'Quanzhou', 'quanzhou'), P(28.0, 120.67, 'Wenzhou', 'wenzhou'), P(30.59, 114.3, 'Wuhan', 'wuhan'),
  P(34.27, 108.94, "Xi'an", "xi'an", 'xian'), P(29.56, 106.55, 'Chongqing', 'chongqing'), P(43.82, 87.62, 'Urumqi', 'urumqi'),
  P(25.27, 55.30, 'Dubai', 'dubai', 'dxb'), P(25.27, 51.6, 'Doha', 'doha', 'qatar'), P(41.26, 28.74, 'Istanbul', 'istanbul', 'ist'),
  P(52.52, 13.40, 'Berlin', 'berlin'), P(51.34, 12.37, 'Leipzig', 'leipzig'), P(49.45, 11.08, 'Nuremberg', 'nuremberg', 'nürnberg'),
  P(51.43, 6.76, 'Duisburg', 'duisburg'), P(48.78, 9.18, 'Stuttgart', 'stuttgart'), P(51.05, 13.74, 'Dresden', 'dresden'),
  P(48.15, 17.11, 'Bratislava', 'bratislava'), P(48.72, 21.26, 'Košice', 'kosice', 'košice'), P(49.22, 18.74, 'Žilina', 'zilina', 'žilina'),
  P(48.31, 18.09, 'Nitra', 'nitra'), P(48.38, 17.59, 'Trnava', 'trnava'), P(48.74, 19.15, 'Banská Bystrica', 'banska bystrica'),
  P(49.0, 21.24, 'Prešov', 'presov', 'prešov'), P(48.89, 18.04, 'Trenčín', 'trencin', 'trenčín'), P(48.24, 17.33, 'Senec', 'senec'),
  P(48.69, 19.70, 'Slovakia', 'slovakia', 'slovak republic'), P(51.16, 10.45, 'Germany', 'germany', 'deutschland'),
  P(49.20, 16.61, 'Brno', 'brno'), P(49.82, 18.26, 'Ostrava', 'ostrava'),
]
const ALL = [...Object.values(CN_AIR), ...Object.values(EU_HUBS), ...Object.values(PORTS), ...CITIES]

const R = Math.PI / 180
export function dist(a, b) {
  const dLat = (b.lat - a.lat) * R, dLng = (b.lng - a.lng) * R
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(s))
}
// veľkokruhový oblúk (let lietadla)
function arc(a, b, n = 48) {
  const φ1 = a.lat * R, λ1 = a.lng * R, φ2 = b.lat * R, λ2 = b.lng * R
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2))
  if (d < 1e-6) return [[a.lng, a.lat]]
  const out = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
    const z = A * Math.sin(φ1) + B * Math.sin(φ2)
    out.push([Math.atan2(y, x) / R, Math.atan2(z, Math.sqrt(x * x + y * y)) / R])
  }
  return out
}
const pt = (p) => ({ lat: p[0] ?? p.lat, lng: p[1] ?? p.lng })
const nearest = (o, dict) => Object.values(dict).sort((a, b) => dist(o, a) - dist(o, b))[0]

export const HUB_OPTIONS = Object.entries(EU_HUBS).map(([k, v]) => ({ k, n: v.n }))
export const DEFAULT_HOME = { lat: 48.1486, lng: 17.1077, name: 'Bratislava' }

// trasa: body + úseky (nákladiak / lietadlo / loď / vlak) + zastávky
export function planRoute(o, origin, home) {
  const from = origin?.lat ? origin : CN_AIR.SZX
  const to = home?.lat ? home : DEFAULT_HOME
  const stops = [{ ...from, n: origin?.name ?? 'Agent in China', k: 'origin' }]
  let coords = [[from.lng, from.lat]]
  const segs = []
  const add = (pts, k) => { const a = coords.length - 1; coords = coords.concat(pts.slice(1)); segs.push({ k, a, b: coords.length - 1 }) }
  if (o.mode === 'sea') {
    const port = nearest(from, { YTN: PORTS.YTN, NGB: PORTS.NGB, SHA: PORTS.SHA })
    const toPort = dist(to, PORTS.KOP) < dist(to, PORTS.HAMP) ? 'KOP' : 'HAMP'
    stops.push({ ...port, k: 'port' })
    add(arc(from, port, 6), 'truck')
    const wps = [port, ...SEA_WP.map(pt), ...(toPort === 'KOP' ? SEA_KOP.map(pt) : SEA_NORTH.map(pt)), PORTS[toPort]]
    let sea = [[port.lng, port.lat]]
    for (let i = 1; i < wps.length; i++) sea = sea.concat(arc(wps[i - 1], wps[i], 10).slice(1))
    add(sea, 'ship')
    stops.push({ ...PORTS[toPort], k: 'hub' })
    add(arc(PORTS[toPort], to, 8), 'truck')
  } else if (o.mode === 'rail' || o.mode === 'truck') {
    const wps = [from, ...RAIL_WP.map(pt)]
    let r = [[from.lng, from.lat]]
    for (let i = 1; i < wps.length; i++) r = r.concat(arc(wps[i - 1], wps[i], 10).slice(1))
    add(r, o.mode === 'rail' ? 'train' : 'truck')
    stops.push({ ...pt(RAIL_WP[RAIL_WP.length - 1]), n: o.mode === 'rail' ? 'Malaszewicze (PL)' : 'EU border', k: 'hub' })
    add(arc(pt(RAIL_WP[RAIL_WP.length - 1]), to, 8), 'truck')
  } else {
    const air = nearest(from, CN_AIR)
    const hub = EU_HUBS[o.hub] ?? EU_HUBS.LEJ
    stops.push({ ...air, k: 'airport' })
    add(arc(from, air, 4), 'truck')
    add(arc(air, hub, 80), 'air')
    stops.push({ ...hub, k: 'hub' })
    add(arc(hub, to, 10), 'truck')
  }
  stops.push({ ...to, n: home?.name ?? 'Home', k: 'home' })
  return smooth({ coords, stops, segs })
}

// jemne zaoblí prestup (lietadlo pristane v Nemecku → kamión), trasa ostáva cez letisko
function smooth(r) {
  const c = r.coords
  const d = (i, j) => dist({ lat: c[i][1], lng: c[i][0] }, { lat: c[j][1], lng: c[j][0] })
  for (const sg of r.segs.slice(0, -1)) {
    const J = sg.b
    let i0 = J, acc = 0; while (i0 > 0 && acc < 70) { acc += d(i0 - 1, i0); i0-- }
    let i1 = J; acc = 0; while (i1 < c.length - 1 && acc < 70) { acc += d(i1, i1 + 1); i1++ }
    if (i1 - i0 < 2) continue
    const P0 = c[i0], P1 = c[J], P2 = c[i1]
    for (let i = i0 + 1; i < i1; i++) {
      const t = (i - i0) / (i1 - i0), u = 1 - t
      c[i] = [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]]
    }
  }
  return r
}
function bearing(a, b) {
  const φ1 = a[1] * R, φ2 = b[1] * R, Δ = (b[0] - a[0]) * R
  return (Math.atan2(Math.sin(Δ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δ)) / R + 360) % 360
}
// bod na úseku podľa podielu 0–1
function along(route, seg, f) {
  f = Math.max(0, Math.min(1, f))
  const n = seg.b - seg.a
  const x = seg.a + f * n
  const i = Math.min(Math.floor(x), seg.b - 1)
  const t = x - i
  const A = route.coords[i], B = route.coords[i + 1] ?? A
  return { lat: A[1] + (B[1] - A[1]) * t, lng: A[0] + (B[0] - A[0]) * t, idx: i + 1, brg: bearing(A, B), seg: seg.k }
}
const SEG_HOURS = { air: 40, ship: 24 * 32, train: 24 * 18, truck: 30 }
const lastT = (ev, re) => { const e = ev.find((x) => re.test(`${x.d} ${x.loc}`)); return e ? new Date(e.t).getTime() : null }

// kde je balík a čím ide: 1) súradnice z trackingu 2) mesto 3) odhad podľa fázy a času
export function locate(o, route) {
  const ev = o.track_events ?? []
  const s = o.stage ?? 1
  const segOf = (k) => route.segs.find((x) => x.k === k)
  const main = route.segs.find((x) => x.k !== 'truck') ?? route.segs[0]
  const last = route.segs[route.segs.length - 1]
  const snap = (p, how, label) => {
    // priraď k najbližšiemu bodu trasy kvôli smeru a vozidlu
    let bi = 0, bd = 1e12
    route.coords.forEach((c, i) => { const d = dist({ lat: c[1], lng: c[0] }, p); if (d < bd) { bd = d; bi = i } })
    const sg = route.segs.find((x) => bi >= x.a && bi <= x.b) ?? main
    const A = route.coords[Math.max(bi - 1, 0)], B = route.coords[Math.min(bi + 1, route.coords.length - 1)]
    return { lat: p.lat, lng: p.lng, idx: bi, brg: bearing(A, B), seg: s >= 5 && sg.k === main.k && bd < 80 ? 'truck' : sg.k, how, label }
  }
  if (s >= 7) { const h = route.stops.at(-1); return { ...h, idx: route.coords.length - 1, seg: 'done', brg: 0, how: 'delivered', label: 'Delivered' } }
  for (const e of ev) if (e.lat && e.lng) return snap({ lat: e.lat, lng: e.lng }, 'tracking', e.loc || e.d)
  // fáza „na ceste“: poloha podľa času od odletu / vyplávania
  if (s === 4 && main) {
    const dep = lastT(ev, /depart|flight|airline|vessel|loaded|export|handed over/i) ?? (ev.length ? new Date(ev[0].t).getTime() : null)
    const f = dep ? (Date.now() - dep) / 36e5 / SEG_HOURS[main.k] : 0.5
    const p = along(route, main, Math.min(f, 0.97))
    return { ...p, how: 'estimate', label: { air: 'In the air', ship: 'At sea', train: 'On the train', truck: 'On the road' }[main.k] }
  }
  for (const e of ev) {
    const txt = ' ' + `${e.loc ?? ''} ${e.d ?? ''}`.toLowerCase().replace(/[,.;()]/g, ' ') + ' '
    const hit = ALL.find((p) => p.al.some((a) => a.length > 2 && txt.includes(' ' + a + ' ')))
    if (hit) return snap(hit, 'city', hit.n)
  }
  if (s <= 3) return { ...along(route, route.segs[0], 0), how: 'estimate', label: s <= 2 ? 'At supplier / agent' : 'Ready to ship', seg: 'wait' }
  if (s === 5) { const hub = route.stops.find((x) => x.k === 'hub'); return { ...along(route, last, 0.02), lat: hub.lat, lng: hub.lng, how: 'estimate', label: hub.n, seg: 'truck' } }
  return { ...along(route, last, 0.85), how: 'estimate', label: 'Out for delivery', seg: 'truck' }
}

// časť trasy, ktorú už prešiel
export function traveled(route, pos) {
  const i = pos.idx ?? 0
  return [...route.coords.slice(0, i), [pos.lng, pos.lat]]
}

export const STAGES = ['', 'Ordered', 'At agent', 'Shipped', 'In transit', 'In Europe', 'Out for delivery', 'Delivered']
export const MODES = { air: 'Air', express: 'Express', sea: 'Sea', rail: 'Rail', truck: 'Truck' }
const BASE_DAYS = { air: 10, express: 6, sea: 40, rail: 25, truck: 30 }

// odhad príchodu z tvojich minulých zásielok (rovnaký agent + spôsob)
export function eta(o, all) {
  if (o.eta) return { d: new Date(o.eta), how: 'set' }
  if (o.stage >= 7) return null
  const ev = o.track_events ?? []
  const start = ev.length ? new Date(ev[ev.length - 1].t) : null
  if (!start || isNaN(start)) return null
  const done = all.filter((x) => x.stage === 7 && x.mode === o.mode && (x.track_events ?? []).length > 1)
  const durs = (arr) => arr.map((x) => { const e = x.track_events; return (new Date(e[0].t) - new Date(e[e.length - 1].t)) / 864e5 }).filter((d) => d > 0.5 && d < 120)
  let days = durs(done.filter((x) => x.agent_id && x.agent_id === o.agent_id))
  let how = 'from your shipments with this agent'
  if (days.length < 2) { days = durs(done); how = 'from your past shipments' }
  let avg = days.length >= 2 ? days.reduce((a, b) => a + b, 0) / days.length : BASE_DAYS[o.mode] ?? 10
  if (days.length < 2) how = 'typical time – ' + (MODES[o.mode] ?? '').toLowerCase()
  return { d: new Date(start.getTime() + avg * 864e5), how, avg: Math.round(avg) }
}

// rozpoznanie čísel zásielok v ľubovoľnom texte
export function findTracking(text) {
  const re = /\b(1Z[0-9A-Z]{16}|[A-Z]{2}\d{9}[A-Z]{2}|(?:YT|YW|LP|SF|JD|UB|LX|EB|CJ|CNG|TBA)\d{9,18}|\d{10,22})\b/g
  return [...new Set([...(text ?? '').matchAll(re)].map((m) => m[1]))]
}

// ---------- „NPC“ doprava na mape (len pre pocit, že to tečie) ----------
export function npcRoutes() {
  const rot = { lat: 51.95, lng: 4.05 }, ham = PORTS.HAMP, duis = { lat: 51.43, lng: 6.76 }, ba = { lat: 48.15, lng: 17.11 }
  const air = planRoute({ mode: 'air', hub: 'LEJ' }, { lat: 22.64, lng: 113.81 }, ba)
  const airSeg = air.segs.find((x) => x.k === 'air')
  const air2 = planRoute({ mode: 'air', hub: 'FRA' }, { lat: 31.14, lng: 121.8 }, ba)
  const air2Seg = air2.segs.find((x) => x.k === 'air')
  const sea = planRoute({ mode: 'sea' }, { lat: 22.57, lng: 114.27 }, rot)
  const seaSeg = sea.segs.find((x) => x.k === 'ship')
  const rail = planRoute({ mode: 'rail' }, { lat: 34.27, lng: 108.94 }, duis)
  const railSeg = rail.segs.find((x) => x.k === 'train')
  return [
    { k: 'air', coords: air.coords.slice(airSeg.a, airSeg.b + 1), sec: 48, off: 0 },
    { k: 'air', coords: air2.coords.slice(air2Seg.a, air2Seg.b + 1), sec: 55, off: 0.5 },
    { k: 'ship', coords: sea.coords.slice(seaSeg.a, seaSeg.b + 1), sec: 140, off: 0.35 },
    { k: 'train', coords: rail.coords.slice(railSeg.a, railSeg.b + 1), sec: 90, off: 0.2 },
    { k: 'truck', coords: arc(EU_HUBS.LEJ, ba, 30), sec: 22, off: 0 },
    { k: 'truck', coords: arc(rot, duis, 10).concat(arc(duis, ba, 30).slice(1)), sec: 38, off: 0.6 },
    { k: 'truck', coords: arc(ham, ba, 30), sec: 30, off: 0.3 },
  ]
}
// bod na lomenej čiare podľa podielu dĺžky 0–1 (+ smer)
export function pointAt(coords, f) {
  if (!coords._len) { let L = 0; coords._cum = [0]; for (let i = 1; i < coords.length; i++) { L += dist({ lat: coords[i - 1][1], lng: coords[i - 1][0] }, { lat: coords[i][1], lng: coords[i][0] }); coords._cum.push(L) } coords._len = L }
  const t = f * coords._len
  let i = coords._cum.findIndex((c) => c >= t); if (i <= 0) i = 1
  const a = coords[i - 1], b = coords[i], seg = coords._cum[i] - coords._cum[i - 1] || 1
  const u = (t - coords._cum[i - 1]) / seg
  return { lng: a[0] + (b[0] - a[0]) * u, lat: a[1] + (b[1] - a[1]) * u, brg: bearing(a, b) }
}
