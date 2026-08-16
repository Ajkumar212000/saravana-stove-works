import { useState, useMemo, lazy, Suspense } from "react";
import { C, I, ST, SRow, StatC, Toast, useToast, sb, fmt, fmtDate, today } from "../shared.jsx";

const Receipt = lazy(() => import("./Receipt.jsx"));

export default function Reports({ data, refresh, shopGST, isMobile }) {
  const [range,  setRange]  = useState("today");
  const [from,   setFrom]   = useState(today());
  const [to,     setTo]     = useState(today());
  const [reprint,setReprint]= useState(null);
  const [t, toast] = useToast();

  const { sales, exps, revenue, collected, gProfit, pending, expTotal, netProfit } = useMemo(() => {
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
    return { sales, exps, revenue, collected, gProfit, pending, expTotal, netProfit };
  }, [data.sales, data.expenses, range, from, to]);

  const cancelSale = async s => {
    const name=data.customers.find(c=>c.id===s.customer_id)?.name||s.walk_in_name||"Walk-in";
    if (!confirm(`Cancel bill for ${name} (${fmt(s.total)})?\n• Stock will be restored\n• Customer debt reduced\n• Bill deleted`)) return;
    for (const item of (s.items||[])) {
      const p=data.products.find(x=>x.id===item.productId);
      if (p) await sb.upsert("products",{...p,stock:p.stock+item.qty});
    }
    if (s.customer_id) {
      const c=data.customers.find(x=>x.id===s.customer_id);
      if (c) await sb.upsert("customers",{...c,debt:Math.max(0,(c.debt||0)-Math.max(0,s.total-s.paid))});
    }
    await sb.del("sales",s.id);
    await refresh(['sales','products','customers']); toast("Bill cancelled. Stock restored ✓");
  };

  if (reprint) return (
    <Suspense fallback={<div style={{color:"#64748b",padding:32,textAlign:"center"}}>Loading receipt…</div>}>
      <Receipt rcpt={reprint} products={data.products} shopGST={shopGST} onClose={()=>setReprint(null)}/>
    </Suspense>
  );

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <h1 style={{...C.h1,fontSize:isMobile?18:20}}>Reports</h1>

      <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}}>
        {[["today","Today"],["week","7 Days"],["month","Month"],["custom","Custom"]].map(([v,l])=>(
          <button key={v} style={{...(range===v?C.btnP:C.btnG),flex:isMobile?"1 1 auto":"0 0 auto",justifyContent:"center",minHeight:42}} onClick={()=>setRange(v)}>{l}</button>
        ))}
      </div>
      {range==="custom"&&(
        <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
          <input style={{...C.inp,flex:"1 1 130px"}} type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
          <span style={{color:"#64748b",flexShrink:0}}>→</span>
          <input style={{...C.inp,flex:"1 1 130px"}} type="date" value={to} onChange={e=>setTo(e.target.value)}/>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <StatC label="Revenue"    val={fmt(revenue)}   sub={`${sales.length} sales`}  acc="#f59e0b"/>
        <StatC label="Gross P."   val={fmt(gProfit)}   sub="Before expenses"           acc="#10b981"/>
        <StatC label="Expenses"   val={fmt(expTotal)}  sub="All types"                 acc="#818cf8"/>
        <StatC label="Net Profit" val={fmt(netProfit)} sub="Take-home"                 acc={netProfit>=0?"#10b981":"#ef4444"}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:14}}>
        <div style={{...C.card,padding:"12px 16px"}}>
          <ST>Collections</ST>
          <SRow l="Cash Collected" v={fmt(collected)} c="#34d399"/>
          <SRow l="Pending"        v={fmt(pending)}   c="#f87171"/>
        </div>
        <div style={{...C.card,padding:"12px 16px"}}>
          <ST>Expense Breakdown</ST>
          {Object.entries(exps.reduce((a,e)=>{a[e.description]=(a[e.description]||0)+e.amount;return a;},{})).map(([k,v])=>(
            <SRow key={k} l={k} v={fmt(v)}/>
          ))}
          {exps.length===0&&<div style={{color:"#64748b",fontSize:12}}>No expenses in period</div>}
        </div>
      </div>

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <div style={{color:"#475569",fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Sales in period ({sales.length})</div>
          {sales.length===0?<div style={{color:"#64748b",textAlign:"center",padding:"28px 0",fontSize:13}}>No sales in this period</div>:sales.map(s=>{
            const c=data.customers.find(x=>x.id===s.customer_id);
            const bal=s.total-s.paid;
            return (
              <div key={s.id} style={{...C.card,padding:"12px 14px",borderLeft:`3px solid ${bal>0?"#f87171":"#10b981"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,color:"#f0f6ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c?.name||s.walk_in_name||"Walk-in"}</div>
                    <div style={{color:"#64748b",fontSize:11,marginTop:2}}>{fmtDate(s.date)} · {(s.items||[]).length} items</div>
                  </div>
                  <div style={{fontWeight:800,fontSize:16,color:"#f59e0b",flexShrink:0,marginLeft:10}}>{fmt(s.total)}</div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:12}}>
                    <span style={{color:"#34d399"}}>Paid {fmt(s.paid)}</span>
                    {bal>0&&<span style={{color:"#f87171",marginLeft:8}}>· Due {fmt(bal)}</span>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button style={{...C.iBtn,color:"#94a3b8",padding:"7px 10px"}}
                      onClick={()=>setReprint({...s,customerName:c?.name||s.walk_in_name||"Walk-in"})}>
                      <I n="print" s={15}/>
                    </button>
                    <button style={{...C.iBtn,color:"#f87171",padding:"7px 10px"}} onClick={()=>cancelSale(s)}>
                      <I n="trash" s={15}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={C.tbl}>
          <div style={{...C.tr,...C.th,gridTemplateColumns:"120px 1fr 60px 90px 90px 90px 80px"}}>
            <span>Date</span><span>Customer</span><span>Items</span><span>Total</span><span>Paid</span><span>Balance</span><span>Actions</span>
          </div>
          {sales.length===0?<div style={{color:"#64748b",textAlign:"center",padding:"28px 0",fontSize:13}}>No sales in this period</div>:sales.map(s=>{
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
                  <button style={{...C.iBtn,color:"#94a3b8"}} onClick={()=>setReprint({...s,customerName:c?.name||s.walk_in_name||"Walk-in"})}><I n="print" s={13}/></button>
                  <button style={{...C.iBtn,color:"#f87171"}} onClick={()=>cancelSale(s)}><I n="trash" s={13}/></button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
