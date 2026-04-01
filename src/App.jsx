import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════ IndexedDB ═══════════════════════════════ */
const DB_NAME = "StowDB";
const DB_VERSION = 2;
const STORES = ["products","customers","sales","debtPayments","purchases","suppliers","settings"];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath:"id" }); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
let _db = null;
async function getDB() { if (!_db) _db = await openDB(); return _db; }
const idb = {
  async getAll(store) {
    const d = await getDB();
    return new Promise((res,rej) => { const r=d.transaction(store,"readonly").objectStore(store).getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  },
  async get(store, id) {
    const d = await getDB();
    return new Promise((res,rej) => { const r=d.transaction(store,"readonly").objectStore(store).get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
  },
  async put(store, record) {
    const d = await getDB();
    return new Promise((res,rej) => { const r=d.transaction(store,"readwrite").objectStore(store).put(record); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); });
  },
  async putMany(store, records) {
    const d = await getDB();
    return new Promise((res,rej) => { const tx=d.transaction(store,"readwrite"); const os=tx.objectStore(store); records.forEach(r=>os.put(r)); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); });
  },
  async delete(store, id) {
    const d = await getDB();
    return new Promise((res,rej) => { const r=d.transaction(store,"readwrite").objectStore(store).delete(id); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); });
  },
};

/* ═══════════════════════════════════ Helpers ════════════════════════════════ */
const uid     = () => Math.random().toString(36).slice(2,9);
const today   = () => new Date().toISOString().slice(0,10);
const fmt     = n => `₹${Number(n||0).toFixed(2)}`;
const fmtDate = d => new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
const GST_RATES = [0,5,12,18,28];

function calcGST(items, products) {
  const buckets = {};
  items.forEach(item => {
    const prod = products.find(p=>p.id===item.productId);
    const rate = prod?.gstRate ?? 0;
    const base = item.price * item.qty;
    if (!buckets[rate]) buckets[rate] = { base:0, gst:0 };
    buckets[rate].base += base;
    buckets[rate].gst  += base * rate / 100;
  });
  const subtotal  = Object.values(buckets).reduce((a,b)=>a+b.base, 0);
  const totalGST  = Object.values(buckets).reduce((a,b)=>a+b.gst,  0);
  return { buckets, subtotal, totalGST, grandTotal: subtotal + totalGST };
}

const SEED = [
  {id:"p1",name:"Gas Lighter",    category:"Lighter",buyPrice:15, sellPrice:25, stock:100,unit:"pcs", gstRate:18},
  {id:"p2",name:"Butane Burner",  category:"Burner", buyPrice:120,sellPrice:180,stock:40, unit:"pcs", gstRate:18},
  {id:"p3",name:"Matchbox (12pk)",category:"Lighter",buyPrice:8,  sellPrice:15, stock:200,unit:"pack",gstRate:5},
];

/* ═══════════════════════════════════ Mobile Hook ════════════════════════════ */
function useMobile() {
  const [m, setM] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize",h);
    return () => window.removeEventListener("resize",h);
  },[]);
  return m;
}

/* ═══════════════════════════════════ Icons ══════════════════════════════════ */
const Icon = ({ name, size=18 }) => {
  const p = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    inventory: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
    sales:     <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    customers: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    report:    <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    debt:      <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    purchase:  <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    plus:      <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash:     <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>,
    edit:      <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    check:     <><polyline points="20 6 9 17 4 12"/></>,
    close:     <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    warning:   <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    db:        <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {p[name]||null}
    </svg>
  );
};

/* ═══════════════════════════════════ Shared UI ══════════════════════════════ */
function Field({ label, value, onChange, type="text", placeholder="", onEnter }) {
  return (
    <div>
      {label && <label style={S.lbl}>{label}</label>}
      <input style={S.inp} type={type} value={value} placeholder={placeholder}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&onEnter&&onEnter()}/>
    </div>
  );
}
function SectionTitle({ children, style:extra }) {
  return <div style={{fontWeight:700,color:"#64748b",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:12,...extra}}>{children}</div>;
}
function Empty({ text }) {
  return <div style={{color:"#334155",textAlign:"center",padding:"28px 0",fontSize:13}}>{text}</div>;
}
function SR({ label, val, color, bold }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:12,color:"#94a3b8"}}>
      <span>{label}</span>
      <span style={{fontWeight:bold?700:500,color:color||"#e2e8f0"}}>{val}</span>
    </div>
  );
}
function StatCard({ label, val, sub, accent }) {
  return (
    <div style={{...S.card,borderTop:`3px solid ${accent}`,padding:"14px 16px"}}>
      <div style={{color:"#475569",fontSize:11,marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color:accent,letterSpacing:-1}}>{val}</div>
      <div style={{color:"#334155",fontSize:11,marginTop:3}}>{sub}</div>
    </div>
  );
}

/* ═══════════════════════════════════ Login ══════════════════════════════════ */
function LoginScreen({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err,  setErr]  = useState("");
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    setBusy(true); setErr("");
    try {
      let creds = await idb.get("settings","credentials");
      if (!creds) {
        creds = { id:"credentials", username:"admin", password:"admin123" };
        await idb.put("settings", creds);
      }
      if (user.trim()===creds.username && pass===creds.password) onLogin(user.trim());
      else setErr("Incorrect username or password");
    } catch(e) { setErr("DB error: "+e.message); }
    setBusy(false);
  };

  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#0d1117",padding:16}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{width:"100%",maxWidth:340,background:"#080c14",border:"1px solid #1c2333",borderRadius:16,padding:"40px 28px"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:52,fontWeight:900,letterSpacing:8,color:"#f59e0b",lineHeight:1}}>STOW</div>
          <div style={{color:"#334155",fontSize:11,letterSpacing:3,marginTop:8}}>WHOLESALE & RETAIL</div>
        </div>
        <Field label="Username" value={user} onChange={setUser} placeholder="Enter username" onEnter={doLogin}/>
        <div style={{height:12}}/>
        <Field label="Password" type="password" value={pass} onChange={setPass} placeholder="Enter password" onEnter={doLogin}/>
        {err && <div style={{color:"#ef4444",fontSize:12,marginTop:10,padding:"8px 10px",background:"rgba(239,68,68,.08)",borderRadius:6}}>{err}</div>}
        <button style={{...S.btnP,width:"100%",justifyContent:"center",marginTop:20,padding:"12px 0",fontSize:14,opacity:busy?.7:1}} onClick={doLogin} disabled={busy}>
          {busy?"Logging in…":"Login"}
        </button>
        
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ App Root ═══════════════════════════════ */
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [uname,  setUname]  = useState("");
  const [state,  setState]  = useState({products:[],customers:[],sales:[],debtPayments:[],purchases:[],suppliers:[]});
  const [tab,    setTab]    = useState("dashboard");
  const [ready,  setReady]  = useState(false);
  const mobile = useMobile();

  const refresh = useCallback(async () => {
    const keys = ["products","customers","sales","debtPayments","purchases","suppliers"];
    const vals = await Promise.all(keys.map(k=>idb.getAll(k)));
    setState(Object.fromEntries(keys.map((k,i)=>[k,vals[i]])));
  },[]);

  useEffect(()=>{
    if (!authed) return;
    (async()=>{
      const prods = await idb.getAll("products");
      if (!prods.length) await idb.putMany("products", SEED);
      const biz = await idb.get("settings","business");
      if (!biz) await idb.put("settings",{id:"business",name:"STOW Shop",gstin:"",address:""});
      await refresh();
      setReady(true);
    })();
  },[authed]);

  if (!authed) return <LoginScreen onLogin={u=>{setAuthed(true);setUname(u);}}/>;
  if (!ready)  return (
    <div style={S.splash}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{textAlign:"center"}}>
        <div style={S.logo}>STOW</div>
        <div style={S.spinner}/>
        <div style={{color:"#475569",fontSize:12,marginTop:8}}>Loading your data…</div>
      </div>
    </div>
  );

  const TABS = [
    {id:"dashboard",label:"Home",     icon:"dashboard"},
    {id:"inventory",label:"Stock",    icon:"inventory"},
    {id:"sales",    label:"Sale",     icon:"sales"},
    {id:"customers",label:"Customers",icon:"customers"},
    {id:"debts",    label:"Debts",    icon:"debt"},
    {id:"purchases",label:"Purchases",icon:"purchase"},
    {id:"reports",  label:"Reports",  icon:"report"},
    {id:"settings", label:"Settings", icon:"settings"},
  ];

  const logout = () => { setAuthed(false); setReady(false); setUname(""); setTab("dashboard"); };

  return (
    <div style={{...S.app, flexDirection:mobile?"column":"row"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} body{margin:0} *{box-sizing:border-box}`}</style>

      {/* DESKTOP SIDEBAR */}
      {!mobile && (
        <aside style={S.sidebar}>
          <div style={S.brand}>
            <div style={S.brandIcon}>S</div>
            <div><div style={S.brandName}>STOW</div><div style={S.brandSub}>Wholesale & Retail</div></div>
          </div>
          <nav style={{flex:1,display:"flex",flexDirection:"column",gap:2}}>
            {TABS.map(t=>(
              <button key={t.id} style={{...S.navBtn,...(tab===t.id?S.navActive:{})}} onClick={()=>setTab(t.id)}>
                <Icon name={t.icon} size={15}/> {t.id==="dashboard"?"Dashboard":t.label}
              </button>
            ))}
          </nav>
          <div style={S.sbFooter}>
            <div style={{display:"flex",alignItems:"center",gap:5,color:"#10b981",fontSize:11}}><Icon name="db" size={11}/> IndexedDB Active</div>
            <div style={{color:"#475569",fontSize:11,marginTop:3}}>👤 {uname}</div>
            <button style={{...S.btnG,width:"100%",justifyContent:"center",marginTop:8,fontSize:12,padding:"7px 0"}} onClick={logout}>
              <Icon name="logout" size={12}/> Logout
            </button>
          </div>
        </aside>
      )}

      {/* MOBILE HEADER */}
      {mobile && (
        <header style={{background:"#080c14",borderBottom:"1px solid #1c2333",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10,flexShrink:0}}>
          <span style={{fontWeight:900,fontSize:20,letterSpacing:5,color:"#f59e0b"}}>STOW</span>
          <span style={{color:"#64748b",fontSize:12}}>👤 {uname}</span>
          <button style={{background:"transparent",border:"none",color:"#64748b",cursor:"pointer",padding:4}} onClick={logout}><Icon name="logout" size={18}/></button>
        </header>
      )}

      {/* MAIN */}
      <main style={{...S.main, paddingBottom: mobile?80:26}}>
        {tab==="dashboard" && <Dashboard   state={state} mobile={mobile}/>}
        {tab==="inventory" && <Inventory   state={state} idb={idb} refresh={refresh} mobile={mobile}/>}
        {tab==="sales"     && <Sales       state={state} idb={idb} refresh={refresh} setTab={setTab} mobile={mobile}/>}
        {tab==="customers" && <Customers   state={state} idb={idb} refresh={refresh} mobile={mobile}/>}
        {tab==="debts"     && <Debts       state={state} idb={idb} refresh={refresh} mobile={mobile}/>}
        {tab==="purchases" && <Purchases   state={state} idb={idb} refresh={refresh} mobile={mobile}/>}
        {tab==="reports"   && <Reports     state={state} mobile={mobile}/>}
        {tab==="settings"  && <Settings    idb={idb} refresh={refresh} mobile={mobile} uname={uname}/>}
      </main>

      {/* MOBILE BOTTOM NAV */}
      {mobile && (
        <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"#080c14",borderTop:"1px solid #1c2333",display:"flex",zIndex:20,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{flex:"0 0 auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 10px",background:"none",border:"none",borderTop:tab===t.id?"2px solid #f59e0b":"2px solid transparent",color:tab===t.id?"#f59e0b":"#4b6080",cursor:"pointer",minWidth:52,gap:3}}>
              <Icon name={t.icon} size={19}/>
              <span style={{fontSize:8,lineHeight:1,fontWeight:600}}>{t.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

/* ═══════════════════════════════════ Dashboard ══════════════════════════════ */
function Dashboard({ state, mobile }) {
  const { products, customers, sales, suppliers=[] } = state;
  const todaySales   = sales.filter(s=>s.date===today());
  const todayRev     = todaySales.reduce((a,s)=>a+(s.grandTotal||s.total),0);
  const todayProfit  = todaySales.reduce((a,s)=>a+s.profit,0);
  const custDebtTotal= customers.reduce((a,c)=>a+(c.debt||0),0);
  const suppDebtTotal= suppliers.reduce((a,s)=>a+(s.debt||0),0);
  const lowStock     = products.filter(p=>p.stock<=10);
  const recent       = [...sales].sort((a,b)=>b.createdAt-a.createdAt).slice(0,6);

  return (
    <div style={S.page}>
      <h1 style={S.title}>Dashboard</h1>
      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <StatCard label="Today Revenue"  val={fmt(todayRev)}      sub={`${todaySales.length} sales`}                         accent="#f59e0b"/>
        <StatCard label="Today Profit"   val={fmt(todayProfit)}   sub="After buy cost"                                        accent="#10b981"/>
        <StatCard label="Customer Debts" val={fmt(custDebtTotal)} sub={`${customers.filter(c=>c.debt>0).length} customers`}   accent="#ef4444"/>
        <StatCard label="Supplier Debts" val={fmt(suppDebtTotal)} sub="Amount you owe"                                        accent="#818cf8"/>
      </div>
      {lowStock.length>0 && (
        <div style={S.alert}><Icon name="warning" size={14}/> <b>Low Stock:</b> {lowStock.map(p=>`${p.name} (${p.stock} left)`).join(", ")}</div>
      )}
      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:16}}>
        <div style={S.card}>
          <SectionTitle>Recent Sales</SectionTitle>
          {recent.length===0?<Empty text="No sales yet"/>:recent.map(s=>{
            const c=customers.find(c=>c.id===s.customerId);
            const gt=s.grandTotal||s.total;
            return (
              <div key={s.id} style={S.row}>
                <div>
                  <div style={{fontWeight:600,fontSize:13}}>{c?.name||s.walkInName||"Walk-in"}</div>
                  <div style={{color:"#475569",fontSize:11}}>{fmtDate(s.date)} · {s.items.length} item(s)</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:700,color:"#f59e0b"}}>{fmt(gt)}</div>
                  <div style={{fontSize:11,color:s.paid<gt?"#ef4444":"#10b981"}}>{s.paid<gt?`Due ${fmt(gt-s.paid)}`:"Paid ✓"}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={S.card}>
          <SectionTitle>Outstanding Customer Debts</SectionTitle>
          {customers.filter(c=>c.debt>0).length===0
            ?<Empty text="No debts 🎉"/>
            :customers.filter(c=>c.debt>0).sort((a,b)=>b.debt-a.debt).map(c=>(
              <div key={c.id} style={S.row}>
                <div><div style={{fontWeight:600,fontSize:13}}>{c.name}</div><div style={{color:"#475569",fontSize:11}}>{c.phone||"—"}</div></div>
                <div style={{fontWeight:800,color:"#ef4444"}}>{fmt(c.debt)}</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ Inventory ══════════════════════════════ */
function Inventory({ state, idb, refresh, mobile }) {
  const blank = {name:"",category:"",buyPrice:"",sellPrice:"",stock:"",unit:"pcs",gstRate:18};
  const [form,   setForm]   = useState(blank);
  const [editId, setEditId] = useState(null);
  const [show,   setShow]   = useState(false);
  const [search, setSearch] = useState("");

  const save = async () => {
    if (!form.name||!form.sellPrice||form.stock==="") return alert("Fill required fields (Name, Sell Price, Stock)");
    await idb.put("products",{...form,id:editId||uid(),buyPrice:+form.buyPrice,sellPrice:+form.sellPrice,stock:+form.stock,gstRate:+form.gstRate});
    await refresh(); setForm(blank); setEditId(null); setShow(false);
  };
  const del = async id => {
    if (!confirm("Delete this product?")) return;
    await idb.delete("products",id); await refresh();
  };
  const startEdit = p => { setForm({...p}); setEditId(p.id); setShow(true); };
  const filtered = state.products.filter(p=>
    p.name.toLowerCase().includes(search.toLowerCase())||(p.category||"").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={S.page}>
      <div style={S.phdr}>
        <h1 style={S.title}>Inventory</h1>
        <button style={S.btnP} onClick={()=>{setShow(true);setEditId(null);setForm(blank);}}>
          <Icon name="plus" size={14}/> Add Product
        </button>
      </div>
      <input style={S.searchBox} placeholder="Search by name or category…" value={search} onChange={e=>setSearch(e.target.value)}/>

      {show && (
        <div style={{...S.card,marginBottom:16}}>
          <SectionTitle>{editId?"Edit Product":"New Product"}</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
            <div style={mobile?{gridColumn:"1/-1"}:{}}>
              <Field label="Product Name *" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))}/>
            </div>
            <Field label="Category" value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} placeholder="e.g. Burner"/>
            <Field label="Buy Price ₹" type="number" value={form.buyPrice} onChange={v=>setForm(f=>({...f,buyPrice:v}))}/>
            <Field label="Sell Price ₹ *" type="number" value={form.sellPrice} onChange={v=>setForm(f=>({...f,sellPrice:v}))}/>
            <Field label="Stock *" type="number" value={form.stock} onChange={v=>setForm(f=>({...f,stock:v}))}/>
            <div>
              <label style={S.lbl}>Unit</label>
              <select style={S.inp} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                {["pcs","pack","box","kg","ltr","dozen"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>GST Rate %</label>
              <select style={S.inp} value={form.gstRate} onChange={e=>setForm(f=>({...f,gstRate:+e.target.value}))}>
                {GST_RATES.map(r=><option key={r} value={r}>{r===0?"0% (Exempt)":`${r}%`}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={S.btnP} onClick={save}><Icon name="check" size={14}/> {editId?"Update":"Add"}</button>
            <button style={S.btnG} onClick={()=>{setShow(false);setEditId(null);}}><Icon name="close" size={14}/> Cancel</button>
          </div>
        </div>
      )}

      {mobile ? (
        <div>
          {filtered.length===0?<Empty text="No products found"/>:filtered.map(p=>(
            <div key={p.id} style={{...S.card,marginBottom:10,...(p.stock<=10?{borderLeft:"3px solid #ef4444"}:{})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#f0f6ff"}}>{p.name}</div>
                  <div style={{color:"#64748b",fontSize:11,marginTop:2}}>{p.category||"—"} · GST {p.gstRate||0}%</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={S.iBtn} onClick={()=>startEdit(p)}><Icon name="edit" size={13}/></button>
                  <button style={{...S.iBtn,color:"#ef4444"}} onClick={()=>del(p.id)}><Icon name="trash" size={13}/></button>
                </div>
              </div>
              <div style={{display:"flex",gap:14,marginTop:10,fontSize:13}}>
                <div><span style={{color:"#475569",fontSize:11}}>Buy </span><b>{fmt(p.buyPrice)}</b></div>
                <div><span style={{color:"#475569",fontSize:11}}>Sell </span><b style={{color:"#f59e0b"}}>{fmt(p.sellPrice)}</b></div>
                <div><span style={{color:"#475569",fontSize:11}}>Stock </span><b style={{color:p.stock<=10?"#ef4444":"#e2e8f0"}}>{p.stock} {p.unit}</b></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={S.tbl}>
          <div style={{...S.trow,...S.thead,gridTemplateColumns:"2fr 1fr 90px 90px 60px 90px 80px"}}>
            <span>Product</span><span>Category</span><span>Buy ₹</span><span>Sell ₹</span><span>GST</span><span>Stock</span><span>Actions</span>
          </div>
          {filtered.length===0?<Empty text="No products"/>:filtered.map(p=>(
            <div key={p.id} style={{...S.trow,gridTemplateColumns:"2fr 1fr 90px 90px 60px 90px 80px",...(p.stock<=10?{background:"rgba(239,68,68,.04)"}:{})}}>
              <span style={{fontWeight:600}}>{p.name}</span>
              <span style={{color:"#64748b"}}>{p.category||"—"}</span>
              <span>{fmt(p.buyPrice)}</span>
              <span style={{color:"#f59e0b",fontWeight:600}}>{fmt(p.sellPrice)}</span>
              <span style={{color:"#818cf8"}}>{p.gstRate||0}%</span>
              <span style={{color:p.stock<=10?"#ef4444":"#e2e8f0",fontWeight:600}}>{p.stock} {p.unit}</span>
              <span style={{display:"flex",gap:6}}>
                <button style={S.iBtn} onClick={()=>startEdit(p)}><Icon name="edit" size={13}/></button>
                <button style={{...S.iBtn,color:"#ef4444"}} onClick={()=>del(p.id)}><Icon name="trash" size={13}/></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════ New Sale ═══════════════════════════════ */
function Sales({ state, idb, refresh, setTab, mobile }) {
  const [custId,  setCustId]  = useState("");
  const [walkIn,  setWalkIn]  = useState("");
  const [items,   setItems]   = useState([{productId:"",qty:1,price:0}]);
  const [paid,    setPaid]    = useState("");
  const [note,    setNote]    = useState("");
  const [receipt, setReceipt] = useState(null);

  const validItems  = items.filter(i=>i.productId);
  const gstInfo     = calcGST(validItems, state.products);
  const profit      = validItems.reduce((a,i)=>{
    const p=state.products.find(pr=>pr.id===i.productId);
    return a+(p?(i.price-p.buyPrice)*i.qty:0);
  },0);
  const paidAmt  = parseFloat(paid)||0;
  const balance  = gstInfo.grandTotal - paidAmt;

  const setItem = (idx,field,val) => {
    setItems(prev=>{
      const next=[...prev]; next[idx]={...next[idx],[field]:val};
      if (field==="productId") { const p=state.products.find(pr=>pr.id===val); if(p) next[idx].price=p.sellPrice; }
      return next;
    });
  };

  const submit = async () => {
    const valid=items.filter(i=>i.productId&&i.qty>0);
    if (!valid.length) return alert("Add at least one item");
    const gst=calcGST(valid,state.products);
    const sale={
      id:uid(),date:today(),createdAt:Date.now(),
      customerId:custId||null,walkInName:walkIn||null,
      items:valid,subtotal:gst.subtotal,gstTotal:gst.totalGST,
      grandTotal:gst.grandTotal,total:gst.grandTotal,
      gstBuckets:gst.buckets,profit,paid:paidAmt,note,
    };
    await idb.put("sales",sale);
    for (const item of valid) {
      const prod=state.products.find(p=>p.id===item.productId);
      if (prod) await idb.put("products",{...prod,stock:prod.stock-item.qty});
    }
    if (custId && balance>0) {
      const cust=state.customers.find(c=>c.id===custId);
      if (cust) await idb.put("customers",{...cust,debt:(cust.debt||0)+balance});
    }
    await refresh();
    const cust=state.customers.find(c=>c.id===custId);
    setReceipt({...sale,customerName:cust?.name||walkIn||"Walk-in"});
    setItems([{productId:"",qty:1,price:0}]); setCustId(""); setWalkIn(""); setPaid(""); setNote("");
  };

  if (receipt) return <Receipt receipt={receipt} products={state.products} onClose={()=>setReceipt(null)}/>;

  return (
    <div style={S.page}>
      <h1 style={S.title}>New Sale</h1>
      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 320px",gap:16,alignItems:"start"}}>
        <div style={S.card}>
          <SectionTitle>Customer</SectionTitle>
          <div style={{marginBottom:10}}>
            <label style={S.lbl}>Existing Customer</label>
            <select style={S.inp} value={custId} onChange={e=>{setCustId(e.target.value);setWalkIn("");}}>
              <option value="">— Walk-in / Select —</option>
              {state.customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.debt>0?` (Debt:${fmt(c.debt)})`:""}</option>)}
            </select>
          </div>
          {!custId && <Field label="Walk-in Name (optional)" value={walkIn} onChange={setWalkIn}/>}

          <SectionTitle style={{marginTop:16}}>Items</SectionTitle>
          {items.map((item,idx)=>(
            <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr 58px 80px 28px",gap:6,marginBottom:8}}>
              <select style={S.inp} value={item.productId} onChange={e=>setItem(idx,"productId",e.target.value)}>
                <option value="">— Product —</option>
                {state.products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock})</option>)}
              </select>
              <input style={S.inp} type="number" min="1" value={item.qty} onChange={e=>setItem(idx,"qty",+e.target.value)} placeholder="Qty"/>
              <input style={S.inp} type="number" value={item.price} onChange={e=>setItem(idx,"price",+e.target.value)} placeholder="₹"/>
              <button style={{...S.iBtn,color:"#ef4444"}} onClick={()=>setItems(p=>p.filter((_,i)=>i!==idx))}><Icon name="close" size={12}/></button>
            </div>
          ))}
          <button style={S.btnG} onClick={()=>setItems(p=>[...p,{productId:"",qty:1,price:0}])}><Icon name="plus" size={13}/> Add Item</button>
          <div style={{marginTop:10}}><Field label="Note (optional)" value={note} onChange={setNote}/></div>
        </div>

        <div>
          <div style={{...S.card,marginBottom:12}}>
            <SectionTitle>GST Summary</SectionTitle>
            <SR label="Subtotal (excl. GST)" val={fmt(gstInfo.subtotal)} color="#e2e8f0"/>
            {Object.entries(gstInfo.buckets).map(([rate,{gst}])=>
              +rate>0 ? <SR key={rate} label={`GST ${rate}% (CGST ${rate/2}%+SGST ${rate/2}%)`} val={fmt(gst)} color="#818cf8"/> : null
            )}
            <SR label="Total GST" val={fmt(gstInfo.totalGST)} color="#818cf8" bold/>
            <div style={{borderTop:"1px solid #1e293b",margin:"8px 0"}}/>
            <SR label="Grand Total" val={fmt(gstInfo.grandTotal)} color="#f59e0b" bold/>
            <SR label="Est. Profit" val={fmt(profit)} color="#10b981"/>
            <div style={{borderTop:"1px solid #1e293b",margin:"8px 0"}}/>
            <Field label="Amount Paid ₹" type="number" value={paid} onChange={setPaid} placeholder={String(gstInfo.grandTotal.toFixed(2))}/>
            <SR label="Balance Due" val={fmt(balance)} color={balance>0?"#ef4444":"#10b981"} bold/>
            {balance>0&&custId&&<div style={{fontSize:11,color:"#f59e0b",marginTop:4}}>→ Added to customer debt in DB</div>}
          </div>
          <button style={{...S.btnP,width:"100%",justifyContent:"center",padding:"13px 0",fontSize:14}} onClick={submit}>
            <Icon name="check" size={16}/> Confirm Sale & Print
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ Receipt ════════════════════════════════ */
function Receipt({ receipt, products, onClose }) {
  return (
    <div style={{maxWidth:360,margin:"0 auto",paddingTop:20}}>
      <div style={{background:"#fff",color:"#111",padding:24,borderRadius:10,fontFamily:"'Courier New',monospace",fontSize:12}}>
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:22,fontWeight:900,letterSpacing:5}}>STOW</div>
          <div style={{fontSize:10,color:"#555"}}>Wholesale & Retail</div>
          <div style={{borderTop:"1px dashed #ccc",marginTop:6,paddingTop:6,fontSize:10,color:"#777"}}>
            #{receipt.id.toUpperCase()} · {fmtDate(receipt.date)}
          </div>
        </div>
        <div style={{fontWeight:700,marginBottom:8}}>{receipt.customerName}</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr style={{borderBottom:"1px dashed #ccc"}}>
              <th style={{textAlign:"left",padding:"2px 0"}}>Item</th>
              <th style={{textAlign:"center"}}>Qty</th>
              <th style={{textAlign:"right"}}>Rate</th>
              <th style={{textAlign:"right"}}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item,i)=>{
              const p=products.find(pr=>pr.id===item.productId);
              return (
                <tr key={i} style={{borderBottom:"1px dashed #eee"}}>
                  <td style={{padding:"3px 0"}}>{p?.name||"?"} <span style={{color:"#888",fontSize:9}}>[{p?.gstRate||0}% GST]</span></td>
                  <td style={{textAlign:"center"}}>{item.qty}</td>
                  <td style={{textAlign:"right"}}>{fmt(item.price)}</td>
                  <td style={{textAlign:"right",fontWeight:600}}>{fmt(item.price*item.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{marginTop:10,borderTop:"1px dashed #ccc",paddingTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",color:"#555",marginBottom:4}}><span>Subtotal</span><span>{fmt(receipt.subtotal||receipt.total)}</span></div>
          {receipt.gstBuckets && Object.entries(receipt.gstBuckets).map(([rate,{gst}])=>
            +rate>0?(
              <div key={rate} style={{display:"flex",justifyContent:"space-between",color:"#777",fontSize:10}}>
                <span>GST {rate}% (CGST {rate/2}%+SGST {rate/2}%)</span><span>{fmt(gst)}</span>
              </div>
            ):null
          )}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:800,fontSize:15,marginTop:6,borderTop:"1px solid #ccc",paddingTop:6}}><span>Total</span><span>{fmt(receipt.grandTotal||receipt.total)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",color:"#555"}}><span>Paid</span><span>{fmt(receipt.paid)}</span></div>
          {(receipt.grandTotal||receipt.total)-receipt.paid>0&&(
            <div style={{display:"flex",justifyContent:"space-between",color:"red",fontWeight:700}}><span>Balance Due</span><span>{fmt((receipt.grandTotal||receipt.total)-receipt.paid)}</span></div>
          )}
        </div>
        {receipt.note&&<div style={{marginTop:8,fontSize:10,color:"#777"}}>Note: {receipt.note}</div>}
        <div style={{textAlign:"center",marginTop:12,fontSize:10,color:"#aaa",borderTop:"1px dashed #ccc",paddingTop:6}}>Thank you! Visit again.</div>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:14}}>
        <button style={S.btnP} onClick={()=>window.print()}>🖨 Print</button>
        <button style={S.btnG} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ Customers ══════════════════════════════ */
function Customers({ state, idb, refresh, mobile }) {
  const [form, setForm] = useState({name:"",phone:"",address:""});
  const [show, setShow] = useState(false);

  const add = async () => {
    if (!form.name) return alert("Enter customer name");
    await idb.put("customers",{...form,id:uid(),debt:0});
    await refresh(); setForm({name:"",phone:"",address:""}); setShow(false);
  };
  const del = async id => {
    const c=state.customers.find(c=>c.id===id);
    if (c.debt>0&&!confirm(`This customer owes ${fmt(c.debt)}. Delete anyway?`)) return;
    await idb.delete("customers",id); await refresh();
  };

  return (
    <div style={S.page}>
      <div style={S.phdr}>
        <h1 style={S.title}>Customers</h1>
        <button style={S.btnP} onClick={()=>setShow(true)}><Icon name="plus" size={14}/> Add</button>
      </div>
      {show&&(
        <div style={{...S.card,marginBottom:16}}>
          <SectionTitle>New Customer</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)",gap:10}}>
            <Field label="Name *" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))}/>
            <Field label="Phone" value={form.phone} onChange={v=>setForm(f=>({...f,phone:v}))}/>
            <Field label="Address" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button style={S.btnP} onClick={add}><Icon name="check" size={14}/> Save</button>
            <button style={S.btnG} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}
      {mobile?(
        <div>
          {state.customers.length===0?<Empty text="No customers yet"/>:state.customers.map(c=>(
            <div key={c.id} style={{...S.card,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
                  <div style={{color:"#64748b",fontSize:12,marginTop:2}}>{c.phone||"—"} · {c.address||"—"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:700,color:c.debt>0?"#ef4444":"#10b981"}}>{c.debt>0?fmt(c.debt):"Clear ✓"}</div>
                  <button style={{...S.iBtn,color:"#ef4444",marginTop:6}} onClick={()=>del(c.id)}><Icon name="trash" size={13}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ):(
        <div style={S.tbl}>
          <div style={{...S.trow,...S.thead,gridTemplateColumns:"1fr 1fr 1fr 100px 50px"}}>
            <span>Name</span><span>Phone</span><span>Address</span><span>Debt</span><span>Del</span>
          </div>
          {state.customers.length===0?<Empty text="No customers yet"/>:state.customers.map(c=>(
            <div key={c.id} style={{...S.trow,gridTemplateColumns:"1fr 1fr 1fr 100px 50px"}}>
              <span style={{fontWeight:600}}>{c.name}</span>
              <span style={{color:"#64748b"}}>{c.phone||"—"}</span>
              <span style={{color:"#64748b"}}>{c.address||"—"}</span>
              <span style={{fontWeight:700,color:c.debt>0?"#ef4444":"#10b981"}}>{c.debt>0?fmt(c.debt):"Clear ✓"}</span>
              <button style={{...S.iBtn,color:"#ef4444"}} onClick={()=>del(c.id)}><Icon name="trash" size={13}/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════ Debts ══════════════════════════════════ */
function Debts({ state, idb, refresh }) {
  const [payAmt, setPayAmt] = useState({});
  const debtors = state.customers.filter(c=>c.debt>0).sort((a,b)=>b.debt-a.debt);

  const collect = async custId => {
    const amt=parseFloat(payAmt[custId]);
    if (!amt||amt<=0) return alert("Enter valid amount");
    const cust=state.customers.find(c=>c.id===custId);
    await idb.put("customers",{...cust,debt:Math.max(0,(cust.debt||0)-amt)});
    await idb.put("debtPayments",{id:uid(),customerId:custId,amount:amt,date:today(),createdAt:Date.now()});
    await refresh(); setPayAmt(p=>({...p,[custId]:""}));
  };

  return (
    <div style={S.page}>
      <h1 style={S.title}>Customer Debts</h1>
      {debtors.length===0
        ?<div style={{...S.card,textAlign:"center",padding:48}}><div style={{fontSize:40,marginBottom:8}}>✅</div><div style={{color:"#475569"}}>No outstanding debts!</div></div>
        :debtors.map(c=>(
          <div key={c.id} style={{...S.card,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div><div style={{fontWeight:700,fontSize:16}}>{c.name}</div><div style={{color:"#475569",fontSize:12}}>{c.phone||"No phone"}</div></div>
              <div style={{fontWeight:800,fontSize:24,color:"#ef4444"}}>{fmt(c.debt)}</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <input style={{...S.inp,flex:1}} type="number" placeholder="Collection ₹"
                value={payAmt[c.id]||""} onChange={e=>setPayAmt(p=>({...p,[c.id]:e.target.value}))}/>
              <button style={S.btnP} onClick={()=>collect(c.id)}><Icon name="check" size={14}/> Collect</button>
            </div>
            <div style={{marginTop:10}}>
              <div style={{fontSize:11,color:"#334155",marginBottom:4}}>History:</div>
              {state.debtPayments.filter(p=>p.customerId===c.id).sort((a,b)=>b.createdAt-a.createdAt).slice(0,5).map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#475569",padding:"2px 0"}}>
                  <span>{fmtDate(p.date)}</span><span style={{color:"#10b981",fontWeight:600}}>+{fmt(p.amount)} collected</span>
                </div>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  );
}

/* ═══════════════════════════════════ Purchases ══════════════════════════════ */
function Purchases({ state, idb, refresh, mobile }) {
  const [view,         setView]        = useState("list");
  const [suppId,       setSuppId]      = useState("");
  const [items,        setItems]       = useState([{productId:"",qty:1,buyPrice:0}]);
  const [paid,         setPaid]        = useState("");
  const [note,         setNote]        = useState("");
  const [payAmt,       setPayAmt]      = useState({});
  const [showAddSupp,  setShowAddSupp] = useState(false);
  const [suppForm,     setSuppForm]    = useState({name:"",phone:"",address:""});

  const totalCost = items.reduce((a,i)=>a+(+i.buyPrice * +i.qty),0);
  const paidAmt   = parseFloat(paid)||0;
  const balance   = totalCost-paidAmt;

  const setItem = (idx,field,val) => {
    setItems(prev=>{
      const next=[...prev]; next[idx]={...next[idx],[field]:val};
      if (field==="productId") { const p=state.products.find(pr=>pr.id===val); if(p) next[idx].buyPrice=p.buyPrice; }
      return next;
    });
  };

  const savePurchase = async () => {
    const valid=items.filter(i=>i.productId&&i.qty>0);
    if (!valid.length) return alert("Add at least one item");
    const purchase={id:uid(),date:today(),createdAt:Date.now(),supplierId:suppId||null,items:valid,total:totalCost,paid:paidAmt,note};
    await idb.put("purchases",purchase);
    for (const item of valid) {
      const prod=state.products.find(p=>p.id===item.productId);
      if (prod) await idb.put("products",{...prod,stock:prod.stock+item.qty,buyPrice:+item.buyPrice});
    }
    if (suppId && balance>0) {
      const supp=state.suppliers.find(s=>s.id===suppId);
      if (supp) await idb.put("suppliers",{...supp,debt:(supp.debt||0)+balance});
    }
    await refresh();
    setItems([{productId:"",qty:1,buyPrice:0}]); setSuppId(""); setPaid(""); setNote("");
    setView("list");
    alert(`Purchase recorded! Stock updated. ${suppId&&balance>0?`₹${balance.toFixed(2)} added to supplier debt.`:""}`);
  };

  const paySupplier = async suppId => {
    const amt=parseFloat(payAmt[suppId]);
    if (!amt||amt<=0) return alert("Enter valid amount");
    const supp=state.suppliers.find(s=>s.id===suppId);
    await idb.put("suppliers",{...supp,debt:Math.max(0,(supp.debt||0)-amt)});
    await refresh(); setPayAmt(p=>({...p,[suppId]:""}));
  };

  const addSupplier = async () => {
    if (!suppForm.name) return alert("Enter supplier name");
    await idb.put("suppliers",{...suppForm,id:uid(),debt:0});
    await refresh(); setSuppForm({name:"",phone:"",address:""}); setShowAddSupp(false);
  };

  const debtSuppliers=state.suppliers.filter(s=>s.debt>0).sort((a,b)=>b.debt-a.debt);

  return (
    <div style={S.page}>
      <div style={S.phdr}>
        <h1 style={S.title}>Purchases</h1>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={view==="new"?S.btnP:S.btnG} onClick={()=>setView(view==="new"?"list":"new")}><Icon name="plus" size={14}/> New</button>
          <button style={view==="suppliers"?S.btnP:S.btnG} onClick={()=>setView(view==="suppliers"?"list":"suppliers")}>Suppliers</button>
        </div>
      </div>

      {/* New Purchase Form */}
      {view==="new" && (
        <div style={{...S.card,marginBottom:16}}>
          <SectionTitle>Record Stock Purchase</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <label style={S.lbl}>Supplier (leave empty for cash purchase)</label>
              <select style={S.inp} value={suppId} onChange={e=>setSuppId(e.target.value)}>
                <option value="">— Cash Purchase —</option>
                {state.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}{s.debt>0?` (owes ${fmt(s.debt)})`:""}</option>)}
              </select>
            </div>
          </div>

          <SectionTitle>Items Purchased</SectionTitle>
          {items.map((item,idx)=>(
            <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr 58px 90px 28px",gap:6,marginBottom:8}}>
              <select style={S.inp} value={item.productId} onChange={e=>setItem(idx,"productId",e.target.value)}>
                <option value="">— Product —</option>
                {state.products.map(p=><option key={p.id} value={p.id}>{p.name} (stock:{p.stock})</option>)}
              </select>
              <input style={S.inp} type="number" min="1" value={item.qty} onChange={e=>setItem(idx,"qty",+e.target.value)} placeholder="Qty"/>
              <input style={S.inp} type="number" value={item.buyPrice} onChange={e=>setItem(idx,"buyPrice",+e.target.value)} placeholder="Buy ₹"/>
              <button style={{...S.iBtn,color:"#ef4444"}} onClick={()=>setItems(p=>p.filter((_,i)=>i!==idx))}><Icon name="close" size={12}/></button>
            </div>
          ))}
          <button style={S.btnG} onClick={()=>setItems(p=>[...p,{productId:"",qty:1,buyPrice:0}])}><Icon name="plus" size={13}/> Add Item</button>

          <div style={{borderTop:"1px solid #1c2333",marginTop:14,paddingTop:12}}>
            <SR label="Total Cost" val={fmt(totalCost)} color="#f59e0b" bold/>
            <Field label="Amount Paid Now ₹" type="number" value={paid} onChange={setPaid} placeholder={String(totalCost.toFixed(2))}/>
            <SR label="Balance (Supplier Debt)" val={fmt(balance)} color={balance>0?"#ef4444":"#10b981"} bold/>
            {balance>0&&suppId&&<div style={{fontSize:11,color:"#f59e0b",marginTop:4}}>→ Balance added to supplier debt</div>}
            {balance>0&&!suppId&&<div style={{fontSize:11,color:"#64748b",marginTop:4}}>Tip: Select a supplier to track debt</div>}
          </div>
          <div style={{marginTop:10}}><Field label="Note" value={note} onChange={setNote}/></div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button style={S.btnP} onClick={savePurchase}><Icon name="check" size={14}/> Record & Update Stock</button>
            <button style={S.btnG} onClick={()=>setView("list")}><Icon name="close" size={14}/> Cancel</button>
          </div>
        </div>
      )}

      {/* Suppliers List */}
      {view==="suppliers" && (
        <div style={{...S.card,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <SectionTitle style={{marginBottom:0}}>Suppliers</SectionTitle>
            <button style={S.btnG} onClick={()=>setShowAddSupp(v=>!v)}><Icon name="plus" size={13}/> Add</button>
          </div>
          {showAddSupp&&(
            <div style={{background:"#0d1117",borderRadius:8,padding:14,marginBottom:12}}>
              <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"repeat(3,1fr)",gap:8}}>
                <Field label="Name *" value={suppForm.name} onChange={v=>setSuppForm(f=>({...f,name:v}))}/>
                <Field label="Phone" value={suppForm.phone} onChange={v=>setSuppForm(f=>({...f,phone:v}))}/>
                <Field label="Address" value={suppForm.address} onChange={v=>setSuppForm(f=>({...f,address:v}))}/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button style={S.btnP} onClick={addSupplier}><Icon name="check" size={14}/> Save</button>
                <button style={S.btnG} onClick={()=>setShowAddSupp(false)}>Cancel</button>
              </div>
            </div>
          )}
          {state.suppliers.length===0?<Empty text="No suppliers yet"/>:state.suppliers.map(s=>(
            <div key={s.id} style={S.row}>
              <div><div style={{fontWeight:600}}>{s.name}</div><div style={{color:"#64748b",fontSize:12}}>{s.phone||"—"}</div></div>
              <div style={{fontWeight:700,color:s.debt>0?"#ef4444":"#10b981"}}>{s.debt>0?fmt(s.debt):"Clear ✓"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Pay Suppliers */}
      {debtSuppliers.length>0 && (
        <>
          <h2 style={{fontSize:15,fontWeight:700,color:"#f0f6ff",marginBottom:12,marginTop:4}}>Pay Suppliers</h2>
          {debtSuppliers.map(s=>(
            <div key={s.id} style={{...S.card,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div><div style={{fontWeight:700,fontSize:15}}>{s.name}</div><div style={{color:"#475569",fontSize:12}}>{s.phone||"—"}</div></div>
                <div style={{fontWeight:800,fontSize:22,color:"#ef4444"}}>{fmt(s.debt)}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <input style={{...S.inp,flex:1}} type="number" placeholder="Pay amount ₹"
                  value={payAmt[s.id]||""} onChange={e=>setPayAmt(p=>({...p,[s.id]:e.target.value}))}/>
                <button style={S.btnP} onClick={()=>paySupplier(s.id)}><Icon name="check" size={14}/> Pay</button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Purchase History */}
      <h2 style={{fontSize:15,fontWeight:700,color:"#f0f6ff",marginBottom:12,marginTop:20}}>Purchase History</h2>
      <div style={S.tbl}>
        <div style={{...S.trow,...S.thead,gridTemplateColumns:mobile?"100px 1fr 80px 80px":"130px 1fr 60px 100px 90px 80px"}}>
          <span>Date</span><span>Supplier</span>{!mobile&&<span>Items</span>}<span>Total</span>{!mobile&&<span>Paid</span>}<span>Balance</span>
        </div>
        {state.purchases.length===0?<Empty text="No purchases recorded"/>:
          [...state.purchases].sort((a,b)=>b.createdAt-a.createdAt).map(p=>{
            const supp=state.suppliers.find(s=>s.id===p.supplierId);
            return (
              <div key={p.id} style={{...S.trow,gridTemplateColumns:mobile?"100px 1fr 80px 80px":"130px 1fr 60px 100px 90px 80px"}}>
                <span style={{color:"#475569",fontSize:12}}>{fmtDate(p.date)}</span>
                <span style={{fontWeight:600}}>{supp?.name||"Cash Purchase"}</span>
                {!mobile&&<span style={{color:"#64748b"}}>{p.items.length}</span>}
                <span style={{fontWeight:700}}>{fmt(p.total)}</span>
                {!mobile&&<span style={{color:"#10b981"}}>{fmt(p.paid)}</span>}
                <span style={{color:p.total-p.paid>0?"#ef4444":"#10b981"}}>{fmt(p.total-p.paid)}</span>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ Reports ════════════════════════════════ */
function Reports({ state, mobile }) {
  const [range, setRange] = useState("today");
  const [from,  setFrom]  = useState(today());
  const [to,    setTo]    = useState(today());

  const filtered = state.sales.filter(s=>{
    if (range==="today") return s.date===today();
    if (range==="week")  { const d=new Date(); d.setDate(d.getDate()-7); return s.date>=d.toISOString().slice(0,10); }
    if (range==="month") return s.date.slice(0,7)===today().slice(0,7);
    return s.date>=from&&s.date<=to;
  }).sort((a,b)=>b.createdAt-a.createdAt);

  const revenue      = filtered.reduce((a,s)=>a+(s.grandTotal||s.total),0);
  const collected    = filtered.reduce((a,s)=>a+s.paid,0);
  const gstCollected = filtered.reduce((a,s)=>a+(s.gstTotal||0),0);
  const profit       = filtered.reduce((a,s)=>a+s.profit,0);

  return (
    <div style={S.page}>
      <h1 style={S.title}>Reports & Statements</h1>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        {[["today","Today"],["week","7 Days"],["month","Month"],["custom","Custom"]].map(([v,l])=>(
          <button key={v} style={range===v?S.btnP:S.btnG} onClick={()=>setRange(v)}>{l}</button>
        ))}
        {range==="custom"&&<>
          <input style={{...S.inp,width:130}} type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
          <span style={{color:"#475569"}}>→</span>
          <input style={{...S.inp,width:130}} type="date" value={to} onChange={e=>setTo(e.target.value)}/>
        </>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:20}}>
        <StatCard label="Total Revenue"  val={fmt(revenue)}      sub={`${filtered.length} sales`} accent="#f59e0b"/>
        <StatCard label="Cash Collected" val={fmt(collected)}    sub="Received"                    accent="#10b981"/>
        <StatCard label="GST Collected"  val={fmt(gstCollected)} sub="CGST + SGST"                accent="#818cf8"/>
        <StatCard label="Net Profit"     val={fmt(profit)}       sub="After buy cost"               accent="#22d3ee"/>
      </div>
      <div style={S.tbl}>
        <div style={{...S.trow,...S.thead,gridTemplateColumns:mobile?"90px 1fr 80px 70px":"130px 1fr 60px 100px 80px 80px 80px"}}>
          <span>Date</span><span>Customer</span>
          {!mobile&&<span>Items</span>}
          {!mobile&&<span>Subtotal</span>}
          {!mobile&&<span>GST</span>}
          <span>Total</span>
          <span>Balance</span>
        </div>
        {filtered.length===0?<Empty text="No sales in this period"/>:filtered.map(s=>{
          const cu=state.customers.find(c=>c.id===s.customerId);
          const gt=s.grandTotal||s.total;
          return (
            <div key={s.id} style={{...S.trow,gridTemplateColumns:mobile?"90px 1fr 80px 70px":"130px 1fr 60px 100px 80px 80px 80px"}}>
              <span style={{color:"#475569",fontSize:11}}>{fmtDate(s.date)}</span>
              <span style={{fontWeight:600,fontSize:12}}>{cu?.name||s.walkInName||"Walk-in"}</span>
              {!mobile&&<span style={{color:"#64748b"}}>{s.items.length}</span>}
              {!mobile&&<span>{fmt(s.subtotal||s.total)}</span>}
              {!mobile&&<span style={{color:"#818cf8"}}>{fmt(s.gstTotal||0)}</span>}
              <span style={{fontWeight:700}}>{fmt(gt)}</span>
              <span style={{color:gt-s.paid>0?"#ef4444":"#10b981"}}>{fmt(gt-s.paid)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ Settings ═══════════════════════════════ */
function Settings({ idb, mobile, uname }) {
  const [pw,    setPw]   = useState({old:"",n1:"",n2:""});
  const [biz,   setBiz]  = useState({name:"STOW Shop",gstin:"",address:""});
  const [toast, setToast]= useState(null);

  useEffect(()=>{ idb.get("settings","business").then(r=>{if(r)setBiz(r);}); },[]);

  const notify = (msg,ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  const changePw = async () => {
    try {
      const creds=await idb.get("settings","credentials");
      if (!creds||pw.old!==creds.password) return notify("Old password incorrect",false);
      if (pw.n1!==pw.n2) return notify("New passwords don't match",false);
      if (pw.n1.length<4) return notify("Password must be at least 4 characters",false);
      await idb.put("settings",{...creds,password:pw.n1});
      setPw({old:"",n1:"",n2:""});
      notify("Password changed successfully ✓");
    } catch(e) { notify("Error: "+e.message,false); }
  };

  const saveBiz = async () => {
    await idb.put("settings",{...biz,id:"business"});
    notify("Business info saved ✓");
  };

  return (
    <div style={S.page}>
      <h1 style={S.title}>Settings</h1>

      {toast&&(
        <div style={{...S.alert,marginBottom:16,color:toast.ok?"#10b981":"#ef4444",borderColor:toast.ok?"rgba(16,185,129,.3)":"rgba(239,68,68,.3)"}}>
          {toast.msg}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:mobile?"1fr":"1fr 1fr",gap:16}}>
        <div style={S.card}>
          <SectionTitle>Business Info (for receipts)</SectionTitle>
          <Field label="Business Name" value={biz.name} onChange={v=>setBiz(b=>({...b,name:v}))}/>
          <div style={{height:10}}/>
          <Field label="GSTIN" value={biz.gstin} onChange={v=>setBiz(b=>({...b,gstin:v}))} placeholder="e.g. 33ABCDE1234F1Z5"/>
          <div style={{height:10}}/>
          <Field label="Address" value={biz.address} onChange={v=>setBiz(b=>({...b,address:v}))}/>
          <button style={{...S.btnP,marginTop:14}} onClick={saveBiz}><Icon name="check" size={14}/> Save Info</button>
        </div>

        <div style={S.card}>
          <SectionTitle>Change Password</SectionTitle>
          <div style={{color:"#475569",fontSize:12,marginBottom:14}}>Logged in as <b style={{color:"#f59e0b"}}>{uname}</b></div>
          <Field label="Current Password" type="password" value={pw.old} onChange={v=>setPw(p=>({...p,old:v}))}/>
          <div style={{height:8}}/>
          <Field label="New Password" type="password" value={pw.n1} onChange={v=>setPw(p=>({...p,n1:v}))}/>
          <div style={{height:8}}/>
          <Field label="Confirm New Password" type="password" value={pw.n2} onChange={v=>setPw(p=>({...p,n2:v}))}/>
          <button style={{...S.btnP,marginTop:14}} onClick={changePw}><Icon name="check" size={14}/> Change Password</button>
        </div>
      </div>

      <div style={{...S.card,marginTop:16}}>
        <SectionTitle>About STOW</SectionTitle>
        <div style={{color:"#475569",fontSize:13,lineHeight:1.8}}>
          <div style={{marginBottom:4}}><b style={{color:"#f0f6ff"}}>STOW v2</b> · Wholesale & Retail Management System</div>
          <div>✔ GST billing with CGST/SGST breakdown · ✔ Supplier purchases on credit</div>
          <div>✔ Customer & supplier debt tracking · ✔ Reports with GST collected</div>
          <div>✔ All data stored locally in <b style={{color:"#818cf8"}}>IndexedDB</b> — works offline, no server needed</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════ Styles ═════════════════════════════════ */
const S = {
  app:      {display:"flex",height:"100dvh",background:"#0d1117",fontFamily:"'DM Sans',system-ui,sans-serif",overflow:"hidden"},
  sidebar:  {width:210,background:"#080c14",borderRight:"1px solid #1c2333",display:"flex",flexDirection:"column",padding:"18px 12px",flexShrink:0},
  brand:    {display:"flex",alignItems:"center",gap:10,marginBottom:24,paddingLeft:4},
  brandIcon:{width:36,height:36,background:"linear-gradient(135deg,#f59e0b,#b45309)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"#0d1117"},
  brandName:{fontWeight:900,fontSize:14,color:"#f0f6ff",letterSpacing:1},
  brandSub: {fontSize:9,color:"#334155",letterSpacing:.5},
  navBtn:   {display:"flex",alignItems:"center",gap:9,padding:"9px 12px",background:"none",border:"none",borderRadius:8,color:"#4b6080",cursor:"pointer",fontSize:13,fontWeight:500,textAlign:"left",width:"100%"},
  navActive:{background:"rgba(245,158,11,.12)",color:"#f59e0b"},
  sbFooter: {paddingTop:12,borderTop:"1px solid #1c2333"},
  main:     {flex:1,overflowY:"auto",overflowX:"hidden",padding:"20px 20px"},
  page:     {maxWidth:960,margin:"0 auto"},
  title:    {fontSize:22,fontWeight:800,color:"#f0f6ff",marginBottom:20,letterSpacing:-.5,margin:"0 0 20px 0"},
  phdr:     {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20},
  card:     {background:"#080c14",border:"1px solid #1c2333",borderRadius:10,padding:"18px"},
  row:      {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #0d1117"},
  alert:    {display:"flex",gap:8,alignItems:"center",background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,padding:"10px 14px",color:"#fbbf24",fontSize:13,marginBottom:16},
  tbl:      {background:"#080c14",border:"1px solid #1c2333",borderRadius:10,overflow:"hidden"},
  trow:     {display:"grid",gap:8,padding:"10px 14px",borderBottom:"1px solid #0d1117",fontSize:13,alignItems:"center",color:"#d4e0f0"},
  thead:    {color:"#334155",fontSize:10,textTransform:"uppercase",letterSpacing:1,fontWeight:700},
  lbl:      {display:"block",fontSize:10,color:"#334155",marginBottom:4,textTransform:"uppercase",letterSpacing:.5},
  inp:      {width:"100%",background:"#0d1117",border:"1px solid #1c2333",borderRadius:6,padding:"9px 10px",color:"#f0f6ff",fontSize:13,outline:"none",boxSizing:"border-box"},
  searchBox:{width:"100%",background:"#080c14",border:"1px solid #1c2333",borderRadius:8,padding:"10px 14px",color:"#f0f6ff",fontSize:13,outline:"none",marginBottom:14,boxSizing:"border-box"},
  btnP:     {display:"flex",alignItems:"center",gap:6,background:"#f59e0b",color:"#0d1117",border:"none",borderRadius:7,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"},
  btnG:     {display:"flex",alignItems:"center",gap:6,background:"transparent",color:"#4b6080",border:"1px solid #1c2333",borderRadius:7,padding:"8px 14px",fontWeight:500,fontSize:13,cursor:"pointer"},
  iBtn:     {background:"transparent",border:"1px solid #1c2333",borderRadius:5,padding:"5px 7px",color:"#334155",cursor:"pointer"},
  splash:   {display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0d1117"},
  logo:     {fontSize:52,fontWeight:900,letterSpacing:8,color:"#f59e0b",marginBottom:16},
  spinner:  {width:28,height:28,border:"3px solid #1c2333",borderTop:"3px solid #f59e0b",borderRadius:"50%",animation:"spin 1s linear infinite",margin:"16px auto"},
};
