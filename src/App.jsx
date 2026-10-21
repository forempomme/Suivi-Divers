import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, memo } from "react";
import { Home, BookOpen, Plus, BarChart2, Settings, Edit2, Trash2, FileText, Camera, Image as ImageIcon, Calendar, DollarSign, Clock, Download, Upload, Search, ChevronLeft, ChevronRight, Eye, X, Check, ArrowRight, Tag, Lock, CalendarPlus, RotateCcw, Gauge, User, Repeat, FileSpreadsheet, Fingerprint, Wrench, TriangleAlert, CircleCheck } from "lucide-react";
import _ from "lodash";

// ─── Constantes ───────────────────────────────────────────────
const APP_VERSION = "2.0.0"; // Majeure : refonte graphique Material You (piste C)
const APP_NAME    = "Suivi Divers";

const COLOR_OPTS = [
  { dot:"#378ADD", bg:"#E6F1FB", color:"#185FA5" },
  { dot:"#639922", bg:"#EAF3DE", color:"#3B6D11" },
  { dot:"#E24B4A", bg:"#FCEBEB", color:"#A32D2D" },
  { dot:"#BA7517", bg:"#FAEEDA", color:"#633806" },
  { dot:"#7F77DD", bg:"#EEEDFE", color:"#534AB7" },
  { dot:"#1D9E75", bg:"#E1F5EE", color:"#0F6E56" },
  { dot:"#D85A30", bg:"#FAECE7", color:"#993C1D" },
  { dot:"#D4537E", bg:"#FBEAF0", color:"#993556" },
];
const EMOJI_CATS = [
  { label:"Véhicules",  emojis:["🚗","🚙","🏍️","🚲","🛻","🚑","🚒","✈️","🚂","⛵","🛵","🚐","🛺","🚁"] },
  { label:"Animaux",    emojis:["🐾","🐶","🐱","🐰","🐹","🦊","🐺","🐻","🐼","🦁","🐯","🐮","🐷","🐔","🐧","🦜","🐠","🐢","🦎","🐝"] },
  { label:"Santé",      emojis:["💊","🏥","🩺","🩻","💉","🩹","🧬","🦷","👁️","🧪","❤️","🫀","🧠","🩼"] },
  { label:"Maison",     emojis:["🏠","🏡","🔑","🚿","🛁","💡","🔌","🪟","🚪","🧹","🧺","🪣","🪴","🛋️","🛏️","🪑","🪞","🧯"] },
  { label:"Outils",     emojis:["🔧","🔨","🪛","⚙️","🔩","🧰","🪚","💻","📱","🖥️","🖨️","⌨️","🖱️","📡"] },
  { label:"Finance",    emojis:["💰","💳","🏦","💵","📊","📈","🧾","💸","🪙","💹","📉","🏷️"] },
  { label:"Sport",      emojis:["🏋️","⚽","🎾","🏊","🚴","🤸","🥊","🏃","🎯","⛷️","🤾","🧘","🏄","🤺","🥋","🏇"] },
  { label:"Nourriture", emojis:["🍕","🛒","🥗","🍎","🥩","🍱","☕","🍳","🥦","🧃","🍷","🥐","🧁","🎂"] },
  { label:"Admin",      emojis:["📋","📁","📄","🗂️","📝","🖊️","📬","🔐","📌","✅","📅","📆","🗓️","📎"] },
  { label:"Nature",     emojis:["🌿","🌱","🌸","🌳","☀️","🌙","⭐","🌊","🔥","❄️","🌈","⚡","🌺","🍀","🌻"] },
  { label:"Loisirs",    emojis:["🎓","🎮","🎵","📚","🎨","🎭","🎬","🧩","🎲","🎸","🎹","🎤","📷","🎁"] },
  { label:"Divers",     emojis:["⏰","🔔","🎀","🧲","💡","🗑️","📦","🌐","💬","🔖","🏆","🥇","🧸","🪆"] },
];
const ICON_OPTS = EMOJI_CATS.flatMap(c=>c.emojis); // rétrocompatibilité
const BASE_CATS = {
  voiture: { label:"Voiture / Garage", short:"Voiture", ...COLOR_OPTS[0], base:true, iconKey:"voiture", fields:{km:true,pro:true} },
  veto:    { label:"Vétérinaire",       short:"Véto",    ...COLOR_OPTS[1], base:true, iconKey:"veto",    fields:{who:true,pro:true} },
  medecin: { label:"Médecin / Santé",   short:"Médecin", ...COLOR_OPTS[2], base:true, iconKey:"medecin", fields:{who:true,pro:true} },
  maison:  { label:"Maison / Entretien",short:"Maison",  ...COLOR_OPTS[3], base:true, iconKey:"maison",  fields:{pro:true} },
  divers:  { label:"Divers",            short:"Divers",  ...COLOR_OPTS[4], base:true, iconKey:"divers",  fields:{} },
};
// Champs supplémentaires activables par catégorie
const EXTRA_FIELDS = [
  { k:"who", label:"Pour qui / animal",      placeholder:"ex: Félix, Anaëlle…", Icon:User },
  { k:"pro", label:"Praticien / intervenant", placeholder:"ex: Dr Martin, Garage Dupont…", Icon:Wrench },
  { k:"km",  label:"Kilométrage",             placeholder:"ex: 84 500", Icon:Gauge },
];
const RECUR_OPTS = [
  {v:"",l:"Non"},{v:1,l:"1 mois"},{v:3,l:"3 mois"},{v:6,l:"6 mois"},{v:12,l:"1 an"},{v:24,l:"2 ans"},
];
const KM_ALERT_MARGIN = 1000; // alerte quand on est à moins de 1 000 km de l'échéance
// Fusion catégories par défaut + personnalisations (les réglages d'avant v1.4 n'avaient ni
// "fields" ni "iconKey" → on les reprend des catégories par défaut)
function mergeCats(custom){
  const m={...BASE_CATS};
  for(const[k,c]of Object.entries(custom||{})){
    m[k]=BASE_CATS[k]?{...BASE_CATS[k],...c,iconKey:BASE_CATS[k].iconKey,fields:c.fields||BASE_CATS[k].fields}:{fields:{},...c};
  }
  return m;
}
// Catégorie de repli pour une entrée dont la catégorie a disparu
const UNKNOWN_CAT = { label:"Sans catégorie", short:"Sans cat.", dot:"#7A7A8C", bg:"#7A7A8C22", color:"#7A7A8C", emoji:"❔" };
// Teintes tonales Material You d'une catégorie, calculées depuis sa couleur :
// fond = couleur mélangée au transparent, icône = couleur mélangée au texte (plus claire en sombre, plus foncée en clair)
const okHex = c => /^#[0-9a-fA-F]{6}$/.test(c?.dot||"");
const tint  = c => okHex(c) ? `color-mix(in srgb, ${c.dot} var(--tone-bg), transparent)` : "var(--muted)";
const toneFg= c => okHex(c) ? `color-mix(in srgb, ${c.dot} var(--tone-fg), var(--tp))` : "var(--ts)";
const ACCENTS = [
  {k:"bleu",label:"Bleu",sw:"#3E5F90"},{k:"vert",label:"Vert",sw:"#2F6A3C"},
  {k:"orange",label:"Orange",sw:"#8F4C1A"},{k:"violet",label:"Violet",sw:"#6F4AA1"},
];
// Styles communs Material 3
const M3 = {
  title:{fontSize:28,fontWeight:500,color:"var(--tp)",letterSpacing:0},
  header:{padding:"18px 20px 10px",background:"var(--bg)",position:"sticky",top:0,zIndex:10},
  section:{fontSize:14,fontWeight:600,color:"var(--ac)",padding:"18px 20px 10px"},
  card:{background:"var(--card)",borderRadius:24},
  btn:{minHeight:48,padding:"0 24px",borderRadius:24,border:"none",background:"var(--ac)",color:"var(--on-ac)",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
  tonal:{minHeight:48,padding:"0 24px",borderRadius:24,border:"none",background:"var(--sc)",color:"var(--on-sc)",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
  outlined:{minHeight:48,padding:"0 24px",borderRadius:24,border:"1px solid var(--bs)",background:"transparent",color:"var(--ac)",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8},
};
const MAX_FILE = 4 * 1024 * 1024;
const MAX_DIM  = 1400;
const SL_G = {fontSize:13,color:"var(--ts)",marginBottom:6,display:"block",fontWeight:500};

// ─── CSS global ───────────────────────────────────────────────
const CSS = `
/* ── Thème Material You (v2.0.0) ─────────────────────────────
   Jetons M3 : surface, conteneurs tonals, couleur principale + 4 variantes.
   Les noms historiques (--bg, --card, --ac…) sont conservés pour ne rien casser. */
:root{
  --bg:#F9F9FF;--card:#EDEDF4;--sheet:#F3F3FA;--muted:#E2E2E9;--input:transparent;--nav:#EDEDF4;
  --tp:#191C20;--ts:#44474E;--th:#74777F;
  --b:rgba(68,71,78,.14);--bs:#74777F;
  --ac:#3E5F90;--on-ac:#FFFFFF;--al:#D6E3FF;--on-al:#001B3E;
  --sc:#D7E3F8;--on-sc:#101C2B;
  --er:#BA1A1A;--er-bg:#FFDAD6;--on-er:#410002;
  --ok-bg:#DCF3DC;--ok-b:#A6D3AA;--ok-t:#0F3D1A;--ok-m:#2F6A3C;
  --nx-bg:#D7E3F8;--nx-t:#101C2B;
  --warn:#3E5F90;--warn-bg:#D6E3FF;
  --inv:#2E3036;--on-inv:#EFF0F7;
  --tone-bg:18%;--tone-fg:72%;
  --scrim:rgba(0,0,0,.32);
}
:root[data-dark]{
  --bg:#111418;--card:#1D2024;--sheet:#191C20;--muted:#272A2F;--input:transparent;--nav:#1D2024;
  --tp:#E1E2E8;--ts:#C4C6D0;--th:#8E9099;
  --b:rgba(196,198,208,.12);--bs:#8E9099;
  --ac:#A8C8FF;--on-ac:#0A305F;--al:#284777;--on-al:#D6E3FF;
  --sc:#3B4858;--on-sc:#D7E3F8;
  --er:#FFB4AB;--er-bg:#93000A;--on-er:#FFDAD6;
  --ok-bg:#1E3A26;--ok-b:#2E5A3A;--ok-t:#B7F1BA;--ok-m:#6BB57A;
  --nx-bg:#3B4858;--nx-t:#D7E3F8;
  --warn:#A8C8FF;--warn-bg:#284777;
  --inv:#E1E2E8;--on-inv:#2E3036;
  --tone-bg:32%;--tone-fg:55%;
  --scrim:rgba(0,0,0,.6);
}
/* Couleur principale au choix (Réglages > Affichage) */
:root:not([data-dark])[data-accent=vert]{--ac:#2F6A3C;--on-ac:#FFFFFF;--al:#B7F1BA;--on-al:#00210B;--warn:#2F6A3C;--warn-bg:#B7F1BA}
:root[data-dark][data-accent=vert]{--ac:#9CD49F;--on-ac:#003914;--al:#1E5130;--on-al:#B7F1BA;--warn:#9CD49F;--warn-bg:#1E5130}
:root:not([data-dark])[data-accent=orange]{--ac:#8F4C1A;--on-ac:#FFFFFF;--al:#FFDBC8;--on-al:#321300;--warn:#8F4C1A;--warn-bg:#FFDBC8}
:root[data-dark][data-accent=orange]{--ac:#FFB68B;--on-ac:#522300;--al:#713700;--on-al:#FFDBC8;--warn:#FFB68B;--warn-bg:#713700}
:root:not([data-dark])[data-accent=violet]{--ac:#6F4AA1;--on-ac:#FFFFFF;--al:#EDDCFF;--on-al:#29005A;--warn:#6F4AA1;--warn-bg:#EDDCFF}
:root[data-dark][data-accent=violet]{--ac:#D7BAFF;--on-ac:#3F1A70;--al:#573288;--on-al:#EDDCFF;--warn:#D7BAFF;--warn-bg:#573288}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
/* Roboto = police système d'Android : aucun téléchargement, fonctionne hors ligne */
body{font-family:"Roboto Flex",Roboto,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--tp);transition:background .25s}
input,select,textarea,button{font-family:inherit}
input,textarea,select{color:var(--tp)}
input::placeholder,textarea::placeholder{color:var(--th)}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--ac)!important;box-shadow:inset 0 0 0 1px var(--ac)}
input[type=date]::-webkit-calendar-picker-indicator{opacity:.7}
:root[data-dark] input[type=date]::-webkit-calendar-picker-indicator{filter:invert(1)}
button:focus-visible,a:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
@keyframes snackIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
/* "backwards" (et non "both") : une fois l'animation finie, plus de transform résiduel,
   sinon les fenêtres en position:fixed seraient coupées par la barre d'onglets */
.fu{animation:fadeUp .28s ease backwards}
.fi{animation:fadeIn .22s ease backwards}
.su{animation:slideUp .32s cubic-bezier(.2,0,0,1) backwards}
.hscroll{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}
.hscroll>*{scroll-snap-align:start}
.press{transition:transform .12s ease,filter .12s ease}
.press:active{transform:scale(.97);filter:brightness(1.08)}
html,body,#root{height:100%;overscroll-behavior:none}
::-webkit-scrollbar{width:0;height:0}
`;

// ─── Utilitaires ──────────────────────────────────────────────
const fmt      = d => { if(!d) return ""; const[y,m,dy]=d.split("-"); return `${dy}/${m}/${y}`; };
const fmtPrice = p => { if(p==null||p==="") return null; const n=parseFloat(p); return isNaN(n)?null:n.toFixed(2).replace(".",",")+"\u202f€"; };
const fmtBytes = b => b<1024?b+"o":b<1048576?Math.round(b/1024)+"Ko":(b/1048576).toFixed(1)+"Mo";
const isPdf    = t => t==="application/pdf"||t==="pdf";
// Date du jour en heure LOCALE (toISOString donnait la date UTC → "hier" entre 0h et 2h en France)
const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const parseLocal = s => { const[y,m,d]=(s||"").split("-").map(Number); return new Date(y,(m||1)-1,d||1); };
const daysUntil= d => { const t=new Date(); t.setHours(0,0,0,0); return Math.round((parseLocal(d)-t)/86400000); };
const ymd      = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addMonths= (s,n) => { const d=parseLocal(s); const day=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+Number(n)); const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); d.setDate(Math.min(day,last)); return ymd(d); };
const fmtKm    = n => n==null||n===""||isNaN(+n)?"":Number(n).toLocaleString("fr-FR")+" km";
const recurLabel = n => (RECUR_OPTS.find(o=>String(o.v)===String(n))||{}).l;
const norm     = s =>(s||"").toString().normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();

async function compressImage(dataUrl){
  return new Promise(res=>{
    const img=new window.Image();
    img.onload=()=>{
      try{
        let w=img.width,h=img.height;
        if(w>MAX_DIM||h>MAX_DIM){const s=Math.min(MAX_DIM/w,MAX_DIM/h);w=Math.round(w*s);h=Math.round(h*s);}
        const c=document.createElement("canvas");c.width=w;c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        res(c.toDataURL("image/jpeg",.82));
      }catch{res(dataUrl);}
    };
    img.onerror=()=>res(dataUrl); // format non lisible (ex: HEIC) → on garde l'original
    img.src=dataUrl;
  });
}

// period = "12m" (12 derniers mois) ou une année "2026"
function monthsOf(period){
  if(period==="12m")return Array.from({length:12},(_,i)=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(11-i));return{y:d.getFullYear(),m:d.getMonth()};});
  return Array.from({length:12},(_,m)=>({y:Number(period),m}));
}
function inPeriod(e,period){
  const d=parseLocal(e.date);
  if(period==="12m"){const from=new Date();from.setDate(1);from.setMonth(from.getMonth()-11);from.setHours(0,0,0,0);return d>=from;}
  return d.getFullYear()===Number(period);
}
function getMonthlyData(entries,period="12m"){
  return monthsOf(period).map(({y,m})=>{
    const label=new Date(y,m,1).toLocaleDateString("fr-FR",{month:"short"}).replace(".","");
    const mes=entries.filter(e=>{const ed=parseLocal(e.date);return ed.getFullYear()===y&&ed.getMonth()===m;});
    const total=mes.filter(e=>e.price!=null&&!isNaN(parseFloat(e.price))).reduce((s,e)=>s+parseFloat(e.price),0);
    return{label,total:+total.toFixed(2),count:mes.length};
  });
}
// Export CSV lisible par Excel / Google Sheets en français (séparateur ; et virgule décimale)
function toCSV(entries,lookup){
  const q=v=>{const t=(v??"").toString().replace(/\r?\n/g," ");return/[;"]/.test(t)?`"${t.replace(/"/g,'""')}"`:t;};
  const head=["Date","Catégorie","Titre","Prix (€)","Pour qui","Intervenant","Kilométrage","Prochain RDV","Échéance km","Récurrence","Notes"];
  const rows=[...entries].sort((a,b)=>a.date.localeCompare(b.date)).map(e=>[
    fmt(e.date),(lookup[e.cat]||UNKNOWN_CAT).label,e.title,
    e.price!=null&&e.price!==""&&!isNaN(parseFloat(e.price))?parseFloat(e.price).toFixed(2).replace(".",","):"",
    e.who,e.pro,e.km,fmt(e.next),e.nextKm,e.recur?recurLabel(e.recur):"",e.notes,
  ].map(q).join(";"));
  return "\uFEFF"+[head.join(";"),...rows].join("\r\n");
}

// ─── Rappels : RDV à venir, retards, kilométrage ──────────────
// Un rappel est "remplacé" dès qu'une entrée PLUS RÉCENTE porte le même titre dans la même catégorie
// (ex : tu saisis une nouvelle "Vidange" → l'ancien rappel de vidange disparaît tout seul).
function isSuperseded(e,entries){
  const t=norm(e.title).trim();
  return entries.some(o=>o.id!==e.id&&o.cat===e.cat&&norm(o.title).trim()===t&&(o.date>e.date||(o.date===e.date&&Number(o.id)>Number(e.id))));
}
const activeEntries=entries=>entries.filter(e=>(e.next||e.nextKm)&&!isSuperseded(e,entries));
function latestKm(entries,cat){
  let m=null;
  for(const e of entries)if(e.cat===cat&&e.km!==""&&e.km!=null&&!isNaN(+e.km))m=Math.max(m??0,+e.km);
  return m;
}
function computeReminders(entries,horizon=30){
  const out=[];
  for(const e of activeEntries(entries)){
    if(e.next){const d=daysUntil(e.next);if(d<=horizon)out.push({e,kind:"date",days:d,overdue:d<0,soon:d>=0&&d<=3});}
    if(e.nextKm){
      const cur=latestKm(entries,e.cat),target=+e.nextKm;
      if(cur!=null&&cur>=target-KM_ALERT_MARGIN)out.push({e,kind:"km",cur,target,overdue:cur>=target,soon:cur<target,days:0});
    }
  }
  return out.sort((a,b)=>(b.overdue-a.overdue)||(a.days-b.days));
}

// ─── Storage (Capacitor Preferences via adapteur window.storage) ──
function useStorage(key,initial){
  const[val,setVal]=useState(initial);
  const touched=useRef(false); // l'utilisateur a modifié avant la fin du chargement ?
  const saver=useRef(_.debounce((k,v)=>window.storage.set(k,JSON.stringify(v)).catch(()=>{}),450)).current;
  useEffect(()=>{
    window.storage.get(key).then(r=>{
      if(touched.current||!r||r.value==null)return;
      try{const v=JSON.parse(r.value);if(v!==null&&v!==undefined)setVal(v);}catch{}
    }).catch(()=>{});
  },[key]);
  // Écrire immédiatement si l'app passe en arrière-plan (sinon perte des 450 dernières ms)
  useEffect(()=>{
    const flush=()=>saver.flush();
    const onVis=()=>{if(document.visibilityState==="hidden")flush();};
    document.addEventListener("visibilitychange",onVis);
    window.addEventListener("pagehide",flush);
    return()=>{flush();document.removeEventListener("visibilitychange",onVis);window.removeEventListener("pagehide",flush);};
  },[saver]);
  const save=useCallback(updater=>{
    touched.current=true;
    setVal(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      saver(key,next);
      return next;
    });
  },[key,saver]);
  return[val,save];
}

// v1.4.0 : si l'app tourne sur Android (window.fileStore fourni par main.jsx), les pièces jointes
// sont des fichiers. Sinon (navigateur), on garde l'ancien stockage clé/valeur.
const FS=()=>window.fileStore||null;

async function loadAllDocs(){
  const all={};
  try{
    // 1. Anciennes pièces jointes (Preferences) → migration vers fichiers, une seule fois
    const res=await window.storage.list("tr-doc-").catch(()=>({keys:[]}));
    for(const k of (res?.keys||[])){
      const id=k.replace("tr-doc-","");
      const r=await window.storage.get(k).catch(()=>null);
      if(!r)continue;
      try{all[id]=JSON.parse(r.value);}catch{continue;}
      if(FS()){await FS().write(`${id}.json`,r.value);await window.storage.delete(k).catch(()=>{});}
    }
    // 2. Pièces jointes en fichiers
    if(FS()){
      const files=(await FS().list()).filter(f=>f.endsWith(".json"));
      await Promise.all(files.map(async f=>{
        const id=f.replace(/\.json$/,"");
        if(all[id])return;
        try{all[id]=JSON.parse(await FS().read(f));}catch{}
      }));
    }
  }catch{}
  return all;
}
async function saveDocForEntry(id,arr){
  if(FS()){
    if(!arr||!arr.length){await FS().remove(`${id}.json`);return;}
    await FS().write(`${id}.json`,JSON.stringify(arr));
    return;
  }
  const k=`tr-doc-${id}`;
  if(!arr||!arr.length){await window.storage.delete(k).catch(()=>{});return;}
  await window.storage.set(k,JSON.stringify(arr));
}
async function deleteDocForEntry(id){
  if(FS())await FS().remove(`${id}.json`);
  await window.storage.delete(`tr-doc-${id}`).catch(()=>{});
}

// ─── Contexte : rappels déjà remplacés (ids) ──────────────────
const DoneCtx=createContext(new Set());

// ─── Ouvrir un RDV dans Google Agenda ─────────────────────────
function gcalUrl(entry,cat){
  const d=parseLocal(entry.next),end=new Date(d);end.setDate(end.getDate()+1);
  const f=x=>ymd(x).replace(/-/g,"");
  const details=[cat?.label,entry.who&&("Pour : "+entry.who),entry.pro&&("Chez : "+entry.pro),entry.notes].filter(Boolean).join("\n");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE"
    +"&text="+encodeURIComponent(entry.title)
    +"&dates="+f(d)+"/"+f(end)
    +"&details="+encodeURIComponent(details)
    +(entry.pro?"&location="+encodeURIComponent(entry.pro):"");
}
function openExternal(url){
  if(window.Capacitor?.isNativePlatform?.()&&window.__openUrl)window.__openUrl(url);
  else window.open(url,"_blank","noopener");
}

// ─── Toast ────────────────────────────────────────────────────
const ToastCtx=createContext(null);
const useToast=()=>useContext(ToastCtx);

function ToastProvider({children}){
  const[list,setList]=useState([]);
  const add=useCallback((msg,type="success",dur=3200)=>{
    const id=Date.now()+Math.random();
    setList(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setList(p=>p.filter(t=>t.id!==id)),dur);
  },[]);
  // Snackbar Material 3 : fond "inverse", une pastille de couleur indique le type
  const DOT={success:"var(--ok-m)",error:"var(--er)",warning:"var(--ac)",info:"var(--on-inv)"};
  return(
    <ToastCtx.Provider value={add}>
      {children}
      <div role="status" aria-live="polite" style={{position:"fixed",bottom:100,left:16,right:16,maxWidth:488,margin:"0 auto",zIndex:9998,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
        {list.map(t=>(
          <div key={t.id} style={{minHeight:48,padding:"12px 16px",borderRadius:8,fontSize:14,fontWeight:500,background:"var(--inv)",color:"var(--on-inv)",display:"flex",alignItems:"center",gap:12,boxShadow:"0 4px 12px rgba(0,0,0,.3)",animation:"snackIn .22s ease"}}>
            <span style={{width:8,height:8,borderRadius:4,background:DOT[t.type]||DOT.success,flexShrink:0,filter:"saturate(1.4)"}}/>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ─── useNotifications ─────────────────────────────────────────
function useNotifications(entries,toast){
  const[perm,setPerm]=useState("default");
  const[enabled,setEnabled]=useState(true);

  // Lire la permission et l'état activé/désactivé au démarrage
  useEffect(()=>{
    if(window.__getNotifPermission){
      window.__getNotifPermission().then(p=>{ if(p)setPerm(p); });
    } else if(typeof Notification!=="undefined"){
      setPerm(Notification.permission);
    }
    try{
      const stored=localStorage.getItem("tr-notif-enabled");
      if(stored==="false") setEnabled(false);
    }catch(_){}
  },[]);

  // (v1.4.0 : plus de bulles au démarrage — le bloc « À suivre » de l'accueil les remplace)

  // Reprogrammer les rappels Android à chaque changement des RDV
  // (uniquement les rappels "actifs" : pas ceux déjà remplacés par une entrée plus récente)
  const active=useMemo(()=>activeEntries(entries).filter(e=>e.next),[entries]);
  const nextKey=useMemo(()=>active.map(e=>`${e.id}|${e.next}|${e.title}`).sort().join(";"),[active]);
  useEffect(()=>{
    if(!enabled||perm!=="granted"||!window.__scheduleNotifications)return;
    const t=setTimeout(async()=>{
      try{await window.__scheduleNotifications(active);}catch(_){}
    },1200);
    return()=>clearTimeout(t);
  },[nextKey,enabled,perm]); // eslint-disable-line

  // Demander la permission (premier lancement)
  const request=useCallback(async()=>{
    if(window.__requestNotifPermission){
      const p=await window.__requestNotifPermission();
      setPerm(p);
      if(p==="granted"){
        setEnabled(true);
        try{localStorage.setItem("tr-notif-enabled","true");}catch(_){}
        window.__scheduleNotifications?.(activeEntries(entries).filter(e=>e.next));
        toast("Notifications activées !","success");
      } else {
        toast("Permission refusée par Android","error");
      }
      return;
    }
    if(typeof Notification==="undefined")return;
    const p2=await Notification.requestPermission();
    setPerm(p2);
    toast(p2==="granted"?"Notifications activées !":"Permission refusée",p2==="granted"?"success":"error");
  },[toast,entries]);

  // Activer / désactiver les rappels (sans révoquer la permission Android)
  const toggle=useCallback(async(val)=>{
    setEnabled(val);
    try{localStorage.setItem("tr-notif-enabled",String(val));}catch(_){}
    if(val){
      if(perm!=="granted"){
        await request();
        return;
      }
      window.__scheduleNotifications?.(activeEntries(entries).filter(e=>e.next));
      toast("Rappels activés","success");
    } else {
      window.__cancelAllNotifications?.();
      toast("Rappels désactivés","info");
    }
  },[perm,entries,request,toast]);

  return{perm,enabled,request,toggle};
}

// ─── useSearch ────────────────────────────────────────────────
function useSearch(entries,allCats){
  const[q,setQ]=useState("");
  // Filtrage direct (sans délai) et insensible aux accents : "veterinaire" trouve "Vétérinaire"
  const results=useMemo(()=>{
    const lq=norm(q.trim());
    if(!lq)return entries;
    return entries.filter(e=>
      norm(e.title).includes(lq)||norm(e.notes).includes(lq)||norm(e.who).includes(lq)||norm(e.pro).includes(lq)||norm(allCats[e.cat]?.label).includes(lq)
    );
  },[q,entries,allCats]);
  return{q,setQ,results};
}

// ─── Composants de base ───────────────────────────────────────
// Interrupteur Material 3 (piste 52×32, pouce qui grossit quand activé)
function Toggle({checked,onChange,label}){
  return(
    <label style={{position:"relative",width:52,height:32,flexShrink:0,cursor:"pointer",display:"inline-block"}}>
      <input type="checkbox" aria-label={label} checked={checked} onChange={e=>onChange(e.target.checked)} style={{position:"absolute",inset:0,opacity:0,margin:0,cursor:"pointer"}}/>
      <span style={{position:"absolute",inset:0,borderRadius:16,background:checked?"var(--ac)":"var(--muted)",border:checked?"2px solid var(--ac)":"2px solid var(--th)",transition:"background .2s,border-color .2s",pointerEvents:"none"}}/>
      <span style={{position:"absolute",top:checked?4:8,left:checked?24:8,width:checked?24:16,height:checked?24:16,background:checked?"var(--on-ac)":"var(--th)",borderRadius:"50%",transition:"all .2s cubic-bezier(.2,0,0,1)",pointerEvents:"none"}}/>
    </label>
  );
}

function EmptyState({icon:Icon,title,sub}){
  return(
    <div className="fu" style={{padding:"48px 24px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
      <div style={{width:72,height:72,borderRadius:"50%",background:"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Icon size={30} strokeWidth={1.4} color="var(--th)"/>
      </div>
      <div style={{fontSize:16,fontWeight:600,color:"var(--tp)"}}>{title}</div>
      <div style={{fontSize:13,color:"var(--ts)",maxWidth:230,lineHeight:1.6}}>{sub}</div>
    </div>
  );
}

function CatIcon({cat,size=17,color}){
  if(cat.emoji)return<span style={{fontSize:size,lineHeight:1}}>{cat.emoji}</span>;
  const s=color||toneFg(cat); // teinte tonale : claire en sombre, foncée en clair
  const shapes={
    voiture:<><path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 12h14"/></>,
    veto:   <><path d="M20 9a4 4 0 00-4-4 4 4 0 00-4 4 4 4 0 004 4 4 4 0 004-4z"/><path d="M4 9c0-2.2 1.8-4 4-4"/><path d="M8 9a4 4 0 01-4 4"/><path d="M12 13v8"/><path d="M12 17H8"/></>,
    medecin:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8M8 12h8"/></>,
    maison: <><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></>,
    divers: <><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></>,
  };
  // Avant : recherche par libellé → icône perdue dès qu'on renommait une catégorie
  const key=cat.iconKey||Object.keys(BASE_CATS).find(k=>BASE_CATS[k].label===cat.label)||"divers";
  return<svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" width={size} height={size}>{shapes[key]||shapes.divers}</svg>;
}

function DocThumb({doc,size=40,onClick}){
  const st={width:size,height:size,borderRadius:7,flexShrink:0,cursor:"pointer"};
  if(isPdf(doc.type))return<div onClick={onClick} style={{...st,background:"var(--al)",display:"flex",alignItems:"center",justifyContent:"center"}}><FileText size={size*.4} color="var(--ac)"/></div>;
  return<img src={doc.dataUrl} alt="" onClick={onClick} style={{...st,objectFit:"cover"}}/>;
}

// ─── Viewer ───────────────────────────────────────────────────
function Viewer({docs,idx,onClose,onNav}){
  // Le hook doit être appelé AVANT tout "return" conditionnel (sinon plantage React)
  useEffect(()=>{
    const h=e=>{if(e.key==="Escape")onClose();if(e.key==="ArrowLeft")onNav(-1);if(e.key==="ArrowRight")onNav(1);};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[onClose,onNav]);
  if(!docs?.length)return null;
  const doc=docs[Math.min(idx,docs.length-1)];
  return(
    <div className="fi" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:9999,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,.1)",flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {isPdf(doc.type)?<FileText size={16} color="#fff"/>:<ImageIcon size={16} color="#fff"/>}
        </div>
        <div style={{flex:1,fontSize:14,fontWeight:600,color:"#f0f0f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,.12)",border:"none",color:"#fff",width:34,height:34,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18}/></button>
      </div>
      <div style={{flex:1,overflow:"auto",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        {isPdf(doc.type)
          ?<div style={{textAlign:"center",color:"rgba(255,255,255,.7)"}}>
              <div style={{fontSize:52,marginBottom:16}}>📄</div>
              <div style={{fontSize:16,fontWeight:600,color:"#fff",marginBottom:8}}>{doc.name}</div>
              <div style={{fontSize:13,marginBottom:20}}>{fmtBytes(doc.size)}</div>
              <a href={doc.dataUrl} download={doc.name} style={{display:"inline-block",padding:"10px 22px",background:"var(--ac)",color:"var(--on-ac)",borderRadius:10,textDecoration:"none",fontSize:14,fontWeight:600}}>Télécharger</a>
            </div>
          :<img src={doc.dataUrl} alt={doc.name} style={{maxWidth:"100%",maxHeight:"calc(100vh - 140px)",borderRadius:10,objectFit:"contain"}}/>
        }
      </div>
      {docs.length>1&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,.08)",flexShrink:0}}>
          <button onClick={()=>onNav(-1)} disabled={idx===0} style={{background:"rgba(255,255,255,.12)",border:"none",color:"#fff",padding:"8px 18px",borderRadius:20,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:idx===0?.3:1,fontFamily:"inherit"}}><ChevronLeft size={14}/>Précédent</button>
          <span style={{fontSize:13,color:"rgba(255,255,255,.5)",minWidth:48,textAlign:"center"}}>{idx+1} / {docs.length}</span>
          <button onClick={()=>onNav(1)} disabled={idx===docs.length-1} style={{background:"rgba(255,255,255,.12)",border:"none",color:"#fff",padding:"8px 18px",borderRadius:20,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:idx===docs.length-1?.3:1,fontFamily:"inherit"}}>Suivant<ChevronRight size={14}/></button>
        </div>
      )}
    </div>
  );
}

// ─── EntryCard ────────────────────────────────────────────────
// Pastille d'état Material 3 (assist chip)
function Chip({bg,fg,icon:Icon,children,outline}){
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:5,height:26,padding:"0 10px",borderRadius:8,background:bg,color:fg,border:outline?`1px solid ${outline}`:"none",fontSize:12,fontWeight:500,whiteSpace:"nowrap"}}>
      {Icon&&<Icon size={13} strokeWidth={2.2}/>}{children}
    </span>
  );
}

const EntryCard=memo(function EntryCard({entry,entryDocs=[],allCats,clickable,onClick,onViewDoc}){
  const c=allCats[entry.cat]||UNKNOWN_CAT;
  const p=fmtPrice(entry.price);
  const done=useContext(DoneCtx).has(entry.id);
  const dn=entry.next?daysUntil(entry.next):null;
  const upcoming=!done&&dn!=null&&dn>=0&&dn<=3;
  const late=!done&&dn!=null&&dn<0;
  const sub=[fmt(entry.date),c.short,entry.who,entry.pro,fmtKm(entry.km)].filter(Boolean).join(" · ");
  return(
    <div onClick={clickable?onClick:undefined} role={clickable?"button":undefined} tabIndex={clickable?0:undefined}
      onKeyDown={clickable?e=>{if(e.key==="Enter")onClick();}:undefined} className={clickable?"press":undefined}
      style={{background:"var(--card)",borderRadius:20,padding:"12px 14px",display:"flex",gap:14,alignItems:"flex-start",cursor:clickable?"pointer":"default"}}>
      <div style={{width:40,height:40,borderRadius:12,background:tint(c),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CatIcon cat={c} size={20}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:8}}>
          <div style={{fontSize:16,fontWeight:500,color:"var(--tp)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.title}</div>
          {p&&<div style={{fontSize:14,fontWeight:600,color:"var(--tp)",flexShrink:0}}>{p}</div>}
        </div>
        <div style={{fontSize:13,color:"var(--ts)",marginTop:2}}>{sub}</div>
        {entry.notes&&<div style={{fontSize:13,color:"var(--ts)",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.notes}</div>}
        {(entry.next||(entry.nextKm&&!done)||entryDocs.length>0)&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
            {entry.next&&(done
              ?<Chip bg="var(--muted)" fg="var(--ts)" icon={CircleCheck}>Fait · {fmt(entry.next)}</Chip>
              :late?<Chip bg="var(--er-bg)" fg="var(--on-er)" icon={TriangleAlert}>Retard {-dn} j · {fmt(entry.next)}</Chip>
              :<Chip bg={upcoming?"var(--al)":"var(--sc)"} fg={upcoming?"var(--on-al)":"var(--on-sc)"} icon={entry.recur?Repeat:Calendar}>{dn===0?"Aujourd'hui":dn===1?"Demain":`Le ${fmt(entry.next)}`}</Chip>)}
            {entry.nextKm&&!done&&<Chip bg="var(--sc)" fg="var(--on-sc)" icon={Gauge}>À {fmtKm(entry.nextKm)}</Chip>}
            {entryDocs.map((d,i)=>(
              <button key={i} onClick={e=>{e.stopPropagation();onViewDoc(entryDocs,i);}} aria-label={"Voir "+d.name}
                style={{display:"inline-flex",alignItems:"center",gap:5,height:26,padding:"0 10px",borderRadius:8,background:"transparent",border:"1px solid var(--bs)",fontSize:12,color:"var(--ts)",cursor:"pointer",fontFamily:"inherit",maxWidth:150}}>
                {isPdf(d.type)?<FileText size={13}/>:<ImageIcon size={13}/>}
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── EntryModal ───────────────────────────────────────────────
function EntryModal({entry,entryDocs=[],allCats,onClose,onEdit,onDelete,onViewDoc,onDone}){
  const[confirmDel,setConfirmDel]=useState(false);
  const done=useContext(DoneCtx).has(entry.id);
  const c=allCats[entry.cat]||UNKNOWN_CAT;
  const p=fmtPrice(entry.price);
  const dn=entry.next?daysUntil(entry.next):null;
  const nextTxt=entry.next?fmt(entry.next)+(done?" (fait)":dn<0?"":dn===0?" · aujourd'hui":` · dans ${dn} j`):null; // le retard est déjà affiché dans le bandeau rouge
  const fields=[
    {icon:<Calendar size={16}/>,label:"Date",val:fmt(entry.date)},
    p?{icon:<DollarSign size={16}/>,label:"Prix",val:p,cls:"price"}:null,
    entry.who?{icon:<User size={16}/>,label:"Pour qui",val:entry.who}:null,
    entry.pro?{icon:<Wrench size={16}/>,label:"Praticien / intervenant",val:entry.pro}:null,
    entry.km?{icon:<Gauge size={16}/>,label:"Kilométrage",val:fmtKm(entry.km)}:null,
    entry.next?{icon:<Clock size={16}/>,label:"Prochain RDV",val:nextTxt,cls:!done&&dn<0?"late":"next"}:null,
    entry.nextKm?{icon:<Gauge size={16}/>,label:"Prochaine échéance",val:"à "+fmtKm(entry.nextKm),cls:"next"}:null,
    entry.recur?{icon:<Repeat size={16}/>,label:"À refaire tous les",val:recurLabel(entry.recur)}:null,
    entry.notes?{icon:<FileText size={16}/>,label:"Notes",val:entry.notes}:null,
  ].filter(Boolean);
  const showDone=!done&&(entry.next||entry.nextKm);
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} className="fi"
      style={{position:"fixed",inset:0,background:"var(--scrim)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div className="su" role="dialog" aria-modal="true" aria-label={entry.title} style={{background:"var(--sheet)",borderRadius:"28px 28px 0 0",width:"100%",maxWidth:520,maxHeight:"92vh",overflowY:"auto",paddingBottom:24}}>
        <div style={{width:32,height:4,background:"var(--th)",opacity:.5,borderRadius:2,margin:"16px auto 0"}}/>
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px 12px"}}>
          <div style={{width:52,height:52,borderRadius:16,background:tint(c),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CatIcon cat={c} size={26}/></div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,color:"var(--ts)"}}>{c.label}</div>
            <div style={{fontSize:24,fontWeight:500,color:"var(--tp)",marginTop:1}}>{entry.title}</div>
          </div>
        </div>
        {entry.next&&!done&&dn<0&&(
          <div style={{margin:"0 16px 12px",padding:"12px 16px",borderRadius:16,background:"var(--er-bg)",color:"var(--on-er)",display:"flex",alignItems:"center",gap:10,fontSize:14,fontWeight:600}}>
            <TriangleAlert size={20}/>En retard de {-dn} jour{-dn>1?"s":""} · prévu le {fmt(entry.next)}
          </div>
        )}
        {/* Informations en tuiles (2 colonnes), les notes sur toute la largeur */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:8,padding:"0 16px"}}>
          {fields.filter(f=>f.label!=="Notes").map((f,i)=>(
            <div key={i} style={{padding:"12px 14px",borderRadius:16,background:"var(--card)",minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--ts)"}}>{f.icon}{f.label}</div>
              <div style={{fontSize:15,fontWeight:600,marginTop:4,color:f.cls==="price"?"var(--ac)":f.cls==="late"?"var(--er)":"var(--tp)",overflowWrap:"anywhere"}}>{f.val}</div>
            </div>
          ))}
          {entry.notes&&(
            <div style={{gridColumn:"1 / -1",padding:"12px 14px",borderRadius:16,background:"var(--card)"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--ts)"}}><FileText size={14}/>Notes</div>
              <div style={{fontSize:15,marginTop:4,color:"var(--tp)",whiteSpace:"pre-wrap"}}>{entry.notes}</div>
            </div>
          )}
        </div>
        {entryDocs.length>0&&(
          <div style={{padding:"16px 16px 0"}}>
            <div style={{fontSize:14,fontWeight:600,color:"var(--ac)",margin:"0 4px 10px"}}>Documents</div>
            <div className="hscroll" style={{gap:8}}>
              {entryDocs.map((d,i)=>(
                <button key={i} onClick={()=>onViewDoc(entryDocs,i)} aria-label={"Voir "+d.name} className="press"
                  style={{flexShrink:0,width:96,border:"none",background:"var(--card)",borderRadius:16,padding:8,cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",gap:6,alignItems:"center"}}>
                  <DocThumb doc={d} size={80}/>
                  <span style={{fontSize:11,color:"var(--ts)",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {(showDone||(entry.next&&!done))&&(
          <div style={{display:"flex",gap:10,padding:"20px 16px 0"}}>
            {showDone&&<button onClick={()=>{onClose();onDone(entry);}} style={{...M3.btn,flex:2,minHeight:52}}><CircleCheck size={20}/>C'est fait</button>}
            {entry.next&&!done&&<button onClick={()=>openExternal(gcalUrl(entry,c))} style={{...M3.tonal,flex:1,minHeight:52,padding:"0 16px"}}><CalendarPlus size={20}/>Agenda</button>}
          </div>
        )}
        <div style={{display:"flex",gap:10,padding:"10px 16px 0"}}>
          <button onClick={()=>{onClose();onEdit(entry.id);}} style={{...M3.outlined,flex:1}}><Edit2 size={18}/>Modifier</button>
          <button onClick={()=>setConfirmDel(true)} style={{...M3.outlined,flex:1,color:"var(--er)"}}><Trash2 size={18}/>Supprimer</button>
        </div>
        {confirmDel&&(
          <div role="alertdialog" style={{margin:"12px 16px 0",padding:16,background:"var(--er-bg)",borderRadius:20,textAlign:"center"}}>
            <p style={{fontSize:14,color:"var(--on-er)",marginBottom:12,fontWeight:500}}>Supprimer définitivement cette entrée ?</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmDel(false)} style={{...M3.outlined,flex:1,color:"var(--on-er)",borderColor:"var(--on-er)"}}>Annuler</button>
              <button onClick={()=>{onDelete(entry.id);onClose();}} style={{...M3.btn,flex:1,background:"var(--er)",color:"var(--bg)"}}>Supprimer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FormStepper ──────────────────────────────────────────────
function FormStepper({allCats,entries=[],editingEntry,editingDocs,prefill,onSave,onCancelEdit}){
  const toast=useToast();
  const isEdit=!!editingEntry;
  // Catégorie par défaut = la 1re visible (avant : "voiture" même si elle avait été supprimée)
  const defaultCat=Object.keys(allCats)[0]||"divers";
  // Source des valeurs initiales : entrée modifiée, ou préremplissage après "C'est fait"
  const src=editingEntry||prefill||{};
  const val=(k,d="")=>src[k]!=null?src[k]:d;
  const[step,setStep]=useState(0);
  const[cat,setCat]=useState(val("cat",defaultCat));
  const[wasEdit,setWasEdit]=useState(false);
  const[title,setTitle]=useState(val("title"));
  const[date,setDate]=useState(val("date",todayStr()));
  const[price,setPrice]=useState(val("price"));
  const[next,setNext]=useState(val("next"));
  const[recur,setRecur]=useState(val("recur"));
  const[who,setWho]=useState(val("who"));
  const[pro,setPro]=useState(val("pro"));
  const[km,setKm]=useState(val("km"));
  const[nextKm,setNextKm]=useState(val("nextKm"));
  const[notes,setNotes]=useState(val("notes"));
  const[pendingDocs,setPendingDocs]=useState(editingDocs||[]);
  const[titleErr,setTitleErr]=useState(false);
  const[done,setDone]=useState(false);
  const pickRef=useRef(),camRef=useRef();
  const fieldsOn=(allCats[cat]?.fields)||{};
  // Suggestions (saisie plus rapide) : titres déjà utilisés dans la catégorie, personnes, intervenants
  const sugg=useMemo(()=>{
    const uniq=a=>[...new Set(a.filter(Boolean).map(x=>x.trim()))].slice(0,30);
    return{titles:uniq(entries.filter(e=>e.cat===cat).map(e=>e.title)),who:uniq(entries.map(e=>e.who)),pro:uniq(entries.filter(e=>e.cat===cat).map(e=>e.pro))};
  },[entries,cat]);
  const lastKm=useMemo(()=>latestKm(entries,cat),[entries,cat]);

  const loadFrom=(e,docsArr)=>{setCat(e.cat||defaultCat);setTitle(e.title||"");setDate(e.date||todayStr());setPrice(e.price!=null?e.price:"");setNext(e.next||"");setRecur(e.recur||"");setWho(e.who||"");setPro(e.pro||"");setKm(e.km||"");setNextKm(e.nextKm||"");setNotes(e.notes||"");setPendingDocs(docsArr||[]);setStep(0);setDone(false);};
  useEffect(()=>{if(editingEntry)loadFrom(editingEntry,editingDocs);},[editingEntry]); // eslint-disable-line
  useEffect(()=>{if(prefill&&!editingEntry)loadFrom(prefill,[]);},[prefill]); // eslint-disable-line

  // Récurrence : "à refaire dans X mois" → la date du prochain RDV se calcule toute seule
  const changeRecur=v=>{setRecur(v);if(v&&date)setNext(addMonths(date,v));};
  const changeDate=v=>{setDate(v);if(recur&&v)setNext(addMonths(v,recur));};

  const handleFiles=useCallback(async files=>{
    for(const f of Array.from(files)){
      if(f.size>MAX_FILE&&!f.type.startsWith("image/")){toast(`"${f.name}" dépasse 4 Mo`,"error");continue;}
      const reader=new FileReader();
      reader.onload=async e=>{
        let url=e.target.result,size=f.size;
        if(f.type.startsWith("image/")){url=await compressImage(url);size=Math.round(url.length*.75);}
        setPendingDocs(p=>[...p,{name:f.name,type:f.type||"",dataUrl:url,size}]);
      };reader.readAsDataURL(f);
    }
    if(pickRef.current)pickRef.current.value="";
    if(camRef.current)camRef.current.value="";
  },[toast]);

  const nextStep=()=>{if(step===0&&!title.trim()){setTitleErr(true);return;}setTitleErr(false);setStep(s=>Math.min(2,s+1));};
  const handleSave=()=>{
    const finalCat=allCats[cat]?cat:defaultCat;
    const f=(allCats[finalCat]?.fields)||{};
    onSave({
      cat:finalCat,title:title.trim(),date,price:price!==""?price:null,next,notes:notes.trim(),
      recur:recur?Number(recur):null,
      who:f.who?who.trim():"",pro:f.pro?pro.trim():"",
      km:f.km&&km!==""?String(km).replace(/\s/g,""):"",
      nextKm:f.km&&nextKm!==""?String(nextKm).replace(/\s/g,""):"",
    },pendingDocs,isEdit);
    setWasEdit(isEdit); // mémorisé : après sauvegarde, isEdit repasse à false
    setDone(true);
    toast(isEdit?"Entrée modifiée !":"Suivi enregistré !","success");
  };
  const reset=()=>{loadFrom({cat:defaultCat},[]);setWasEdit(false);setTitleErr(false);};

  const SI={width:"100%",padding:"10px 12px",fontSize:14,border:"1px solid var(--bs)",borderRadius:10,background:"var(--input)",color:"var(--tp)",outline:"none"};
  const SL=SL_G;
  const STEPS=["Quoi ?","Quand & Prix","Détails"];

  if(done)return(
    <div className="fu" style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{padding:24,background:"var(--ok-bg)",border:"1px solid var(--ok-b)",borderRadius:16,display:"flex",flexDirection:"column",alignItems:"center",gap:12,textAlign:"center"}}>
        <div style={{width:52,height:52,borderRadius:"50%",background:"var(--ok-m)",display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={26} color="#fff"/></div>
        <div style={{fontSize:17,fontWeight:700,color:"var(--ok-t)"}}>{wasEdit?"Entrée modifiée !":"Suivi enregistré !"}</div>
        <div style={{fontSize:13,color:"var(--ok-m)"}}>{title}{price?` · ${fmtPrice(price)}`:""} — {fmt(date)}</div>
      </div>
      <button onClick={()=>window.__goHome?.()}  style={{padding:13,background:"var(--ac)",color:"var(--on-ac)",border:"none",borderRadius:24,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Retour à l'accueil</button>
      <button onClick={reset} style={{padding:11,background:"transparent",color:"var(--tp)",border:"1px solid var(--bs)",borderRadius:24,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Ajouter un autre suivi</button>
    </div>
  );

  return(
    <div style={{paddingTop:14}}>
      {isEdit&&(
        <div style={{margin:"0 16px 14px",padding:"10px 14px",background:"var(--al)",border:"1px solid var(--ac)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:13,fontWeight:600,color:"var(--ac)"}}>✏️ Mode modification</span>
          <button onClick={onCancelEdit} style={{background:"none",border:"none",color:"var(--ac)",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Annuler</button>
        </div>
      )}
      {/* Barre de progression */}
      <div style={{display:"flex",alignItems:"center",padding:"0 16px",marginBottom:20,gap:8}}>
        {STEPS.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,flex:i<2?1:"auto"}}>
            <div onClick={()=>i<step&&setStep(i)} style={{width:28,height:28,borderRadius:"50%",background:i===step?"var(--ac)":i<step?"var(--ok-m)":"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:i<step?"pointer":"default",transition:"background .2s"}}>
              {i<step?<Check size={14} color="#fff"/>:<span style={{fontSize:12,fontWeight:600,color:i===step?"#fff":"var(--ts)"}}>{i+1}</span>}
            </div>
            <span style={{fontSize:12,fontWeight:500,color:i===step?"var(--ac)":"var(--ts)",whiteSpace:"nowrap"}}>{s}</span>
            {i<2&&<div style={{flex:1,height:2,borderRadius:1,background:i<step?"var(--ok-m)":"var(--b)",transition:"background .3s",minWidth:8}}/>}
          </div>
        ))}
      </div>

      {step===0&&<div className="fu">
        <div style={{padding:"0 16px",marginBottom:16}}>
          <label style={SL}>Catégorie</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {Object.entries(allCats).map(([k,c])=>(
              <div key={k} onClick={()=>setCat(k)} style={{padding:"10px 12px",borderRadius:12,border:`2px solid ${cat===k?"var(--ac)":"var(--b)"}`,background:cat===k?"var(--al)":"var(--card)",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all .15s"}}>
                <div style={{width:28,height:28,borderRadius:7,background:tint(c),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CatIcon cat={c} size={14}/></div>
                <span style={{fontSize:12,fontWeight:600,color:cat===k?"var(--ac)":"var(--tp)"}}>{c.short}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{padding:"0 16px",marginBottom:16}}>
          <label style={SL}>Titre / Objet</label>
          <input value={title} list="dl-titles" onChange={e=>{setTitle(e.target.value);setTitleErr(false);}} placeholder="ex: Vidange, Vaccination, Gastro…" style={{...SI,borderColor:titleErr?"var(--er)":"var(--bs)"}} autoFocus/>
          <datalist id="dl-titles">{sugg.titles.map(t=><option key={t} value={t}/>)}</datalist>
          {titleErr&&<div style={{fontSize:12,color:"var(--er)",marginTop:4}}>Ce champ est obligatoire.</div>}
        </div>
        {fieldsOn.who&&(
          <div style={{padding:"0 16px",marginBottom:16}}>
            <label style={SL}>Pour qui / animal (optionnel)</label>
            <input value={who} list="dl-who" onChange={e=>setWho(e.target.value)} placeholder="ex: Félix, Anaëlle…" style={SI}/>
            <datalist id="dl-who">{sugg.who.map(t=><option key={t} value={t}/>)}</datalist>
          </div>
        )}
      </div>}

      {step===1&&<div className="fu">
        <div style={{padding:"0 16px",marginBottom:14}}>
          <label style={SL}>Date</label>
          <input type="date" value={date} onChange={e=>changeDate(e.target.value)} style={SI}/>
        </div>
        <div style={{padding:"0 16px",marginBottom:14}}>
          <label style={SL}>Prix (optionnel)</label>
          <div style={{display:"flex"}}>
            <input type="number" inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} min={0} step="0.01" placeholder="0.00" style={{...SI,borderRight:"none",borderRadius:"10px 0 0 10px"}}/>
            <div style={{padding:"10px 12px",fontSize:14,background:"var(--muted)",border:"1px solid var(--bs)",borderRadius:"0 10px 10px 0",color:"var(--ts)"}}>€</div>
          </div>
        </div>
        {fieldsOn.km&&(
          <div style={{padding:"0 16px",marginBottom:14}}>
            <label style={SL}>Kilométrage au compteur (optionnel)</label>
            <div style={{display:"flex"}}>
              <input type="number" inputMode="numeric" value={km} onChange={e=>setKm(e.target.value)} min={0} placeholder={lastKm?`dernier relevé : ${lastKm}`:"ex: 84500"} style={{...SI,borderRight:"none",borderRadius:"10px 0 0 10px"}}/>
              <div style={{padding:"10px 12px",fontSize:14,background:"var(--muted)",border:"1px solid var(--bs)",borderRadius:"0 10px 10px 0",color:"var(--ts)"}}>km</div>
            </div>
          </div>
        )}
        <div style={{padding:"0 16px",marginBottom:14}}>
          <label style={SL}>À refaire dans</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {RECUR_OPTS.map(o=>{
              const on=String(recur||"")===String(o.v);
              return<button key={o.l} type="button" onClick={()=>changeRecur(o.v)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:600,border:`1.5px solid ${on?"var(--ac)":"var(--bs)"}`,background:on?"var(--al)":"var(--card)",color:on?"var(--ac)":"var(--ts)",cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>;
            })}
          </div>
          {recur?<div style={{fontSize:11,color:"var(--ts)",marginTop:6}}>🔁 Prochain RDV calculé automatiquement (modifiable ci-dessous)</div>:null}
        </div>
        <div style={{padding:"0 16px",marginBottom:14}}>
          <label style={SL}>Prochain rendez-vous (optionnel)</label>
          <div style={{display:"flex",gap:6}}>
            <input type="date" value={next} onChange={e=>setNext(e.target.value)} style={SI}/>
            {next&&<button type="button" onClick={()=>{setNext("");setRecur("");}} style={{padding:"0 12px",background:"var(--muted)",border:"1px solid var(--bs)",borderRadius:10,color:"var(--ts)",cursor:"pointer"}}><X size={14}/></button>}
          </div>
        </div>
        {fieldsOn.km&&(
          <div style={{padding:"0 16px",marginBottom:14}}>
            <label style={SL}>Prochaine échéance kilométrique (optionnel)</label>
            <div style={{display:"flex"}}>
              <input type="number" inputMode="numeric" value={nextKm} onChange={e=>setNextKm(e.target.value)} min={0} placeholder="ex: 99500" style={{...SI,borderRight:"none",borderRadius:"10px 0 0 10px"}}/>
              <div style={{padding:"10px 12px",fontSize:14,background:"var(--muted)",border:"1px solid var(--bs)",borderRadius:"0 10px 10px 0",color:"var(--ts)"}}>km</div>
            </div>
            {km&&<div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
              {[10000,15000,20000,30000].map(d=><button key={d} type="button" onClick={()=>setNextKm(String(Number(km)+d))} style={{padding:"4px 10px",borderRadius:20,fontSize:11,border:"1px solid var(--bs)",background:"var(--card)",color:"var(--ts)",cursor:"pointer",fontFamily:"inherit"}}>+{(d/1000)} 000 km</button>)}
            </div>}
          </div>
        )}
      </div>}

      {step===2&&<div className="fu">
        {fieldsOn.pro&&(
          <div style={{padding:"0 16px",marginBottom:14}}>
            <label style={SL}>Praticien / intervenant (optionnel)</label>
            <input value={pro} list="dl-pro" onChange={e=>setPro(e.target.value)} placeholder="ex: Dr Martin, Garage Dupont…" style={SI}/>
            <datalist id="dl-pro">{sugg.pro.map(t=><option key={t} value={t}/>)}</datalist>
          </div>
        )}
        <div style={{padding:"0 16px",marginBottom:14}}>
          <label style={SL}>Notes</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Détails, observations, montant…" style={{...SI,minHeight:80,resize:"none"}}/>
        </div>
        <div style={{padding:"0 16px",marginBottom:14}}>
          <label style={SL}>Documents</label>
          <div style={{display:"flex",gap:10,marginTop:6}}>
            {[{ref:pickRef,accept:"image/*,application/pdf,.pdf",multi:true,Icon:FileText,label:"Fichier"},{ref:camRef,accept:"image/*",Icon:Camera,label:"Photo"}].map((b,i)=>(
              <button key={i} onClick={()=>b.ref.current?.click()} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"12px 8px",background:"var(--card)",border:"1.5px dashed var(--bs)",borderRadius:10,cursor:"pointer",fontSize:13,fontWeight:500,color:"var(--ts)",fontFamily:"inherit"}}>
                <b.Icon size={16}/>{b.label}
              </button>
            ))}
            <input ref={pickRef} type="file" style={{display:"none"}} accept="image/*,application/pdf,.pdf" multiple onChange={e=>handleFiles(e.target.files)}/>
            <input ref={camRef} type="file" style={{display:"none"}} accept="image/*" capture="environment" onChange={e=>handleFiles(e.target.files)}/>
          </div>
          {pendingDocs.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:7,marginTop:10}}>
              {pendingDocs.map((d,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"var(--muted)",border:"none",borderRadius:10,padding:"8px 10px"}}>
                  <DocThumb doc={d} size={40}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--tp)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
                    <div style={{fontSize:11,color:"var(--ts)",marginTop:2}}>{fmtBytes(d.size)}</div>
                  </div>
                  <button onClick={()=>setPendingDocs(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"var(--th)",padding:"0 4px",lineHeight:1}}><X size={18}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}

      <div style={{padding:"0 16px",display:"flex",gap:10}}>
        {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,padding:"12px",background:"var(--muted)",color:"var(--tp)",border:"1px solid var(--bs)",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><ChevronLeft size={16}/>Retour</button>}
        {step<2
          ?<button onClick={nextStep} style={{flex:2,padding:"12px",background:"var(--ac)",color:"var(--on-ac)",border:"none",borderRadius:10,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>Suivant<ArrowRight size={16}/></button>
          :<button onClick={handleSave} style={{flex:2,padding:"12px",background:"var(--ac)",color:"var(--on-ac)",border:"none",borderRadius:10,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Check size={16}/>{isEdit?"Enregistrer":"Ajouter"}</button>
        }
      </div>
    </div>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────
// Carte "À suivre" Material 3 : conteneur tonal (rouge = retard, couleur principale = bientôt, neutre sinon)
function ReminderCard({r,cat,onClick}){
  const{e}=r;
  const bg=r.overdue?"var(--er-bg)":r.soon?"var(--al)":"var(--sc)";
  const fg=r.overdue?"var(--on-er)":r.soon?"var(--on-al)":"var(--on-sc)";
  const when=r.kind==="km"
    ?(r.overdue?`Dépassé de ${fmtKm(r.cur-r.target)}`:`Dans ${fmtKm(r.target-r.cur)}`)
    :(r.days<0?`En retard de ${-r.days} j`:r.days===0?"Aujourd'hui":r.days===1?"Demain":`Dans ${r.days} j`);
  return(
    <button onClick={onClick} className="press" aria-label={`${e.title}, ${when}`}
      style={{flexShrink:0,width:168,height:148,borderRadius:28,border:"none",background:bg,color:fg,padding:16,display:"flex",flexDirection:"column",alignItems:"flex-start",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
      <div style={{display:"flex",width:"100%",justifyContent:"space-between",alignItems:"center"}}>
        <CatIcon cat={cat} size={24} color="currentColor"/>
        {r.overdue&&<TriangleAlert size={18}/>}
        {!r.overdue&&r.kind==="km"&&<Gauge size={18}/>}
        {!r.overdue&&r.kind!=="km"&&e.recur&&<Repeat size={16}/>}
      </div>
      <div style={{flex:1}}/>
      <div style={{fontSize:13,fontWeight:500,opacity:.9}}>{when}</div>
      <div style={{fontSize:18,fontWeight:600,marginTop:2,lineHeight:1.2,width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
      {e.who&&<div style={{fontSize:12,opacity:.85,marginTop:1}}>{e.who}</div>}
    </button>
  );
}

function HomeScreen({entries,docs,allCats,lookup,reminders=[],onFilterHistory,onOpenModal,onViewDoc,onSearch}){
  const recent=[...entries].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).slice(0,4);
  const L=lookup||allCats;
  return(
    <div className="fu">
      <div style={{padding:"20px 16px 6px"}}>
        <h1 style={{...M3.title,fontSize:30,margin:"0 0 14px 4px"}}>{APP_NAME}</h1>
        <button onClick={onSearch} className="press"
          style={{width:"100%",height:56,borderRadius:28,border:"none",background:"var(--card)",color:"var(--ts)",display:"flex",alignItems:"center",gap:14,padding:"0 18px",fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>
          <Search size={22}/>
          <span style={{flex:1,textAlign:"left"}}>Rechercher un suivi</span>
          <span style={{fontSize:13}}>{entries.length}</span>
        </button>
      </div>

      {reminders.length>0&&<>
        <div style={{...M3.section}}>À suivre · {reminders.length}</div>
        <div className="hscroll" style={{gap:10,padding:"0 16px",scrollPadding:"0 16px"}}>
          {reminders.map((r,i)=><ReminderCard key={r.e.id+"-"+r.kind+i} r={r} cat={L[r.e.cat]||UNKNOWN_CAT} onClick={()=>onOpenModal(r.e)}/>)}
        </div>
      </>}

      <div style={{...M3.section,paddingTop:22}}>Catégories</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:10,padding:"0 16px"}}>
        {Object.entries(allCats).map(([k,c])=>{
          const cnt=entries.filter(e=>e.cat===k).length;
          return(
            <button key={k} onClick={()=>onFilterHistory(k)} className="press"
              style={{height:92,borderRadius:24,border:"none",background:"var(--card)",color:"var(--tp)",padding:"14px 16px",display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"space-between",textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{width:36,height:36,borderRadius:12,background:tint(c),display:"flex",alignItems:"center",justifyContent:"center"}}><CatIcon cat={c} size={20}/></span>
              <span style={{display:"flex",width:"100%",justifyContent:"space-between",alignItems:"baseline",gap:6}}>
                <span style={{fontSize:15,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.short}</span>
                <span style={{fontSize:13,color:"var(--ts)"}}>{cnt}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{...M3.section,paddingTop:22}}>Récent</div>
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
        {recent.length?recent.map(e=>(<EntryCard key={e.id} entry={e} entryDocs={docs[e.id]||[]} allCats={L} clickable={true} onClick={()=>onOpenModal(e)} onViewDoc={onViewDoc}/>))
          :<EmptyState icon={Tag} title="Aucun suivi pour l'instant" sub="Appuie sur « Nouveau suivi » pour créer le premier."/>}
      </div>
      <div style={{height:8}}/>
    </div>
  );
}

// ─── HistoryScreen ────────────────────────────────────────────
function HistoryScreen({entries,docs,allCats,lookup,filter,setFilter,onOpenModal,onViewDoc,focusSearch}){
  const{q,setQ,results}=useSearch(entries,lookup||allCats);
  if(filter!=="all"&&!allCats[filter])filter="all"; // filtre sur une catégorie supprimée → "Tous"
  const display=q?results:(filter==="all"?entries:entries.filter(e=>e.cat===filter));
  const sorted=[...display].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  // Regroupement par mois (en-têtes de liste Material)
  const groups=[];
  for(const e of sorted){
    const key=e.date.slice(0,7);
    if(!groups.length||groups[groups.length-1].key!==key){
      const lbl=parseLocal(e.date).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
      groups.push({key,label:lbl.charAt(0).toUpperCase()+lbl.slice(1),items:[]});
    }
    groups[groups.length-1].items.push(e);
  }
  const chip=on=>({display:"inline-flex",alignItems:"center",gap:6,height:32,padding:on?"0 14px 0 10px":"0 14px",borderRadius:8,fontSize:14,fontWeight:500,border:on?"none":"1px solid var(--bs)",background:on?"var(--sc)":"transparent",color:on?"var(--on-sc)":"var(--ts)",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",flexShrink:0});
  return(
    <div>
      <div style={{...M3.header,paddingBottom:12}}>
        <h1 style={{...M3.title,marginBottom:12}}>Historique</h1>
        <div style={{display:"flex",alignItems:"center",gap:14,height:56,borderRadius:28,background:"var(--card)",padding:"0 8px 0 18px"}}>
          <Search size={22} color="var(--ts)"/>
          <input value={q} onChange={e=>setQ(e.target.value)} autoFocus={!!focusSearch} aria-label="Rechercher un suivi" placeholder="Titre, personne, garage, note…"
            style={{flex:1,minWidth:0,border:"none",background:"transparent",fontSize:16,color:"var(--tp)",boxShadow:"none"}}/>
          {q&&<button aria-label="Effacer la recherche" onClick={()=>setQ("")} style={{width:44,height:44,borderRadius:22,background:"none",border:"none",cursor:"pointer",color:"var(--ts)",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={20}/></button>}
        </div>
      </div>
      {!q&&(
        <div className="hscroll" style={{gap:8,padding:"4px 16px 8px"}}>
          {[{k:"all",l:"Tous"},...Object.entries(allCats).map(([k,c])=>({k,l:c.short}))].map(f=>{
            const on=filter===f.k;
            return<button key={f.k} onClick={()=>setFilter(f.k)} aria-pressed={on} style={chip(on)}>{on&&<Check size={16}/>}{f.l}</button>;
          })}
        </div>
      )}
      {groups.length?groups.map(g=>(
        <div key={g.key}>
          <div style={{fontSize:14,fontWeight:600,color:"var(--ts)",padding:"14px 20px 8px"}}>{g.label}</div>
          <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
            {g.items.map(e=>(
              <EntryCard key={e.id} entry={e} entryDocs={docs[e.id]||[]} allCats={lookup||allCats} clickable={true} onClick={()=>onOpenModal(e)} onViewDoc={onViewDoc}/>
            ))}
          </div>
        </div>
      )):<EmptyState icon={Search} title={q?"Aucun résultat":"Aucune entrée"} sub={q?`Aucune entrée ne correspond à "${q}".`:"Essaie une autre catégorie."}/>}
      <div style={{height:8}}/>
    </div>
  );
}

// ─── RapportScreen ────────────────────────────────────────────
function RapportScreen({entries:allEntries,allCats,lookup,onExportCSV}){
  const years=useMemo(()=>[...new Set(allEntries.map(e=>e.date.slice(0,4)))].sort().reverse(),[allEntries]);
  const[period,setPeriod]=useState(()=>String(new Date().getFullYear()));
  const[exporting,setExporting]=useState(false);
  const[selMonth,setSelMonth]=useState(null);
  const periods=["12m",...years.filter(y=>y!=="12m")];
  if(!periods.includes(period))periods.splice(1,0,period);
  const entries=useMemo(()=>allEntries.filter(e=>inPeriod(e,period)),[allEntries,period]);
  const monthly=useMemo(()=>getMonthlyData(allEntries,period),[allEntries,period]);
  const wp=entries.filter(e=>e.price!=null&&!isNaN(parseFloat(e.price)));
  const tot=wp.reduce((s,e)=>s+parseFloat(e.price),0);
  const prevYear=period!=="12m"?String(Number(period)-1):null;
  const totPrev=prevYear?allEntries.filter(e=>e.date.startsWith(prevYear)&&e.price!=null&&!isNaN(parseFloat(e.price))).reduce((s,e)=>s+parseFloat(e.price),0):null;
  // On part des catégories réellement utilisées (y compris supprimées) → la somme des catégories = le total
  const usedKeys=[...new Set(entries.map(e=>e.cat))];
  const catData=usedKeys.map(k=>{
    const c=(lookup||allCats)[k]||UNKNOWN_CAT;
    const ces=entries.filter(e=>e.cat===k);
    const cwp=ces.filter(e=>e.price!=null&&!isNaN(parseFloat(e.price)));
    return{k,c,ces,cwp,sum:cwp.reduce((s,e)=>s+parseFloat(e.price),0)};
  }).sort((a,b)=>b.sum-a.sum);
  const mx=Math.max(...catData.map(d=>d.sum),1);
  const mmx=Math.max(...monthly.map(m=>m.total),1);
  const eur=n=>Math.round(n).toLocaleString("fr-FR")+"\u202f€";
  const eurC=n=>n.toFixed(2).replace(".",",")+"\u202f€";
  const nowIdx=period==="12m"?11:(Number(period)===new Date().getFullYear()?new Date().getMonth():-1);
  const sel=selMonth!=null?monthly[selMonth]:null;
  const periodLabel=period==="12m"?"les 12 derniers mois":"en "+period;
  const evo=totPrev!=null&&totPrev>0?Math.round((tot-totPrev)/totPrev*100):null;
  return(
    <div className="fu">
      <div style={{...M3.header,paddingBottom:12}}>
        <h1 style={M3.title}>Rapport</h1>
      </div>
      {allEntries.length===0?<EmptyState icon={BarChart2} title="Aucune donnée" sub="Ajoute des suivis pour voir ton rapport."/>:<>
        {/* Bouton segmenté Material 3 (défile si beaucoup d'années) */}
        <div className="hscroll" style={{margin:"0 16px",border:"1px solid var(--bs)",borderRadius:20}}>
          {periods.map((p,i)=>{
            const on=period===p;
            return<button key={p} onClick={()=>{setPeriod(p);setSelMonth(null);}} aria-pressed={on}
              style={{flex:"1 0 auto",minWidth:84,height:40,border:"none",borderLeft:i?"1px solid var(--bs)":"none",background:on?"var(--sc)":"transparent",color:on?"var(--on-sc)":"var(--tp)",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,cursor:"pointer",fontFamily:"inherit"}}>
              {on&&<Check size={16}/>}{p==="12m"?"12 mois":p}
            </button>;
          })}
        </div>

        <div style={{...M3.card,borderRadius:28,margin:"16px 16px 0",padding:"18px 18px 16px"}}>
          <div style={{fontSize:14,color:"var(--ts)"}}>Dépensé {periodLabel}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:10,marginTop:4,flexWrap:"wrap"}}>
            <div style={{fontSize:40,fontWeight:600,letterSpacing:"-.01em",color:"var(--tp)"}}>{eur(tot)}</div>
            {evo!=null&&<span style={{fontSize:13,fontWeight:600,padding:"4px 10px",borderRadius:8,background:"var(--sc)",color:"var(--on-sc)"}}>{evo>=0?"+":""}{evo} % vs {prevYear}</span>}
          </div>
          <div style={{fontSize:13,color:"var(--ts)",marginTop:2}}>{entries.length} entrée{entries.length>1?"s":""} · {wp.length} avec prix</div>
          {/* Barres mensuelles : appuie sur une barre pour voir le détail du mois */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(12, minmax(0, 1fr))",gap:5,alignItems:"end",height:132,marginTop:16}}>
            {monthly.map((m,i)=>{
              const on=selMonth===i;
              const h=m.total?Math.max(6,Math.round(m.total/mmx*100)):3;
              return(
                <button key={i} onClick={()=>setSelMonth(on?null:i)} aria-label={`${m.label} : ${eurC(m.total)}`}
                  style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:6,height:"100%",background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{width:"100%",height:h,borderRadius:"6px 6px 3px 3px",background:on||i===nowIdx?"var(--ac)":m.total?"color-mix(in srgb, var(--ac) 45%, var(--muted))":"var(--muted)",transition:"background .15s"}}/>
                  <div style={{fontSize:10,color:on?"var(--tp)":"var(--ts)",fontWeight:on?700:400,textTransform:"capitalize"}}>{m.label.charAt(0)}</div>
                </button>
              );
            })}
          </div>
          <div style={{minHeight:20,marginTop:10,fontSize:13,color:"var(--ts)"}}>
            {sel?<><b style={{color:"var(--tp)",textTransform:"capitalize"}}>{sel.label}</b> · {eurC(sel.total)} · {sel.count} entrée{sel.count>1?"s":""}</>:"Appuie sur une barre pour le détail du mois"}
          </div>
        </div>

        <div style={{...M3.section}}>Par catégorie</div>
        <div style={{...M3.card,borderRadius:28,margin:"0 16px",padding:"6px 0"}}>
          {catData.length===0&&<div style={{fontSize:14,color:"var(--ts)",padding:"14px 18px"}}>Aucune entrée sur cette période.</div>}
          {catData.map(d=>(
            <div key={d.k} style={{padding:"10px 18px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{width:32,height:32,borderRadius:10,background:tint(d.c),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CatIcon cat={d.c} size={16}/></span>
                <span style={{flex:1,fontSize:15,fontWeight:600,color:"var(--tp)"}}>{d.c.short}</span>
                <span style={{fontSize:15,color:"var(--ts)"}}>{d.sum>0?eur(d.sum):"—"}</span>
              </div>
              <div style={{height:6,borderRadius:3,background:"var(--muted)",margin:"8px 0 0 44px",overflow:"hidden"}}>
                <div style={{width:`${Math.round(d.sum/mx*100)}%`,height:"100%",borderRadius:3,background:toneFg(d.c),transition:"width .5s ease"}}/>
              </div>
              <div style={{fontSize:12,color:"var(--ts)",margin:"6px 0 0 44px"}}>{d.ces.length} entrée{d.ces.length>1?"s":""}{tot>0&&d.sum>0?` · ${Math.round(d.sum/tot*100)} %`:""}</div>
            </div>
          ))}
        </div>

        <div style={{padding:"16px 16px 0"}}>
          <button disabled={exporting||!entries.length} onClick={async()=>{setExporting(true);await onExportCSV(entries,period);setExporting(false);}}
            style={{...M3.tonal,width:"100%",opacity:exporting||!entries.length?.5:1}}>
            <FileSpreadsheet size={20}/>{exporting?"Export…":`Exporter ${period==="12m"?"12 mois":period} en tableur`}
          </button>
        </div>
        <div style={{height:12}}/>
      </>}
    </div>
  );
}

// ─── CategoryModal ────────────────────────────────────────────
// Extrait le 1er emoji d'un texte tapé au clavier (gère 👨‍👩‍👧, 🏳️‍🌈, drapeaux, couleurs de peau…)
function firstEmoji(str){
  if(!str)return null;
  const parts=typeof Intl!=="undefined"&&Intl.Segmenter
    ?[...new Intl.Segmenter("fr",{granularity:"grapheme"}).segment(str)].map(s=>s.segment)
    :Array.from(str);
  return parts.find(g=>/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g))||null;
}

function CategoryModal({initial,onSave,onClose}){
  const[name,setName]           =useState(initial?.name||"");
  const[color,setColor]         =useState(initial?.dot||COLOR_OPTS[0].dot);
  // emoji = null → on garde l'icône dessinée d'origine (catégories par défaut)
  const[emoji,setEmoji]         =useState(initial?initial.emoji||null:"📋");
  const[emojiSearch,setEmojiSearch]=useState("");
  const[nameErr,setNameErr]     =useState(false);
  const[fields,setFields]       =useState(initial?.fields||{});
  const hasOriginalIcon=!!initial?.iconKey;

  // Recherche par famille ("animaux", "sante"…) — avant, la recherche ne trouvait jamais rien
  const filteredCats=useMemo(()=>{
    const q=norm(emojiSearch.trim());
    if(!q)return EMOJI_CATS;
    return EMOJI_CATS.filter(c=>norm(c.label).includes(q));
  },[emojiSearch]);

  const onSearchChange=v=>{
    const e=firstEmoji(v);
    if(e){setEmoji(e);setEmojiSearch("");return;} // emoji tapé au clavier → sélectionné directement
    setEmojiSearch(v);
  };

  const handleSave=()=>{
    const n=name.trim();
    if(!n){setNameErr(true);return;}
    const short=n.length>12?n.substring(0,12)+"…":n;
    onSave({name:n,short,dot:color,bg:color+"22",color,emoji:emoji||undefined,fields});
  };
  const previewCat={dot:color,color,emoji,iconKey:initial?.iconKey,label:name};

  const SI2={width:"100%",padding:"10px 12px",fontSize:14,border:"1px solid var(--bs)",borderRadius:10,background:"var(--input)",color:"var(--tp)",outline:"none",fontFamily:"inherit"};

  return(
    <div className="fi" style={{position:"fixed",inset:0,background:"var(--scrim)",zIndex:1500,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="su" role="dialog" aria-modal="true" style={{background:"var(--sheet)",borderRadius:"28px 28px 0 0",width:"100%",maxWidth:520,maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>

        {/* En-tête avec preview */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px 14px",borderBottom:"1px solid var(--b)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,background:color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0,transition:"background .2s"}}><CatIcon cat={previewCat} size={22}/></div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:"var(--tp)"}}>{initial?"Modifier la catégorie":"Nouvelle catégorie"}</div>
              <div style={{fontSize:12,color:"var(--ts)",marginTop:1}}>{name||"Aperçu du nom"}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"var(--muted)",border:"none",cursor:"pointer",color:"var(--ts)",borderRadius:"50%",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <X size={16}/>
          </button>
        </div>

        {/* Corps scrollable */}
        <div style={{overflowY:"auto",flex:1,padding:"16px 20px 8px"}}>

          {/* Nom */}
          <label style={SL_G}>Nom</label>
          <input value={name} onChange={e=>{setName(e.target.value);setNameErr(false);}}
            placeholder="ex: Sport, Jardinage, Administratif…" maxLength={24}
            style={{...SI2,borderColor:nameErr?"var(--er)":"var(--bs)",marginBottom:nameErr?4:18}}
            autoFocus/>
          {nameErr&&<div style={{fontSize:12,color:"var(--er)",marginBottom:14}}>Le nom est obligatoire.</div>}

          {/* Couleur */}
          <label style={SL_G}>Couleur</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:9,marginBottom:10,alignItems:"center"}}>
            {COLOR_OPTS.map((c,i)=>(
              <div key={i} onClick={()=>setColor(c.dot)} style={{width:32,height:32,borderRadius:"50%",background:c.dot,cursor:"pointer",border:color===c.dot?"3px solid var(--tp)":"3px solid transparent",transform:color===c.dot?"scale(1.15)":"none",transition:"transform .12s,border .12s",flexShrink:0}}/>
            ))}
            {/* Picker couleur libre : le vrai champ couleur est posé (invisible) SUR le rond,
                le doigt le touche directement → plus fiable qu'un clic simulé sous Android */}
            <label title="Couleur personnalisée"
              style={{width:32,height:32,borderRadius:"50%",cursor:"pointer",border:COLOR_OPTS.some(c=>c.dot===color)?"2px solid var(--bs)":"3px solid var(--tp)",flexShrink:0,overflow:"hidden",background:"conic-gradient(from 0deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:13,pointerEvents:"none",color:"#fff",textShadow:"0 0 3px #000"}}>＋</span>
              <input type="color" value={color} onChange={e=>setColor(e.target.value)}
                style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0,cursor:"pointer",border:"none",padding:0}}/>
            </label>
          </div>
          {/* Indicateur couleur active */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18,padding:"7px 12px",background:"var(--muted)",borderRadius:9,width:"fit-content"}}>
            <div style={{width:18,height:18,borderRadius:"50%",background:color,flexShrink:0,border:"none"}}/>
            <span style={{fontSize:12,color:"var(--ts)",fontFamily:"monospace"}}>{color.toUpperCase()}</span>
          </div>

          {/* Champs supplémentaires */}
          <label style={SL_G}>Champs supplémentaires</label>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
            {EXTRA_FIELDS.map(f=>(
              <div key={f.k} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--muted)",borderRadius:10,border:"none"}}>
                <f.Icon size={16} color="var(--ts)"/>
                <div style={{flex:1,fontSize:13,color:"var(--tp)"}}>{f.label}</div>
                <Toggle checked={!!fields[f.k]} onChange={v=>setFields(p=>({...p,[f.k]:v}))}/>
              </div>
            ))}
          </div>

          {/* Emoji */}
          <label style={SL_G}>Emoji</label>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"var(--muted)",borderRadius:10,padding:"8px 12px",marginBottom:6,border:"none"}}>
            <Search size={14} color="var(--ts)"/>
            <input value={emojiSearch} onChange={e=>onSearchChange(e.target.value)}
              placeholder="Famille (ex: animaux) ou tape un emoji"
              style={{flex:1,minWidth:0,border:"none",background:"transparent",fontSize:14,color:"var(--tp)",outline:"none",fontFamily:"inherit"}}/>
            {emojiSearch&&<button onClick={()=>setEmojiSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ts)",display:"flex",padding:0}}><X size={13}/></button>}
          </div>
          <div style={{fontSize:11,color:"var(--ts)",marginBottom:12,lineHeight:1.5}}>
            Astuce : ouvre le clavier emoji 😀 de ton téléphone dans ce champ pour choisir <b>n'importe quel</b> emoji.
          </div>
          {hasOriginalIcon&&(
            <button onClick={()=>setEmoji(null)}
              style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,padding:"7px 12px",borderRadius:10,background:emoji===null?color+"22":"var(--muted)",border:emoji===null?`2px solid ${color}`:"1.5px solid var(--b)",color:"var(--tp)",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
              <CatIcon cat={{...previewCat,emoji:null}} size={18}/>Icône d'origine
            </button>
          )}
          {filteredCats.length===0&&<div style={{fontSize:13,color:"var(--ts)",marginBottom:16,paddingLeft:2}}>Aucune famille ne correspond. Tape directement un emoji au clavier.</div>}
          {filteredCats.map(cat=>(
            <div key={cat.label} style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--ts)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:7}}>{cat.label}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {cat.emojis.map(e=>(
                  <button key={e} onClick={()=>setEmoji(e)}
                    style={{width:38,height:38,borderRadius:10,background:emoji===e?color+"22":"var(--muted)",border:emoji===e?`2px solid ${color}`:"1.5px solid var(--b)",cursor:"pointer",fontSize:19,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .1s",flexShrink:0}}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{height:4}}/>
        </div>

        {/* Pied de page */}
        <div style={{padding:"12px 20px 28px",borderTop:"1px solid var(--b)",flexShrink:0,display:"flex",gap:10,background:"var(--card)"}}>
          <button onClick={onClose} style={{flex:1,padding:12,background:"var(--muted)",color:"var(--tp)",border:"1px solid var(--bs)",borderRadius:24,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
          <button onClick={handleSave} style={{flex:2,padding:12,background:"var(--ac)",color:"var(--on-ac)",border:"none",borderRadius:24,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <Check size={16}/>{initial?"Enregistrer":"Créer la catégorie"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SettingsScreen ───────────────────────────────────────────
function SettingsScreen({darkMode,setDarkMode,accent,setAccent,customCats,setCustomCats,entries,onExport,onImport,notifications,lockEnabled,setLockEnabled}){
  const toast=useToast();
  const importRef=useRef();
  const[importMsg,setImportMsg]=useState(null);
  const[exporting,setExporting]=useState(false);
  // modal: null | {mode:"create"} | {mode:"edit",key,cat}
  const[catModal,setCatModal]=useState(null);

  const merged=useMemo(()=>mergeCats(customCats),[customCats]);
  const allMerged=useMemo(()=>Object.entries(merged).filter(([,c])=>!c.hidden),[merged]);
  const hiddenCats=useMemo(()=>Object.entries(merged).filter(([,c])=>c.hidden),[merged]);
  const restoreCat=k=>{setCustomCats(p=>{const c={...(p[k]||{})};delete c.hidden;return{...p,[k]:c};});toast("Catégorie restaurée","success");};

  // Verrouillage par empreinte
  const[bioOk,setBioOk]=useState(null);
  useEffect(()=>{window.__biometric?.available().then(setBioOk).catch(()=>setBioOk(false));},[]);
  const toggleLock=async v=>{
    if(v){
      // On vérifie que l'empreinte fonctionne AVANT d'activer (sinon risque de se bloquer dehors)
      const ok=await window.__biometric?.authenticate();
      if(!ok){toast("Vérification annulée : verrouillage non activé","error");return;}
    }
    setLockEnabled(v);
    toast(v?"Verrouillage activé":"Verrouillage désactivé",v?"success":"info");
  };

  const handleSaveCat=({name,short,dot,bg,color,emoji,fields})=>{
    if(catModal.mode==="create"){
      const k="c_"+Date.now();
      setCustomCats(p=>({...p,[k]:{label:name,short,dot,bg,color,emoji,fields}}));
      toast("Catégorie créée !","success");
    }else{
      const k=catModal.key;
      const base=BASE_CATS[k];
      setCustomCats(p=>({...p,[k]:{...(base||p[k]),label:name,short,dot,bg,color,emoji,fields,...(base?{base:true}:{})}}));
      toast("Catégorie modifiée !","success");
    }
    setCatModal(null);
  };

  const delCat=k=>{
    const label=merged[k]?.label;
    const n=entries.filter(e=>e.cat===k).length;
    const warn=n?`\n\nSes ${n} entrée${n>1?"s":""} ${n>1?"sont conservées":"est conservée"} (visible${n>1?"s":""} dans Historique > Tous).`:"";
    if(!confirm(`Supprimer la catégorie "${label}" ?${warn}`))return;
    // Masquée (et non effacée) : ses entrées gardent leur nom, et on peut la restaurer
    setCustomCats(p=>({...p,[k]:{...(p[k]||{}),hidden:true}}));
    toast("Catégorie supprimée","info");
  };

  return(
    <div className="fu">
      <div style={{...M3.header}}>
        <h1 style={M3.title}>Réglages</h1>
        <p style={{fontSize:13,color:"var(--ts)",marginTop:2}}>v{APP_VERSION}</p>
      </div>

      {/* Affichage */}
      <div style={{...M3.section}}>Affichage</div>
      <div style={{margin:"0 16px 20px",background:"var(--card)",border:"none",borderRadius:20,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px"}}>
          <div><div style={{fontSize:14,fontWeight:500,color:"var(--tp)"}}>Mode sombre</div><div style={{fontSize:12,color:"var(--ts)",marginTop:2}}>Thème sombre pour l'interface</div></div>
          <Toggle label="Mode sombre" checked={!!darkMode} onChange={v=>setDarkMode(v)}/>
        </div>
        <div style={{padding:"4px 16px 16px"}}>
          <div style={{fontSize:14,fontWeight:500,color:"var(--tp)",marginBottom:10}}>Couleur principale</div>
          <div role="radiogroup" aria-label="Couleur principale" style={{display:"flex",gap:14}}>
            {ACCENTS.map(a=>{
              const on=(accent||"bleu")===a.k;
              return(
                <button key={a.k} role="radio" aria-checked={on} aria-label={a.label} onClick={()=>setAccent(a.k)} className="press"
                  style={{width:48,height:48,borderRadius:16,border:on?"3px solid var(--tp)":"3px solid transparent",background:a.sw,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
                  {on&&<Check size={20} color="#fff" strokeWidth={3}/>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sécurité */}
      <div style={{...M3.section,paddingTop:0}}>Sécurité</div>
      <div style={{margin:"0 16px 20px",background:"var(--card)",border:"none",borderRadius:20,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",gap:12}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <Fingerprint size={20} color="var(--ac)"/>
            <div>
              <div style={{fontSize:14,fontWeight:500,color:"var(--tp)"}}>Verrouillage par empreinte</div>
              <div style={{fontSize:12,color:"var(--ts)",marginTop:2}}>
                {bioOk===false?"Indisponible (aucune empreinte ou code configuré sur le téléphone)":"Demandé à l'ouverture et après 1 min en arrière-plan"}
              </div>
            </div>
          </div>
          {bioOk&&<Toggle checked={!!lockEnabled} onChange={toggleLock}/>}
        </div>
      </div>

      {/* Notifications */}
      <div style={{...M3.section,paddingTop:0}}>Notifications</div>
      <div style={{margin:"0 16px 20px",background:"var(--card)",border:"none",borderRadius:20,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px"}}>
          <div>
            <div style={{fontSize:14,fontWeight:500,color:"var(--tp)"}}>Rappels de RDV</div>
            <div style={{fontSize:12,color:"var(--ts)",marginTop:2}}>
              {notifications.perm!=="granted"?"Permission non accordée":notifications.enabled?"Actifs · 3 jours avant (9h) et le jour J (8h)":"Désactivés"}
            </div>
          </div>
          {notifications.perm==="granted"
            ?<Toggle checked={notifications.enabled} onChange={notifications.toggle}/>
            :<button onClick={notifications.request} style={{padding:"7px 14px",background:"var(--ac)",color:"var(--on-ac)",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Activer</button>
          }
        </div>
      </div>

      {/* Données */}
      <div style={{...M3.section,paddingTop:0}}>Données</div>
      <div style={{margin:"0 16px 20px",background:"var(--card)",border:"none",borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--b)"}}>
          <div style={{fontSize:14,fontWeight:500,color:"var(--tp)",marginBottom:4}}>Exporter toutes les données</div>
          <div style={{fontSize:12,color:"var(--ts)",marginBottom:12,lineHeight:1.5}}>Ouvre le menu Android pour enregistrer dans Google Drive, envoyer par email, WhatsApp…</div>
          <button onClick={async()=>{setExporting(true);await onExport();setExporting(false);}} disabled={exporting}
            style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",background:"var(--ac)",color:"var(--on-ac)",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:exporting?.6:1}}>
            <Download size={15}/>{exporting?"Export en cours…":"Exporter (.json)"}
          </button>
        </div>
        <div style={{padding:"14px 16px"}}>
          <div style={{fontSize:14,fontWeight:500,color:"var(--tp)",marginBottom:4}}>Importer des données</div>
          <div style={{fontSize:12,color:"var(--ts)",marginBottom:12,lineHeight:1.5}}>Restaure depuis un fichier d'export. Les données actuelles seront remplacées.</div>
          <button onClick={()=>importRef.current?.click()} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",background:"var(--muted)",color:"var(--tp)",border:"1px solid var(--bs)",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            <Upload size={15}/>Importer (.json)
          </button>
          <input ref={importRef} type="file" accept=".json,application/json" style={{display:"none"}} onChange={async e=>{
            const f=e.target.files[0];if(!f)return;
            // Sécurité : l'import ÉCRASE tout → confirmation obligatoire (avant : aucune)
            if(entries.length&&!confirm(`Remplacer tes ${entries.length} entrée${entries.length>1?"s":""} actuelle${entries.length>1?"s":""} par le contenu du fichier ?\n\nConseil : exporte d'abord une sauvegarde.`)){e.target.value="";return;}
            const{ok,msg}=await onImport(f);
            setImportMsg({ok,msg});toast(msg,ok?"success":"error");
            setTimeout(()=>setImportMsg(null),4000);e.target.value="";
          }}/>
          {importMsg&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:10,background:importMsg.ok?"var(--ok-bg)":"var(--er-bg)",border:`1px solid ${importMsg.ok?"var(--ok-b)":"var(--er)"}`,fontSize:13,color:importMsg.ok?"var(--ok-t)":"var(--er)"}}>{importMsg.msg}</div>}
        </div>
      </div>

      {/* Catégories */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px 8px"}}>
        <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",letterSpacing:".07em",textTransform:"uppercase"}}>Catégories</div>
        <button onClick={()=>setCatModal({mode:"create"})}
          style={{display:"flex",alignItems:"center",gap:5,padding:"5px 13px",background:"var(--ac)",color:"var(--on-ac)",border:"none",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          <Plus size={13}/>Nouvelle
        </button>
      </div>
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {allMerged.map(([k,c])=>{
          const cnt=entries.filter(e=>e.cat===k).length;
          return(
            <div key={k} style={{display:"flex",alignItems:"center",gap:10,background:"var(--card)",border:"none",borderRadius:13,padding:"10px 12px"}}>
              <div style={{width:36,height:36,borderRadius:9,background:c.dot+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>
                {c.emoji?c.emoji:<CatIcon cat={c} size={17}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--tp)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</div>
                <div style={{fontSize:11,color:"var(--ts)",marginTop:1,display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
                  {cnt} entrée{cnt!==1?"s":""}{BASE_CATS[k]?" · par défaut":""}
                </div>
              </div>
              <button onClick={()=>setCatModal({mode:"edit",key:k,cat:c})}
                style={{background:"var(--muted)",border:"none",cursor:"pointer",color:"var(--ac)",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Edit2 size={14}/>
              </button>
              <button onClick={()=>delCat(k)}
                style={{background:"var(--er-bg)",border:"1px solid var(--er)",cursor:"pointer",color:"var(--er)",borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <X size={14}/>
              </button>
            </div>
          );
        })}
      </div>
      {hiddenCats.length>0&&<>
        <div style={{...M3.section,paddingTop:0}}>Catégories supprimées</div>
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
          {hiddenCats.map(([k,c])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:10,background:"var(--card)",border:"1px dashed var(--bs)",borderRadius:13,padding:"10px 12px",opacity:.85}}>
              <div style={{width:36,height:36,borderRadius:9,background:tint(c),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CatIcon cat={c} size={17}/></div>
              <div style={{flex:1,fontSize:13,fontWeight:600,color:"var(--ts)"}}>{c.label}</div>
              <button onClick={()=>restoreCat(k)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",background:"var(--al)",color:"var(--ac)",border:"1px solid var(--ac)",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}><RotateCcw size={13}/>Restaurer</button>
            </div>
          ))}
        </div>
      </>}
      <div style={{height:8}}/>

      {catModal&&(
        <CategoryModal
          initial={catModal.mode==="edit"?{name:catModal.cat.label,dot:catModal.cat.dot,emoji:catModal.cat.emoji||null,iconKey:catModal.cat.iconKey,fields:catModal.cat.fields||{}}:null}
          onSave={handleSaveCat}
          onClose={()=>setCatModal(null)}
        />
      )}
    </div>
  );
}


// ─── App (racine) ─────────────────────────────────────────────
function App(){
  const[entries,setEntries]       =useStorage("tr-entries",[]);
  const[customCats,setCustomCats] =useStorage("tr-custom-cats",{});
  const[darkMode,setDarkMode]     =useStorage("tr-dark",true);
  const[accent,setAccent]         =useStorage("tr-accent","bleu");
  const[docs,setDocs]             =useState({});
  const[docsLoaded,setDocsLoaded] =useState(false);

  // Navigation avec historique pour le bouton retour Android
  const[screen,setScreen]         =useState("home");
  const[navStack,setNavStack]     =useState([]);
  const[histFilter,setHistFilter] =useState("all");
  const[viewerState,setViewerState]=useState(null);
  const[modalEntry,setModalEntry] =useState(null);
  const[editingId,setEditingId]   =useState(null);
  const[prefill,setPrefill]       =useState(null);
  // Verrouillage : drapeau lu en SYNCHRONE (localStorage) pour ne jamais afficher les données avant le déverrouillage
  const readLock=()=>{try{return localStorage.getItem("tr-lock")==="1";}catch{return false;}};
  const[lockEnabled,setLockEnabledState]=useState(readLock);
  const[locked,setLocked]         =useState(()=>readLock()&&!!window.__biometric);
  const setLockEnabled=v=>{setLockEnabledState(v);try{localStorage.setItem("tr-lock",v?"1":"0");}catch{}};

  // catLookup = toutes les catégories (même supprimées) → pour afficher le bon nom d'une ancienne entrée
  // allCats   = seulement les visibles → pour les grilles, filtres et le formulaire
  const catLookup=useMemo(()=>mergeCats(customCats),[customCats]);
  const allCats=useMemo(()=>Object.fromEntries(Object.entries(catLookup).filter(([,c])=>!c.hidden)),[catLookup]);
  const editingEntry=useMemo(()=>editingId!=null?entries.find(e=>e.id===editingId):null,[editingId,entries]);
  const editingDocs =useMemo(()=>editingId!=null?(docs[editingId]||[]):[],[editingId,docs]);
  const liveModalEntry=useMemo(()=>modalEntry?entries.find(e=>e.id===modalEntry.id)||null:null,[modalEntry,entries]);

  useEffect(()=>{loadAllDocs().then(d=>{setDocs(d);setDocsLoaded(true);});},[]);

  // Dark mode + status bar Android
  useEffect(()=>{
    document.documentElement[darkMode?"setAttribute":"removeAttribute"]("data-dark","");
    document.documentElement.setAttribute("data-accent",accent||"bleu");
    window.__applyStatusBar?.(!!darkMode); // Mithril-Anneau: #080B12 dark / #F2EDE4 light
  },[darkMode,accent]);

  const toast         =useToast();
  const notifications =useNotifications(entries,toast);
  const reminders     =useMemo(()=>computeReminders(entries,30),[entries]);
  // Badge : ce qui demande une action (retards + RDV à ≤ 3 jours + alertes km)
  const upcomingCount =useMemo(()=>reminders.filter(r=>r.overdue||r.soon).length,[reminders]);
  const doneIds       =useMemo(()=>new Set(entries.filter(e=>(e.next||e.nextKm)&&isSuperseded(e,entries)).map(e=>e.id)),[entries]);

  // ── Verrouillage ────────────────────────────────────────────
  const unlock=useCallback(async()=>{
    if(!window.__biometric){setLocked(false);return;}
    if(await window.__biometric.authenticate())setLocked(false);
  },[]);
  useEffect(()=>{if(locked)unlock();},[]); // eslint-disable-line
  useEffect(()=>{
    let hiddenAt=0;
    const onVis=()=>{
      if(document.visibilityState==="hidden"){hiddenAt=Date.now();return;}
      if(lockEnabled&&window.__biometric&&hiddenAt&&Date.now()-hiddenAt>60000){setLocked(true);unlock();}
    };
    document.addEventListener("visibilitychange",onVis);
    return()=>document.removeEventListener("visibilitychange",onVis);
  },[lockEnabled,unlock]);

  // ── Navigation ──────────────────────────────────────────────
  const navigate=useCallback((to,opts={})=>{
    if(to===screen&&!opts.keepEditing)return; // évite d'empiler 5× "Accueil" (bouton retour qui tourne en rond)
    setNavStack(prev=>opts.replace?prev:[...prev,screen].slice(-20));
    setScreen(to);
    if(to==="add"&&!opts.keepEditing)setEditingId(null);
    if(to==="add")setPrefill(opts.prefill||null);
  },[screen]);

  // goBack : ferme d'abord les overlays, puis remonte dans la pile
  const goBack=useCallback(()=>{
    if(viewerState){setViewerState(null);return true;}
    if(modalEntry){setModalEntry(null);return true;}
    if(navStack.length>0){
      const prev=navStack[navStack.length-1];
      setNavStack(s=>s.slice(0,-1));
      setScreen(prev);
      return true;
    }
    return false; // Capacitor exitApp
  },[navStack,viewerState,modalEntry]);

  // Exposer pour main.jsx (bouton retour Android physique)
  useEffect(()=>{window.__goBack=goBack;},[goBack]);
  window.__goHome=()=>{setNavStack([]);setScreen("home");setEditingId(null);setPrefill(null);};
  // Toucher une notification → ouvre l'entrée concernée
  useEffect(()=>{window.__openEntry=id=>{const e=entries.find(x=>String(x.id)===String(id));if(e)setModalEntry(e);};},[entries]);

  // "C'est fait" : nouvelle entrée préremplie (même catégorie, titre, personne, intervenant, récurrence)
  // → l'ancien rappel est automatiquement considéré comme fait (entrée plus récente, même titre)
  const handleDone=useCallback(e=>{
    const t=todayStr();
    navigate("add",{prefill:{cat:e.cat,title:e.title,who:e.who||"",pro:e.pro||"",recur:e.recur||"",date:t,next:e.recur?addMonths(t,e.recur):""}});
  },[navigate]);

  // ── Viewer ───────────────────────────────────────────────────
  const openViewer =useCallback((list,idx)=>setViewerState({docs:list,idx}),[]);
  const closeViewer=useCallback(()=>setViewerState(null),[]);

  // ── CRUD ────────────────────────────────────────────────────
  const handleSave=useCallback(async(data,pendingDocs,isEdit)=>{
    if(isEdit&&editingId!=null){
      const id=editingId;
      setEntries(prev=>prev.map(e=>e.id===id?{...e,...data}:e));
      setEditingId(null);
      // Avant : si on retirait TOUTES les pièces jointes, la suppression n'était pas enregistrée
      if(docsLoaded){
        setDocs(prev=>{const n={...prev};if(pendingDocs.length)n[id]=pendingDocs;else delete n[id];return n;});
        await saveDocForEntry(id,pendingDocs);
      }
    }else{
      const id=Date.now();
      setEntries(prev=>[{id,...data},...prev]);
      if(pendingDocs.length){setDocs(prev=>({...prev,[id]:pendingDocs}));await saveDocForEntry(id,pendingDocs);}
    }
  },[editingId,setEntries,docsLoaded]);

  const handleDelete=useCallback(async id=>{
    setEntries(prev=>prev.filter(e=>e.id!==id));
    setDocs(prev=>{const n={...prev};delete n[id];return n;});
    await deleteDocForEntry(id);
    toast("Entrée supprimée","info");
  },[setEntries,toast]);

  const handleEdit=useCallback(id=>{setEditingId(id);navigate("add",{keepEditing:true});},[navigate]);

  // ── Export ─────────────────────────────────────────────────
  // Partage d'un fichier texte : Android (main.jsx) → partage web → téléchargement
  const shareText=useCallback(async(text,fileName,mime,okMsg)=>{
    if(window.__exportData){
      const res=await window.__exportData(text,fileName);
      if(res.canceled){toast("Partage annulé","info");return;}
      if(res.ok){toast(okMsg,"success");return;}
    }
    try{
      const file=new File([new Blob([text],{type:mime})],fileName,{type:mime});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"Suivi Divers — "+fileName});
        toast("Partage ouvert !","success");return;
      }
    }catch(e){if(e.name==="AbortError"){toast("Partage annulé","info");return;}}
    const url=URL.createObjectURL(new Blob([text],{type:mime}));
    const a=document.createElement("a");a.href=url;a.download=fileName;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    toast("Fichier exporté !","success");
  },[toast]);

  const handleExport=useCallback(async()=>{
    const payload={version:3,app:APP_VERSION,exportDate:new Date().toISOString(),entries,docs,customCats};
    await shareText(JSON.stringify(payload),"suivi-divers-"+todayStr()+".json","application/json","Sauvegarde partagée !");
  },[entries,docs,customCats,shareText]);

  const handleExportCSV=useCallback(async(list,period)=>{
    await shareText(toCSV(list,catLookup),`suivi-divers-${period==="12m"?"12-mois":period}.csv`,"text/csv","Tableur partagé !");
  },[catLookup,shareText]);

  // ── Import ───────────────────────────────────────────────────
  const handleImport=useCallback(async file=>{
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      if(!Array.isArray(data.entries))throw new Error("Format invalide");
      // On ne garde que les entrées valides (id + titre + date)
      const valid=data.entries.filter(e=>e&&e.id!=null&&typeof e.title==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(e.date||""));
      if(!valid.length&&data.entries.length)throw new Error("Aucune entrée valide");
      const newDocs=data.docs&&typeof data.docs==="object"?data.docs:{};
      // Avant : les pièces jointes des anciennes entrées restaient stockées pour rien (mémoire gaspillée)
      await Promise.all(Object.keys(docs).filter(id=>!(id in newDocs)).map(id=>deleteDocForEntry(id)));
      await Promise.all(Object.entries(newDocs).map(([id,d])=>saveDocForEntry(id,d)));
      setEntries(valid);
      setCustomCats(data.customCats&&typeof data.customCats==="object"?data.customCats:{});
      setDocs(newDocs);
      const skipped=data.entries.length-valid.length;
      return{ok:true,msg:`${valid.length} entrée${valid.length>1?"s":""} importée${valid.length>1?"s":""}.${skipped?` (${skipped} ignorée${skipped>1?"s":""})`:""}`};
    }catch{return{ok:false,msg:"Fichier d'import invalide."};}
  },[setEntries,setCustomCats,docs]);

  // ── NavBtn ───────────────────────────────────────────────────
  const NavBtn=({id,label,icon:Icon,badge})=>{
    const on=screen===id;
    return(
      <button onClick={()=>navigate(id)} aria-current={on?"page":undefined}
        style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,cursor:"pointer",background:"none",border:"none",padding:0,color:on?"var(--tp)":"var(--ts)",fontSize:12,fontWeight:on?700:500,fontFamily:"inherit"}}>
        <span style={{position:"relative",width:64,height:32,borderRadius:16,background:on?"var(--al)":"transparent",color:on?"var(--on-al)":"var(--ts)",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .2s"}}>
          <Icon size={22} strokeWidth={on?2.2:1.9}/>
          {badge>0&&<span aria-label={`${badge} à traiter`} style={{position:"absolute",top:2,right:12,minWidth:16,height:16,padding:"0 4px",borderRadius:8,background:"var(--er)",color:"var(--bg)",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{badge}</span>}
        </span>
        {label}
      </button>
    );
  };

  return(
    <DoneCtx.Provider value={doneIds}>
      <style>{CSS}</style>
      {/* Plein écran : avant, un "cadre de téléphone" (marges 16px + bordure arrondie) gaspillait de la place
          et la barre d'onglets défilait avec le contenu au lieu de rester fixée en bas */}
      <div style={{display:"flex",justifyContent:"center",height:"100dvh",background:"var(--bg)",transition:"background .25s"}}>
        <div style={{maxWidth:520,width:"100%",height:"100%",background:"var(--bg)",overflow:"hidden",display:"flex",flexDirection:"column",position:"relative",transition:"background .25s"}}>
          <div style={{flex:1,minHeight:0,overflowY:"auto",paddingBottom:screen==="add"?96:164}}>

            {screen==="home"&&
              <HomeScreen entries={entries} docs={docs} allCats={allCats} lookup={catLookup} reminders={reminders} upcomingCount={upcomingCount} darkMode={darkMode}
                onFilterHistory={cat=>{setHistFilter(cat);navigate("history");}}
                onOpenModal={e=>setModalEntry(e)} onViewDoc={openViewer}/>}

            {screen==="history"&&
              <HistoryScreen entries={entries} docs={docs} allCats={allCats} lookup={catLookup} filter={histFilter} setFilter={setHistFilter}
                onOpenModal={e=>setModalEntry(e)} onViewDoc={openViewer}/>}

            {screen==="add"&&(
              <>
                <div style={{...M3.header}}>
                  <h1 style={M3.title}>{editingId?"Modifier l'entrée":prefill?"C'est fait ✓":"Nouvel enregistrement"}</h1>
                  <p style={{fontSize:13,color:"var(--ts)",marginTop:2}}>{editingId?"Mettez à jour les informations":prefill?"Complète ce qui a été fait (prix, notes…)":"Ajoutez un suivi en 3 étapes"}</p>
                </div>
                <FormStepper allCats={allCats} entries={entries} editingEntry={editingEntry} editingDocs={editingDocs} prefill={prefill}
                  onSave={handleSave} onCancelEdit={()=>{setEditingId(null);navigate("home",{replace:true});}}/>
              </>
            )}

            {screen==="rapport"&&<RapportScreen entries={entries} allCats={allCats} lookup={catLookup} onExportCSV={handleExportCSV}/>}

            {screen==="settings"&&
              <SettingsScreen darkMode={darkMode} setDarkMode={setDarkMode} accent={accent} setAccent={setAccent} customCats={customCats} setCustomCats={setCustomCats}
                entries={entries} onExport={handleExport} onImport={handleImport} notifications={notifications}
                lockEnabled={lockEnabled} setLockEnabled={setLockEnabled}/>}
          </div>

          <nav aria-label="Navigation principale" style={{position:"absolute",bottom:0,left:0,right:0,height:80,background:"var(--nav)",display:"flex",zIndex:20,transition:"background .25s"}}>
            <NavBtn id="home"     label="Accueil"    icon={Home}     badge={upcomingCount}/>
            <NavBtn id="history"  label="Historique" icon={BookOpen}/>
            <NavBtn id="rapport"  label="Rapport"    icon={BarChart2}/>
            <NavBtn id="settings" label="Réglages"   icon={Settings}/>
          </nav>
          {/* Bouton d'action flottant Material 3 : version étendue sur l'accueil, ronde ailleurs.
              Masqué sur l'écran d'ajout (il recouvrait les boutons du formulaire) */}
          {screen!=="add"&&screen!=="settings"&&(
            <button aria-label="Ajouter un suivi" onClick={()=>navigate("add")} className="press"
              style={{position:"absolute",bottom:96,right:16,height:56,minWidth:56,padding:screen==="home"?"0 20px 0 16px":0,borderRadius:16,border:"none",background:"var(--ac)",color:"var(--on-ac)",display:"flex",alignItems:"center",justifyContent:"center",gap:12,fontSize:15,fontWeight:600,fontFamily:"inherit",boxShadow:"0 3px 8px rgba(0,0,0,.3)",zIndex:25,cursor:"pointer"}}>
              <Plus size={24} strokeWidth={2.2}/>
              {screen==="home"&&"Nouveau suivi"}
            </button>
          )}
        </div>
      </div>

      {liveModalEntry&&
        <EntryModal entry={liveModalEntry} entryDocs={docs[liveModalEntry.id]||[]} allCats={catLookup}
          onClose={()=>setModalEntry(null)} onEdit={handleEdit} onDelete={handleDelete} onViewDoc={openViewer} onDone={handleDone}/>}

      {viewerState&&
        <Viewer docs={viewerState.docs} idx={viewerState.idx} onClose={closeViewer}
          onNav={dir=>setViewerState(s=>({...s,idx:Math.max(0,Math.min(s.docs.length-1,s.idx+dir))}))}/>}

      {/* Écran de verrouillage : recouvre tout tant que l'empreinte n'est pas validée */}
      {locked&&(
        <div style={{position:"fixed",inset:0,zIndex:10000,background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18,padding:24}}>
          <div style={{width:76,height:76,borderRadius:"50%",background:"var(--al)",display:"flex",alignItems:"center",justifyContent:"center"}}><Lock size={34} color="var(--ac)"/></div>
          <div style={M3.title}>{APP_NAME}</div>
          <div style={{fontSize:13,color:"var(--ts)"}}>Application verrouillée</div>
          <button onClick={unlock} style={{display:"flex",alignItems:"center",gap:8,padding:"12px 22px",background:"var(--ac)",color:darkMode?"#0D1628":"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}><Fingerprint size={18}/>Déverrouiller</button>
        </div>
      )}
    </DoneCtx.Provider>
  );
}

// ─── Export unique ────────────────────────────────────────────
export default function SuiviDivers(){
  return <ToastProvider><App/></ToastProvider>;
}
