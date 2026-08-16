import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import {
  C, I,
  sb, getShopGST, saveShopGST,
  isLoggedIn, setSession, clearSession, getSession,
  getDBCreds, saveDBCreds, hashPassword, IS_HASH,
  Fld, ST, useIsMobile, useToast, Toast,
  fmt, fmtDate, today,
} from "./shared.jsx";

/* ══════════════════════════════════════════════════════════════
   Lazy tab pages — each becomes its own JS chunk
══════════════════════════════════════════════════════════════ */
const Dashboard  = lazy(() => import("./pages/Dashboard.jsx"));
const Inventory  = lazy(() => import("./pages/Inventory.jsx"));
const Sales      = lazy(() => import("./pages/Sales.jsx"));
const Customers  = lazy(() => import("./pages/Customers.jsx"));
const Suppliers  = lazy(() => import("./pages/Suppliers.jsx"));
const Debts      = lazy(() => import("./pages/Debts.jsx"));
const Expenses   = lazy(() => import("./pages/Expenses.jsx"));
const Reports    = lazy(() => import("./pages/Reports.jsx"));
const ImportData = lazy(() => import("./pages/ImportData.jsx"));

/* ── Suspense fallback ── */
function TabLoader() {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 0"}}>
      <div style={C.spinner}/>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Login helpers (brute-force lockout)
══════════════════════════════════════════════════════════════ */
const LOCK_KEY    = "stow_lockout";
const ATTEMPT_KEY = "stow_attempts";
const MAX_TRIES   = 5;
const LOCK_MS     = 15 * 60 * 1000;

function getLockout()   { try { return JSON.parse(localStorage.getItem(LOCK_KEY)||"null"); } catch { return null; } }
function setLockout()   { localStorage.setItem(LOCK_KEY, JSON.stringify({ until: Date.now() + LOCK_MS })); localStorage.removeItem(ATTEMPT_KEY); }
function clearLockout() { localStorage.removeItem(LOCK_KEY); localStorage.removeItem(ATTEMPT_KEY); }
function getAttempts()  { return parseInt(localStorage.getItem(ATTEMPT_KEY)||"0",10); }
function incAttempts()  { const n = getAttempts()+1; localStorage.setItem(ATTEMPT_KEY, String(n)); return n; }

/* ══════════════════════════════════════════════════════════════
   Login Screen
══════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const [user,     setUser]     = useState("");
  const [pass,     setPass]     = useState("");
  const [err,      setErr]      = useState("");
  const [busy,     setBusy]     = useState(false);
  const [showP,    setShowP]    = useState(false);
  const [lockSecs, setLockSecs] = useState(0);
  const [attLeft,  setAttLeft]  = useState(MAX_TRIES - getAttempts());

  useEffect(() => {
    const tick = () => {
      const lk = getLockout();
      if (lk && lk.until > Date.now()) {
        setLockSecs(Math.ceil((lk.until - Date.now()) / 1000));
      } else {
        if (lk) clearLockout();
        setLockSecs(0);
        setAttLeft(MAX_TRIES - getAttempts());
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const fmtCountdown = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const doLogin = async () => {
    const lk = getLockout();
    if (lk && lk.until > Date.now()) return;
    if (!user.trim()||!pass) return setErr("Please enter both username and password.");
    setBusy(true); setErr("");
    try {
      const creds = await getDBCreds();
      let match = false;
      if (IS_HASH(creds.password)) {
        const hashed = await hashPassword(pass);
        match = user.trim()===creds.username && hashed===creds.password;
      } else {
        match = user.trim()===creds.username && pass===creds.password;
        if (match) await saveDBCreds({ username:creds.username, password:pass });
      }
      if (match) {
        clearLockout();
        setSession(user.trim()); onLogin(user.trim());
      } else {
        const attempts = incAttempts();
        const remaining = MAX_TRIES - attempts;
        if (remaining <= 0) {
          setLockout();
          setLockSecs(Math.ceil(LOCK_MS / 1000));
          setErr(`Too many failed attempts. Account locked for 15 minutes.`);
        } else {
          setAttLeft(remaining);
          setErr(`Incorrect username or password. ${remaining} attempt${remaining===1?"":"s"} remaining.`);
        }
      }
    } catch(e) {
      setErr("Could not connect to database: " + e.message);
    }
    setBusy(false);
  };

  const isLocked = lockSecs > 0;

  return (
    <div style={{minHeight:"100vh",background:"#060a10",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}} *{box-sizing:border-box} body{margin:0}`}</style>
      <div style={{width:"100%",maxWidth:380,animation:"fadeUp .35s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",width:72,height:72,background:"linear-gradient(135deg,#f59e0b,#92400e)",borderRadius:22,alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:900,color:"#0d1117",marginBottom:16,boxShadow:"0 0 48px rgba(245,158,11,.25)"}}>S</div>
          <div style={{fontSize:28,fontWeight:900,letterSpacing:4,color:"#f0f6ff",lineHeight:1.1}}>SARAVANAN</div>
          <div style={{fontSize:14,fontWeight:700,letterSpacing:6,color:"#f59e0b",marginTop:2}}>STOVE WORKS</div>
          <div style={{color:"#475569",fontSize:11,letterSpacing:3,marginTop:6}}>WHOLESALE & RETAIL</div>
        </div>
        <div style={{background:"#0a0f1a",border:`1px solid ${isLocked?"rgba(239,68,68,.4)":"#1e293b"}`,borderRadius:18,padding:"28px 24px"}}>
          {isLocked && (
            <div style={{textAlign:"center",padding:"20px 0 24px"}}>
              <div style={{fontSize:40,marginBottom:10}}>🔒</div>
              <div style={{color:"#f87171",fontWeight:800,fontSize:16,marginBottom:6}}>Account Locked</div>
              <div style={{color:"#94a3b8",fontSize:13,marginBottom:16}}>Too many failed attempts.</div>
              <div style={{display:"inline-block",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.3)",borderRadius:10,padding:"12px 24px",fontFamily:"'Courier New',monospace",fontSize:28,fontWeight:800,color:"#f87171",letterSpacing:4}}>{fmtCountdown(lockSecs)}</div>
              <div style={{color:"#64748b",fontSize:11,marginTop:10}}>Try again in {Math.ceil(lockSecs/60)} minute{Math.ceil(lockSecs/60)===1?"":"s"}</div>
            </div>
          )}
          {!isLocked && (<>
            <div style={{marginBottom:14}}>
              <label style={C.lbl}>Username</label>
              <input style={{...C.inp,fontSize:16}} value={user} onChange={e=>setUser(e.target.value)} placeholder="admin"
                onKeyDown={e=>e.key==="Enter"&&doLogin()} autoFocus/>
            </div>
            <div style={{marginBottom:16,position:"relative"}}>
              <label style={C.lbl}>Password</label>
              <input style={{...C.inp,fontSize:16}} type={showP?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
                onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
              <button onClick={()=>setShowP(s=>!s)}
                style={{position:"absolute",right:12,top:28,background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:12,padding:"4px 6px"}}>
                {showP?"Hide":"Show"}
              </button>
            </div>
            {attLeft < MAX_TRIES && attLeft > 0 && (
              <div style={{marginBottom:12,padding:"8px 12px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:8,fontSize:12,color:"#fbbf24",display:"flex",alignItems:"center",gap:6}}>
                <I n="warn" s={13}/> {attLeft} attempt{attLeft===1?"":"s"} remaining before lockout
              </div>
            )}
            {err&&(
              <div style={{marginBottom:14,padding:"10px 14px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",borderRadius:10,color:"#f87171",fontSize:13}}>
                {err}
              </div>
            )}
            <button onClick={doLogin} disabled={busy}
              style={{width:"100%",padding:"15px 0",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#0d1117",border:"none",borderRadius:12,fontWeight:800,fontSize:15,cursor:"pointer",opacity:busy?.6:1,letterSpacing:.3,minHeight:52}}>
              {busy?"Signing in…":"Sign In →"}
            </button>
            <div style={{marginTop:16,textAlign:"center",fontSize:11,color:"#475569"}}>
              Change password in Settings after login
            </div>
          </>)}
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

  const save = async () => {
    if (!f.n1) return setErr("New password cannot be empty.");
    if (f.n1 !== f.n2) return setErr("New passwords do not match.");
    if (f.n1.length < 8) return setErr("Password must be at least 8 characters.");
    try {
      const creds = await getDBCreds();
      let currentMatch = false;
      if (IS_HASH(creds.password)) {
        const oldHash = await hashPassword(f.old);
        currentMatch = oldHash === creds.password;
      } else {
        currentMatch = f.old === creds.password;
      }
      if (!currentMatch) return setErr("Current password is incorrect.");
      await saveDBCreds({...creds, password:f.n1});
      setOk(true); setErr("");
    } catch(e) {
      setErr("Could not save: " + e.message);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:500,padding:0}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:"20px 20px 0 0",padding:"24px 20px 32px",width:"100%",maxWidth:480}}>
        <div style={{width:40,height:4,background:"#1e293b",borderRadius:2,margin:"0 auto 20px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:700,color:"#f0f6ff",fontSize:16}}>Change Password</div>
          <button style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:6}} onClick={onClose}><I n="close" s={18}/></button>
        </div>
        {ok ? (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:40,marginBottom:8}}>✅</div>
            <div style={{color:"#10b981",fontWeight:600,marginBottom:20,fontSize:15}}>Password changed successfully!</div>
            <button style={{...C.btnP,width:"100%",justifyContent:"center",padding:"14px 0",fontSize:15}} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:18}}>
              <Fld label="Current Password" type="password" value={f.old} onChange={v=>setF(x=>({...x,old:v}))} ph="Current password"/>
              <Fld label="New Password"     type="password" value={f.n1}  onChange={v=>setF(x=>({...x,n1:v}))}  ph="New password"/>
              <Fld label="Confirm New"      type="password" value={f.n2}  onChange={v=>setF(x=>({...x,n2:v}))}  ph="Repeat new password"/>
            </div>
            {err&&<div style={{color:"#f87171",fontSize:13,marginBottom:14,padding:"10px 12px",background:"rgba(239,68,68,.08)",borderRadius:8}}>{err}</div>}
            <div style={{display:"flex",gap:10}}>
              <button style={{...C.btnP,flex:1,justifyContent:"center",padding:"13px 0",fontSize:14}} onClick={save}><I n="check" s={14}/> Save</button>
              <button style={{...C.btnG,flex:1,justifyContent:"center",padding:"13px 0",fontSize:14}} onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Mobile Header
══════════════════════════════════════════════════════════════ */
function MobileHeader({ uname, onLogout, onChangePw }) {
  return (
    <div style={{position:"sticky",top:0,zIndex:250,background:"#080c14",borderBottom:"1px solid #1a2235",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",WebkitBackdropFilter:"blur(12px)",backdropFilter:"blur(12px)"}} className="no-print">
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:36,height:36,background:"linear-gradient(135deg,#f59e0b,#b45309)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"#0d1117",flexShrink:0}}>S</div>
        <div>
          <div style={{fontWeight:800,fontSize:13,color:"#f0f6ff",letterSpacing:.5,lineHeight:1.2}}>STOVE WORKS</div>
          <div style={{fontSize:10,color:"#475569",marginTop:1}}>👤 {uname}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <button onClick={onChangePw} style={{background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.25)",borderRadius:9,padding:"9px 12px",color:"#f59e0b",cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:600,minHeight:40}}>
          <I n="key" s={15}/>
        </button>
        <button onClick={onLogout} style={{background:"rgba(248,113,113,.1)",border:"1px solid rgba(248,113,113,.25)",borderRadius:9,padding:"9px 14px",color:"#f87171",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,minHeight:40}}>
          <I n="logout" s={15}/> Logout
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Bottom Nav
══════════════════════════════════════════════════════════════ */
function BottomNav({ tab, setTab, TABS }) {
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#080c14",borderTop:"1px solid #1a2235",zIndex:300,display:"flex",overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:"env(safe-area-inset-bottom,0px)",scrollbarWidth:"none"}} className="no-print">
      {TABS.map(t=>(
        <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:"0 0 auto",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 10px 8px",background:tab===t.id?"rgba(245,158,11,.08)":"none",border:"none",borderTop:tab===t.id?"2px solid #f59e0b":"2px solid transparent",color:tab===t.id?"#f59e0b":"#4a5c74",cursor:"pointer",fontSize:9,fontWeight:tab===t.id?700:500,minWidth:58,minHeight:58,transition:"color .15s",WebkitTapHighlightColor:"transparent"}}>
          <I n={t.n} s={22}/>
          <span style={{whiteSpace:"nowrap",marginTop:1}}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Constants outside App — not recreated on every render
══════════════════════════════════════════════════════════════ */
const TABS = [
  {id:"dashboard",label:"Dashboard",n:"dash"},
  {id:"inventory", label:"Inventory", n:"inv"},
  {id:"sales",     label:"New Sale",  n:"sale"},
  {id:"customers", label:"Customers", n:"cust"},
  {id:"suppliers", label:"Suppliers", n:"supp"},
  {id:"debts",     label:"Debts",     n:"debt"},
  {id:"expenses",  label:"Expenses",  n:"exp"},
  {id:"reports",   label:"Reports",   n:"rpt"},
  {id:"import",    label:"Import",    n:"import"},
];

const GLOBAL_CSS = `
  @keyframes spin{to{transform:rotate(360deg)}}
  html,body{margin:0;padding:0;width:100%;height:100%;}
  body{margin:0}
  *{box-sizing:border-box}
  input:focus,select:focus{border-color:#f59e0b!important;outline:none}
  @media print{.no-print{display:none!important}}
  @media(max-width:768px){input,select,textarea{font-size:16px!important}}
  .no-scrollbar::-webkit-scrollbar{display:none}
  .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}
  *{-webkit-tap-highlight-color:transparent}
`;

/* ── Targeted refresh — maps state keys to fetch functions ── */
const DATA_FETCHERS = {
  products:     () => sb.getAll("products"),
  customers:    () => sb.getAll("customers"),
  suppliers:    () => sb.getAll("suppliers").catch(()=>[]),
  sales:        () => sb.getAll("sales","&order=created_at.desc"),
  debtPayments: () => sb.getAll("debt_payments","&order=created_at.desc"),
  expenses:     () => sb.getAll("expenses","&order=created_at.desc"),
};

/* ══════════════════════════════════════════════════════════════
   App Root
══════════════════════════════════════════════════════════════ */
export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn());
  const [uname,  setUname]  = useState(getSession());
  const [data,   setData]   = useState({ products:[], customers:[], suppliers:[], sales:[], debtPayments:[], expenses:[] });
  const [shopGST,setShopGST]= useState("");
  const [tab,    setTab]    = useState("dashboard");
  const [ready,  setReady]  = useState(false);
  const [err,    setErr]    = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pendingScan, setPendingScan] = useState("");
  const isMobile = useIsMobile();

  useEffect(()=>{
    const id = setInterval(()=>{
      if (authed && !isLoggedIn()) { clearSession(); setAuthed(false); setReady(false); }
    }, 60_000);
    return ()=>clearInterval(id);
  }, [authed]);

  useEffect(() => {
    if (!authed || !ready) return;

    let buffer = "";
    let lastAt = 0;

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Shift" || e.key === "CapsLock" || e.key === "Tab") return;

      const now = Date.now();
      if (now - lastAt > 80) buffer = "";
      lastAt = now;

      if (e.key === "Enter") {
        const scanned = buffer.trim();
        buffer = "";
        if (scanned.length >= 4) {
          setPendingScan(scanned);
          setTab("sales");
        }
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authed, ready]);

  const refresh = useCallback(async (tables = null) => {
    // If no tables specified → full refresh (used on login and import)
    const keys = tables ?? Object.keys(DATA_FETCHERS);
    try {
      const results = await Promise.all(keys.map(k => DATA_FETCHERS[k]()));
      setData(prev => {
        const next = { ...prev };
        keys.forEach((k, i) => { next[k] = results[i]; });
        return next;
      });
      // Only re-fetch GST on full refresh
      if (!tables) {
        const gst = await getShopGST();
        setShopGST(gst);
      }
    } catch(e) { setErr(e.message); }
  }, []);

  useEffect(()=>{ if (authed) refresh().then(()=>setReady(true)); }, [authed]);

  const logout = () => { clearSession(); setAuthed(false); setReady(false); setTab("dashboard"); };

  // ⚠ ALL hooks must be called before any early return (Rules of Hooks)
  const commonProps = useMemo(() => ({ data, refresh, isMobile }), [data, refresh, isMobile]);

  if (!authed) return <LoginScreen onLogin={u=>{ setUname(u); setAuthed(true); }}/>;

  if (!ready) return (
    <div style={C.splash}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} body{margin:0}`}</style>
      <div style={{textAlign:"center",padding:"0 20px"}}>
        <div style={{fontSize:36,fontWeight:900,letterSpacing:6,color:"#f59e0b",marginBottom:8}}>STOVE WORKS</div>
        <div style={{color:"#64748b",fontSize:12,letterSpacing:3,marginBottom:24}}>Wholesale & Retail</div>
        {err
          ? <div style={{color:"#f87171",fontSize:13,maxWidth:400}}>{err}</div>
          : <><div style={{color:"#f59e0b",fontSize:12,display:"flex",alignItems:"center",gap:6,justifyContent:"center",marginBottom:14}}><I n="db" s={13}/> Connecting…</div><div style={C.spinner}/></>
        }
      </div>
    </div>
  );

  return (
    <div style={C.app}>
      <style>{GLOBAL_CSS}</style>
      {showPw && <ChangePwModal onClose={()=>setShowPw(false)}/>}

      {!isMobile && (
        <aside style={C.sb} className="no-print">
          <div style={C.brand}>
            <div style={C.bIcon}>S</div>
            <div>
              <div style={C.bName}>STOVE WORKS</div>
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
            <button style={{...C.btnG,width:"100%",justifyContent:"center",fontSize:11,padding:"7px 0",marginBottom:7}} onClick={()=>setShowPw(true)}>
              <I n="key" s={12}/> Change Password
            </button>
            <button style={{...C.btnG,width:"100%",justifyContent:"center",fontSize:11,padding:"7px 0",color:"#f87171",borderColor:"rgba(248,113,113,.3)"}} onClick={logout}>
              <I n="logout" s={12}/> Logout
            </button>
          </div>
        </aside>
      )}

      <main style={{...C.main, padding:0, display:"flex", flexDirection:"column", overflow:"hidden"}}>
        {isMobile && <MobileHeader uname={uname} onLogout={logout} onChangePw={()=>setShowPw(true)}/>}

        <div style={{flex:1,overflow:"auto",padding:isMobile?"14px 12px 80px":"22px 28px"}}>
          <Suspense fallback={<TabLoader/>}>
            {tab==="dashboard" && <Dashboard  {...commonProps}/>}
            {tab==="inventory" && <Inventory  {...commonProps}/>}
            {tab==="sales"     && <Sales      {...commonProps} setTab={setTab} shopGST={shopGST} scannedCode={pendingScan} onScannedHandled={()=>setPendingScan("")}/>}
            {tab==="customers" && <Customers  {...commonProps}/>}
            {tab==="suppliers" && <Suppliers  {...commonProps} shopGST={shopGST} saveShopGST={async g=>{await saveShopGST(g);setShopGST(g);}}/>}
            {tab==="debts"     && <Debts      {...commonProps}/>}
            {tab==="expenses"  && <Expenses   {...commonProps}/>}
            {tab==="reports"   && <Reports    {...commonProps} shopGST={shopGST}/>}
            {tab==="import"    && <ImportData {...commonProps}/>}
          </Suspense>
        </div>
      </main>

      {isMobile && <BottomNav tab={tab} setTab={setTab} TABS={TABS}/>}
    </div>
  );
}
