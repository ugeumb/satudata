/* Satu Data UMB — fitur tambahan: isian UIGM, pencarian lintas tim, PDF berlogo */
(function(){
'use strict';
const K=window.U1D.k,EXT=window.U1D.ext;
const {$,$$,esc,fmtD,todayISO,put,logAct,me,user,uname,isAdmin,isSuper,canEdit,statusRule,sheet,closeSheet,toast,chip,stCls,rkChip,RK,ST_LABEL,IND_ST,userOpts,evOf,consistency,route,download,evidenceForm,bar,parseNum,V,U,ansOf}=K;
const D=()=>K.DB;
const S=window.UIGM_SCHEMA||{};
const CFG=window.U1D_CONFIG||{};
const INST=Object.assign({name:'Universitas Muhammadiyah Bengkulu',country:'Indonesia',web:'https://umb.ac.id'},CFG.INST||{});
const CATNO={SI:1,EC:2,WS:3,WR:4,TR:5,ED:6,GD:7};
const CATNAME={SI:'Setting and Infrastructure',EC:'Energy and Climate Change',WS:'Waste',WR:'Water',TR:'Transportation',ED:'Education and Research',GD:'Governance and Digitalization'};
const uigItem=key=>D().indicators.find(x=>x.id==='UIG-'+key);

/* ================= pemilihan opsi otomatis ================= */
function binTest(label,x){
 const s=String(label).replace(/\(.*?\)/g,'').replace(/[–—−]/g,'-').replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/,/g,'').replace(/%|kwh|m²\/person|m2\/person|metric tons?|per person/gi,'').replace(/\s+/g,' ').trim();let m;
 if(m=s.match(/^(>=|>)\s*([\d.]+)\s+and\s+(<=|<)\s*([\d.]+)/i)){const lo=+m[2],hi=+m[4];return (m[1]==='>='?x>=lo:x>lo)&&(m[3]==='<='?x<=hi:x<hi)}
 if(m=s.match(/^(<=|<)\s*([\d.]+)/))return m[1]==='<='?x<=+m[2]:x<+m[2];
 if(m=s.match(/^(>=|>)\s*([\d.]+)\s*-\s*([\d.]+)/))return x>+m[2]&&x<=+m[3];
 if(m=s.match(/^([\d.]+)\s*-\s*([\d.]+)/))return x>=+m[1]&&x<=+m[2];
 if(m=s.match(/^(>=|>)\s*([\d.]+)/))return m[1]==='>='?x>=+m[2]:x>+m[2];
 return false}
function pickOpt(opts,x){if(!isFinite(x))return -1;for(const d of [0,1e-6,-1e-6]){for(let i=0;i<opts.length;i++)if(binTest(opts[i].t,x+d))return i}return -1}
window.__pickOpt=pickOpt;

/* ================= rumus UIGM ================= */
const iv=key=>{const it=uigItem(key);if(!it)return NaN;const sc=S[key];if(sc&&sc.opts.length&&!sc.withNum)return NaN;return parseNum(it.val)};
const POP=()=>iv('1.11')+iv('1.13');
const rowsNum=(key,col)=>{const it=uigItem(key);return it?(it.rows||[]).map(r=>parseNum(r[col])).filter(isFinite):[]};
const sum=a=>a.reduce((x,y)=>x+y,0);
const CALC={
 '1.8':{u:'%',t:'SI1 (%) = (1.5 − 1.6) / 1.5 × 100',need:['1.5','1.6'],f:()=>(iv('1.5')-iv('1.6'))/iv('1.5')*100},
 '1.9':{u:'%',t:'Luas hutan (m²) / total luas kampus (1.5) × 100',need:['1.5'],self:1,f:s=>s/iv('1.5')*100},
 '1.10':{u:'%',t:'Luas vegetasi tanam (m²) / total luas kampus (1.5) × 100',need:['1.5'],self:1,f:s=>s/iv('1.5')*100},
 '1.14':{u:'m²/orang',t:'SI4 = (1.5 − 1.6) / (1.11 + 1.13)',need:['1.5','1.6','1.11','1.13'],f:()=>(iv('1.5')-iv('1.6'))/POP()},
 '2.3':{u:'%',t:'EC2 (%) = 2.2 / 1.7 × 100',need:['2.2','1.7'],f:()=>iv('2.2')/iv('1.7')*100},
 '2.4':{u:'sumber',t:'Jumlah sumber di tabel 2.5 dengan produksi > 0 kWh',need:[],f:()=>rowsNum('2.5',1).filter(v=>v>0).length,idx:v=>v<=0?0:Math.min(v,4)},
 '2.7':{u:'kWh/orang',t:'EC4 = 2.6 / (1.11 + 1.13)',need:['2.6','1.11','1.13'],f:()=>iv('2.6')/POP()},
 '2.8':{u:'%',t:'Total produksi di tabel 2.5 / 2.6 × 100',need:['2.6'],f:()=>sum(rowsNum('2.5',1))/iv('2.6')*100},
 '2.12':{u:'ton/orang',t:'EC8 = 2.11 / (1.11 + 1.13)',need:['2.11','1.11','1.13'],f:()=>iv('2.11')/POP()},
 '4.1':{u:'%',t:'Luas area resapan (m²) / total luas kampus (1.5) × 100',need:['1.5'],self:1,f:s=>s/iv('1.5')*100},
 '5.4':{u:'kendaraan/orang',t:'TR1 = (5.1 + 5.2 + 5.3) / (1.11 + 1.13)',need:['5.1','5.2','5.3','1.11','1.13'],f:()=>(iv('5.1')+iv('5.2')+iv('5.3'))/POP()},
 '5.11':{u:'ZEV/orang',t:'TR4 = 5.10 / (1.11 + 1.13)',need:['5.10','1.11','1.13'],f:()=>iv('5.10')/POP()},
 '5.13':{u:'%',t:'TR5 = 5.12 / 1.5 × 100',need:['5.12','1.5'],f:()=>iv('5.12')/iv('1.5')*100},
 '6.4':{u:'%',t:'ED1 = 6.1 / 6.2 × 100',need:['6.1','6.2'],f:()=>iv('6.1')/iv('6.2')*100},
 '6.7':{u:'%',t:'ED2 = 6.5 / 6.6 × 100',need:['6.5','6.6'],f:()=>iv('6.5')/iv('6.6')*100},
 '6.10':{u:'publikasi/dosen',t:'ED3 = 6.9 / 6.8',need:['6.9','6.8'],f:()=>iv('6.9')/iv('6.8')},
 '6.19':{u:'%',t:'ED10 = 6.17 / 6.18 × 100',need:['6.17','6.18'],f:()=>iv('6.17')/iv('6.18')*100},
 '7.3':{u:'%',t:'GD1 = 7.2 / 7.1 × 100',need:['7.2','7.1'],f:()=>iv('7.2')/iv('7.1')*100},
 '7.17':{u:'%',t:'GD8 = 7.16 / 7.15 × 100',need:['7.16','7.15'],f:()=>iv('7.16')/iv('7.15')*100}};
function calcFor(code,selfVal){const c=CALC[code];if(!c)return null;const sc=S[code]||{opts:[]};
 const missing=c.need.filter(k=>!isFinite(iv(k)));if(c.self&&!isFinite(selfVal))missing.unshift('isian luas (m²) di bawah');
 if(missing.length)return {c,missing,val:NaN,idx:-1};
 let v=c.self?c.f(selfVal):c.f();if(!isFinite(v))return {c,missing:['pembagi bernilai nol'],val:NaN,idx:-1};
 const idx=c.idx?c.idx(v):pickOpt(sc.opts,v);return {c,missing:[],val:v,idx}}
const f2=v=>isFinite(v)?(Math.abs(v)>=100?Math.round(v*10)/10:Math.round(v*1000)/1000).toString().replace('.',','):'—';

/* ================= skor UIGM ================= */
function uigmScore(){const cat={};let tot=0,max=0,n=0,done=0;
 D().indicators.filter(i=>i.rank==='UIGM').forEach(i=>{const sc=S[i.code];if(!sc||!sc.pts)return;const c=cat[sc.cat]=cat[sc.cat]||{pts:0,got:0,n:0,done:0,name:sc.catName};c.pts+=sc.pts;c.n++;max+=sc.pts;n++;
  if(i.sel!==''&&i.sel!=null&&sc.opts[+i.sel]&&sc.opts[+i.sel].m!=null){const g=sc.opts[+i.sel].m*sc.pts;c.got+=g;c.done++;tot+=g;done++}});
 return {cat,tot,max,n,done}}
const itemScore=i=>{const sc=S[i.code];if(!sc||!sc.pts||i.sel===''||i.sel==null||!sc.opts[+i.sel]||sc.opts[+i.sel].m==null)return null;return sc.opts[+i.sel].m*sc.pts};
EXT.uigmHead=()=>{const r=uigmScore();const rows=Object.keys(CATNO).filter(k=>r.cat[k]).map(k=>{const c=r.cat[k];return `<div class="row"><div class="rb"><div class="tt">${esc(k)} · ${esc(c.name)}</div><div class="stk"><i class="s-v" style="width:${c.pts?c.got/c.pts*100:0}%"></i></div><div class="meta"><span>${c.done}/${c.n} indikator terisi</span></div></div><div class="mv"><b>${Math.round(c.got)}</b> <small>/ ${c.pts}</small></div></div>`}).join('');
 return `<div class="callout info"><b>Skor perkiraan mandiri: ${Math.round(r.tot).toLocaleString('id-ID')} / ${r.max.toLocaleString('id-ID')}</b> (${r.done}/${r.n} indikator bernilai sudah dipilih). Skor resmi ditetapkan validator UIGM; angka ini hanya alat bantu menyusun prioritas.</div><details class="card flush"><summary class="ch" style="padding:12px 14px;cursor:pointer"><h2>Skor per kategori</h2></summary>${rows}</details>`};

/* ================= form isian UIGM ================= */
function uigmSheet(i){
 const sc=S[i.code]||{kind:'text',opts:[],cols:['Uraian','Keterangan / lokasi','Tautan bukti'],desc:'',rec:'',pts:0,cat:i.cat||'',ucode:''};
 const m=me(),can=canEdit('indicators',i),dis=can?'':'disabled',calc=CALC[i.code],evs=evOf(i.id);
 const hasOpts=sc.opts.length>0;const lead=isAdmin();
 let rows=(i.rows||[]).map(r=>r.slice());
 const selOpts=(id,opts,v)=>`<select id="${id}" ${dis}>${opts.map(([a,b])=>`<option value="${esc(a)}" ${String(a)===String(v)?'selected':''}>${esc(b)}</option>`).join('')}</select>`;
 const c=consistency(i);
 const ansHtml=(()=>{let h='';
  if(hasOpts)h+=`<label class="fld"><span>Pilihan jawaban${sc.pts?` <small>(bobot ${sc.pts} poin)</small>`:''}</span><select id="u_sel" ${dis}><option value="">— pilih —</option>${sc.opts.map((o,k)=>`<option value="${k}" ${String(i.sel)===String(k)?'selected':''}>[${k+1}] ${esc(o.t)}</option>`).join('')}</select></label>`;
  if(!hasOpts||sc.withNum){const lbl=sc.withNum?'Nilai / luas (angka)':'Isian';h+=sc.kind==='text'?`<label class="fld"><span>${lbl}</span><textarea id="u_val" rows="3" ${dis}>${esc(i.val)}</textarea></label>`:`<div class="two"><label class="fld"><span>${lbl}</span><input id="u_val" ${sc.kind==='url'?'type="url"':'inputmode="decimal"'} value="${esc(i.val)}" ${dis}></label><label class="fld"><span>Satuan</span><input id="u_vu" value="${esc(i.vunit)}" ${dis}></label></div>`}
  return h})();
 sheet(`<div class="sh-h"><h3>${esc(i.code)} ${rkChip('UIGM')}</h3><button class="x" data-close>×</button></div><div class="sh-b">
  <div class="dh"><span>${esc(i.group)}</span>${sc.pts?chip(sc.ucode+' · '+sc.pts+' poin','g'):chip('data pendukung','g')}${i.evReq?chip('bukti wajib','w'):''}</div>
  <p class="tsk">${esc(i.title)}</p>
  <details class="guide"><summary>Petunjuk resmi UIGM 2026</summary><div class="gtxt">${esc(sc.desc).replace(/\n/g,'<br>')}</div>${sc.rec?`<p class="muted sm"><b>Bukti yang disarankan:</b> ${esc(sc.rec)}</p>`:''}</details>
  ${ansHtml}
  <div id="u_calc"></div><div id="u_score" class="muted sm"></div>
  <label class="fld"><span>Uraian untuk berkas bukti (Description)</span><textarea id="u_narr" rows="5" placeholder="Jelaskan kondisi nyata di UMB: apa, di mana, sejak kapan, berapa banyak. Ini tampil di PDF bukti." ${dis}>${esc(i.narr||'')}</textarea></label>
  <div class="gh">Tabel data pendukung <small id="u_rc">${rows.length}</small></div>
  <p class="muted sm">Kolom mengikuti templat bukti resmi. Kosongkan bila tidak perlu.</p><div id="u_rows"></div>${can?'<button class="btn sm" id="u_addrow" type="button">+ Baris</button>':''}
  <label class="fld"><span>Tautan bukti tambahan (video, foto, berkas lain)</span><input id="u_xlink" type="url" placeholder="https://…" value="${esc(i.xlink||'')}" ${dis}></label>
  <div class="two"><label class="fld"><span>Status</span>${selOpts('i_st',IND_ST.map(s=>[s,ST_LABEL[s]]),i.status)}</label><label class="fld"><span>Pemeriksa</span>${selOpts('i_chk',userOpts(true),i.checker)}</label></div>
  <div class="two"><label class="fld"><span>Periode data</span><input id="i_per" value="${esc(i.period)}" placeholder="mis. 2025" ${dis}></label><label class="fld"><span>Pemilik (pengisi)</span>${lead?selOpts('i_own',userOpts(false),i.owner):`<input value="${esc(uname(i.owner))}" disabled>`}</label></div>
  <div class="two"><label class="fld"><span>Unit pemilik data</span><input id="i_unit" value="${esc(i.unit)}" ${dis}></label><label class="fld"><span>Sumber data</span><input id="i_src" value="${esc(i.source)}" ${dis}></label></div>
  <label class="fld"><span>Hubungkan ke Data Inti</span>${selOpts('i_mk',[['','— tidak dihubungkan —'],...D().master.map(x=>[x.key,x.label+(x.val!==''?' = '+x.val:'')])],i.masterKey)}</label>
  ${c&&c.m?`<div class="callout ${c.ok===false?'bad':c.ok?'ok':'info'}">${c.ok===false?`Nilai berbeda dari Data Inti (<b>${esc(c.m.val)}</b>).`:c.ok?'Sesuai Data Inti.':c.m.val!==''?`Data Inti: <b>${esc(c.m.val)} ${esc(c.m.vunit)}</b>`:'Data Inti belum terisi.'}</div>`:''}
  <label class="fld"><span>Catatan internal</span><textarea id="i_note" rows="2" ${dis}>${esc(i.note)}</textarea></label>
  <div class="gh">Bukti tertaut <small>${evs.length}</small></div>
  ${evs.map(e=>`<div class="row evi"><div class="rb"><div class="tt">${esc(e.title)}</div><div class="meta"><span>${esc(e.type)}</span>${e.date?`<span>${fmtD(e.date)}</span>`:''}</div></div>${e.link?`<a class="btn sm" href="${esc(e.link)}" target="_blank" rel="noopener">Buka</a>`:''}</div>`).join('')||'<p class="muted sm">Belum ada bukti tertaut.</p>'}
  <button class="btn sm" id="i_addev" type="button">+ Tambah / tautkan bukti</button>
 </div><div class="btns"><button class="btn" id="u_pdf" type="button">Unduh PDF bukti</button><span class="sp"></span><button class="btn" data-close>Tutup</button>${can?'<button class="btn pri" id="i_ok">Simpan</button>':''}</div>`,s=>{
  const selEl=$('#u_sel',s),valEl=$('#u_val',s);
  const drawRows=()=>{$('#u_rows',s).innerHTML=rows.map((r,ri)=>`<div class="trow"><div class="rn">${ri+1}${can?`<button class="btn sm danger" data-rdel="${ri}" type="button" aria-label="Hapus baris">×</button>`:''}</div><div class="tg">${sc.cols.map((col,ci)=>`<label class="tf"><small>${esc(col)}</small><input data-r="${ri}" data-c="${ci}" value="${esc(r[ci]||'')}" ${dis}></label>`).join('')}</div></div>`).join('');$('#u_rc',s).textContent=rows.length};
  drawRows();
  $('#u_rows',s).addEventListener('input',e=>{const t=e.target;if(t.dataset.r!=null){rows[+t.dataset.r][+t.dataset.c]=t.value;refresh(false)}});
  $('#u_rows',s).addEventListener('click',e=>{const b=e.target.closest('[data-rdel]');if(b){rows.splice(+b.dataset.rdel,1);drawRows();refresh(false)}});
  const ar=$('#u_addrow',s);if(ar)ar.onclick=()=>{rows.push(sc.cols.map(()=>''));drawRows();const l=$$('#u_rows .trow',s).pop();if(l)l.querySelector('input').focus()};
  let calcRes=null;
  function refresh(setSel){const upd=$('#u_score',s);
   if(calc){const self=valEl?parseNum(valEl.value):NaN;const tmpRows=rows;const it=uigItem(i.code.replace(/^UIG-/,''));
    // untuk 2.4/2.8 tabel 2.5 dibaca dari DB; bila form ini adalah 2.5 sendiri gunakan baris saat ini
    const r=calcFor(i.code,self);calcRes=r;
    const box=$('#u_calc',s);
    if(r.missing.length)box.innerHTML=`<div class="callout warn"><b>Hitung otomatis:</b> ${esc(calc.t)}<br>Belum bisa dihitung. Lengkapi dulu: ${r.missing.map(esc).join(', ')}.</div>`;
    else{box.innerHTML=`<div class="callout ok"><b>Hasil perhitungan:</b> ${f2(r.val)} ${esc(calc.u)}<br><small>${esc(calc.t)}${r.idx>=0&&hasOpts?` → pilihan [${r.idx+1}] ${esc(sc.opts[r.idx].t)}`:''}</small></div>`;if(setSel&&selEl&&r.idx>=0&&can)selEl.value=String(r.idx)}}
   if(selEl){const k=selEl.value;const o=k!==''?sc.opts[+k]:null;upd.textContent=o&&o.m!=null&&sc.pts?`Skor perkiraan indikator ini: ${Math.round(o.m*sc.pts)} / ${sc.pts} poin`:(sc.pts?`Bobot ${sc.pts} poin — pilih jawaban untuk melihat skor perkiraan`:'')}}
  // 2.5 mempengaruhi 2.4 & 2.8 via DB; saat form 2.5 aktif, simpan dulu agar hasil turunannya benar
  refresh(!i.sel&&i.sel!==0);
  if(selEl)selEl.onchange=()=>refresh(false);
  if(valEl)valEl.addEventListener('input',()=>refresh(true));
  function collect(){const n=Object.assign({},i,{narr:$('#u_narr',s).value.trim(),xlink:$('#u_xlink',s).value.trim(),rows:rows.filter(r=>r.some(x=>String(x).trim()!=='')),period:$('#i_per',s).value.trim(),unit:$('#i_unit',s).value.trim(),source:$('#i_src',s).value.trim(),masterKey:$('#i_mk',s).value,note:$('#i_note',s).value.trim(),checker:$('#i_chk',s).value});
   if($('#i_own',s))n.owner=$('#i_own',s).value;
   if(selEl)n.sel=selEl.value===''?'':+selEl.value;
   if(valEl)n.val=valEl.value.trim();if($('#u_vu',s))n.vunit=$('#u_vu',s).value.trim();
   if(hasOpts&&!sc.withNum)n.val=n.sel===''?'':(sc.opts[n.sel]?sc.opts[n.sel].t:'');
   const r=calcFor(i.code,valEl?parseNum(valEl.value):NaN);n.calcv=r&&isFinite(r.val)?f2(r.val)+' '+r.c.u:'';
   return n}
  function save(close){const n=collect();let st=$('#i_st',s).value;const had=String(n.val)!==''||(n.rows&&n.rows.length)||n.narr;
   if(String(n.val).trim()!==''&&st==='kosong'&&i.status==='kosong')st='draft';
   if(String(n.val).trim()===''&&n.narr&&st==='kosong')st='draft';
   n.status=st;
   if(st!==i.status){const probe=Object.assign({},n,{val:String(n.val).trim()===''&&n.narr?'(uraian)':n.val});const why=statusRule(probe,st);if(why){toast(why);return null}}
   else if(['valid','final'].includes(i.status)&&(n.val!==i.val||String(n.sel)!==String(i.sel))){n.status='dicek';toast('Isian berubah: status dikembalikan ke Dicek')}
   put('indicators',n);if(n.status!==i.status)logAct(me().short+': UIGM '+n.code+' → '+ST_LABEL[n.status]);if(close){closeSheet();route(true);toast('Tersimpan')}return n}
  const ok=$('#i_ok',s);if(ok)ok.onclick=()=>save(true);
  $('#i_addev',s).onclick=()=>{if(can&&!save(false))return;closeSheet();evidenceForm({refs:i.id,rank:'UIGM',title:'',type:'Dokumen'},()=>{uigmSheet(D().indicators.find(x=>x.id===i.id))})};
  $('#u_pdf',s).onclick=async()=>{let cur=D().indicators.find(x=>x.id===i.id);if(can){const n=save(false);if(!n)return;cur=n}try{toast('Menyusun PDF…');await PDF.evidence([cur])}catch(e){toast('PDF gagal: '+e.message)}}})}
EXT.uigmSheet=uigmSheet;

/* ================= PDF ================= */
const MAP={'≤':'<=','≥':'>=','₂':'2','₃':'3','–':'-','—':'-','−':'-','’':"'",'‘':"'",'“':'"','”':'"','…':'...','•':'-','→':'->','×':'x','≈':'~','±':'+/-','≠':'!=','✓':'v','‑':'-',' ':' ','​':''};
const T=t=>String(t==null?'':t).replace(/[^\x00-\xFF]/g,ch=>MAP[ch]!==undefined?MAP[ch]:'?');
const slug=t=>String(t).replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,60);
const PDF={libs:null,logo:null,
 async load(){if(!this.libs){const add=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Pustaka PDF gagal dimuat ('+src+'). Periksa koneksi lalu coba lagi.'));document.head.appendChild(s)});
   if(!(window.jspdf&&window.jspdf.jsPDF))await add('vendor/jspdf.umd.min.js');await add('vendor/jspdf.plugin.autotable.min.js');this.libs=true}
  if(!this.logo){const b=await (await fetch('icons/logo-umb.png')).blob();this.logo=await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})}},
 newDoc(){const {jsPDF}=window.jspdf;return new jsPDF({unit:'mm',format:'a4'})},
 head(doc,sub){doc.addImage(this.logo,'PNG',15,9,20,20);doc.setTextColor(14,90,58);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text('UNIVERSITAS MUHAMMADIYAH BENGKULU',39,16);doc.setTextColor(60,60,60);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(T(sub||'Task Force Pemeringkatan'),39,22);doc.setFontSize(8);doc.setTextColor(120,120,120);doc.text(T(INST.web),39,27);doc.setDrawColor(199,154,30);doc.setLineWidth(0.6);doc.line(15,32,195,32);doc.setTextColor(0,0,0);return 38},
 foot(doc){const n=doc.getNumberOfPages();const who=me()?me().short:'';for(let p=1;p<=n;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(120,120,120);doc.text(T('Satu Data UMB - '+fmtD(todayISO())+(who?' - '+who:'')),15,290);doc.text('Hal. '+p+' / '+n,195,290,{align:'right'})}},
 lay(doc,sub){const P=this;const L={doc,sub,y:P.head(doc,sub),
  need(h){if(this.y+h>282){doc.addPage();this.y=P.head(doc,sub)}},
  text(t,o={}){const {size=10,bold=false,color=[0,0,0],x=15,w=180,gap=1.5,link}=o;doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);const lines=doc.splitTextToSize(T(t),w);const lh=size*0.3528*1.28;lines.forEach(l=>{this.need(lh);if(link)doc.textWithLink(l,x,this.y+lh*0.8,{url:link});else doc.text(l,x,this.y+lh*0.8);this.y+=lh});this.y+=gap;doc.setTextColor(0,0,0)},
  kv(k,v){this.need(6);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text(T(k),15,this.y+4);doc.setFont('helvetica','normal');doc.text(': '+T(v),50,this.y+4);this.y+=6},
  rule(){doc.setDrawColor(200,200,200);doc.setLineWidth(0.2);doc.line(15,this.y,195,this.y);this.y+=3},
  table(o){this.need(18);doc.autoTable(Object.assign({startY:this.y,margin:{left:15,right:15,top:38,bottom:14},styles:{font:'helvetica',fontSize:8,cellPadding:1.6,overflow:'linebreak',lineColor:[200,200,200],lineWidth:0.1,textColor:[30,30,30]},headStyles:{fillColor:[14,90,58],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[247,247,243]},didDrawPage:()=>{P.head(doc,sub)}},o));this.y=doc.lastAutoTable.finalY+5}};
  return L},
 evPage(L,i){const doc=L.doc,sc=S[i.code]||{cat:i.cat,opts:[],cols:[]};const cat=sc.cat||i.cat||'';
  L.text('Template for Evidence(s)',{size:15,bold:true,color:[14,90,58],gap:0.5});L.text('UI GreenMetric Questionnaire',{size:11,bold:true,gap:3});
  L.kv('University',INST.name);L.kv('Country',INST.country);L.kv('Web Address',INST.web);L.y+=1;L.rule();
  L.text('['+(CATNO[cat]||'')+'] '+(CATNAME[cat]||sc.catName||'')+(cat?' ('+cat+')':''),{size:11,bold:true,gap:1});
  L.text('['+i.code+'] '+i.title+(sc.ucode?' ('+sc.ucode.slice(0,2)+'.'+sc.ucode.slice(2)+')':''),{size:11,bold:true,gap:2});
  const a=PDF.fullAns(i);L.text('Isian kuesioner: '+(a||'(belum diisi)'),{size:10,gap:3,color:a?[0,0,0]:[160,60,60]});
  L.text('Description:',{size:10,bold:true,gap:1});L.text(i.narr||'(Uraian belum diisi.)',{size:10,gap:3,color:i.narr?[0,0,0]:[150,150,150]});
  if(i.rows&&i.rows.length){const cols=sc.cols&&sc.cols.length?sc.cols:i.rows[0].map((_,k)=>'Kolom '+(k+1));L.table({head:[['No'].concat(cols).map(T)],body:i.rows.map((r,k)=>[String(k+1)].concat(cols.map((_,ci)=>T(r[ci]||'')))),columnStyles:{0:{cellWidth:9}}})}
  L.text('Additional evidence link (i.e., for videos, more images, or other files that are not included in this file):',{size:9,bold:true,gap:1});
  const evs=evOf(i.id).filter(e=>e.link);const links=[];if(i.xlink)links.push(['Tautan tambahan',i.xlink]);evs.forEach(e=>links.push([e.title,e.link]));
  if(!links.length)L.text('-',{size:9,color:[150,150,150]});
  links.forEach(([t,u])=>{L.text(t,{size:9,gap:0});L.text(u,{size:8,color:[30,80,200],link:u,gap:1.5})});
  const noL=evOf(i.id).filter(e=>!e.link);if(noL.length)L.text('Bukti tanpa tautan (dilampirkan terpisah): '+noL.map(e=>e.title).join('; '),{size:8,color:[90,90,90]})},
 fullAns(i){const sc=S[i.code];let a='';if(sc&&sc.opts.length&&i.sel!==''&&i.sel!=null&&sc.opts[+i.sel]){a='['+(+i.sel+1)+'] '+sc.opts[+i.sel].t;if(sc.withNum&&i.val!=='')a=i.val+(i.vunit?' '+i.vunit:'')+' - '+a;else if(i.calcv)a+=' (hasil perhitungan: '+i.calcv+')'}else if(i.val!=='')a=i.val+(i.vunit?' '+i.vunit:'');return a},
 async evidence(items,fname){await this.load();const doc=this.newDoc();const L=this.lay(doc,'Template for Evidence(s) - UI GreenMetric');items.forEach((i,k)=>{if(k){doc.addPage();L.y=this.head(doc,L.sub)}this.evPage(L,i)});this.foot(doc);doc.save(fname||('UIGM_Evidence_'+(items.length===1?items[0].code+'_'+slug(items[0].title):slug(String(items.length)+'_indikator'))+'.pdf'))},
 async recap(rank,group){await this.load();const doc=this.newDoc();const full=RK[rank].full;const L=this.lay(doc,'Rekap isian - '+full);
  let list=D().indicators.filter(i=>i.rank===rank&&(!group||i.group===group));
  L.text('Rekap Isian '+full,{size:15,bold:true,color:[14,90,58],gap:0.5});L.text(group?group:'Seluruh indikator',{size:11,bold:true,gap:2});
  const v=list.filter(i=>['valid','final'].includes(i.status)).length,f=list.filter(i=>i.status!=='kosong').length;
  L.text('Institusi: '+INST.name+' ('+INST.country+')   |   Dihasilkan: '+fmtD(todayISO())+'   |   Terisi '+f+' / '+list.length+', valid/final '+v,{size:9,gap:3,color:[80,80,80]});
  if(rank==='UIGM'){const r=uigmScore();L.text('Skor perkiraan mandiri: '+Math.round(r.tot)+' / '+r.max+' (bukan skor resmi UIGM)',{size:9,bold:true,gap:3})}
  const body=[];let last='';list.forEach(i=>{if(i.group!==last){last=i.group;body.push([{content:T(i.group),colSpan:6,styles:{fillColor:[225,236,229],fontStyle:'bold',textColor:[14,90,58]}}])}
   const e=evOf(i.id).length;body.push([T(i.code),T(i.title),T(rank==='UIGM'?PDF.fullAns(i):(i.val!==''?i.val+(i.vunit?' '+i.vunit:''):'')),T(i.period||''),T(ST_LABEL[i.status]),String(e)])});
  L.table({head:[['Kode','Indikator','Isian','Periode','Status','Bukti']],body,columnStyles:{0:{cellWidth:16},2:{cellWidth:46},3:{cellWidth:16},4:{cellWidth:16},5:{cellWidth:11,halign:'center'}}});
  const ids=new Set(list.map(i=>i.id));const evs=D().evidence.filter(e=>(e.refs||'').split(/[,\s;]+/).some(r=>ids.has(r)));
  if(evs.length){L.text('Lampiran: daftar bukti tertaut',{size:11,bold:true,gap:2});L.table({head:[['Judul bukti','Terkait','Jenis','Tautan']],body:evs.map(e=>[T(e.title),T((e.refs||'').split(/[,\s;]+/).filter(r=>ids.has(r)).map(r=>r.replace(/^(QS|THE|UIG)-/,'')).join(', ')),T(e.type),T(e.link||'(tanpa tautan)')]),columnStyles:{1:{cellWidth:26},2:{cellWidth:22}},didDrawCell:d=>{if(d.section==='body'&&d.column.index===3){const u=evs[d.row.index]&&evs[d.row.index].link;if(u)doc.link(d.cell.x,d.cell.y,d.cell.width,d.cell.height,{url:u})}}})}
  this.foot(doc);doc.save(rank+'_Rekap_'+(group?slug(group)+'_':'')+todayISO()+'.pdf')},
 async uigmPack(cat){const list=D().indicators.filter(i=>i.rank==='UIGM'&&(S[i.code]||{}).hasTpl&&(!cat||i.cat===cat));if(!list.length)throw new Error('Tidak ada indikator');await this.evidence(list,'UIGM_Paket_Evidence_'+(cat||'SEMUA')+'_'+todayISO()+'.pdf')},
 async master(){await this.load();const doc=this.newDoc();const L=this.lay(doc,'Data Inti Universitas');L.text('Data Inti Universitas',{size:15,bold:true,color:[14,90,58],gap:1});L.text('Satu angka resmi yang dipakai QS Asia, THE SIR, dan UIGM. Dihasilkan '+fmtD(todayISO()),{size:9,color:[80,80,80],gap:3});
  L.table({head:[['Data','Nilai','Satuan','Periode','Unit pemilik','Status']],body:D().master.map(m=>[T(m.label),T(m.val),T(m.vunit),T(m.period||''),T(m.unit),T(m.status)]),columnStyles:{1:{halign:'right'}}});this.foot(doc);doc.save('DataInti_UMB_'+todayISO()+'.pdf')}
};
async function runPdf(spec){try{toast('Menyusun PDF…');const [k,a,b]=spec.split('|');
 if(k==='recap')await PDF.recap(a,b||'');else if(k==='pack')await PDF.uigmPack(a);else if(k==='master')await PDF.master();else if(k==='ev'){const i=D().indicators.find(x=>x.id===a);await PDF.evidence([i])}
 toast('PDF siap diunduh')}catch(e){toast('PDF gagal: '+e.message)}}
EXT.pdfBar=rank=>`<div class="btns left wrapb pdfbar"><button class="btn sm" data-pdf="recap|${rank}">Unduh PDF rekap ${esc(RK[rank].n)}</button>${rank==='UIGM'?'<button class="btn sm" data-pdf="pack|">PDF paket bukti (semua)</button>':''}<a class="btn sm" href="#/pdf">Semua PDF</a></div>`;
V.pdf=()=>{const groups=r=>[...new Set(D().indicators.filter(i=>i.rank===r).map(i=>i.group))];
 const sect=(r,extra)=>`<div class="card" style="--c:${RK[r].c}"><div class="ch"><h2>${esc(RK[r].full)}</h2></div><div class="btns left wrapb"><button class="btn pri sm" data-pdf="recap|${r}">Rekap seluruh ${esc(RK[r].n)}</button>${extra||''}</div><p class="muted sm">Per kelompok:</p><div class="btns left wrapb">${groups(r).map(g=>`<button class="btn sm" data-pdf="recap|${r}|${esc(g)}">${esc(g.length>34?g.slice(0,32)+'…':g)}</button>`).join('')}</div></div>`;
 return `<div class="ph"><h1>Unduh PDF</h1></div><div class="callout info">Semua PDF berlogo UMB dan terisi otomatis dari data aplikasi: institusi, isian, status, dan tautan bukti. PDF mencerminkan data yang ada di perangkat ini; tekan tombol status di atas lebih dulu agar data terbaru dari rekan tim ikut.</div>
 ${sect('QS')}${sect('THE')}
 ${sect('UIGM',`<button class="btn sm" data-pdf="pack|">Paket bukti UIGM (semua indikator)</button>`)}
 <div class="card"><div class="ch"><h2>Paket bukti UIGM per kategori</h2></div><p class="muted sm">Satu PDF berisi satu halaman templat bukti resmi per indikator (University, Country, Web Address, Description, tabel, tautan).</p><div class="btns left wrapb">${Object.keys(CATNO).map(c=>`<button class="btn sm" data-pdf="pack|${c}">${c} · ${esc(CATNAME[c])}</button>`).join('')}</div></div>
 <div class="card"><div class="ch"><h2>Lainnya</h2></div><div class="btns left wrapb"><button class="btn sm" data-pdf="master">Data Inti Universitas</button></div></div>`};
document.addEventListener('click',e=>{const b=e.target.closest('[data-pdf]');if(b){e.preventDefault();e.stopPropagation();runPdf(b.dataset.pdf)}},true);

/* ================= pencarian lintas tim ================= */
const SYN=[['dosen','faculty','lecturer','lecturers','staf akademik','academic staff','pengajar'],['mahasiswa','student','students'],['luas','area'],['listrik','electricity','kwh'],['sampah','waste'],['air','water'],['kendaraan','vehicle','vehicles','mobil','motor'],['karbon','carbon','emisi','emission'],['anggaran','budget','dana','fund','funds'],['publikasi','publication','publications','scopus'],['penelitian','research','riset'],['lulusan','graduate','graduates','alumni'],['perempuan','female','wanita'],['laki-laki','male','pria'],['internasional','international','asing'],['prodi','program studi','study program'],['gedung','building','buildings'],['hutan','forest'],['kampus','campus'],['kebijakan','policy','sk'],['energi','energy'],['gaji','salary'],['staf','staff','tendik'],['kerja sama','kerjasama','mou','partnership']];
const STOP=new Set(['jumlah','berapa','data','total','yang','dan','di','ada','nya','apa','itu','ini','untuk','dari','dengan','tahun']);
const expand=t=>{for(const g of SYN)if(g.includes(t))return g;return [t]};
function searchAll(q){const toks=q.toLowerCase().split(/[^a-z0-9²\-]+/).filter(t=>t&&!STOP.has(t));if(!toks.length)return null;const groups=toks.map(expand);
 const hit=(hay,title)=>{let sc=0;for(const g of groups){let ok=false;for(const w of g){if(hay.includes(w)){ok=true;if(title.includes(w))sc+=3;else sc+=1;break}}if(!ok)return 0}return sc};
 const R={master:[],ind:[],ev:[],req:[],task:[]};
 D().master.forEach(m=>{const t=(m.label+' '+m.key).toLowerCase();const h=(t+' '+m.unit+' '+m.source+' '+m.period+' '+m.val).toLowerCase();const s=hit(h,t);if(s)R.master.push([s+(m.val!==''?3:0),m])});
 D().indicators.forEach(i=>{const t=(i.code+' '+i.title).toLowerCase();const h=(t+' '+i.group+' '+ansOf(i)+' '+(i.note||'')+' '+(i.narr||'')+' '+(i.source||'')+' '+i.unit+' '+RK[i.rank].n).toLowerCase();const s=hit(h,t);if(s)R.ind.push([s+(ansOf(i)?2:0),i])});
 D().evidence.forEach(e=>{const t=e.title.toLowerCase();const h=(t+' '+e.refs+' '+(e.note||'')+' '+e.type+' '+(e.period||'')).toLowerCase();const s=hit(h,t);if(s)R.ev.push([s,e])});
 D().requests.forEach(r=>{const t=(r.unit+' '+r.what).toLowerCase();const s=hit(t,t);if(s)R.req.push([s,r])});
 D().tasks.forEach(x=>{const t=x.title.toLowerCase();const s=hit(t+' '+(x.evidenceReq||'').toLowerCase()+' '+(x.note||'').toLowerCase(),t);if(s)R.task.push([s,x])});
 Object.keys(R).forEach(k=>R[k].sort((a,b)=>b[0]-a[0]));return R}
const evLinks=id=>evOf(id).filter(e=>e.link).slice(0,3).map(e=>`<a class="btn sm" href="${esc(e.link)}" target="_blank" rel="noopener" data-stop>${esc(e.title.length>26?e.title.slice(0,24)+'…':e.title)}</a>`).join(' ');
function searchHtml(q){if(!q.trim())return `<p class="muted sm">Contoh pencarian:</p><div class="btns left wrapb">${['jumlah dosen','jumlah mahasiswa','luas kampus','sampah','energi terbarukan','kebijakan','publikasi scopus','dosen perempuan'].map(x=>`<button class="btn sm" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
 const R=searchAll(q);if(!R)return '<p class="empty">Ketik kata kunci yang lebih spesifik.</p>';
 const total=Object.values(R).reduce((a,l)=>a+l.length,0);if(!total)return '<p class="empty">Tidak ada hasil. Coba kata lain (mis. “faculty”, “dosen”, “luas”) atau minta data ke unit lewat menu Permintaan Data.</p>';
 let out='';
 const best=[...R.master.filter(([,m])=>m.val!==''),...R.ind.filter(([,i])=>ansOf(i))].sort((a,b)=>b[0]-a[0])[0];
 if(best){const x=best[1];const isM=x.key!==undefined&&x.label!==undefined;const pic=isM?x.unit:(uname(x.owner)+(x.unit?' · '+x.unit:''));
  out+=`<div class="card hero-s"><small>Jawaban terbaik</small><div class="hs-t">${esc(isM?x.label:x.title)}</div><div class="hs-v">${esc(isM?x.val:ansOf(x))}<span> ${isM?esc(x.vunit):''}</span></div><div class="meta">${isM?chip(x.status,x.status==='terverifikasi'?'ok':'w'):chip(ST_LABEL[x.status],stCls(x.status))}${x.period?`<span>${esc(x.period)}</span>`:''}<span>Pemilik data: ${esc(pic)}</span></div>${isM?'':`<div class="btns left wrapb">${evLinks(x.id)}</div>`}</div>`}
 const lim=l=>l.slice(0,12);
 if(R.master.length)out+=`<div class="gh">Data Inti <small>${R.master.length}</small></div><div class="card flush">${lim(R.master).map(([,m])=>`<div class="row" data-act="master" data-id="${m.id}"><div class="rb"><div class="tt">${esc(m.label)}</div><div class="meta"><span>${esc(m.unit)}</span><span>${esc(m.period||'periode ?')}</span></div></div><div class="mv">${m.val!==''?`<b>${esc(m.val)}</b> <small>${esc(m.vunit)}</small>`:'<small class="muted">kosong</small>'}</div></div>`).join('')}</div>`;
 if(R.ind.length)out+=`<div class="gh">Indikator <small>${R.ind.length}</small></div><div class="card flush">${lim(R.ind).map(([,i])=>`<div class="row ind" data-act="ind" data-id="${i.id}"><div class="code">${esc(i.code)}</div><div class="rb"><div class="tt">${esc(i.title)}</div><div class="meta">${rkChip(i.rank)}<span>${esc(uname(i.owner))}</span>${ansOf(i)?`<b class="val">${esc(ansOf(i))}</b>`:'<span class="muted">belum diisi</span>'}</div>${evLinks(i.id)?`<div class="btns left wrapb">${evLinks(i.id)}</div>`:''}</div>${chip(ST_LABEL[i.status],stCls(i.status))}</div>`).join('')}</div>`;
 if(R.ev.length)out+=`<div class="gh">Bukti & berkas <small>${R.ev.length}</small></div><div class="card flush">${lim(R.ev).map(([,e])=>`<div class="row" data-act="ev" data-id="${e.id}"><div class="rb"><div class="tt">${esc(e.title)}</div><div class="meta">${rkChip(e.rank)}<span>${esc(e.type)}</span><span>${esc(uname(e._by))}</span></div></div>${e.link?`<a class="btn sm" href="${esc(e.link)}" target="_blank" rel="noopener" data-stop>Buka</a>`:''}</div>`).join('')}</div>`;
 if(R.req.length)out+=`<div class="gh">Permintaan data <small>${R.req.length}</small></div><div class="card flush">${lim(R.req).map(([,r])=>`<div class="row" data-act="req" data-id="${r.id}"><div class="rb"><div class="tt">${esc(r.unit)}</div><div class="meta"><span>${esc(r.what.slice(0,90))}</span></div></div>${chip(r.status,r.status==='diterima'?'ok':'g')}</div>`).join('')}</div>`;
 if(R.task.length)out+=`<div class="gh">Tugas <small>${R.task.length}</small></div><div class="card flush">${lim(R.task).map(([,t])=>`<div class="row" data-act="task" data-id="${t.id}"><div class="rb"><div class="tt">${esc(t.title)}</div><div class="meta">${rkChip(t.rank)}<span>${esc(uname(t.owner))}</span></div></div></div>`).join('')}</div>`;
 return out}
U.search={q:''};
V.search=()=>`<div class="ph"><h1>Cari data & berkas</h1></div><div class="callout info">Cari lintas QS, THE, UIGM, Data Inti, bukti, permintaan, dan tugas. Hasil menampilkan angka, siapa pemilik datanya, dan tautan berkas.</div><div class="filters"><input id="s-q" type="search" placeholder="mis. jumlah dosen, luas kampus, SK anti korupsi…" value="${esc(U.search.q)}" autocomplete="off"></div><div id="s-res">${searchHtml(U.search.q)}</div>`;
let sdeb;document.addEventListener('input',e=>{if(e.target.id==='s-q'){U.search.q=e.target.value;clearTimeout(sdeb);sdeb=setTimeout(()=>{const r=$('#s-res');if(r)r.innerHTML=searchHtml(U.search.q)},180)}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(b){U.search.q=b.dataset.q;const i=$('#s-q');if(i)i.value=U.search.q;const r=$('#s-res');if(r)r.innerHTML=searchHtml(U.search.q)}});
window.U1D.start();
})();
