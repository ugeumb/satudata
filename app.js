(function(){
'use strict';
/* ================= util ================= */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const fmtD=iso=>{if(!iso)return '';const [y,m,d]=iso.split('-');return (+d)+' '+MON[+m-1]+' '+y};
const daysTo=iso=>Math.round((Date.parse(iso+'T00:00:00')-Date.parse(todayISO()+'T00:00:00'))/864e5);
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clone=o=>JSON.parse(JSON.stringify(o));
const RK={QS:{n:'QS Asia',c:'#B3123A',full:'QS Asia University Rankings'},THE:{n:'THE SIR',c:'#2A63B7',full:'THE Sustainability Impact Ratings'},UIGM:{n:'UIGM',c:'#0B8E7C',full:'UI GreenMetric'},ALL:{n:'Umum',c:'#0E5A3A',full:'Lintas ranking'}};
const TASK_ST=['belum','proses','selesai','terblokir'];
const IND_ST=['kosong','draft','dicek','valid','final'];
const ST_LABEL={belum:'Belum',proses:'Proses',selesai:'Selesai',terblokir:'Terblokir',kosong:'Kosong',draft:'Draft',dicek:'Dicek',valid:'Valid',final:'Final'};
const COLL=['users','tasks','indicators','master','evidence','requests','risks','calendar','log'];
const cfg=window.U1D_CONFIG||{};
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){toast('Penyimpanan perangkat penuh')}},del:k=>localStorage.removeItem(k)};

/* ================= state ================= */
let DB=LS.get('u1d.db',null);
if(!DB||DB.version!==window.SEED.version){const old=DB; DB=clone(window.SEED); if(old) mergeLocalOverSeed(old);}
function mergeLocalOverSeed(old){COLL.forEach(c=>{const m=new Map((old[c]||[]).map(x=>[x.id,x]));DB[c]=DB[c].map(x=>m.get(x.id)||x);(old[c]||[]).forEach(x=>{if(!DB[c].some(y=>y.id===x.id))DB[c].push(x)})})}
let SESSION=LS.get('u1d.session',null);
let SETTINGS=LS.get('u1d.settings',{api:cfg.API_URL||'',since:0});
if(cfg.API_URL&&!SETTINGS.api) SETTINGS.api=cfg.API_URL;
let OUTBOX=LS.get('u1d.outbox',[]);
let ST={sync:'lokal',last:null,busy:false};
const API=()=>SETTINGS.api||'';
const save=()=>LS.set('u1d.db',DB);
const me=()=>SESSION&&DB.users.find(u=>u.id===SESSION.userId);
const user=id=>DB.users.find(u=>u.id===id);
const uname=id=>id==='group:pengarah'?'Pengarah (Rektor & WR I–IV)':(user(id)?user(id).short:'—');
const role=()=>me()?me().role:'';
const isAdmin=()=>role()==='admin';
const isKoor=()=>role()==='koordinator';
const myTeam=()=>me()?me().team:'';
function stamp(it){it._u=Date.now();it._by=SESSION?SESSION.userId:'';return it}
function put(coll,item,opts={}){stamp(item);const arr=DB[coll];const i=arr.findIndex(x=>x.id===item.id);if(i<0)arr.push(item);else arr[i]=item;save();queue(coll,item);return item}
function remove(coll,id){DB[coll]=DB[coll].filter(x=>x.id!==id);save();queue(coll,{id,_d:1,_u:Date.now(),_by:SESSION?SESSION.userId:''})}
function queue(coll,item){if(!API())return;OUTBOX=OUTBOX.filter(o=>!(o.c===coll&&o.item.id===item.id));OUTBOX.push({c:coll,item});LS.set('u1d.outbox',OUTBOX);scheduleSync()}
function logAct(text){put('log',{id:uid('l'),ts:Date.now(),by:SESSION?SESSION.userId:'',text});if(DB.log.length>300){DB.log=DB.log.slice(-300);save()}}

/* ================= permissions (UX; server enforces too) ================= */
function canEdit(coll,item){const m=me();if(!m)return false;if(m.role==='admin')return true;if(m.role==='pengarah')return false;
 if(coll==='tasks'){return item.owner===m.id||(m.role==='koordinator'&&(item.team===m.team))}
 if(coll==='indicators'){return item.owner===m.id||item.checker===m.id||(m.role==='koordinator'&&item.rank===m.team)}
 if(coll==='evidence'){return !item.id||item._by===m.id||m.role==='koordinator'}
 if(['master','requests','risks'].includes(coll))return m.role==='koordinator'||m.role==='anggota'&&coll!=='master';
 return false}
const canAdd=coll=>{const m=me();return m&&m.role!=='pengarah'&&(coll==='evidence'||['requests','risks'].includes(coll)||m.role==='admin'||m.role==='koordinator')};

/* ================= sync ================= */
let syncTimer=null;
function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(sync,1500)}
async function call(action,body){const r=await fetch(API(),{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action,token:SESSION&&SESSION.token},body||{}))});const j=await r.json();if(j&&j.error==='auth'){SESSION=null;LS.del('u1d.session');route();throw new Error('Sesi berakhir, silakan masuk lagi')}return j}
async function sync(manual){
 if(!API()||!SESSION||!SESSION.token){ST.sync='lokal';pill();return}
 if(ST.busy)return;ST.busy=true;ST.sync='sinkron';pill();
 try{
  if(OUTBOX.length){const ops=OUTBOX.slice(0,200);const j=await call('push',{ops});if(!j.ok)throw new Error(j.error||'push gagal');const done=new Set(ops.map(o=>o.c+'|'+o.item.id+'|'+o.item._u));OUTBOX=OUTBOX.filter(o=>!done.has(o.c+'|'+o.item.id+'|'+o.item._u));LS.set('u1d.outbox',OUTBOX)}
  const j=await call('pull',{since:SETTINGS.since||0});if(!j.ok)throw new Error(j.error||'pull gagal');
  let n=0;COLL.forEach(c=>{(j.items[c]||[]).forEach(r=>{const i=DB[c].findIndex(x=>x.id===r.id);const loc=i<0?null:DB[c][i];if(OUTBOX.some(o=>o.c===c&&o.item.id===r.id))return;if(r._d){if(i>=0){DB[c].splice(i,1);n++}return}if(!loc||(r._u||0)>(loc._u||0)){if(i<0)DB[c].push(r);else DB[c][i]=r;n++}})});
  SETTINGS.since=j.now;LS.set('u1d.settings',SETTINGS);save();ST.sync='ok';ST.last=new Date();
  if(n&&!document.querySelector('.sheet.on'))route(true);
 }catch(e){ST.sync=navigator.onLine?'galat':'offline';if(manual)toast(e.message)}
 ST.busy=false;pill();if(OUTBOX.length&&ST.sync==='ok')scheduleSync()}
function pill(){const el=$('#pill');if(!el)return;const n=OUTBOX.length;const m={lokal:['Mode lokal','l'],sinkron:['Menyinkronkan…','s'],ok:['Tersinkron '+(ST.last?ST.last.toTimeString().slice(0,5):''),'o'],galat:['Gagal sinkron'+(n?' ('+n+')':''),'e'],offline:['Offline'+(n?' ('+n+' antrean)':''),'e']}[ST.sync];el.className='pill '+m[1];el.textContent=m[0]}
addEventListener('online',()=>sync());addEventListener('offline',()=>{ST.sync='offline';pill()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
setInterval(()=>{if(!document.hidden)sync()},60000);

/* ================= ui primitives ================= */
function toast(msg){const t=$('#toast');t.textContent=msg;t.className='on';clearTimeout(toast._t);toast._t=setTimeout(()=>t.className='',3200)}
function chip(label,cls){return `<span class="chip ${cls||''}">${esc(label)}</span>`}
const stCls=s=>({belum:'g',proses:'b',selesai:'ok',terblokir:'bad',kosong:'g',draft:'b',dicek:'w',valid:'ok',final:'ok2'}[s]||'g');
const rkChip=r=>`<span class="rk" style="--c:${(RK[r]||RK.ALL).c}">${esc((RK[r]||RK.ALL).n)}</span>`;
function sheet(html,onMount){const s=$('#sheet');s.innerHTML=`<div class="sh-bg" data-close></div><div class="sh-box" role="dialog">${html}</div>`;s.classList.add('on');document.body.classList.add('noscroll');if(onMount)onMount(s);}
function closeSheet(){const s=$('#sheet');s.classList.remove('on');s.innerHTML='';document.body.classList.remove('noscroll')}
function confirmBox(msg,yes){sheet(`<h3>Konfirmasi</h3><p>${esc(msg)}</p><div class="btns"><button class="btn" data-close>Batal</button><button class="btn danger" id="cf-yes">Lanjutkan</button></div>`,s=>$('#cf-yes',s).onclick=()=>{closeSheet();yes()})}
/* generic form */
function field(f,v){const id='f_'+f.k;const val=v==null?'':v;let inp='';
 if(f.t==='textarea')inp=`<textarea id="${id}" rows="${f.rows||3}">${esc(val)}</textarea>`;
 else if(f.t==='select')inp=`<select id="${id}">${(typeof f.opts==='function'?f.opts():f.opts).map(o=>{const [ov,ol]=Array.isArray(o)?o:[o,o];return `<option value="${esc(ov)}" ${String(ov)===String(val)?'selected':''}>${esc(ol)}</option>`}).join('')}</select>`;
 else inp=`<input id="${id}" type="${f.t||'text'}" value="${esc(val)}" ${f.ph?`placeholder="${esc(f.ph)}"`:''} ${f.inputmode?`inputmode="${f.inputmode}"`:''}>`;
 return `<label class="fld"><span>${esc(f.l)}</span>${inp}${f.hint?`<small>${esc(f.hint)}</small>`:''}</label>`}
function readForm(fields,root){const o={};fields.forEach(f=>{const el=$('#f_'+f.k,root);if(el)o[f.k]=f.t==='number'&&el.value!==''?el.value:el.value.trim()});return o}
function formSheet(title,fields,item,{onSave,onDelete,extra='',head=''}={}){
 sheet(`<div class="sh-h"><h3>${esc(title)}</h3><button class="x" data-close aria-label="Tutup">×</button></div><div class="sh-b">${head}${fields.map(f=>field(f,item[f.k])).join('')}${extra}</div><div class="btns">${onDelete?'<button class="btn danger" id="fm-del">Hapus</button>':''}<span class="sp"></span><button class="btn" data-close>Batal</button><button class="btn pri" id="fm-ok">Simpan</button></div>`,s=>{
  $('#fm-ok',s).onclick=()=>{const v=readForm(fields,s);const miss=fields.find(f=>f.req&&!v[f.k]);if(miss){toast(miss.l+' wajib diisi');return}onSave(v)};
  if(onDelete)$('#fm-del',s).onclick=()=>confirmBox('Hapus data ini?',()=>{onDelete();closeSheet()})})}
const userOpts=(withNone)=>[...(withNone?[['','—']]:[]),...DB.users.filter(u=>u.role!=='pengarah').map(u=>[u.id,u.short+' ('+u.title+')'])];
const rankOpts=[['ALL','Umum'],['QS','QS Asia'],['THE','THE SIR'],['UIGM','UIGM']];
function csvEsc(v){v=v==null?'':String(v);return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function download(name,text,mime){const b=new Blob([text],{type:mime||'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function parseCSV(t){const rows=[];let r=[],f='',q=false;t=t.replace(/^﻿/,'');const sep=(t.split('\n')[0].match(/;/g)||[]).length>(t.split('\n')[0].match(/,/g)||[]).length?';':',';for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===sep){r.push(f);f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;r.push(f);f='';if(r.some(x=>x!==''))rows.push(r);r=[]}else f+=c}if(f!==''||r.length){r.push(f);rows.push(r)}return rows}

/* ================= helpers: data ================= */
const evOf=id=>DB.evidence.filter(e=>(e.refs||'').split(/[,\s;]+/).filter(Boolean).includes(id));
const num=v=>{if(v==null||v==='')return NaN;return parseFloat(String(v).replace(/\./g,'').replace(',','.').replace(/[^0-9.\-]/g,''))};
const parseNum=v=>{const s=String(v||'').trim();if(!s)return NaN;if(/^-?\d+(\.\d+)?$/.test(s))return parseFloat(s);return num(s)};
function consistency(ind){if(!ind.masterKey)return null;const m=DB.master.find(x=>x.key===ind.masterKey);if(!m||m.val==='')return {ok:null,m};if(ind.val==='')return {ok:null,m,empty:true};const a=parseNum(ind.val),b=parseNum(m.val);const same=(!isNaN(a)&&!isNaN(b))?a===b:String(ind.val).trim()===String(m.val).trim();return {ok:same,m}}
function progress(rank){const l=DB.indicators.filter(i=>i.rank===rank);const c={kosong:0,draft:0,dicek:0,valid:0,final:0};l.forEach(i=>c[i.status]++);const t=l.length;const v=c.valid+c.final;return {t,c,filled:t-c.kosong,valid:v,pct:t?Math.round(v/t*100):0,fp:t?Math.round((t-c.kosong)/t*100):0}}
function taskProg(rank){const l=DB.tasks.filter(x=>x.rank===rank);const d=l.filter(x=>x.status==='selesai').length;return {t:l.length,d,pct:l.length?Math.round(d/l.length*100):0}}
const isOverdue=t=>t.due&&t.status!=='selesai'&&daysTo(t.due)<0;
function statusRule(ind,next){ // gate untuk status
 const m=me();const own=ind.owner===m.id,chk=ind.checker===m.id,lead=isAdmin()||(isKoor()&&ind.rank===m.team);
 if(next==='kosong'||next==='draft'||next==='dicek'){if(!(own||chk||lead))return 'Anda bukan pemilik/pemeriksa indikator ini';}
 if(next==='dicek'||next==='valid'||next==='final'){if(String(ind.val).trim()==='')return 'Nilai/jawaban belum diisi';}
 if(next==='valid'||next==='final'){if(!(chk||lead))return 'Status Valid hanya dapat ditetapkan pemeriksa (checker) atau koordinator/admin — prinsip maker–checker';
  if(ind.evReq&&evOf(ind.id).length===0)return 'Indikator ini mewajibkan bukti: tautkan minimal satu bukti di menu Bukti';
  const c=consistency(ind);if(c&&c.ok===false)return 'Nilai berbeda dari Data Inti ('+c.m.val+'). Samakan dulu atau perbarui Data Inti.'}
 if(next==='final'&&!(isAdmin()||(isKoor()&&ind.rank===m.team)))return 'Status Final hanya oleh koordinator/admin';
 return ''}
window.U1D={DB:()=>DB,sync};

/* ================= views ================= */
const U={task:{who:'me',rank:'ALL',st:'aktif'},repo:{q:'',g:'',own:'',st:'',flag:''},ev:{q:'',rank:''},cal:{rank:'ALL',past:false},risk:{type:'',st:''}};
const V={};
function userSelect(id,sel,opts){return `<select id="${id}">${opts.map(([v,l])=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${esc(l)}</option>`).join('')}</select>`}
function bar(c,t,cls=''){const p=k=>t?c[k]/t*100:0;return `<div class="stk ${cls}"><i class="s-v" style="width:${p('valid')+p('final')}%"></i><i class="s-c" style="width:${p('dicek')}%"></i><i class="s-d" style="width:${p('draft')}%"></i></div>`}
function dayTag(d){const n=daysTo(d);if(n<0)return `<b class="late">terlambat ${-n} hari</b>`;if(n===0)return '<b class="late">hari ini</b>';if(n<=7)return `<b class="soon">${n} hari lagi</b>`;return `<span>${n} hari lagi</span>`}

/* ---- Beranda ---- */
V.home=()=>{
 const m=me();const up=DB.calendar.filter(c=>daysTo(c.date)>=0).sort((a,b)=>a.date.localeCompare(b.date)||a.rank.localeCompare(b.rank));
 const next=up.slice(0,6);
 const mine=DB.tasks.filter(t=>t.status!=='selesai'&&(t.owner===m.id||(t.owner==='group:pengarah'&&m.role==='pengarah')));
 const od=mine.filter(isOverdue).length;const soon=mine.filter(t=>t.due&&daysTo(t.due)>=0&&daysTo(t.due)<=14).sort((a,b)=>a.due.localeCompare(b.due));
 const reqLate=DB.requests.filter(r=>r.status!=='diterima'&&r.due&&daysTo(r.due)<0).length;
 const open=DB.risks.filter(r=>r.status==='terbuka'&&r.type==='anomali').length;
 const flagged=DB.indicators.filter(i=>i.flag&&!['valid','final'].includes(i.status)).length;
 const hour=new Date().getHours();const greet=hour<11?'Selamat pagi':hour<15?'Selamat siang':hour<18?'Selamat sore':'Selamat malam';
 const off=DB.calendar.filter(c=>c.status==='resmi'&&daysTo(c.date)>=0).sort((a,b)=>a.date.localeCompare(b.date))[0];
 return `<div class="hello"><div><small>${greet},</small><h1>${esc(m.short)}</h1><span class="muted">${esc(m.title)}</span></div></div>
 ${off?`<div class="hero"><small>Tenggat resmi terdekat</small><div class="big">${daysTo(off.date)}<span> hari</span></div><div>${esc(off.title)}</div><small>${fmtD(off.date)} · ${rkChip(off.rank)}</small></div>`:''}
 ${installCard()}
 <div class="grid3">${['QS','THE','UIGM'].map(r=>{const p=progress(r),tp=taskProg(r);return `<a class="card rcard" href="#/repo/${r}" style="--c:${RK[r].c}"><div class="rh"><b>${RK[r].n}</b><span>${p.pct}% valid</span></div>${bar(p.c,p.t)}<div class="rs"><span>${p.filled}/${p.t} terisi</span><span>${p.valid} valid</span></div><div class="rs"><span>Tugas ${tp.d}/${tp.t} selesai</span><span>${tp.pct}%</span></div></a>`}).join('')}</div>
 <div class="card"><div class="ch"><h2>Perlu perhatian</h2></div>
  <div class="alerts">
   ${od?`<a href="#/tasks" class="al bad"><b>${od}</b> tugas Anda terlambat</a>`:''}
   ${reqLate?`<a href="#/requests" class="al bad"><b>${reqLate}</b> permintaan data ke unit melewati tenggat</a>`:''}
   ${flagged?`<a href="#/repo/QS" class="al warn"><b>${flagged}</b> indikator bertanda anomali belum valid</a>`:''}
   ${open?`<a href="#/risks" class="al warn"><b>${open}</b> anomali data masih terbuka</a>`:''}
   ${OUTBOX.length?`<span class="al warn"><b>${OUTBOX.length}</b> perubahan menunggu sinkron</span>`:''}
   ${!od&&!reqLate&&!flagged&&!open?'<span class="muted">Tidak ada yang mendesak.</span>':''}
  </div></div>
 ${m.role!=='pengarah'?`<div class="card"><div class="ch"><h2>Tugas saya</h2><a href="#/tasks">Semua</a></div>${soon.length||od?'':'<p class="muted">Tidak ada tugas jatuh tempo dalam 14 hari.</p>'}${mine.filter(isOverdue).concat(soon).slice(0,6).map(taskRow).join('')}</div>`:''}
 <div class="card"><div class="ch"><h2>Tenggat berikutnya</h2><a href="#/calendar">Kalender</a></div>${next.map(c=>`<div class="row"><div class="dt"><b>${c.date.slice(8)}</b><small>${MON[+c.date.slice(5,7)-1]}</small></div><div class="rb"><div>${esc(c.title)}</div><div class="meta">${rkChip(c.rank)} ${chip(c.status,c.status==='resmi'?'bad':c.status==='estimasi'?'w':'g')} ${dayTag(c.date)}</div></div></div>`).join('')}</div>`};
let deferredPrompt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;if(location.hash.startsWith('#/home')||!location.hash)route(true)});
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function installCard(){if(isStandalone()||LS.get('u1d.noinst',false))return '';
 if(deferredPrompt)return `<div class="card inst"><b>Pasang aplikasi</b><p>Pasang di layar utama agar terbuka seperti aplikasi.</p><div class="btns"><button class="btn" data-act="noinst">Nanti</button><button class="btn pri" data-act="install">Pasang</button></div></div>`;
 if(isIOS())return `<div class="card inst"><b>Pasang di iPhone/iPad</b><p>Buka lewat <b>Safari</b>, ketuk tombol <b>Bagikan</b> (kotak berpanah ke atas), pilih <b>Tambah ke Layar Utama</b>.</p><div class="btns"><button class="btn" data-act="noinst">Mengerti</button></div></div>`;
 return ''}

/* ---- Tugas ---- */
function taskRow(t){const od=isOverdue(t);const can=canEdit('tasks',t);return `<div class="row task ${t.status==='selesai'?'done':''}" data-act="task" data-id="${t.id}"><button class="ck ${t.status}" data-act="tick" data-id="${t.id}" ${can?'':'disabled'} aria-label="Tandai selesai"></button><div class="rb"><div class="tt">${esc(t.title)}</div><div class="meta">${rkChip(t.rank)} <span>${esc(uname(t.owner))}</span> <span class="${od?'late':''}">${t.due?fmtD(t.due):esc(t.dueText)}</span>${t.status!=='belum'&&t.status!=='selesai'?chip(ST_LABEL[t.status],stCls(t.status)):''}${t.link?'<span class="lnk">bukti</span>':''}</div></div></div>`}
V.tasks=()=>{const m=me(),f=U.task;
 const whoOpts=[['me','Tugas saya'],['all','Semua orang'],...DB.users.filter(u=>u.role!=='pengarah').map(u=>[u.id,u.short+' · '+u.title]),['group:pengarah','Pengarah (Rektor & WR)']];
 if(m.role==='pengarah'&&f.who==='me')f.who='all';
 let l=DB.tasks.filter(t=>f.who==='all'?true:f.who==='me'?t.owner===m.id:t.owner===f.who);
 if(f.rank!=='ALL')l=l.filter(t=>t.rank===f.rank||t.rank==='ALL');
 const done=l.filter(t=>t.status==='selesai');let act=l.filter(t=>t.status!=='selesai');
 const grp={late:[],w2:[],later:[],rec:[]};act.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).forEach(t=>{if(!t.due)grp.rec.push(t);else{const d=daysTo(t.due);(d<0?grp.late:d<=14?grp.w2:grp.later).push(t)}});
 const sect=(t,a)=>a.length?`<div class="gh">${t} <small>${a.length}</small></div>${a.map(taskRow).join('')}`:'';
 const pu=f.who!=='all'&&f.who!=='me'?user(f.who):f.who==='me'?m:null;
 const pr=l.length?Math.round(done.length/l.length*100):0;
 return `<div class="ph"><h1>Target, KPI & Checklist</h1>${canAdd('tasks')?'<button class="btn pri sm" data-act="newtask">+ Tugas</button>':''}</div>
 <div class="filters">${userSelect('t-who',f.who,whoOpts)}<div class="seg">${['ALL','QS','THE','UIGM'].map(r=>`<button class="${f.rank===r?'on':''}" data-act="trank" data-v="${r}">${r==='ALL'?'Semua':RK[r].n}</button>`).join('')}</div></div>
 ${pu&&pu.target?`<div class="card kpi"><div class="ch"><h2>Target & KPI — ${esc(pu.short)}</h2><span>${pr}% selesai</span></div><p>${esc(pu.target)}</p><ul>${(pu.kpi||[]).map(k=>`<li>${esc(k)}</li>`).join('')}</ul><div class="stk"><i class="s-v" style="width:${pr}%"></i></div></div>`:`<div class="muted sm">${done.length}/${l.length} tugas selesai (${pr}%)</div>`}
 <div class="card flush">${sect('Terlambat',grp.late)}${sect('14 hari ke depan',grp.w2)}${sect('Berikutnya',grp.later)}${sect('Rutin / berulang',grp.rec)}${act.length?'':'<p class="empty">Tidak ada tugas aktif.</p>'}${done.length?`<details><summary>Selesai (${done.length})</summary>${done.map(taskRow).join('')}</details>`:''}</div>`};
function taskSheet(t){const lead=isAdmin()||(isKoor()&&t.team===myTeam());const can=canEdit('tasks',t);
 const fields=[{k:'status',l:'Status',t:'select',opts:TASK_ST.map(s=>[s,ST_LABEL[s]])},{k:'link',l:'Tautan bukti (Drive/URL)',t:'url',ph:'https://…'},{k:'note',l:'Catatan',t:'textarea'}];
 if(lead)fields.unshift({k:'title',l:'Tugas',t:'textarea',req:1},{k:'owner',l:'Penanggung jawab',t:'select',opts:[...userOpts(false),['group:pengarah','Pengarah (Rektor & WR)']]},{k:'rank',l:'Ranking',t:'select',opts:rankOpts},{k:'dueText',l:'Tenggat (teks)'},{k:'due',l:'Tanggal tenggat',t:'date'},{k:'evidenceReq',l:'Bukti selesai'});
 const head=`<div class="dh">${rkChip(t.rank)} <span>${esc(uname(t.owner))}</span> <b>${t.due?fmtD(t.due):esc(t.dueText)}</b></div>${lead?'':`<p class="tsk">${esc(t.title)}</p><p class="muted sm">Bukti selesai: ${esc(t.evidenceReq)}</p>`}`;
 if(!can){sheet(`<div class="sh-h"><h3>Tugas</h3><button class="x" data-close>×</button></div><div class="sh-b">${head}<p class="tsk">${esc(t.title)}</p><p class="muted sm">Bukti: ${esc(t.evidenceReq)}</p><p>Status: ${chip(ST_LABEL[t.status],stCls(t.status))}</p>${t.link?`<p><a href="${esc(t.link)}" target="_blank" rel="noopener">Buka bukti</a></p>`:''}${t.note?`<p>${esc(t.note)}</p>`:''}</div>`);return}
 formSheet('Tugas',fields,t,{head,onSave:v=>{const n=Object.assign({},t,v);if(v.status==='selesai'&&!n.link&&t.status!=='selesai')toast('Catatan: tautan bukti belum diisi');put('tasks',n);if(v.status!==t.status)logAct(me().short+': tugas “'+n.title.slice(0,50)+'” → '+ST_LABEL[v.status]);closeSheet();route(true)},onDelete:lead?()=>{remove('tasks',t.id);route(true)}:null})}
function newTask(){const m=me();const t={id:uid('t'),owner:m.id,team:m.team==='ALL'?'ALL':m.team,rank:m.team==='ALL'?'ALL':m.team,dueText:'',due:'',title:'',evidenceReq:'',status:'belum',link:'',note:''};
 formSheet('Tugas baru',[{k:'title',l:'Tugas',t:'textarea',req:1},{k:'owner',l:'Penanggung jawab',t:'select',opts:userOpts(false)},{k:'rank',l:'Ranking',t:'select',opts:rankOpts},{k:'due',l:'Tanggal tenggat',t:'date'},{k:'evidenceReq',l:'Bukti selesai'}],t,{onSave:v=>{const n=Object.assign(t,v);const o=user(n.owner);n.team=o?o.team:'ALL';n.dueText=n.due?fmtD(n.due):'';put('tasks',n);closeSheet();route(true)}})}

/* ---- Repositori ---- */
V.repo=(rank)=>{rank=RK[rank]&&rank!=='ALL'?rank:'QS';const p=progress(rank),f=U.repo;
 const groups=[...new Set(DB.indicators.filter(i=>i.rank===rank).map(i=>i.group))];
 const owners=[...new Set(DB.indicators.filter(i=>i.rank===rank).map(i=>i.owner))];
 const tabs=`<div class="tabs">${['QS','THE','UIGM'].map(r=>`<a class="${r===rank?'on':''}" href="#/repo/${r}" style="--c:${RK[r].c}">${RK[r].n}</a>`).join('')}<a href="#/master">Data Inti</a><a href="#/evidence">Bukti</a></div>`;
 return `<div class="ph"><h1>Repositori ${RK[rank].n}</h1><span class="muted sm">${RK[rank].full}</span></div>${tabs}
 <div class="card" style="--c:${RK[rank].c}"><div class="rh"><b>${p.valid}/${p.t} valid</b><span>${p.filled} terisi</span></div>${bar(p.c,p.t)}<div class="legend"><span><i class="s-v"></i>valid/final ${p.valid}</span><span><i class="s-c"></i>dicek ${p.c.dicek}</span><span><i class="s-d"></i>draft ${p.c.draft}</span><span><i class="s-k"></i>kosong ${p.c.kosong}</span></div>${rank==='UIGM'&&DB.indicators.some(i=>i.rank==='UIGM'&&i.placeholder)?`<div class="callout warn">Judul indikator UIGM masih placeholder (kode SI/EC/WS/WR/TR/ED/GD). Impor daftar resmi dari Panduan UIGM 2026 lewat <a href="#/admin">Admin › Impor CSV</a>.</div>`:''}${rank==='THE'?'<div class="callout info">SDG17 wajib + minimal 3 SDG lain (skor akhir: SDG17 22% + 3 SDG terbaik 26% masing-masing). Kerjakan 6 SDG prioritas lebih dulu.</div>':''}</div>
 <div class="filters wrap"><input id="r-q" type="search" placeholder="Cari kode atau kata kunci…" value="${esc(f.q)}">${userSelect('r-g',f.g,[['','Semua kelompok'],...groups.map(g=>[g,g])])}${userSelect('r-o',f.own,[['','Semua pemilik'],...owners.map(o=>[o,uname(o)]),['mine','Saya (pemilik/checker)']])}${userSelect('r-s',f.st,[['','Semua status'],...IND_ST.map(s=>[s,ST_LABEL[s]]),['flag','Bertanda anomali'],['needev','Butuh bukti, belum ada']])}</div>
 <div class="card flush" id="rlist" data-rank="${rank}">${repoList(rank)}</div>`};
function repoList(rank){const f=U.repo,m=me();const q=f.q.toLowerCase();
 let l=DB.indicators.filter(i=>i.rank===rank);
 if(f.g)l=l.filter(i=>i.group===f.g);if(f.own==='mine')l=l.filter(i=>i.owner===m.id||i.checker===m.id);else if(f.own)l=l.filter(i=>i.owner===f.own);
 if(f.st==='flag')l=l.filter(i=>i.flag);else if(f.st==='needev')l=l.filter(i=>i.evReq&&!evOf(i.id).length);else if(f.st)l=l.filter(i=>i.status===f.st);
 if(q)l=l.filter(i=>(i.code+' '+i.title+' '+i.group+' '+i.val).toLowerCase().includes(q));
 if(!l.length)return '<p class="empty">Tidak ada indikator yang cocok.</p>';
 const lim=l.length>150?150:l.length;let last='';let out='';
 l.slice(0,lim).forEach(i=>{if(i.group!==last){last=i.group;const gl=DB.indicators.filter(x=>x.rank===rank&&x.group===i.group);const v=gl.filter(x=>['valid','final'].includes(x.status)).length;out+=`<div class="gh">${esc(i.group)} <small>${v}/${gl.length}</small></div>`}
  const ec=evOf(i.id).length;const c=consistency(i);
  out+=`<div class="row ind" data-act="ind" data-id="${i.id}"><div class="code">${esc(i.code)}</div><div class="rb"><div class="tt">${esc(i.title)}</div><div class="meta"><span>${esc(uname(i.owner))}</span>${i.val!==''?`<b class="val">${esc(i.val)}${i.vunit&&i.vunit.length<8?' '+esc(i.vunit):''}</b>`:''}${i.flag?'<span class="late">anomali</span>':''}${i.evReq?`<span class="${ec?'okk':'muted'}">bukti ${ec}</span>`:''}${c&&c.ok===false?'<span class="late">beda dari Data Inti</span>':''}</div></div>${chip(ST_LABEL[i.status],stCls(i.status))}</div>`});
 if(l.length>lim)out+=`<p class="empty">Menampilkan ${lim} dari ${l.length}. Persempit pencarian.</p>`;return out}
function indSheet(i){const m=me();const can=canEdit('indicators',i);const c=consistency(i);const evs=evOf(i.id);
 const lead=isAdmin()||(isKoor()&&i.rank===m.team);
 const dis=can?'':'disabled';
 const sel=(id,opts,v)=>`<select id="${id}" ${dis}>${opts.map(([a,b])=>`<option value="${esc(a)}" ${a===v?'selected':''}>${esc(b)}</option>`).join('')}</select>`;
 sheet(`<div class="sh-h"><h3>${esc(i.code)} ${rkChip(i.rank)}</h3><button class="x" data-close>×</button></div><div class="sh-b">
  <div class="dh"><span>${esc(i.group)}</span> ${chip(i.fmt,'g')}${i.evReq?chip('bukti wajib','w'):''}${i.polReq?chip('tanggal terbit kebijakan','w'):''}</div>
  <p class="tsk">${esc(i.title)}</p>
  ${i.flag?`<div class="callout bad"><b>Anomali:</b> ${esc(i.flag)}</div>`:''}
  <div class="two"><label class="fld"><span>Status</span>${sel('i_st',IND_ST.map(s=>[s,ST_LABEL[s]]),i.status)}</label><label class="fld"><span>Pemeriksa (checker)</span>${sel('i_chk',userOpts(true),i.checker)}</label></div>
  <label class="fld"><span>Nilai / jawaban</span><input id="i_val" value="${esc(i.val)}" ${dis}></label>
  <div class="two"><label class="fld"><span>Satuan</span><input id="i_vu" value="${esc(i.vunit)}" ${dis}></label><label class="fld"><span>Periode data</span><input id="i_per" value="${esc(i.period)}" placeholder="mis. TA 2025" ${dis}></label></div>
  <div class="two"><label class="fld"><span>Unit pemilik data</span><input id="i_unit" value="${esc(i.unit)}" ${dis}></label><label class="fld"><span>Pemilik (maker)</span>${lead?sel('i_own',userOpts(false),i.owner):`<input value="${esc(uname(i.owner))}" disabled>`}</label></div>
  <label class="fld"><span>Sumber data</span><input id="i_src" value="${esc(i.source)}" ${dis}></label>
  <label class="fld"><span>Hubungkan ke Data Inti (satu angka untuk semua ranking)</span>${sel('i_mk',[['','— tidak dihubungkan —'],...DB.master.map(x=>[x.key,x.label+(x.val!==''?' = '+x.val:'')])],i.masterKey)}</label>
  ${c&&c.m?`<div class="callout ${c.ok===false?'bad':c.ok?'ok':'info'}">${c.ok===false?`Nilai ini berbeda dari Data Inti (<b>${esc(c.m.val)}</b>).`:c.ok?'Sesuai Data Inti.':c.m.val!==''?`Data Inti: <b>${esc(c.m.val)} ${esc(c.m.vunit)}</b>`:'Data Inti belum terisi.'} ${can&&c.m.val!==''&&c.ok!==true?'<button class="btn sm" id="i_usem">Pakai nilai Data Inti</button>':''}</div>`:''}
  <label class="fld"><span>Catatan</span><textarea id="i_note" rows="2" ${dis}>${esc(i.note)}</textarea></label>
  <div class="gh">Bukti tertaut <small>${evs.length}</small></div>
  ${evs.map(e=>`<div class="row evi"><div class="rb"><div class="tt">${esc(e.title)}</div><div class="meta"><span>${esc(e.type)}</span>${e.date?`<span>${fmtD(e.date)}</span>`:''}</div></div>${e.link?`<a class="btn sm" href="${esc(e.link)}" target="_blank" rel="noopener">Buka</a>`:''}</div>`).join('')||'<p class="muted sm">Belum ada bukti.</p>'}
  ${me().role!=='pengarah'?`<button class="btn sm" id="i_addev">+ Tambah / tautkan bukti</button>`:''}
 </div><div class="btns"><span class="sp"></span><button class="btn" data-close>Tutup</button>${can?'<button class="btn pri" id="i_ok">Simpan</button>':''}</div>`,s=>{
  const um=$('#i_usem',s);if(um)um.onclick=()=>{$('#i_val',s).value=c.m.val;$('#i_vu',s).value=c.m.vunit||$('#i_vu',s).value};
  const ae=$('#i_addev',s);if(ae)ae.onclick=()=>{closeSheet();evidenceForm({refs:i.id,rank:i.rank,title:'',type:'Dokumen'},()=>{indSheet(DB.indicators.find(x=>x.id===i.id))})};
  const ok=$('#i_ok',s);if(ok)ok.onclick=()=>{const n=Object.assign({},i,{val:$('#i_val',s).value.trim(),vunit:$('#i_vu',s).value.trim(),period:$('#i_per',s).value.trim(),unit:$('#i_unit',s).value.trim(),source:$('#i_src',s).value.trim(),masterKey:$('#i_mk',s).value,note:$('#i_note',s).value.trim(),checker:$('#i_chk',s).value});if($('#i_own',s))n.owner=$('#i_own',s).value;
   let st=$('#i_st',s).value;if(n.val!==''&&st==='kosong'&&i.status==='kosong')st='draft';
   if(n.val===''&&['draft'].includes(st)&&i.status==='kosong')st='kosong';
   n.status=st;if(st!==i.status){const why=statusRule(n,st);if(why){toast(why);return}}
   else if(['valid','final'].includes(i.status)&&n.val!==i.val){n.status='dicek';toast('Nilai berubah: status dikembalikan ke Dicek')}
   put('indicators',n);if(n.status!==i.status)logAct(me().short+': '+n.code+' → '+ST_LABEL[n.status]);closeSheet();route(true);toast('Tersimpan')}})}

/* ---- Data Inti ---- */
V.master=()=>{const tabs=`<div class="tabs"><a href="#/repo/QS">QS</a><a href="#/repo/THE">THE</a><a href="#/repo/UIGM">UIGM</a><a class="on" href="#/master">Data Inti</a><a href="#/evidence">Bukti</a></div>`;
 const rows=DB.master.map(m=>{const used=DB.indicators.filter(i=>i.masterKey===m.key);const bad=used.filter(i=>{const c=consistency(i);return c&&c.ok===false});return {m,used,bad}});
 const nb=rows.reduce((a,r)=>a+r.bad.length,0);
 return `<div class="ph"><h1>Data Inti Universitas</h1>${canAdd('master')?'<button class="btn pri sm" data-act="newmaster">+ Data</button>':''}</div>${tabs}
 <div class="callout info">Satu angka resmi per fakta, dipakai oleh QS, THE, dan UIGM. Ubah di sini, lalu terapkan ke semua indikator yang terhubung.</div>
 ${nb?`<div class="callout bad"><b>${nb}</b> indikator berbeda dari Data Inti — buka daftar di bawah (bertanda merah).</div>`:''}
 <div class="card flush">${rows.map(({m,used,bad})=>`<div class="row" data-act="master" data-id="${m.id}"><div class="rb"><div class="tt">${esc(m.label)}</div><div class="meta"><span>${esc(m.unit)}</span><span>${esc(m.period||'periode ?')}</span><span>dipakai ${used.length} indikator</span>${bad.length?`<span class="late">${bad.length} berbeda</span>`:''}</div></div><div class="mv">${m.val!==''?`<b>${esc(m.val)}</b> <small>${esc(m.vunit)}</small>`:'<small class="muted">kosong</small>'}</div>${chip(m.status,m.status==='terverifikasi'?'ok':m.status==='kosong'?'g':'w')}</div>`).join('')}</div>
 ${isAdmin()||isKoor()?'<div class="btns"><button class="btn" data-act="applymaster">Terapkan nilai Data Inti ke indikator kosong</button></div>':''}`};
const masterFields=[{k:'label',l:'Nama data',req:1},{k:'key',l:'Kunci (unik, tanpa spasi)',req:1},{k:'val',l:'Nilai'},{k:'vunit',l:'Satuan'},{k:'period',l:'Periode (mis. TA 2025)'},{k:'unit',l:'Unit pemilik'},{k:'source',l:'Sumber / dokumen'},{k:'status',l:'Status',t:'select',opts:['kosong','perlu verifikasi','terverifikasi']}];
function masterSheet(m,isNew){formSheet(isNew?'Data Inti baru':'Data Inti',masterFields,m,{onSave:v=>{const n=Object.assign({},m,v);n.key=n.key.replace(/\s+/g,'_');if(n.val!==''&&n.status==='kosong')n.status='perlu verifikasi';put('master',n);logAct(me().short+': Data Inti “'+n.label+'” = '+n.val);closeSheet();route(true)},onDelete:!isNew&&isAdmin()?()=>{remove('master',m.id);route(true)}:null})}
function applyMaster(){let n=0;DB.indicators.forEach(i=>{if(!i.masterKey||i.val!=='')return;const m=DB.master.find(x=>x.key===i.masterKey);if(m&&m.val!==''){put('indicators',Object.assign({},i,{val:m.val,vunit:i.vunit||m.vunit,status:'draft',source:i.source||'Data Inti'}));n++}});toast(n+' indikator diisi dari Data Inti');route(true)}

/* ---- Bukti ---- */
V.evidence=()=>{const f=U.ev;const tabs=`<div class="tabs"><a href="#/repo/QS">QS</a><a href="#/repo/THE">THE</a><a href="#/repo/UIGM">UIGM</a><a href="#/master">Data Inti</a><a class="on" href="#/evidence">Bukti</a></div>`;
 return `<div class="ph"><h1>Repositori Bukti</h1>${canAdd('evidence')?'<button class="btn pri sm" data-act="newev">+ Bukti</button>':''}</div>${tabs}
 <div class="filters wrap"><input id="e-q" type="search" placeholder="Cari judul, kode, catatan…" value="${esc(f.q)}"><div class="seg">${['','QS','THE','UIGM'].map(r=>`<button class="${f.rank===r?'on':''}" data-act="erank" data-v="${r}">${r?RK[r].n:'Semua'}</button>`).join('')}</div></div>
 <div class="card flush" id="elist">${evList()}</div>`};
function evList(){const f=U.ev,q=f.q.toLowerCase();let l=DB.evidence.slice().sort((a,b)=>(b._u||0)-(a._u||0));if(f.rank)l=l.filter(e=>e.rank===f.rank);if(q)l=l.filter(e=>(e.title+' '+e.refs+' '+e.note+' '+e.type).toLowerCase().includes(q));
 if(!l.length)return '<p class="empty">Belum ada bukti. Tambahkan tautan Drive/URL atau unggah berkas, lalu kaitkan ke kode indikator.</p>';
 return l.map(e=>`<div class="row" data-act="ev" data-id="${e.id}"><div class="rb"><div class="tt">${esc(e.title)}</div><div class="meta">${rkChip(e.rank)}<span>${esc(e.type)}</span>${e.date?`<span>${fmtD(e.date)}</span>`:''}<span>${esc(uname(e._by))}</span></div><div class="meta">${(e.refs||'').split(/[,\s;]+/).filter(Boolean).slice(0,6).map(r=>`<span class="tag">${esc(r.replace(/^(QS|THE|UIG)-/,''))}</span>`).join('')}</div></div>${e.link?`<a class="btn sm" href="${esc(e.link)}" target="_blank" rel="noopener" data-stop>Buka</a>`:''}</div>`).join('')}
const evFields=[{k:'title',l:'Judul bukti',req:1,ph:'mis. SK Kebijakan Kesetaraan Gender 2025'},{k:'rank',l:'Ranking',t:'select',opts:rankOpts},{k:'refs',l:'Kode indikator terkait (pisah koma)',ph:'THE-5.1.1, THE-5.2.1',hint:'Kode tampil di daftar repositori, mis. QS-05, THE-5.1.1, UIG-EC3'},{k:'type',l:'Jenis',t:'select',opts:['Dokumen','SK/Kebijakan','Foto','Laporan','Data/Spreadsheet','Tautan web','MoU/Kerja sama']},{k:'link',l:'Tautan (Drive/URL)',t:'url',ph:'https://…'},{k:'date',l:'Tanggal dokumen',t:'date'},{k:'period',l:'Periode data'},{k:'note',l:'Catatan',t:'textarea',rows:2}];
function evidenceForm(e,after){const isNew=!e.id;const item=Object.assign({id:uid('e'),rank:'ALL',type:'Dokumen',link:'',date:'',period:'',note:'',refs:''},e);
 const extra=API()?`<label class="fld"><span>Atau unggah berkas (maks 8 MB, disimpan di Google Drive tim)</span><input type="file" id="ev-file"></label>`:'<p class="muted sm">Mode lokal: isi tautan Drive/URL. Unggah berkas tersedia setelah server tersambung.</p>';
 formSheet(isNew?'Tambah bukti':'Bukti',evFields,item,{extra,onSave:async v=>{const n=Object.assign({},item,v);n.refs=n.refs.replace(/[;\s]+/g,',').replace(/,+/g,',').replace(/^,|,$/g,'');
  const fi=$('#ev-file');if(fi&&fi.files[0]){const f=fi.files[0];if(f.size>8*1024*1024){toast('Berkas melebihi 8 MB');return}toast('Mengunggah…');try{const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(f)});const j=await call('upload',{name:f.name,mime:f.type||'application/octet-stream',data,rank:n.rank});if(!j.ok)throw new Error(j.error||'gagal');n.link=j.url;if(!n.title)n.title=f.name}catch(err){toast('Unggah gagal: '+err.message);return}}
  if(!n.link&&!n.note){toast('Isi tautan atau unggah berkas');return}
  put('evidence',n);logAct(me().short+' menambah bukti: '+n.title.slice(0,50));closeSheet();toast('Bukti tersimpan');if(after)after();else route(true)},onDelete:!isNew&&canEdit('evidence',item)?()=>{remove('evidence',item.id);route(true)}:null})}

/* ---- Kalender ---- */
V.calendar=()=>{const f=U.cal;let l=DB.calendar.filter(c=>(f.rank==='ALL'||c.rank===f.rank||c.rank==='ALL')&&(f.past||daysTo(c.date)>=0)).sort((a,b)=>a.date.localeCompare(b.date));
 let last='',out='';l.forEach(c=>{const k=c.date.slice(0,7);if(k!==last){last=k;out+=`<div class="gh">${MON[+k.slice(5)-1]} ${k.slice(0,4)}</div>`}const n=daysTo(c.date);
  out+=`<div class="row ${n<0?'done':''}" ${isAdmin()?`data-act="cal" data-id="${c.id}"`:''}><div class="dt"><b>${c.date.slice(8)}</b><small>${MON[+c.date.slice(5,7)-1]}</small></div><div class="rb"><div class="tt">${esc(c.title)}</div><div class="meta">${rkChip(c.rank)}${chip(c.status,c.status==='resmi'?'bad':c.status==='estimasi'?'w':'g')}${n>=0?dayTag(c.date):''}${c.note?`<span>${esc(c.note)}</span>`:''}</div></div></div>`});
 return `<div class="ph"><h1>Kalender & Tenggat</h1>${isAdmin()?'<button class="btn pri sm" data-act="newcal">+ Agenda</button>':''}</div>
 <div class="filters wrap"><div class="seg">${['ALL','QS','THE','UIGM'].map(r=>`<button class="${f.rank===r?'on':''}" data-act="crank" data-v="${r}">${r==='ALL'?'Semua':RK[r].n}</button>`).join('')}</div><label class="chk"><input type="checkbox" id="c-past" ${f.past?'checked':''}> tampilkan yang lewat</label><button class="btn sm" data-act="ics">Unduh .ics</button></div>
 <div class="legend"><span>${chip('resmi','bad')} ditetapkan lembaga</span><span>${chip('estimasi','w')} perkiraan dari pola tahun lalu — konfirmasi</span><span>${chip('internal','g')} tenggat internal UMB</span></div>
 <div class="card flush">${out||'<p class="empty">Tidak ada agenda.</p>'}</div>`};
function calSheet(c,isNew){formSheet(isNew?'Agenda baru':'Agenda',[{k:'title',l:'Judul',req:1},{k:'date',l:'Tanggal',t:'date',req:1},{k:'rank',l:'Ranking',t:'select',opts:rankOpts},{k:'status',l:'Jenis',t:'select',opts:['internal','resmi','estimasi']},{k:'note',l:'Catatan'}],c,{onSave:v=>{put('calendar',Object.assign({},c,v));closeSheet();route(true)},onDelete:isNew?null:()=>{remove('calendar',c.id);route(true)}})}
function exportICS(){const l=DB.calendar.filter(c=>U.cal.rank==='ALL'||c.rank===U.cal.rank||c.rank==='ALL');const d=s=>s.replace(/-/g,'');const now=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
 const ev=l.map(c=>{const e=new Date(Date.parse(c.date+'T00:00:00Z')+864e5).toISOString().slice(0,10);return ['BEGIN:VEVENT','UID:'+c.id+'@umb-satudata','DTSTAMP:'+now,'DTSTART;VALUE=DATE:'+d(c.date),'DTEND;VALUE=DATE:'+d(e),'SUMMARY:['+RK[c.rank].n+'] '+c.title.replace(/[,;]/g,' '),'DESCRIPTION:'+(c.status+(c.note?' — '+c.note:'')).replace(/[,;]/g,' '),'END:VEVENT'].join('\r\n')});
 download('Kalender_TaskForce_UMB.ics','BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UMB Satu Data//ID\r\n'+ev.join('\r\n')+'\r\nEND:VCALENDAR','text/calendar')}

/* ---- Permintaan data ---- */
const REQ_ST=['belum diminta','diminta','sebagian','diterima'];
V.requests=()=>{const by={};DB.requests.forEach(r=>(by[r.unit]=by[r.unit]||[]).push(r));
 return `<div class="ph"><h1>Permintaan Data ke Unit</h1>${canAdd('requests')?'<button class="btn pri sm" data-act="newreq">+ Permintaan</button>':''}</div>
 <div class="callout info">Lacak data yang diminta dari unit pemilik data. Gunakan “Salin pesan” untuk dikirim lewat WhatsApp/email.</div>
 <div class="card flush">${DB.requests.slice().sort((a,b)=>(a.due||'').localeCompare(b.due||'')).map(r=>{const late=r.status!=='diterima'&&r.due&&daysTo(r.due)<0;return `<div class="row" data-act="req" data-id="${r.id}"><div class="rb"><div class="tt">${esc(r.unit)}</div><div class="meta"><span>${esc(r.what)}</span></div><div class="meta">${(r.ranks||'').split(',').filter(Boolean).map(rkChip).join('')}<span class="${late?'late':''}">${r.due?fmtD(r.due):''}</span><span>PIC ${esc(uname(r.pic))}</span></div></div>${chip(r.status,r.status==='diterima'?'ok':r.status==='belum diminta'?'g':'w')}</div>`}).join('')}</div>`};
function reqSheet(r,isNew){const F=[{k:'unit',l:'Unit',req:1},{k:'what',l:'Data yang diminta',t:'textarea',req:1},{k:'ranks',l:'Untuk ranking (QS,THE,UIGM)'},{k:'due',l:'Batas penyerahan',t:'date'},{k:'pic',l:'PIC tim',t:'select',opts:userOpts(false)},{k:'status',l:'Status',t:'select',opts:REQ_ST},{k:'note',l:'Catatan',t:'textarea',rows:2}];
 const msg=()=>`Yth. Pimpinan/Kepala ${r.unit},\n\nDalam rangka pemeringkatan ${(r.ranks||'').split(',').filter(Boolean).map(x=>RK[x]?RK[x].n:x).join(', ')} (Task Force Pemeringkatan UMB), mohon dukungan data berikut:\n${r.what}\n\nBatas penyerahan: ${r.due?fmtD(r.due):'(segera)'}.\nMohon dikirim ke ${uname(r.pic)}. Data akan dikelola di repositori Satu Data UMB.\n\nTerima kasih.\nTask Force Pemeringkatan UMB`;
 formSheet(isNew?'Permintaan baru':'Permintaan data',F,r,{extra:isNew?'':'<button class="btn sm" id="rq-copy">Salin pesan permintaan</button>',onSave:v=>{put('requests',Object.assign({},r,v));closeSheet();route(true)},onDelete:isNew||!canEdit('requests',r)?null:()=>{remove('requests',r.id);route(true)}});
 const b=$('#rq-copy');if(b)b.onclick=()=>{navigator.clipboard?navigator.clipboard.writeText(msg()).then(()=>toast('Pesan disalin')):toast('Tidak dapat menyalin')}}

/* ---- Risiko & anomali ---- */
V.risks=()=>{const f=U.risk;let l=DB.risks.filter(r=>(!f.type||r.type===f.type));
 return `<div class="ph"><h1>Risiko & Anomali Data</h1>${canAdd('risks')?'<button class="btn pri sm" data-act="newrisk">+ Catat</button>':''}</div>
 <div class="filters"><div class="seg">${[['','Semua'],['risiko','Risiko'],['anomali','Anomali data']].map(([v,t])=>`<button class="${f.type===v?'on':''}" data-act="rtype" data-v="${v}">${t}</button>`).join('')}</div></div>
 <div class="card flush">${l.map(r=>`<div class="row" data-act="risk" data-id="${r.id}"><div class="rb"><div class="tt">${esc(r.title)}</div><div class="meta">${chip(r.type,r.type==='anomali'?'w':'g')}${chip(r.impact,r.impact==='tinggi'?'bad':r.impact==='sedang'?'w':'g')}<span>${esc(uname(r.owner))}</span></div><div class="meta"><span>${esc(r.mitigation)}</span></div></div>${chip(r.status,r.status==='selesai'?'ok':r.status==='dimitigasi'?'b':'bad')}</div>`).join('')}</div>`};
function riskSheet(r,isNew){formSheet(isNew?'Catat risiko/anomali':'Risiko / anomali',[{k:'title',l:'Uraian',t:'textarea',req:1},{k:'type',l:'Jenis',t:'select',opts:['risiko','anomali']},{k:'impact',l:'Dampak',t:'select',opts:['tinggi','sedang','rendah']},{k:'mitigation',l:'Mitigasi / tindakan',t:'textarea',rows:2},{k:'owner',l:'Pemilik',t:'select',opts:userOpts(false)},{k:'status',l:'Status',t:'select',opts:['terbuka','dimitigasi','selesai']}],r,{onSave:v=>{put('risks',Object.assign({},r,v));closeSheet();route(true)},onDelete:isNew||!isAdmin()?null:()=>{remove('risks',r.id);route(true)}})}

/* ---- Tim ---- */
V.people=()=>{const teams=['QS','THE','UIGM'];
 return `<div class="ph"><h1>Tim & Beban Kerja</h1></div><div class="callout info">Pembagian dihitung dari jumlah indikator pada berkas resmi tiap lembaga.</div>
 ${teams.map(t=>{const mem=DB.users.filter(u=>u.team===t);const tot=DB.indicators.filter(i=>i.rank===t).length;return `<div class="card" style="--c:${RK[t].c}"><div class="ch"><h2>${RK[t].full}</h2><span>${tot} indikator</span></div>${mem.map(u=>{const own=DB.indicators.filter(i=>i.owner===u.id);const v=own.filter(i=>['valid','final'].includes(i.status)).length;const tk=DB.tasks.filter(x=>x.owner===u.id);const td=tk.filter(x=>x.status==='selesai').length;return `<div class="row"><div class="av" style="background:${RK[t].c}">${esc(u.short.slice(0,1))}</div><div class="rb"><div class="tt">${esc(u.name)}</div><div class="meta"><span>${esc(u.title)}</span></div><div class="meta"><span>${own.length} indikator (${tot?Math.round(own.length/tot*100):0}%) · ${v} valid</span><span>tugas ${td}/${tk.length}</span></div></div></div>`}).join('')}</div>`}).join('')}
 <div class="card"><div class="ch"><h2>Pimpinan & penanggung jawab</h2></div>${DB.users.filter(u=>u.team==='ALL').map(u=>`<div class="row"><div class="av" style="background:#0E5A3A">${esc(u.short.slice(0,1))}</div><div class="rb"><div class="tt">${esc(u.name)}</div><div class="meta"><span>${esc(u.title)}</span></div></div></div>`).join('')}</div>`};

/* ---- Lainnya ---- */
V.more=()=>{const items=[['#/master','Data Inti','Satu angka resmi lintas ranking'],['#/calendar','Kalender & Tenggat','Resmi vs internal, unduh .ics'],['#/requests','Permintaan Data ke Unit','Lacak data dari unit'],['#/risks','Risiko & Anomali','Pantau hambatan'],['#/people','Tim & Beban Kerja','Siapa memegang apa'],...(isAdmin()?[['#/admin','Admin','Server, pengguna, ekspor/impor']]:[]),['#/guide','Panduan & Pasang Aplikasi','Android, iPhone, cara kerja']];
 return `<div class="ph"><h1>Lainnya</h1></div><div class="card flush">${items.map(([h,t,d])=>`<a class="row lnkrow" href="${h}"><div class="rb"><div class="tt">${t}</div><div class="meta"><span>${d}</span></div></div><span class="chev">›</span></a>`).join('')}<div class="row" data-act="logout"><div class="rb"><div class="tt">Keluar</div><div class="meta"><span>${esc(me().name)}</span></div></div></div></div><p class="muted sm center">Satu Data UMB · versi 1.0</p>`};
V.guide=()=>`<div class="ph"><h1>Panduan</h1></div>
 <div class="card"><h2>Pasang sebagai aplikasi</h2><p><b>Android (Chrome):</b> buka alamat aplikasi → menu ⋮ → <b>Instal aplikasi</b> / <b>Tambahkan ke layar utama</b>.</p><p><b>iPhone/iPad (Safari):</b> buka alamat aplikasi di <b>Safari</b> → ketuk <b>Bagikan</b> → <b>Tambah ke Layar Utama</b>. (Chrome iOS versi lama tidak menampilkan opsi ini.)</p>${deferredPrompt?'<button class="btn pri" data-act="install">Pasang sekarang</button>':''}</div>
 <div class="card"><h2>Cara kerja singkat</h2><ol><li>Buka <b>Tugas</b>: lihat target, KPI, dan checklist Anda; centang bila selesai dan lampirkan tautan bukti.</li><li>Buka <b>Repositori</b>: isi nilai tiap indikator, hubungkan ke <b>Data Inti</b> bila angkanya dipakai ranking lain.</li><li>Unggah/tautkan <b>Bukti</b> dan kaitkan ke kode indikator.</li><li>Rekan satu tim (checker) memeriksa → status <b>Valid</b>. Koordinator menetapkan <b>Final</b> sebelum submit.</li></ol><p class="muted sm">Status Valid mensyaratkan: nilai terisi, bukti tertaut (bila wajib), dan nilai sama dengan Data Inti.</p></div>
 <div class="card"><h2>Status indikator</h2><p>${IND_ST.map(s=>chip(ST_LABEL[s],stCls(s))).join(' ')}</p><p class="muted sm">kosong → draft (pengisi) → dicek (pengisi menyatakan siap) → valid (pemeriksa) → final (koordinator).</p></div>`;

/* ---- Admin ---- */
V.admin=()=>{if(!isAdmin())return '<p class="empty">Hanya untuk admin.</p>';
 const log=DB.log.slice().sort((a,b)=>b.ts-a.ts).slice(0,25);
 return `<div class="ph"><h1>Admin</h1></div>
 <div class="card"><h2>Server (Google Apps Script)</h2><label class="fld"><span>Alamat Web App (akhiran /exec)</span><input id="a-api" value="${esc(SETTINGS.api)}" placeholder="https://script.google.com/macros/s/…/exec"></label><div class="btns left"><button class="btn" data-act="a-save">Simpan alamat</button><button class="btn" data-act="a-test">Uji koneksi</button><button class="btn pri" data-act="a-sync">Sinkronkan</button></div><p class="muted sm">Status: <span class="pill ${ST.sync==='ok'?'o':ST.sync==='lokal'?'l':'e'}">${esc(ST.sync)}</span> · antrean ${OUTBOX.length}</p><div class="btns left"><button class="btn" data-act="a-push">Kirim ulang seluruh data lokal ke server</button></div></div>
 <div class="card"><div class="ch"><h2>Pengguna</h2><button class="btn sm" data-act="a-newuser">+ Pengguna</button></div>${DB.users.map(u=>`<div class="row"><div class="rb"><div class="tt">${esc(u.name)}</div><div class="meta"><span>${esc(u.title)}</span>${chip(u.role,'g')}${chip(u.team,'g')}</div></div><button class="btn sm" data-act="a-user" data-id="${u.id}">Ubah</button><button class="btn sm" data-act="a-pin" data-id="${u.id}">PIN</button></div>`).join('')}</div>
 <div class="card"><h2>Data</h2><div class="btns left wrapb"><button class="btn" data-act="a-exp" data-v="json">Cadangan JSON</button><button class="btn" data-act="a-exp" data-v="indicators">CSV indikator</button><button class="btn" data-act="a-exp" data-v="tasks">CSV tugas</button><button class="btn" data-act="a-exp" data-v="evidence">CSV bukti</button><button class="btn" data-act="a-exp" data-v="master">CSV Data Inti</button></div>
  <h3>Impor</h3><p class="muted sm">CSV indikator: kolom <code>rank, code, group, title, fmt, owner, unit, evReq</code>. Baris dengan rank+code yang sudah ada akan memperbarui judul/kelompok (cocok untuk mengisi daftar resmi UIGM); selain itu ditambahkan. <code>owner</code> boleh nama pendek (mis. Rina).</p><input type="file" id="a-file" accept=".csv,.json,text/csv,application/json"><div class="btns left"><button class="btn" data-act="a-imp">Impor CSV indikator</button><button class="btn" data-act="a-impjson">Pulihkan JSON</button></div>
  <h3>Reset</h3><button class="btn danger" data-act="a-reset">Reset data lokal ke data awal</button></div>
 <div class="card"><h2>Log aktivitas</h2>${log.map(l=>`<div class="row"><div class="rb"><div class="tt sm">${esc(l.text)}</div><div class="meta"><span>${new Date(l.ts).toLocaleString('id-ID')}</span></div></div></div>`).join('')||'<p class="muted sm">Belum ada.</p>'}</div>`};
function userSheet(u,isNew){formSheet(isNew?'Pengguna baru':'Pengguna',[{k:'name',l:'Nama lengkap + gelar',req:1},{k:'short',l:'Nama pendek',req:1},{k:'title',l:'Jabatan di Task Force'},{k:'role',l:'Peran',t:'select',opts:['admin','koordinator','anggota','pengarah']},{k:'team',l:'Tim',t:'select',opts:['ALL','QS','THE','UIGM']}],u,{onSave:v=>{put('users',Object.assign({},u,v));closeSheet();route(true)}})}
function pinSheet(u){sheet(`<div class="sh-h"><h3>Atur PIN — ${esc(u.short)}</h3><button class="x" data-close>×</button></div><div class="sh-b"><label class="fld"><span>PIN baru (4–8 angka). Kosongkan untuk acak.</span><input id="pn" inputmode="numeric" maxlength="8"></label><div id="pn-out"></div></div><div class="btns"><span class="sp"></span><button class="btn" data-close>Tutup</button><button class="btn pri" id="pn-ok">Atur</button></div>`,s=>{$('#pn-ok',s).onclick=async()=>{if(!API()){toast('Hubungkan server dulu');return}try{const j=await call('setpin',{userId:u.id,pin:$('#pn',s).value.trim()});if(!j.ok)throw new Error(j.error||'gagal');$('#pn-out',s).innerHTML=`<div class="callout ok">PIN ${esc(u.short)}: <b class="pin">${esc(j.pin)}</b><br><small>Catat dan bagikan secara pribadi.</small></div>`}catch(e){toast(e.message)}}})}
function exportCSV(kind){const cols={indicators:['id','rank','group','code','title','fmt','owner','checker','unit','val','vunit','period','source','evReq','polReq','masterKey','status','note','flag'],tasks:['id','owner','team','rank','dueText','due','title','evidenceReq','status','link','note'],evidence:['id','rank','refs','title','type','link','date','period','note'],master:['key','label','val','vunit','period','unit','source','status']}[kind];
 const rows=[cols.join(',')].concat(DB[kind].map(x=>cols.map(c=>csvEsc(c==='owner'&&x[c]&&user(x[c])?user(x[c]).short:x[c])).join(',')));download('UMB_SatuData_'+kind+'_'+todayISO()+'.csv','﻿'+rows.join('\n'),'text/csv')}
function importIndicators(text){const rows=parseCSV(text);if(rows.length<2){toast('CSV kosong');return}const h=rows[0].map(x=>x.trim().toLowerCase());const ix=k=>h.indexOf(k.toLowerCase());let add=0,upd=0;const byShort=n=>{const u=DB.users.find(u=>u.short.toLowerCase()===String(n).trim().toLowerCase()||u.id===n);return u?u.id:''};
 rows.slice(1).forEach(r=>{const g=k=>ix(k)<0?'':(r[ix(k)]||'').trim();const rank=g('rank').toUpperCase(),code=g('code');if(!rank||!code||!RK[rank])return;let it=DB.indicators.find(i=>i.rank===rank&&i.code===code);const ev=/^(y|ya|1|true|wajib)/i.test(g('evreq'));
  if(it){const n=Object.assign({},it);if(g('title'))n.title=g('title');if(g('group'))n.group=g('group');if(g('fmt'))n.fmt=g('fmt');if(g('unit'))n.unit=g('unit');if(g('owner'))n.owner=byShort(g('owner'))||n.owner;if(ix('evreq')>=0)n.evReq=ev;delete n.placeholder;put('indicators',n);upd++}
  else{const own=byShort(g('owner'));put('indicators',{id:({QS:'QS-',THE:'THE-',UIGM:'UIG-'}[rank])+code,rank,group:g('group')||'Lainnya',code,title:g('title')||code,fmt:g('fmt')||'Data + bukti',owner:own,checker:own?(DB.indicators.find(i=>i.owner===own)||{}).checker||'':'',unit:g('unit'),val:'',vunit:'',period:'',source:'',evReq:ev,polReq:false,masterKey:'',status:'kosong',note:'',flag:''});add++}});
 toast(upd+' diperbarui, '+add+' ditambahkan');route(true)}
async function pushAll(chunk=120){const ops=[];COLL.forEach(c=>DB[c].forEach(it=>{ops.push({c,item:Object.assign({},it,{_u:it._u||Date.now(),_by:it._by||SESSION.userId})})}));for(let i=0;i<ops.length;i+=chunk){const j=await call('push',{ops:ops.slice(i,i+chunk)});if(!j.ok)throw new Error(j.error||'gagal')}return ops.length}

/* ---- login ---- */
function renderLogin(){const el=$('#login');el.classList.add('on');$('#app').classList.add('hide');
 const users=DB.users.filter(u=>true);const hasApi=!!API();
 el.innerHTML=`<div class="lg-box"><img src="icons/logo-umb.png" alt="Logo Universitas Muhammadiyah Bengkulu" width="96" height="96"><h1>Satu Data UMB</h1><p>Repositori terintegrasi QS Asia · THE SIR · UI GreenMetric</p>
 <label class="fld"><span>Nama</span><select id="l-user">${users.map(u=>`<option value="${u.id}">${esc(u.name)} — ${esc(u.title)}</option>`).join('')}</select></label>
 ${hasApi?'<label class="fld"><span>PIN</span><input id="l-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="8"></label>':'<p class="muted sm">Mode lokal: data tersimpan di perangkat ini. Hubungkan server agar seluruh tim berbagi data.</p>'}
 <button class="btn pri block" id="l-go">Masuk</button>
 <details class="srv"><summary>Pengaturan server</summary><label class="fld"><span>Alamat Web App (/exec)</span><input id="l-api" value="${esc(SETTINGS.api)}" placeholder="https://script.google.com/macros/s/…/exec"></label><button class="btn sm" id="l-saveapi">Simpan</button><hr><label class="fld"><span>Setup Key (hanya untuk inisialisasi pertama oleh admin)</span><input id="l-key" type="password"></label><button class="btn sm" id="l-init">Inisialisasi server dengan data awal</button></details><div id="l-msg" class="muted sm"></div></div>`;
 $('#l-go').onclick=async()=>{const id=$('#l-user').value;const msg=$('#l-msg');
  if(!API()){SESSION={userId:id,token:''};LS.set('u1d.session',SESSION);el.classList.remove('on');$('#app').classList.remove('hide');route();return}
  msg.textContent='Memeriksa…';try{const j=await call('login',{userId:id,pin:$('#l-pin').value.trim()});if(!j.ok)throw new Error(j.message||'PIN salah');SESSION={userId:id,token:j.token};LS.set('u1d.session',SESSION);el.classList.remove('on');$('#app').classList.remove('hide');route();sync(true)}catch(e){msg.textContent=e.message}};
 $('#l-saveapi').onclick=()=>{SETTINGS.api=$('#l-api').value.trim();LS.set('u1d.settings',SETTINGS);renderLogin()};
 $('#l-init').onclick=async()=>{const msg=$('#l-msg');SETTINGS.api=$('#l-api').value.trim();LS.set('u1d.settings',SETTINGS);if(!API()){msg.textContent='Isi alamat Web App dulu';return}msg.textContent='Mengirim data awal…';
  try{const data={};COLL.forEach(c=>data[c]=DB[c].map(it=>Object.assign({},it,{_u:Date.now(),_by:'setup'})));const j=await call('init',{setupKey:$('#l-key').value,data});if(!j.ok)throw new Error(j.message||j.error||'gagal');
   msg.innerHTML='Server siap. <b>PIN awal</b> (catat & bagikan pribadi):<div class="pins">'+Object.keys(j.pins).map(k=>`<div>${esc(user(k)?user(k).short:k)}: <b>${esc(j.pins[k])}</b></div>`).join('')+'</div>'}catch(e){msg.textContent='Gagal: '+e.message}}}

/* ================= router ================= */
const NAV=[['home','Beranda','M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z'],['tasks','Tugas','M9 11l3 3 8-8M4 12v7a1 1 0 0 0 1 1h12'],['repo','Repositori','M4 5h16M4 12h16M4 19h16'],['evidence','Bukti','M21 12l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8'],['more','Lainnya','M5 12h.01M12 12h.01M19 12h.01']];
const DESK=[['master','Data Inti'],['calendar','Kalender'],['requests','Permintaan Data'],['risks','Risiko & Anomali'],['people','Tim'],['admin','Admin'],['guide','Panduan']];
function renderNav(cur){const grp={home:['home'],tasks:['tasks'],repo:['repo','master'],evidence:['evidence'],more:['more','calendar','requests','risks','people','admin','guide']};
 $('#nav').innerHTML=NAV.map(([k,t,d])=>`<a href="#/${k}" class="${(grp[k]||[]).includes(cur)?'on':''}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg><span>${t}</span></a>`).join('')+'<div class="dsk">'+DESK.filter(([k])=>k!=='admin'||isAdmin()).map(([k,t])=>`<a href="#/${k}" class="${cur===k?'on':''}"><span>${t}</span></a>`).join('')+'</div>'}
function route(soft){
 if(!SESSION||!me()){renderLogin();return}
 $('#login').classList.remove('on');$('#app').classList.remove('hide');
 const h=(location.hash.replace(/^#\/?/,'')||'home').split('/');const name=V[h[0]]?h[0]:'home';const y=soft?scrollY:0;
 renderNav(name);$('#main').innerHTML=V[name](h[1]);pill();
 $('#who').textContent=me().short;
 if(!soft)scrollTo(0,0);else scrollTo(0,y)}
addEventListener('hashchange',()=>{closeSheet();route()});

/* ================= events ================= */
let deb;
document.addEventListener('input',e=>{const t=e.target;
 if(t.id==='r-q'){U.repo.q=t.value;clearTimeout(deb);deb=setTimeout(()=>{const l=$('#rlist');if(l)l.innerHTML=repoList(l.dataset.rank)},180)}
 if(t.id==='e-q'){U.ev.q=t.value;clearTimeout(deb);deb=setTimeout(()=>{$('#elist').innerHTML=evList()},180)}});
document.addEventListener('change',e=>{const t=e.target;const rk=()=>{const l=$('#rlist');return l?l.dataset.rank:'QS'};
 if(t.id==='t-who'){U.task.who=t.value;route(true)}
 else if(t.id==='r-g'){U.repo.g=t.value;$('#rlist').innerHTML=repoList(rk())}
 else if(t.id==='r-o'){U.repo.own=t.value;$('#rlist').innerHTML=repoList(rk())}
 else if(t.id==='r-s'){U.repo.st=t.value;$('#rlist').innerHTML=repoList(rk())}
 else if(t.id==='c-past'){U.cal.past=t.checked;route(true)}});
document.addEventListener('click',async e=>{
 if(e.target.closest('[data-close]')&&(e.target.closest('.sh-bg')||e.target.closest('.btn')||e.target.closest('.x'))){closeSheet();return}
 if(e.target.closest('[data-stop]'))return;
 const el=e.target.closest('[data-act]');if(!el)return;const act=el.dataset.act,id=el.dataset.id,v=el.dataset.v;const by=(c)=>DB[c].find(x=>x.id===id);
 switch(act){
 case 'tick':{e.stopPropagation();const t=by('tasks');if(!t||!canEdit('tasks',t))return;const n=Object.assign({},t,{status:t.status==='selesai'?'belum':'selesai'});put('tasks',n);logAct(me().short+': tugas “'+n.title.slice(0,50)+'” → '+ST_LABEL[n.status]);if(n.status==='selesai'&&!n.link)toast('Selesai. Jangan lupa tautkan bukti di detail tugas.');route(true);break}
 case 'task':taskSheet(by('tasks'));break;
 case 'newtask':newTask();break;
 case 'trank':U.task.rank=v;route(true);break;
 case 'ind':indSheet(by('indicators'));break;
 case 'master':masterSheet(by('master'));break;
 case 'newmaster':masterSheet({id:uid('m_'),key:'',label:'',val:'',vunit:'',period:'',unit:'',source:'',owner:me().id,status:'kosong'},true);break;
 case 'applymaster':confirmBox('Isi semua indikator yang masih kosong dan terhubung ke Data Inti?',applyMaster);break;
 case 'ev':evidenceForm(by('evidence'));break;
 case 'newev':evidenceForm({});break;
 case 'erank':U.ev.rank=v;route(true);break;
 case 'cal':calSheet(by('calendar'));break;
 case 'newcal':calSheet({id:uid('c'),date:todayISO(),rank:'ALL',title:'',status:'internal',note:''},true);break;
 case 'crank':U.cal.rank=v;route(true);break;
 case 'ics':exportICS();break;
 case 'req':reqSheet(by('requests'));break;
 case 'newreq':reqSheet({id:uid('r'),unit:'',what:'',ranks:'QS',due:'',pic:me().id,status:'belum diminta',note:''},true);break;
 case 'risk':riskSheet(by('risks'));break;
 case 'newrisk':riskSheet({id:uid('k'),type:'risiko',title:'',impact:'sedang',mitigation:'',owner:me().id,status:'terbuka'},true);break;
 case 'rtype':U.risk.type=v;route(true);break;
 case 'install':if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;route(true)}break;
 case 'noinst':LS.set('u1d.noinst',true);route(true);break;
 case 'logout':SESSION=null;LS.del('u1d.session');route();break;
 case 'a-save':SETTINGS.api=$('#a-api').value.trim();LS.set('u1d.settings',SETTINGS);toast('Alamat tersimpan');break;
 case 'a-test':{SETTINGS.api=$('#a-api').value.trim();try{const r=await fetch(API()+'?action=ping');const j=await r.json();toast(j.ok?'Terhubung: '+(j.name||'server'):'Server menjawab galat')}catch(err){toast('Tidak dapat terhubung')}break}
 case 'a-sync':sync(true);break;
 case 'a-push':confirmBox('Kirim seluruh data lokal ke server? Data server dengan id sama akan ditimpa.',async()=>{try{toast('Mengirim…');const n=await pushAll();toast(n+' item terkirim')}catch(err){toast(err.message)}});break;
 case 'a-newuser':userSheet({id:uid('u_'),name:'',short:'',title:'',role:'anggota',team:'QS'},true);break;
 case 'a-user':userSheet(by('users'));break;
 case 'a-pin':pinSheet(by('users'));break;
 case 'a-exp':v==='json'?download('UMB_SatuData_backup_'+todayISO()+'.json',JSON.stringify(DB),'application/json'):exportCSV(v);break;
 case 'a-imp':{const f=$('#a-file').files[0];if(!f){toast('Pilih berkas CSV');return}importIndicators(await f.text());break}
 case 'a-impjson':{const f=$('#a-file').files[0];if(!f){toast('Pilih berkas JSON');return}try{const o=JSON.parse(await f.text());if(!o.indicators)throw 0;confirmBox('Pulihkan dari cadangan? Data lokal akan diganti.',()=>{DB=o;DB.version=window.SEED.version;save();toast('Dipulihkan');route(true)})}catch(err){toast('Berkas JSON tidak valid')}break}
 case 'a-reset':confirmBox('Hapus seluruh perubahan lokal dan kembali ke data awal?',()=>{DB=clone(window.SEED);save();OUTBOX=[];LS.set('u1d.outbox',[]);SETTINGS.since=0;LS.set('u1d.settings',SETTINGS);toast('Direset');route(true)});break;
 }});
$('#pill').addEventListener('click',()=>sync(true));
$('#who').addEventListener('click',()=>{location.hash='#/more'});
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
route();sync();
})();
