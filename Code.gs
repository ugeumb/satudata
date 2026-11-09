/**
 * Satu Data UMB — backend Google Apps Script
 * Penyimpanan: Google Sheets (satu sheet per koleksi) · Berkas bukti: Google Drive
 * Panduan pasang: lihat README.md
 */
const COLLS = ['users','tasks','indicators','master','evidence','requests','risks','calendar','log'];
const READABLE = {
  users:['name','short','title','role','team'],
  tasks:['owner','team','rank','dueText','due','title','status','link'],
  indicators:['rank','group','code','title','owner','checker','unit','val','vunit','period','status','flag'],
  master:['key','label','val','vunit','period','unit','status'],
  evidence:['rank','refs','title','type','link','date'],
  requests:['unit','what','ranks','due','pic','status'],
  risks:['type','title','impact','owner','status'],
  calendar:['date','rank','title','status'],
  log:['ts','by','text']
};
const SHEET_NAME = {users:'Users',tasks:'Tugas',indicators:'Indikator',master:'DataInti',evidence:'Bukti',requests:'PermintaanData',risks:'Risiko',calendar:'Kalender',log:'Log'};
const TOKEN_DAYS = 14;

/* ---------- entry points ---------- */
function doGet(e) {
  return out({ok:true, name:'Satu Data UMB', time:Date.now()});
}
function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents || '{}');
    switch (b.action) {
      case 'login':  return out(login(b));
      case 'init':   return out(withLock(() => init(b)));
      case 'pull':   return out(pull(b));
      case 'push':   return out(withLock(() => push(b)));
      case 'upload': return out(upload(b));
      case 'setpin': return out(withLock(() => setPin(b)));
      default: return out({ok:false, error:'action'});
    }
  } catch (err) {
    return out({ok:false, error:'server', message:String(err && err.message || err)});
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function withLock(fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- storage ---------- */
function props() { return PropertiesService.getScriptProperties(); }
function ss() { const id = props().getProperty('SHEET_ID'); return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); }
function headerFor(c) { const h = ['id','_u','_s','_by','_d'].concat(READABLE[c], ['_json']); if (c === 'users') h.push('pin'); return h; }
function sheetFor(c) {
  const s = ss(); let sh = s.getSheetByName(SHEET_NAME[c]);
  if (!sh) { sh = s.insertSheet(SHEET_NAME[c]); const h = headerFor(c); sh.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function safe(v) { if (v === null || v === undefined) return ''; v = typeof v === 'object' ? JSON.stringify(v) : String(v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function rowOf(c, it, srv, pin) {
  const r = [it.id, it._u || 0, srv, it._by || '', it._d ? 1 : 0].concat(READABLE[c].map(k => safe(it[k])), [JSON.stringify(it)]);
  if (c === 'users') r.push(pin || '');
  return r;
}
function readAll(c) { // -> [{row,id,_u,_d,item,pin}]
  const sh = sheetFor(c); const n = sh.getLastRow() - 1; if (n < 1) return [];
  const w = headerFor(c).length; const vals = sh.getRange(2,1,n,w).getValues(); const ji = 5 + READABLE[c].length;
  return vals.map((v,i) => { let item = {}; try { item = JSON.parse(v[ji]); } catch (e) { item = {id:v[0]}; }
    return {row:i+2, id:String(v[0]), _u:Number(v[1])||0, _s:Number(v[2])||0, _d:Number(v[4])||0, item:item, pin:c==='users'?v[ji+1]:''}; });
}
function touch(c, t) { props().setProperty('LM_'+c, String(t)); }

/* ---------- security ---------- */
function secret(k) { let v = props().getProperty(k); if (!v) { v = Utilities.getUuid()+Utilities.getUuid(); props().setProperty(k, v); } return v; }
function hashPin(uid, pin) { const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, secret('SALT')+'|'+uid+'|'+pin); return d.map(b => ('0'+(b&0xff).toString(16)).slice(-2)).join(''); }
function sign(payload) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret('SECRET'))); }
function makeToken(uid) { const p = Utilities.base64EncodeWebSafe(JSON.stringify({u:uid, exp:Date.now()+TOKEN_DAYS*864e5})); return p+'.'+sign(p); }
function auth(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const parts = token.split('.'); if (sign(parts[0]) !== parts[1]) return null;
  let p; try { p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()); } catch (e) { return null; }
  if (!p.exp || p.exp < Date.now()) return null;
  const u = readAll('users').find(r => r.id === p.u && !r._d); return u ? u.item : null;
}
function login(b) {
  const cache = CacheService.getScriptCache(); const key = 'fail_'+b.userId; const fails = Number(cache.get(key) || 0);
  if (fails >= 8) return {ok:false, message:'Terlalu banyak percobaan. Coba lagi 15 menit lagi.'};
  const r = readAll('users').find(x => x.id === b.userId && !x._d);
  if (!r || !r.pin || r.pin !== hashPin(b.userId, String(b.pin||''))) { cache.put(key, String(fails+1), 900); return {ok:false, message:'PIN salah'}; }
  cache.remove(key); return {ok:true, token:makeToken(b.userId), user:r.item};
}
function randPin() { return String(Math.floor(100000 + Math.random()*900000)); }

/* ---------- authorization ---------- */
function allowed(u, c, existing, item) {
  const role = u.role;
  if (role === 'pengarah') return false;
  if (role === 'admin') return true;
  const own = existing || item;
  switch (c) {
    case 'users': case 'calendar': return false;
    case 'master': return role === 'koordinator';
    case 'requests': case 'risks': return true;
    case 'log': return !existing;
    case 'evidence': return !existing || existing._by === u.id || role === 'koordinator';
    case 'tasks':
      if (role === 'koordinator') return own.team === u.team;
      return !!existing && existing.owner === u.id;
    case 'indicators': {
      if (!existing) return false;
      const lead = role === 'koordinator' && existing.rank === u.team;
      const mine = existing.owner === u.id || existing.checker === u.id;
      if (!lead && !mine) return false;
      // maker–checker: valid/final hanya checker/koordinator
      if (item && !item._d && item.status !== existing.status && (item.status === 'valid' || item.status === 'final')) {
        if (item.status === 'final' && !lead) return false;
        if (!lead && existing.checker !== u.id) return false;
      }
      return true;
    }
  }
  return false;
}

/* ---------- actions ---------- */
function pull(b) {
  const u = auth(b.token); if (!u) return {ok:false, error:'auth'};
  const since = Number(b.since) || 0; const lm = props().getProperties(); const items = {};
  COLLS.forEach(c => {
    if (since && Number(lm['LM_'+c] || 0) <= since) { items[c] = []; return; }
    items[c] = readAll(c).filter(r => r._s > since).map(r => r.item);
  });
  return {ok:true, now:Date.now(), items:items};
}

function writeOps(c, ops, u) { // ops: [item]; mengembalikan {written, rejected}
  const sh = sheetFor(c); const rows = readAll(c); const byId = {}; rows.forEach(r => byId[r.id] = r);
  const srv = Date.now(); const append = []; let written = 0; const rejected = [];
  ops.forEach(item => {
    if (!item || !item.id) return;
    const ex = byId[item.id]; const exItem = ex && !ex._d ? ex.item : (ex ? null : null);
    if (u && !allowed(u, c, exItem, item)) { rejected.push(item.id); return; }
    if (ex && (ex._u > (item._u || 0))) { rejected.push(item.id); return; } // data server lebih baru
    const r = rowOf(c, item, srv, ex ? ex.pin : '');
    if (ex) { sh.getRange(ex.row, 1, 1, r.length).setValues([r]); byId[item.id] = {row:ex.row, id:item.id, _u:item._u||0, _d:item._d?1:0, item:item, pin:ex.pin}; }
    else { append.push(r); byId[item.id] = {row:-1, id:item.id, _u:item._u||0, _d:item._d?1:0, item:item, pin:''}; }
    written++;
  });
  if (append.length) sh.getRange(sh.getLastRow()+1, 1, append.length, append[0].length).setValues(append);
  if (written) touch(c, srv);
  return {written:written, rejected:rejected};
}
function push(b) {
  const u = auth(b.token); if (!u) return {ok:false, error:'auth'};
  const g = {}; (b.ops || []).forEach(o => { if (COLLS.indexOf(o.c) >= 0) (g[o.c] = g[o.c] || []).push(o.item); });
  const res = {ok:true, rejected:[]};
  Object.keys(g).forEach(c => { const r = writeOps(c, g[c], u); res.rejected = res.rejected.concat(r.rejected.map(id => c+':'+id)); });
  return res;
}
function init(b) {
  const key = props().getProperty('SETUP_KEY');
  if (!key) return {ok:false, message:'Properti skrip SETUP_KEY belum diisi (lihat README).'};
  if (b.setupKey !== key) return {ok:false, message:'Setup Key salah'};
  if (readAll('users').length) return {ok:false, message:'Server sudah diinisialisasi. Gunakan menu Admin untuk mengelola.'};
  const pins = {}; const users = (b.data.users || []);
  COLLS.forEach(c => { if (c === 'users') return; writeOps(c, b.data[c] || [], null); });
  // users dengan PIN acak
  const sh = sheetFor('users'); const srv = Date.now(); const rows = users.map(it => { const p = randPin(); pins[it.id] = p; return rowOf('users', it, srv, hashPin(it.id, p)); });
  if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  touch('users', srv);
  return {ok:true, pins:pins};
}
function setPin(b) {
  const a = auth(b.token); if (!a || a.role !== 'admin') return {ok:false, error:'auth'};
  const r = readAll('users').find(x => x.id === b.userId && !x._d); if (!r) return {ok:false, message:'Pengguna tidak ada'};
  const pin = /^\d{4,8}$/.test(String(b.pin||'')) ? String(b.pin) : randPin();
  const sh = sheetFor('users'); sh.getRange(r.row, headerFor('users').length).setValue(hashPin(r.id, pin));
  CacheService.getScriptCache().remove('fail_'+r.id);
  return {ok:true, pin:pin};
}
function upload(b) {
  const u = auth(b.token); if (!u) return {ok:false, error:'auth'};
  if (u.role === 'pengarah') return {ok:false, message:'Tidak diizinkan'};
  const bytes = Utilities.base64Decode(b.data); if (bytes.length > 8*1024*1024) return {ok:false, message:'Berkas > 8 MB'};
  let root; const fid = props().getProperty('FOLDER_ID');
  if (fid) root = DriveApp.getFolderById(fid); else { root = DriveApp.createFolder('Satu Data UMB — Bukti'); props().setProperty('FOLDER_ID', root.getId()); }
  const name = String(b.rank || 'ALL'); const it = root.getFoldersByName(name); const folder = it.hasNext() ? it.next() : root.createFolder(name);
  const safeName = String(b.name || 'berkas').replace(/[\\/:*?"<>|]/g, '_');
  const file = folder.createFile(Utilities.newBlob(bytes, b.mime || 'application/octet-stream', Utilities.formatDate(new Date(),'Asia/Jakarta','yyyyMMdd')+'_'+safeName));
  try { file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* akun non-Workspace: berkas tetap privat bagi pemilik */ }
  return {ok:true, url:file.getUrl()};
}

/* ---------- utilitas admin (jalankan dari editor Apps Script) ---------- */
/** Jalankan sekali: menandai sheet & folder. Isi properti SETUP_KEY di Project Settings > Script properties. */
function cekPengaturan() {
  Logger.log('SETUP_KEY terisi: ' + !!props().getProperty('SETUP_KEY'));
  Logger.log('Spreadsheet: ' + ss().getName());
  COLLS.forEach(sheetFor);
}
