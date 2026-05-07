import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, memo } from "react";
import { Home, BookOpen, Plus, BarChart2, Settings, Edit2, Trash2, FileText, Camera, Image, Calendar, DollarSign, Clock, Download, Upload, Search, ChevronLeft, ChevronRight, Eye, X, Check, ArrowRight, Tag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import _ from "lodash";

// ─── Constantes ───────────────────────────────────────────────
const APP_VERSION = "1.2.0"; // Mineure : thème Mithril-Anneau
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
const ICON_OPTS = ["🚗","🐾","🏥","🏠","🔧","🌿","💊","📋","🏋️","🧹","🎓","⚡","🧰","🚿","💻","🛒"];
const BASE_CATS = {
  voiture: { label:"Voiture / Garage", short:"Voiture", ...COLOR_OPTS[0], base:true },
  veto:    { label:"Vétérinaire",       short:"Véto",    ...COLOR_OPTS[1], base:true },
  medecin: { label:"Médecin / Santé",   short:"Médecin", ...COLOR_OPTS[2], base:true },
  maison:  { label:"Maison / Entretien",short:"Maison",  ...COLOR_OPTS[3], base:true },
  divers:  { label:"Divers",            short:"Divers",  ...COLOR_OPTS[4], base:true },
};
const MAX_FILE = 4 * 1024 * 1024;
const MAX_DIM  = 1400;

// ─── CSS global ───────────────────────────────────────────────
const CSS = `
:root{
  --bg:#F2EDE4;--card:#FAF6EF;--input:#FAF6EF;--muted:#EDE8DC;--nav:#FAF6EF;
  --tp:#1C1608;--ts:#6A5830;--th:#C4B898;
  --b:rgba(100,80,20,.12);--bs:rgba(100,80,20,.22);
  --ac:#8B6914;--al:#F4EDD8;
  --ok-bg:#EAF3DE;--ok-b:#C0DD97;--ok-t:#27500A;--ok-m:#3B6D11;
  --nx-bg:#F4EDD8;--nx-t:#7A5A10;
  --er:#B03020;--er-bg:#FBF0EE;
  --warn:#8B6914;--warn-bg:#F4EDD8;
}
[data-dark]{
  --bg:#080B12;--card:#0F1520;--input:#0F1520;--muted:#141D2E;--nav:#0D1628;
  --tp:#C8C0E8;--ts:#6A8AA8;--th:#4A6880;
  --b:rgba(184,168,80,.18);--bs:rgba(184,168,80,.32);
  --ac:#C8A84B;--al:#1A2214;
  --ok-bg:#0A1A10;--ok-b:#1E4024;--ok-t:#6AB87A;--ok-m:#3A7C5C;
  --nx-bg:#1A2214;--nx-t:#C8A84B;
  --er:#CC5A44;--er-bg:#1A0E0A;
  --warn:#C8A84B;--warn-bg:#1A1A08;
  --nav-border:rgba(200,168,75,.28);
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);transition:background .25s}
input,select,textarea,button{font-family:inherit}
input[type=date]::-webkit-calendar-picker-indicator{opacity:.6}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) scale(.9)}to{opacity:1;transform:translateX(-50%) scale(1)}}
.anim-fadeUp{animation:fadeUp .28s ease both}
.anim-fadeIn{animation:fadeIn .22s ease both}
.anim-slideUp{animation:slideUp .32s cubic-bezier(.32,.72,0,1) both}
::-webkit-scrollbar{width:0;height:0}
`;

// ─── Utilitaires ──────────────────────────────────────────────
const fmt      = d => { if(!d) return ""; const[y,m,dy]=d.split("-"); return `${dy}/${m}/${y}`; };
const fmtPrice = p => { if(p==null||p==="") return null; const n=parseFloat(p); return isNaN(n)?null:n.toFixed(2).replace(".",",")+"\u202f€"; };
const fmtBytes = b => b<1024?b+"o":b<1048576?Math.round(b/1024)+"Ko":(b/1048576).toFixed(1)+"Mo";
const isPdf    = t => t==="application/pdf"||t==="pdf";
const todayStr = () => new Date().toISOString().split("T")[0];
const daysUntil= d => { const t=new Date(); t.setHours(0,0,0,0); return Math.round((new Date(d)-t)/86400000); };

async function compressImage(dataUrl){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>MAX_DIM||h>MAX_DIM){const s=Math.min(MAX_DIM/w,MAX_DIM/h);w=Math.round(w*s);h=Math.round(h*s);}
      const c=document.createElement("canvas");c.width=w;c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      res(c.toDataURL("image/jpeg",.82));
    };img.src=dataUrl;
  });
}

function getMonthlyData(entries){
  return Array.from({length:6},(_,i)=>{
    const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-(5-i));
    const y=d.getFullYear(),m=d.getMonth();
    const label=d.toLocaleDateString("fr-FR",{month:"short"});
    const mes=entries.filter(e=>{const ed=new Date(e.date);return ed.getFullYear()===y&&ed.getMonth()===m;});
    const total=mes.filter(e=>e.price!=null&&!isNaN(parseFloat(e.price))).reduce((s,e)=>s+parseFloat(e.price),0);
    return{label,total:+total.toFixed(2),count:mes.length};
  });
}

// ─── Storage (Capacitor Preferences via adapteur window.storage) ──
function useStorage(key,initial){
  const[val,setVal]=useState(initial);
  const saver=useRef(_.debounce((k,v)=>window.storage.set(k,JSON.stringify(v)).catch(()=>{}),450)).current;
  useEffect(()=>{
    window.storage.get(key).then(r=>{if(r)setVal(JSON.parse(r.value));}).catch(()=>{});
  },[key]);
  const save=useCallback(updater=>{
    setVal(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      saver(key,next);
      return next;
    });
  },[key,saver]);
  return[val,save];
}

async function loadAllDocs(){
  try{
    const res=await window.storage.list("tr-doc-");
    const all={};
    await Promise.all((res?.keys||[]).map(async k=>{
      const id=k.replace("tr-doc-","");
      const r=await window.storage.get(k).catch(()=>null);
      if(r)all[id]=JSON.parse(r.value);
    }));
    return all;
  }catch{return{};}
}
async function saveDocForEntry(id,arr){
  const k=`tr-doc-${id}`;
  if(!arr||!arr.length){await window.storage.delete(k).catch(()=>{});return;}
  await window.storage.set(k,JSON.stringify(arr));
}
async function deleteDocForEntry(id){await window.storage.delete(`tr-doc-${id}`).catch(()=>{});}

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
  const BG={success:"#185FA5",error:"#e24b4a",warning:"#BA7517",info:"#534AB7"};
  return(
    <ToastCtx.Provider value={add}>
      {children}
      <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",zIndex:9998,display:"flex",flexDirection:"column",gap:8,alignItems:"center",pointerEvents:"none"}}>
        {list.map(t=>(
          <div key={t.id} style={{padding:"10px 20px",borderRadius:24,fontSize:13,fontWeight:600,background:BG[t.type]||BG.success,color:"#fff",whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,.25)",animation:"toastIn .25s ease"}}>
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
  const checked=useRef(false);

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

  // Afficher les rappels imminents en toasts au démarrage
  useEffect(()=>{
    if(checked.current||!entries.length||!enabled)return;
    checked.current=true;
    entries.filter(e=>{if(!e.next)return false;const d=daysUntil(e.next);return d>=0&&d<=3;})
      .forEach(e=>{
        const d=daysUntil(e.next);
        const msg=d===0?"📅 Aujourd'hui : "+e.title:d===1?"📅 Demain : "+e.title:"📅 Dans "+d+"j : "+e.title;
        toast(msg,"warning",6000);
      });
  },[entries.length,enabled]);

  // Demander la permission (premier lancement)
  const request=useCallback(async()=>{
    if(window.__requestNotifPermission){
      const p=await window.__requestNotifPermission();
      setPerm(p);
      if(p==="granted"){
        setEnabled(true);
        try{localStorage.setItem("tr-notif-enabled","true");}catch(_){}
        window.__scheduleNotifications?.(entries);
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
      window.__scheduleNotifications?.(entries);
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
  const[results,setResults]=useState(null);
  const run=useMemo(()=>_.debounce((query,ents,cats)=>{
    if(!query.trim()){setResults(null);return;}
    const lq=query.toLowerCase();
    setResults(ents.filter(e=>
      e.title.toLowerCase().includes(lq)||
      (e.notes&&e.notes.toLowerCase().includes(lq))||
      (cats[e.cat]?.label||"").toLowerCase().includes(lq)
    ));
  },220),[]);
  useEffect(()=>{run(q,entries,allCats);},[q,entries,allCats]);
  return{q,setQ,results:results??entries};
}

// ─── Composants de base ───────────────────────────────────────
function Toggle({checked,onChange}){
  return(
    <label style={{position:"relative",width:46,height:27,flexShrink:0,cursor:"pointer",display:"inline-block"}}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{opacity:0,width:0,height:0}}/>
      <span style={{position:"absolute",inset:0,borderRadius:14,background:checked?"var(--ac)":"var(--th)",transition:"background .2s",cursor:"pointer"}}/>
      <span style={{position:"absolute",top:3,left:3,width:21,height:21,background:"#fff",borderRadius:"50%",transition:"transform .2s",transform:checked?"translateX(19px)":"none",pointerEvents:"none",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
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

function CatIcon({cat,size=17}){
  if(cat.emoji)return<span style={{fontSize:size,lineHeight:1}}>{cat.emoji}</span>;
  const s=cat.color;
  const shapes={
    voiture:<><path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M5 12h14"/></>,
    veto:   <><path d="M20 9a4 4 0 00-4-4 4 4 0 00-4 4 4 4 0 004 4 4 4 0 004-4z"/><path d="M4 9c0-2.2 1.8-4 4-4"/><path d="M8 9a4 4 0 01-4 4"/><path d="M12 13v8"/><path d="M12 17H8"/></>,
    medecin:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8M8 12h8"/></>,
    maison: <><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></>,
    divers: <><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></>,
  };
  const key=Object.keys(BASE_CATS).find(k=>BASE_CATS[k].label===cat.label)||"divers";
  return<svg viewBox="0 0 24 24" fill="none" stroke={s} strokeWidth="1.8" width={size} height={size}>{shapes[key]||shapes.divers}</svg>;
}

function DocThumb({doc,size=40,onClick}){
  const st={width:size,height:size,borderRadius:7,flexShrink:0,cursor:"pointer"};
  if(isPdf(doc.type))return<div onClick={onClick} style={{...st,background:"var(--al)",display:"flex",alignItems:"center",justifyContent:"center"}}><FileText size={size*.4} color="var(--ac)"/></div>;
  return<img src={doc.dataUrl} alt="" onClick={onClick} style={{...st,objectFit:"cover"}}/>;
}

// ─── Viewer ───────────────────────────────────────────────────
function Viewer({docs,idx,onClose,onNav}){
  if(!docs?.length)return null;
  const doc=docs[idx];
  useEffect(()=>{
    const h=e=>{if(e.key==="Escape")onClose();if(e.key==="ArrowLeft")onNav(-1);if(e.key==="ArrowRight")onNav(1);};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[onClose,onNav]);
  return(
    <div className="fi" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.95)",zIndex:9999,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,.1)",flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {isPdf(doc.type)?<FileText size={16} color="#fff"/>:<Image size={16} color="#fff"/>}
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
              <a href={doc.dataUrl} download={doc.name} style={{display:"inline-block",padding:"10px 22px",background:"var(--ac)",color:"#fff",borderRadius:10,textDecoration:"none",fontSize:14,fontWeight:600}}>Télécharger</a>
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
const EntryCard=memo(function EntryCard({entry,entryDocs=[],allCats,clickable,onClick,onViewDoc}){
  const c=allCats[entry.cat]||BASE_CATS.divers;
  const p=fmtPrice(entry.price);
  const[hov,setHov]=useState(false);
  const upcoming=entry.next&&daysUntil(entry.next)>=0&&daysUntil(entry.next)<=3;
  return(
    <div onClick={clickable?onClick:undefined} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:"var(--card)",border:`1px solid ${hov&&clickable?"var(--bs)":"var(--b)"}`,borderRadius:14,padding:"12px 14px",display:"flex",gap:12,alignItems:"flex-start",cursor:clickable?"pointer":"default",transition:"border-color .15s"}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:c.dot,marginTop:5,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div style={{fontSize:14,fontWeight:600,color:"var(--tp)"}}>{entry.title}</div>
          {p&&<div style={{fontSize:13,fontWeight:600,color:"var(--ac)",flexShrink:0}}>{p}</div>}
        </div>
        <div style={{fontSize:12,color:"var(--ts)",marginTop:2}}>{fmt(entry.date)} · {c.label}</div>
        {entry.notes&&<div style={{fontSize:11,color:"var(--ts)",marginTop:2}}>{entry.notes.substring(0,60)}{entry.notes.length>60?"…":""}</div>}
        {entry.next&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:upcoming?"var(--warn-bg)":"var(--nx-bg)",color:upcoming?"var(--warn)":"var(--nx-t)",display:"inline-block",marginTop:4}}>{upcoming?"⚡ ":""}Prochain : {fmt(entry.next)}</span>}
        {entryDocs.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:6}}>
            {entryDocs.map((d,i)=>(
              <span key={i} onClick={e=>{e.stopPropagation();onViewDoc(entryDocs,i);}}
                style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px 3px 6px",background:"var(--muted)",border:"1px solid var(--b)",borderRadius:20,fontSize:11,color:"var(--ts)",cursor:"pointer"}}>
                {isPdf(d.type)?<FileText size={11}/>:<Image size={11}/>}
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>{d.name.length>16?d.name.substring(0,14)+"…":d.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── EntryModal ───────────────────────────────────────────────
function EntryModal({entry,entryDocs=[],allCats,onClose,onEdit,onDelete,onViewDoc}){
  const[confirmDel,setConfirmDel]=useState(false);
  const c=allCats[entry.cat]||BASE_CATS.divers;
  const p=fmtPrice(entry.price);
  const fields=[
    {icon:<Calendar size={16}/>,label:"Date",val:fmt(entry.date)},
    p?{icon:<DollarSign size={16}/>,label:"Prix",val:p,cls:"price"}:null,
    entry.next?{icon:<Clock size={16}/>,label:"Prochain RDV",val:fmt(entry.next),cls:"next"}:null,
    entry.notes?{icon:<FileText size={16}/>,label:"Notes",val:entry.notes}:null,
  ].filter(Boolean);
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} className="fi"
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(3px)"}}>
      <div className="su" style={{background:"var(--card)",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,maxHeight:"92vh",overflowY:"auto",paddingBottom:24}}>
        <div style={{width:36,height:4,background:"var(--bs)",borderRadius:2,margin:"14px auto 0"}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px 14px"}}>
          <div style={{width:44,height:44,borderRadius:12,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CatIcon cat={c} size={20}/></div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",textTransform:"uppercase",letterSpacing:".05em"}}>{c.label}</div>
            <div style={{fontSize:20,fontWeight:700,color:"var(--tp)",marginTop:1}}>{entry.title}</div>
          </div>
        </div>
        <div style={{height:1,background:"var(--b)",margin:"0 20px"}}/>
        <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
          {fields.map((f,i)=>(
            <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start"}}>
              <div style={{width:32,height:32,borderRadius:9,background:"var(--muted)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:"var(--ts)"}}>{f.icon}</div>
              <div>
                <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",textTransform:"uppercase",letterSpacing:".04em",marginBottom:3}}>{f.label}</div>
                <div style={f.cls==="price"?{fontSize:17,fontWeight:700,color:"var(--ac)"}:f.cls==="next"?{fontSize:13,fontWeight:500,padding:"3px 10px",background:"var(--nx-bg)",color:"var(--nx-t)",borderRadius:20,display:"inline-block"}:{fontSize:14,color:"var(--tp)",whiteSpace:"pre-wrap"}}>{f.val}</div>
              </div>
            </div>
          ))}
        </div>
        {entryDocs.length>0&&(
          <div style={{padding:"0 20px 8px"}}>
            <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:10}}>Documents joints</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {entryDocs.map((d,i)=>(
                <div key={i} onClick={()=>onViewDoc(entryDocs,i)} style={{display:"flex",alignItems:"center",gap:10,background:"var(--muted)",border:"1px solid var(--b)",borderRadius:10,padding:"8px 10px",cursor:"pointer"}}>
                  <DocThumb doc={d} size={36}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--tp)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
                    <div style={{fontSize:11,color:"var(--ts)",marginTop:2}}>{fmtBytes(d.size)}</div>
                  </div>
                  <Eye size={14} color="var(--ts)"/>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:10,padding:"12px 20px 0"}}>
          <button onClick={()=>{onClose();onEdit(entry.id);}} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:12,background:"var(--al)",color:"var(--ac)",border:"1px solid var(--ac)",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}><Edit2 size={15}/>Modifier</button>
          <button onClick={()=>setConfirmDel(true)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:12,background:"var(--er-bg)",color:"var(--er)",border:"1px solid var(--er)",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}><Trash2 size={15}/>Supprimer</button>
        </div>
        {confirmDel&&(
          <div style={{margin:"12px 20px 0",padding:14,background:"var(--er-bg)",border:"1px solid var(--er)",borderRadius:12,textAlign:"center"}}>
            <p style={{fontSize:13,color:"var(--er)",marginBottom:12,fontWeight:500}}>Supprimer définitivement cette entrée ?</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setConfirmDel(false)} style={{flex:1,padding:10,borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",background:"var(--muted)",color:"var(--tp)",fontFamily:"inherit"}}>Annuler</button>
              <button onClick={()=>{onDelete(entry.id);onClose();}} style={{flex:1,padding:10,borderRadius:9,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",background:"var(--er)",color:"#fff",fontFamily:"inherit"}}>Oui, supprimer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FormStepper ──────────────────────────────────────────────
function FormStepper({allCats,editingEntry,editingDocs,onSave,onCancelEdit}){
  const toast=useToast();
  const isEdit=!!editingEntry;
  const[step,setStep]=useState(0);
  const[cat,setCat]=useState(editingEntry?.cat||"voiture");
  const[title,setTitle]=useState(editingEntry?.title||"");
  const[date,setDate]=useState(editingEntry?.date||todayStr());
  const[price,setPrice]=useState(editingEntry?.price!=null?editingEntry.price:"");
  const[next,setNext]=useState(editingEntry?.next||"");
  const[notes,setNotes]=useState(editingEntry?.notes||"");
  const[pendingDocs,setPendingDocs]=useState(editingDocs||[]);
  const[titleErr,setTitleErr]=useState(false);
  const[done,setDone]=useState(false);
  const pickRef=useRef(),camRef=useRef();

  useEffect(()=>{
    if(editingEntry){setCat(editingEntry.cat);setTitle(editingEntry.title);setDate(editingEntry.date);setPrice(editingEntry.price!=null?editingEntry.price:"");setNext(editingEntry.next||"");setNotes(editingEntry.notes||"");setPendingDocs(editingDocs||[]);setStep(0);setDone(false);}
  },[editingEntry]);

  const handleFiles=useCallback(async files=>{
    for(const f of Array.from(files)){
      if(f.size>MAX_FILE)continue;
      const reader=new FileReader();
      reader.onload=async e=>{
        let url=e.target.result,size=f.size;
        if(f.type.startsWith("image/")){url=await compressImage(url);size=Math.round(url.length*.75);}
        setPendingDocs(p=>[...p,{name:f.name,type:f.type||"",dataUrl:url,size}]);
      };reader.readAsDataURL(f);
    }
    if(pickRef.current)pickRef.current.value="";
    if(camRef.current)camRef.current.value="";
  },[]);

  const nextStep=()=>{if(step===0&&!title.trim()){setTitleErr(true);return;}setTitleErr(false);setStep(s=>Math.min(2,s+1));};
  const handleSave=()=>{
    onSave({cat,title:title.trim(),date,price:price!==""?price:null,next,notes:notes.trim()},pendingDocs,isEdit);
    setDone(true);
    toast(isEdit?"Entrée modifiée !":"Suivi enregistré !","success");
  };
  const reset=()=>{setCat("voiture");setTitle("");setDate(todayStr());setPrice("");setNext("");setNotes("");setPendingDocs([]);setStep(0);setDone(false);setTitleErr(false);if(isEdit)onCancelEdit();};

  const SI={width:"100%",padding:"10px 12px",fontSize:14,border:"1px solid var(--bs)",borderRadius:10,background:"var(--input)",color:"var(--tp)",outline:"none"};
  const SL={fontSize:11,color:"var(--ts)",marginBottom:5,display:"block",fontWeight:600,letterSpacing:".05em",textTransform:"uppercase"};
  const STEPS=["Quoi ?","Quand & Prix","Détails"];

  if(done)return(
    <div className="fu" style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{padding:24,background:"var(--ok-bg)",border:"1px solid var(--ok-b)",borderRadius:16,display:"flex",flexDirection:"column",alignItems:"center",gap:12,textAlign:"center"}}>
        <div style={{width:52,height:52,borderRadius:"50%",background:"var(--ok-m)",display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={26} color="#fff"/></div>
        <div style={{fontSize:17,fontWeight:700,color:"var(--ok-t)"}}>{isEdit?"Entrée modifiée !":"Suivi enregistré !"}</div>
        <div style={{fontSize:13,color:"var(--ok-m)"}}>{title}{price?` · ${fmtPrice(price)}`:""} — {fmt(date)}</div>
      </div>
      <button onClick={()=>window.__goHome?.()}  style={{padding:13,background:"var(--ac)",color:"#fff",border:"none",borderRadius:11,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Retour à l'accueil</button>
      <button onClick={reset} style={{padding:11,background:"transparent",color:"var(--tp)",border:"1px solid var(--bs)",borderRadius:11,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{isEdit?"Modifier une autre entrée":"Ajouter un autre suivi"}</button>
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
                <div style={{width:28,height:28,borderRadius:7,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CatIcon cat={c} size={14}/></div>
                <span style={{fontSize:12,fontWeight:600,color:cat===k?"var(--ac)":"var(--tp)"}}>{c.short}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{padding:"0 16px",marginBottom:16}}>
          <label style={SL}>Titre / Objet</label>
          <input value={title} onChange={e=>{setTitle(e.target.value);setTitleErr(false);}} placeholder="ex: Vidange, Vaccination, Gastro…" style={{...SI,borderColor:titleErr?"var(--er)":"var(--bs)"}} autoFocus/>
          {titleErr&&<div style={{fontSize:12,color:"var(--er)",marginTop:4}}>Ce champ est obligatoire.</div>}
        </div>
      </div>}

      {step===1&&<div className="fu">
        {[
          {label:"Date",id:"date",type:"date",val:date,set:setDate},
          {label:"Prix (optionnel)",id:"price",type:"number",val:price,set:setPrice,suffix:"€"},
          {label:"Prochain rendez-vous (optionnel)",id:"next",type:"date",val:next,set:setNext},
        ].map(f=>(
          <div key={f.id} style={{padding:"0 16px",marginBottom:14}}>
            <label style={SL}>{f.label}</label>
            <div style={{display:"flex"}}>
              <input type={f.type} value={f.val} onChange={e=>f.set(e.target.value)} min={f.type==="number"?0:undefined} step={f.type==="number"?"0.01":undefined} placeholder={f.type==="number"?"0.00":undefined}
                style={{...SI,borderRight:f.suffix?"none":"",borderRadius:f.suffix?"10px 0 0 10px":"10px"}}/>
              {f.suffix&&<div style={{padding:"10px 12px",fontSize:14,background:"var(--muted)",border:"1px solid var(--bs)",borderRadius:"0 10px 10px 0",color:"var(--ts)"}}>{f.suffix}</div>}
            </div>
          </div>
        ))}
      </div>}

      {step===2&&<div className="fu">
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
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"var(--muted)",border:"1px solid var(--b)",borderRadius:10,padding:"8px 10px"}}>
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
          ?<button onClick={nextStep} style={{flex:2,padding:"12px",background:"var(--ac)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>Suivant<ArrowRight size={16}/></button>
          :<button onClick={handleSave} style={{flex:2,padding:"12px",background:"var(--ac)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Check size={16}/>{isEdit?"Enregistrer":"Ajouter"}</button>
        }
      </div>
    </div>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────
function HomeScreen({entries,docs,allCats,onFilterHistory,upcomingCount,darkMode}){
  const recent=[...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const catBg=(c)=>darkMode?c.dot+"1A":c.bg;
  const catBadgeBg=(c)=>darkMode?c.dot+"2A":c.bg;
  return(
    <div className="fu">
      <div style={{padding:"16px 20px 12px",background:"var(--card)",borderBottom:"1px solid var(--b)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h1 style={{fontSize:20,fontWeight:700,color:"var(--tp)"}}>{APP_NAME}</h1>
          {upcomingCount>0&&<span style={{fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20,background:"var(--warn-bg)",color:"var(--warn)"}}>⚡ {upcomingCount} RDV proche{upcomingCount>1?"s":""}</span>}
        </div>
        <p style={{fontSize:13,color:"var(--ts)",marginTop:2}}>{entries.length} suivi{entries.length!==1?"s":""} enregistré{entries.length!==1?"s":""}</p>
      </div>
      <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"14px 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Catégories</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 16px"}}>
        {Object.entries(allCats).map(([k,c])=>{
          const cnt=entries.filter(e=>e.cat===k).length;
          const last=entries.filter(e=>e.cat===k).sort((a,b)=>b.date.localeCompare(a.date))[0];
          return(
            <div key={k} onClick={()=>onFilterHistory(k)} style={{background:"var(--card)",border:"1px solid var(--b)",borderRadius:14,padding:14,cursor:"pointer"}}>
              <div style={{width:34,height:34,borderRadius:9,background:catBg(c),display:"flex",alignItems:"center",justifyContent:"center",marginBottom:9}}><CatIcon cat={c} size={17}/></div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--tp)"}}>{c.label}</div>
              <div style={{fontSize:11,color:"var(--ts)",marginTop:2}}>{last?"Dernier : "+fmt(last.date):"Aucun suivi"}</div>
              <span style={{display:"inline-block",fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,marginTop:6,background:catBadgeBg(c),color:darkMode?c.dot:c.color}}>{cnt} entrée{cnt!==1?"s":""}</span>
            </div>
          );
        })}
      </div>
      <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"14px 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Entrées récentes</div>
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
        {recent.length?recent.map(e=>(<EntryCard key={e.id} entry={e} entryDocs={docs[e.id]||[]} allCats={allCats} clickable={false} onViewDoc={()=>{}}/>))
          :<EmptyState icon={Tag} title="Aucun suivi pour l'instant" sub="Appuyez sur + pour créer votre premier suivi."/>}
      </div>
      <div style={{height:8}}/>
    </div>
  );
}

// ─── HistoryScreen ────────────────────────────────────────────
function HistoryScreen({entries,docs,allCats,filter,setFilter,onOpenModal,onViewDoc}){
  const{q,setQ,results}=useSearch(entries,allCats);
  const display=q?results:(filter==="all"?entries:entries.filter(e=>e.cat===filter));
  const sorted=[...display].sort((a,b)=>b.date.localeCompare(a.date));
  return(
    <div>
      <div style={{padding:"16px 20px 12px",background:"var(--card)",borderBottom:"1px solid var(--b)",position:"sticky",top:0,zIndex:10}}>
        <h1 style={{fontSize:20,fontWeight:700,color:"var(--tp)"}}>Historique</h1>
        <p style={{fontSize:13,color:"var(--ts)",marginTop:2}}>Appuyez sur une entrée pour les détails</p>
      </div>
      <div style={{padding:"10px 16px",background:"var(--card)",borderBottom:"1px solid var(--b)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"var(--muted)",borderRadius:10,padding:"8px 12px"}}>
          <Search size={15} color="var(--ts)"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher…" style={{flex:1,border:"none",background:"transparent",fontSize:14,color:"var(--tp)",outline:"none"}}/>
          {q&&<button onClick={()=>setQ("")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ts)",display:"flex"}}><X size={14}/></button>}
        </div>
      </div>
      {!q&&(
        <div style={{display:"flex",gap:8,padding:"10px 16px",overflowX:"auto",scrollbarWidth:"none"}}>
          {[{k:"all",l:"Tous"},...Object.entries(allCats).map(([k,c])=>({k,l:c.short}))].map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"5px 13px",borderRadius:20,fontSize:12,border:"1px solid var(--bs)",background:filter===f.k?"var(--ac)":"var(--card)",color:filter===f.k?"#fff":"var(--ts)",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}}>{f.l}</button>
          ))}
        </div>
      )}
      <div style={{padding:"4px 16px 0",display:"flex",flexDirection:"column",gap:8}}>
        {sorted.length?sorted.map(e=>(
          <EntryCard key={e.id} entry={e} entryDocs={docs[e.id]||[]} allCats={allCats} clickable={true} onClick={()=>onOpenModal(e)} onViewDoc={onViewDoc}/>
        )):<EmptyState icon={Search} title={q?"Aucun résultat":"Aucune entrée"} sub={q?`Aucune entrée ne correspond à "${q}".`:"Essayez une autre catégorie."}/>}
      </div>
      <div style={{height:8}}/>
    </div>
  );
}

// ─── RapportScreen ────────────────────────────────────────────
function RapportScreen({entries,allCats}){
  const monthly=useMemo(()=>getMonthlyData(entries),[entries]);
  const wp=entries.filter(e=>e.price!=null&&!isNaN(parseFloat(e.price)));
  const tot=wp.reduce((s,e)=>s+parseFloat(e.price),0);
  const catData=Object.entries(allCats).map(([k,c])=>{
    const ces=entries.filter(e=>e.cat===k);
    const cwp=ces.filter(e=>e.price!=null&&!isNaN(parseFloat(e.price)));
    return{k,c,ces,cwp,sum:cwp.reduce((s,e)=>s+parseFloat(e.price),0)};
  }).filter(d=>d.ces.length>0).sort((a,b)=>b.sum-a.sum);
  const mx=Math.max(...catData.map(d=>d.sum),1);
  const TT=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    return<div style={{background:"var(--card)",border:"1px solid var(--b)",borderRadius:10,padding:"8px 12px",fontSize:13}}>
      <div style={{fontWeight:600,color:"var(--tp)",marginBottom:2}}>{label}</div>
      <div style={{color:"var(--ac)"}}>{payload[0].value.toFixed(2).replace(".",",")} €</div>
      <div style={{color:"var(--ts)",fontSize:11}}>{payload[1]?.value||0} entrées</div>
    </div>;
  };
  return(
    <div className="fu">
      <div style={{padding:"16px 20px 12px",background:"var(--card)",borderBottom:"1px solid var(--b)",position:"sticky",top:0,zIndex:10}}>
        <h1 style={{fontSize:20,fontWeight:700,color:"var(--tp)"}}>Rapport</h1>
        <p style={{fontSize:13,color:"var(--ts)",marginTop:2}}>Synthèse de vos dépenses</p>
      </div>
      {entries.length===0?<EmptyState icon={BarChart2} title="Aucune donnée" sub="Ajoutez des suivis pour voir votre rapport."/>:<>
        <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"14px 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Vue d'ensemble</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 16px"}}>
          {[{label:"Total dépensé",val:`${tot.toFixed(2).replace(".",",")} €`,sub:`${wp.length} avec prix`},{label:"Entrées totales",val:entries.length,sub:`${Object.keys(allCats).filter(k=>entries.some(e=>e.cat===k)).length} catégories actives`}].map((s,i)=>(
            <div key={i} style={{background:"var(--card)",border:"1px solid var(--b)",borderRadius:14,padding:14}}>
              <div style={{fontSize:11,color:"var(--ts)",textTransform:"uppercase",letterSpacing:".06em",fontWeight:600}}>{s.label}</div>
              <div style={{fontSize:22,fontWeight:700,color:"var(--tp)",marginTop:4}}>{s.val}</div>
              <div style={{fontSize:11,color:"var(--ts)",marginTop:2}}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"14px 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Dépenses mensuelles</div>
        <div style={{margin:"0 16px",padding:16,background:"var(--card)",border:"1px solid var(--b)",borderRadius:14}}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthly} margin={{top:4,right:4,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--b)" vertical={false}/>
              <XAxis dataKey="label" tick={{fontSize:11,fill:"var(--ts)"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:11,fill:"var(--ts)"}} axisLine={false} tickLine={false}/>
              <Tooltip content={<TT/>}/>
              <Bar dataKey="total" fill="var(--ac)" radius={[6,6,0,0]}/>
              <Bar dataKey="count" fill="var(--al)" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8}}>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--ts)"}}><div style={{width:10,height:10,borderRadius:3,background:"var(--ac)"}}/>Dépenses (€)</div>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"var(--ts)"}}><div style={{width:10,height:10,borderRadius:3,background:"var(--al)"}}/>Nb entrées</div>
          </div>
        </div>
        <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"14px 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Par catégorie</div>
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
          {catData.map(d=>(
            <div key={d.k} style={{background:"var(--card)",border:"1px solid var(--b)",borderRadius:14,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--tp)",display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:7,background:d.c.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><CatIcon cat={d.c} size={14}/></div>{d.c.short}
                </div>
                <div style={{fontSize:14,fontWeight:600,color:"var(--ac)"}}>{d.sum>0?d.sum.toFixed(2).replace(".",",")+" €":"—"}</div>
              </div>
              {d.sum>0&&<div style={{height:6,background:"var(--muted)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",borderRadius:3,background:d.c.dot,width:`${Math.round(d.sum/mx*100)}%`,transition:"width .5s ease"}}/></div>}
              <div style={{fontSize:11,color:"var(--ts)",marginTop:6}}>{d.ces.length} entrée{d.ces.length>1?"s":""} · {d.cwp.length} avec prix</div>
            </div>
          ))}
        </div>
        <div style={{height:12}}/>
      </>}
    </div>
  );
}

// ─── SettingsScreen ───────────────────────────────────────────
function SettingsScreen({darkMode,setDarkMode,customCats,setCustomCats,entries,onExport,onImport,notifications}){
  const toast=useToast();
  const importRef=useRef();
  const[newCat,setNewCat]=useState({name:"",color:null,icon:ICON_OPTS[0]});
  const[catErr,setCatErr]=useState(false);
  const[importMsg,setImportMsg]=useState(null);
  const[exporting,setExporting]=useState(false);
  const[editingCat,setEditingCat]=useState(null); // {key, name, color, icon}

  // Toutes les catégories (base + custom), sauf cachées
  const allMerged=useMemo(()=>{
    const m={...BASE_CATS,...customCats};
    return Object.entries(m).filter(([,c])=>!c.hidden);
  },[customCats]);

  const addCat=()=>{
    if(!newCat.name.trim()||newCat.color===null){setCatErr(true);return;}
    setCatErr(false);
    const k="c_"+Date.now();
    setCustomCats(p=>({...p,[k]:{label:newCat.name.trim(),short:newCat.name.length>12?newCat.name.substring(0,12)+"…":newCat.name,...COLOR_OPTS[newCat.color],emoji:newCat.icon}}));
    setNewCat({name:"",color:null,icon:ICON_OPTS[0]});
    toast("Catégorie ajoutée !","success");
  };

  const startEdit=(key,cat)=>{
    // Trouve l'index couleur correspondant
    const ci=COLOR_OPTS.findIndex(c=>c.dot===cat.dot);
    setEditingCat({key,name:cat.label,color:ci>=0?ci:0,icon:cat.emoji||ICON_OPTS[0]});
  };

  const saveEdit=()=>{
    if(!editingCat||!editingCat.name.trim())return;
    const{key,name,color,icon}=editingCat;
    const base=BASE_CATS[key];
    const updated={
      ...(base||customCats[key]),
      ...COLOR_OPTS[color],
      label:name.trim(),
      short:name.length>12?name.substring(0,12)+"…":name,
      emoji:icon,
      ...(base?{base:true}:{}),
    };
    setCustomCats(p=>({...p,[key]:updated}));
    setEditingCat(null);
    toast("Catégorie modifiée !","success");
  };

  const delCat=k=>{
    const isBase=!!BASE_CATS[k];
    const label=(customCats[k]||BASE_CATS[k])?.label;
    if(!confirm(`Supprimer "${label}" ?`))return;
    if(isBase){
      // Marquer comme cachée dans customCats
      setCustomCats(p=>({...p,[k]:{...BASE_CATS[k],...(p[k]||{}),hidden:true}}));
    }else{
      setCustomCats(p=>{const n={...p};delete n[k];return n;});
    }
    toast("Catégorie supprimée","info");
  };

  const SL={fontSize:11,color:"var(--ts)",marginBottom:5,display:"block",fontWeight:600,letterSpacing:".05em",textTransform:"uppercase"};
  const SI={width:"100%",padding:"10px 12px",fontSize:14,border:"1px solid var(--bs)",borderRadius:10,background:"var(--input)",color:"var(--tp)",outline:"none",fontFamily:"inherit"};

  return(
    <div className="fu">
      <div style={{padding:"16px 20px 12px",background:"var(--card)",borderBottom:"1px solid var(--b)",position:"sticky",top:0,zIndex:10}}>
        <h1 style={{fontSize:20,fontWeight:700,color:"var(--tp)"}}>Réglages</h1>
        <p style={{fontSize:13,color:"var(--ts)",marginTop:2}}>v{APP_VERSION}</p>
      </div>

      <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"14px 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Affichage</div>
      <div style={{margin:"0 16px 20px",background:"var(--card)",border:"1px solid var(--b)",borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px"}}>
          <div><div style={{fontSize:14,fontWeight:500,color:"var(--tp)"}}>Mode sombre</div><div style={{fontSize:12,color:"var(--ts)",marginTop:2}}>Thème sombre pour l'interface</div></div>
          <Toggle checked={!!darkMode} onChange={v=>setDarkMode(v)}/>
        </div>
      </div>

      <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"0 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Notifications</div>
      <div style={{margin:"0 16px 20px",background:"var(--card)",border:"1px solid var(--b)",borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px"}}>
          <div>
            <div style={{fontSize:14,fontWeight:500,color:"var(--tp)"}}>Rappels de RDV</div>
            <div style={{fontSize:12,color:"var(--ts)",marginTop:2}}>
              {notifications.perm!=="granted"
                ?"Permission non accordée"
                :notifications.enabled
                  ?"Actifs · 3 jours avant le RDV"
                  :"Désactivés"
              }
            </div>
          </div>
          {notifications.perm==="granted"
            ? <Toggle checked={notifications.enabled} onChange={notifications.toggle}/>
            : <button onClick={notifications.request}
                style={{padding:"7px 14px",background:"var(--ac)",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                Activer
              </button>
          }
        </div>
      </div>

      <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"0 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Données</div>
      <div style={{margin:"0 16px 20px",background:"var(--card)",border:"1px solid var(--b)",borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:"1px solid var(--b)"}}>
          <div style={{fontSize:14,fontWeight:500,color:"var(--tp)",marginBottom:4}}>Exporter toutes les données</div>
          <div style={{fontSize:12,color:"var(--ts)",marginBottom:12,lineHeight:1.5}}>Ouvre le menu Android pour enregistrer dans Google Drive, envoyer par email, WhatsApp…</div>
          <button onClick={async()=>{setExporting(true);await onExport();setExporting(false);}} disabled={exporting}
            style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",background:"var(--ac)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:exporting?.6:1}}>
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
            const{ok,msg}=await onImport(f);
            setImportMsg({ok,msg});toast(msg,ok?"success":"error");
            setTimeout(()=>setImportMsg(null),4000);e.target.value="";
          }}/>
          {importMsg&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:10,background:importMsg.ok?"var(--ok-bg)":"var(--er-bg)",border:`1px solid ${importMsg.ok?"var(--ok-b)":"var(--er)"}`,fontSize:13,color:importMsg.ok?"var(--ok-t)":"var(--er)"}}>{importMsg.msg}</div>}
        </div>
      </div>

      {/* ── Gestion des catégories ── */}
      <div style={{fontSize:11,fontWeight:600,color:"var(--ts)",padding:"0 20px 8px",letterSpacing:".07em",textTransform:"uppercase"}}>Catégories</div>
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {allMerged.map(([k,c])=>{
          const isEditing=editingCat?.key===k;
          const entryCount=entries.filter(e=>e.cat===k).length;
          return(
            <div key={k} style={{background:"var(--card)",border:"1px solid var(--b)",borderRadius:14,overflow:"hidden"}}>
              {/* Ligne de résumé */}
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}>
                <div style={{width:32,height:32,borderRadius:8,background:c.dot+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:16}}>
                  {c.emoji?c.emoji:<CatIcon cat={c} size={16}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--tp)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</div>
                  <div style={{fontSize:11,color:"var(--ts)",marginTop:1}}>{entryCount} entrée{entryCount!==1?"s":""}{BASE_CATS[k]?" · par défaut":""}</div>
                </div>
                <button onClick={()=>isEditing?setEditingCat(null):startEdit(k,c)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--ac)",padding:"4px 6px",lineHeight:1,display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:600,fontFamily:"inherit"}}>
                  <Edit2 size={14}/>{isEditing?"Fermer":""}
                </button>
                <button onClick={()=>delCat(k)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--er)",padding:"4px 4px",lineHeight:1}}>
                  <X size={16}/>
                </button>
              </div>
              {/* Formulaire d'édition inline */}
              {isEditing&&(
                <div style={{borderTop:"1px solid var(--b)",padding:"12px 12px 14px",background:"var(--muted)"}}>
                  <input value={editingCat.name} onChange={e=>setEditingCat(p=>({...p,name:e.target.value}))} placeholder="Nom…" maxLength={24} style={{...SI,marginBottom:10}}/>
                  <label style={SL}>Couleur</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:10}}>
                    {COLOR_OPTS.map((co,i)=>(<div key={i} onClick={()=>setEditingCat(p=>({...p,color:i}))} style={{width:28,height:28,borderRadius:"50%",background:co.dot,cursor:"pointer",border:editingCat.color===i?"2.5px solid var(--tp)":"2.5px solid transparent",transform:editingCat.color===i?"scale(1.18)":"none",transition:"transform .1s"}}/>))}
                  </div>
                  <label style={SL}>Icône (emoji)</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                    {ICON_OPTS.map(ic=>(<button key={ic} onClick={()=>setEditingCat(p=>({...p,icon:ic}))} style={{width:34,height:34,borderRadius:8,background:"var(--card)",border:editingCat.icon===ic?"1.5px solid var(--ac)":"1px solid var(--b)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{ic}</button>))}
                  </div>
                  <button onClick={saveEdit} style={{width:"100%",padding:"10px",background:"var(--ac)",color:"#fff",border:"none",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    <Check size={14} style={{verticalAlign:"middle",marginRight:5}}/>Enregistrer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Nouvelle catégorie */}
      <div style={{margin:"0 16px 16px",background:"var(--card)",border:"1px solid var(--b)",borderRadius:14,padding:16}}>
        <div style={{fontSize:13,fontWeight:600,color:"var(--tp)",marginBottom:14,textTransform:"uppercase",letterSpacing:".05em"}}>Nouvelle catégorie</div>
        <input value={newCat.name} onChange={e=>setNewCat(p=>({...p,name:e.target.value}))} placeholder="Nom de la catégorie…" maxLength={24} style={{...SI,marginBottom:14}}/>
        <label style={SL}>Couleur</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>
          {COLOR_OPTS.map((c,i)=>(<div key={i} onClick={()=>setNewCat(p=>({...p,color:i}))} style={{width:30,height:30,borderRadius:"50%",background:c.dot,cursor:"pointer",border:newCat.color===i?"2.5px solid var(--tp)":"2.5px solid transparent",transform:newCat.color===i?"scale(1.18)":"none",transition:"transform .1s"}}/>))}
        </div>
        <label style={SL}>Icône (emoji)</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
          {ICON_OPTS.map(ic=>(<button key={ic} onClick={()=>setNewCat(p=>({...p,icon:ic}))} style={{width:36,height:36,borderRadius:9,background:"var(--muted)",border:newCat.icon===ic?"1px solid var(--ac)":"1px solid var(--b)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{ic}</button>))}
        </div>
        {catErr&&<div style={{fontSize:12,color:"var(--er)",marginBottom:10}}>Veuillez saisir un nom et choisir une couleur.</div>}
        <button onClick={addCat} style={{width:"100%",padding:11,background:"var(--ac)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Ajouter la catégorie</button>
      </div>
      <div style={{height:8}}/>
    </div>
  );
}

// ─── App (racine) ─────────────────────────────────────────────
function App(){
  const[entries,setEntries]       =useStorage("tr-entries",[]);
  const[customCats,setCustomCats] =useStorage("tr-custom-cats",{});
  const[darkMode,setDarkMode]     =useStorage("tr-dark",true);
  const[docs,setDocs]             =useState({});

  // Navigation avec historique pour le bouton retour Android
  const[screen,setScreen]         =useState("home");
  const[navStack,setNavStack]     =useState([]);
  const[histFilter,setHistFilter] =useState("all");
  const[viewerState,setViewerState]=useState(null);
  const[modalEntry,setModalEntry] =useState(null);
  const[editingId,setEditingId]   =useState(null);

  const allCats=useMemo(()=>{const m={...BASE_CATS,...customCats};return Object.fromEntries(Object.entries(m).filter(([,c])=>!c.hidden));},[customCats]);
  const editingEntry=useMemo(()=>editingId!=null?entries.find(e=>e.id===editingId):null,[editingId,entries]);
  const editingDocs =useMemo(()=>editingId!=null?(docs[editingId]||[]):[],[editingId,docs]);

  useEffect(()=>{loadAllDocs().then(setDocs);},[]);

  // Dark mode + status bar Android
  useEffect(()=>{
    document.documentElement[darkMode?"setAttribute":"removeAttribute"]("data-dark","");
    window.__applyStatusBar?.(!!darkMode); // Mithril-Anneau: #080B12 dark / #F2EDE4 light
  },[darkMode]);

  const toast         =useToast();
  const notifications =useNotifications(entries,toast);
  const upcomingCount =useMemo(()=>entries.filter(e=>{if(!e.next)return false;const d=daysUntil(e.next);return d>=0&&d<=3;}).length,[entries]);

  // ── Navigation ──────────────────────────────────────────────
  const navigate=useCallback((to,opts={})=>{
    setNavStack(prev=>opts.replace?prev:[...prev,screen]);
    setScreen(to);
    if(to==="add"&&!opts.keepEditing)setEditingId(null);
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
  window.__goHome=()=>{setNavStack([]);setScreen("home");setEditingId(null);};

  // ── Viewer ───────────────────────────────────────────────────
  const openViewer =useCallback((list,idx)=>setViewerState({docs:list,idx}),[]);
  const closeViewer=useCallback(()=>setViewerState(null),[]);

  // ── CRUD ────────────────────────────────────────────────────
  const handleSave=useCallback(async(data,pendingDocs,isEdit)=>{
    if(isEdit&&editingId!=null){
      setEntries(prev=>prev.map(e=>e.id===editingId?{...e,...data}:e));
      if(pendingDocs.length>0){setDocs(prev=>({...prev,[editingId]:pendingDocs}));await saveDocForEntry(editingId,pendingDocs);}
      setEditingId(null);
    }else{
      const id=Date.now();
      setEntries(prev=>[{id,...data},...prev]);
      if(pendingDocs.length){setDocs(prev=>({...prev,[id]:pendingDocs}));await saveDocForEntry(id,pendingDocs);}
    }
  },[editingId,setEntries]);

  const handleDelete=useCallback(async id=>{
    setEntries(prev=>prev.filter(e=>e.id!==id));
    setDocs(prev=>{const n={...prev};delete n[id];return n;});
    await deleteDocForEntry(id);
    toast("Entrée supprimée","info");
  },[setEntries,toast]);

  const handleEdit=useCallback(id=>{setEditingId(id);navigate("add",{keepEditing:true});},[navigate]);

  // ── Export ─────────────────────────────────────────────────
  const handleExport=useCallback(async()=>{
    const payload={version:2,exportDate:new Date().toISOString(),entries,docs,customCats};
    const jsonStr=JSON.stringify(payload,null,2);
    const fileName="suivi-divers-"+todayStr()+".json";

    // Méthode 1 : Capacitor Filesystem + Share (APK Android)
    // window.__exportData est injecté par main.jsx
    if(window.__exportData){
      const res=await window.__exportData(jsonStr,fileName);
      if(res.canceled){toast("Partage annulé","info");return;}
      if(res.ok){toast("Sauvegarde partagée !","success");return;}
      // Si erreur Capacitor → fallback ci-dessous
    }

    // Méthode 2 : Web Share API (navigateur mobile supportant l'API)
    try{
      const blob=new Blob([jsonStr],{type:"application/json"});
      const file=new File([blob],fileName,{type:"application/json"});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:"Suivi Divers — Sauvegarde"});
        toast("Partage ouvert !","success");return;
      }
    }catch(e){if(e.name==="AbortError"){toast("Partage annulé","info");return;}}

    // Méthode 3 : téléchargement classique (navigateur desktop)
    const blob=new Blob([jsonStr],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=fileName;a.click();
    URL.revokeObjectURL(url);
    toast("Fichier exporté !","success");
  },[entries,docs,customCats,toast]);

  // ── Import ───────────────────────────────────────────────────
  const handleImport=useCallback(async file=>{
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      if(!Array.isArray(data.entries))throw new Error("Format invalide");
      setEntries(data.entries);
      if(data.customCats)setCustomCats(data.customCats);
      const newDocs=data.docs||{};
      setDocs(newDocs);
      await Promise.all(Object.entries(newDocs).map(([id,d])=>saveDocForEntry(id,d)));
      return{ok:true,msg:`${data.entries.length} entrées importées.`};
    }catch{return{ok:false,msg:"Fichier d'import invalide."};}
  },[setEntries,setCustomCats]);

  // ── NavBtn ───────────────────────────────────────────────────
  const NavBtn=({id,label,icon:Icon,badge})=>(
    <button onClick={()=>navigate(id)}
      style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",background:"none",border:"none",padding:"4px 0",color:screen===id?"var(--ac)":"var(--th)",fontSize:10,fontFamily:"inherit",transition:"color .15s",position:"relative"}}>
      <div style={{position:"relative"}}>
        <Icon size={20} strokeWidth={screen===id?2:1.8}/>
        {badge>0&&<div style={{position:"absolute",top:-4,right:-6,width:14,height:14,borderRadius:"50%",background:"var(--warn)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff"}}>{badge}</div>}
      </div>
      {label}
    </button>
  );

  return(
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",justifyContent:"center",padding:16,minHeight:"100vh",background:"var(--bg)",transition:"background .25s"}}>
        <div style={{maxWidth:390,width:"100%",background:"var(--bg)",minHeight:640,borderRadius:22,border:"1px solid var(--b)",overflow:"hidden",display:"flex",flexDirection:"column",position:"relative",transition:"background .25s,border-color .25s"}}>
          <div style={{flex:1,overflowY:"auto",paddingBottom:72}}>

            {screen==="home"&&
              <HomeScreen entries={entries} docs={docs} allCats={allCats} upcomingCount={upcomingCount} darkMode={darkMode}
                onFilterHistory={cat=>{setHistFilter(cat);navigate("history");}}/>}

            {screen==="history"&&
              <HistoryScreen entries={entries} docs={docs} allCats={allCats} filter={histFilter} setFilter={setHistFilter}
                onOpenModal={e=>setModalEntry(e)} onViewDoc={openViewer}/>}

            {screen==="add"&&(
              <>
                <div style={{padding:"16px 20px 12px",background:"var(--card)",borderBottom:"1px solid var(--b)",position:"sticky",top:0,zIndex:10}}>
                  <h1 style={{fontSize:20,fontWeight:700,color:"var(--tp)"}}>{editingId?"Modifier l'entrée":"Nouvel enregistrement"}</h1>
                  <p style={{fontSize:13,color:"var(--ts)",marginTop:2}}>{editingId?"Mettez à jour les informations":"Ajoutez un suivi en 3 étapes"}</p>
                </div>
                <FormStepper allCats={allCats} editingEntry={editingEntry} editingDocs={editingDocs}
                  onSave={handleSave} onCancelEdit={()=>{setEditingId(null);navigate("home",{replace:true});}}/>
              </>
            )}

            {screen==="rapport"&&<RapportScreen entries={entries} allCats={allCats}/>}

            {screen==="settings"&&
              <SettingsScreen darkMode={darkMode} setDarkMode={setDarkMode} customCats={customCats} setCustomCats={setCustomCats}
                entries={entries} onExport={handleExport} onImport={handleImport} notifications={notifications}/>}
          </div>

          <nav style={{position:"absolute",bottom:0,left:0,right:0,background:"var(--nav)",borderTop:"2px solid var(--nav-border, var(--b))",display:"flex",padding:"6px 0 10px",zIndex:20,transition:"background .25s"}}>
            <NavBtn id="home"     label="Accueil"    icon={Home}     badge={upcomingCount}/>
            <NavBtn id="history"  label="Historique" icon={BookOpen}/>
            <NavBtn id="rapport"  label="Rapport"    icon={BarChart2}/>
            <NavBtn id="settings" label="Réglages"   icon={Settings}/>
          </nav>
          {/* FAB flottant */}
          <button onClick={()=>navigate("add")} style={{position:"absolute",bottom:62,right:18,width:52,height:52,borderRadius:"50%",background:"var(--ac)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 18px rgba(0,0,0,.38)",zIndex:25,transition:"transform .15s,box-shadow .15s"}}
            onMouseDown={e=>e.currentTarget.style.transform="scale(.92)"}
            onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
            onTouchStart={e=>e.currentTarget.style.transform="scale(.92)"}
            onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
            <Plus size={26} color="#fff" strokeWidth={2.5}/>
          </button>
        </div>
      </div>

      {modalEntry&&
        <EntryModal entry={modalEntry} entryDocs={docs[modalEntry.id]||[]} allCats={allCats}
          onClose={()=>setModalEntry(null)} onEdit={handleEdit} onDelete={handleDelete} onViewDoc={openViewer}/>}

      {viewerState&&
        <Viewer docs={viewerState.docs} idx={viewerState.idx} onClose={closeViewer}
          onNav={dir=>setViewerState(s=>({...s,idx:Math.max(0,Math.min(s.docs.length-1,s.idx+dir))}))}/>}
    </>
  );
}

// ─── Export unique ────────────────────────────────────────────
export default function SuiviDivers(){
  return <ToastProvider><App/></ToastProvider>;
}
