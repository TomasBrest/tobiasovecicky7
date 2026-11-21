// JARVIS – mobilná appka
const SUPABASE_URL = 'https://xkmcohzferzcqgmcbynv.supabase.co'
const SUPABASE_KEY = 'sb_publishable_EDk2wVXCJH8wH5I_AZCUkg_aXLlXdsr'
const VAPID_PUBLIC = 'BF7Z_yI2HCobMvr2IqaAA5JtKawWKZPYbdxVM_oLWfMsQDE8GPfaZh2sh3xjX8Hs-X1ZZdT8v1kswyhLiSgjM4A'
const FN = 'jarvis-fn'
const FN_URL = SUPABASE_URL + '/functions/v1/' + FN
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'jarvis-auth' } })

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const HM = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const DAY = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const ago = (d) => { const m = (Date.now() - new Date(d)) / 60000; return m < 1 ? 'now' : m < 60 ? `${Math.round(m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago` }
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const AREAS = { school: ['School', '#60a5fa'], spectrum: ['Spectrum', '#f59e0b'], lanac: ['Lanáč', '#a78bfa'], personal: ['Personal', '#34d399'], other: ['Other', '#8e8e96'] }
const area = (a) => { const [n, c] = AREAS[a] ?? AREAS.other; return `<span class="tag" style="background:${c}22;color:${c}">${n}</span>` }

const S = { user: null, profile: null, tasks: [], events: [], mail: [], drafts: [], school: [], wake: [], tab: 'today', tf: 'open', sf: 'week' }
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

// ================= PRIHLÁSENIE: meno skryté, zapamätané na zariadení, Google Authenticator =================
const toEmail = (u) => (u.includes('@') ? u : u.trim().toLowerCase() + '@kargo.app')
const CRED = 'jarvis-remember'
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
async function boot() {
  let { data: { session } } = await sb.auth.getSession()
  if (!session) { const c = loadCred(); if (c) { const r = await sb.auth.signInWithPassword({ email: c[0], password: c[1] }); session = r.data?.session ?? null } }
  if (!session) return showLogin(1)
  if (await needsCode()) return showLogin(2)
  S.user = session.user
  $('#login').classList.add('hide'); $('#app').classList.remove('hide')
  await loadAll()
  const q = new URLSearchParams(location.search)
  history.replaceState(null, '', location.pathname)
  go(q.get('tab') ?? 'today')
  if (q.get('wake')) openWake()
  setInterval(refreshLight, 20000)
  try { sb.channel('jarvis').on('postgres_changes', { event: '*', schema: 'public', table: 'jarvis_drafts' }, refreshLight).subscribe() } catch (_) {}
}
$('#lGo').onclick = async () => {
  const e = toEmail($('#lUser').value.trim()), p = $('#lPass').value
  $('#lMsg').textContent = 'Signing in…'
  const { error } = await sb.auth.signInWithPassword({ email: e, password: p })
  if (error) return ($('#lMsg').textContent = '❌ ' + (/invalid/i.test(error.message) ? 'Wrong username or password' : error.message))
  saveCred(e, p)
  if (await needsCode()) return showLogin(2, 'One more step.')
  location.reload()
}
$('#lPass').onkeydown = (ev) => { if (ev.key === 'Enter') $('#lGo').click() }
$('#lVerify').onclick = async () => {
  const code = $('#lCode').value.replace(/\D/g, '')
  const { data: f } = await sb.auth.mfa.listFactors()
  const t = (f?.totp ?? [])[0]
  if (!t) return location.reload()
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: t.id, code })
  if (error) return ($('#lMsg').textContent = '❌ Wrong code')
  location.reload()
}
$('#lCode').oninput = (e) => { if (e.target.value.replace(/\D/g, '').length === 6) $('#lVerify').click() }

// ================= DÁTA =================
async function loadAll() {
  const from = new Date(Date.now() - 2 * 864e5).toISOString(), to = new Date(Date.now() + 21 * 864e5).toISOString()
  const r = await Promise.all([
    sb.from('jarvis_profile').select('*').maybeSingle(),
    sb.from('jarvis_tasks').select('*').order('due_at', { ascending: true, nullsFirst: false }).limit(400),
    sb.from('jarvis_events').select('*').gte('starts_at', from).lte('starts_at', to).order('starts_at').limit(500),
    sb.from('jarvis_mail').select('*').order('date', { ascending: false }).limit(80),
    sb.from('jarvis_drafts').select('*').order('created_at', { ascending: false }).limit(60),
    sb.from('jarvis_school').select('*').order('due_at', { ascending: true, nullsFirst: false }).limit(300),
    sb.from('jarvis_wake').select('*').order('day', { ascending: false }).limit(30),
  ])
  if (r.some((x) => x.error && /does not exist|schema cache/i.test(x.error.message))) toast('🚧 Run supabase-jarvis.sql first', 6000)
  ;[S.profile, S.tasks, S.events, S.mail, S.drafts, S.school, S.wake] = r.map((x, i) => x.data ?? (i === 0 ? null : []))
  if (!S.profile) { await sb.from('jarvis_profile').upsert({ owner: S.user.id }, { onConflict: 'owner' }); S.profile = { owner: S.user.id, settings: {} } }
  render()
}
async function refreshLight() {
  const [d, p] = await Promise.all([sb.from('jarvis_drafts').select('*').order('created_at', { ascending: false }).limit(60), sb.from('jarvis_profile').select('*').maybeSingle()])
  if (d.data) S.drafts = d.data
  if (p.data) S.profile = p.data
  badge(); pill()
  if (S.tab === 'mail' && !document.activeElement?.closest?.('#v-mail')) renderMail()
}
const online = () => S.profile?.online_at && Date.now() - new Date(S.profile.online_at) < 120000
function pill() { $('#agentDot').classList.toggle('on', !!online()); $('#agentTxt').textContent = online() ? 'PC agent on' : 'PC agent off' }
function badge() { const n = S.drafts.filter((d) => d.status === 'pending').length; $('#badge').textContent = n; $('#badge').classList.toggle('hide', !n) }
function render() { badge(); pill(); ({ today: renderToday, tasks: renderTasks, mail: renderMail, school: renderSchool, more: renderMore })[S.tab]() }
$('#agentPill').onclick = () => go('more')

const TITLES = { today: 'Today', tasks: 'Tasks', mail: 'Mail', school: 'School', more: 'More' }
function go(tab) {
  S.tab = tab
  $$('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab))
  $$('.view').forEach((v) => v.classList.toggle('hide', v.id !== 'v-' + tab))
  $('#title').textContent = TITLES[tab]
  render()
}
$$('nav button').forEach((b) => (b.onclick = () => go(b.dataset.tab)))

// ================= TODAY =================
function taskRow(t) {
  const over = t.due_at && new Date(t.due_at) < new Date() && !t.done
  return `<div class="task" data-t="${t.id}"><div class="chk ${t.done ? 'on' : ''}" data-done="${t.id}">${t.done ? '<svg viewBox="0 0 24 24" width="14" height="14" stroke="#022c1e" stroke-width="3" fill="none"><path d="M5 12l5 5 9-9"/></svg>' : ''}</div>
  <div style="flex:1;min-width:0"><div class="t" style="${t.done ? 'text-decoration:line-through;color:var(--mut)' : ''}">${esc(t.title)}</div>
  <div class="s ${over ? 'over' : ''}">${area(t.area)}${t.due_at ? (over ? 'overdue · ' : '') + DAY(t.due_at) + ' ' + HM(t.due_at) : ''}${t.source === 'mail' ? ' · from email' : t.source === 'ais' ? ' · AIS' : ''}</div></div></div>`
}
function bindTasks(root) {
  $$('[data-done]', root).forEach((c) => (c.onclick = async (e) => { e.stopPropagation(); const t = S.tasks.find((x) => x.id === c.dataset.done); t.done = !t.done; await sb.from('jarvis_tasks').update({ done: t.done, done_at: t.done ? new Date().toISOString() : null }).eq('id', t.id); render() }))
  $$('[data-t]', root).forEach((c) => (c.onclick = () => editTask(S.tasks.find((x) => x.id === c.dataset.t))))
}
function renderToday() {
  const v = $('#v-today')
  const now = new Date(), eod = new Date(startOfDay().getTime() + 864e5)
  const h = now.getHours()
  const hello = h < 5 ? 'Still up?' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const todayEv = S.events.filter((e) => new Date(e.starts_at) >= startOfDay() && new Date(e.starts_at) < eod)
  const next = S.events.find((e) => new Date(e.ends_at ?? e.starts_at) > now)
  const due = S.tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at) < new Date(eod.getTime() + 864e5)).slice(0, 8)
  const nodate = S.tasks.filter((t) => !t.done && !t.due_at).slice(0, 4)
  const pend = S.drafts.filter((d) => d.status === 'pending').length
  const newGrades = S.school.filter((s) => s.kind === 'grade' && !s.seen)
  const todayKey = new Date().toLocaleDateString('en-CA')
  const wT = S.wake.find((w) => w.day === todayKey)
  const tmr = new Date(Date.now() + 864e5).toLocaleDateString('en-CA')
  const wN = S.wake.find((w) => w.day === tmr)
  v.innerHTML = `
  <div class="hello">${hello}, Tomáš · ${now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
  <div class="card" id="wakeCard">
    <div class="row"><div style="flex:3"><div class="small muted">Wake up</div>
    ${wT?.status === 'up' ? `<b style="font-size:20px;color:var(--ok)">Up at ${HM(wT.proof_at)} ✓</b>` : wT?.status === 'missed' ? `<b style="font-size:20px;color:var(--bad)">Missed today</b>` : wT?.alarm_at ? `<b style="font-size:20px">${HM(wT.alarm_at)}</b> <span class="small muted">today</span>` : '<b style="font-size:20px">No alarm today</b>'}
    <div class="small muted" style="margin-top:4px">${wN?.alarm_at ? `Tomorrow ${HM(wN.alarm_at)} · ${esc(wN.first_event ?? wN.reason ?? '')}` : 'Tomorrow’s alarm is set in the evening'}</div></div>
    ${wT?.status !== 'up' ? '<button class="btn acc sm" id="iAmUp" style="flex:none">I’m up</button>' : ''}</div>
  </div>
  ${next ? `<div class="card"><div class="small muted">Next</div><b style="font-size:18px">${esc(next.title)}</b><div class="small muted">${DAY(next.starts_at)} · ${HM(next.starts_at)}${next.ends_at ? '–' + HM(next.ends_at) : ''}${next.place ? ' · ' + esc(next.place) : ''}</div></div>` : ''}
  <div class="stats">
    <div class="stat" data-go="tasks"><b>${S.tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at) < eod).length}</b><small>due today</small></div>
    <div class="stat" data-go="mail"><b>${pend}</b><small>to approve</small></div>
    <div class="stat" data-go="school"><b>${todayEv.filter((e) => e.kind === 'class').length}</b><small>classes today</small></div>
  </div>
  ${newGrades.length ? `<div class="card" id="grades"><div class="small muted">New grades</div>${newGrades.map((g) => `<div style="margin-top:4px"><b>${esc(g.subject)}</b> · ${esc(g.title ?? '')} → <b style="color:var(--acc2)">${esc(g.value)}</b></div>`).join('')}<div class="small muted" style="margin-top:6px">Tap to mark as seen</div></div>` : ''}
  <div class="sec"><span>Today’s schedule</span></div>
  <div class="card" style="padding:4px 16px">${todayEv.length ? todayEv.map((e) => `<div class="cls"><div class="tm">${HM(e.starts_at)}<small>${e.ends_at ? HM(e.ends_at) : ''}</small></div><div><div>${esc(e.title)}</div><div class="small muted">${esc(e.place ?? '')}${e.kind === 'exam' ? ' · exam' : ''}</div></div></div>`).join('') : '<div class="muted small" style="padding:12px 0">Nothing scheduled.</div>'}</div>
  <div class="sec"><span>Due soon</span></div>
  <div class="card" style="padding:0 16px">${due.length ? due.map(taskRow).join('') : '<div class="muted small" style="padding:12px 0">Nothing due – nice.</div>'}</div>
  ${nodate.length ? `<div class="sec"><span>Also open</span></div><div class="card" style="padding:0 16px">${nodate.map(taskRow).join('')}</div>` : ''}
  <div class="search" style="margin-top:14px"><input id="quick" placeholder="Add a task… e.g. “call landlord fri 15:00”"><span id="quickGo" style="color:var(--acc2);padding:8px;font-weight:600">Add</span></div>`
  bindTasks(v)
  $$('[data-go]', v).forEach((s) => (s.onclick = () => go(s.dataset.go)))
  if ($('#iAmUp', v)) $('#iAmUp', v).onclick = openWake
  if ($('#grades', v)) $('#grades', v).onclick = async () => { await sb.from('jarvis_school').update({ seen: true }).in('id', newGrades.map((g) => g.id)); newGrades.forEach((g) => (g.seen = true)); renderToday() }
  $('#quickGo', v).onclick = () => quickAdd($('#quick', v).value)
  $('#quick', v).onkeydown = (e) => { if (e.key === 'Enter') quickAdd(e.target.value) }
}
// rýchle pridanie: „zavolať prenajímateľovi pi 15:00“ / „tomorrow“ / „27.11.“
function parseDue(s) {
  const now = new Date(); let d = null, t = null, txt = s
  const days = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0, po: 1, ut: 2, st: 3, št: 4, stv: 4, pi: 5, so: 6, ne: 0 }
  const tm = txt.match(/\b(\d{1,2}):(\d{2})\b/); if (tm) { t = [+tm[1], +tm[2]]; txt = txt.replace(tm[0], '') }
  if (/\b(today|dnes)\b/i.test(txt)) { d = new Date(now); txt = txt.replace(/\b(today|dnes)\b/i, '') }
  else if (/\b(tomorrow|zajtra)\b/i.test(txt)) { d = new Date(now.getTime() + 864e5); txt = txt.replace(/\b(tomorrow|zajtra)\b/i, '') }
  const dm = txt.match(/\b(\d{1,2})\.\s?(\d{1,2})\.?/); if (dm) { d = new Date(now.getFullYear(), +dm[2] - 1, +dm[1]); if (d < startOfDay()) d.setFullYear(d.getFullYear() + 1); txt = txt.replace(dm[0], '') }
  const wd = txt.match(/\b(mon|tue|wed|thu|fri|sat|sun|po|ut|st|št|pi|so|ne)\b/i)
  if (!d && wd) { const target = days[wd[1].toLowerCase()]; d = new Date(now); let k = (target - d.getDay() + 7) % 7; if (k === 0) k = 7; d.setDate(d.getDate() + k); txt = txt.replace(wd[0], '') }
  if (t && !d) d = new Date(now)
  if (d) { d.setHours(t ? t[0] : 18, t ? t[1] : 0, 0, 0) }
  return { title: txt.replace(/\s+/g, ' ').trim(), due: d }
}
async function quickAdd(s) {
  if (!s?.trim()) return
  const { title, due } = parseDue(s)
  const { data, error } = await sb.from('jarvis_tasks').insert({ title: title || s, due_at: due?.toISOString() ?? null, area: 'personal' }).select().single()
  if (error) return toast('❌ ' + error.message)
  S.tasks.push(data); toast(due ? `Added · ${DAY(due)} ${HM(due)}` : 'Added'); render()
}

// ================= TASKS =================
function renderTasks() {
  const v = $('#v-tasks')
  const F = { open: (t) => !t.done, school: (t) => !t.done && t.area === 'school', spectrum: (t) => !t.done && t.area === 'spectrum', lanac: (t) => !t.done && t.area === 'lanac', personal: (t) => !t.done && t.area === 'personal', done: (t) => t.done }
  const N = { open: 'Open', school: 'School', spectrum: 'Spectrum', lanac: 'Lanáč', personal: 'Personal', done: 'Done' }
  const list = S.tasks.filter(F[S.tf])
  const eod = new Date(startOfDay().getTime() + 864e5), eow = new Date(startOfDay().getTime() + 7 * 864e5)
  const groups = S.tf === 'done' ? [['Done', list.slice(-50).reverse()]] : [
    ['Overdue', list.filter((t) => t.due_at && new Date(t.due_at) < new Date())],
    ['Today', list.filter((t) => t.due_at && new Date(t.due_at) >= new Date() && new Date(t.due_at) < eod)],
    ['This week', list.filter((t) => t.due_at && new Date(t.due_at) >= eod && new Date(t.due_at) < eow)],
    ['Later', list.filter((t) => t.due_at && new Date(t.due_at) >= eow)],
    ['No date', list.filter((t) => !t.due_at)],
  ]
  v.innerHTML = `<div class="chips">${Object.keys(F).map((k) => `<span class="chip ${S.tf === k ? 'on' : ''}" data-f="${k}">${N[k]}<b>${S.tasks.filter(F[k]).length}</b></span>`).join('')}</div>
  <button class="btn acc" id="addT" style="width:100%;margin-top:12px">New task</button>
  ${groups.filter(([, l]) => l.length).map(([n, l]) => `<div class="sec"><span>${n}</span></div><div class="card" style="padding:0 16px">${l.map(taskRow).join('')}</div>`).join('') || '<div class="empty">No tasks here.</div>'}`
  $$('.chip', v).forEach((c) => (c.onclick = () => { S.tf = c.dataset.f; renderTasks() }))
  $('#addT', v).onclick = () => editTask()
  bindTasks(v)
}
function editTask(t = null) {
  const ed = !!t; t = t ?? { area: 'personal' }
  const dt = t.due_at ? new Date(new Date(t.due_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
  sheet(`<h2 style="margin:4px 0 8px">${ed ? 'Task' : 'New task'}</h2>
  <label class="f">What</label><input class="in" id="tT" value="${esc(t.title ?? '')}">
  <label class="f">Due</label><input class="in" id="tD" type="datetime-local" value="${dt}">
  <label class="f">Area</label><div class="chips" id="tA">${Object.entries(AREAS).map(([k, [n]]) => `<span class="chip ${t.area === k ? 'on' : ''}" data-a="${k}">${n}</span>`).join('')}</div>
  <label class="f">Note</label><textarea class="in" id="tN">${esc(t.note ?? '')}</textarea>
  ${t.url ? `<a class="btn ghost sm" href="${esc(t.url)}" target="_blank" style="margin-top:10px">Open link ↗</a>` : ''}
  <button class="btn acc" id="tS" style="width:100%;margin-top:14px">Save</button>
  ${ed ? '<button class="btn bad sm" id="tX" style="margin-top:12px">Delete</button>' : ''}`, (b) => {
    let a = t.area
    $$('[data-a]', b).forEach((c) => (c.onclick = () => { a = c.dataset.a; $$('[data-a]', b).forEach((x) => x.classList.toggle('on', x === c)) }))
    $('#tS', b).onclick = async () => {
      const row = { title: $('#tT', b).value.trim(), due_at: $('#tD', b).value ? new Date($('#tD', b).value).toISOString() : null, area: a, note: $('#tN', b).value || null, reminded: 0 }
      if (!row.title) return toast('Write the task')
      const r = ed ? await sb.from('jarvis_tasks').update(row).eq('id', t.id).select().single() : await sb.from('jarvis_tasks').insert(row).select().single()
      if (r.error) return toast('❌ ' + r.error.message)
      if (ed) Object.assign(t, r.data); else S.tasks.push(r.data)
      closeSheet(); render()
    }
    if ($('#tX', b)) $('#tX', b).onclick = async () => { await sb.from('jarvis_tasks').delete().eq('id', t.id); S.tasks = S.tasks.filter((x) => x.id !== t.id); closeSheet(); render() }
  })
}

// ================= MAIL =================
function renderMail() {
  const v = $('#v-mail')
  const pend = S.drafts.filter((d) => d.status === 'pending')
  const mailOf = (id) => S.mail.find((m) => m.id === id)
  const imp = S.mail.filter((m) => m.category !== 'spam' && m.category !== 'newsletter').slice(0, 40)
  v.innerHTML = `
  ${!online() ? '<div class="card small" style="background:rgba(251,191,36,.08)">The PC agent is off – new mail is not read and approved replies wait until it runs.</div>' : ''}
  <div class="sec"><span>Replies to approve (${pend.length})</span></div>
  ${pend.map((d) => { const m = mailOf(d.mail_id); return `<div class="card">
    <div class="row"><div style="flex:3"><b>${esc(m?.from_name || d.to_addr)}</b> ${m ? area(m.area) : ''}</div><span class="small muted" style="text-align:right">${ago(d.created_at)}</span></div>
    <div class="small muted">${esc(d.subject)}</div>
    ${d.reason ? `<div class="why" style="color:var(--acc2)">${esc(d.reason)}</div>` : ''}
    ${m?.snippet ? `<div class="them" style="background:var(--card2);border-radius:14px;padding:10px 12px;margin:10px 0;font-size:13.5px;max-height:120px;overflow:auto">${esc(m.snippet)}</div>` : ''}
    <textarea id="d-${d.id}" class="in" style="min-height:110px;background:var(--bg)">${esc(d.text)}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn bad sm" data-no="${d.id}" style="flex:.6">✕</button><button class="btn ghost sm" data-rv="${d.id}">Rewrite</button><button class="btn ok" data-ok="${d.id}" style="flex:1.4">Send</button></div>
  </div>` }).join('') || '<div class="empty">Nothing to approve.</div>'}
  <div class="sec"><span>Recent email</span></div>
  <div class="card" style="padding:4px 16px">${imp.map((m) => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row"><b style="flex:3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.from_name || m.from_addr)}</b><span class="small muted" style="text-align:right">${ago(m.date)}</span></div><div class="small">${area(m.area)}${m.needs_reply && !m.handled ? '<span class="tag acc">reply</span>' : ''}${esc(m.summary ?? m.subject)}</div></div>`).join('') || '<div class="muted small" style="padding:12px 0">The PC agent reads your Gmail every 5 minutes.</div>'}</div>`
  $$('[data-ok]', v).forEach((b) => (b.onclick = () => decide(b.dataset.ok, 'approved')))
  $$('[data-no]', v).forEach((b) => (b.onclick = () => decide(b.dataset.no, 'rejected')))
  $$('[data-rv]', v).forEach((b) => (b.onclick = async () => { const note = prompt('How should it change? (e.g. “more formal”, “say I can come Thursday”)'); if (!note) return; await sb.from('jarvis_drafts').update({ status: 'revise', note }).eq('id', b.dataset.rv); toast('Rewriting…'); refreshLight() }))
}
async function decide(id, st) {
  const patch = { status: st, decided_at: new Date().toISOString() }
  const ta = $('#d-' + id); if (ta) patch.text = ta.value
  await sb.from('jarvis_drafts').update(patch).eq('id', id)
  Object.assign(S.drafts.find((d) => d.id === id) ?? {}, patch)
  toast(st === 'approved' ? (online() ? 'Sending…' : 'Will send when your PC is on') : 'Discarded'); badge(); renderMail()
}

// ================= SCHOOL =================
function renderSchool() {
  const v = $('#v-school')
  const now = new Date()
  const days = []
  for (let i = 0; i < 7; i++) {
    const d0 = new Date(startOfDay().getTime() + i * 864e5), d1 = new Date(d0.getTime() + 864e5)
    const ev = S.events.filter((e) => new Date(e.starts_at) >= d0 && new Date(e.starts_at) < d1 && ['class', 'exam'].includes(e.kind))
    if (ev.length) days.push([d0, ev])
  }
  const asg = S.school.filter((s) => s.kind === 'assignment' && s.value !== 'submitted').sort((a, b) => String(a.due_at ?? '9').localeCompare(String(b.due_at ?? '9')))
  const exams = S.school.filter((s) => s.kind === 'exam' && s.due_at && new Date(s.due_at) > now)
  const grades = S.school.filter((s) => s.kind === 'grade').slice(-30).reverse()
  v.innerHTML = `
  ${!S.events.some((e) => e.source === 'ais') ? '<div class="card small muted">Your timetable, assignments, grades and exams come from AIS via the PC agent (first run: <b>node src\\index.js --learn</b>).</div>' : ''}
  <div class="sec"><span>Next 7 days</span></div>
  ${days.map(([d, ev]) => `<div class="day"><h4>${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</h4><div class="card" style="padding:4px 16px;margin:0">${ev.map((e) => `<div class="cls"><div class="tm">${HM(e.starts_at)}<small>${e.ends_at ? HM(e.ends_at) : ''}</small></div><div><div>${e.kind === 'exam' ? '<span class="tag warn">exam</span>' : ''}${esc(e.title)}</div><div class="small muted">${esc(e.place ?? '')}</div></div></div>`).join('')}</div></div>`).join('') || '<div class="muted small">No classes in the next 7 days.</div>'}
  <div class="sec"><span>Assignments (${asg.length})</span></div>
  <div class="card" style="padding:4px 16px">${asg.map((a) => { const over = a.due_at && new Date(a.due_at) < now; return `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div>${esc(a.subject)} · ${esc(a.title)}</div><div class="small ${over ? 'over' : 'muted'}">${a.due_at ? (over ? 'overdue · ' : 'due ') + DAY(a.due_at) + ' ' + HM(a.due_at) : 'no deadline'}${a.url ? ` · <a href="${esc(a.url)}" target="_blank">open</a>` : ''}</div></div>` }).join('') || '<div class="muted small" style="padding:12px 0">All submitted.</div>'}</div>
  <div class="sec"><span>Exam dates</span></div>
  <div class="card" style="padding:4px 16px">${exams.map((x) => `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div>${esc(x.subject)} ${x.value === 'registered' ? '<span class="tag ok">registered</span>' : '<span class="tag">open</span>'}</div><div class="small muted">${DAY(x.due_at)} ${HM(x.due_at)} ${esc(x.data?.room ?? '')}${x.data?.capacity ? ' · ' + esc(x.data.capacity) : ''}</div></div>`).join('') || '<div class="muted small" style="padding:12px 0">No upcoming exams.</div>'}</div>
  <div class="sec"><span>Grades</span></div>
  <div class="card" style="padding:4px 16px">${grades.map((g) => `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)"><div style="flex:3"><div>${esc(g.subject)}</div><div class="small muted">${esc(g.title ?? '')}</div></div><b style="text-align:right;color:var(--acc2)">${esc(g.value)}</b></div>`).join('') || '<div class="muted small" style="padding:12px 0">No grades yet.</div>'}</div>`
}

// ================= VSTÁVANIE (dôkaz fotkou) =================
async function upload(file, prefix) {
  const blob = await shrink(file)
  const path = `${S.user.id}/${prefix}-${Date.now()}.jpg`
  const { error } = await sb.storage.from('kargo').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return sb.storage.from('kargo').getPublicUrl(path).data.publicUrl
}
function shrink(file) {
  return new Promise((res) => {
    const img = new Image(); img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.82) }
    img.onerror = () => res(file); img.src = URL.createObjectURL(file)
  })
}
const CAM = '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="4"/></svg>'
function openWake() {
  const w = $('#wake'); w.classList.remove('hide')
  if (!S.profile?.ref_photo) {
    w.innerHTML = `<div class="small muted">First time</div><h1>Set up your proof</h1><p class="muted">Take a photo of your toothbrush holder in the bathroom. Every morning you’ll snap it again to prove you’re up.</p>
    <label class="cam">${CAM}<input type="file" accept="image/*" capture="environment" id="refIn" hidden></label><button class="btn ghost sm" id="wClose">Later</button>`
    $('#refIn').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; w.querySelector('h1').textContent = 'Saving…'; try { const u = await upload(f, 'wake-ref'); await sb.from('jarvis_profile').update({ ref_photo: u }).eq('owner', S.user.id); S.profile.ref_photo = u; toast('Reference saved ✅'); openWake() } catch (er) { toast('❌ ' + er.message) } }
    $('#wClose').onclick = () => w.classList.add('hide'); return
  }
  w.innerHTML = `<div class="small muted">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>Good morning ☀️</h1><p class="muted">Go to the bathroom and snap your toothbrush holder.</p>
  <label class="cam">${CAM}<input type="file" accept="image/*" capture="environment" id="proofIn" hidden></label>
  <div id="wMsg" class="small muted"></div><button class="btn ghost sm" id="wClose" style="margin-top:18px">Close</button>`
  $('#wClose').onclick = () => w.classList.add('hide')
  $('#proofIn').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return
    $('#wMsg').textContent = 'Checking…'
    try {
      const u = await upload(f, 'wake')
      const r = await fn({ action: 'proof', photo: u })
      if (!r.ok) { $('#wMsg').innerHTML = `<span style="color:var(--bad)">Not accepted: ${esc(r.why ?? '')}</span><br>Try again.`; return }
      const b = r.briefing
      w.innerHTML = `<div style="font-size:60px">✅</div><h1>You’re up!</h1>
      <div class="card" style="text-align:left;width:100%;max-width:420px;margin-top:18px">${b.events.length ? b.events.map((e) => `<div class="cls"><div class="tm">${HM(e.starts_at)}</div><div>${esc(e.title)}<div class="small muted">${esc(e.place ?? '')}</div></div></div>`).join('') : '<div class="muted">No school today.</div>'}
      ${b.tasks.length ? `<div class="sec" style="margin:12px 0 4px"><span>Due</span></div>${b.tasks.map((t) => `<div class="small">• ${esc(t.title)} – ${HM(t.due_at)}</div>`).join('')}` : ''}${b.replies ? `<div class="small" style="margin-top:8px">✉️ ${b.replies} replies to approve</div>` : ''}</div>
      <a class="btn acc" href="shortcuts://run-shortcut?name=JARVIS%20Up" style="margin-top:20px;width:100%;max-width:420px">Turn off backup alarms</a>
      <button class="btn ghost sm" id="wClose2" style="margin-top:10px">Done</button>`
      $('#wClose2').onclick = () => { w.classList.add('hide'); loadAll() }
      setTimeout(() => { location.href = 'shortcuts://run-shortcut?name=JARVIS%20Up' }, 1500)
    } catch (er) { $('#wMsg').textContent = '❌ ' + er.message }
  }
}

// ================= MORE / NASTAVENIA =================
const DEF = { wake_enabled: true, commute_min: 25, routine_min: 35, earliest: '05:45', no_class_wake: '', weekend_wake: '', sleep_h: 7.5, bedtime_reminder: true, backups: 2, backup_gap: 5 }
function renderMore() {
  const v = $('#v-more')
  const p = S.profile ?? {}
  v.innerHTML = `
  <div class="card"><div class="row"><b style="flex:3"><span class="dot ${online() ? 'on' : ''}"></span> PC agent ${online() ? 'running' : 'off'}</b><span class="small muted" style="text-align:right">${p.online_at ? ago(p.online_at) : 'never ran'}</span></div>
  <div class="small" style="margin-top:6px">${esc(p.status ?? 'Start the JARVIS agent on your PC.')}</div>
  <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-cmd="mail">Check mail</button><button class="btn sm ghost" data-cmd="ais">Sync AIS</button><button class="btn sm ghost" id="pauseB">${p.paused ? 'Resume' : 'Pause'}</button></div></div>
  <div class="sec"><span>Settings</span></div>
  <div class="card" style="padding:6px 16px">
    ${[['wakeS', 'Wake up', 'alarm from your timetable, photo proof'], ['calS', 'Calendar', 'add JARVIS to your iPhone calendar'], ['secS', 'Security', 'Google Authenticator'], ['pushS', 'Notifications', 'enable on this phone'], ['logS', 'Agent activity', '']].map(([id, t, d]) => `<div class="row" id="${id}" style="padding:13px 0;border-bottom:1px solid var(--line);cursor:pointer"><div style="flex:4"><div>${t}</div>${d ? `<div class="small muted">${d}</div>` : ''}</div><span class="muted" style="text-align:right">›</span></div>`).join('')}
    <div class="row" id="outS" style="padding:13px 0;cursor:pointer;color:var(--bad)">Sign out</div>
  </div>
  <div class="small muted" style="text-align:center;margin-top:20px">JARVIS · <a href="../kargo/">Kargo ↗</a></div>`
  $$('[data-cmd]', v).forEach((b) => (b.onclick = async () => { await sb.from('jarvis_profile').update({ command: b.dataset.cmd }).eq('owner', S.user.id); toast(online() ? 'Sent to PC' : 'PC agent is off') }))
  $('#pauseB', v).onclick = async () => { await sb.from('jarvis_profile').update({ paused: !p.paused }).eq('owner', S.user.id); p.paused = !p.paused; renderMore() }
  $('#wakeS', v).onclick = openWakeSettings
  $('#calS', v).onclick = openCalendar
  $('#secS', v).onclick = openSecurity
  $('#pushS', v).onclick = enablePush
  $('#logS', v).onclick = () => sheet(`<h2 style="margin:4px 0 8px">Agent activity</h2><div class="card log">${(p.log ?? []).map((l) => `<div><span class="muted">${DAY(l.t)} ${HM(l.t)}</span> ${esc(l.m)}</div>`).join('') || 'Nothing yet.'}</div>`)
  $('#outS', v).onclick = async () => { try { localStorage.removeItem(CRED) } catch (_) {} await sb.auth.signOut(); location.reload() }
}
async function ensureKey() {
  if (S.profile?.wake_key) return S.profile.wake_key
  const key = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, '0')).join('')
  await sb.from('jarvis_profile').update({ wake_key: key }).eq('owner', S.user.id)
  S.profile.wake_key = key
  return key
}
async function openWakeSettings() {
  const s = { ...DEF, ...(S.profile?.settings ?? {}) }
  const key = await ensureKey()
  const url = `${FN_URL}?action=wake&key=${key}`
  const appUrl = location.origin + location.pathname + '?wake=1'
  sheet(`<h2 style="margin:4px 0 8px">Wake up</h2>
  <label class="row" style="justify-content:flex-start;gap:10px"><span class="sw"><input type="checkbox" id="wOn" ${s.wake_enabled ? 'checked' : ''}><span></span></span><span>Alarm from my timetable</span></label>
  <div class="row"><div><label class="f">Travel to school (min)</label><input class="in" id="wC" inputmode="numeric" value="${s.commute_min}"></div><div><label class="f">Morning routine (min)</label><input class="in" id="wR" inputmode="numeric" value="${s.routine_min}"></div></div>
  <div class="row"><div><label class="f">Never earlier than</label><input class="in" id="wE" type="time" value="${s.earliest}"></div><div><label class="f">Sleep goal (h)</label><input class="in" id="wS" inputmode="decimal" value="${s.sleep_h}"></div></div>
  <div class="row"><div><label class="f">Weekday without school</label><input class="in" id="wN" type="time" value="${s.no_class_wake}"></div><div><label class="f">Weekend</label><input class="in" id="wW" type="time" value="${s.weekend_wake}"></div></div>
  <div class="row"><div><label class="f">Backup alarms</label><select class="in" id="wB">${[0, 1, 2, 3, 4].map((n) => `<option ${+s.backups === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div><label class="f">Every (min)</label><select class="in" id="wG">${[3, 5, 7, 10].map((n) => `<option ${+s.backup_gap === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
  <label class="row" style="justify-content:flex-start;gap:10px;margin-top:12px"><span class="sw"><input type="checkbox" id="wBed" ${s.bedtime_reminder ? 'checked' : ''}><span></span></span><span>Remind me when to go to bed</span></label>
  <button class="btn acc" id="wSave" style="width:100%;margin-top:14px">Save</button>
  <div class="sec"><span>Next 7 days</span></div><div class="card small" id="wPlan">Loading…</div>
  <div class="sec"><span>Proof photo</span></div>
  <div class="card row">${S.profile?.ref_photo ? `<img src="${esc(S.profile.ref_photo)}" style="width:70px;height:70px;object-fit:cover;border-radius:12px;flex:none">` : ''}<div style="flex:3" class="small">${S.profile?.ref_photo ? 'Your toothbrush holder' : 'Not set yet'}</div><button class="btn ghost sm" id="wRef" style="flex:none">${S.profile?.ref_photo ? 'Retake' : 'Set'}</button></div>
  <div class="sec"><span>iPhone setup (once, ~5 min)</span></div>
  <div class="card small" style="line-height:1.65">
   <b>1 · Shortcut “JARVIS Alarm”</b> (Shortcuts → + → name it JARVIS Alarm):<br>
   • <i>Get Contents of URL</i> → paste the <b>alarm link</b> below<br>
   • <i>Get Dictionary Value</i> “alarm” → <i>If</i> it has any value:<br>
   &nbsp;&nbsp;• <i>Find All Alarms</i> where Label contains “JARVIS” → <i>Delete Alarm</i> (all)<br>
   &nbsp;&nbsp;• <i>Create Alarm</i> at Dictionary Value “alarm”, label <b>JARVIS</b><br>
   &nbsp;&nbsp;• <i>Get Dictionary Value</i> “backups” → <i>Repeat with Each</i> → <i>Create Alarm</i> at Repeat Item, label <b>JARVIS backup</b><br>
   <b>2 · Automation</b> → Time of Day <b>21:30</b>, Daily → Run Immediately → run <i>JARVIS Alarm</i>.<br>
   <b>3 · Shortcut “JARVIS Up”</b>: <i>Find All Alarms</i> where Label is “JARVIS backup” → <i>Delete Alarm</i>.<br>
   <b>4 · Automation</b> → Alarm → <b>Is Stopped</b> → Any → Run Immediately → <i>Open URL</i> = the <b>app link</b> below.<br>
   Done: the alarm sets itself from your timetable, stopping it opens JARVIS, and the photo of your toothbrush holder turns off the backups.
  </div>
  <button class="btn ghost" id="cpA" style="width:100%">Copy alarm link</button>
  <button class="btn ghost" id="cpB" style="width:100%;margin-top:8px">Copy app link</button>
  <button class="btn ghost sm" id="wTest" style="width:100%;margin-top:8px">Test: open the morning screen</button>`, async (b) => {
    $('#cpA', b).onclick = () => copy(url, 'Alarm link copied')
    $('#cpB', b).onclick = () => copy(appUrl, 'App link copied')
    $('#wTest', b).onclick = () => { closeSheet(); openWake() }
    $('#wRef', b).onclick = async () => { await sb.from('jarvis_profile').update({ ref_photo: null }).eq('owner', S.user.id); S.profile.ref_photo = null; closeSheet(); openWake() }
    $('#wSave', b).onclick = async () => {
      const settings = { ...s, wake_enabled: $('#wOn', b).checked, commute_min: +$('#wC', b).value || 25, routine_min: +$('#wR', b).value || 35, earliest: $('#wE', b).value || '05:45', sleep_h: parseFloat($('#wS', b).value) || 7.5, no_class_wake: $('#wN', b).value, weekend_wake: $('#wW', b).value, backups: +$('#wB', b).value, backup_gap: +$('#wG', b).value, bedtime_reminder: $('#wBed', b).checked }
      await sb.from('jarvis_profile').update({ settings }).eq('owner', S.user.id); S.profile.settings = settings; toast('Saved'); openWakeSettings()
    }
    try { const r = await fn({ action: 'plan' }); $('#wPlan', b).innerHTML = r.days.map((d) => `<div class="row" style="padding:5px 0"><span style="flex:2">${DAY(d.day + 'T12:00')}</span><b style="flex:1">${d.alarm ?? '—'}</b><span class="muted" style="flex:4">${esc(d.first || d.reason || '')}</span></div>`).join('') } catch (e) { $('#wPlan', b).textContent = 'Deploy jarvis-fn to see the plan (' + e.message + ')' }
  })
}
async function openCalendar() {
  const key = await ensureKey()
  const webcal = `${FN_URL.replace(/^https:/, 'webcal:')}?action=ics&key=${key}`
  sheet(`<h2 style="margin:4px 0 8px">Calendar</h2>
  <div class="small muted">Classes, exams, deadlines and your alarm appear in the iPhone Calendar and update by themselves.</div>
  <a class="btn acc" href="${esc(webcal)}" style="width:100%;margin-top:14px">Add JARVIS to iPhone Calendar</a>
  <button class="btn ghost sm" id="cpC" style="width:100%;margin-top:8px">Copy calendar link</button>
  <div class="sec"><span>Read my Google Calendar</span></div>
  <div class="small muted">Google Calendar → Settings → your calendar → <b>Secret address in iCal format</b> → copy and paste here.</div>
  <input class="in" id="gIcs" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" value="${esc(S.profile?.ics_import ?? '')}" style="margin-top:8px">
  <button class="btn ghost" id="gSave" style="width:100%;margin-top:8px">Save & import</button>`, (b) => {
    $('#cpC', b).onclick = () => copy(webcal)
    $('#gSave', b).onclick = async () => { const v = $('#gIcs', b).value.trim(); await sb.from('jarvis_profile').update({ ics_import: v || null }).eq('owner', S.user.id); S.profile.ics_import = v; try { await fn({ action: 'import-google' }); toast('Imported ✅'); loadAll() } catch (e) { toast('Saved – ' + e.message) } }
  })
}
async function openSecurity() {
  const { data: f } = await sb.auth.mfa.listFactors()
  const on = (f?.totp ?? []).find((x) => x.status === 'verified')
  if (on) {
    sheet(`<h2 style="margin:4px 0 8px">Security</h2><div class="card"><b style="color:var(--ok)">Google Authenticator is on</b><div class="small muted" style="margin-top:4px">A 6-digit code is needed on every new device. It also protects Kargo (same account).</div></div>
    <button class="btn bad sm" id="mOff" style="margin-top:12px">Turn off</button>`, (b) => {
      $('#mOff', b).onclick = async () => { if (!confirm('Turn off Google Authenticator?')) return; const { error } = await sb.auth.mfa.unenroll({ factorId: on.id }); if (error) return toast('❌ ' + error.message); toast('Turned off'); closeSheet() }
    }); return
  }
  for (const x of f?.all ?? []) if (x.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: x.id }).catch(() => {})
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'JARVIS ' + Date.now() })
  if (error) return toast('❌ ' + error.message)
  sheet(`<h2 style="margin:4px 0 8px">Google Authenticator</h2>
  <ol class="small" style="padding-left:18px;line-height:1.7"><li>Install <b>Google Authenticator</b>.</li><li>Tap <b>+</b> → <b>Enter a setup key</b> (or scan the QR on another screen).</li><li>Paste the key below, then type the 6-digit code here.</li></ol>
  <div style="background:#fff;border-radius:16px;padding:14px;width:200px;margin:8px auto"><img src="${data.totp.qr_code}" style="width:100%;display:block"></div>
  <div class="card small" style="word-break:break-all;text-align:center"><b class="copy" id="mKey">${esc(data.totp.secret)}</b><div class="muted" style="margin-top:4px">setup key – tap to copy · put it also into both PC agents’ config.json → totpSecret</div></div>
  <input class="in code" id="mCode" inputmode="numeric" maxlength="6" placeholder="000000">
  <button class="btn acc" id="mOk" style="width:100%;margin-top:10px">Turn on</button>`, (b) => {
    $('#mKey', b).onclick = () => copy(data.totp.secret, 'Setup key copied')
    $('#mOk', b).onclick = async () => {
      const { error: e } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: $('#mCode', b).value.replace(/\D/g, '') })
      if (e) return toast('❌ Wrong code')
      toast('Google Authenticator is on ✅', 3500); closeSheet()
    }
  })
}
const b64u = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))) }
async function enablePush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return toast('On iPhone: Share → Add to Home Screen, then open JARVIS from there', 5000)
    if ((await Notification.requestPermission()) !== 'granted') return toast('Notifications are blocked in Settings')
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID_PUBLIC) }))
    const j = sub.toJSON()
    const { error } = await sb.from('jarvis_push').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
    if (error) throw error
    const r = await fn({ action: 'test-push' })
    toast(r.sent ? 'Enabled – test notification sent' : 'Saved, but the test failed – check jarvis-fn', 4000)
  } catch (e) { toast('❌ ' + e.message, 5000) }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {})
boot()
