import { useState, useMemo } from "react";
import { C, I, ST, MT, StatC, Fld, Toast, useToast, sb, uid, fmt, fmtDate, today } from "../shared.jsx";

export default function Expenses({ data, refresh, isMobile }) {
  const blank = {date:today(),amount:"",description:"salary",supplier_id:"",note:""};
  const [form, setForm] = useState(blank);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [t, toast] = useToast();

  const suppliers = data.suppliers || [];

  const add = async () => {
    if (!form.amount) return toast("Enter amount","err");
    if (form.description==="purchase" && !form.supplier_id)
      return toast("Select which supplier this purchase is from","err");
    setBusy(true);
    try {
      const expense = {...form, id:uid(), amount:+form.amount, created_at:Date.now()};
      await sb.upsert("expenses", expense);
      if (form.description==="purchase" && form.supplier_id) {
        const rows = await sb.getAll("suppliers", `&id=eq.${encodeURIComponent(form.supplier_id)}`);
        const sup = rows?.[0];
        if (sup) {
          await sb.upsert("suppliers", {...sup, debt: (sup.debt||0) + (+form.amount)});
        } else {
          toast("Supplier not found — debt not updated","warn");
        }
      }
      const tablesToRefresh = form.description === "purchase" ? ['expenses','suppliers'] : ['expenses'];
      await refresh(tablesToRefresh); setForm(blank); setShow(false);
      toast(form.description==="purchase" ? "Purchase recorded & supplier debt updated ✓" : "Expense saved ✓");
    } catch(e) {
      toast("Save failed: " + e.message, "err");
    } finally { setBusy(false); }
  };

  const del = async id => {
    if (!confirm("Delete this expense?")) return;
    try {
      const expense = data.expenses.find(e=>e.id===id);
      if (expense?.description==="purchase" && expense?.supplier_id) {
        const rows = await sb.getAll("suppliers", `&id=eq.${encodeURIComponent(expense.supplier_id)}`);
        const sup = rows?.[0];
        if (sup) await sb.upsert("suppliers", {...sup, debt: Math.max(0, (sup.debt||0) - expense.amount)});
      }
      const tablesToRefresh = (expense?.description==="purchase" && expense?.supplier_id) ? ['expenses','suppliers'] : ['expenses'];
      await sb.del("expenses", id); await refresh(tablesToRefresh); toast("Deleted");
    } catch(e) { toast("Delete failed: " + e.message, "err"); }
  };

  const { monthExp, monthTotal, byCat } = useMemo(() => {
    const monthExp   = data.expenses.filter(e=>e.date?.slice(0,7)===today().slice(0,7));
    const monthTotal = monthExp.reduce((a,e)=>a+e.amount,0);
    const byCat      = monthExp.reduce((a,e)=>{a[e.description]=(a[e.description]||0)+e.amount;return a;},{});
    return { monthExp, monthTotal, byCat };
  }, [data.expenses]);

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <div style={C.phdr}>
        <h1 style={{...C.h1,fontSize:isMobile?18:20}}>Expenses</h1>
        <button style={{...C.btnP,minHeight:44}} onClick={()=>setShow(true)}><I n="plus" s={14}/> Add</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <StatC label="This Month" val={fmt(monthTotal)} sub={`${monthExp.length} entries`} acc="#818cf8"/>
        {Object.entries(byCat).slice(0,isMobile?1:3).map(([k,v])=>(
          <StatC key={k} label={k.charAt(0).toUpperCase()+k.slice(1)} val={fmt(v)} sub="this month" acc="#64748b"/>
        ))}
      </div>
      {show&&(
        <div style={{...C.card,marginBottom:14}}>
          <ST>Add Expense</ST>
          <div style={isMobile?{display:"flex",flexDirection:"column",gap:12}:C.g3}>
            <Fld label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/>
            <Fld label="Amount ₹ *" type="number" value={form.amount} onChange={v=>setForm(f=>({...f,amount:v}))}/>
            <div>
              <label style={C.lbl}>Type</label>
              <select style={C.inp} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value,supplier_id:""}))}>
                {["salary","rent","petrol","purchase","repair","other"].map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            {form.description==="purchase"&&(
              <div>
                <label style={C.lbl}>Supplier *</label>
                <select style={C.inp} value={form.supplier_id} onChange={e=>setForm(f=>({...f,supplier_id:e.target.value}))}>
                  <option value="">— Select Supplier —</option>
                  {suppliers.map(s=>(
                    <option key={s.id} value={s.id}>{s.name}{s.gst_no?` · ${s.gst_no}`:""}{s.debt>0?` · Owes ${fmt(s.debt)}`:""}</option>
                  ))}
                </select>
                {form.supplier_id&&(()=>{
                  const sup=suppliers.find(s=>s.id===form.supplier_id);
                  return sup&&(
                    <div style={{marginTop:8,padding:"10px 12px",background:"#0d1117",borderRadius:8,fontSize:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:form.amount?6:0}}>
                        <span style={{color:"#94a3b8"}}>Current debt to {sup.name}</span>
                        <span style={{color:"#f87171",fontWeight:700}}>{fmt(sup.debt||0)}</span>
                      </div>
                      {form.amount&&(
                        <>
                          <div style={{display:"flex",justifyContent:"space-between",color:"#475569",fontSize:11}}>
                            <span>+ This purchase</span>
                            <span style={{color:"#fbbf24"}}>+{fmt(+form.amount)}</span>
                          </div>
                          <div style={{borderTop:"1px solid #1e293b",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                            <span style={{color:"#94a3b8",fontWeight:600}}>New total debt</span>
                            <span style={{color:"#f87171",fontWeight:800}}>{fmt((sup.debt||0)+(+form.amount))}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={{...C.btnP,flex:1,justifyContent:"center",minHeight:46}} onClick={add} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Save"}</button>
            <button style={{...C.btnG,flex:1,justifyContent:"center",minHeight:46}} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {data.expenses.length===0?<MT text="No expenses yet"/>:data.expenses.slice(0,150).map(e=>{
            const sup=e.supplier_id?suppliers.find(s=>s.id===e.supplier_id):null;
            return (
              <div key={e.id} style={{...C.card,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14,color:"#cbd5e1",textTransform:"capitalize"}}>{e.description}</div>
                  <div style={{color:"#64748b",fontSize:11,marginTop:2}}>{fmtDate(e.date)}</div>
                  {sup&&<div style={{color:"#94a3b8",fontSize:11,marginTop:1}}>From: {sup.name}{sup.gst_no?` · GST: ${sup.gst_no}`:""}</div>}
                </div>
                <div style={{fontWeight:700,fontSize:16,color:"#818cf8",flexShrink:0}}>{fmt(e.amount)}</div>
                <button style={{...C.iBtn,color:"#f87171",padding:"8px 10px",flexShrink:0}} onClick={()=>del(e.id)}><I n="trash" s={15}/></button>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={C.tbl}>
          <div style={{...C.tr,...C.th,gridTemplateColumns:"130px 1fr 1.5fr 110px 60px"}}>
            <span>Date</span><span>Type</span><span>Supplier</span><span>Amount</span><span>Del</span>
          </div>
          {data.expenses.length===0?<MT text="No expenses yet"/>:data.expenses.slice(0,150).map(e=>{
            const sup=e.supplier_id?suppliers.find(s=>s.id===e.supplier_id):null;
            return (
              <div key={e.id} style={{...C.tr,gridTemplateColumns:"130px 1fr 1.5fr 110px 60px"}}>
                <span style={{color:"#94a3b8",fontSize:12}}>{fmtDate(e.date)}</span>
                <span style={{textTransform:"capitalize",color:"#cbd5e1"}}>{e.description}</span>
                <span style={{color:sup?"#94a3b8":"#334155",fontSize:12}}>
                  {sup?<>{sup.name}{sup.gst_no&&<span style={{color:"#fbbf24",marginLeft:5,fontFamily:"monospace",fontSize:11}}>{sup.gst_no}</span>}</>:"—"}
                </span>
                <span style={{color:"#818cf8",fontWeight:600}}>{fmt(e.amount)}</span>
                <button style={{...C.iBtn,color:"#f87171"}} onClick={()=>del(e.id)}><I n="trash" s={13}/></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
