import { useState, useEffect } from "react";

/* ══════════════════════════════════════════════════════════════
   Supabase Config
══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://wbomikniccwwbdxujhcc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib21pa25pY2N3d2JkeHVqaGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzQ0NjgsImV4cCI6MjA5MDYxMDQ2OH0.SzwcSJaO28QLHvn4Zq7YMzApY-z6nWdZXKQhS5O5QpY";
const HDR  = { apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, "Content-Type":"application/json", Prefer:"return=representation" };
const BASE = `${SUPABASE_URL}/rest/v1`;

export const sb = {
  async getAll(table, qs="") {
    const r = await fetch(`${BASE}/${table}?select=*${qs}`, { headers:HDR });
    if (!r.ok) throw new Error(`[${table}] ${await r.text()}`);
    return r.json();
  },
  async upsert(table, record) {
    const r = await fetch(`${BASE}/${table}`, { method:"POST", headers:{...HDR,Prefer:"resolution=merge-duplicates,return=representation"}, body:JSON.stringify(record) });
    if (!r.ok) throw new Error(`[${table}] ${await r.text()}`);
    return r.json();
  },
  async upsertMany(table, records) {
    if (!records.length) return;
    const r = await fetch(`${BASE}/${table}`, { method:"POST", headers:{...HDR,Prefer:"resolution=merge-duplicates,return=representation"}, body:JSON.stringify(records) });
    if (!r.ok) throw new Error(`[${table}] ${await r.text()}`);
    return r.json();
  },
  async del(table, id) {
    const r = await fetch(`${BASE}/${table}?id=eq.${encodeURIComponent(id)}`, { method:"DELETE", headers:HDR });
    if (!r.ok) throw new Error(`[${table}] ${await r.text()}`);
  },
};

/* ══════════════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════════════ */
export const uid     = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36);
export const today   = () => new Date().toISOString().slice(0,10);
export const fmt     = n  => `₹${Number(n||0).toFixed(2)}`;
export const fmtDate = d  => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d; }};
export const toISO   = d  => { if (!d) return today(); if (d instanceof Date) return d.toISOString().slice(0,10); if (typeof d==="number") return new Date(Math.round((d-25569)*86400*1000)).toISOString().slice(0,10); return String(d).slice(0,10); };

/* ══════════════════════════════════════════════════════════════
   Auth helpers
══════════════════════════════════════════════════════════════ */
export async function hashPassword(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
export const IS_HASH = s => typeof s==="string" && /^[0-9a-f]{64}$/.test(s);
export const SESSION_TTL = 8 * 60 * 60 * 1000;

export async function getDBCreds() {
  try {
    const rows = await sb.getAll("settings", "&id=eq.credentials");
    if (rows && rows.length > 0) return rows[0];
    const hashed = await hashPassword("admin123");
    const def = { id:"credentials", username:"admin", password:hashed };
    await sb.upsert("settings", def);
    return def;
  } catch {
    return { id:"credentials", username:"admin", password:null };
  }
}
export async function saveDBCreds(c) {
  const hashed = await hashPassword(c.password);
  await sb.upsert("settings", { id:"credentials", username:c.username, password:hashed });
}
export async function getShopGST() {
  try {
    const rows = await sb.getAll("settings", "&id=eq.shop_info");
    return rows?.[0]?.gst_no || "";
  } catch { return ""; }
}
export async function saveShopGST(gst_no) {
  await sb.upsert("settings", { id:"shop_info", gst_no });
}

export function isLoggedIn() {
  try {
    const raw = localStorage.getItem("stow_session");
    if (!raw) return false;
    const { exp } = JSON.parse(atob(raw));
    return Date.now() < exp;
  } catch { return false; }
}
export function setSession(u) {
  const token = btoa(JSON.stringify({ user:u, exp:Date.now()+SESSION_TTL, nonce:crypto.randomUUID() }));
  localStorage.setItem("stow_session", token);
}
export function clearSession() { localStorage.removeItem("stow_session"); }
export function getSession() {
  try {
    const raw = localStorage.getItem("stow_session");
    if (!raw) return "";
    const { user, exp } = JSON.parse(atob(raw));
    return Date.now() < exp ? user : "";
  } catch { return ""; }
}

/* ══════════════════════════════════════════════════════════════
   Icons
══════════════════════════════════════════════════════════════ */
export const I = ({ n, s=16 }) => {
  const p = {
    dash:   <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    inv:    <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    sale:   <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    cust:   <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    rpt:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    debt:   <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    exp:    <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    plus:   <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash:  <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    edit:   <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    check:  <><polyline points="20 6 9 17 4 12"/></>,
    close:  <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    warn:   <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    db:     <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    import: <><polyline points="8 16 12 20 16 16"/><line x1="12" y1="12" x2="12" y2="20"/><path d="M20.39 5.39A5 5 0 0 0 18 4h-1.26A8 8 0 1 0 3 12.3"/></>,
    print:  <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    key:    <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,
    money:  <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    menu:   <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    user:   <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    supp:   <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><path d="M12 12v4"/><path d="M10 14h4"/></>,
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {p[n]||null}
    </svg>
  );
};

/* ══════════════════════════════════════════════════════════════
   Shared UI Components
══════════════════════════════════════════════════════════════ */
export function Fld({ label, value, onChange, type="text", ph="", readOnly }) {
  return (
    <div>
      {label&&<label style={C.lbl}>{label}</label>}
      <input style={{...C.inp,opacity:readOnly?.65:1,cursor:readOnly?"default":"text"}} type={type} value={value||""} readOnly={readOnly}
        onChange={e=>onChange&&onChange(e.target.value)} placeholder={ph}/>
    </div>
  );
}
export function ST({ children, style:sx }) {
  return <div style={{fontWeight:700,color:"#8fa4bc",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:12,...sx}}>{children}</div>;
}
export function MT({ text }) {
  return <div style={{color:"#71849b",textAlign:"center",padding:"28px 0",fontSize:13}}>{text}</div>;
}
export function SRow({ l, v, c, b }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13,color:"#94a3b8"}}>
      <span>{l}</span>
      <span style={{fontWeight:b?700:500,color:c||"#e7edf5"}}>{v}</span>
    </div>
  );
}
export function StatC({ label, val, sub, acc }) {
  return (
    <div style={{...C.card,borderTop:`3px solid ${acc}`,padding:"14px 16px"}}>
      <div style={{color:"#94a3b8",fontSize:10,marginBottom:4}}>{label}</div>
      <div style={{fontSize:20,fontWeight:800,color:acc,letterSpacing:-1}}>{val}</div>
      <div style={{color:"#71849b",fontSize:10,marginTop:3}}>{sub}</div>
    </div>
  );
}

export function useToast() {
  const [t, setT] = useState(null);
  const show = (msg, type="ok") => { setT({msg,type}); setTimeout(()=>setT(null),3000); };
  return [t, show];
}
export function Toast({ t }) {
  if (!t) return null;
  const bg = t.type==="err"?"#ef4444":t.type==="warn"?"#f59e0b":"#22c55e";
  return (
    <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:bg,color:"#fff",padding:"12px 24px",borderRadius:12,fontWeight:600,fontSize:14,zIndex:9999,boxShadow:"0 4px 24px rgba(0,0,0,.6)",whiteSpace:"nowrap",maxWidth:"90vw"}}>
      {t.msg}
    </div>
  );
}

export function useIsMobile() {
  const [m, setM] = useState(typeof window!=="undefined"&&window.innerWidth<769);
  useEffect(()=>{ const h=()=>setM(window.innerWidth<769); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);
  return m;
}

/* ══════════════════════════════════════════════════════════════
   Styles
══════════════════════════════════════════════════════════════ */
export const C = {
  app:    {display:"flex",height:"100vh",width:"100%",background:"#061426",fontFamily:"'DM Sans',system-ui,sans-serif",overflow:"hidden"},
  sb:     {width:200,background:"#07172b",borderRight:"1px solid #19385a",display:"flex",flexDirection:"column",padding:"14px 10px",flexShrink:0},
  brand:  {display:"flex",alignItems:"center",gap:10,marginBottom:22,paddingLeft:4},
  bIcon:  {width:32,height:32,background:"linear-gradient(135deg,#1976d2,#125a9f)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,color:"#f5f7fa",flexShrink:0},
  bName:  {fontWeight:900,fontSize:13,color:"#f5f7fa",letterSpacing:1},
  bSub:   {fontSize:9,color:"#657b95",letterSpacing:.5},
  nav:    {display:"flex",alignItems:"center",gap:8,padding:"9px 10px",background:"none",border:"none",borderRadius:8,color:"#71849b",cursor:"pointer",fontSize:12,fontWeight:500,textAlign:"left",width:"100%",minHeight:38},
  navA:   {background:"rgba(25,118,210,.14)",color:"#3b82f6"},
  sbFoot: {paddingTop:12,borderTop:"1px solid #19385a"},
  main:   {flex:1,minWidth:0,overflow:"hidden",display:"flex",flexDirection:"column"},
  pg:     {maxWidth:1400,margin:"0 auto",width:"100%"},
  h1:     {fontSize:20,fontWeight:800,color:"#f5f7fa",marginBottom:16,letterSpacing:-.5},
  phdr:   {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16},
  g4:     {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18},
  g3:     {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10},
  two:    {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  card:   {background:"#0b1d35",border:"1px solid #19385a",borderRadius:12,padding:"16px 18px",marginBottom:0},
  row:    {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid #153453"},
  alertW: {display:"flex",gap:8,alignItems:"flex-start",background:"rgba(25,118,210,.07)",border:"1px solid rgba(59,130,246,.32)",borderRadius:8,padding:"10px 12px",color:"#f59e0b",fontSize:13},
  tbl:    {background:"#0b1d35",border:"1px solid #19385a",borderRadius:12,overflow:"hidden"},
  tr:     {display:"grid",gap:8,padding:"11px 14px",borderBottom:"1px solid #153453",fontSize:13,alignItems:"center",color:"#d7e0eb"},
  th:     {color:"#7189a5",fontSize:10,textTransform:"uppercase",letterSpacing:1,fontWeight:700,background:"#07162a"},
  lbl:    {display:"block",fontSize:11,color:"#71849b",marginBottom:5,textTransform:"uppercase",letterSpacing:.5},
  inp:    {width:"100%",background:"#0c203b",border:"1px solid #19385a",borderRadius:8,padding:"10px 12px",color:"#f5f7fa",fontSize:14,outline:"none",boxSizing:"border-box"},
  srch:   {width:"100%",background:"#0b1d35",border:"1px solid #19385a",borderRadius:10,padding:"11px 14px",color:"#f5f7fa",fontSize:14,outline:"none",marginBottom:14,boxSizing:"border-box"},
  btnP:   {display:"flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#1976d2,#155fa8)",color:"#f5f7fa",border:"none",borderRadius:9,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"},
  btnG:   {display:"flex",alignItems:"center",gap:6,background:"transparent",color:"#94a3b8",border:"1px solid #2a4d73",borderRadius:9,padding:"9px 14px",fontWeight:500,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"},
  iBtn:   {background:"transparent",border:"1px solid #19385a",borderRadius:7,padding:"6px 8px",color:"#71849b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  splash: {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#061426"},
  logo:   {fontSize:48,fontWeight:900,letterSpacing:8,color:"#3b82f6",marginBottom:6},
  spinner:{width:28,height:28,border:"3px solid #19385a",borderTop:"3px solid #3b82f6",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"18px auto"},
};
