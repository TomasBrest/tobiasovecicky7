// Kargo widget for Scriptable (iPhone home screen)
// Small: next parcel · Medium: next 2 parcels + photo · Large: up to 5 parcels
const KEY = '__KEY__'
const APP = '__APP__'
const FN = 'https://xkmcohzferzcqgmcbynv.supabase.co/functions/v1/kargo-track'
const PUB = 'sb_publishable_EDk2wVXCJH8wH5I_AZCUkg_aXLlXdsr'

const C = { bg: new Color('#0a0a0b'), card: new Color('#17171a'), tx: Color.white(), mut: new Color('#8e8e96'), acc: new Color('#ff6a2b'), ok: new Color('#34d399'), line: new Color('#2a2a2e') }

async function load() {
  const r = new Request(FN)
  r.method = 'POST'
  r.headers = { 'Content-Type': 'application/json', apikey: PUB, Authorization: 'Bearer ' + PUB }
  r.body = JSON.stringify({ action: 'widget', key: KEY })
  r.timeoutInterval = 20
  const j = await r.loadJSON()
  if (j.error) throw new Error(j.error)
  return j
}
const fmt = (d) => { if (!d) return ''; const x = new Date(d); const days = Math.round((x - new Date()) / 864e5); return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : days < 7 ? `in ${days} days` : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }

function bar(stack, stage, w) {
  const row = stack.addStack(); row.spacing = 2
  for (let i = 1; i <= 7; i++) {
    const s = row.addStack(); s.size = new Size((w - 12) / 7, 3); s.cornerRadius = 1.5
    s.backgroundColor = i <= stage ? C.acc : C.line
  }
}
async function thumb(stack, url, size) {
  if (!url) return
  try { const img = await new Request(url).loadImage(); const i = stack.addImage(img); i.imageSize = new Size(size, size); i.cornerRadius = 10 } catch (_) {}
}

async function build() {
  const w = new ListWidget()
  w.backgroundColor = C.bg
  w.url = APP
  w.setPadding(14, 14, 14, 14)
  w.refreshAfterDate = new Date(Date.now() + 20 * 60 * 1000)
  const fam = config.widgetFamily ?? 'medium'
  let d
  try { d = await load() } catch (e) {
    const t = w.addText('Kargo'); t.font = Font.boldSystemFont(15); t.textColor = C.tx
    w.addSpacer(6); const m = w.addText('Offline – ' + e.message); m.font = Font.systemFont(11); m.textColor = C.mut
    return w
  }
  // hlavička
  const head = w.addStack(); head.centerAlignContent()
  const ti = head.addText('Kargo'); ti.font = Font.boldSystemFont(14); ti.textColor = C.tx
  head.addSpacer()
  if (d.pending) { const p = head.addText(`${d.pending} to approve`); p.font = Font.semiboldSystemFont(11); p.textColor = C.acc }
  else { const p = head.addText(`${d.moving} moving`); p.font = Font.systemFont(11); p.textColor = C.mut }
  w.addSpacer(8)
  const list = d.parcels ?? []
  if (!list.length) { const e = w.addText('No active shipments'); e.font = Font.systemFont(13); e.textColor = C.mut; return w }
  const n = fam === 'small' ? 1 : fam === 'medium' ? 2 : 5
  for (const [i, p] of list.slice(0, n).entries()) {
    const row = w.addStack(); row.centerAlignContent(); row.spacing = 10
    if (fam !== 'small') await thumb(row, p.img, fam === 'large' ? 44 : 40)
    const col = row.addStack(); col.layoutVertically(); col.spacing = 3
    const t = col.addText(p.title); t.font = Font.semiboldSystemFont(fam === 'small' ? 14 : 13); t.textColor = C.tx; t.lineLimit = fam === 'small' ? 2 : 1
    const s = col.addText(`${p.status}${p.eta ? ' · ' + fmt(p.eta) : ''}`); s.font = Font.systemFont(11); s.textColor = p.stage >= 6 ? C.ok : C.acc
    if (fam === 'large' && p.last) { const l = col.addText(p.last); l.font = Font.systemFont(10); l.textColor = C.mut; l.lineLimit = 1 }
    bar(col, p.stage, fam === 'small' ? 120 : 220)
    if (i < Math.min(n, list.length) - 1) w.addSpacer(fam === 'large' ? 10 : 8)
  }
  if (fam === 'small' && list.length > 1) { w.addSpacer(); const m = w.addText(`+${list.length - 1} more`); m.font = Font.systemFont(10); m.textColor = C.mut }
  w.addSpacer()
  return w
}

const widget = await build()
if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentMedium()
Script.complete()
