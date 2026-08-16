import { useState, useMemo } from "react";
import { C, I, ST, StatC, Toast, useToast, sb, uid, fmt, fmtDate, today } from "../shared.jsx";

export default function Debts({ data, refresh, isMobile }) {
  const [custAmt, setCustAmt] = useState({});
  const [suppAmt, setSuppAmt] = useState({});
  const [t, toast] = useToast();

  const suppliers  = data.suppliers || [];
  const { debtors, payables, totalRecv, totalPay } = useMemo(() => {
    const debtors  = data.customers.filter(c=>c.debt>0).sort((a,b)=>b.debt-a.debt);
    const payables = suppliers.filter(s=>s.debt>0).sort((a,b)=>b.debt-a.debt);
    return {
      debtors,
      payables,
      totalRecv: debtors.reduce((a,c)=>a+c.debt,0),
      totalPay:  payables.reduce((a,s)=>a+(s.debt||0),0),
    };
  }, [data.customers, suppliers]);

  const collect = async id => {
    const a=parseFloat(custAmt[id]); if(!a||a<=0) return toast("Enter valid amount","err");
    const c=data.customers.find(x=>x.id===id);
    if (a>c.debt) return toast(`Max collectible: ${fmt(c.debt)}`,"warn");
    await sb.upsert("customers",{...c,debt:Math.max(0,(c.debt||0)-a)});
    await sb.upsert("debt_payments",{id:uid(),customer_id:id,amount:a,date:today(),created_at:Date.now()});
    await refresh(['customers','debtPayments']); setCustAmt(p=>({...p,[id]:""})); toast(`${fmt(a)} collected ✓`);
  };

  const pay = async id => {
    const a=parseFloat(suppAmt[id]); if(!a||a<=0) return toast("Enter valid amount","err");
    try {
      const rows = await sb.getAll("suppliers", `&id=eq.${encodeURIComponent(id)}`);
      const s = rows?.[0];
      if (!s) return toast("Supplier not found","err");
      if (a > s.debt) return toast(`Max payable: ${fmt(s.debt)}`,"warn");
      await sb.upsert("suppliers", {...s, debt: Math.max(0, (s.debt||0) - a)});
      await refresh(['suppliers']); setSuppAmt(p=>({...p,[id]:""})); toast(`${fmt(a)} paid to ${s.name} ✓`);
    } catch(e) { toast("Payment failed: " + e.message, "err"); }
  };

  const suppPurchases = id => data.expenses
    .filter(e=>e.description==="purchase"&&e.supplier_id===id)
    .slice(0,5);

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <h1 style={{...C.h1,fontSize:isMobile?18:20}}>Debt Management</h1>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10,marginBottom:16}}>
        <StatC label="Receivables"  val={fmt(totalRecv)} sub={`${debtors.length} dealer(s) owe you`}   acc="#f87171"/>
        <StatC label="Payables"     val={fmt(totalPay)}  sub={`${payables.length} supplier(s) to pay`} acc="#f59e0b"/>
        <StatC label="Net Position" val={fmt(totalRecv-totalPay)} sub={totalRecv>=totalPay?"You're ahead":"You owe more"} acc={totalRecv>=totalPay?"#10b981":"#818cf8"}/>
      </div>

      <div style={{...C.h1,fontSize:14,color:"#f87171",marginBottom:10,letterSpacing:.5}}>
        ↓ Receivables — Dealers Owe You
      </div>
      {debtors.length===0
        ? <div style={{...C.card,textAlign:"center",padding:32,marginBottom:16}}><div style={{fontSize:28,marginBottom:6}}>✅</div><div style={{color:"#64748b",fontSize:13}}>No outstanding dealer debts!</div></div>
        : debtors.map(c=>(
          <div key={c.id} style={{...C.card,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontWeight:700,fontSize:16,color:"#f0f6ff"}}>{c.name}</div>
                <div style={{color:"#64748b",fontSize:12,marginTop:2}}>
                  {c.phone||"No phone"}{c.gst_no&&<span style={{color:"#fbbf24",marginLeft:8,fontFamily:"monospace",fontSize:11}}>GST: {c.gst_no}</span>}
                </div>
              </div>
              <div style={{fontWeight:800,fontSize:isMobile?22:26,color:"#f87171"}}>{fmt(c.debt)}</div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:isMobile?"wrap":"nowrap"}}>
              <input style={{...C.inp,flex:1,minWidth:0}} type="number" placeholder="Collection amount ₹"
                value={custAmt[c.id]||""} onChange={e=>setCustAmt(p=>({...p,[c.id]:e.target.value}))}/>
              <button style={{...C.btnG,padding:"10px 14px",fontSize:13,minHeight:44,flexShrink:0}} onClick={()=>setCustAmt(p=>({...p,[c.id]:String(c.debt)}))}>Full</button>
              <button style={{...C.btnP,minHeight:44,flexShrink:0}} onClick={()=>collect(c.id)}><I n="check" s={14}/> Collect</button>
            </div>
            <div>
              <div style={{fontSize:11,color:"#475569",marginBottom:6}}>Payment history:</div>
              {data.debtPayments.filter(p=>p.customer_id===c.id).slice(0,5).map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#64748b",padding:"3px 0"}}>
                  <span>{fmtDate(p.date)}</span>
                  <span style={{color:"#34d399",fontWeight:600}}>+{fmt(p.amount)} collected</span>
                </div>
              ))}
            </div>
          </div>
        ))
      }

      <div style={{...C.h1,fontSize:14,color:"#f59e0b",marginBottom:10,marginTop:8,letterSpacing:.5}}>
        ↑ Payables — You Owe Suppliers
      </div>
      {payables.length===0
        ? <div style={{...C.card,textAlign:"center",padding:32}}><div style={{fontSize:28,marginBottom:6}}>✅</div><div style={{color:"#64748b",fontSize:13}}>No outstanding supplier payments!</div></div>
        : payables.map(s=>(
          <div key={s.id} style={{...C.card,marginBottom:12,borderTop:"3px solid rgba(245,158,11,.4)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontWeight:700,fontSize:16,color:"#f0f6ff"}}>{s.name}</div>
                <div style={{color:"#64748b",fontSize:12,marginTop:2}}>
                  {s.phone||"No phone"}{s.gst_no&&<span style={{color:"#fbbf24",marginLeft:8,fontFamily:"monospace",fontSize:11}}>GST: {s.gst_no}</span>}
                </div>
              </div>
              <div style={{fontWeight:800,fontSize:isMobile?22:26,color:"#f59e0b"}}>{fmt(s.debt)}</div>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:isMobile?"wrap":"nowrap"}}>
              <input style={{...C.inp,flex:1,minWidth:0}} type="number" placeholder="Payment amount ₹"
                value={suppAmt[s.id]||""} onChange={e=>setSuppAmt(p=>({...p,[s.id]:e.target.value}))}/>
              <button style={{...C.btnG,padding:"10px 14px",fontSize:13,minHeight:44,flexShrink:0}} onClick={()=>setSuppAmt(p=>({...p,[s.id]:String(s.debt)}))}>Full</button>
              <button style={{...C.btnP,minHeight:44,flexShrink:0}} onClick={()=>pay(s.id)}><I n="check" s={14}/> Pay</button>
            </div>
            <div>
              <div style={{fontSize:11,color:"#475569",marginBottom:6}}>Purchase history (from expenses):</div>
              {suppPurchases(s.id).length===0
                ? <div style={{fontSize:11,color:"#334155"}}>No purchases recorded yet</div>
                : suppPurchases(s.id).map(e=>(
                  <div key={e.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#64748b",padding:"3px 0"}}>
                    <span>{fmtDate(e.date)}</span>
                    <span style={{color:"#f87171",fontWeight:600}}>−{fmt(e.amount)} purchased</span>
                  </div>
                ))
              }
            </div>
          </div>
        ))
      }
    </div>
  );
}
