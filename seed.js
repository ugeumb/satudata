const fs=require('fs');
const src=fs.readFileSync('/home/claude/docx/build.js','utf8');
var C={};
const a=src.indexOf('const P=['), b=src.indexOf('// ---- content');
eval(src.slice(a,b).replace('const P=','var P=').replace('const PJ=','var PJ='));
const the=JSON.parse(fs.readFileSync('the.json','utf8'));
const ID=n=>n;
// ---------- users
const U=[
 {id:'u_azhar',name:'Andi Azhar, Ph.D',short:'Andi Azhar',role:'admin',team:'ALL',title:'Penanggung Jawab'},
 {id:'u_bertha',name:'Ns. Bertha Tesma Wulandari, M.Kep',short:'Bertha',role:'admin',team:'ALL',title:'Komandan Tim'},
 {id:'u_bintang',name:'Dr. Bintang Agustina Pratiwi, SKM., MKM',short:'Bintang',role:'koordinator',team:'QS',title:'Koordinator QS AUR'},
 {id:'u_oktari',name:'Dr. Oktarianita, SKM., MKM',short:'Oktarianita',role:'anggota',team:'QS',title:'Anggota 1 QS AUR'},
 {id:'u_anisa',name:'Anisa Fhadila, S.Kom',short:'Anisa',role:'anggota',team:'QS',title:'Anggota 2 QS AUR'},
 {id:'u_merri',name:'Dr. Merri Sri Hartati, M.Pd',short:'Merri',role:'koordinator',team:'THE',title:'Koordinator THE SIR'},
 {id:'u_tridina',name:'Tri Dina Ariyanti, M.Pd',short:'Tri Dina',role:'anggota',team:'THE',title:'Anggota 1 THE SIR'},
 {id:'u_tiara',name:'Tiara Aprilia, S.M',short:'Tiara',role:'anggota',team:'THE',title:'Anggota 2 THE SIR'},
 {id:'u_winda',name:'Dr. Winda Ramadianti, M.Pd',short:'Winda',role:'koordinator',team:'UIGM',title:'Koordinator UIGM'},
 {id:'u_rina',name:'Dr. Rina Yuniarti, M.Ak',short:'Rina',role:'anggota',team:'UIGM',title:'Anggota 1 UIGM'},
 {id:'u_satria',name:'Satria Wiranata, M.Sos',short:'Satria',role:'anggota',team:'UIGM',title:'Anggota 2 UIGM'},
 {id:'u_susiyanto',name:'Dr. Susiyanto, M.Si',short:'Rektor',role:'pengarah',team:'ALL',title:'Pelindung (Rektor)'},
 {id:'u_kasmir',name:'Dr. Kasmiruddin, M.Si',short:'WR I',role:'pengarah',team:'ALL',title:'Pengarah (WR I)'},
 {id:'u_ririn',name:'Dr. Ririn Harini, M.P.',short:'WR II',role:'pengarah',team:'ALL',title:'Pengarah (WR II)'},
 {id:'u_surohim',name:'Dr. Surohim, S.Ag., M.Si',short:'WR III',role:'pengarah',team:'ALL',title:'Pengarah (WR III)'},
 {id:'u_onsardi',name:'Dr. Onsardi, M.M.',short:'WR IV',role:'pengarah',team:'ALL',title:'Pengarah (WR IV)'}];
const byName={ 'Ns. Bertha Tesma Wulandari, M.Kep':'u_bertha','Dr. Bintang Agustina Pratiwi, SKM., MKM':'u_bintang','Dr. Oktarianita, SKM., MKM':'u_oktari','Anisa Fhadila, S.Kom':'u_anisa','Dr. Merri Sri Hartati, M.Pd':'u_merri','Tri Dina Ariyanti, M.Pd':'u_tridina','Tiara Aprilia, S.M':'u_tiara','Dr. Winda Ramadianti, M.Pd':'u_winda','Dr. Rina Yuniarti, M.Ak':'u_rina','Satria Wiranata, M.Sos':'u_satria','Andi Azhar, Ph.D':'u_azhar'};
for(const x of P){const u=U.find(u=>u.id===byName[x.name]);u.target=x.target;u.kpi=x.kpi||[];}
{const u=U.find(u=>u.id==='u_azhar');u.target='Keputusan strategis dan penggerakan unit tepat waktu; eskalasi hambatan ke Pengarah.';u.kpi=['Keputusan THE 9 Nov','Surat edaran 13 Nov','Steering bulanan'];}
// ---------- tasks
const MON={jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,aug:8,sep:9,okt:10,oct:10,nov:11,des:12,dec:12};
const eom=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
const pad=n=>String(n).padStart(2,'0');
function parse(s){
 s=s.replace(/±/g,'').trim(); let m;
 if(m=s.match(/^(\d{1,2}) (\w{3}) (\d{4})$/)) return `${m[3]}-${pad(MON[m[2].toLowerCase()])}-${pad(m[1])}`;
 if(m=s.match(/^(\w{3})[–-](\w{3}) (\d{4})$/)){const mm=MON[m[2].toLowerCase()];return `${m[3]}-${pad(mm)}-${eom(+m[3],mm)}`}
 if(m=s.match(/^(\w{3}) (\d{4})$/)){const mm=MON[m[1].toLowerCase()];return `${m[2]}-${pad(mm)}-${eom(+m[2],mm)}`}
 if(/^31 Mar \/ 30 Apr/.test(s)) return '2027-05-31';
 return null;}
const tasks=[];let ti=0;
function addTasks(ownerId,team,list,rank){ for(const r of list){ tasks.push({id:'t'+String(++ti).padStart(3,'0'),owner:ownerId,team,rank,dueText:r[0],due:parse(r[0]),title:r[1],evidenceReq:r[2],status:'belum',link:'',note:''});}}
addTasks('u_azhar','ALL',PJ.tasks,'ALL');
const rk={Lintas:'ALL',QS:'QS',THE:'THE',UIGM:'UIGM'};
for(const x of P) addTasks(byName[x.name],x.team==='Lintas Tim'?'ALL':x.team,x.tasks,x.team==='Lintas Tim'?'ALL':x.team);
// Pengarah tasks (from docx)
addTasks('group:pengarah','ALL',[
['13 Nov 2026','WR I–IV memerintahkan unit di bidangnya menyerahkan data sesuai tenggat (usulan pemetaan: WR I akademik & riset, WR II sumber daya & sarpras, WR III kemahasiswaan & alumni, WR IV kerja sama & internasionalisasi)','Surat edaran / instruksi'],
['30 Nov 2026','Rektor dan WR II memutuskan anggaran keanggotaan THE (≈£3.500/tahun; konfirmasi ke THE)','Keputusan anggaran'],
['21 Des 2026','Persetujuan pimpinan atas data QS sebelum submit','Persetujuan tertulis'],
['Jan–Apr 2027','Menetapkan SK/kebijakan yang dibutuhkan (kesetaraan, anti-korupsi, lingkungan, dll.)','SK terbit bertanggal'],
['Bulanan','Hadir di steering; mengevaluasi KPI','Notulen']],'ALL');
// ---------- indicators
const ind=[];
const QSOWN={k:'u_bintang',a:'u_oktari',b:'u_anisa'};
const CHK={u_bintang:'u_oktari',u_oktari:'u_anisa',u_anisa:'u_bintang',u_merri:'u_tridina',u_tridina:'u_tiara',u_tiara:'u_merri',u_winda:'u_rina',u_rina:'u_satria',u_satria:'u_winda'};
// [group, title, owner, unit, val, vunit, note, flag, masterKey]
const qs=[
['Dosen & staf','Faculty Staff','k','SDM',262,'orang','FT 262 · PT 0 · FTE 262','','faculty_total'],
['Dosen & staf','Faculty Staff (Male)','k','SDM',113,'orang','','Laki-laki 113 + perempuan 139 = 252, tidak sama dengan total 262','faculty_male'],
['Dosen & staf','Faculty Staff (Female)','k','SDM',139,'orang','','','faculty_female'],
['Dosen & staf','International Faculty Staff','k','SDM',15,'orang','PT 15 · FTE 5 (semua paruh waktu)','','faculty_intl_hc'],
['Dosen & staf','Staff with PhD','k','SDM',88,'orang','FT 88 (33,6% dari 262)','','faculty_phd'],
['Mahasiswa S1','Undergraduate Students','a','BAA',5778,'orang','FT 5.778','','ug_total'],
['Mahasiswa S1','Undergraduate International Students','a','BAA',52,'orang','FT 9 · PT 43 · FTE 23,33','','ug_intl_hc'],
['Mahasiswa S1','Undergraduate Exchange Students - Inbound','a','UGE',80,'orang','PT 80 · FTE 26,67','','ug_inbound_hc'],
['Mahasiswa S1','Undergraduate Exchange Students - Outbound','a','UGE',34,'orang','FT 34','','ug_outbound'],
['Mahasiswa S1','Undergraduate Students - First Year','a','BAA',1549,'orang','','','ug_first'],
['Mahasiswa S1','Student Retention Rate (in %)','a','BAA',0.15,'%','','Nilai 0,15 tidak lazim untuk retensi; periksa apakah satuannya fraksi (0,15 = 15%) atau persen dan sumber hitungnya',''],
['Mahasiswa S2/S3','Graduate/Postgraduate Students','a','Pascasarjana',312,'orang','','','pg_total'],
['Mahasiswa S2/S3','Graduate/Postgraduate International Students','a','Pascasarjana',5,'orang','','','pg_intl'],
['Mahasiswa S2/S3','Graduate/Postgraduate Inbound Exchange Students','a','UGE','','orang','Kosong pada berkas (isi 0 bila tidak ada)','',''],
['Mahasiswa S2/S3','Graduate/Postgraduate Outbound Exchange Students','a','UGE','','orang','Kosong pada berkas (isi 0 bila tidak ada)','',''],
['Mahasiswa S2/S3','Student Continuation Rate (in %)','a','Pascasarjana',0.05,'%','','Nilai 0,05 tidak lazim untuk tingkat kelanjutan studi; periksa definisi dan sumber',''],
['Mahasiswa S2/S3','Graduate Completion Rate (in %)','a','Pascasarjana',0.95,'%','','Periksa satuan (fraksi vs persen)',''],
['Total mahasiswa','Students - Overall','k','BAA','','orang','Berkas menunjukkan 0: rumus belum terhubung. Seharusnya 5.778 + 312 = 6.090','Rumus total belum terhubung (tampil 0)','students_total'],
['Total mahasiswa','International Students - Overall','k','BAA','','orang','Rumus belum terhubung','Rumus total belum terhubung (tampil 0)',''],
['Total mahasiswa','Exchange Students - Inbound','k','UGE','','orang','Rumus belum terhubung','Rumus total belum terhubung (tampil 0)',''],
['Total mahasiswa','Exchange Students - Outbound','k','UGE','','orang','Rumus belum terhubung','Rumus total belum terhubung (tampil 0)',''],
['Demografi mahasiswa','Total Student Nationalities','a','BAA','','negara','','Tampil 0',''],
['Demografi mahasiswa','Number of Male Students','a','BAA','','orang','','Tampil 0',''],
['Demografi mahasiswa','Number of Female Students','a','BAA','','orang','','Tampil 0',''],
['Demografi mahasiswa','First Generation Learners','a','BAA','','orang','','Tampil 0',''],
['Opsi program gelar','Number of total undergraduate degrees offered','k','BAA','','prodi','','',''],
['Opsi program gelar','Number of total postgraduate degrees offered','k','Pascasarjana','','prodi','','',''],
['Opsi program gelar','Number of total undergraduate degrees offered online','k','BAA','','prodi','','Label sama dengan baris di bawahnya; pastikan salah satunya mengacu ke pascasarjana',''],
['Opsi program gelar','Number of total undergraduate degrees offered online (baris ke-2, label ganda)','k','BAA','','prodi','','Label ganda pada template',''],
['Opsi program gelar','Total number of non-degree courses offered online (mis. micro-credential)','k','BAA','','kursus','','',''],
['Keberlanjutan','Climate Action Plan (URL)','k','Humas/TIK','','URL','Tautan halaman publik di web UMB','',''],
['Biaya & beasiswa','Undergraduate Fees - Domestic','b','Keuangan','','USD','Rata-rata biaya kuliah per tahun, dalam USD','',''],
['Biaya & beasiswa','Undergraduate Fees - International','b','Keuangan','','USD','','',''],
['Biaya & beasiswa','Graduate/postgraduate Fees - Domestic','b','Keuangan','','USD','','',''],
['Biaya & beasiswa','Graduate/postgraduate Fees - International','b','Keuangan','','USD','','',''],
['Biaya & beasiswa','Overall Student Fees - Domestic','b','Keuangan','','USD','','',''],
['Biaya & beasiswa','Overall Student Fees - International','b','Keuangan','','USD','','',''],
['Biaya & beasiswa','Students receiving a scholarship covering 100% of tuition','a','Kemahasiswaan','','orang','','',''],
['Biaya & beasiswa','Students receiving a scholarship covering at least 50% of tuition','a','Kemahasiswaan','','orang','','',''],
['Lulusan & kerja','Total Graduated Students','b','BAA','','orang','','',''],
['Lulusan & kerja','Total Respondents','b','Kemahasiswaan & Alumni','','orang','','',''],
['Lulusan & kerja','Employed Graduated Students','b','Kemahasiswaan & Alumni','','orang','','',''],
['Lulusan & kerja','Unemployed Graduated Students','b','Kemahasiswaan & Alumni','','orang','','',''],
['Lulusan & kerja','In FT Further Study','b','Kemahasiswaan & Alumni','','orang','','',''],
['Lulusan & kerja','Unavailable for Work','b','Kemahasiswaan & Alumni','','orang','','',''],
['Lulusan & kerja','Median Grad Salary','b','Kemahasiswaan & Alumni','','USD','','Sel berisi galat #VALUE! pada berkas; perbaiki rumus/isi manual',''],
['Lulusan & kerja','When was the survey shared with students?','b','Kemahasiswaan & Alumni','','tanggal','Bukti survei kerja lulusan','',''],
['Lulusan & kerja','Which year was the survey conducted?','b','Kemahasiswaan & Alumni','','tahun','','',''],
['Lulusan & kerja','Link or screenshot of report evidencing these numbers','b','Kemahasiswaan & Alumni','','URL','','','']];
qs.forEach((r,i)=>{const own=QSOWN[r[2]];ind.push({id:'QS-'+pad(i+1),rank:'QS',group:r[0],code:'QS-'+pad(i+1),title:r[1],fmt:'Angka',owner:own,checker:CHK[own],unit:r[3],val:r[4]===''?'':String(r[4]),vunit:r[5],period:'',source:'Berkas Statistical Data QS (6 Nov 2026)',evReq:true,polReq:false,masterKey:r[8],status:r[4]===''?'kosong':'draft',note:r[6],flag:r[7]});});
if(qs.length!==49) throw new Error('qs '+qs.length);
// THE
const SDGN={1:'No Poverty',2:'Zero Hunger',3:'Good Health & Well-being',4:'Quality Education',5:'Gender Equality',6:'Clean Water & Sanitation',7:'Affordable & Clean Energy',8:'Decent Work & Economic Growth',9:'Industry, Innovation & Infrastructure',10:'Reduced Inequalities',11:'Sustainable Cities & Communities',12:'Responsible Consumption & Production',13:'Climate Action',14:'Life Below Water',15:'Life on Land',16:'Peace, Justice & Strong Institutions',17:'Partnerships for the Goals'};
const K=[17,16,8,9,11], A=[1,2,3,4,5,10];
for(const r of the){const own=K.includes(r.sdg)?'u_merri':A.includes(r.sdg)?'u_tridina':'u_tiara';
 ind.push({id:'THE-'+r.ref,rank:'THE',group:'SDG '+r.sdg+' · '+SDGN[r.sdg],sdg:r.sdg,code:r.ref,title:r.desc,fmt:r.fmt==='YES/NO'?'Ya/Tidak':r.fmt==='Picklist'?'Pilihan':'Angka/Laporan',owner:own,checker:CHK[own],unit:'',val:'',vunit:'',period:'',source:'',evReq:r.ev,polReq:r.pol,masterKey:'',status:'kosong',note:'',flag:''});}
// UIGM
const CAT=[['SI','Setting & Infrastructure',8,'u_rina','Sarpras / Umum'],['EC','Energy & Climate Change',10,'u_winda','Sarpras / Umum'],['WS','Waste',6,'u_satria','Sarpras / Umum'],['WR','Water',6,'u_satria','Sarpras / Umum'],['TR','Transportation',8,'u_satria','Sarpras / Umum'],['ED','Education & Research',10,'u_winda','LPPM / BAA'],['GD','Governance & Digitalization',12,'u_rina','Keuangan / Humas']];
for(const [c,n,k,own,unit] of CAT) for(let i=1;i<=k;i++) ind.push({id:'UIG-'+c+i,rank:'UIGM',group:n+' ('+c+')',code:c+i,title:'Indikator '+c+i+' — judul/ketentuan diisi dari Panduan UIGM 2026 (impor lewat Admin › Impor CSV)',fmt:'Data + bukti',owner:own,checker:CHK[own],unit,val:'',vunit:'',period:'',source:'',evReq:true,polReq:false,masterKey:'',status:'kosong',note:'',flag:'',placeholder:true});
// ---------- master
const M=[
['faculty_total','Dosen & staf akademik (total)',262,'orang','SDM','Berkas QS'],['faculty_male','Dosen laki-laki',113,'orang','SDM','Berkas QS'],['faculty_female','Dosen perempuan',139,'orang','SDM','Berkas QS'],
['faculty_intl_hc','Dosen internasional (HC)',15,'orang','SDM','Berkas QS'],['faculty_phd','Dosen bergelar S3',88,'orang','SDM','Berkas QS'],
['ug_total','Mahasiswa S1',5778,'orang','BAA','Berkas QS'],['ug_intl_hc','Mahasiswa internasional S1 (HC)',52,'orang','BAA','Berkas QS'],['ug_inbound_hc','Pertukaran masuk S1 (HC)',80,'orang','UGE','Berkas QS'],['ug_outbound','Pertukaran keluar S1',34,'orang','UGE','Berkas QS'],['ug_first','Mahasiswa S1 tahun pertama',1549,'orang','BAA','Berkas QS'],
['pg_total','Mahasiswa pascasarjana',312,'orang','Pascasarjana','Berkas QS'],['pg_intl','Mahasiswa internasional pascasarjana',5,'orang','Pascasarjana','Berkas QS'],
['students_total','Total mahasiswa (S1 + pascasarjana)',6090,'orang','BAA','Hitung: 5.778 + 312 (belum diverifikasi ke PDDikti)'],
['students_intl_total','Total mahasiswa internasional','','orang','BAA',''],['nationalities','Jumlah kewarganegaraan mahasiswa','','negara','BAA',''],['students_male','Mahasiswa laki-laki','','orang','BAA',''],['students_female','Mahasiswa perempuan','','orang','BAA',''],
['prodi_ug','Jumlah program studi S1','','prodi','BAA',''],['prodi_pg','Jumlah program studi pascasarjana','','prodi','Pascasarjana',''],
['pubs_scopus_5y','Publikasi Scopus 2021–2025','','artikel','LPPM / Perpustakaan','Scopus (syarat QS ≥50)'],['campus_area','Luas area kampus','','m²','Sarpras / Umum',''],['graduates_total','Total lulusan tahun terakhir','','orang','BAA','']];
const master=M.map((r,i)=>({id:'m_'+r[0],key:r[0],label:r[1],val:r[2]===''?'':String(r[2]),vunit:r[3],period:'',unit:r[4],source:r[5],owner:'u_bertha',status:r[2]===''?'kosong':'perlu verifikasi'}));
// ---------- calendar
const CL=[];const cal=(d,rank,title,status,note='')=>CL.push({id:'c'+String(CL.length+1).padStart(3,'0'),date:d,rank,title,status,note});
cal('2026-11-06','ALL','Rapat perdana Task Force','internal');
cal('2026-11-09','THE','Penutupan pengiriman data THE SIR siklus 2027 (tidak dikejar)','resmi','Opsi B: minta THE membuka akses terlambat');
cal('2026-11-13','QS','Akses QS HUB diajukan','internal');cal('2026-11-13','UIGM','Email UIGM untuk akses; PIC ditetapkan','internal');cal('2026-11-13','ALL','Surat edaran Pengarah ke unit pemilik data','internal');
cal('2026-11-20','QS','Gate eligibilitas QS Asia (Scopus ≥50, area fakultas, program)','internal','Go/No-Go');cal('2026-11-20','UIGM','Periode data UIGM ditetapkan','internal');cal('2026-11-20','THE','Template scan 212 indikator siap','internal');
cal('2026-11-30','THE','Keputusan siklus 2028 + anggaran keanggotaan','internal');
cal('2026-12-04','QS','Data mentah masuk; repositori QS siap','internal');cal('2026-12-11','QS','Draft 49/49 indikator','internal');cal('2026-12-16','QS','Validasi silang data QS','internal');cal('2026-12-18','QS','Sign-off Komandan + PJ','internal');
cal('2026-12-18','THE','Scan kesiapan 212 indikator selesai','internal');cal('2026-12-18','UIGM','Inventaris kampus selesai','internal');
cal('2026-12-21','QS','Persetujuan pimpinan','internal');cal('2026-12-23','QS','SUBMIT data institusi QS (internal)','internal');cal('2026-12-28','QS','Cadangan submit QS','internal');
cal('2026-12-31','QS','Batas data institusi baru untuk siklus QS 2028','resmi','Sumber: QS Support');
cal('2027-01-15','QS','Kontak survei akademik & employer diunggah','internal');cal('2027-01-15','THE','Skor kesiapan SDG','internal');cal('2027-01-22','UIGM','Analisis kesenjangan + daftar SK dibutuhkan','internal');cal('2027-01-29','THE','Pilih SDG17 + 5 SDG prioritas; keputusan anggaran','internal');
cal('2027-02-05','QS','Finalisasi edit data institusi','internal');cal('2027-02-26','UIGM','Portal UIGM dibuka (perkiraan, mengikuti pola 2026)','estimasi');
cal('2027-03-08','QS','Akhir survei akademik & employer (awal Mar)','resmi');cal('2027-03-31','QS','Data keberlanjutan QS terkirim (internal)','internal');cal('2027-03-31','UIGM','Input 40%','internal');
cal('2027-04-30','QS','Batas data keberlanjutan QS','resmi');cal('2027-04-30','THE','Bukti ≥50% siap','internal');cal('2027-04-30','UIGM','Input 70%','internal');
cal('2027-05-31','UIGM','Input 100% (draft)','internal');cal('2027-06-15','UIGM','SUBMIT UIGM (internal)','internal');cal('2027-06-15','QS','QS WUR 2028 terbit (pantau)','estimasi','±Jun 2027');
cal('2027-06-30','THE','UMB SDG Report terbit (SDG17.3) + bukti ≥80%','internal');cal('2027-06-30','UIGM','Batas pengisian UIGM (perkiraan)','estimasi');
cal('2027-08-31','THE','Draft pengiriman THE SIR','internal');cal('2027-09-20','THE','Portal THE SIR siklus 2028 dibuka (perkiraan)','estimasi');cal('2027-09-20','UIGM','Pengumuman UIGM 2027 (perkiraan ±Sep)','estimasi');
cal('2027-10-15','QS','QS Asia 2028 terbit (perkiraan ±Okt–Nov)','estimasi');cal('2027-10-22','THE','SUBMIT THE SIR (internal)','internal');cal('2027-11-08','THE','Batas pengiriman THE SIR siklus 2028 (perkiraan)','estimasi');
cal('2028-06-15','THE','Publikasi THE SIR 2028 (perkiraan ±Jun)','estimasi');
// ---------- requests
const REQ=[['BAA / Pascasarjana','Mahasiswa per jenjang, lulusan ≥3 angkatan, kurikulum, mata kuliah SDG','QS,THE,UIGM','2026-11-27','u_oktari'],['SDM','Dosen & staf, gender, gelar S3, dosen asing, FTE','QS,THE','2026-11-27','u_bintang'],['LPPM / Perpustakaan','Publikasi Scopus 2021–2025, dana riset, afiliasi','QS,THE,UIGM','2026-11-20','u_anisa'],['UGE / Kerja sama','Pertukaran, MoU, mitra luar negeri, kontak survei','QS,THE','2026-11-27','u_bintang'],['Kemahasiswaan & Alumni','Beasiswa, keterserapan kerja, kegiatan mahasiswa','QS,THE','2026-11-27','u_anisa'],['Keuangan','Biaya kuliah, anggaran riset/lingkungan/keberlanjutan','QS,THE,UIGM','2026-11-27','u_anisa'],['Sarpras / Umum','Energi, air, limbah, transportasi, ruang hijau','THE,UIGM','2026-12-18','u_satria'],['Humas / TIK','URL web publik, dokumentasi, sistem digital','QS,THE,UIGM','2026-12-18','u_rina']];
const requests=REQ.map((r,i)=>({id:'r'+(i+1),unit:r[0],what:r[1],ranks:r[2],due:r[3],pic:r[4],status:'belum diminta',note:''}));
// ---------- risks
const RK=[['risiko','Jendela THE siklus 2027 ditutup 9 Nov','tinggi','Target siklus 2028; opsi permintaan perpanjangan','u_azhar'],['risiko','±8 minggu ke batas QS dengan data baru 15/49','tinggi','Jadwal mundur dari 23 Des; bantuan lintas tim','u_bintang'],['risiko','Syarat Scopus ≥50 / nominasi survei belum terpenuhi','tinggi','Gate 20 Nov; fallback Contributor; kampanye nominasi','u_anisa'],['risiko','Periode data UIGM 2026 hampir habis','sedang','Gunakan 12 bulan berjalan; catatan bulanan sekarang','u_winda'],['risiko','Unit pemilik data lambat','sedang','Surat edaran Pengarah; eskalasi mingguan','u_bertha'],['risiko','Anggaran keanggotaan THE belum disetujui','sedang','Keputusan 30 Nov','u_azhar'],['risiko','Beban ganda anggota (mengajar/struktural)','sedang','Pembagian seimbang; cadangan antar-anggota','u_bertha'],
['anomali','Dosen laki-laki 113 + perempuan 139 = 252, total tertulis 262 (selisih 10)','sedang','Rekonsiliasi SDM sebelum 11 Des','u_bintang'],['anomali','Retensi 0,15 dan kelanjutan studi 0,05 tidak lazim','sedang','Periksa definisi/satuan dan sumber','u_oktari'],['anomali','Median gaji lulusan bergalat #VALUE!','rendah','Perbaiki rumus atau isi manual','u_anisa'],['anomali','Total mahasiswa & demografi bernilai 0 (rumus belum terhubung)','sedang','Hubungkan ke baris S1/S2; isi 6.090','u_oktari'],['anomali','Dua baris berlabel sama “undergraduate degrees offered online”','rendah','Pastikan salah satunya pascasarjana','u_bintang']];
const risks=RK.map((r,i)=>({id:'k'+(i+1),type:r[0],title:r[1],impact:r[2],mitigation:r[3],owner:r[4],status:'terbuka'}));
const out={version:1,users:U,tasks,indicators:ind,master,calendar:CL,requests,risks,evidence:[],log:[]};
fs.writeFileSync('seed-data.js','window.SEED='+JSON.stringify(out)+';');
console.log(U.length,tasks.length,ind.length,master.length,CL.length,requests.length,risks.length,'tasks w/o date',tasks.filter(t=>!t.due).map(t=>t.dueText));
