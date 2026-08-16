import { useState, lazy, Suspense, useCallback } from "react";
import { C, I, ST, SRow, Fld, Toast, useToast, sb, uid, fmt, fmtDate, today } from "../shared.jsx";
import { useBarcodeInput } from "./useBarcodeInput.js";

const BarcodeScanner = lazy(() => import("./BarcodeScanner.jsx"));

export default function Sales({ data, refresh, setTab, shopGST, isMobile }) {
  const [custId,  setCustId]  = useState("");
  const [walkIn,  setWalkIn]  = useState("");
  const [items,   setItems]   = useState([{ productId:"", pname:"", qty:1, price:0 }]);
  const [paid,    setPaid]    = useState("");
  const [note,    setNote]    = useState("");
  const [rcpt,    setRcpt]    = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [showScan,setShowScan]= useState(false);
  const [t, toast] = useToast();

  const total  = items.reduce((a,i) => a + i.price * i.qty, 0);
  const profit = items.reduce((a,i) => {
    const p = data.products.find(x => x.id === i.productId);
    return a + (p ? (i.price - p.buy_price) * i.qty : 0);
  }, 0);
  const paidN = parseFloat(paid) || 0;
  const bal   = total - paidN;

  /*
   * Product lookup by barcode — priority order:
   *   1. product.barcode  (exact — add `barcode TEXT` column in Supabase)
   *   2. product.id       (UUID — for self-printed labels)
   *   3. product.name     (fallback)
   */
  const findByBarcode = useCallback((code) => {
    const c = code.trim().toLowerCase();
    return (
      data.products.find(p => p.barcode === code.trim()) ||
      data.products.find(p => p.id      === code.trim()) ||
      data.products.find(p => p.name?.toLowerCase() === c)
    );
  }, [data.products]);

  /* Core handler — shared by camera modal + USB always-on hook */
  const handleScan = useCallback((code) => {
    setShowScan(false);
    const product = findByBarcode(code);

    if (!product) {
      toast(`Barcode not found: ${code.length > 20 ? code.slice(0,20) + "…" : code}`, "err");
      return;
    }
    if (product.stock <= 0) {
      toast(`${product.name} is out of stock!`, "warn");
      return;
    }

    setItems(prev => {
      const dup = prev.findIndex(i => i.productId === product.id);
      if (dup >= 0) {
        const n = [...prev];
        n[dup] = { ...n[dup], qty: n[dup].qty + 1 };
        toast(`${product.name} ×${n[dup].qty}`, "ok");
        return n;
      }
      const clean = prev.filter(i => i.productId !== "");
      return [...clean, { productId:product.id, pname:product.name, qty:1, price:product.sell_price }];
    });

    toast(`✓ ${product.name} — ${fmt(product.sell_price)}`, "ok");
  }, [findByBarcode, toast]);

  /* Always-on USB/keyboard-wedge listener — no modal needed */
  useBarcodeInput(handleScan, { enabled: !showScan && !rcpt });

  const setItemField = (idx, field, val) =>
    setItems(prev => { const n=[...prev]; n[idx]={...n[idx],[field]:val}; return n; });

  const pickProduct = (idx, name) => setItems(prev => {
    const n=[...prev]; n[idx]={...n[idx],pname:name};
    const p=data.products.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(p){ n[idx].productId=p.id; n[idx].price=p.sell_price; }
    else { n[idx].productId=""; }
    return n;
  });

  const doPrint = (r) => {
    const content=document.getElementById("stow-rcpt-inline");
    if(!content) return;
    const w=window.open("","_blank","width=420,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Bill #${r.id.slice(-8).toUpperCase()}</title>
      <style>body{margin:0;padding:20px;font-family:'Courier New',monospace;background:#fff;color:#111}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:3px 0}
      @media print{button{display:none}}</style></head>
      <body>${content.innerHTML}<script>window.onload=()=>{window.print()}<\/script></body></html>`);
    w.document.close();
  };

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
      await refresh(['sales','products','customers']);
      const cust=data.customers.find(c=>c.id===custId);
      setRcpt({...sale,customerName:cust?.name||walkIn||"Walk-in",customerGST:cust?.gst_no||""});
      setItems([{productId:"",pname:"",qty:1,price:0}]); setCustId(""); setWalkIn(""); setPaid(""); setNote("");
    } catch(e){ toast(e.message,"err"); }
    finally { setBusy(false); }
  };

  return (
    <div style={C.pg}>
      <Toast t={t}/>

      {showScan && (
        <Suspense fallback={
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:700}}>
            <div style={C.spinner}/>
          </div>
        }>
          <BarcodeScanner onScan={handleScan} onClose={()=>setShowScan(false)} title="Scan Product Barcode"/>
        </Suspense>
      )}

      {/* Header */}
      <div style={{...C.phdr,marginBottom:12}}>
        <h1 style={{...C.h1,fontSize:isMobile?18:20,marginBottom:0}}>New Sale</h1>
        {!rcpt&&(
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#475569",padding:"4px 10px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:20}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px #10b981",flexShrink:0}}/>
              USB ready
            </div>
            <button style={{...C.btnG,gap:7,borderColor:"rgba(245,158,11,.4)",color:"#f59e0b",minHeight:40,fontSize:13}} onClick={()=>setShowScan(true)}>
              <BarcodeIcon s={15}/> Scan
            </button>
          </div>
        )}
      </div>

      {/* Receipt */}
      {rcpt&&(
        <div style={{marginBottom:20}}>
          <div style={{...C.card,borderTop:"3px solid #10b981",marginBottom:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{color:"#34d399",fontWeight:700,fontSize:15}}>✓ Sale Confirmed!</div>
              <div style={{color:"#f59e0b",fontWeight:800,fontSize:20}}>{fmt(rcpt.total)}</div>
            </div>
            <div style={{color:"#94a3b8",fontSize:13}}>{rcpt.customerName} · {(rcpt.items||[]).length} item(s) · {fmtDate(rcpt.date)}</div>
          </div>
          <div id="stow-rcpt-inline" style={{background:"#fff",color:"#111",padding:20,borderRadius:10,fontFamily:"'Courier New',monospace",fontSize:12,maxWidth:360,marginBottom:14}}>
            <div style={{textAlign:"center",marginBottom:12}}>
              <div style={{fontSize:20,fontWeight:900,letterSpacing:5}}>Stove Works</div>
              <div style={{fontSize:10,color:"#555"}}>Wholesale & Retail</div>
              {shopGST&&<div style={{fontSize:10,color:"#333",marginTop:2}}>GSTIN: {shopGST}</div>}
              <div style={{borderTop:"1px dashed #ccc",marginTop:6,paddingTop:6,fontSize:10,color:"#777"}}>Bill #{rcpt.id.slice(-8).toUpperCase()} · {fmtDate(rcpt.date)}</div>
            </div>
            <div style={{fontWeight:700,marginBottom:2,fontSize:13}}>{rcpt.customerName}</div>
            {rcpt.customerGST&&<div style={{fontSize:10,color:"#555",marginBottom:8}}>GSTIN: {rcpt.customerGST}</div>}
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr style={{borderBottom:"1px dashed #ccc"}}>
                <th style={{textAlign:"left",padding:"3px 0"}}>Item</th><th style={{textAlign:"center"}}>Qty</th>
                <th style={{textAlign:"right"}}>Rate</th><th style={{textAlign:"right"}}>Amt</th>
              </tr></thead>
              <tbody>{(rcpt.items||[]).map((item,i)=>{
                const p=data.products.find(x=>x.id===item.productId);
                return(<tr key={i} style={{borderBottom:"1px dashed #eee"}}>
                  <td style={{padding:"3px 0"}}>{p?.name||"?"}</td><td style={{textAlign:"center"}}>{item.qty}</td>
                  <td style={{textAlign:"right"}}>{fmt(item.price)}</td><td style={{textAlign:"right",fontWeight:600}}>{fmt(item.price*item.qty)}</td>
                </tr>);
              })}</tbody>
            </table>
            <div style={{marginTop:10,borderTop:"1px dashed #ccc",paddingTop:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:14}}><span>Total</span><span>{fmt(rcpt.total)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",color:"#555",fontSize:13}}><span>Paid</span><span>{fmt(rcpt.paid)}</span></div>
              {rcpt.total-rcpt.paid>0&&<div style={{display:"flex",justifyContent:"space-between",color:"red",fontWeight:700,fontSize:13}}><span>Balance Due</span><span>{fmt(rcpt.total-rcpt.paid)}</span></div>}
            </div>
            {rcpt.note&&<div style={{marginTop:8,fontSize:11,color:"#777"}}>Note: {rcpt.note}</div>}
            <div style={{textAlign:"center",marginTop:10,fontSize:10,color:"#aaa",borderTop:"1px dashed #ccc",paddingTop:8}}>Thank you! Visit again.</div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button style={{...C.btnP,padding:"13px 24px",fontSize:14,flex:isMobile?"1":"auto",justifyContent:"center",minHeight:50}} onClick={()=>doPrint(rcpt)}><I n="print" s={15}/> Print Bill</button>
            <button style={{...C.btnG,padding:"13px 22px",fontSize:14,flex:isMobile?"1":"auto",justifyContent:"center",minHeight:50}} onClick={()=>setRcpt(null)}><I n="plus" s={15}/> New Sale</button>
          </div>
        </div>
      )}

      {/* Sale form */}
      {!rcpt&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
          <div style={C.card}>
            <ST>Customer</ST>
            <div style={{marginBottom:10}}>
              <label style={C.lbl}>Existing Customer / Dealer</label>
              <select style={C.inp} value={custId} onChange={e=>{setCustId(e.target.value);setWalkIn("");}}>
                <option value="">— Walk-in / Select —</option>
                {data.customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.debt>0?` ⚠ Due:${fmt(c.debt)}`:""}</option>)}
              </select>
            </div>
            {!custId&&<Fld label="Walk-in Name (optional)" value={walkIn} onChange={setWalkIn}/>}

            <ST style={{marginTop:16}}>Items</ST>
            {items.map((item,idx)=>(
              <div key={idx} style={{marginBottom:10,background:"#0d1521",borderRadius:10,padding:"10px 12px"}}>
                <div style={{marginBottom:8}}>
                  <input style={{...C.inp,background:"#08101e"}} list={`pl-${idx}`} value={item.pname}
                    placeholder="Search product…" onChange={e=>pickProduct(idx,e.target.value)}/>
                  <datalist id={`pl-${idx}`}>{data.products.map(p=><option key={p.id} value={p.name}/>)}</datalist>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 44px",gap:8}}>
                  <input style={{...C.inp,background:"#08101e"}} type="number" min="1" value={item.qty}
                    onChange={e=>setItemField(idx,"qty",+e.target.value)} placeholder="Qty"/>
                  <input style={{...C.inp,background:"#08101e"}} type="number" value={item.price}
                    onChange={e=>setItemField(idx,"price",+e.target.value)} placeholder="₹ Price"/>
                  <button style={{...C.iBtn,color:"#f87171",justifyContent:"center",minHeight:40,borderRadius:7}}
                    onClick={()=>setItems(p=>p.filter((_,i)=>i!==idx))}><I n="close" s={15}/></button>
                </div>
                {item.productId&&(()=>{
                  const p=data.products.find(x=>x.id===item.productId);
                  return p&&(
                    <div style={{fontSize:11,color:"#475569",marginTop:7,display:"flex",gap:10,flexWrap:"wrap"}}>
                      <span>Stock: <b style={{color:p.stock<=item.qty?"#f87171":"#94a3b8"}}>{p.stock}</b> left</span>
                      {(p.gst||0)>0&&<span style={{color:"#fbbf24"}}>GST {p.gst}%</span>}
                      {p.barcode&&<span style={{color:"#334155",fontFamily:"monospace",fontSize:10}}>#{p.barcode}</span>}
                      {p.stock<=0&&<span style={{color:"#f87171",fontWeight:600}}>⚠ Out of stock</span>}
                    </div>
                  );
                })()}
              </div>
            ))}

            <div style={{display:"flex",gap:8}}>
              <button style={{...C.btnG,flex:1,justifyContent:"center",minHeight:44}}
                onClick={()=>setItems(p=>[...p,{productId:"",pname:"",qty:1,price:0}])}>
                <I n="plus" s={14}/> Add Item
              </button>
              <button style={{...C.btnG,color:"#f59e0b",borderColor:"rgba(245,158,11,.35)",gap:6,minHeight:44,padding:"0 14px"}}
                onClick={()=>setShowScan(true)}>
                <BarcodeIcon s={14}/> Scan
              </button>
            </div>
            <div style={{marginTop:12}}><Fld label="Note (optional)" value={note} onChange={setNote}/></div>
          </div>

          <div>
            <div style={{...C.card,marginBottom:12}}>
              <ST>Summary</ST>
              <SRow l="Total"        v={fmt(total)}  c="#f59e0b" b/>
              <SRow l="Gross Profit" v={fmt(profit)} c="#34d399"/>
              <div style={{borderTop:"1px solid #1e293b",margin:"10px 0"}}/>
              <Fld label="Amount Paid ₹" type="number" value={paid} onChange={setPaid} ph={String(total)}/>
              <SRow l="Balance Due" v={fmt(bal)} c={bal>0?"#f87171":"#34d399"} b/>
              {bal>0&&custId&&<div style={{fontSize:11,color:"#f59e0b",marginTop:6,padding:"6px 10px",background:"rgba(245,158,11,.06)",borderRadius:6}}>→ Balance added to customer debt</div>}
            </div>
            <button style={{...C.btnP,width:"100%",justifyContent:"center",padding:"15px 0",fontSize:15,minHeight:52}} onClick={submit} disabled={busy}>
              <I n="check" s={18}/> {busy?"Saving…":"Confirm Sale"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BarcodeIcon({ s=16 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
      <path d="M3 5h2M3 19h2M19 5h2M19 19h2"/>
    </svg>
  );
}
