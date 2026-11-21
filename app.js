// KARGO – mobilná appka (mapa, zásielky, schvaľovanie, agent na počítači)
import * as G from './geo.js'

const SUPABASE_URL = 'https://xkmcohzferzcqgmcbynv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_EDk2wVXCJH8wH5I_AZCUkg_aXLlXdsr'
const VAPID_PUBLIC = 'BF7Z_yI2HCobMvr2IqaAA5JtKawWKZPYbdxVM_oLWfMsQDE8GPfaZh2sh3xjX8Hs-X1ZZdT8v1kswyhLiSgjM4A'
const FN = 'kargo-track'
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kargo-auth' } })

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' }) : ''
const fmtDT = (d) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const money = (v, c = 'USD') => v == null || v === '' ? '' : `${Number(v).toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${c === 'USD' ? '$' : c === 'EUR' ? '€' : c}`
const ago = (d) => { if (!d) return ''; const m = (Date.now() - new Date(d)) / 60000; return m < 1 ? 'now' : m < 60 ? `${Math.round(m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` }

const ICO = {
  air: '<svg viewBox="0 0 24 24"><path d="M12 2c.9 0 1.5.9 1.5 2v5.2l7.5 4.3v2l-7.5-2.2v4.4l2 1.5V21L12 20l-3.5 1v-1.8l2-1.5v-4.4L3 15.5v-2l7.5-4.3V4c0-1.1.6-2 1.5-2z"/></svg>',
  truck: '<svg viewBox="0 0 24 24"><path d="M2 6h11v9H2zM13 9h4.5L21 12.5V15h-8z"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
  ship: '<svg viewBox="0 0 24 24"><path d="M4 14h16l-2.5 5h-11zM7 13V8h10v5M10 8V5h4v3"/></svg>',
  train: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="13" rx="3"/><path d="M8 20l2-3h4l2 3" stroke="#fff" stroke-width="1.6" fill="none"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/></svg>',
  fac: '<svg class="i" viewBox="0 0 24 24" style="width:17px;height:17px"><path d="M3 21V10l6 4V10l6 4V5h6v16z"/></svg>',
  agent: '<svg class="i" viewBox="0 0 24 24" style="width:15px;height:15px;stroke:#60a5fa"><path d="M2 6h11v9H2zM13 9h4.5L21 12.5V15h-8z"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
}
const AP_CATS = {
  ack: ['Thanks / OK / received', 'Short acknowledgements'],
  ask_photos: ['Ask for photos / video', 'Before shipping'],
  send_address: ['Send agent address & shipping mark', 'When goods are ready'],
  ask_tracking: ['Ask for tracking / ship date', ''],
  follow_up: ['Polite follow-up', 'When they go quiet'],
  invoice_request: ['Invoice request', 'With your company details'],
  confirm_details: ['Confirm agreed details', 'No changes, just confirming'],
}
const AP_LOCKED = ['Price & negotiation', 'Payments & bank details', 'Quantity / order changes', 'Complaints', 'New suppliers', 'Anything unusual']
const ACC = () => getComputedStyle(document.documentElement).getPropertyValue('--route').trim() || '#ffffff'
const S = { msgs: {}, media: [], reqs: [], q: '', user: null, orders: [], places: [], threads: [], drafts: [], quotes: [], agent: null, tab: 'map', filt: 'active', tfilt: 'supplier', layers: { sup: true, agent: true, ship: true, allFac: false }, pick: null }

function toast(t, ms = 2600) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), ms) }
function sheet(html, onOpen) { $('#sheetBody').innerHTML = html; $('#sheet').classList.remove('hide'); $('#sheet .pan').scrollTop = 0; onOpen?.($('#sheetBody')) }
function closeSheet() { $('#sheet').classList.add('hide') }
$('#sheet .bg').onclick = closeSheet
async function fn(body) {
  const { data, error } = await sb.functions.invoke(FN, { body })
  if (error) { let m = error.message; try { m = (await error.context.json()).error ?? m } catch (_) {} throw new Error(m) }
  if (data?.error) throw new Error(data.error)
  return data
}
const copy = async (t, msg = 'Copied ✅') => { try { await navigator.clipboard.writeText(t); toast(msg) } catch (_) { prompt('Copy:', t) } }
document.addEventListener('click', (e) => { const c = e.target.closest('[data-copy]'); if (c) copy(c.dataset.copy) })

// ================= PRIHLÁSENIE (meno alebo email, zapamätané na tomto zariadení) =================
const toEmail = (u) => (u.includes('@') ? u : u.trim().toLowerCase() + '@kargo.app')
const CRED = 'kargo-remember'
const saveCred = (e, p) => { try { localStorage.setItem(CRED, btoa(unescape(encodeURIComponent(JSON.stringify([e, p]))))) } catch (_) {} }
const loadCred = () => { try { return JSON.parse(decodeURIComponent(escape(atob(localStorage.getItem(CRED) ?? '')))) } catch (_) { return null } }
async function needsCode() {
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
  return data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2'
}
function showLogin(step = 1, msg = '') {
  $('#app').classList.add('hide'); $('#login').classList.remove('hide')
  $('#lStep1').classList.toggle('hide', step !== 1); $('#lStep2').classList.toggle('hide', step !== 2)
  if (msg) $('#lMsg').textContent = msg
  if (step === 2) setTimeout(() => $('#lCode').focus(), 50)
}
$('#lVerify').onclick = async () => {
  const { data: f } = await sb.auth.mfa.listFactors()
  const t = (f?.totp ?? [])[0]
  if (!t) return location.reload()
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: t.id, code: $('#lCode').value.replace(/\D/g, '') })
  if (error) return ($('#lMsg').textContent = '❌ Wrong code')
  location.reload()
}
$('#lCode').oninput = (e) => { if (e.target.value.replace(/\D/g, '').length === 6) $('#lVerify').click() }
async function boot() {
  let { data: { session } } = await sb.auth.getSession()
  if (!session) {
    // automatické prihlásenie uloženým menom a heslom
    const c = loadCred()
    if (c) { const r = await sb.auth.signInWithPassword({ email: c[0], password: c[1] }); session = r.data?.session ?? null }
  }
  if (!session) return showLogin(1)
  if (await needsCode()) return showLogin(2)
  S.user = session.user
  $('#login').classList.add('hide'); $('#app').classList.remove('hide')
  await loadAll()
  const q = new URLSearchParams(location.search)
  go(q.get('tab') ?? 'map')
  if (q.get('o')) openOrder(q.get('o'))
  if (q.get('p')) openPlace(q.get('p'))
  if (q.get('add')) openAdd(q.get('add'))
  history.replaceState(null, '', location.pathname)
  realtime()
  setInterval(pollLight, 15000)
}
$('#lGo').onclick = async () => {
  const e = toEmail($('#lEmail').value.trim()), p = $('#lPass').value
  $('#lMsg').textContent = 'Signing in…'
  const { error } = await sb.auth.signInWithPassword({ email: e, password: p })
  if (error) return ($('#lMsg').textContent = '❌ ' + (/invalid/i.test(error.message) ? 'Wrong name or password' : error.message))
  saveCred(e, p)
  if (await needsCode()) return showLogin(2, 'One more step.')
  location.reload()
}
$('#lPass').onkeydown = (ev) => { if (ev.key === 'Enter') $('#lGo').click() }

// ================= DÁTA =================
async function loadAll() {
  const [o, p, t, d, q, a, rq, md] = await Promise.all([
    sb.from('kargo_orders').select('*').order('created_at', { ascending: false }),
    sb.from('kargo_places').select('*').order('name'),
    sb.from('kargo_threads').select('id,ext_id,partner,company,kind,place_id,archived,last_at,last_text,last_from_me,summary').order('last_at', { ascending: false }),
    sb.from('kargo_drafts').select('*').order('created_at', { ascending: false }).limit(60),
    sb.from('kargo_quotes').select('*').order('created_at', { ascending: false }).limit(20),
    sb.from('kargo_agent').select('*').maybeSingle(),
    sb.from('kargo_requests').select('*').order('created_at', { ascending: false }).limit(30),
    sb.from('kargo_media').select('*').order('created_at', { ascending: false }).limit(200),
  ])
  const missing = [o, p, t, d, q, a].find((r) => r.error && /does not exist|schema cache|Could not find/i.test(r.error.message))
  if (missing) { S.dbMissing = true; toast('🚧 Database not ready yet – run supabase-kargo.sql', 6000) }
  S.orders = o.data ?? []; S.places = p.data ?? []; S.threads = t.data ?? []; S.drafts = d.data ?? []; S.quotes = q.data ?? []; S.agent = a.data ?? null; S.reqs = rq.data ?? []; S.media = md.data ?? []
  S.home = S.places.find((x) => x.kind === 'home') ?? null
  renderAll()
}
async function pollLight() {
  const [d, a] = await Promise.all([sb.from('kargo_drafts').select('*').order('created_at', { ascending: false }).limit(60), sb.from('kargo_agent').select('*').maybeSingle()])
  if (d.data) S.drafts = d.data
  if (a.data) S.agent = a.data
  renderBadge(); renderAgentPill()
  if (S.tab === 'msg' && !document.activeElement?.closest?.('#v-msg')) renderMsg()
  if (S.tab === 'agent') renderAgent()
  if (S.tab === 'src' && S.reqs.some((r) => r.status === 'new' || r.status === 'searching')) { const { data } = await sb.from('kargo_requests').select('*').order('created_at', { ascending: false }).limit(30); if (data) { S.reqs = data; if (!document.activeElement?.closest?.('#v-src')) renderSrc() } }
}
function realtime() {
  try {
    sb.channel('kargo').on('postgres_changes', { event: '*', schema: 'public', table: 'kargo_drafts' }, () => pollLight())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kargo_media' }, (p) => { S.media = [p.new, ...S.media]; toast('📸 New ' + (p.new.kind === 'video' ? 'video' : 'photo') + ' from ' + (placeById(p.new.place_id)?.name ?? 'a factory')); if (S.tab === 'ship' && !S.q) renderShip() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kargo_agent' }, (p) => { S.agent = p.new; renderAgentPill(); if (S.tab === 'agent') { liveSub(true); if (!document.activeElement?.closest?.('#v-agent')) renderAgent() } }).subscribe()
  } catch (_) {}
}
const placeById = (id) => S.places.find((p) => p.id === id)
const active = (o) => !o.archived && (o.stage ?? 1) < 7

function renderAll() { renderBadge(); renderAgentPill(); if (S.map) drawMap(); renderShip(); if (S.tab === 'msg') renderMsg(); if (S.tab === 'agent') renderAgent() }
function renderBadge() { const n = S.drafts.filter((d) => d.status === 'pending').length; $('#badge').textContent = n; $('#badge').classList.toggle('hide', !n) }
const agentOnline = () => S.agent?.online_at && Date.now() - new Date(S.agent.online_at) < 150000
function renderAgentPill() {
  $('#agentDot').classList.toggle('on', !!agentOnline())
  $('#agentTxt').textContent = agentOnline() ? (S.agent.paused ? 'Paused' : 'Agent running') : 'Agent offline'
}
$('#agentPill').onclick = () => go('agent')

// ================= TABY =================
const TITLES = { map: 'Map', ship: 'Shipments', src: 'Sourcing', msg: 'Approve', agent: 'Agent' }
function go(tab) {
  if (S.tab === 'agent' && tab !== 'agent') setLive(false)
  S.tab = tab
  $$('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab))
  $$('.view').forEach((v) => v.classList.toggle('hide', v.id !== 'v-' + tab))
  $('#title').textContent = TITLES[tab]
  document.body.classList.toggle('onmap', tab === 'map')
  if (tab === 'map') { initMap(); setTimeout(() => S.map?.resize(), 50) }
  if (tab === 'ship') renderShip()
  if (tab === 'msg') renderMsg()
  if (tab === 'src') renderSrc()
  if (tab === 'agent') { renderAgent(); setLive(true) }
}
$$('nav button').forEach((b) => (b.onclick = () => go(b.dataset.tab)))
document.addEventListener('visibilitychange', () => { if (document.hidden) setLive(false); else { if (S.tab === 'agent') setLive(true); pollLight() } })

// ================= MAPA =================
const VIEWS = { world: { center: [78, 34], zoom: 1.6 }, china: { center: [116.5, 28.5], zoom: 4.1 }, europe: { center: [12, 50], zoom: 4.6 } }
const fly = (k, duration = 900) => { const v = VIEWS[k]; const narrow = innerWidth < 600; S.map.flyTo({ center: v.center, zoom: v.zoom - (narrow ? 0.4 : 0), duration }) }
function initMap() {
  if (S.map) return
  S.map = new maplibregl.Map({ container: 'map', style: 'https://tiles.openfreemap.org/styles/dark', center: [62, 36], zoom: 1.5, attributionControl: { compact: true } })
  // ak by tmavý štýl nešiel, prepni na bežnú mapu
  let fallback = false
  S.map.on('error', () => { if (!S.map.isStyleLoaded() && !fallback) { fallback = true; S.map.setStyle('https://tiles.openfreemap.org/styles/liberty') } })
  S.map.on('style.load', () => {
    try { S.map.setProjection({ type: 'globe' }) } catch (_) {}
    // názvy po slovensky / anglicky (nie čínske znaky), výraznejšie hranice štátov
    for (const l of S.map.getStyle().layers) {
      try {
        if (l.type === 'symbol' && S.map.getLayoutProperty(l.id, 'text-field')) S.map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:sk'], ['get', 'name:en'], ['get', 'name_en'], ['get', 'name_int'], ['get', 'name']])
        if (l.type === 'line' && /boundary|admin/.test(l.id)) {
          const country = !/state|province|admin_sub|level_4|4/.test(l.id)
          S.map.setPaintProperty(l.id, 'line-color', country ? '#9aa3b2' : '#4b5563')
          S.map.setPaintProperty(l.id, 'line-opacity', country ? 0.85 : 0.5)
        }
      } catch (_) {}
    }
    try { S.map.setSky({ 'sky-color': '#0b2350', 'horizon-color': '#9cc8ff', 'fog-color': '#05060a', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.4, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] }) } catch (_) {}
    S.map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    S.map.addLayer({ id: 'plan', type: 'line', source: 'routes', filter: ['==', ['get', 'k'], 'plan'], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-dasharray': [1.5, 2.5], 'line-opacity': 0.75 } })
    S.map.addSource('npc', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    S.map.addLayer({ id: 'npc', type: 'line', source: 'npc', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.18, 'line-dasharray': [1, 3] } })
    S.map.addLayer({ id: 'glow', type: 'line', source: 'routes', filter: ['==', ['get', 'k'], 'done'], layout: { 'line-cap': 'round' }, paint: { 'line-color': ACC(), 'line-width': 9, 'line-blur': 6, 'line-opacity': 0.45 } })
    S.map.addLayer({ id: 'done', type: 'line', source: 'routes', filter: ['==', ['get', 'k'], 'done'], layout: { 'line-cap': 'round' }, paint: { 'line-color': ACC(), 'line-width': 3 } })
    drawMap()
    setTimeout(() => fly('world', 0), 50)
  })
  S.map.on('click', (e) => {
    if (!S.pick) return
    const cb = S.pick; S.pick = null; cb(e.lngLat.lat, e.lngLat.lng)
  })
  $$('.mapbar [data-view]').forEach((p) => (p.onclick = () => { $$('.mapbar [data-view]').forEach((x) => x.classList.toggle('on', x === p)); fly(p.dataset.view) }))
  if ($('#planB')) $('#planB').onclick = planner
  $$('.mapbar [data-layer]').forEach((p) => { p.classList.toggle('on', S.layers[p.dataset.layer]); p.onclick = () => { S.layers[p.dataset.layer] = !S.layers[p.dataset.layer]; p.classList.toggle('on'); drawMap() } })
}
function originOf(o) {
  const a = placeById(o.agent_id), s = placeById(o.supplier_id)
  const p = (a?.lat && a) || (s?.lat && s)
  return p ? { lat: p.lat, lng: p.lng, name: p.name } : null
}
function homeOf() { return S.home?.lat ? { lat: S.home.lat, lng: S.home.lng, name: S.home.name } : null }
function shipGeo(o) {
  const route = G.planRoute(o, originOf(o), homeOf())
  let pos = G.locate(o, route)
  // skutočné lietadlo / loď naživo (číslo letu alebo názov lode)
  const lp = o.live_pos
  if (lp?.lat != null && Date.now() - new Date(lp.at) < 20 * 60000 && (o.stage ?? 1) < 6) {
    let bi = 0, bd = 1e12
    route.coords.forEach((c, i) => { const d = G.dist({ lat: c[1], lng: c[0] }, lp); if (d < bd) { bd = d; bi = i } })
    pos = { lat: lp.lat, lng: lp.lng, brg: lp.brg ?? 0, idx: bi, seg: lp.src === 'aisstream.io' ? 'ship' : 'air', how: 'live', label: lp.label }
  }
  return { route, pos, done: G.traveled(route, pos) }
}
function drawMap() {
  const m = S.map
  if (!m || !m.getSource('routes')) return
  ;(S.markers ?? []).forEach((x) => x.remove())
  S.markers = []
  const add = (el, lat, lng, on, opt = {}) => { if (lat == null || lng == null) return; el.onclick = (e) => { e.stopPropagation(); on() }; S.markers.push(new maplibregl.Marker({ element: el, ...opt }).setLngLat([lng, lat]).addTo(m)) }
  const feats = []
  const ships = []
  if (S.layers.ship) for (const o of S.orders.filter(active).filter((o) => o.tracking_no || o.stage >= 3)) {
    const g = shipGeo(o)
    feats.push({ type: 'Feature', properties: { k: 'plan' }, geometry: { type: 'LineString', coordinates: g.route.coords } })
    if (g.done.length > 1) feats.push({ type: 'Feature', properties: { k: 'done' }, geometry: { type: 'LineString', coordinates: g.done } })
    ships.push([o, g])
  }
  m.getSource('routes').setData({ type: 'FeatureCollection', features: feats })
  const activeSup = new Set(S.orders.filter(active).flatMap((o) => [o.supplier_id, o.agent_id]).filter(Boolean))
  for (const p of S.places) {
    if (p.lat == null) continue
    if (p.kind === 'supplier' && !S.layers.allFac && !activeSup.has(p.id)) continue
    if (p.kind === 'home') { const el = document.createElement('div'); el.className = 'mk home'; add(el, p.lat, p.lng, () => openPlace(p.id)); continue }
    if (p.kind === 'agent' || p.kind === 'warehouse') { if (!S.layers.agent) continue; const el = document.createElement('div'); el.className = 'mk agent'; el.innerHTML = ICO.agent; add(el, p.lat, p.lng, () => openPlace(p.id)); continue }
    if (!S.layers.sup) continue
    const img = p.image_url ?? S.orders.find((o) => o.supplier_id === p.id && o.image_url)?.image_url
    const el = document.createElement('div'); el.className = 'mk' + (img ? '' : ' fac')
    if (img) el.style.backgroundImage = `url("${img}")`; else el.innerHTML = ICO.fac
    add(el, p.lat, p.lng, () => openPlace(p.id))
  }
  if (!S.home) { const el = document.createElement('div'); el.className = 'mk home'; add(el, G.DEFAULT_HOME.lat, G.DEFAULT_HOME.lng, () => openSettings()) }
  // vozidlá navrch
  for (const [o, g] of ships) {
    const seg = g.pos.seg
    const kind = seg === 'air' ? 'air' : seg === 'ship' ? 'ship' : seg === 'train' ? 'train' : seg === 'wait' ? 'box' : 'truck'
    const el = document.createElement('div')
    el.className = 'veh' + (seg === 'wait' ? ' wait' : '') + (g.pos.how === 'live' ? ' onair' : '')
    el.innerHTML = ICO[kind] + `<span class="vlab">${esc(o.title.slice(0, 22))}${g.pos.how === 'live' ? ' · ' + esc(o.flight || o.vessel || 'live') : ''}</span>`
    const rot = kind === 'air' ? { rotation: g.pos.brg ?? 0, rotationAlignment: 'map' } : {}
    if (kind === 'air') el.querySelector('.vlab').style.transform = `translateX(-50%) rotate(${-(g.pos.brg ?? 0)}deg)`
    add(el, g.pos.lat, g.pos.lng, () => openOrder(o.id), rot)
  }
  startNpc(ships)
}
// NPC doprava: lietadlá, loď, vlak, kamióny – len keď reálne nič takto nejde (a pri 4+ zásielkach na ceste vôbec)
function startNpc(ships) {
  ;(S.npc ?? []).forEach((n) => n.m.remove())
  S.npc = []
  cancelAnimationFrame(S.npcRaf)
  const m = S.map
  const moving = ships.filter(([, g]) => ['air', 'ship', 'train', 'truck'].includes(g.pos.seg))
  if (moving.length >= 4) return
  const real = new Set(moving.map(([, g]) => g.pos.seg))
  const feats = []
  for (const r of G.npcRoutes()) {
    if (real.has(r.k)) continue
    const el = document.createElement('div')
    el.className = 'veh npc'
    el.innerHTML = ICO[r.k === 'air' ? 'air' : r.k]
    const mk = new maplibregl.Marker({ element: el, rotationAlignment: r.k === 'air' ? 'map' : 'viewport' }).setLngLat(r.coords[0]).addTo(m)
    S.npc.push({ m: mk, r })
    feats.push({ type: 'Feature', properties: { k: 'npc' }, geometry: { type: 'LineString', coordinates: r.coords } })
  }
  if (m.getSource('npc')) m.getSource('npc').setData({ type: 'FeatureCollection', features: feats })
  const t0 = performance.now()
  let last = 0
  const tick = (now) => {
    S.npcRaf = requestAnimationFrame(tick)
    if (now - last < 40 || S.tab !== 'map') return
    last = now
    for (const n of S.npc) {
      const f = (((now - t0) / 1000 / n.r.sec) + n.r.off) % 1
      const p = G.pointAt(n.r.coords, f)
      n.m.setLngLat([p.lng, p.lat])
      if (n.r.k === 'air') n.m.setRotation(p.brg)
    }
  }
  S.npcRaf = requestAnimationFrame(tick)
}
function showOnMap(lat, lng, z = 6) { go('map'); setTimeout(() => S.map?.flyTo({ center: [lng, lat], zoom: z, duration: 1200 }), 200) }

// ================= ZÁSIELKY =================
function renderShip() {
  const v = $('#v-ship')
  const os = S.orders
  const F = { active: (o) => active(o), china: (o) => active(o) && o.stage <= 3, way: (o) => active(o) && o.stage === 4, eu: (o) => active(o) && o.stage >= 5, done: (o) => o.stage >= 7 && !o.archived, ship: (o) => o.order_kind === 'shipping' && !o.archived, all: (o) => !o.archived, arch: (o) => o.archived }
  const N = { active: 'Active', china: 'In China', way: 'In transit', eu: 'In Europe', done: 'Delivered', ship: 'Shipping', all: 'All', arch: 'Archive' }
  const list = os.filter(F[S.filt])
  const month = new Date().toISOString().slice(0, 7)
  const spent = os.filter((o) => (o.ordered_at ?? o.created_at ?? '').slice(0, 7) === month).reduce((a, o) => a + (landed(o)?.total ?? 0), 0)
  const stuck = os.filter((o) => active(o) && o.stage >= 3 && o.last_event_at && Date.now() - new Date(o.last_event_at) > 5 * 864e5)
  const delivered = os.filter((o) => o.stage >= 7 && o.delivered_ok == null && !o.archived && o.order_kind !== 'shipping' && Date.now() - new Date(o.last_event_at ?? o.created_at) < 30 * 864e5)
  const waiting = os.filter((o) => !o.archived && o.order_kind !== 'shipping' && (o.stage ?? 1) <= 2 && !o.tracking_no)
  if (S.q) return renderSearch(v)
  v.innerHTML = `
  <div class="search"><svg class="i" viewBox="0 0 24 24" style="color:var(--mut)"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="qBox" placeholder="Search everything – product, factory, chat…" value="${esc(S.q)}"></div>
  <div class="stats">
    <div class="stat"><b>${os.filter(active).length}</b><small>active</small></div>
    <div class="stat"><b>${os.filter((o) => active(o) && o.stage >= 4).length}</b><small>in transit</small></div>
    <div class="stat"><b>${spent ? usd(spent) : '–'}</b><small>this month</small></div>
  </div>
  ${S.media.length ? `<div class="sec"><span>Live from factories</span><span class="small muted" style="flex:none">${ago(S.media[0].created_at)}</span></div><div class="chips" style="gap:8px">${S.media.slice(0, 16).map((m) => `<div data-m="${m.id}" style="flex:none;width:84px;height:84px;border-radius:16px;overflow:hidden;position:relative;background:var(--card2);cursor:pointer">${m.kind === 'video' ? `<video src="${esc(m.url)}#t=0.5" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover"></video><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px">▶</span>` : `<img src="${esc(m.url)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">`}</div>`).join('')}</div>` : ''}
  ${stuck.length ? `<div class="card" style="background:rgba(251,191,36,.08)"><b style="color:var(--warn)">${stuck.length} ${stuck.length === 1 ? 'parcel' : 'parcels'} not moving</b><div class="small muted">${stuck.map((o) => esc(o.title)).join(', ')} – no movement for 5+ days</div></div>` : ''}
  ${delivered.map((o) => `<div class="card"><div class="row"><b style="flex:3">Did “${esc(o.title)}” arrive OK?</b></div><div class="row" style="margin-top:10px"><button class="btn bad sm" data-dbad="${o.id}">Problem</button><button class="btn ok sm" data-dok="${o.id}">Yes, all good</button></div></div>`).join('')}
  ${waiting.length >= 2 ? `<div class="card"><b>Combine into one shipment?</b><div class="small muted" style="margin-top:4px">${waiting.length} orders are still waiting to ship: ${waiting.map((o) => esc(o.title)).join(', ')}. Shipping together gets a lower price per kg.</div><button class="btn ghost sm" id="consB" style="margin-top:10px;width:100%">Ask agents for a price for everything together</button></div>` : ''}
  <button class="btn ghost" id="curB" style="width:100%;margin-top:12px">Choose what I’m working on (${os.filter(active).length} active)</button>
  <div class="row" style="margin-top:8px"><button class="btn acc" id="addBtn">Add order</button><button class="btn ghost" id="refBtn" style="flex:.7">Refresh</button></div>
  <div class="chips" style="margin-top:12px">${Object.keys(F).map((k) => `<span class="chip ${S.filt === k ? 'on' : ''}" data-f="${k}">${N[k]}<b>${os.filter(F[k]).length}</b></span>`).join('')}</div>
  ${list.length ? list.map(orderCard).join('') : `<div class="empty">${os.length ? 'Nothing in this filter' : 'No orders yet.<br>Add an Alibaba link or start the Agent on your PC – it pulls everything in.'}</div>`}
  <div class="sec"><span>Factories & agents</span><button class="btn sm ghost" id="addPl">Add place</button></div>
  ${S.places.filter((p) => p.kind !== 'home').map(placeCard).join('') || '<div class="muted small">No places.</div>'}`
  $$('.chip', v).forEach((c) => (c.onclick = () => { S.filt = c.dataset.f; renderShip() }))
  $$('[data-o]', v).forEach((c) => (c.onclick = () => openOrder(c.dataset.o)))
  $$('[data-p]', v).forEach((c) => (c.onclick = () => openPlace(c.dataset.p)))
  bindGallery(v)
  $('#addBtn').onclick = () => openAdd()
  $('#curB', v).onclick = curate
  $('#qBox', v).oninput = (e) => { S.q = e.target.value; if (S.q.length >= 2) { renderShip(); const q = $('#qBox'); q.focus(); q.setSelectionRange(99, 99) } }
  $$('[data-dok]', v).forEach((b) => (b.onclick = async () => { await sb.from('kargo_orders').update({ delivered_ok: true }).eq('id', b.dataset.dok); toast('Super ✅'); loadAll() }))
  $$('[data-dbad]', v).forEach((b) => (b.onclick = () => complaint(b.dataset.dbad)))
  if ($('#consB', v)) $('#consB', v).onclick = () => newQuote({ title: 'Together: ' + waiting.map((o) => o.title).join(', '), weight: waiting.reduce((a, o) => a + (Number(o.weight_kg) || 0), 0) || '' })
  $('#addPl').onclick = () => editPlace()
  $('#refBtn').onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Checking…'; try { const r = await fn({ action: 'refresh' }); toast(`Checked ${r.checked ?? 0}, changed ${r.changed ?? 0}${r.errors?.length ? ' · ' + r.errors[0] : ''}`, 4500); await loadAll() } catch (err) { toast('❌ ' + err.message, 5000) } e.target.disabled = false; e.target.textContent = 'Refresh' }
}
// ---------- výber aktívnych objednávok ----------
const WORKING = 'gym, fitness, slippers, bathrobe, robe, paper cards, sewing kit, shoe cleaner, thermos, cups, mugs'
function curate() {
  const old = (o) => (o.stage ?? 1) >= 7 || (Date.now() - new Date(o.ordered_at ?? o.created_at) > 150 * 864e5 && !o.tracking_no)
  const list = [...S.orders].filter((o) => o.order_kind !== 'shipping').sort((a, b) => String(b.ordered_at ?? b.created_at).localeCompare(String(a.ordered_at ?? a.created_at)))
  const words = (S.workingOn ?? localStorage.getItem('kargo-working') ?? WORKING)
  sheet(`<h2 style="margin:4px 0 8px">What are you working on?</h2>
  <div class="small muted">Only these show as active, on the map and in planning. Everything else is archived (nothing is deleted).</div>
  <label class="f">Keywords (match product names)</label><input class="in" id="cuW" value="${esc(words)}">
  <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="cuMatch">Tick by keywords</button><button class="btn ghost sm" id="cuNone">Untick all</button></div>
  <div class="card" style="padding:4px 14px;margin-top:12px">${list.map((o) => `<label class="row" style="padding:9px 0;border-bottom:1px solid var(--line);gap:10px;justify-content:flex-start"><input type="checkbox" class="cuX" value="${o.id}" ${!o.archived && !old(o) ? 'checked' : ''} style="width:22px;height:22px;flex:none"><div class="ph" style="width:40px;height:40px;border-radius:10px;flex:none;background:var(--card2) ${o.image_url ? `url('${esc(o.image_url)}') center/cover` : ''}"></div><div style="flex:1;min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.title)}</div><div class="small muted">${esc(placeById(o.supplier_id)?.name ?? o.supplier ?? '')} · ${o.ordered_at ? DAYS(o.ordered_at) : 'planned'} · ${G.STAGES[o.stage ?? 1]}</div></div></label>`).join('') || '<div class="muted small" style="padding:10px 0">No orders yet.</div>'}</div>
  <label class="f">Add something you’re about to order (e.g. cups)</label>
  <div class="row"><input class="in" id="cuNew" placeholder="Product"><button class="btn ghost sm" id="cuAdd" style="flex:none">Add</button></div>
  <button class="btn acc" id="cuSave" style="width:100%;margin-top:14px">Save</button>`, (b) => {
    const match = () => { const ws = $('#cuW', b).value.toLowerCase().split(',').map((x) => x.trim()).filter((x) => x.length > 2); $$('.cuX', b).forEach((c) => { const o = S.orders.find((x) => x.id === c.value); const t = `${o.title} ${o.supplier ?? ''}`.toLowerCase(); c.checked = ws.some((w) => w.split(/\s+/).every((p) => t.includes(p))) && (o.stage ?? 1) < 7 }) }
    $('#cuMatch', b).onclick = match
    $('#cuNone', b).onclick = () => $$('.cuX', b).forEach((c) => (c.checked = false))
    $('#cuAdd', b).onclick = async () => { const t = $('#cuNew', b).value.trim(); if (!t) return; const { data } = await sb.from('kargo_orders').insert({ title: t, planned: true, stage: 1, user_set: true, archived: false, mode: 'air', hub: 'LEJ' }).select().single(); if (data) { S.orders.push(data); toast('Added'); curate() } }
    $('#cuSave', b).onclick = async () => {
      localStorage.setItem('kargo-working', $('#cuW', b).value)
      const on = new Set($$('.cuX:checked', b).map((c) => c.value))
      const ids = list.map((o) => o.id)
      const act = ids.filter((id) => on.has(id)), arc = ids.filter((id) => !on.has(id))
      if (act.length) await sb.from('kargo_orders').update({ archived: false, user_set: true }).in('id', act)
      if (arc.length) await sb.from('kargo_orders').update({ archived: true, user_set: true }).in('id', arc)
      closeSheet(); toast(`${act.length} active · ${arc.length} archived`); loadAll()
    }
  })
}
const DAYS = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
// ---------- plánovanie: čo spojiť a ktorému agentovi poslať ----------
function feeFor(agent, fac) {
  if (!agent || !fac) return null
  const near = agent.lat != null && fac.lat != null ? G.dist(agent, fac) < 90 : (agent.city && fac.city && agent.city.toLowerCase() === fac.city.toLowerCase())
  const v = near ? agent.transfer_local : agent.transfer_other
  return v == null ? null : +v
}
function planner() {
  const pend = S.orders.filter((o) => active(o) && o.order_kind !== 'shipping' && (o.stage ?? 1) <= 2 && !o.tracking_no)
  const items = pend.map((o) => ({ o, p: placeById(o.supplier_id) }))
  const loc = items.filter((x) => x.p?.lat != null), noLoc = items.filter((x) => x.p?.lat == null)
  const clusters = []
  for (const x of loc) { const c = clusters.find((c) => G.dist(c.center, x.p) < 350); if (c) c.items.push(x); else clusters.push({ center: { lat: x.p.lat, lng: x.p.lng }, name: x.p.city || x.p.name, items: [x] }) }
  clusters.sort((a, b) => b.items.length - a.items.length)
  const agents = S.places.filter((p) => p.kind === 'agent')
  const rank = (its) => agents.map((a) => { const fees = its.map((x) => feeFor(a, x.p)); const known = fees.every((f) => f != null); return { a, fees, total: known ? fees.reduce((s, f) => s + f, 0) : null } }).sort((x, y) => (x.total ?? 1e9) - (y.total ?? 1e9))
  const groups = [...clusters.map((c) => ({ name: `${c.name} area`, items: c.items, center: c.center })), ...(clusters.length > 1 ? [{ name: 'Everything together', items: loc }] : [])]
  sheet(`<h2 style="margin:4px 0 8px">Plan a shipment</h2>
  <div class="small muted">Active orders still at the factory, grouped by area. Agents are ranked by the transfer fee to bring everything to their warehouse.</div>
  ${!items.length ? '<div class="empty">No active orders waiting at factories.<br>Use “Choose what I’m working on” in Shipments.</div>' : ''}
  ${groups.map((g, gi) => { const r = rank(g.items); return `<div class="card">
    <div class="row"><b style="flex:3">${esc(g.name)} · ${g.items.length} order${g.items.length > 1 ? 's' : ''}</b>${g.center ? `<a href="#" data-fly="${gi}" class="small" style="text-align:right">Map</a>` : ''}</div>
    ${g.items.map((x) => `<div class="row small" style="gap:8px;justify-content:flex-start;margin-top:8px"><div style="width:34px;height:34px;border-radius:9px;flex:none;background:var(--card2) ${x.o.image_url ? `url('${esc(x.o.image_url)}') center/cover` : ''}"></div><div style="flex:1;min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.o.title)}</div><div class="muted">${esc(x.p?.name ?? '')}${x.p?.city ? ' · ' + esc(x.p.city) : ''}</div></div></div>`).join('')}
    <table class="qtab" style="margin-top:10px"><tr><th>Agent</th><th>Warehouse</th><th>Transfer fees</th></tr>${r.map((x, i) => `<tr class="${i === 0 && x.total != null ? 'best' : ''}"><td>${esc(x.a.name)}</td><td>${esc(x.a.city ?? '?')}</td><td>${x.total != null ? usd(x.total) + ` <span class="muted" style="font-weight:400">(${x.fees.map((f) => '$' + f).join(' + ')})</span>` : '<span class="muted">set fees</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No agents yet – mark Sasha / Canny as agent in their chat.</td></tr>'}</table>
    <button class="btn acc sm" data-ask="${gi}" style="width:100%;margin-top:10px">Ask agents for a quote</button>
  </div>` }).join('')}
  ${noLoc.length ? `<div class="card small"><b>Without location</b> – set the factory city to plan these: ${noLoc.map((x) => `<a href="#" data-p="${x.p?.id ?? ''}">${esc(x.o.title)}</a>`).join(', ')}</div>` : ''}`, (b) => {
    $$('[data-fly]', b).forEach((a) => (a.onclick = (e) => { e.preventDefault(); const g = groups[+a.dataset.fly]; closeSheet(); showOnMap(g.center.lat, g.center.lng, 6) }))
    $$('[data-p]', b).forEach((a) => (a.onclick = (e) => { e.preventDefault(); if (a.dataset.p) openPlace(a.dataset.p) }))
    $$('[data-ask]', b).forEach((bt) => (bt.onclick = () => {
      const g = groups[+bt.dataset.ask]; const r = rank(g.items)
      const cities = [...new Set(g.items.map((x) => x.p?.city).filter(Boolean))]
      newQuote({ title: g.items.map((x) => x.o.title).join(', '), weight: g.items.reduce((s, x) => s + (Number(x.o.weight_kg) || 0), 0) || '', note: `Pickup from ${g.items.length} factories (${cities.join(', ')}). Quote transfer fee factory → your warehouse for each, plus air DDP to Slovakia per kg.`, agents: r.slice(0, 3).map((x) => x.a.id) })
    }))
  })
}
function renderSearch(v) {
  const q = S.q.toLowerCase()
  const hit = (...xs) => xs.some((x) => String(x ?? '').toLowerCase().includes(q))
  const os = S.orders.filter((o) => hit(o.title, o.supplier, o.qty, o.note, o.tracking_no, o.alibaba_no, placeById(o.supplier_id)?.name))
  const ps = S.places.filter((p) => hit(p.name, p.city, p.note, p.contact, p.address_en))
  const ts = S.threads.filter((t) => hit(t.company, t.partner, t.summary, t.last_text))
  v.innerHTML = `<div class="search"><svg class="i" viewBox="0 0 24 24" style="color:var(--mut)"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="qBox" value="${esc(S.q)}"><span id="qX" style="color:var(--mut);padding:8px">Cancel</span></div>
  ${os.length ? `<div class="sec"><span>Orders</span></div>${os.slice(0, 20).map(orderCard).join('')}` : ''}
  ${ps.length ? `<div class="sec"><span>Factories & agents</span></div>${ps.slice(0, 20).map(placeCard).join('')}` : ''}
  ${ts.length ? `<div class="sec"><span>Conversations</span></div>${ts.slice(0, 20).map((t) => `<div class="card ord" data-th="${t.id}"><div class="bd"><div class="t">${esc(t.company || t.partner)}</div><div class="s">${esc(t.summary ?? t.last_text ?? '')}</div></div></div>`).join('')}` : ''}
  ${!os.length && !ps.length && !ts.length ? '<div class="empty">Nothing found.</div>' : ''}`
  $('#qBox', v).oninput = (e) => { S.q = e.target.value; renderShip(); const x = $('#qBox'); x.focus(); x.setSelectionRange(99, 99) }
  $('#qX', v).onclick = () => { S.q = ''; renderShip() }
  $$('[data-o]', v).forEach((c) => (c.onclick = () => openOrder(c.dataset.o)))
  $$('[data-p]', v).forEach((c) => (c.onclick = () => openPlace(c.dataset.p)))
  $$('[data-th]', v).forEach((c) => (c.onclick = () => openThread(c.dataset.th)))
}
async function uploadFiles(files, prefix) {
  const out = []
  for (const f of [...files].slice(0, 8)) {
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `${S.user.id}/${prefix}-${Date.now()}-${out.length}.${ext}`
    const { error } = await sb.storage.from('kargo').upload(path, f, { contentType: f.type || 'image/jpeg' })
    if (!error) out.push(sb.storage.from('kargo').getPublicUrl(path).data.publicUrl)
  }
  return out
}
function vetCard(p) {
  const v = p.vetting ?? {}
  if (p.vet_status === 'ask' || p.vet_status === 'checking') return `<div class="card small"><span class="tag acc">${p.vet_status === 'checking' ? 'Checking now…' : 'Waiting for agent'}</span> Factory check</div>`
  if (p.vet_status !== 'done') return `<div class="card"><b>Factory check</b><div class="small muted" style="margin:4px 0 10px">Profile, verification, years, real factory vs trader, and public complaints online.</div><button class="btn sm acc" id="vetB" style="width:100%">Check this factory</button>${v.error ? `<div class="small" style="color:var(--bad);margin-top:6px">${esc(v.error)}</div>` : ''}</div>`
  const col = { green: 'var(--ok)', yellow: 'var(--warn)', red: 'var(--bad)' }[v.verdict] ?? 'var(--mut)'
  const f = v.facts ?? {}
  const rows = [['Type', f.type], ['Years', f.founded_or_years], ['Verification', f.verification], ['Employees', f.employees], ['Factory', f.factory_size], ['Location', f.location], ['Transactions', f.transactions], ['Response', f.response_rate], ['On-time', f.on_time], ['Rating', f.rating], ['Certificates', f.certificates]].filter(([, x]) => x)
  return `<div class="card" style="border:1px solid ${col}33">
    <div class="row"><b style="color:${col};flex:3">${{ green: 'Looks solid', yellow: 'OK with caution', red: 'Red flags' }[v.verdict] ?? 'Checked'}</b><span style="text-align:right;font-weight:700;font-size:20px;color:${col}">${v.score ?? ''}</span></div>
    <div class="small" style="margin-top:6px">${esc(v.summary ?? '')}</div>
    ${(v.risks ?? []).length ? `<div class="small" style="margin-top:8px">${v.risks.map((x) => `<div style="color:var(--bad)">– ${esc(x)}</div>`).join('')}</div>` : ''}
    ${(v.pros ?? []).length ? `<div class="small" style="margin-top:6px">${v.pros.map((x) => `<div style="color:var(--ok)">+ ${esc(x)}</div>`).join('')}</div>` : ''}
    ${rows.length ? `<details style="margin-top:8px"><summary class="small muted">Details</summary><dl class="kv" style="margin:8px 0 0;padding:10px;background:var(--card2)">${rows.map(([k, x]) => `<dt>${k}</dt><dd>${esc(x)}</dd>`).join('')}</dl></details>` : ''}
    <div class="row small muted" style="margin-top:8px"><span>Checked ${fmtD(p.vetted_at)}${v.complaints_found ? ' · complaints found online' : ''}</span><a href="#" id="vetB" style="flex:none">Re-check</a></div>
  </div>`
}
function threadFor(placeId) { return S.threads.filter((t) => t.place_id === placeId).sort((a, b) => String(b.last_at).localeCompare(String(a.last_at)))[0] }
function complaint(id) {
  const o = S.orders.find((x) => x.id === id)
  sheet(`<h2 style="margin:4px 0 8px">Problem with “${esc(o.title)}”</h2>
  <label class="f">What’s wrong? (any language – the agent writes to the factory)</label><textarea class="in" id="cN" placeholder="e.g. 40 pcs missing, 12 broken, wrong color vs sample"></textarea>
  <label class="btn ghost" style="width:100%;margin-top:12px">Add photos<span id="cFn" class="muted small"></span><input type="file" id="cF" accept="image/*" multiple hidden></label>
  <button class="btn acc" id="cGo" style="width:100%;margin-top:14px">Prepare complaint for approval</button>`, (b) => {
    $('#cF', b).onchange = (e) => ($('#cFn', b).textContent = ' · ' + e.target.files.length)
    $('#cGo', b).onclick = async (e) => {
      const note = $('#cN', b).value.trim(); if (!note) return toast('Describe the problem')
      e.target.disabled = true; e.target.textContent = 'Uploading…'
      const images = await uploadFiles($('#cF', b).files, 'reklamacia')
      const th = threadFor(o.supplier_id)
      await sb.from('kargo_orders').update({ delivered_ok: false, delivery_note: note }).eq('id', o.id)
      await sb.from('kargo_drafts').insert({ thread_id: th?.id ?? null, order_id: o.id, kind: 'complaint', status: 'revise', note: `Order: ${o.title}, ${o.qty ?? ''}. Problem: ${note}`, images, text: '(being prepared)', to_name: placeById(o.supplier_id)?.name ?? o.supplier, reason: 'Complaint: ' + note.slice(0, 80) })
      closeSheet(); toast('The agent will draft the complaint for your approval', 4000); loadAll()
    }
  })
}
function reorder(o) {
  const th = threadFor(o.supplier_id)
  if (!th) return toast('No Alibaba chat with this factory', 4000)
  const unit = o.price && piecesOf(o) ? (o.price / piecesOf(o)).toFixed(3) : null
  sheet(`<h2 style="margin:4px 0 8px">Reorder</h2><div class="muted small">${esc(o.title)} · last time ${esc(o.qty ?? '')}${unit ? ` · ${unit} ${o.currency}/pc` : ''}</div>
  <label class="f">How many pieces now</label><input class="in" id="rQ" inputmode="numeric" value="${piecesOf(o) ?? ''}">
  <label class="f">Note (optional)</label><input class="in" id="rN" placeholder="e.g. same packaging, different color">
  <div class="small muted" style="margin-top:8px">The agent drafts: same product, new PI with price, plus their own DDP shipping to Slovakia. When they reply it compares the price with last time and their shipping with your agents.</div>
  <button class="btn acc" id="rGo" style="width:100%;margin-top:14px">Prepare message for approval</button>`, (b) => {
    $('#rGo', b).onclick = async () => {
      const n = $('#rQ', b).value.trim()
      await sb.from('kargo_drafts').insert({ thread_id: th.id, order_id: o.id, kind: 'reorder', status: 'revise', note: `Re-order: same product as before (${o.title}, last order ${o.qty ?? ''}${unit ? ' at ' + unit + ' ' + o.currency + '/pc' : ''}, Alibaba order ${o.alibaba_no ?? ''}). New quantity: ${n} pcs. ${$('#rN', b).value}`, text: '(being prepared)', to_name: th.company || th.partner, reason: `Reorder ${n} pcs${unit ? ' · last ' + unit + ' ' + o.currency + '/pc' : ''}` })
      closeSheet(); toast('The agent will draft it for your approval', 4000); go('msg')
    }
  })
}
// skryté poplatky: sľúbené €/kg z ponúk vs. reálne zaplatené
function agentFees(p) {
  const promised = S.quotes.flatMap((q) => (q.offers ?? []).filter((o) => o.place_id === p.id && o.price_kg)).map((o) => o.price_kg)
  const paid = S.orders.filter((o) => o.agent_id === p.id && o.weight_kg > 0 && (o.order_kind === 'shipping' ? o.price : o.ship_cost)).map((o) => (o.order_kind === 'shipping' ? o.price : o.ship_cost) / o.weight_kg)
  if (!paid.length) return null
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length
  const real = avg(paid), prom = promised.length ? avg(promised) : null
  return { real, prom, n: paid.length, diff: prom ? (real / prom - 1) * 100 : null }
}
function gallery(items, max = 12) {
  if (!items.length) return ''
  return `<div class="grid3">${items.slice(0, max).map((m) => `<div class="gm" data-m="${m.id}" style="position:relative;cursor:pointer">${m.kind === 'video' ? `<video src="${esc(m.url)}#t=0.5" muted playsinline preload="metadata" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;background:var(--card2)"></video><span class="tag" style="position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.6);color:#fff">▶ video</span>` : `<img src="${esc(m.url)}" loading="lazy">`}</div>`).join('')}</div>`
}
function bindGallery(root) { $$('[data-m]', root).forEach((el) => (el.onclick = (e) => { e.stopPropagation(); viewMedia(el.dataset.m) })) }
function viewMedia(id) {
  const m = S.media.find((x) => x.id === id); if (!m) return
  const p = placeById(m.place_id), o = S.orders.find((x) => x.id === m.order_id)
  sheet(`${m.kind === 'video' ? `<video src="${esc(m.url)}" controls autoplay playsinline style="width:100%;border-radius:18px;background:#000"></video>` : `<img src="${esc(m.url)}" style="width:100%;border-radius:18px;display:block">`}
  <div style="margin-top:10px"><b>${esc(p?.name ?? '')}</b><div class="small muted">${fmtDT(m.created_at)}${o ? ' · ' + esc(o.title) : ''}</div>${m.caption ? `<div class="small" style="margin-top:6px">${esc(m.caption)}</div>` : ''}</div>
  <div class="row" style="margin-top:12px">${o ? `<button class="btn ghost sm" id="vmO">Open order</button>` : ''}${p ? `<button class="btn ghost sm" id="vmP">${esc(p.kind === 'agent' ? 'Agent' : 'Factory')}</button>` : ''}<a class="btn ghost sm" href="${esc(m.url)}" target="_blank">Full size ↗</a></div>`, (b) => {
    if ($('#vmO', b)) $('#vmO', b).onclick = () => openOrder(o.id)
    if ($('#vmP', b)) $('#vmP', b).onclick = () => openPlace(p.id)
  })
}
function prog(st) { return `<div class="prog">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<i class="${st >= 7 ? 'done' : i <= st ? 'on' : ''}"></i>`).join('')}</div>` }
function orderCard(o) {
  const last = (o.track_events ?? [])[0]
  const e = G.eta(o, S.orders)
  const sup = placeById(o.supplier_id) ?? placeById(o.agent_id)
  return `<div class="card ord" data-o="${o.id}">
    <div class="ph" style="${o.image_url ? `background-image:url('${esc(o.image_url)}')` : ''}">${o.image_url ? '' : ICO.fac}</div>
    <div class="bd"><div class="t">${esc(o.title)}</div>
      <div class="s">${G.STAGES[o.stage ?? 1]} · ${G.MODES[o.mode] ?? ''}${sup ? ' · ' + esc(sup.name) : o.supplier ? ' · ' + esc(o.supplier) : ''}</div>
      <div class="s">${last ? esc(last.d) + (last.loc ? ' · ' + esc(last.loc) : '') + ' · ' + ago(last.t) : o.tracking_no ? esc(o.tracking_no) : o.qty ? esc(o.qty) + (o.price ? ' · ' + money(o.price, o.currency) : '') : ''}</div>
      ${prog(o.stage ?? 1)}
      <div style="margin-top:7px">${e && active(o) ? `<span class="tag acc">ETA ~${fmtD(e.d)}</span>` : ''}${landed(o)?.per ? `<span class="tag">${usd(landed(o).per)}/pc</span>` : ''}${o.paid && o.order_kind !== 'shipping' ? (o.invoice_status === 'received' ? '<span class="tag ok">invoice</span>' : '<span class="tag warn">no invoice</span>') : ''}</div>
    </div></div>`
}
function placeCard(p) {
  const n = S.orders.filter((o) => o.supplier_id === p.id || o.agent_id === p.id).length
  const img = p.image_url ?? S.orders.find((o) => o.supplier_id === p.id && o.image_url)?.image_url
  return `<div class="card ord" data-p="${p.id}"><div class="ph" style="${img ? `background-image:url('${esc(img)}')` : ''}">${img ? '' : p.kind === 'agent' ? ICO.agent : ICO.fac}</div>
  <div class="bd"><div class="t">${p.vetting?.verdict ? `<span style="color:${{ green: 'var(--ok)', yellow: 'var(--warn)', red: 'var(--bad)' }[p.vetting.verdict]}">●</span> ` : ''}${esc(p.name)}</div><div class="s">${p.kind === 'agent' ? 'Shipping agent' : p.kind === 'warehouse' ? 'Warehouse' : 'Factory'} · ${esc(p.city ?? '')}${p.lat == null ? ' · no location' : ''}</div><div class="s">${n ? n + '× order' : ''}</div></div></div>`
}

// ---------- detail zásielky ----------
function openOrder(id) {
  const o = S.orders.find((x) => x.id === id)
  if (!o) return
  const sup = placeById(o.supplier_id), ag = placeById(o.agent_id)
  const e = G.eta(o, S.orders)
  const g = shipGeo(o)
  sheet(`
  ${o.image_url ? `<div class="hero" style="background-image:url('${esc(o.image_url)}')"></div>` : ''}
  <h2 style="margin:4px 0">${esc(o.title)}</h2>
  <div class="muted small">${o.order_kind === 'shipping' ? 'Shipping service' : 'Goods'}${o.alibaba_no ? ' · Alibaba #' + esc(o.alibaba_no) : ''}${o.ordered_at ? ' · ' + fmtD(o.ordered_at) : ''}</div>
  ${prog(o.stage ?? 1)}
  <div class="row small" style="margin-top:4px"><b>${G.STAGES[o.stage ?? 1]}</b><span class="muted" style="text-align:right">${g.pos.how === 'live' ? '<b style="color:var(--route)">● LIVE</b> ' : ''}${esc(g.pos.label ?? '')} ${g.pos.how === 'estimate' ? '(estimate)' : ''}</span></div>
  ${e && active(o) ? `<div class="card" style="margin-top:10px"><b>Arrives ~${new Date(e.d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'numeric' })}</b><div class="small muted">${esc(e.how)}${e.avg ? ' · avg ' + e.avg + ' days' : ''}</div></div>` : ''}
  ${(() => { const L = landed(o); return L ? `<div class="card" style="margin-top:10px"><b>${L.per ? usd(L.per) + ' per piece' : usd(L.total) + ' total'}</b> <span class="small muted">≈ ${eur(L.total * RATES.USD)} total</span><div class="small muted">goods ${usd(L.goods)} + shipping ${usd(L.ship)}${L.pcs ? ` · ${L.pcs} pcs · total ${usd(L.total)}` : ''}${L.ship ? '' : ' · add shipping cost in Edit'}${RATES.approx ? ' · approx. € rate' : ' · € at ECB rate ' + (RATES.date ?? '')}</div></div>` : '' })()}
  ${o.order_kind !== 'shipping' ? `<div class="card small" style="display:flex;align-items:center;gap:10px"><span style="flex:1">Invoice: <b>${{ none: o.paid ? 'not requested' : 'after payment', ask: 'agent will request', requested: 'requested ' + ago(o.invoice_requested_at), received: 'received ✅' }[o.invoice_status ?? 'none'] ?? o.invoice_status}</b>${o.invoice_sent_at ? `<div class="small muted">emailed to ${esc(o.invoice_sent_to ?? '')} · ${fmtD(o.invoice_sent_at)}</div>` : ''}</span>${o.invoice_url ? `<a class="btn sm ghost" target="_blank" href="${esc(o.invoice_url)}">Open</a>` : ''}${o.invoice_status === 'received' && !o.invoice_sent_at && S.agent?.company?.accountant_email ? `<a class="btn sm" href="mailto:${esc(S.agent.company.accountant_email)}?subject=${encodeURIComponent('Faktúra – ' + (placeById(o.supplier_id)?.name ?? o.supplier ?? '') + ' – ' + o.title)}&body=${encodeURIComponent('Dobrý deň,\n\nposielam faktúru k objednávke ' + o.title + (o.alibaba_no ? ' (Alibaba ' + o.alibaba_no + ')' : '') + ':\n' + (o.invoice_url ?? '') + '\n\nĎakujem')}">Email</a>` : ''}${o.invoice_status !== 'received' ? `<button class="btn sm" id="oInv">${o.invoice_status === 'requested' ? 'Remind' : 'Request'}</button>` : ''}</div>` : ''}
  <dl class="kv" style="margin-top:12px">
    ${sup ? `<dt>Factory</dt><dd><a href="#" data-pl="${sup.id}">${esc(sup.name)}</a></dd>` : o.supplier ? `<dt>Supplier</dt><dd>${esc(o.supplier)}</dd>` : ''}
    ${ag ? `<dt>Agent</dt><dd><a href="#" data-pl="${ag.id}">${esc(ag.name)}</a></dd>` : ''}
    ${o.qty ? `<dt>Quantity</dt><dd>${esc(o.qty)}</dd>` : ''}
    ${o.price ? `<dt>Price</dt><dd>${money(o.price, o.currency)}</dd>` : ''}
    ${o.ship_cost ? `<dt>Shipping</dt><dd>${money(o.ship_cost, o.currency)}${o.weight_kg ? ` · ${o.weight_kg} kg · ${money(o.ship_cost / o.weight_kg, o.currency)}/kg` : ''}</dd>` : ''}
    <dt>Transport</dt><dd>${G.MODES[o.mode] ?? ''}${o.mode === 'air' || o.mode === 'express' ? ' via ' + esc(G.EU_HUBS[o.hub]?.n ?? 'Germany') : ''}</dd>
    ${o.tracking_no ? `<dt>Tracking</dt><dd><span class="copy" data-copy="${esc(o.tracking_no)}">${esc(o.tracking_no)}</span>${o.track_carrier ? ' · ' + esc(o.track_carrier) : ''}</dd>` : ''}
    ${o.note ? `<dt>Note</dt><dd>${esc(o.note)}</dd>` : ''}
  </dl>
  <div class="row" style="margin-top:12px;flex-wrap:wrap">
    <button class="btn sm ghost" id="oMap">Map</button>
    ${o.tracking_no ? `<button class="btn sm ghost" id="oRef">Refresh tracking</button><a class="btn sm ghost" target="_blank" href="https://t.17track.net/en#nums=${encodeURIComponent(o.tracking_no)}">17TRACK ↗</a>` : ''}
  </div>
  <div class="row" style="margin-top:8px;flex-wrap:wrap">
    ${o.alibaba_url ? `<a class="btn sm ghost" target="_blank" href="${esc(o.alibaba_url)}">Order ↗</a>` : ''}
    ${o.product_url ? `<a class="btn sm ghost" target="_blank" href="${esc(o.product_url)}">Product ↗</a>` : ''}
    <button class="btn sm ghost" id="oEdit">Edit</button>
    ${o.order_kind !== 'shipping' && o.supplier_id ? '<button class="btn sm ghost" id="oRe">Reorder</button>' : ''}
  </div>
  ${(() => { const g = S.media.filter((m) => m.order_id === o.id || (!m.order_id && m.place_id && m.place_id === o.supplier_id)); return g.length ? `<div class="sec"><span>Photos & videos from the factory (${g.length})</span></div>${gallery(g, 30)}` : '' })()}
  <div class="sec"><span>Tracking</span></div>
  ${(o.track_events ?? []).length ? `<div class="tl">${o.track_events.slice(0, 25).map((ev) => `<div><b>${esc(ev.d)}</b><small>${esc(ev.loc ?? '')} · ${fmtDT(ev.t)}</small></div>`).join('')}</div>` : `<div class="muted small">${o.tracking_no ? 'No events yet – tracking is checked every hour.' : 'Add a tracking number in Edit.'}</div>`}
  <div class="sec"><span>Set status manually</span></div>
  <div class="chips">${G.STAGES.slice(1).map((s, i) => `<span class="chip ${o.stage === i + 1 ? 'on' : ''}" data-st="${i + 1}">${s}</span>`).join('')}</div>
  ${o.manual_stage ? '<div class="small muted" style="margin-top:6px">Status set manually · <a href="#" id="oAuto">back to automatic</a></div>' : ''}
  <div class="row" style="margin-top:18px"><button class="btn bad sm" id="oArch">${o.archived ? 'Unarchive' : 'Archive'}</button></div>`, (b) => {
    $$('[data-pl]', b).forEach((a) => (a.onclick = (e) => { e.preventDefault(); openPlace(a.dataset.pl) }))
    bindGallery(b)
    $('#oMap', b).onclick = () => { closeSheet(); showOnMap(g.pos.lat, g.pos.lng, 4) }
    if ($('#oRef', b)) $('#oRef', b).onclick = async (e) => { e.target.textContent = '⏳'; try { const r = await fn({ action: 'refresh', ids: [o.id] }); toast(r.errors?.length ? '⚠️ ' + r.errors[0] : 'Updated ✅', 4000); await loadAll(); openOrder(o.id) } catch (err) { toast('❌ ' + err.message, 5000); e.target.textContent = 'Refresh tracking' } }
    $('#oEdit', b).onclick = () => openAdd(null, o)
    if ($('#oRe', b)) $('#oRe', b).onclick = () => reorder(o)
    if ($('#oInv', b)) $('#oInv', b).onclick = async () => {
      if (!S.agent?.company?.name) { toast('Fill in your company details first (Agent → Company details)', 4000); return openCompany() }
      await sb.from('kargo_orders').update({ invoice_status: 'ask', paid: true }).eq('id', o.id); toast('The agent will draft the invoice request for approval'); await loadAll(); openOrder(o.id)
    }
    $$('[data-st]', b).forEach((c) => (c.onclick = async () => { await sb.from('kargo_orders').update({ stage: +c.dataset.st, manual_stage: true }).eq('id', o.id); await loadAll(); openOrder(o.id) }))
    if ($('#oAuto', b)) $('#oAuto', b).onclick = async (e) => { e.preventDefault(); await sb.from('kargo_orders').update({ manual_stage: false }).eq('id', o.id); await fn({ action: 'refresh', ids: [o.id] }).catch(() => {}); await loadAll(); openOrder(o.id) }
    $('#oArch', b).onclick = async () => { await sb.from('kargo_orders').update({ archived: !o.archived }).eq('id', o.id); closeSheet(); await loadAll() }
  })
}

// ---------- pridať / upraviť objednávku ----------
function openAdd(prefill = null, o = null) {
  const ed = !!o
  o = o ?? { mode: 'air', hub: 'LEJ', currency: 'USD', stage: 1 }
  const agents = S.places.filter((p) => p.kind === 'agent' || p.kind === 'warehouse')
  sheet(`
  <h2 style="margin:4px 0 8px">${ed ? 'Edit order' : 'Add order'}</h2>
  ${ed ? '' : `<button class="btn" id="aPaste" style="width:100%">Paste Alibaba link</button>
  <div class="small muted" style="margin:6px 2px">Copy the product link in the Alibaba app (Share → Copy link) and tap here. I’ll fill in the name, photo and factory.</div>`}
  <div id="aPrev"></div>
  <label class="f">Name</label><input class="in" id="aT" value="${esc(o.title ?? '')}" placeholder="e.g. LED strips 5 m">
  <label class="f">Factory / supplier</label><input class="in" id="aS" value="${esc(o.supplier ?? placeById(o.supplier_id)?.name ?? '')}" list="supList">
  <datalist id="supList">${S.places.filter((p) => p.kind === 'supplier').map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist>
  <div class="row"><div><label class="f">Quantity</label><input class="in" id="aQ" value="${esc(o.qty ?? '')}" placeholder="500 pcs"></div><div><label class="f">Goods price</label><input class="in" id="aP" inputmode="decimal" value="${esc(o.price ?? '')}"></div><div style="flex:.6"><label class="f">Currency</label><select class="in" id="aC">${['USD', 'EUR', 'CNY'].map((c) => `<option ${o.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div></div>
  <div class="row"><div><label class="f">Pieces</label><input class="in" id="aPc" inputmode="numeric" value="${esc(o.pieces ?? '')}" placeholder="for price/pc"></div><div><label class="f">Fees (bank, PayPal…)</label><input class="in" id="aFe" inputmode="decimal" value="${esc(o.fees ?? '')}"></div></div>
  <label class="f">Agent (ships from)</label><select class="in" id="aA"><option value="">– select –</option>${agents.map((p) => `<option value="${p.id}" ${o.agent_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
  <div class="row"><div><label class="f">Transport</label><select class="in" id="aM">${Object.entries(G.MODES).map(([k, n]) => `<option value="${k}" ${o.mode === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div><label class="f">EU hub</label><select class="in" id="aH">${G.HUB_OPTIONS.map((h) => `<option value="${h.k}" ${o.hub === h.k ? 'selected' : ''}>${esc(h.n)}</option>`).join('')}</select></div></div>
  <div class="row"><div><label class="f">Flight no. (live plane)</label><input class="in" id="aFl" value="${esc(o.flight ?? '')}" placeholder="e.g. CK221" autocapitalize="characters"></div><div><label class="f">Vessel name (live ship)</label><input class="in" id="aVs" value="${esc(o.vessel ?? '')}" placeholder="e.g. EVER ACE"></div></div>
  <label class="f">Tracking number</label><input class="in" id="aTr" value="${esc(o.tracking_no ?? '')}" placeholder="e.g. 1Z… / LP… / YT…" autocapitalize="characters">
  <div class="row"><div><label class="f">Shipping cost</label><input class="in" id="aSc" inputmode="decimal" value="${esc(o.ship_cost ?? '')}"></div><div><label class="f">Weight (kg)</label><input class="in" id="aW" inputmode="decimal" value="${esc(o.weight_kg ?? '')}"></div><div><label class="f">Arrives by</label><input class="in" id="aE" type="date" value="${esc(o.eta ?? '')}"></div></div>
  <label class="f">Note</label><input class="in" id="aN" value="${esc(o.note ?? '')}">
  <input type="hidden" id="aU" value="${esc(o.product_url ?? '')}"><input type="hidden" id="aI" value="${esc(o.image_url ?? '')}">
  <button class="btn" id="aSave" style="width:100%;margin-top:14px">Save</button>
  ${ed ? '' : `<div class="sec"><span>Or paste a message from your agent</span></div>
  <textarea class="in" id="aBulk" placeholder="Paste text from WhatsApp / WeChat – I’ll find all tracking numbers"></textarea>
  <button class="btn ghost" id="aBulkGo" style="width:100%;margin-top:8px">Find numbers & add</button>`}`, (b) => {
    const scrape = async (url) => {
      $('#aPrev', b).innerHTML = '<div class="card muted">Reading product…</div>'
      try {
        const r = await fn({ action: 'scrape', url })
        $('#aU', b).value = r.url ?? url
        if (r.title) $('#aT', b).value = r.title
        if (r.supplier) $('#aS', b).value = r.supplier
        if (r.image) $('#aI', b).value = r.image
        if (r.price && !$('#aP', b).value) { const n = String(r.price).match(/[\d.]+/); if (n) $('#aP', b).dataset.unit = n[0] }
        b.dataset.loc = r.location ?? ''; b.dataset.surl = r.supplierUrl ?? ''
        $('#aPrev', b).innerHTML = `<div class="card ord"><div class="ph" style="${r.image ? `background-image:url('${esc(r.image)}')` : ''}"></div><div class="bd"><div class="t">${esc(r.title ?? 'Product')}</div><div class="s">${esc(r.supplier ?? '')} ${r.location ? '· ' + esc(r.location) : ''}</div><div class="s">${r.price ? 'Price: ' + esc(r.price) : ''} ${r.moq ? '· MOQ ' + esc(r.moq) : ''}</div></div></div>${r.blocked ? '<div class="small" style="color:var(--warn)">Alibaba partly blocked the page – fill in anything missing (the PC Agent can fetch the photo too).</div>' : ''}`
      } catch (e) { $('#aPrev', b).innerHTML = `<div class="card small">❌ ${esc(e.message)} – fill in manually.</div>` }
    }
    if (prefill) scrape(prefill)
    if ($('#aPaste', b)) $('#aPaste', b).onclick = async () => {
      let t = ''
      try { t = await navigator.clipboard.readText() } catch (_) { t = prompt('Paste link:') ?? '' }
      const m = t.match(/https?:\/\/\S+/)
      if (!m) return toast('No link in clipboard')
      scrape(m[0])
    }
    $('#aSave', b).onclick = async () => {
      const title = $('#aT', b).value.trim()
      if (!title) return toast('Enter a name')
      const supName = $('#aS', b).value.trim()
      let sup = S.places.find((p) => p.kind === 'supplier' && p.name.toLowerCase() === supName.toLowerCase())
      if (!sup && supName) {
        const loc = b.dataset.loc
        const g = loc ? await geocode(loc + (/china/i.test(loc) ? '' : ', China')) : null
        const { data } = await sb.from('kargo_places').insert({ kind: 'supplier', name: supName, url: b.dataset.surl || null, image_url: $('#aI', b).value || null, city: loc || null, lat: g?.lat ?? null, lng: g?.lng ?? null }).select().single()
        sup = data
      }
      const tr = $('#aTr', b).value.replace(/\s/g, '').toUpperCase() || null
      const row = {
        title, supplier: supName || null, supplier_id: sup?.id ?? o.supplier_id ?? null, qty: $('#aQ', b).value || null, price: num($('#aP', b).value), currency: $('#aC', b).value,
        agent_id: $('#aA', b).value || null, mode: $('#aM', b).value, hub: $('#aH', b).value, ship_cost: num($('#aSc', b).value), weight_kg: num($('#aW', b).value),
        eta: $('#aE', b).value || null, flight: ($('#aFl', b).value || '').toUpperCase().replace(/\s/g, '') || null, vessel: $('#aVs', b).value.trim() || null, pieces: num($('#aPc', b).value), fees: num($('#aFe', b).value), note: $('#aN', b).value || null, product_url: $('#aU', b).value || null, image_url: $('#aI', b).value || null, tracking_no: tr,
      }
      if (tr && tr !== o.tracking_no) { row.registered = false; if ((o.stage ?? 1) < 3) row.stage = 3 }
      else if (!ed) row.stage = row.agent_id ? 2 : 1
      const q = ed ? sb.from('kargo_orders').update(row).eq('id', o.id).select().single() : sb.from('kargo_orders').insert(row).select().single()
      const { data, error } = await q
      if (error) return toast('❌ ' + error.message, 5000)
      closeSheet(); toast('Saved ✅')
      if (tr && tr !== o.tracking_no) fn({ action: 'refresh', ids: [data.id] }).then(loadAll).catch((e) => toast('Tracking: ' + e.message, 5000))
      await loadAll()
    }
    if ($('#aBulkGo', b)) $('#aBulkGo', b).onclick = async () => {
      const nums = G.findTracking($('#aBulk', b).value).filter((n) => !S.orders.some((o) => o.tracking_no === n))
      if (!nums.length) return toast('No new tracking numbers found')
      const agent = $('#aA', b).value || null
      const rows = nums.map((n) => ({ title: 'Shipment ' + n.slice(-6), tracking_no: n, agent_id: agent, mode: $('#aM', b).value, hub: $('#aH', b).value, stage: 3 }))
      const { data, error } = await sb.from('kargo_orders').insert(rows).select('id')
      if (error) return toast('❌ ' + error.message)
      closeSheet(); toast(`Added ${nums.length}: ${nums.join(', ')}`, 4000)
      fn({ action: 'refresh', ids: data.map((d) => d.id) }).then(loadAll).catch(() => {})
      await loadAll()
    }
  })
}
// ---------- skutočná cena za kus (kurz ECB cez frankfurter.app) ----------
const RATES = { EUR: 1, USD: 0.86, CNY: 0.12, approx: true }
fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,CNY').then((r) => r.json()).then((j) => { if (j.rates?.USD) { RATES.USD = 1 / j.rates.USD; RATES.CNY = 1 / j.rates.CNY; RATES.approx = false; RATES.date = j.date; if (S.tab === 'ship') renderShip() } }).catch(() => {})
const toEur = (v, c) => v == null ? 0 : Number(v) * (RATES[c || 'USD'] ?? 1)
const toUsd = (v, c) => v == null ? 0 : (Number(v) * (RATES[c || 'USD'] ?? 1)) / RATES.USD
const usd = (v) => v == null ? '–' : '$' + v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 2 : 0, minimumFractionDigits: v < 10 ? 2 : 0 })
const piecesOf = (o) => Number(o.pieces) || Number(String(o.qty ?? '').replace(/[\s,]/g, '').match(/\d+/)?.[0]) || null
function landed(o) {
  const goods = toUsd(o.price, o.currency) + toUsd(o.fees, o.currency)
  const ship = toUsd(o.ship_cost, o.currency)
  const total = goods + ship
  if (!total) return null
  const pcs = piecesOf(o)
  return { total, goods, ship, pcs, per: pcs ? total / pcs : null }
}
const eur = (v) => v == null ? '–' : v.toLocaleString('en-GB', { maximumFractionDigits: v < 10 ? 2 : 0, minimumFractionDigits: v < 10 ? 2 : 0 }) + ' €'
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n }
async function geocode(q) {
  try { const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&q=' + encodeURIComponent(q)); const j = await r.json(); return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null } catch (_) { return null }
}

// ---------- body na mape ----------
function addrText(p) {
  return [p.name, p.contact, p.phone, p.address_en || p.address, p.address && p.address_en && p.address !== p.address_en ? p.address : null, p.city].filter(Boolean).join('\n')
}
function openPlace(id) {
  const p = placeById(id); if (!p) return
  const ords = S.orders.filter((o) => o.supplier_id === p.id || o.agent_id === p.id)
  const img = p.image_url ?? ords.find((o) => o.image_url)?.image_url
  const th = S.threads.find((t) => t.place_id === p.id)
  const wa = (p.whatsapp || p.phone || '').replace(/\D/g, '')
  sheet(`
  ${img ? `<div class="hero" style="background-image:url('${esc(img)}')"></div>` : ''}
  <h2 style="margin:4px 0">${esc(p.name)}</h2>
  <div class="muted small">${{ supplier: 'Factory / supplier', agent: 'Shipping agent', warehouse: 'Warehouse', home: 'Home' }[p.kind]}${p.city ? ' · ' + esc(p.city) : ''}</div>
  ${p.note ? `<p class="small">${esc(p.note)}</p>` : ''}
  ${p.kind === 'supplier' ? vetCard(p) : ''}
  ${p.kind === 'agent' ? `<div class="card small">Transfer fee factory → warehouse: <b>${p.transfer_local != null ? usd(+p.transfer_local) : '?'}</b> same city · <b>${p.transfer_other != null ? usd(+p.transfer_other) : '?'}</b> rest of China${p.transfer_local == null ? ' · <span class="muted">set it in Edit</span>' : ''}</div>` : ''}
  ${(() => { if (p.kind !== 'agent') return ''; const f = agentFees(p); if (!f) return '<div class="card small muted">Once this agent’s shipments have weight and shipping cost, you’ll see the real price per kg and hidden fees.</div>'; return `<div class="card"><div class="row"><div><div class="small muted">You really pay</div><b style="font-size:20px">${f.real.toFixed(2)} $/kg</b></div>${f.prom ? `<div><div class="small muted">Promised</div><b style="font-size:20px">${f.prom.toFixed(2)} $/kg</b></div>` : ''}</div>${f.diff != null ? `<div class="small" style="margin-top:6px;color:${f.diff > 5 ? 'var(--bad)' : 'var(--ok)'}">${f.diff > 5 ? `Hidden fees: ${Math.round(f.diff)} % more than promised` : 'Sticks to the quote'} · ${f.n} shipments</div>` : `<div class="small muted" style="margin-top:6px">${f.n} shipments</div>`}</div>` })()}
  ${p.address || p.address_en ? `<div class="card"><div class="small muted">Address (tap to copy)</div><div class="copy" data-copy="${esc(p.address_en || p.address)}" style="margin-top:4px">${esc(p.address_en || p.address)}</div>${p.address && p.address_en && p.address !== p.address_en ? `<div class="copy small" data-copy="${esc(p.address)}" style="margin-top:6px">${esc(p.address)}</div>` : ''}</div>` : ''}
  ${(() => { const kv = `
    ${p.contact ? `<dt>Contact</dt><dd>${esc(p.contact)}</dd>` : ''}
    ${p.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></dd>` : ''}
    ${p.wechat ? `<dt>WeChat</dt><dd class="copy" data-copy="${esc(p.wechat)}">${esc(p.wechat)}</dd>` : ''}
    ${p.email ? `<dt>Email</dt><dd>${esc(p.email)}</dd>` : ''}
  `; return kv.trim() ? `<dl class="kv">${kv}</dl>` : '' })()}
  <div class="row" style="margin-top:12px;flex-wrap:wrap">
    ${p.kind === 'agent' ? `<button class="btn sm" id="pCopy">Copy address</button>` : ''}
    ${wa ? `<a class="btn sm ok" href="https://wa.me/${wa}" target="_blank">WhatsApp</a>` : ''}
    ${p.url ? `<a class="btn sm ghost" href="${esc(p.url)}" target="_blank">Store ↗</a>` : ''}
    ${p.lat != null ? `<button class="btn sm ghost" id="pMap">Map</button>` : ''}
    ${th ? `<button class="btn sm ghost" id="pChat">Chat</button>` : ''}
    <button class="btn sm ghost" id="pEdit">Edit</button>
  </div>
  ${p.lat == null ? '<div class="card small" style="border-color:#6b5a1a">This place has no location – use Edit to find the address or tap it on the map.</div>' : ''}
  ${(() => { const g = S.media.filter((m) => m.place_id === p.id); return g.length ? `<div class="sec"><span>Photos & videos (${g.length})</span></div>${gallery(g, 30)}` : '' })()}
  <div class="sec"><span>Orders (${ords.length})</span></div>
  ${ords.map(orderCard).join('') || '<div class="muted small">None.</div>'}`, (b) => {
    if ($('#pCopy', b)) $('#pCopy', b).onclick = () => copy(addrText(p), 'Address copied – paste it into the order ✅')
    if ($('#pMap', b)) $('#pMap', b).onclick = () => { closeSheet(); showOnMap(p.lat, p.lng, 9) }
    if ($('#pChat', b)) $('#pChat', b).onclick = () => openThread(th.id)
    $('#pEdit', b).onclick = () => editPlace(p)
    if ($('#vetB', b)) $('#vetB', b).onclick = async () => { await sb.from('kargo_places').update({ vet_status: 'ask' }).eq('id', p.id); p.vet_status = 'ask'; toast(agentOnline() ? 'Checking the factory – takes ~2 min' : 'Will check when your PC is on'); openPlace(p.id) }
    bindGallery(b)
    $$('[data-o]', b).forEach((c) => (c.onclick = () => openOrder(c.dataset.o)))
  })
}
function editPlace(p = null, kind = 'agent') {
  const ed = !!p
  p = p ?? { kind }
  sheet(`<h2 style="margin:4px 0 8px">${ed ? 'Edit place' : 'New place'}</h2>
  <label class="f">Type</label><select class="in" id="eK">${[['agent', 'Shipping agent'], ['supplier', 'Factory'], ['warehouse', 'Warehouse'], ['home', 'Home (destination)']].map(([k, n]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
  <label class="f">Name</label><input class="in" id="eN" value="${esc(p.name ?? '')}">
  <label class="f">Exact address (English / pinyin)</label><textarea class="in" id="eAe" style="min-height:64px">${esc(p.address_en ?? '')}</textarea>
  <label class="f">Address in Chinese (optional)</label><textarea class="in" id="eA" style="min-height:50px">${esc(p.address ?? '')}</textarea>
  <div class="row"><div><label class="f">City</label><input class="in" id="eC" value="${esc(p.city ?? '')}"></div><div><label class="f">Contact</label><input class="in" id="eP" value="${esc(p.contact ?? '')}"></div></div>
  <div class="row"><div><label class="f">Phone</label><input class="in" id="eT" value="${esc(p.phone ?? '')}"></div><div><label class="f">WhatsApp</label><input class="in" id="eW" value="${esc(p.whatsapp ?? '')}" placeholder="+86…"></div></div>
  <div class="row"><div><label class="f">WeChat</label><input class="in" id="eWc" value="${esc(p.wechat ?? '')}"></div><div><label class="f">Website / store</label><input class="in" id="eU" value="${esc(p.url ?? '')}"></div></div>
  <label class="f">Note</label><input class="in" id="eNo" value="${esc(p.note ?? '')}">
  <div id="eFees" class="${p.kind === 'agent' || !p.kind ? '' : 'hide'}"><label class="f">Transfer fee: factory → agent warehouse ($)</label>
  <div class="row"><input class="in" id="eTl" inputmode="decimal" placeholder="same city, e.g. 10" value="${esc(p.transfer_local ?? '')}"><input class="in" id="eTo" inputmode="decimal" placeholder="rest of China, e.g. 20" value="${esc(p.transfer_other ?? '')}"></div></div>
  <div class="card small" id="eGeo">📍 ${p.lat != null ? `Location: ${(+p.lat).toFixed(4)}, ${(+p.lng).toFixed(4)}` : 'No location'}</div>
  <div class="row"><button class="btn sm ghost" id="eFind">Find address</button><button class="btn sm ghost" id="ePick">Tap on map</button></div>
  <button class="btn" id="eSave" style="width:100%;margin-top:14px">Save</button>
  ${ed ? '<button class="btn bad sm" id="eDel" style="margin-top:14px">Delete place</button>' : ''}`, (b) => {
    let lat = p.lat, lng = p.lng
    $('#eK', b).onchange = (e) => $('#eFees', b).classList.toggle('hide', e.target.value !== 'agent')
    const show = () => ($('#eGeo', b).textContent = lat != null ? `📍 Location: ${(+lat).toFixed(4)}, ${(+lng).toFixed(4)}` : '📍 No location')
    $('#eFind', b).onclick = async () => {
      $('#eGeo', b).textContent = 'Searching…'
      const q1 = [$('#eAe', b).value, $('#eC', b).value].filter(Boolean).join(', ')
      const g = (await geocode(q1)) ?? (await geocode($('#eC', b).value + ($('#eK', b).value === 'home' ? '' : ', China')))
      if (g) { lat = g.lat; lng = g.lng; show() } else $('#eGeo', b).textContent = 'Not found – try the city or tap the map'
    }
    $('#ePick', b).onclick = () => {
      const keep = collect(); closeSheet(); go('map'); toast('Tap the exact spot on the map', 4000)
      S.pick = (la, ln) => { editPlace({ ...p, ...keep, lat: la, lng: ln }); }
    }
    const collect = () => ({ kind: $('#eK', b).value, name: $('#eN', b).value.trim(), address_en: $('#eAe', b).value.trim() || null, address: $('#eA', b).value.trim() || null, city: $('#eC', b).value.trim() || null, contact: $('#eP', b).value.trim() || null, phone: $('#eT', b).value.trim() || null, whatsapp: $('#eW', b).value.trim() || null, wechat: $('#eWc', b).value.trim() || null, url: $('#eU', b).value.trim() || null, note: $('#eNo', b).value.trim() || null, transfer_local: num($('#eTl', b)?.value), transfer_other: num($('#eTo', b)?.value) })
    $('#eSave', b).onclick = async () => {
      const row = { ...collect(), lat, lng }
      if (!row.name) return toast('Enter a name')
      if (row.kind === 'home') { const old = S.places.find((x) => x.kind === 'home' && x.id !== p.id); if (old) await sb.from('kargo_places').delete().eq('id', old.id) }
      const { error } = p.id ? await sb.from('kargo_places').update(row).eq('id', p.id) : await sb.from('kargo_places').insert(row)
      if (error) return toast('❌ ' + error.message, 5000)
      closeSheet(); toast('Saved ✅'); await loadAll()
    }
    if ($('#eDel', b)) $('#eDel', b).onclick = async () => { if (!confirm('Delete this place?')) return; await sb.from('kargo_places').delete().eq('id', p.id); closeSheet(); await loadAll() }
  })
}

// ================= SCHVAĽOVANIE + CHATY + CENY =================
function renderMsg() {
  const v = $('#v-msg')
  const pend = S.drafts.filter((d) => d.status === 'pending' && S.threads.find((t) => t.id === d.thread_id)?.kind !== 'cold')
  const recent = S.drafts.filter((d) => !d.auto && ['approved', 'sending', 'sent', 'failed', 'revise'].includes(d.status)).slice(0, 6)
  const K = { supplier: 'Suppliers', agent: 'Agents', other: 'Other', cold: 'Cold outreach' }
  const th = S.threads.filter((t) => t.kind === S.tfilt || (S.tfilt === 'other' && t.kind === 'unknown'))
  v.innerHTML = `
  ${!agentOnline() ? `<div class="card small" style="border-color:#6b5a1a">The PC Agent is offline – no new drafts, and approved messages wait until it’s back.</div>` : ''}
  <div class="sec"><span>Waiting for you (${pend.length})</span>${pend.filter((d) => d.quote_id).length > 1 ? '<button class="btn sm ok" id="allQ">Approve all quotes</button>' : ''}</div>
  ${pend.map(draftCard).join('') || '<div class="empty"><b>✅</b>All clear. When someone writes, the agent drafts a reply and you get a push.</div>'}
  ${(() => { const au = S.drafts.filter((d) => d.auto && Date.now() - new Date(d.created_at) < 864e5); return au.length ? `<div class="sec"><span>Autopilot · last 24 h (${au.length})</span></div><div class="card" style="padding:6px 16px">${au.map((d) => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><div class="row small"><b style="flex:3">${esc(d.to_name ?? '')}</b><span class="muted" style="text-align:right">${d.status === 'sent' ? 'sent ' + ago(d.sent_at) : d.status === 'failed' ? 'failed' : 'sending…'}</span></div><div class="small muted" style="margin-top:2px">${esc(d.text.slice(0, 140))}</div></div>`).join('')}</div>` : '' })()}
  ${recent.length ? `<div class="sec"><span>Recent</span></div>${recent.map((d) => `<div class="card small"><b>${{ approved: 'Queued', sending: 'Sending', sent: 'Sent', failed: 'Failed', revise: 'Rewriting' }[d.status]}</b> · ${esc(d.to_name ?? '')} <span class="muted">${ago(d.sent_at ?? d.decided_at ?? d.created_at)}</span><div class="muted" style="margin-top:4px">${esc(d.text.slice(0, 140))}</div>${d.error ? `<div style="color:var(--bad)">${esc(d.error)}</div><button class="btn sm ghost" data-retry="${d.id}" style="margin-top:6px">Retry</button>` : ''}</div>`).join('')}` : ''}
  <div class="sec"><span>Agent quotes</span><button class="btn sm" id="newQ">Ask 3 agents</button></div>
  ${S.quotes.filter((q) => q.status !== 'cancelled').slice(0, 5).map(quoteCard).join('') || '<div class="muted small">Enter weight and size – the agent asks three agents the same question and compares the prices.</div>'}
  <div class="sec"><span>Alibaba conversations</span></div>
  <div class="chips">${Object.entries(K).map(([k, n]) => `<span class="chip ${S.tfilt === k ? 'on' : ''}" data-tf="${k}">${n} ${S.threads.filter((t) => t.kind === k || (k === 'other' && t.kind === 'unknown')).length}</span>`).join('')}</div>
  ${th.slice(0, 80).map((t) => `<div class="card ord" data-th="${t.id}"><div class="ph">${t.kind === 'agent' ? '🚚' : t.kind === 'supplier' ? '🏭' : '💬'}</div><div class="bd"><div class="t">${esc(t.company || t.partner || 'Conversation')}${t.archived ? ' <span class="muted small">archived</span>' : ''}</div><div class="s">${esc(t.summary ?? '')}</div><div class="s">${t.last_from_me ? 'Ty: ' : ''}${esc((t.last_text ?? '').slice(0, 90))}</div></div></div>`).join('') || `<div class="muted small">${S.threads.length ? 'Nothing here.' : 'The PC Agent will load your conversations.'}</div>`}`
  $$('[data-tf]', v).forEach((c) => (c.onclick = () => { S.tfilt = c.dataset.tf; renderMsg() }))
  $$('[data-th]', v).forEach((c) => (c.onclick = () => openThread(c.dataset.th)))
  $$('[data-ok]', v).forEach((bt) => (bt.onclick = () => decide(bt.dataset.ok, 'approved')))
  $$('[data-no]', v).forEach((bt) => (bt.onclick = () => decide(bt.dataset.no, 'rejected')))
  $$('[data-rv]', v).forEach((bt) => (bt.onclick = () => revise(bt.dataset.rv, !!bt.dataset.ph)))
  $$('[data-ign]', v).forEach((bt) => (bt.onclick = async () => { const d = S.drafts.find((x) => x.id === bt.dataset.ign); await sb.from('kargo_threads').update({ kind: 'cold' }).eq('id', d.thread_id); await decide(d.id, 'rejected', true); toast('Chat ignored – no more drafts from it') }))
  $$('#v-msg [data-o]').forEach((c) => (c.onclick = () => openOrder(c.dataset.o)))
  const need = [...new Set(pend.map((d) => d.thread_id).filter((id) => id && !(S.msgs ?? {})[id]))]
  if (need.length) sb.from('kargo_threads').select('id,messages').in('id', need).then(({ data }) => { S.msgs = S.msgs ?? {}; for (const r of data ?? []) S.msgs[r.id] = r.messages ?? []; renderMsg() })
  $$('[data-retry]', v).forEach((bt) => (bt.onclick = () => decide(bt.dataset.retry, 'approved')))
  $$('[data-qw]', v).forEach((bt) => (bt.onclick = () => pickWinner(bt.dataset.qw, bt.dataset.pl)))
  $$('[data-qx]', v).forEach((bt) => (bt.onclick = async () => { await sb.from('kargo_quotes').update({ status: 'cancelled' }).eq('id', bt.dataset.qx); await loadAll(); renderMsg() }))
  if ($('#allQ', v)) $('#allQ', v).onclick = async () => { for (const d of pend.filter((d) => d.quote_id)) await decide(d.id, 'approved', true); toast('Approved – the agent will send them'); pollLight() }
  $('#newQ', v).onclick = () => newQuote()
}
function draftCard(d) {
  const t = S.threads.find((x) => x.id === d.thread_id)
  const msgs = (S.msgs?.[d.thread_id] ?? []).filter((m) => m.side !== 's').slice(-6)
  const ord = t?.place_id ? S.orders.find((o) => (o.supplier_id === t.place_id || o.agent_id === t.place_id) && !o.archived) : null
  const photos = d.kind === 'photos' && (d.images ?? []).length
  const icon = ''
  return `<div class="card draft">
    <div class="row"><div style="flex:3"><b>${esc(d.to_name ?? t?.company ?? '')}</b> ${{ photos: '<span class="tag acc">photos</span>', ready: '<span class="tag acc">goods ready</span>', invoice: '<span class="tag">invoice</span>', invoice_reminder: '<span class="tag">invoice</span>', reorder: '<span class="tag">reorder</span>', complaint: '<span class="tag warn">complaint</span>', rfq: '<span class="tag">new supplier</span>' }[d.kind] ?? ''}</div><span class="muted small" style="text-align:right">${d.channel === 'whatsapp' ? 'WhatsApp · ' : ''}${ago(d.created_at)}</span></div>
    ${d.reason ? `<div class="why">${esc(d.reason)}</div>` : ''}
    ${ord ? `<div class="row small" style="margin-top:8px;gap:8px;justify-content:flex-start;cursor:pointer" data-o="${ord.id}"><div style="width:30px;height:30px;border-radius:8px;flex:none;background:var(--card2) ${ord.image_url ? `url('${esc(ord.image_url)}') center/cover` : ''}"></div><span>Order: <b>${esc(ord.title)}</b></span></div>` : t?.place_id ? '' : '<div class="small muted" style="margin-top:6px">Not linked to an active order</div>'}
    ${msgs.length ? `<div style="margin:10px 0;max-height:260px;overflow:auto;background:var(--bg);border-radius:14px;padding:6px 10px">${msgs.map((m) => `<div class="bub ${m.side}" style="font-size:13px">${esc((m.text ?? '').slice(0, 400))}${(m.imgs ?? []).length ? ' 📷' : ''}</div>`).join('')}</div>` : ''}
    ${photos ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0">${d.images.map((u) => `<a href="${esc(u)}" target="_blank"><img src="${esc(u)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:var(--card2)"></a>`).join('')}</div>` : !msgs.length && t?.last_text && !t.last_from_me ? `<div class="them">${esc(t.last_text.slice(0, 400))}</div>` : ''}
    <textarea id="dt-${d.id}">${esc(d.text)}</textarea>
    <div class="row" style="margin-top:8px">
      <button class="btn bad sm" data-no="${d.id}" style="flex:.7">✕</button>
      ${t ? `<button class="btn ghost sm" data-ign="${d.id}" title="Ignore this chat">Ignore chat</button>` : ''}
      <button class="btn ghost sm" data-rv="${d.id}" data-ph="${photos ? 1 : ''}">${photos ? 'Problem' : 'Rewrite'}</button>
      <button class="btn ok" data-ok="${d.id}" style="flex:1.4">${photos ? 'OK, ship it' : 'Send'}</button>
    </div>
  </div>`
}
async function revise(id, isPhoto) {
  const note = prompt(isPhoto ? 'What is not OK? (any language – the agent writes it in English)' : 'How should it change? (e.g. “ask 5% discount”, “shorter”)')
  if (!note) return
  await sb.from('kargo_drafts').update({ status: 'revise', note }).eq('id', id)
  toast(agentOnline() ? 'The agent is rewriting it – new draft shortly' : 'Will be rewritten when your PC is on'); pollLight()
}
async function decide(id, st, quiet = false) {
  const ta = $('#dt-' + id)
  const patch = { status: st, decided_at: new Date().toISOString(), error: null }
  if (ta) patch.text = ta.value.trim()
  const { error } = await sb.from('kargo_drafts').update(patch).eq('id', id)
  if (error) return toast('❌ ' + error.message)
  if (!quiet) toast(st === 'approved' ? (agentOnline() ? 'Sending now' : 'Will send when your PC is on') : 'Discarded')
  const d = S.drafts.find((x) => x.id === id); if (d) Object.assign(d, patch)
  renderBadge(); renderMsg()
}
function quoteCard(q) {
  const kg = Number(q.weight_kg) || null
  const val = (o) => o.total ?? (o.price_kg && kg ? o.price_kg * kg : o.price_kg ?? 1e9)
  const offs = [...(q.offers ?? [])].sort((a, b) => val(a) - val(b))
  const names = (q.agents ?? []).map((id) => placeById(id)?.name).filter(Boolean)
  return `<div class="card"><div class="row"><b>${esc(q.title)}</b><span class="small muted" style="text-align:right">${q.weight_kg ? q.weight_kg + ' kg' : ''}${q.cbm ? ' · ' + q.cbm + ' cbm' : ''} · ${G.MODES[q.mode] ?? ''}</span></div>
  <div class="small muted">${offs.length}/${names.length} replies · ${esc(names.join(', '))}</div>
  ${offs.length ? `<table class="qtab"><tr><th>Agent</th><th>/kg</th><th>Total</th><th>Days</th><th></th></tr>${offs.map((o, i) => `<tr class="${i === 0 ? 'best' : ''}"><td>${i === 0 ? '🏆 ' : ''}${esc(o.agent ?? '')}</td><td>${o.price_kg ?? '–'}</td><td>${o.total ?? (o.price_kg && kg ? Math.round(o.price_kg * kg) : '–')}</td><td>${esc(o.days ?? '')}${o.ddp === false ? ' no DDP' : ''}</td><td>${q.winner === o.place_id ? '✅' : q.status === 'asking' ? `<button class="btn sm ok" data-qw="${q.id}" data-pl="${o.place_id}">Pick</button>` : ''}</td></tr>`).join('')}</table>` : '<div class="small muted" style="margin-top:6px">Waiting for replies…</div>'}
  ${q.status === 'asking' ? `<button class="btn sm ghost" data-qx="${q.id}" style="margin-top:8px">Cancel</button>` : ''}</div>`
}
function newQuote(pre = {}) {
  const agents = S.places.filter((p) => p.kind === 'agent')
  sheet(`<h2 style="margin:4px 0 8px">Ask agents for a quote</h2>
  <label class="f">What are you shipping</label><input class="in" id="qT" placeholder="e.g. 6 cartons of LED strips" value="${esc(pre.title ?? '')}">
  <div class="row"><div><label class="f">Weight (kg)</label><input class="in" id="qW" inputmode="decimal" value="${esc(pre.weight ?? '')}"></div><div><label class="f">Volume (cbm)</label><input class="in" id="qV" inputmode="decimal"></div><div><label class="f">Cartons</label><input class="in" id="qC" inputmode="numeric"></div></div>
  <label class="f">Transport</label><select class="in" id="qM">${Object.entries(G.MODES).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
  <label class="f">Note for agents</label><input class="in" id="qN" placeholder="e.g. contains batteries, needed by Dec 10" value="${esc(pre.note ?? '')}">
  <label class="f">Agents (pick 3)</label>
  ${agents.map((p, i) => `<label class="card ord" style="margin:6px 0;padding:10px"><input type="checkbox" value="${p.id}" ${(pre.agents ? pre.agents.includes(p.id) : i < 3) ? 'checked' : ''} style="width:20px;height:20px"><div class="bd"><div class="t">${esc(p.name)}</div><div class="s">${p.whatsapp || p.phone ? 'WhatsApp' : 'Alibaba chat'}</div></div></label>`).join('') || '<div class="muted small">Add agents first (Shipments → Add place) or let the PC Agent load them.</div>'}
  <button class="btn" id="qGo" style="width:100%;margin-top:12px">Prepare messages for approval</button>`, (b) => {
    $('#qGo', b).onclick = async () => {
      const ids = $$('input[type=checkbox]:checked', b).map((x) => x.value)
      if (!$('#qT', b).value.trim()) return toast('Describe the shipment')
      if (!ids.length) return toast('Pick agents')
      const { error } = await sb.from('kargo_quotes').insert({ title: $('#qT', b).value.trim(), weight_kg: num($('#qW', b).value), cbm: num($('#qV', b).value), cartons: parseInt($('#qC', b).value) || null, mode: $('#qM', b).value, note: $('#qN', b).value || null, agents: ids })
      if (error) return toast('❌ ' + error.message)
      closeSheet(); toast(agentOnline() ? 'The agent is drafting them – approve shortly' : 'Saved – the agent drafts them when your PC is on', 4000); await loadAll(); renderMsg()
    }
  })
}
async function pickWinner(qid, pid) {
  const q = S.quotes.find((x) => x.id === qid), p = placeById(pid)
  const o = (q.offers ?? []).find((x) => x.place_id === pid)
  await sb.from('kargo_quotes').update({ winner: pid, status: 'done' }).eq('id', qid)
  const th = S.threads.find((t) => t.place_id === pid)
  const wa = p?.whatsapp || p?.phone
  await sb.from('kargo_drafts').insert({ quote_id: qid, thread_id: wa ? null : th?.id ?? null, channel: wa ? 'whatsapp' : 'alibaba', to_phone: wa ?? null, to_name: p?.name, reason: 'Confirm winning quote', text: `ok, lets go with ${o?.price_kg ? o.price_kg + '/kg' : 'your price'} DDP. send me warehouse address and shipping mark pls` })
  toast('Picked – confirmation message awaits approval'); await loadAll(); renderMsg()
}
async function openThread(id) {
  const { data: t } = await sb.from('kargo_threads').select('*').eq('id', id).single()
  if (!t) return
  sheet(`<h2 style="margin:4px 0">${esc(t.company || t.partner)}</h2><div class="muted small">${esc(t.partner ?? '')} · ${{ supplier: 'supplier', agent: 'agent', cold: 'cold outreach', other: 'other', unknown: '?' }[t.kind]}${t.archived ? ' · archived' : ''}</div>
  ${t.summary ? `<div class="card small">🧠 ${esc(t.summary)}</div>` : ''}
  <div style="margin-top:8px">${(t.messages ?? []).slice(-40).map((m) => `<div class="bub ${m.side}">${esc(m.text)}</div>`).join('')}</div>
  <div class="sec"><span>Write (the agent sends it)</span></div>
  <textarea class="in" id="tW" placeholder="your message…"></textarea>
  <div class="row" style="margin-top:8px"><select class="in" id="tK">${['supplier', 'agent', 'cold', 'other'].map((k) => `<option value="${k}" ${t.kind === k ? 'selected' : ''}>${{ supplier: 'supplier', agent: 'agent', cold: 'cold outreach (ignore)', other: 'other' }[k]}</option>`).join('')}</select><button class="btn" id="tSend">Send</button></div>`, (b) => {
    $('#sheet .pan').scrollTop = 1e6
    $('#tK', b).onchange = async () => {
      const kind = $('#tK', b).value
      const patch = { kind }
      if ((kind === 'agent' || kind === 'supplier') && !t.place_id) {
        const { data: pl } = await sb.from('kargo_places').insert({ kind, name: t.company || t.partner, contact: t.partner, note: t.summary ?? null }).select().single()
        if (pl) { patch.place_id = pl.id; toast(kind === 'agent' ? 'Agent added – set warehouse city & fees' : 'Factory added'); await sb.from('kargo_threads').update(patch).eq('id', t.id); await loadAll(); return editPlace(pl) }
      }
      await sb.from('kargo_threads').update(patch).eq('id', t.id); toast('Saved'); loadAll()
    }
    $('#tSend', b).onclick = async () => {
      const txt = $('#tW', b).value.trim(); if (!txt) return
      await sb.from('kargo_drafts').insert({ thread_id: t.id, to_name: t.company || t.partner, text: txt, status: 'approved', decided_at: new Date().toISOString(), reason: 'Written by you' })
      closeSheet(); toast('The agent will send it'); pollLight()
    }
  })
}

// ================= DOPYTY (najlacnejšie, ale kvalitné) =================
function renderSrc() {
  const v = $('#v-src')
  const inbox = S.agent?.inbox
  v.innerHTML = `
  <div class="card">
    <b>New sourcing request</b>
    <div class="small muted" style="margin:4px 0 8px">Describe what you need and add photos or inspiration. The agent searches Alibaba – also by photo – and finds the cheapest offers that pass a strict quality filter.</div>
    <textarea class="in" id="sT" placeholder="e.g. printed shipping boxes with logo, 30×20×10, sturdy"></textarea>
    <div class="row" style="margin-top:8px"><input class="in" id="sQ" placeholder="Quantity" inputmode="numeric"><input class="in" id="sP" placeholder="Target price (optional)"></div>
    <label class="btn ghost" style="width:100%;margin-top:8px">Add photos<span id="sFn" class="muted small"></span><input type="file" id="sF" accept="image/*" multiple hidden></label>
    <button class="btn acc" id="sGo" style="width:100%;margin-top:10px">Search</button>
    ${inbox ? `<div class="small muted" style="margin-top:10px">Or email photos to <span class="copy" data-copy="${esc(inbox)}">${esc(inbox)}</span>, e.g. from Claude.</div>` : ''}
  </div>
  ${S.reqs.map(reqCard).join('') || ''}`
  $('#sGo', v).onclick = async (e) => {
    const text = $('#sT', v).value.trim(); if (!text && !$('#sF', v).files.length) return toast('Describe what you need')
    e.target.disabled = true; e.target.textContent = 'Uploading…'
    const images = await uploadFiles($('#sF', v).files, 'dopyt')
    const { error } = await sb.from('kargo_requests').insert({ text, images, qty: $('#sQ', v).value || null, target_price: $('#sP', v).value || null })
    if (error) { e.target.disabled = false; e.target.textContent = 'Search'; return toast('❌ ' + error.message) }
    toast(agentOnline() ? 'The agent is searching – takes a few minutes' : 'Saved – search starts when your PC is on', 4000)
    const { data } = await sb.from('kargo_requests').select('*').order('created_at', { ascending: false }).limit(30); S.reqs = data ?? []; renderSrc()
  }
  $('#sF', v).onchange = (e) => ($('#sFn', v).textContent = ' · ' + e.target.files.length)
  $$('[data-rfq]', v).forEach((b) => (b.onclick = () => rfq(b.dataset.rfq)))
  $$('[data-vet]', v).forEach((b) => (b.onclick = async (e) => {
    e.preventDefault()
    const [rid, i] = b.dataset.vet.split(':'); const x = (S.reqs.find((r) => r.id === rid)?.results ?? []).filter((y) => y.pass)[+i]
    if (!x) return
    let p = S.places.find((q) => q.name === x.supplier)
    if (!p) { const { data } = await sb.from('kargo_places').insert({ kind: 'supplier', name: x.supplier, url: x.url, image_url: x.image ?? null, vet_status: 'ask', note: 'From sourcing: ' + (x.title ?? '') }).select().single(); p = data }
    else await sb.from('kargo_places').update({ vet_status: 'ask' }).eq('id', p.id)
    toast('Checking ' + x.supplier + ' – you’ll get a push'); loadAll()
  }))
  $$('[data-rdel]', v).forEach((b) => (b.onclick = async () => { await sb.from('kargo_requests').delete().eq('id', b.dataset.rdel); S.reqs = S.reqs.filter((r) => r.id !== b.dataset.rdel); renderSrc() }))
}
function reqCard(r) {
  const st = { new: 'Waiting for agent', searching: r.progress ?? 'Searching…', done: 'Done', error: 'Error: ' + (r.error ?? '') }[r.status]
  const res = r.results ?? []
  const ok = res.filter((x) => x.pass), bad = res.filter((x) => !x.pass)
  return `<div class="card">
    <div class="row"><div style="flex:3"><b>${esc((r.text ?? 'Request').split('\n')[0].slice(0, 80))}</b><div class="small muted">${r.source === 'email' ? 'email · ' : ''}${r.qty ? esc(r.qty) + ' pcs · ' : ''}${ago(r.created_at)}</div></div>${(r.images ?? [])[0] ? `<div class="ph" style="width:48px;height:48px;border-radius:12px;background:url('${esc(r.images[0])}') center/cover;flex:none"></div>` : ''}</div>
    <div style="margin-top:8px"><span class="tag ${r.status === 'done' ? 'ok' : r.status === 'error' ? 'warn' : 'acc'}">${esc(st)}</span></div>
    ${r.summary ? `<div class="small" style="margin-top:8px">${esc(r.summary)}</div>` : ''}
    ${ok.map((x, i) => `<label class="ord" style="margin-top:12px;align-items:flex-start">
      <div class="ph" style="${x.image ? `background-image:url('${esc(x.image)}')` : ''}"></div>
      <div class="bd"><div class="t">${i === 0 ? '<span class="tag ok">cheapest</span>' : ''}${x.unit_price != null ? `<b>${x.unit_price} $/pc</b>` : esc(x.price_text ?? '')}</div>
        <div class="s">${esc(x.title ?? '')}</div>
        <div class="s">${esc(x.supplier ?? '')}</div>
        <div style="margin-top:4px">${x.supplier_type === 'manufacturer' ? '<span class="tag">manufacturer</span>' : ''}${x.years ? `<span class="tag">${x.years} yrs</span>` : ''}${x.rating ? `<span class="tag">★ ${esc(x.rating)}</span>` : ''}${x.reorder ? `<span class="tag">reorder ${esc(x.reorder)}</span>` : ''}${x.moq ? `<span class="tag">MOQ ${esc(x.moq)}</span>` : ''}</div>
        <div class="small muted" style="margin-top:4px;white-space:normal">${esc(x.why ?? '')}</div>
        <div class="row" style="margin-top:6px;justify-content:flex-start"><input type="checkbox" class="rsel" data-r="${r.id}" value="${i}" ${i < 3 ? 'checked' : ''} style="width:20px;height:20px;flex:none"><a href="${esc(x.url)}" target="_blank" class="small" style="flex:none">Open ↗</a><a href="#" class="small" data-vet="${r.id}:${i}" style="flex:none;margin-left:12px">Check factory</a></div>
      </div></label>`).join('')}
    ${bad.length ? `<details style="margin-top:10px"><summary class="small muted">Failed quality filter (${bad.length})</summary>${bad.map((x) => `<div class="small" style="margin-top:6px"><b>${x.unit_price ?? ''} $</b> ${esc(x.supplier ?? '')} – <span class="muted">${esc(x.reject_reason ?? '')}</span></div>`).join('')}</details>` : ''}
    <div class="row" style="margin-top:12px">${ok.length ? `<button class="btn acc sm" data-rfq="${r.id}" style="flex:2">Message selected</button>` : ''}<button class="btn ghost sm" data-rdel="${r.id}">Delete</button></div>
  </div>`
}
async function rfq(rid) {
  const r = S.reqs.find((x) => x.id === rid)
  const ok = (r.results ?? []).filter((x) => x.pass)
  const sel = $$(`.rsel[data-r="${rid}"]:checked`).map((c) => ok[+c.value]).filter(Boolean)
  if (!sel.length) return toast('Select at least one')
  for (const x of sel) await sb.from('kargo_drafts').insert({ kind: 'rfq', status: 'revise', to_url: x.url, to_name: x.supplier, reason: `Sourcing: ${x.unit_price ?? ''} $/pc · ${x.title?.slice(0, 50) ?? ''}`, text: '(being prepared)', note: `New inquiry to a supplier he never bought from. Product: ${x.title} (${x.url}). Quantity: ${r.qty ?? '?'} pcs. His need: ${(r.text ?? '').slice(0, 400)}. Ask: best unit price at this quantity, MOQ, production lead time, sample cost, and DDP air shipping to Slovakia. Short, his style.` })
  toast(`The agent will draft ${sel.length} messages for approval`, 4000); go('msg')
}

// ================= AGENT NA PC =================
let liveCh = null, liveKey = null, liveLast = 0
function liveSub(on) {
  const key = S.agent?.live_key
  if (!on || !key) { if (liveCh) { sb.removeChannel(liveCh); liveCh = null; liveKey = null } return }
  if (liveCh && liveKey === key) return
  if (liveCh) sb.removeChannel(liveCh)
  liveKey = key
  liveCh = sb.channel('kargo-live-' + key).on('broadcast', { event: 'f' }, ({ payload }) => {
    const img = $('#liveImg'); if (!img) return
    img.src = 'data:image/jpeg;base64,' + payload.d
    liveLast = Date.now()
    const b = $('#liveBadge'); if (b) b.classList.remove('hide')
  }).subscribe()
}
setInterval(() => { const b = $('#liveBadge'); if (b && Date.now() - liveLast > 6000) b.classList.add('hide') }, 2000)
async function setLive(on) {
  liveSub(on); if (!S.user || S.dbMissing) return; await sb.from('kargo_agent').upsert({ owner: S.user.id, live: on }, { onConflict: 'owner' }).then(() => {}, () => {}) }
function renderAgent() {
  const a = S.agent ?? {}
  const v = $('#v-agent')
  const on = agentOnline()
  const counts = (k) => S.threads.filter((t) => t.kind === k).length
  const prevImg = $('#liveImg')?.src
  const streaming = Date.now() - liveLast < 6000
  v.innerHTML = `
  <div class="card"><div class="row"><b><span class="dot ${on ? 'on' : ''}"></span> ${on ? (a.paused ? 'Paused' : 'Running on your PC') : 'Offline'}</b><span class="small muted" style="text-align:right">${a.online_at ? ago(a.online_at) : 'never ran'}</span></div>
  <div style="margin-top:6px">${esc(a.status ?? 'Start Kargo Agent on your PC (guide below).')}</div></div>
  <div style="position:relative">${a.live_url || a.live_key ? `<img class="live" id="liveImg" src="${esc(a.live_url ?? '')}" alt="Agent screen">` : ''}<span id="liveBadge" class="tag hide" style="position:absolute;top:10px;left:10px;background:#ef4444;color:#fff;font-weight:700">● LIVE</span></div>
  <div class="small muted" style="margin:4px 2px">${on ? 'Live while this screen is open' : ''}</div>
  <div class="row" style="margin-top:10px;flex-wrap:wrap">
    <button class="btn sm" data-cmd="sync">Check messages</button>
    <button class="btn sm ghost" data-cmd="orders">Orders</button>
    <button class="btn sm ghost" id="pauseB">${a.paused ? 'Resume' : 'Pause'}</button>
  </div>
  <div class="stats">
    <div class="stat"><b>${S.orders.length}</b><small>orders</small></div>
    <div class="stat"><b>${S.places.filter((p) => p.kind === 'supplier').length}/${S.places.filter((p) => p.kind === 'agent').length}</b><small>factories / agents</small></div>
    <div class="stat"><b>${S.threads.length}</b><small>chats (${counts('cold')} cold)</small></div>
  </div>
  ${apCard(a)}
  <div class="sec"><span>Activity</span></div>
  <div class="card log">${(a.log ?? []).map((l) => `<div><span class="muted">${fmtDT(l.t)}</span> ${esc(l.m)}</div>`).join('') || '<span class="muted">Nothing yet.</span>'}</div>
  ${a.style ? `<div class="sec"><span>Your writing style (learned)</span></div><div class="card small" style="white-space:pre-wrap">${esc(a.style)}</div>` : ''}
  <div class="sec"><span>Settings</span></div>
  <div class="card">
    <button class="btn ghost" id="pushB" style="width:100%">Enable notifications on this phone</button>
    <button class="btn ghost" id="compB" style="width:100%;margin-top:8px">Company details (for invoices)${a.company?.name ? ' ✅' : ''}</button>
    <button class="btn ghost" id="widB" style="width:100%;margin-top:8px">Home-screen widget</button>
    <button class="btn ghost" id="homeB" style="width:100%;margin-top:8px">Delivery address: ${esc(S.home?.name ?? 'Bratislava (set)')}</button>
    <button class="btn ghost sm" data-cmd="full_sync" style="width:100%;margin-top:8px">Re-sync all of Alibaba</button>
    <button class="btn ghost sm" id="outB" style="width:100%;margin-top:8px">Sign out</button>
  </div>
  <details class="card"><summary><b>How to run the agent on your PC</b></summary>
  <ol class="small" style="padding-left:18px">
   <li>Unzip <b>kargo-agent.zip</b>, e.g. into Documents.</li>
   <li>Double-click <b>1-instalacia.bat</b> (installs everything and adds the agent to Windows startup).</li>
   <li>Open <b>config.json</b>, fill in email + password (same as here) and your Gemini key.</li>
   <li>Double-click <b>2-spustit.bat</b> → a browser opens → sign in to Alibaba and do the short setup (~3 min).</li>
   <li>Leave it running. Watch and approve from your phone.</li></ol></details>`
  if (streaming && prevImg && $('#liveImg')) { $('#liveImg').src = prevImg; $('#liveBadge')?.classList.remove('hide') }
  else if (prevImg && $('#liveImg') && prevImg.split('?')[0] === a.live_url?.split('?')[0]) { const img = $('#liveImg'); img.src = prevImg; const n = new Image(); n.onload = () => (img.src = n.src); n.src = a.live_url }
  $$('[data-cmd]', v).forEach((bt) => (bt.onclick = async () => { await sb.from('kargo_agent').upsert({ owner: S.user.id, command: bt.dataset.cmd, command_at: new Date().toISOString() }, { onConflict: 'owner' }); toast(on ? 'Sent to agent ✅' : 'Agent offline – will do it when back') }))
  if ($('#apT', v)) $('#apT', v).onchange = (e) => saveAp({ enabled: e.target.checked })
  $$('[data-apr]', v).forEach((c) => (c.onchange = () => { const r = { ...(S.agent.autopilot?.rules ?? {}) }; r[c.dataset.apr] = { ...(r[c.dataset.apr] ?? {}), auto: c.checked }; saveAp({ rules: r }) }))
  if ($('#apMax', v)) $('#apMax', v).onchange = (e) => saveAp({ daily_max: parseInt(e.target.value) || 30 })
  if ($('#apHour', v)) $('#apHour', v).onchange = (e) => saveAp({ digest_hour: parseInt(e.target.value) })
  $('#pauseB', v).onclick = async () => { await sb.from('kargo_agent').upsert({ owner: S.user.id, paused: !a.paused }, { onConflict: 'owner' }); S.agent = { ...a, paused: !a.paused }; renderAgent(); renderAgentPill() }
  $('#pushB', v).onclick = enablePush
  $('#homeB', v).onclick = openSettings
  $('#compB', v).onclick = openCompany
  $('#widB', v).onclick = openWidget
  $('#outB', v).onclick = async () => { try { localStorage.removeItem(CRED) } catch (_) {} await sb.auth.signOut(); location.reload() }
}
setInterval(async () => { if (S.tab !== 'agent' || document.hidden) return; const { data } = await sb.from('kargo_agent').select('*').maybeSingle(); if (data) { S.agent = data; renderAgentPill(); liveSub(true); const img = $('#liveImg'); if (Date.now() - liveLast < 6000) { /* streaming */ } else if (img && data.live_url && data.live_url !== img.src) { const n = new Image(); n.onload = () => (img.src = n.src); n.src = data.live_url; $('#v-agent .card div[style]') && ($('#v-agent .card div[style]').textContent = data.status ?? '') } else if (!img && data.live_url) renderAgent() } }, 3000)
async function openWidget() {
  let key = S.agent?.widget_key
  if (!key) {
    key = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('')
    const { error } = await sb.from('kargo_agent').upsert({ owner: S.user.id, widget_key: key }, { onConflict: 'owner' })
    if (error) return toast('❌ ' + error.message)
    S.agent = { ...(S.agent ?? {}), widget_key: key }
  }
  let tpl = ''
  try { tpl = await (await fetch('widget-template.js', { cache: 'no-store' })).text() } catch (_) {}
  const code = tpl.replace('__KEY__', key).replace('__APP__', location.origin + location.pathname)
  sheet(`<h2 style="margin:4px 0 8px">Home-screen widget</h2>
  <div class="small muted">Shows your next parcels, status, arrival date and how many messages wait for approval. Refreshes about every 20 minutes. Tap opens Kargo.</div>
  <ol class="small" style="padding-left:18px;line-height:1.7;margin-top:12px">
    <li>Install the free app <b>Scriptable</b> from the App Store.</li>
    <li>Tap <b>Copy widget code</b> below.</li>
    <li>In Scriptable tap <b>+</b>, paste, and name the script <b>Kargo</b>.</li>
    <li>Long-press your Home Screen → <b>+</b> → <b>Scriptable</b> → pick a size → <b>Add Widget</b>.</li>
    <li>Long-press the widget → <b>Edit Widget</b> → Script: <b>Kargo</b>.</li>
  </ol>
  <button class="btn acc" id="wCopy" style="width:100%;margin-top:8px">Copy widget code</button>
  <a class="btn ghost" href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" style="width:100%;margin-top:8px">Get Scriptable ↗</a>
  <button class="btn bad sm" id="wReset" style="margin-top:16px">Reset key (old widgets stop working)</button>`, (b) => {
    $('#wCopy', b).onclick = () => code ? copy(code, 'Widget code copied ✅') : toast('Could not load the template')
    $('#wReset', b).onclick = async () => { await sb.from('kargo_agent').update({ widget_key: null }).eq('owner', S.user.id); S.agent.widget_key = null; openWidget() }
  })
}
function apCard(a) {
  const ap = a.autopilot ?? {}
  const rules = ap.rules ?? Object.fromEntries(Object.keys(AP_CATS).map((k) => [k, { auto: !['confirm_details', 'follow_up'].includes(k), count: 0 }]))
  const today = S.drafts.filter((d) => d.auto && new Date(d.created_at).toDateString() === new Date().toDateString()).length
  return `<div class="card">
    <div class="row"><div style="flex:3"><b>Autopilot</b><div class="small muted">${ap.learned_at ? `Set up from your history${ap.routine_share != null ? ` – ${ap.routine_share}% of your messages were routine` : ''}` : 'Will be set up from your history after the first sync'}</div></div>
    <label class="sw"><input type="checkbox" id="apT" ${ap.enabled ? 'checked' : ''}><span></span></label></div>
    ${ap.enabled ? `<div class="small" style="margin-top:8px;color:var(--ok)">${today ? `Sent ${today} message${today > 1 ? 's' : ''} by itself today` : 'Active – routine replies go out without asking you'}</div>` : ''}
    <div class="sec" style="margin-top:14px"><span>Sends by itself</span></div>
    ${Object.entries(AP_CATS).map(([k, [l, d]]) => `<label class="row" style="padding:9px 0;border-bottom:1px solid var(--line)"><div style="flex:4"><div style="font-size:14px">${l}</div><div class="small muted">${d}${rules[k]?.count ? `${d ? ' · ' : ''}you did this ${rules[k].count}×` : ''}</div></div><span class="sw"><input type="checkbox" data-apr="${k}" ${rules[k]?.auto ? 'checked' : ''}><span></span></span></label>`).join('')}
    <div class="sec"><span>Always asks you</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${AP_LOCKED.map((x) => `<span class="tag">🔒 ${x}</span>`).join('')}</div>
    <div class="row" style="margin-top:14px"><div><label class="f">Max per day</label><input class="in" id="apMax" inputmode="numeric" value="${ap.daily_max ?? 30}"></div><div><label class="f">Evening summary</label><select class="in" id="apHour">${[17, 18, 19, 20, 21, 22].map((h) => `<option value="${h}" ${(ap.digest_hour ?? 20) === h ? 'selected' : ''}>${h}:00</option>`).join('')}</select></div></div>
  </div>`
}
async function saveAp(patch) {
  const ap = { ...(S.agent?.autopilot ?? {}), ...patch, user_set: true }
  if (!ap.rules) ap.rules = Object.fromEntries(Object.keys(AP_CATS).map((k) => [k, { auto: !['confirm_details', 'follow_up'].includes(k), count: 0 }]))
  const { error } = await sb.from('kargo_agent').upsert({ owner: S.user.id, autopilot: ap }, { onConflict: 'owner' })
  if (error) return toast('❌ ' + error.message)
  S.agent = { ...(S.agent ?? {}), autopilot: ap }; toast(patch.enabled === false ? 'Autopilot off – everything comes to you' : 'Saved'); renderAgent()
}
function openCompany() {
  const c = S.agent?.company ?? {}
  const F = [['name', 'Company name'], ['address', 'Address (street, ZIP, city, Slovakia)'], ['ico', 'Company ID (IČO)'], ['dic', 'Tax ID (DIČ)'], ['icdph', 'VAT ID (IČ DPH)'], ['eori', 'EORI'], ['email', 'Invoice email'], ['phone', 'Phone'], ['mark', 'Shipping mark (carton marking)'], ['accountant_name', 'Accountant name'], ['accountant_email', 'Accountant email (invoices are sent here automatically)']]
  sheet(`<h2 style="margin:4px 0 8px">Company details</h2><div class="small muted">Sent to factories when requesting invoices. The shipping mark is sent with your agent’s address when goods are ready.</div>
  ${F.map(([k, n]) => `<label class="f">${n}</label>${k === 'address' ? `<textarea class="in" id="c_${k}" style="min-height:60px">${esc(c[k] ?? '')}</textarea>` : `<input class="in" id="c_${k}" value="${esc(c[k] ?? '')}">`}`).join('')}
  <label class="row" style="margin-top:14px;gap:10px;justify-content:flex-start"><input type="checkbox" id="c_auto" ${c.auto_invoice === false ? '' : 'checked'} style="width:22px;height:22px;flex:none"><span class="small">Email every new invoice to the accountant automatically</span></label>
  <button class="btn" id="cSave" style="width:100%;margin-top:14px">Save</button>`, (b) => {
    $('#cSave', b).onclick = async () => {
      const company = Object.fromEntries(F.map(([k]) => [k, $('#c_' + k, b).value.trim()]))
      company.auto_invoice = $('#c_auto', b).checked
      const { error } = await sb.from('kargo_agent').upsert({ owner: S.user.id, company }, { onConflict: 'owner' })
      if (error) return toast('❌ ' + error.message)
      S.agent = { ...(S.agent ?? {}), company }; closeSheet(); toast('Saved ✅'); if (S.tab === 'agent') renderAgent()
    }
  })
}
function openSettings() { editPlace(S.home ?? { kind: 'home', name: 'Bratislava', city: 'Bratislava', lat: G.DEFAULT_HOME.lat, lng: G.DEFAULT_HOME.lng }) }

// ================= PUSH =================
const b64u = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))) }
async function enablePush() {
  const steps = []
  const show = () => sheet(`<h2 style="margin:4px 0 8px">Notifications</h2><div class="card" style="padding:6px 16px">${steps.map(([ok, t, d]) => `<div style="padding:9px 0;border-bottom:1px solid var(--line)"><b style="color:${ok === true ? 'var(--ok)' : ok === false ? 'var(--bad)' : 'var(--mut)'}">${ok === true ? '✓' : ok === false ? '✕' : '…'}</b> ${t}${d ? `<div class="small muted">${esc(d)}</div>` : ''}</div>`).join('')}</div>`)
  const step = (ok, t, d) => { steps.push([ok, t, d]); show() }
  try {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone
    step(!!standalone, 'Opened from the Home Screen', standalone ? '' : 'iPhone allows notifications only in the app added to the Home Screen (Share → Add to Home Screen) – open Kargo from that icon.')
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return step(false, 'Push supported on this device', 'Needs iOS 16.4+ and the Home Screen app.')
    step(true, 'Push supported on this device')
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return step(false, 'Permission', 'Blocked – iPhone Settings → Notifications → Kargo → Allow.')
    step(true, 'Permission granted')
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (sub && sub.options?.applicationServerKey && btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== VAPID_PUBLIC) { await sub.unsubscribe(); sub = null }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID_PUBLIC) })
    step(true, 'Device registered', sub.endpoint.split('/')[2])
    const j = sub.toJSON()
    const { error } = await sb.from('kargo_push').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
    if (error) return step(false, 'Saved to database', error.message)
    step(true, 'Saved to database')
    let r
    try { r = await fn({ action: 'test-push' }) } catch (e) { return step(false, 'Server function kargo-track', e.message + ' – deploy kargo-track.ts and turn off “Enforce JWT verification”.') }
    if (!r?.sent) return step(false, 'Test notification', 'The server found no device or the push service refused it. Tap again in a minute; if it repeats, send Claude a screenshot.')
    step(true, 'Test notification sent', 'It should appear in a few seconds.')
  } catch (e) { step(false, 'Error', e.message) }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})
boot()
