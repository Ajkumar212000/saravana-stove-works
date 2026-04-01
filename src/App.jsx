import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";

/* ══════════════════════════════════════════════════════════════
   Supabase Config
══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://wbomikniccwwbdxujhcc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib21pa25pY2N3d2JkeHVqaGNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzQ0NjgsImV4cCI6MjA5MDYxMDQ2OH0.SzwcSJaO28QLHvn4Zq7YMzApY-z6nWdZXKQhS5O5QpY";
const HDR  = { apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, "Content-Type":"application/json", Prefer:"return=representation" };
const BASE = `${SUPABASE_URL}/rest/v1`;

const sb = {
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
const uid     = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36);
const today   = () => new Date().toISOString().slice(0,10);
const fmt     = n  => `₹${Number(n||0).toFixed(2)}`;
const fmtDate = d  => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d; }};
const toISO   = d  => { if (!d) return today(); if (d instanceof Date) return d.toISOString().slice(0,10); if (typeof d==="number") return new Date(Math.round((d-25569)*86400*1000)).toISOString().slice(0,10); return String(d).slice(0,10); };

/* ══════════════════════════════════════════════════════════════
   Login helpers (localStorage)
══════════════════════════════════════════════════════════════ */
const AUTH_KEY = "stow_auth";
function getStoredCreds() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || {username:"admin",password:"admin123"}; }
  catch { return {username:"admin",password:"admin123"}; }
}
function saveStoredCreds(c) { localStorage.setItem(AUTH_KEY, JSON.stringify(c)); }
function isLoggedIn() { return !!localStorage.getItem("stow_session"); }
function setSession(u) { localStorage.setItem("stow_session", u); }
function clearSession() { localStorage.removeItem("stow_session"); }
function getSession() { return localStorage.getItem("stow_session")||""; }

/* ══════════════════════════════════════════════════════════════
   Icons
══════════════════════════════════════════════════════════════ */
const I = ({ n, s=16 }) => {
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
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {p[n]||null}
    </svg>
  );
};

/* ══════════════════════════════════════════════════════════════
   Shared UI
══════════════════════════════════════════════════════════════ */
function Fld({ label, value, onChange, type="text", ph="", readOnly }) {
  return (
    <div>
      {label&&<label style={C.lbl}>{label}</label>}
      <input style={{...C.inp,opacity:readOnly?.65:1,cursor:readOnly?"default":"text"}} type={type} value={value||""} readOnly={readOnly}
        onChange={e=>onChange&&onChange(e.target.value)} placeholder={ph}/>
    </div>
  );
}
function ST({ children, style:sx }) {
  return <div style={{fontWeight:700,color:"#94a3b8",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:12,...sx}}>{children}</div>;
}
function MT({ text }) {
  return <div style={{color:"#64748b",textAlign:"center",padding:"28px 0",fontSize:13}}>{text}</div>;
}
function SRow({ l, v, c, b }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,color:"#94a3b8"}}>
      <span>{l}</span>
      <span style={{fontWeight:b?700:500,color:c||"#e2e8f0"}}>{v}</span>
    </div>
  );
}
function StatC({ label, val, sub, acc }) {
  return (
    <div style={{...C.card,borderTop:`3px solid ${acc}`,padding:"14px 18px"}}>
      <div style={{color:"#94a3b8",fontSize:11,marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color:acc,letterSpacing:-1}}>{val}</div>
      <div style={{color:"#64748b",fontSize:11,marginTop:3}}>{sub}</div>
    </div>
  );
}

/* ── Toast notification ── */
function useToast() {
  const [t, setT] = useState(null);
  const show = (msg, type="ok") => { setT({msg,type}); setTimeout(()=>setT(null),3000); };
  return [t, show];
}
function Toast({ t }) {
  if (!t) return null;
  const bg = t.type==="err"?"#ef4444":t.type==="warn"?"#f59e0b":"#10b981";
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:bg,color:"#fff",padding:"10px 22px",borderRadius:10,fontWeight:600,fontSize:13,zIndex:9999,boxShadow:"0 4px 24px rgba(0,0,0,.5)"}}>
      {t.msg}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LOGIN SCREEN
══════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const [user,  setUser]  = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);
  const [showP, setShowP] = useState(false);

  const doLogin = () => {
    if (!user.trim()||!pass) return setErr("Please enter both username and password.");
    setBusy(true); setErr("");
    const creds = getStoredCreds();
    setTimeout(()=>{  // tiny delay for UX feel
      if (user.trim()===creds.username && pass===creds.password) {
        setSession(user.trim()); onLogin(user.trim());
      } else {
        setErr("Incorrect username or password.");
      }
      setBusy(false);
    }, 400);
  };

  return (
    <div style={{minHeight:"100vh",background:"#060a10",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>
      <div style={{width:"100%",maxWidth:360,animation:"fadeUp .35s ease"}}>

        {/* Brand */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",width:68,height:68,background:"linear-gradient(135deg,#f59e0b,#92400e)",borderRadius:20,alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900,color:"#0d1117",marginBottom:16,boxShadow:"0 0 48px rgba(245,158,11,.25)"}}>S</div>
          <div style={{fontSize:38,fontWeight:900,letterSpacing:8,color:"#f0f6ff",lineHeight:1}}>Saravana Stove Works</div>
          <div style={{color:"#475569",fontSize:11,letterSpacing:3,marginTop:8}}>WHOLESALE & RETAIL</div>
        </div>

        {/* Card */}
        <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:16,padding:"32px 28px"}}>
          <div style={{marginBottom:14}}>
            <label style={C.lbl}>Username</label>
            <input style={C.inp} value={user} onChange={e=>setUser(e.target.value)} placeholder="admin"
              onKeyDown={e=>e.key==="Enter"&&doLogin()} autoFocus/>
          </div>
          <div style={{marginBottom:16,position:"relative"}}>
            <label style={C.lbl}>Password</label>
            <input style={C.inp} type={showP?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
              onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            <button onClick={()=>setShowP(s=>!s)}
              style={{position:"absolute",right:10,top:26,background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:11,padding:"2px 4px"}}>
              {showP?"Hide":"Show"}
            </button>
          </div>

          {err&&(
            <div style={{marginBottom:14,padding:"9px 12px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",borderRadius:8,color:"#f87171",fontSize:12}}>
              {err}
            </div>
          )}

          <button onClick={doLogin} disabled={busy}
            style={{width:"100%",padding:"13px 0",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#0d1117",border:"none",borderRadius:10,fontWeight:800,fontSize:14,cursor:"pointer",opacity:busy?.6:1,letterSpacing:.3}}>
            {busy?"Signing in…":"Sign In →"}
          </button>

          <div style={{marginTop:18,padding:"10px 12px",background:"rgba(245,158,11,.04)",border:"1px solid rgba(245,158,11,.1)",borderRadius:8,fontSize:11,color:"#64748b",textAlign:"center"}}>
            <span style={{fontSize:10,color:"#475569"}}>Change password in Settings after login</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Change Password Modal
══════════════════════════════════════════════════════════════ */
function ChangePwModal({ onClose }) {
  const [f, setF] = useState({old:"",n1:"",n2:""});
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  const save = () => {
    const creds = getStoredCreds();
    if (f.old !== creds.password) return setErr("Current password is incorrect.");
    if (!f.n1) return setErr("New password cannot be empty.");
    if (f.n1 !== f.n2) return setErr("New passwords do not match.");
    if (f.n1.length < 4) return setErr("Password must be at least 4 characters.");
    saveStoredCreds({...creds, password:f.n1});
    setOk(true); setErr("");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
      <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:14,padding:"28px 24px",width:"100%",maxWidth:340}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:700,color:"#f0f6ff",fontSize:15}}>Change Password</div>
          <button style={{background:"none",border:"none",color:"#64748b",cursor:"pointer"}} onClick={onClose}><I n="close" s={16}/></button>
        </div>
        {ok ? (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:32,marginBottom:8}}>✅</div>
            <div style={{color:"#10b981",fontWeight:600,marginBottom:16}}>Password changed successfully!</div>
            <button style={C.btnP} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
              <Fld label="Current Password" type="password" value={f.old} onChange={v=>setF(x=>({...x,old:v}))} ph="Current password"/>
              <Fld label="New Password"     type="password" value={f.n1}  onChange={v=>setF(x=>({...x,n1:v}))}  ph="New password"/>
              <Fld label="Confirm New"      type="password" value={f.n2}  onChange={v=>setF(x=>({...x,n2:v}))}  ph="Repeat new password"/>
            </div>
            {err&&<div style={{color:"#f87171",fontSize:12,marginBottom:12,padding:"8px 10px",background:"rgba(239,68,68,.08)",borderRadius:6}}>{err}</div>}
            <div style={{display:"flex",gap:8}}>
              <button style={C.btnP} onClick={save}><I n="check" s={14}/> Save</button>
              <button style={C.btnG} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   App Root
══════════════════════════════════════════════════════════════ */
export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const [uname,  setUname]  = useState(getSession());
  const [data,   setData]   = useState({ products:[], customers:[], sales:[], debtPayments:[], expenses:[] });
  const [tab,    setTab]    = useState("dashboard");
  const [ready,  setReady]  = useState(false);
  const [err,    setErr]    = useState("");
  const [showPw, setShowPw] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [products,customers,sales,debtPayments,expenses] = await Promise.all([
        sb.getAll("products"),
        sb.getAll("customers"),
        sb.getAll("sales","&order=created_at.desc"),
        sb.getAll("debt_payments","&order=created_at.desc"),
        sb.getAll("expenses","&order=created_at.desc"),
      ]);
      setData({ products,customers,sales,debtPayments,expenses });
    } catch(e) { setErr(e.message); }
  }, []);

  useEffect(()=>{ if (authed) refresh().then(()=>setReady(true)); }, [authed]);

  const logout = () => { clearSession(); setAuthed(false); setReady(false); setTab("dashboard"); };

  /* ── Login gate ── */
  if (!authed) return (
    <LoginScreen onLogin={u=>{ setUname(u); setAuthed(true); }}/>
  );

  /* ── Loading ── */
  if (!ready) return (
    <div style={C.splash}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={C.logo}>Stove Works</div>
        <div style={{color:"#64748b",fontSize:12,letterSpacing:3,marginBottom:20}}>Wholesale & Retail</div>
        {err
          ? <div style={{color:"#f87171",fontSize:13,maxWidth:400,padding:"0 20px"}}>{err}</div>
          : <><div style={{color:"#f59e0b",fontSize:12,display:"flex",alignItems:"center",gap:6,justifyContent:"center",marginBottom:12}}><I n="db" s={13}/> Connecting to Supabase…</div><div style={C.spinner}/></>
        }
      </div>
    </div>
  );

  const TABS = [
    {id:"dashboard",label:"Dashboard", n:"dash"},
    {id:"inventory", label:"Inventory",  n:"inv"},
    {id:"sales",     label:"New Sale",   n:"sale"},
    {id:"customers", label:"Customers",  n:"cust"},
    {id:"debts",     label:"Debts",      n:"debt"},
    {id:"expenses",  label:"Expenses",   n:"exp"},
    {id:"reports",   label:"Reports",    n:"rpt"},
    {id:"import",    label:"Import Data",n:"import"},
  ];

  return (
    <div style={C.app}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} body{margin:0} *{box-sizing:border-box} input:focus,select:focus{border-color:#f59e0b!important;outline:none} @media print{.no-print{display:none!important}}`}</style>
      {showPw && <ChangePwModal onClose={()=>setShowPw(false)}/>}

      {/* ── Sidebar ── */}
      <aside style={C.sb} className="no-print">
        <div style={C.brand}>
          <div style={C.bIcon}>S</div>
          <div>
            <div style={C.bName}>Stove Works</div>
            <div style={C.bSub}>Wholesale & Retail</div>
          </div>
        </div>
        <nav style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
          {TABS.map(t=>(
            <button key={t.id} style={{...C.nav,...(tab===t.id?C.navA:{})}} onClick={()=>setTab(t.id)}>
              <I n={t.n} s={14}/> {t.label}
            </button>
          ))}
        </nav>
        <div style={C.sbFoot}>
          <div style={{display:"flex",alignItems:"center",gap:5,color:"#10b981",fontSize:11,marginBottom:6}}>
            <I n="db" s={11}/> Supabase — Cloud DB
          </div>
          <div style={{color:"#64748b",fontSize:11,marginBottom:10}}>👤 {uname} · {fmtDate(today())}</div>
          <button style={{...C.btnG,width:"100%",justifyContent:"center",fontSize:11,padding:"6px 0",marginBottom:6}} onClick={()=>setShowPw(true)}>
            <I n="key" s={12}/> Change Password
          </button>
          <button style={{...C.btnG,width:"100%",justifyContent:"center",fontSize:11,padding:"6px 0",color:"#f87171",borderColor:"rgba(248,113,113,.3)"}} onClick={logout}>
            <I n="logout" s={12}/> Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={C.main}>
        {tab==="dashboard" && <Dashboard  data={data}/>}
        {tab==="inventory" && <Inventory  data={data} refresh={refresh}/>}
        {tab==="sales"     && <Sales      data={data} refresh={refresh} setTab={setTab}/>}
        {tab==="customers" && <Customers  data={data} refresh={refresh}/>}
        {tab==="debts"     && <Debts      data={data} refresh={refresh}/>}
        {tab==="expenses"  && <Expenses   data={data} refresh={refresh}/>}
        {tab==="reports"   && <Reports    data={data} refresh={refresh}/>}
        {tab==="import"    && <ImportData data={data} refresh={refresh}/>}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Dashboard
══════════════════════════════════════════════════════════════ */
function Dashboard({ data }) {
  const { products, customers, sales, expenses } = data;
  const tSales  = sales.filter(s=>s.date===today());
  const tRev    = tSales.reduce((a,s)=>a+s.total,0);
  const tProfit = tSales.reduce((a,s)=>a+s.profit,0);
  const tExp    = expenses.filter(e=>e.date===today()).reduce((a,e)=>a+e.amount,0);
  const totDebt = customers.reduce((a,c)=>a+(c.debt||0),0);
  const lowStk  = products.filter(p=>p.stock<=5&&p.stock>0&&p.sell_price>0);
  const recent  = sales.slice(0,7);

  return (
    <div style={C.pg}>
      <h1 style={C.h1}>Dashboard</h1>
      <div style={C.g4}>
        <StatC label="Today Revenue"    val={fmt(tRev)}           sub={`${tSales.length} sales today`}                     acc="#f59e0b"/>
        <StatC label="Today Net Profit" val={fmt(tProfit-tExp)}   sub="After expenses"                                     acc="#10b981"/>
        <StatC label="Total Debt"       val={fmt(totDebt)}        sub={`${customers.filter(c=>c.debt>0).length} customers`} acc="#ef4444"/>
        <StatC label="Today Expenses"   val={fmt(tExp)}           sub="Salary + others"                                    acc="#818cf8"/>
      </div>

      {lowStk.length>0&&(
        <div style={C.alertW}>
          <I n="warn" s={14}/>
          <span><b>Low Stock:</b> {lowStk.slice(0,6).map(p=>`${p.name} (${p.stock})`).join(" · ")}{lowStk.length>6?` +${lowStk.length-6} more`:""}</span>
        </div>
      )}

      <div style={C.two}>
        <div style={C.card}>
          <ST>Recent Sales</ST>
          {recent.length===0 ? <MT text="No sales yet"/> : recent.map(s=>{
            const c=customers.find(x=>x.id===s.customer_id);
            return (
              <div key={s.id} style={C.row}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:"#f0f6ff"}}>{c?.name||s.walk_in_name||"Walk-in"}</div>
                  <div style={{color:"#64748b",fontSize:11}}>{fmtDate(s.date)} · {(s.items||[]).length} item(s)</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:700,color:"#f59e0b"}}>{fmt(s.total)}</div>
                  <div style={{fontSize:11,color:s.paid<s.total?"#f87171":"#34d399"}}>{s.paid<s.total?`Due ${fmt(s.total-s.paid)}`:"Paid ✓"}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={C.card}>
          <ST>Dealer / Customer Debts</ST>
          {customers.filter(c=>c.debt>0).length===0
            ? <MT text="No outstanding debts 🎉"/>
            : customers.filter(c=>c.debt>0).sort((a,b)=>b.debt-a.debt).map(c=>(
              <div key={c.id} style={C.row}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:"#f0f6ff"}}>{c.name}</div>
                  <div style={{color:"#64748b",fontSize:11}}>{c.phone||"—"}</div>
                </div>
                <div style={{fontWeight:800,color:"#f87171"}}>{fmt(c.debt)}</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Inventory
══════════════════════════════════════════════════════════════ */
function Inventory({ data, refresh }) {
  const blank = {name:"",category:"",buy_price:"",sell_price:"",stock:"",unit:"pcs"};
  const [form, setForm] = useState(blank);
  const [eid,  setEid]  = useState(null);
  const [show, setShow] = useState(false);
  const [srch, setSrch] = useState("");
  const [busy, setBusy] = useState(false);
  const [t, toast] = useToast();

  const save = async () => {
    if (!form.name||form.sell_price===""||form.stock==="") return toast("Fill required fields","err");
    setBusy(true);
    try {
      await sb.upsert("products",{...form,id:eid||uid(),buy_price:+form.buy_price||0,sell_price:+form.sell_price,stock:+form.stock});
      await refresh(); setForm(blank); setEid(null); setShow(false);
      toast(eid?"Product updated ✓":"Product added ✓");
    } finally { setBusy(false); }
  };

  const del = async id => {
    if (!confirm("Delete this product?")) return;
    await sb.del("products",id); await refresh(); toast("Deleted");
  };

  const startEdit = p => { setForm({name:p.name,category:p.category||"",buy_price:p.buy_price,sell_price:p.sell_price,stock:p.stock,unit:p.unit||"pcs"}); setEid(p.id); setShow(true); };

  const filtered = data.products.filter(p=>
    p.name?.toLowerCase().includes(srch.toLowerCase())||(p.category||"").toLowerCase().includes(srch.toLowerCase())
  );

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <div style={C.phdr}>
        <h1 style={C.h1}>Inventory <span style={{fontSize:13,color:"#64748b",fontWeight:400}}>({data.products.length})</span></h1>
        <button style={C.btnP} onClick={()=>{setShow(true);setEid(null);setForm(blank);}}><I n="plus" s={14}/> Add Product</button>
      </div>
      <input style={C.srch} placeholder="Search by name or category…" value={srch} onChange={e=>setSrch(e.target.value)}/>

      {show&&(
        <div style={{...C.card,marginBottom:16}}>
          <ST>{eid?"Edit Product":"New Product"}</ST>
          <div style={C.g3}>
            <Fld label="Product Name *" value={form.name}      onChange={v=>setForm(f=>({...f,name:v}))}/>
            <Fld label="Category"       value={form.category}  onChange={v=>setForm(f=>({...f,category:v}))} ph="Burner, Lighter…"/>
            <Fld label="Buy Price ₹"   type="number" value={form.buy_price}  onChange={v=>setForm(f=>({...f,buy_price:v}))}/>
            <Fld label="Sell Price ₹ *" type="number" value={form.sell_price} onChange={v=>setForm(f=>({...f,sell_price:v}))}/>
            <Fld label="Stock *"        type="number" value={form.stock}      onChange={v=>setForm(f=>({...f,stock:v}))}/>
            <div>
              <label style={C.lbl}>Unit</label>
              <select style={C.inp} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                {["pcs","pack","box","kg","ltr","dozen","set","ft"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={C.btnP} onClick={save} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":eid?"Update":"Add"}</button>
            <button style={C.btnG} onClick={()=>{setShow(false);setEid(null);}}><I n="close" s={14}/> Cancel</button>
          </div>
        </div>
      )}

      <div style={C.tbl}>
        <div style={{...C.tr,...C.th,gridTemplateColumns:"2fr 1fr 90px 90px 70px 90px 70px"}}>
          <span>Product</span><span>Category</span><span>Buy ₹</span><span>Sell ₹</span><span>Margin</span><span>Stock</span><span>Actions</span>
        </div>
        {filtered.length===0?<MT text="No products"/>:filtered.map(p=>(
          <div key={p.id} style={{...C.tr,gridTemplateColumns:"2fr 1fr 90px 90px 70px 90px 70px",...(p.stock<=5&&p.sell_price>0?{background:"rgba(239,68,68,.04)"}:{})}}>
            <span style={{fontWeight:600,fontSize:13,color:"#f0f6ff"}}>{p.name}</span>
            <span style={{color:"#94a3b8",fontSize:12}}>{p.category||"—"}</span>
            <span style={{fontSize:13,color:"#cbd5e1"}}>{fmt(p.buy_price)}</span>
            <span style={{color:"#f59e0b",fontWeight:600,fontSize:13}}>{fmt(p.sell_price)}</span>
            <span style={{color:"#34d399",fontSize:12}}>{p.buy_price>0?`${(((p.sell_price-p.buy_price)/p.buy_price)*100).toFixed(0)}%`:"—"}</span>
            <span style={{color:p.stock<=5&&p.sell_price>0?"#f87171":"#e2e8f0",fontWeight:600,fontSize:13}}>{p.stock} {p.unit}</span>
            <span style={{display:"flex",gap:5}}>
              <button style={C.iBtn} onClick={()=>startEdit(p)}><I n="edit" s={13}/></button>
              <button style={{...C.iBtn,color:"#f87171"}} onClick={()=>del(p.id)}><I n="trash" s={13}/></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   New Sale
══════════════════════════════════════════════════════════════ */
function Sales({ data, refresh, setTab }) {
  const [custId, setCustId] = useState("");
  const [walkIn, setWalkIn] = useState("");
  const [items,  setItems]  = useState([{productId:"",qty:1,price:0}]);
  const [paid,   setPaid]   = useState("");
  const [note,   setNote]   = useState("");
  const [rcpt,   setRcpt]   = useState(null);
  const [busy,   setBusy]   = useState(false);
  const [t, toast] = useToast();

  const total  = items.reduce((a,i)=>a+i.price*i.qty,0);
  const profit = items.reduce((a,i)=>{ const p=data.products.find(x=>x.id===i.productId); return a+(p?(i.price-p.buy_price)*i.qty:0); },0);
  const paidN  = parseFloat(paid)||0;
  const bal    = total-paidN;

  const setItem = (idx,f,v) => setItems(prev=>{
    const n=[...prev]; n[idx]={...n[idx],[f]:v};
    if (f==="productId"){const p=data.products.find(x=>x.id===v);if(p)n[idx].price=p.sell_price;}
    return n;
  });

  const submit = async () => {
    const valid=items.filter(i=>i.productId&&i.qty>0);
    if (!valid.length) return toast("Add at least one item","err");
    setBusy(true);
    try {
      const sale={id:uid(),date:today(),created_at:Date.now(),customer_id:custId||null,walk_in_name:walkIn||null,items:valid,total,profit,paid:paidN,note};
      await sb.upsert("sales",sale);
      for (const item of valid){
        const p=data.products.find(x=>x.id===item.productId);
        if(p) await sb.upsert("products",{...p,stock:p.stock-item.qty});
      }
      if (custId&&bal>0){
        const c=data.customers.find(x=>x.id===custId);
        if(c) await sb.upsert("customers",{...c,debt:(c.debt||0)+bal});
      }
      await refresh();
      const cust=data.customers.find(c=>c.id===custId);
      setRcpt({...sale,customerName:cust?.name||walkIn||"Walk-in"});
      setItems([{productId:"",qty:1,price:0}]); setCustId(""); setWalkIn(""); setPaid(""); setNote("");
    } catch(e){ toast(e.message,"err"); }
    finally { setBusy(false); }
  };

  if (rcpt) return <Receipt rcpt={rcpt} products={data.products} onClose={()=>setRcpt(null)}/>;

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <h1 style={C.h1}>New Sale</h1>
      <div style={C.two}>
        <div style={C.card}>
          <ST>Customer</ST>
          <div style={{marginBottom:10}}>
            <label style={C.lbl}>Existing Customer / Dealer</label>
            <select style={C.inp} value={custId} onChange={e=>{setCustId(e.target.value);setWalkIn("");}}>
              <option value="">— Walk-in / Select —</option>
              {data.customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.debt>0?` ⚠ Debt:${fmt(c.debt)}`:""}</option>)}
            </select>
          </div>
          {!custId&&<Fld label="Walk-in Name (optional)" value={walkIn} onChange={setWalkIn}/>}

          <ST style={{marginTop:14}}>Items</ST>
          {items.map((item,idx)=>(
            <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr 55px 80px 28px",gap:6,marginBottom:8}}>
              <select style={C.inp} value={item.productId} onChange={e=>setItem(idx,"productId",e.target.value)}>
                <option value="">— Product —</option>
                {data.products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock} left)</option>)}
              </select>
              <input style={C.inp} type="number" min="1" value={item.qty} onChange={e=>setItem(idx,"qty",+e.target.value)} placeholder="Qty"/>
              <input style={C.inp} type="number" value={item.price} onChange={e=>setItem(idx,"price",+e.target.value)} placeholder="₹"/>
              <button style={{...C.iBtn,color:"#f87171"}} onClick={()=>setItems(p=>p.filter((_,i)=>i!==idx))}><I n="close" s={12}/></button>
            </div>
          ))}
          <button style={C.btnG} onClick={()=>setItems(p=>[...p,{productId:"",qty:1,price:0}])}><I n="plus" s={13}/> Add Item</button>
          <div style={{marginTop:10}}><Fld label="Note (optional)" value={note} onChange={setNote}/></div>
        </div>

        <div>
          <div style={{...C.card,marginBottom:12}}>
            <ST>Summary</ST>
            <SRow l="Total"        v={fmt(total)}  c="#f59e0b" b/>
            <SRow l="Gross Profit" v={fmt(profit)} c="#34d399"/>
            <div style={{borderTop:"1px solid #1e293b",margin:"10px 0"}}/>
            <Fld label="Amount Paid ₹" type="number" value={paid} onChange={setPaid} ph={String(total)}/>
            <SRow l="Balance Due" v={fmt(bal)} c={bal>0?"#f87171":"#34d399"} b/>
            {bal>0&&custId&&<div style={{fontSize:11,color:"#f59e0b",marginTop:4,padding:"5px 8px",background:"rgba(245,158,11,.06)",borderRadius:5}}>→ Balance added to customer debt in Supabase</div>}
          </div>
          <button style={{...C.btnP,width:"100%",justifyContent:"center",padding:"13px 0",fontSize:14}} onClick={submit} disabled={busy}>
            <I n="check" s={16}/> {busy?"Saving…":"Confirm Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Receipt  —  with SEPARATE Save/Print buttons
══════════════════════════════════════════════════════════════ */
function Receipt({ rcpt, products, onClose }) {
  // Print: open a clean white popup with just the receipt
  const doPrint = () => {
    const content = document.getElementById("stow-receipt-body");
    if (!content) return window.print();
    const w = window.open("","_blank","width=420,height=700");
    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill #${rcpt.id.slice(-8).toUpperCase()}</title>
        <style>
          body { margin: 0; padding: 20px; font-family: 'Courier New', monospace; background: #fff; color: #111; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 3px 0; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload=()=>{window.print();}<\/script>
      </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div style={{maxWidth:360,margin:"0 auto",paddingTop:20}}>
      {/* ── Receipt body – white card ── */}
      <div id="stow-receipt-body" style={{background:"#fff",color:"#111",padding:24,borderRadius:10,fontFamily:"'Courier New',monospace",fontSize:12}}>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:22,fontWeight:900,letterSpacing:5,marginBottom:2}}>Stove Works</div>
          <div style={{fontSize:10,color:"#555"}}>Wholesale & Retail</div>
          <div style={{borderTop:"1px dashed #ccc",marginTop:8,paddingTop:8,fontSize:10,color:"#777"}}>
            Bill #{rcpt.id.slice(-8).toUpperCase()} · {fmtDate(rcpt.date)}
          </div>
        </div>

        <div style={{fontWeight:700,marginBottom:10,fontSize:13}}>{rcpt.customerName}</div>

        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr style={{borderBottom:"1px dashed #ccc"}}>
              <th style={{textAlign:"left",padding:"3px 0",fontWeight:600}}>Item</th>
              <th style={{textAlign:"center",fontWeight:600}}>Qty</th>
              <th style={{textAlign:"right",fontWeight:600}}>Rate</th>
              <th style={{textAlign:"right",fontWeight:600}}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {(rcpt.items||[]).map((item,i)=>{
              const p=products.find(x=>x.id===item.productId);
              return (
                <tr key={i} style={{borderBottom:"1px dashed #eee"}}>
                  <td style={{padding:"3px 0"}}>{p?.name||"?"}</td>
                  <td style={{textAlign:"center"}}>{item.qty}</td>
                  <td style={{textAlign:"right"}}>{fmt(item.price)}</td>
                  <td style={{textAlign:"right",fontWeight:600}}>{fmt(item.price*item.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{marginTop:10,borderTop:"1px dashed #ccc",paddingTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:14}}><span>Total</span><span>{fmt(rcpt.total)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",color:"#555",fontSize:13}}><span>Paid</span><span>{fmt(rcpt.paid)}</span></div>
          {rcpt.total-rcpt.paid>0&&(
            <div style={{display:"flex",justifyContent:"space-between",color:"red",fontWeight:700,fontSize:13}}><span>Balance Due</span><span>{fmt(rcpt.total-rcpt.paid)}</span></div>
          )}
        </div>
        {rcpt.note&&<div style={{marginTop:8,fontSize:11,color:"#777"}}>Note: {rcpt.note}</div>}
        <div style={{textAlign:"center",marginTop:12,fontSize:10,color:"#aaa",borderTop:"1px dashed #ccc",paddingTop:8}}>Thank you! Visit again.</div>
      </div>

      {/* ── Action buttons — SEPARATE Print & Close ── */}
      <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:16}} className="no-print">
        {/* PRINT button — opens clean popup */}
        <button style={{...C.btnP,padding:"10px 22px",fontSize:14}} onClick={doPrint}>
          <I n="print" s={15}/> Print Bill
        </button>
        {/* CLOSE button — goes back to sale form */}
        <button style={{...C.btnG,padding:"10px 18px",fontSize:14}} onClick={onClose}>
          <I n="close" s={14}/> Close
        </button>
      </div>

      <div style={{textAlign:"center",marginTop:10,fontSize:11,color:"#475569"}}>
        🖨 Print opens a clean white receipt popup<br/>that won't include the dark app background
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Customers — with EDIT + DEBT ADJUSTMENT
══════════════════════════════════════════════════════════════ */
function Customers({ data, refresh }) {
  const blank = {name:"",phone:"",address:""};
  const [form,    setForm]    = useState(blank);
  const [show,    setShow]    = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [editC,   setEditC]   = useState(null);   // customer being edited
  const [debtC,   setDebtC]   = useState(null);   // customer whose debt is being adjusted
  const [debtVal, setDebtVal] = useState("");
  const [debtMode,setDebtMode]= useState("set");  // "set" | "add" | "sub"
  const [srch,    setSrch]    = useState("");
  const [t, toast] = useToast();

  /* ── Add new customer ── */
  const add = async () => {
    if (!form.name) return toast("Enter customer name","err");
    setBusy(true);
    try { await sb.upsert("customers",{...form,id:uid(),debt:0}); await refresh(); setForm(blank); setShow(false); toast("Customer added ✓"); }
    finally { setBusy(false); }
  };

  /* ── Save edited customer info ── */
  const saveEdit = async () => {
    if (!editC) return;
    setBusy(true);
    try {
      await sb.upsert("customers",{...editC,name:form.name,phone:form.phone,address:form.address});
      await refresh(); setEditC(null); setForm(blank); toast("Customer updated ✓");
    } finally { setBusy(false); }
  };

  /* ── Adjust debt manually ── */
  const saveDebt = async () => {
    if (!debtC) return;
    const val = parseFloat(debtVal);
    if (isNaN(val)||val<0) return toast("Enter a valid amount","err");
    let newDebt = debtC.debt||0;
    if (debtMode==="set") newDebt = val;
    else if (debtMode==="add") newDebt = newDebt + val;
    else newDebt = Math.max(0, newDebt - val);
    setBusy(true);
    try {
      await sb.upsert("customers",{...debtC,debt:newDebt});
      await refresh(); setDebtC(null); setDebtVal(""); toast(`Debt updated → ${fmt(newDebt)} ✓`);
    } finally { setBusy(false); }
  };

  const del = async (id) => {
    const c=data.customers.find(x=>x.id===id);
    if (c?.debt>0&&!confirm(`This customer owes ${fmt(c.debt)}. Delete anyway?`)) return;
    await sb.del("customers",id); await refresh(); toast("Customer deleted");
  };

  const openEdit = c => { setEditC(c); setForm({name:c.name,phone:c.phone||"",address:c.address||""}); setShow(false); setDebtC(null); };
  const openDebt = c => { setDebtC(c); setDebtVal(String(c.debt||0)); setDebtMode("set"); setEditC(null); setShow(false); };

  const filtered = data.customers.filter(c=>
    c.name?.toLowerCase().includes(srch.toLowerCase())||(c.phone||"").includes(srch)
  );

  return (
    <div style={C.pg}>
      <Toast t={t}/>

      <div style={C.phdr}>
        <h1 style={C.h1}>Customers / Dealers <span style={{fontSize:13,color:"#64748b",fontWeight:400}}>({data.customers.length})</span></h1>
        <button style={C.btnP} onClick={()=>{setShow(s=>!s);setEditC(null);setDebtC(null);setForm(blank);}}><I n="plus" s={14}/> Add</button>
      </div>

      {/* ── Add form ── */}
      {show&&!editC&&(
        <div style={{...C.card,marginBottom:16}}>
          <ST>New Customer / Dealer</ST>
          <div style={C.g3}>
            <Fld label="Name *"  value={form.name}    onChange={v=>setForm(f=>({...f,name:v}))}/>
            <Fld label="Phone"   value={form.phone}   onChange={v=>setForm(f=>({...f,phone:v}))}/>
            <Fld label="Address" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button style={C.btnP} onClick={add} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Save"}</button>
            <button style={C.btnG} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Edit customer info ── */}
      {editC&&(
        <div style={{...C.card,marginBottom:16,borderTop:"3px solid #f59e0b"}}>
          <ST>Edit Customer: {editC.name}</ST>
          <div style={C.g3}>
            <Fld label="Name *"  value={form.name}    onChange={v=>setForm(f=>({...f,name:v}))}/>
            <Fld label="Phone"   value={form.phone}   onChange={v=>setForm(f=>({...f,phone:v}))}/>
            <Fld label="Address" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button style={C.btnP} onClick={saveEdit} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Update"}</button>
            <button style={C.btnG} onClick={()=>setEditC(null)}><I n="close" s={14}/> Cancel</button>
          </div>
        </div>
      )}

      {/* ── Adjust debt ── */}
      {debtC&&(
        <div style={{...C.card,marginBottom:16,borderTop:"3px solid #ef4444"}}>
          <ST>Adjust Debt for: {debtC.name}</ST>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"10px 14px",background:"#0d1117",borderRadius:8}}>
            <span style={{color:"#94a3b8",fontSize:13}}>Current Debt:</span>
            <span style={{fontWeight:800,fontSize:22,color:"#f87171"}}>{fmt(debtC.debt||0)}</span>
          </div>

          {/* Mode selector */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[["set","Set Exact Amount"],["add","Add to Debt"],["sub","Reduce Debt"]].map(([m,l])=>(
              <button key={m} style={{...(debtMode===m?C.btnP:C.btnG),fontSize:12,padding:"6px 12px"}} onClick={()=>setDebtMode(m)}>{l}</button>
            ))}
          </div>

          <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
            <div style={{flex:1}}>
              <label style={C.lbl}>
                {debtMode==="set"?"New Debt Amount ₹":debtMode==="add"?"Amount to Add ₹":"Amount to Reduce ₹"}
              </label>
              <input style={C.inp} type="number" min="0" value={debtVal} onChange={e=>setDebtVal(e.target.value)} placeholder="0.00"/>
            </div>
            {debtMode!=="set"&&debtVal&&(
              <div style={{padding:"8px 14px",background:"#0d1117",borderRadius:8,fontSize:13,color:"#94a3b8",whiteSpace:"nowrap"}}>
                Result: <b style={{color:debtMode==="add"?"#f87171":"#34d399"}}>
                  {fmt(Math.max(0,(debtC.debt||0)+(debtMode==="add"?+debtVal:-+debtVal)))}
                </b>
              </div>
            )}
          </div>

          <div style={{fontSize:11,color:"#64748b",marginTop:8,marginBottom:12}}>
            {debtMode==="set"&&"This will directly set the customer's debt to the value you enter."}
            {debtMode==="add"&&"Use this if they bought more on credit or you want to manually add debt."}
            {debtMode==="sub"&&"Use this to manually reduce debt (e.g. cash collected outside the system)."}
          </div>

          <div style={{display:"flex",gap:8}}>
            <button style={C.btnP} onClick={saveDebt} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Save Debt"}</button>
            <button style={C.btnG} onClick={()=>setDebtC(null)}><I n="close" s={14}/> Cancel</button>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <input style={C.srch} placeholder="Search by name or phone…" value={srch} onChange={e=>setSrch(e.target.value)}/>

      {/* ── Table ── */}
      <div style={C.tbl}>
        <div style={{...C.tr,...C.th,gridTemplateColumns:"2fr 1fr 2fr 120px 110px"}}>
          <span>Name</span><span>Phone</span><span>Address</span><span>Debt</span><span>Actions</span>
        </div>
        {filtered.length===0?<MT text="No customers yet"/>:filtered.map(c=>(
          <div key={c.id} style={{...C.tr,gridTemplateColumns:"2fr 1fr 2fr 120px 110px"}}>
            <span style={{fontWeight:600,color:"#f0f6ff"}}>{c.name}</span>
            <span style={{color:"#94a3b8",fontSize:12}}>{c.phone||"—"}</span>
            <span style={{color:"#94a3b8",fontSize:12}}>{c.address||"—"}</span>
            <span>
              <span style={{fontWeight:700,color:c.debt>0?"#f87171":"#34d399",fontSize:13}}>
                {c.debt>0?fmt(c.debt):"Clear ✓"}
              </span>
            </span>
            <span style={{display:"flex",gap:5}}>
              {/* Edit info */}
              <button style={{...C.iBtn,color:"#94a3b8"}} title="Edit customer info" onClick={()=>openEdit(c)}><I n="edit" s={13}/></button>
              {/* Edit debt */}
              <button style={{...C.iBtn,color:"#f59e0b",borderColor:"rgba(245,158,11,.3)"}} title="Adjust debt" onClick={()=>openDebt(c)}><I n="money" s={13}/></button>
              {/* Delete */}
              <button style={{...C.iBtn,color:"#f87171"}} title="Delete customer" onClick={()=>del(c.id)}><I n="trash" s={13}/></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Debts
══════════════════════════════════════════════════════════════ */
function Debts({ data, refresh }) {
  const [amt, setAmt] = useState({});
  const [t, toast] = useToast();
  const debtors   = data.customers.filter(c=>c.debt>0).sort((a,b)=>b.debt-a.debt);
  const totalDebt = debtors.reduce((a,c)=>a+c.debt,0);

  const collect = async (id) => {
    const a=parseFloat(amt[id]); if(!a||a<=0) return toast("Enter valid amount","err");
    const c=data.customers.find(x=>x.id===id);
    if (a>c.debt) return toast(`Max collectible: ${fmt(c.debt)}`,"warn");
    await sb.upsert("customers",{...c,debt:Math.max(0,(c.debt||0)-a)});
    await sb.upsert("debt_payments",{id:uid(),customer_id:id,amount:a,date:today(),created_at:Date.now()});
    await refresh(); setAmt(p=>({...p,[id]:""})); toast(`${fmt(a)} collected ✓`);
  };

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <h1 style={C.h1}>Debt Management</h1>
      {totalDebt>0&&(
        <div style={{...C.card,marginBottom:16,padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"#94a3b8",fontSize:13}}>Total Outstanding</span>
          <span style={{fontWeight:800,fontSize:22,color:"#f87171"}}>{fmt(totalDebt)}</span>
        </div>
      )}
      {debtors.length===0
        ? <div style={{...C.card,textAlign:"center",padding:48}}><div style={{fontSize:36,marginBottom:8}}>✅</div><div style={{color:"#64748b",fontSize:14}}>No outstanding debts!</div></div>
        : debtors.map(c=>(
          <div key={c.id} style={{...C.card,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontWeight:700,fontSize:16,color:"#f0f6ff"}}>{c.name}</div>
                <div style={{color:"#64748b",fontSize:12,marginTop:2}}>{c.phone||"No phone"} {c.address?`· ${c.address}`:""}</div>
              </div>
              <div style={{fontWeight:800,fontSize:26,color:"#f87171"}}>{fmt(c.debt)}</div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input style={{...C.inp,flex:1}} type="number" placeholder="Collection amount ₹" value={amt[c.id]||""} onChange={e=>setAmt(p=>({...p,[c.id]:e.target.value}))}/>
              <button style={{...C.btnG,padding:"8px 12px",fontSize:12}} onClick={()=>setAmt(p=>({...p,[c.id]:String(c.debt)}))}>Full</button>
              <button style={C.btnP} onClick={()=>collect(c.id)}><I n="check" s={14}/> Collect</button>
            </div>
            <div style={{marginTop:8}}>
              <div style={{fontSize:11,color:"#475569",marginBottom:4}}>Payment history:</div>
              {data.debtPayments.filter(p=>p.customer_id===c.id).slice(0,5).map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#64748b",padding:"2px 0"}}>
                  <span>{fmtDate(p.date)}</span>
                  <span style={{color:"#34d399",fontWeight:600}}>+{fmt(p.amount)} collected</span>
                </div>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Expenses
══════════════════════════════════════════════════════════════ */
function Expenses({ data, refresh }) {
  const blank = {date:today(),amount:"",description:"salary"};
  const [form, setForm] = useState(blank);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [t, toast] = useToast();

  const add = async () => {
    if (!form.amount) return toast("Enter amount","err");
    setBusy(true);
    try { await sb.upsert("expenses",{...form,id:uid(),amount:+form.amount,created_at:Date.now()}); await refresh(); setForm(blank); setShow(false); toast("Expense saved ✓"); }
    finally { setBusy(false); }
  };

  const del = async id => { if (!confirm("Delete?")) return; await sb.del("expenses",id); await refresh(); toast("Deleted"); };

  const monthExp   = data.expenses.filter(e=>e.date?.slice(0,7)===today().slice(0,7));
  const monthTotal = monthExp.reduce((a,e)=>a+e.amount,0);
  const byCat      = monthExp.reduce((a,e)=>{a[e.description]=(a[e.description]||0)+e.amount;return a;},{});

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <div style={C.phdr}>
        <h1 style={C.h1}>Daily Expenses</h1>
        <button style={C.btnP} onClick={()=>setShow(true)}><I n="plus" s={14}/> Add Expense</button>
      </div>
      <div style={{...C.g4,marginBottom:16}}>
        <StatC label="This Month Total" val={fmt(monthTotal)} sub={`${monthExp.length} entries`} acc="#818cf8"/>
        {Object.entries(byCat).slice(0,3).map(([k,v])=>(
          <StatC key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} val={fmt(v)} sub="this month" acc="#64748b"/>
        ))}
      </div>
      {show&&(
        <div style={{...C.card,marginBottom:16}}>
          <ST>Add Expense</ST>
          <div style={C.g3}>
            <Fld label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
            <Fld label="Amount ₹ *" type="number" value={form.amount} onChange={v=>setForm(f=>({...f,amount:v}))}/>
            <div>
              <label style={C.lbl}>Type</label>
              <select style={C.inp} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}>
                {["salary","rent","petrol","purchase","repair","other"].map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button style={C.btnP} onClick={add} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Save"}</button>
            <button style={C.btnG} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={C.tbl}>
        <div style={{...C.tr,...C.th,gridTemplateColumns:"150px 1fr 110px 60px"}}>
          <span>Date</span><span>Type</span><span>Amount</span><span>Del</span>
        </div>
        {data.expenses.length===0?<MT text="No expenses yet"/>:data.expenses.slice(0,150).map(e=>(
          <div key={e.id} style={{...C.tr,gridTemplateColumns:"150px 1fr 110px 60px"}}>
            <span style={{color:"#94a3b8",fontSize:12}}>{fmtDate(e.date)}</span>
            <span style={{textTransform:"capitalize",color:"#cbd5e1"}}>{e.description}</span>
            <span style={{color:"#818cf8",fontWeight:600}}>{fmt(e.amount)}</span>
            <button style={{...C.iBtn,color:"#f87171"}} onClick={()=>del(e.id)}><I n="trash" s={13}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Reports
══════════════════════════════════════════════════════════════ */
function Reports({ data, refresh }) {
  const [range,  setRange]  = useState("today");
  const [from,   setFrom]   = useState(today());
  const [to,     setTo]     = useState(today());
  const [reprint,setReprint]= useState(null);
  const [t, toast] = useToast();

  const inR = d => {
    if (!d) return false;
    if (range==="today") return d===today();
    if (range==="week")  {const x=new Date();x.setDate(x.getDate()-7);return d>=x.toISOString().slice(0,10);}
    if (range==="month") return d.slice(0,7)===today().slice(0,7);
    return d>=from&&d<=to;
  };

  const sales    = data.sales.filter(s=>inR(s.date));
  const exps     = data.expenses.filter(e=>inR(e.date));
  const revenue  = sales.reduce((a,s)=>a+s.total,0);
  const collected= sales.reduce((a,s)=>a+s.paid,0);
  const gProfit  = sales.reduce((a,s)=>a+s.profit,0);
  const pending  = sales.reduce((a,s)=>a+(s.total-s.paid),0);
  const expTotal = exps.reduce((a,e)=>a+e.amount,0);
  const netProfit= gProfit-expTotal;

  // Cancel / delete a bill
  const cancelSale = async s => {
    const name=data.customers.find(c=>c.id===s.customer_id)?.name||s.walk_in_name||"Walk-in";
    if (!confirm(`Cancel bill for ${name} (${fmt(s.total)})?\n• Stock will be restored\n• Customer debt will be reduced\n• Bill deleted permanently`)) return;
    // Restore stock
    for (const item of (s.items||[])) {
      const p=data.products.find(x=>x.id===item.productId);
      if (p) await sb.upsert("products",{...p,stock:p.stock+item.qty});
    }
    // Reduce customer debt
    if (s.customer_id) {
      const c=data.customers.find(x=>x.id===s.customer_id);
      if (c) await sb.upsert("customers",{...c,debt:Math.max(0,(c.debt||0)-Math.max(0,s.total-s.paid))});
    }
    await sb.del("sales",s.id);
    await refresh(); toast("Bill cancelled. Stock restored ✓");
  };

  if (reprint) return <Receipt rcpt={reprint} products={data.products} onClose={()=>setReprint(null)}/>;

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <h1 style={C.h1}>Reports & Statements</h1>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {[["today","Today"],["week","Last 7 Days"],["month","This Month"],["custom","Custom"]].map(([v,l])=>(
          <button key={v} style={range===v?C.btnP:C.btnG} onClick={()=>setRange(v)}>{l}</button>
        ))}
        {range==="custom"&&<>
          <input style={{...C.inp,width:130}} type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
          <span style={{color:"#64748b"}}>→</span>
          <input style={{...C.inp,width:130}} type="date" value={to} onChange={e=>setTo(e.target.value)}/>
        </>}
      </div>

      <div style={C.g4}>
        <StatC label="Total Revenue"  val={fmt(revenue)}   sub={`${sales.length} sales`}   acc="#f59e0b"/>
        <StatC label="Gross Profit"   val={fmt(gProfit)}   sub="Before expenses"            acc="#10b981"/>
        <StatC label="Total Expenses" val={fmt(expTotal)}  sub="Salary + rent + others"     acc="#818cf8"/>
        <StatC label="Net Profit"     val={fmt(netProfit)} sub="Final take-home"             acc={netProfit>=0?"#10b981":"#ef4444"}/>
      </div>

      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{...C.card,flex:"1 1 200px",padding:"12px 18px"}}>
          <ST>Collections</ST>
          <SRow l="Cash Collected" v={fmt(collected)} c="#34d399"/>
          <SRow l="Pending"        v={fmt(pending)}   c="#f87171"/>
        </div>
        <div style={{...C.card,flex:"1 1 200px",padding:"12px 18px"}}>
          <ST>Expense Breakdown</ST>
          {Object.entries(exps.reduce((a,e)=>{a[e.description]=(a[e.description]||0)+e.amount;return a;},{})).map(([k,v])=>(
            <SRow key={k} l={k} v={fmt(v)}/>
          ))}
          {exps.length===0&&<div style={{color:"#64748b",fontSize:12}}>No expenses in period</div>}
        </div>
      </div>

      <div style={C.tbl}>
        <div style={{...C.tr,...C.th,gridTemplateColumns:"120px 1fr 60px 90px 90px 90px 80px"}}>
          <span>Date</span><span>Customer</span><span>Items</span><span>Total</span><span>Paid</span><span>Balance</span><span>Actions</span>
        </div>
        {sales.length===0?<MT text="No sales in this period"/>:sales.map(s=>{
          const c=data.customers.find(x=>x.id===s.customer_id);
          return (
            <div key={s.id} style={{...C.tr,gridTemplateColumns:"120px 1fr 60px 90px 90px 90px 80px"}}>
              <span style={{color:"#94a3b8",fontSize:12}}>{fmtDate(s.date)}</span>
              <span style={{fontWeight:600,fontSize:13,color:"#f0f6ff"}}>{c?.name||s.walk_in_name||"Walk-in"}</span>
              <span style={{color:"#64748b"}}>{(s.items||[]).length}</span>
              <span style={{fontWeight:700,color:"#e2e8f0"}}>{fmt(s.total)}</span>
              <span style={{color:"#34d399"}}>{fmt(s.paid)}</span>
              <span style={{color:s.total-s.paid>0?"#f87171":"#34d399"}}>{fmt(s.total-s.paid)}</span>
              <span style={{display:"flex",gap:5}}>
                <button style={{...C.iBtn,color:"#94a3b8"}} title="Reprint bill"
                  onClick={()=>setReprint({...s,customerName:c?.name||s.walk_in_name||"Walk-in"})}>
                  <I n="print" s={13}/>
                </button>
                <button style={{...C.iBtn,color:"#f87171"}} title="Cancel / delete bill"
                  onClick={()=>cancelSale(s)}>
                  <I n="trash" s={13}/>
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Import Data
══════════════════════════════════════════════════════════════ */
function ImportData({ data, refresh }) {
  const [busy,   setBusy]   = useState(false);
  const [status, setStatus] = useState("");
  const [pct,    setPct]    = useState(0);
  const [log,    setLog]    = useState([]);

  const addLog = (msg,t="info") => setLog(l=>[...l,{msg,t}]);

  const chunk = async (table, rows, size=20) => {
    let done=0;
    for (let i=0;i<rows.length;i+=size){
      await sb.upsertMany(table, rows.slice(i,i+size));
      done+=Math.min(size,rows.length-i);
      setPct(Math.round((done/rows.length)*100));
    }
  };

  const go = async e => {
    const file=e.target.files[0]; if (!file) return;
    setBusy(true); setLog([]); setPct(0);
    try {
      setStatus("Reading Excel file…");
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf,{type:"array",cellDates:true});
      addLog(`Sheets found: ${wb.SheetNames.join(", ")}`);

      if (wb.SheetNames.includes("Inventory")) {
        setStatus("Importing inventory…"); setPct(0);
        const rows=XLSX.utils.sheet_to_json(wb.Sheets["Inventory"]);
        const valid=rows.filter(r=>r["Product Name"]&&r["Selling Price"]&&!String(r["Product Name"]).startsWith("="));
        addLog(`Found ${valid.length} inventory rows`);
        const prods=valid.map(r=>({id:uid(),name:String(r["Product Name"]).trim(),category:String(r["Category"]||"").trim(),buy_price:Number(r["Buying Price"]||0),sell_price:Number(r["Selling Price"]||0),stock:Number(r["Stock"]||0),unit:String(r["Unit"]||"pcs").trim()}));
        await chunk("products",prods,20);
        addLog(`✓ ${prods.length} products imported`,"ok");
      }

      if (wb.SheetNames.includes("Dealers")) {
        setStatus("Importing customers…"); setPct(0);
        const rows=XLSX.utils.sheet_to_json(wb.Sheets["Dealers"]);
        const valid=rows.filter(r=>r["Name"]&&!String(r["Name"]).startsWith("="));
        addLog(`Found ${valid.length} customer rows`);
        const custs=valid.map(r=>({id:uid(),name:String(r["Name"]).trim(),phone:String(r["Phone"]||"").trim(),address:String(r["Address"]||"").trim(),debt:Number(r["Debt"]||0)}));
        await chunk("customers",custs,20);
        addLog(`✓ ${custs.length} customers imported`,"ok");
      }

      if (wb.SheetNames.includes("Salary")) {
        setStatus("Importing expenses…"); setPct(0);
        const rows=XLSX.utils.sheet_to_json(wb.Sheets["Salary"],{raw:false});
        const valid=rows.filter(r=>r["Amount"]&&r["Date"]&&!String(r["Amount"]).startsWith("="));
        addLog(`Found ${valid.length} expense rows`);
        const exps=valid.map(r=>({id:uid(),date:toISO(r["Date"]),amount:Number(r["Amount"]||0),description:String(r["Type"]||"salary").toLowerCase().trim(),created_at:Date.now()}));
        await chunk("expenses",exps,20);
        addLog(`✓ ${exps.length} expenses imported`,"ok");
      }

      if (wb.SheetNames.includes("Sales")) {
        setStatus("Importing sales…"); setPct(0);
        const rows=XLSX.utils.sheet_to_json(wb.Sheets["Sales"],{raw:false});
        const valid=rows.filter(r=>r["Product Name"]&&!String(r["Product Name"]).startsWith("=")&&r["Date"]);
        addLog(`Found ${valid.length} sale rows, grouping by date…`);
        const pMap={};
        data.products.forEach(p=>{pMap[p.name.trim().toLowerCase()]=p.id;});
        const grouped={};
        valid.forEach(r=>{ const d=toISO(r["Date"]); if(!grouped[d]) grouped[d]=[]; grouped[d].push(r); });
        const sales=Object.entries(grouped).map(([date,items])=>({
          id:uid(),date,created_at:new Date(date).getTime()||Date.now(),
          customer_id:null,walk_in_name:null,
          items:items.map(r=>({productId:pMap[String(r["Product Name"]).trim().toLowerCase()]||uid(),qty:Number(r["Quantity"]||1),price:Number(r["Selling Price"]||0)})),
          total:items.reduce((a,r)=>a+Number(r["Total"]||0),0),
          profit:items.reduce((a,r)=>a+Number(r["Profits"]||0),0),
          paid:items.reduce((a,r)=>a+Number(r["Total"]||0),0),note:"",
        }));
        await chunk("sales",sales,20);
        addLog(`✓ ${sales.length} sale records imported`,"ok");
      }

      await refresh(); setStatus("Import complete! 🎉");
      addLog("All data is now live in Supabase.","ok");
    } catch(e) { addLog("Error: "+e.message,"err"); setStatus("Import failed — check log below"); }
    setBusy(false); setPct(0); e.target.value="";
  };

  return (
    <div style={C.pg}>
      <h1 style={C.h1}>Import Existing Data</h1>
      <div style={C.card}>
        <ST>Upload your Excel file</ST>
        <p style={{color:"#94a3b8",fontSize:13,marginBottom:12}}>
          Upload <b style={{color:"#f59e0b"}}>Sales_Inventory_Template.xlsx</b> — it will import all 4 sheets:<br/>
          <span style={{color:"#64748b",fontSize:12}}>Inventory → products · Dealers → customers · Salary → expenses · Sales → sales records</span>
        </p>
        <div style={C.alertW}><I n="warn" s={14}/> Uses merge — safe to run multiple times without duplicating</div>
        <label style={{...C.btnP,cursor:"pointer",display:"inline-flex",gap:6,marginTop:12}}>
          <I n="upload" s={14}/> {busy?"Importing…":"Choose Excel File"}
          <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={go} disabled={busy}/>
        </label>
      </div>
      {(status||log.length>0)&&(
        <div style={{...C.card,marginTop:12}}>
          <ST>Import Log</ST>
          {status&&<div style={{color:"#f59e0b",fontWeight:600,marginBottom:10,fontSize:13}}>{status}</div>}
          {busy&&pct>0&&(
            <div style={{marginBottom:12}}>
              <div style={{background:"#0f172a",borderRadius:6,height:6,overflow:"hidden"}}>
                <div style={{background:"#f59e0b",height:"100%",width:`${pct}%`,transition:"width .3s"}}/>
              </div>
              <div style={{fontSize:11,color:"#64748b",marginTop:3}}>{pct}%</div>
            </div>
          )}
          <div style={{maxHeight:220,overflow:"auto"}}>
            {log.map((l,i)=>(
              <div key={i} style={{fontSize:12,padding:"3px 0",color:l.t==="ok"?"#34d399":l.t==="err"?"#f87171":"#94a3b8"}}>{l.msg}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{...C.card,marginTop:12}}>
        <ST>Current DB Status</ST>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {[["Products",data.products.length,"#f59e0b"],["Customers",data.customers.length,"#10b981"],["Sales",data.sales.length,"#818cf8"],["Expenses",data.expenses.length,"#64748b"]].map(([l,v,a])=>(
            <div key={l} style={{background:"#0f172a",borderRadius:8,padding:"12px 16px",border:"1px solid #1e293b"}}>
              <div style={{color:"#64748b",fontSize:11,marginBottom:4}}>{l}</div>
              <div style={{fontSize:24,fontWeight:800,color:a}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Styles  —  fixed dark-mode visibility
══════════════════════════════════════════════════════════════ */
const C = {
  app:    {display:"flex",height:"100vh",background:"#060a10",fontFamily:"'DM Sans',system-ui,sans-serif",overflow:"hidden"},
  sb:     {width:200,background:"#080c14",borderRight:"1px solid #1a2235",display:"flex",flexDirection:"column",padding:"14px 10px",flexShrink:0},
  brand:  {display:"flex",alignItems:"center",gap:10,marginBottom:22,paddingLeft:4},
  bIcon:  {width:32,height:32,background:"linear-gradient(135deg,#f59e0b,#b45309)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,color:"#0d1117",flexShrink:0},
  bName:  {fontWeight:900,fontSize:13,color:"#f0f6ff",letterSpacing:1},
  bSub:   {fontSize:9,color:"#334155",letterSpacing:.5},
  // nav: readable muted text — lighter than before
  nav:    {display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"none",border:"none",borderRadius:8,color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:500,textAlign:"left",width:"100%"},
  navA:   {background:"rgba(245,158,11,.12)",color:"#f59e0b"},
  sbFoot: {paddingTop:12,borderTop:"1px solid #1a2235"},
  main:   {flex:1,overflow:"auto",padding:"22px 28px"},
  pg:     {maxWidth:960,margin:"0 auto"},
  h1:     {fontSize:20,fontWeight:800,color:"#f0f6ff",marginBottom:18,letterSpacing:-.5},
  phdr:   {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18},
  g4:     {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18},
  g3:     {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10},
  two:    {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
  card:   {background:"#08101e",border:"1px solid #1a2235",borderRadius:10,padding:"16px 18px",marginBottom:0},
  row:    {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #0d1521"},
  alertW: {display:"flex",gap:8,alignItems:"center",background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.25)",borderRadius:8,padding:"9px 12px",color:"#fbbf24",fontSize:13,marginBottom:12},
  tbl:    {background:"#08101e",border:"1px solid #1a2235",borderRadius:10,overflow:"hidden"},
  // tr text: #cbd5e1 is clearly visible against dark bg
  tr:     {display:"grid",gap:8,padding:"10px 14px",borderBottom:"1px solid #0d1521",fontSize:13,alignItems:"center",color:"#cbd5e1"},
  // th: was #334155 (too dark) → now #4a5c74
  th:     {color:"#4a5c74",fontSize:10,textTransform:"uppercase",letterSpacing:1,fontWeight:700,background:"#050c17"},
  // lbl: was #334155 → now #64748b
  lbl:    {display:"block",fontSize:10,color:"#64748b",marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
  inp:    {width:"100%",background:"#0d1521",border:"1px solid #1a2235",borderRadius:6,padding:"8px 10px",color:"#f0f6ff",fontSize:13,outline:"none",boxSizing:"border-box"},
  srch:   {width:"100%",background:"#08101e",border:"1px solid #1a2235",borderRadius:8,padding:"9px 13px",color:"#f0f6ff",fontSize:13,outline:"none",marginBottom:13,boxSizing:"border-box"},
  btnP:   {display:"flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#0d1117",border:"none",borderRadius:7,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"},
  btnG:   {display:"flex",alignItems:"center",gap:6,background:"transparent",color:"#94a3b8",border:"1px solid #1e293b",borderRadius:7,padding:"8px 14px",fontWeight:500,fontSize:13,cursor:"pointer",whiteSpace:"nowrap"},
  iBtn:   {background:"transparent",border:"1px solid #1a2235",borderRadius:5,padding:"5px 7px",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center"},
  splash: {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#060a10"},
  logo:   {fontSize:52,fontWeight:900,letterSpacing:8,color:"#f59e0b",marginBottom:6},
  spinner:{width:26,height:26,border:"3px solid #1a2235",borderTop:"3px solid #f59e0b",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"18px auto"},
};
