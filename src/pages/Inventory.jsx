import { useState, useMemo, useCallback } from "react";
import { C, I, ST, MT, Fld, Toast, useToast, sb, uid, fmt, today } from "../shared.jsx";

/* ── Modal overlay for Add / Edit ── */
function ProductModal({ eid, form, setForm, onSave, onClose, busy, dupBarcode }) {
  const isEdit = !!eid;
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:"fixed",inset:0,zIndex:600,
        background:"rgba(0,0,0,.75)",
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:16,
        backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
      }}
    >
      <div style={{
        background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:18,
        padding:"24px 22px 28px",width:"100%",maxWidth:540,
        maxHeight:"90vh",overflowY:"auto",
        boxShadow:"0 24px 64px rgba(0,0,0,.7)",
      }}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:16,color:"#f0f6ff"}}>
            {isEdit?"✏️ Edit Product":"➕ New Product"}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:6,borderRadius:8,display:"flex"}}>
            <I n="close" s={20}/>
          </button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div style={{gridColumn:"1 / -1"}}>
            <Fld label="Product Name *" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))}/>
          </div>
          <Fld label="Category" value={form.category} onChange={v=>setForm(f=>({...f,category:v}))} ph="Burner, Lighter..."/>
          <div>
            <label style={C.lbl}>Unit</label>
            <select style={C.inp} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
              {["pcs","pack","box","kg","ltr","dozen","set","ft"].map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
          <Fld label="Buy Price Rs" type="number" value={form.buy_price} onChange={v=>setForm(f=>({...f,buy_price:v}))}/>
          <Fld label="Sell Price Rs *" type="number" value={form.sell_price} onChange={v=>setForm(f=>({...f,sell_price:v}))}/>
          <div>
            <label style={C.lbl}>GST %</label>
            <select style={C.inp} value={form.gst} onChange={e=>setForm(f=>({...f,gst:+e.target.value}))}>
              {[0,5,12,18,28].map(g=><option key={g} value={g}>{g}%</option>)}
            </select>
          </div>
          <Fld label="Stock *" type="number" value={form.stock} onChange={v=>setForm(f=>({...f,stock:v}))}/>
          {/* Barcode — full width, optional */}
          <div style={{gridColumn:"1 / -1"}}>
            <label style={C.lbl}>Barcode (EAN-13 / UPC-A / Code 128)</label>
            <div style={{position:"relative"}}>
              <input
                style={{
                  ...C.inp,
                  fontFamily:"monospace",
                  fontSize:15,
                  letterSpacing:2,
                  paddingRight:40,
                }}
                value={form.barcode||""}
                onChange={e=>setForm(f=>({...f,barcode:e.target.value.replace(/\s/g,"")}))}
                placeholder="Scan or type barcode…"
                autoComplete="off"
                spellCheck="false"
              />
              {/* barcode icon inside field */}
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#334155",pointerEvents:"none",display:"flex"}}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
                  <path d="M3 5h2M3 19h2M19 5h2M19 19h2"/>
                </svg>
              </span>
            </div>
            {/* Duplicate warning */}
            {form.barcode && dupBarcode && (
              <div style={{marginTop:6,fontSize:11,color:"#fbbf24",display:"flex",gap:5,alignItems:"center"}}>
                <I n="warn" s={12}/> Already used by: <b>{dupBarcode}</b>
              </div>
            )}
            {form.barcode && !dupBarcode && (
              <div style={{marginTop:5,fontSize:11,color:"#475569"}}>Optional — leave blank if no barcode on product</div>
            )}
          </div>
        </div>
        {+form.buy_price>0 && +form.sell_price>0 && (
          <div style={{marginBottom:16,padding:"10px 14px",background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.2)",borderRadius:8,fontSize:12,color:"#34d399"}}>
            Margin: <b>{(((+form.sell_price - +form.buy_price) / +form.buy_price)*100).toFixed(1)}%</b>
            {" "}&nbsp;·&nbsp; Profit per unit: <b>{fmt(+form.sell_price - +form.buy_price)}</b>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <button style={{...C.btnP,flex:1,justifyContent:"center",minHeight:46,fontSize:14}} onClick={onSave} disabled={busy}>
            <I n="check" s={15}/> {busy?"Saving...":isEdit?"Update Product":"Add Product"}
          </button>
          <button style={{...C.btnG,flex:1,justifyContent:"center",minHeight:46,fontSize:14}} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ── Top Selling Products ── */
function TopSelling({ sales, products, isMobile }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const { label, topItems } = useMemo(() => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const ym = target.toISOString().slice(0,7);
    const lbl = target.toLocaleDateString("en-IN",{month:"long",year:"numeric"});
    const qtyMap = {}, revMap = {};
    sales.forEach(s => {
      if (!s.date?.startsWith(ym)) return;
      (s.items||[]).forEach(item => {
        if (!item.productId) return;
        qtyMap[item.productId] = (qtyMap[item.productId]||0) + (item.qty||0);
        revMap[item.productId] = (revMap[item.productId]||0) + (item.price||0)*(item.qty||0);
      });
    });
    const top = Object.entries(qtyMap)
      .sort((a,b)=>b[1]-a[1]).slice(0,8)
      .map(([id,qty])=>{ const p=products.find(x=>x.id===id); return {id,name:p?.name||"Unknown",qty,revenue:revMap[id]||0}; });
    return {label:lbl, topItems:top};
  }, [sales, products, monthOffset]);

  const maxQty = topItems[0]?.qty || 1;
  const barColors = ["#f59e0b","#94a3b8","#cd7c3a","#334155","#334155","#334155","#334155","#334155"];
  const badgeBg = [
    "linear-gradient(135deg,#f59e0b,#d97706)",
    "linear-gradient(135deg,#94a3b8,#64748b)",
    "linear-gradient(135deg,#cd7c3a,#92400e)",
  ];

  return (
    <div style={{...C.card,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <ST style={{marginBottom:0}}>Top Selling — {label}</ST>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button style={{...C.iBtn,padding:"5px 10px",fontSize:12,color:"#94a3b8"}} onClick={()=>setMonthOffset(o=>o+1)}>&#9664;</button>
          <span style={{fontSize:11,color:"#475569",minWidth:72,textAlign:"center"}}>{monthOffset===0?"This month":`${monthOffset}mo ago`}</span>
          <button style={{...C.iBtn,padding:"5px 10px",fontSize:12,color:monthOffset===0?"#1e293b":"#94a3b8",cursor:monthOffset===0?"default":"pointer"}} onClick={()=>setMonthOffset(o=>Math.max(0,o-1))} disabled={monthOffset===0}>&#9654;</button>
        </div>
      </div>
      {topItems.length===0 ? <MT text="No sales data for this month"/> : (
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          {topItems.map((item,idx)=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{flexShrink:0,width:22,height:22,borderRadius:6,background:badgeBg[idx]||"#0d1521",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:idx<3?"#0d1117":"#475569"}}>
                {idx+1}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:600,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{item.name}</span>
                  <span style={{fontSize:11,color:"#64748b",flexShrink:0}}>{fmt(item.revenue)}</span>
                </div>
                <div style={{background:"#0d1521",borderRadius:4,height:6,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:4,background:barColors[idx]||"#334155",width:`${(item.qty/maxQty)*100}%`,transition:"width .4s ease"}}/>
                </div>
              </div>
              <div style={{flexShrink:0,fontSize:12,fontWeight:700,color:idx===0?"#f59e0b":"#94a3b8",minWidth:48,textAlign:"right"}}>{item.qty} sold</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Main Inventory Component
══════════════════════════════════════════════════════════════ */
export default function Inventory({ data, refresh, isMobile }) {
  const blank = {name:"",category:"",buy_price:"",sell_price:"",gst:0,stock:"",unit:"pcs",barcode:""};
  const [form,      setForm]     = useState(blank);
  const [eid,       setEid]      = useState(null);
  const [showModal, setShowModal]= useState(false);
  const [srch,      setSrch]     = useState("");
  const [busy,      setBusy]     = useState(false);
  const [t, toast] = useToast();

  const save = async () => {
    if (!form.name||form.sell_price===""||form.stock==="") return toast("Fill required fields","err");
    setBusy(true);
    try {
      await sb.upsert("products",{...form,id:eid||uid(),buy_price:+form.buy_price||0,sell_price:+form.sell_price,gst:+form.gst||0,stock:+form.stock});
      await refresh(['products']); setForm(blank); setEid(null); setShowModal(false);
      toast(eid?"Product updated ✓":"Product added ✓");
    } finally { setBusy(false); }
  };

  const del = async id => {
    if (!confirm("Delete this product?")) return;
    await sb.del("products",id); await refresh(['products']); toast("Deleted");
  };

  const startEdit = p => {
    setForm({name:p.name,category:p.category||"",buy_price:p.buy_price,sell_price:p.sell_price,gst:p.gst||0,stock:p.stock,unit:p.unit||"pcs",barcode:p.barcode||""});
    setEid(p.id); setShowModal(true);
  };

  const openAdd   = () => { setForm(blank); setEid(null); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEid(null); setForm(blank); };

  // Detect if the barcode being typed is already used by another product
  const dupBarcode = useMemo(() => {
    if (!form.barcode) return null;
    const other = data.products.find(p => p.barcode === form.barcode && p.id !== eid);
    return other ? other.name : null;
  }, [form.barcode, data.products, eid]);

  const filtered = useMemo(() =>
    data.products.filter(p=>
      p.name?.toLowerCase().includes(srch.toLowerCase())||(p.category||"").toLowerCase().includes(srch.toLowerCase())
    ), [data.products, srch]);

  return (
    <div style={C.pg}>
      <Toast t={t}/>

      {showModal && (
        <ProductModal eid={eid} form={form} setForm={setForm} onSave={save} onClose={closeModal} busy={busy} dupBarcode={dupBarcode}/>
      )}

      <div style={C.phdr}>
        <h1 style={{...C.h1,fontSize:isMobile?18:20}}>
          Inventory <span style={{fontSize:13,color:"#64748b",fontWeight:400}}>({data.products.length})</span>
        </h1>
        <button style={{...C.btnP,minHeight:44}} onClick={openAdd}><I n="plus" s={14}/> Add</button>
      </div>

      <input style={C.srch} placeholder="Search by name or category..." value={srch} onChange={e=>setSrch(e.target.value)}/>

      <TopSelling sales={data.sales||[]} products={data.products} isMobile={isMobile}/>

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.length===0 ? <MT text="No products"/> : filtered.map(p=>(
            <div key={p.id} style={{...C.card,borderLeft:`3px solid ${p.stock<=5&&p.sell_price>0?"#ef4444":"#1a2235"}`,padding:"14px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#f0f6ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{color:"#64748b",fontSize:12,marginTop:3}}>
                    {p.category||"General"} · {p.unit}
                    {(p.gst||0)>0&&<span style={{color:"#fbbf24",marginLeft:6}}>GST {p.gst}%</span>}
                    {p.barcode&&<span style={{color:"#334155",fontFamily:"monospace",fontSize:10,marginLeft:6}}>#{p.barcode}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:7,marginLeft:10,flexShrink:0}}>
                  <button style={{...C.iBtn,padding:"8px 10px"}} onClick={()=>startEdit(p)}><I n="edit" s={16}/></button>
                  <button style={{...C.iBtn,color:"#f87171",padding:"8px 10px"}} onClick={()=>del(p.id)}><I n="trash" s={16}/></button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div style={{background:"#0d1521",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#475569",marginBottom:3,letterSpacing:.5}}>BUY PRICE</div>
                  <div style={{fontWeight:700,color:"#94a3b8",fontSize:13}}>{fmt(p.buy_price)}</div>
                </div>
                <div style={{background:"#0d1521",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#475569",marginBottom:3,letterSpacing:.5}}>SELL PRICE</div>
                  <div style={{fontWeight:700,color:"#f59e0b",fontSize:13}}>{fmt(p.sell_price)}</div>
                </div>
                <div style={{background:"#0d1521",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#475569",marginBottom:3,letterSpacing:.5}}>STOCK</div>
                  <div style={{fontWeight:700,color:p.stock<=5&&p.sell_price>0?"#f87171":"#34d399",fontSize:13}}>{p.stock}</div>
                </div>
              </div>
              {p.buy_price>0&&(
                <div style={{marginTop:8,fontSize:11,color:"#64748b"}}>
                  Margin: <span style={{color:"#34d399",fontWeight:600}}>{(((p.sell_price-p.buy_price)/p.buy_price)*100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={C.tbl}>
          <div style={{...C.tr,...C.th,gridTemplateColumns:"2fr 1fr 80px 80px 50px 60px 80px 110px 70px"}}>
            <span>Product</span><span>Category</span><span>Buy Rs</span><span>Sell Rs</span><span>GST</span><span>Margin</span><span>Stock</span><span>Barcode</span><span>Actions</span>
          </div>
          {filtered.length===0?<MT text="No products"/>:filtered.map(p=>(
            <div key={p.id} style={{...C.tr,gridTemplateColumns:"2fr 1fr 80px 80px 50px 60px 80px 110px 70px",...(p.stock<=5&&p.sell_price>0?{background:"rgba(239,68,68,.04)"}:{})}}>
              <span style={{fontWeight:600,fontSize:13,color:"#f0f6ff"}}>{p.name}</span>
              <span style={{color:"#94a3b8",fontSize:12}}>{p.category||"—"}</span>
              <span style={{fontSize:13,color:"#cbd5e1"}}>{fmt(p.buy_price)}</span>
              <span style={{color:"#f59e0b",fontWeight:600,fontSize:13}}>{fmt(p.sell_price)}</span>
              <span style={{color:(p.gst||0)>0?"#fbbf24":"#475569",fontSize:12,fontWeight:600}}>{p.gst||0}%</span>
              <span style={{color:"#34d399",fontSize:12}}>{p.buy_price>0?`${(((p.sell_price-p.buy_price)/p.buy_price)*100).toFixed(0)}%`:"—"}</span>
              <span style={{color:p.stock<=5&&p.sell_price>0?"#f87171":"#e2e8f0",fontWeight:600,fontSize:13}}>{p.stock} {p.unit}</span>
              <span style={{fontFamily:"monospace",fontSize:11,color:p.barcode?"#94a3b8":"#1e293b"}}>{p.barcode||"—"}</span>
              <span style={{display:"flex",gap:5}}>
                <button style={C.iBtn} onClick={()=>startEdit(p)}><I n="edit" s={13}/></button>
                <button style={{...C.iBtn,color:"#f87171"}} onClick={()=>del(p.id)}><I n="trash" s={13}/></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
