import { useMemo } from "react";
import { C, I, ST, MT, StatC, fmt, fmtDate, today } from "../shared.jsx";

export default function Dashboard({ data, isMobile=false }) {
  const { products, customers, sales, expenses } = data;

  const { tRev, tProfit, tExp, totDebt, lowStk, recent, debtorCount, debtors, tSalesCount } = useMemo(() => {
    const tSales    = sales.filter(s=>s.date===today());
    const debtCusts = customers.filter(c=>c.debt>0);
    return {
      tRev:        tSales.reduce((a,s)=>a+s.total,0),
      tProfit:     tSales.reduce((a,s)=>a+s.profit,0),
      tExp:        expenses.filter(e=>e.date===today()).reduce((a,e)=>a+e.amount,0),
      totDebt:     customers.reduce((a,c)=>a+(c.debt||0),0),
      lowStk:      products.filter(p=>p.stock<=5&&p.stock>0&&p.sell_price>0),
      recent:      sales.slice(0,7),
      debtorCount: debtCusts.length,
      debtors:     [...debtCusts].sort((a,b)=>b.debt-a.debt),
      tSalesCount: tSales.length,
    };
  }, [products, customers, sales, expenses]);

  return (
    <div style={C.pg}>
      <h1 style={{...C.h1,fontSize:isMobile?18:20}}>Dashboard</h1>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <StatC label="Today Revenue"    val={fmt(tRev)}           sub={`${tSalesCount} sales`}                            acc="#f59e0b"/>
        <StatC label="Net Profit"       val={fmt(tProfit-tExp)}   sub="After expenses"                                      acc="#10b981"/>
        <StatC label="Total Debt"       val={fmt(totDebt)}        sub={`${debtorCount} customers`}  acc="#ef4444"/>
        <StatC label="Today Expenses"   val={fmt(tExp)}           sub="Salary + others"                                     acc="#818cf8"/>
      </div>

      {lowStk.length>0&&(
        <div style={{...C.alertW,marginBottom:14}}>
          <I n="warn" s={14}/>
          <span style={{fontSize:12}}><b>Low Stock:</b> {lowStk.slice(0,4).map(p=>`${p.name} (${p.stock})`).join(" · ")}{lowStk.length>4?` +${lowStk.length-4} more`:""}</span>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
        <div style={C.card}>
          <ST>Recent Sales</ST>
          {recent.length===0 ? <MT text="No sales yet"/> : recent.map(s=>{
            const c=customers.find(x=>x.id===s.customer_id);
            return (
              <div key={s.id} style={C.row}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:"#f0f6ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c?.name||s.walk_in_name||"Walk-in"}</div>
                  <div style={{color:"#64748b",fontSize:11}}>{fmtDate(s.date)} · {(s.items||[]).length} item(s)</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                  <div style={{fontWeight:700,color:"#f59e0b"}}>{fmt(s.total)}</div>
                  <div style={{fontSize:11,color:s.paid<s.total?"#f87171":"#34d399"}}>{s.paid<s.total?`Due ${fmt(s.total-s.paid)}`:"Paid ✓"}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={C.card}>
          <ST>Outstanding Debts</ST>
          {debtors.length===0
            ? <MT text="No outstanding debts 🎉"/>
            : debtors.map(c=>(
              <div key={c.id} style={C.row}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:"#f0f6ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                  <div style={{color:"#64748b",fontSize:11}}>{c.phone||"—"}</div>
                </div>
                <div style={{fontWeight:800,color:"#f87171",flexShrink:0,marginLeft:8}}>{fmt(c.debt)}</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
