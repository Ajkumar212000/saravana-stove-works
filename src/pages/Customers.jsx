import { useState, useMemo } from "react";
import { C, I, ST, MT, Fld, Toast, useToast, sb, uid, fmt } from "../shared.jsx";

export default function Customers({ data, refresh, isMobile }) {
  const blank = {name:"",phone:"",address:""};
  const [form,    setForm]    = useState(blank);
  const [show,    setShow]    = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [editC,   setEditC]   = useState(null);
  const [debtC,   setDebtC]   = useState(null);
  const [debtVal, setDebtVal] = useState("");
  const [debtMode,setDebtMode]= useState("set");
  const [srch,    setSrch]    = useState("");
  const [t, toast] = useToast();

  const add = async () => {
    if (!form.name) return toast("Enter customer name","err");
    setBusy(true);
    try { await sb.upsert("customers",{...form,id:uid(),debt:0}); await refresh(['customers']); setForm(blank); setShow(false); toast("Customer added ✓"); }
    finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editC) return;
    setBusy(true);
    try {
      await sb.upsert("customers",{...editC,name:form.name,phone:form.phone,address:form.address||""});
      await refresh(['customers']); setEditC(null); setForm(blank); toast("Customer updated ✓");
    } finally { setBusy(false); }
  };

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
      await refresh(['customers']); setDebtC(null); setDebtVal(""); toast(`Debt updated → ${fmt(newDebt)} ✓`);
    } finally { setBusy(false); }
  };

  const del = async (id) => {
    const c=data.customers.find(x=>x.id===id);
    if (c?.debt>0&&!confirm(`This customer owes ${fmt(c.debt)}. Delete anyway?`)) return;
    await sb.del("customers",id); await refresh(['customers']); toast("Customer deleted");
  };

  const openEdit = c => { setEditC(c); setForm({name:c.name,phone:c.phone||"",address:c.address||""}); setShow(false); setDebtC(null); };
  const openDebt = c => { setDebtC(c); setDebtVal(String(c.debt||0)); setDebtMode("set"); setEditC(null); setShow(false); };

  const filtered = useMemo(() =>
    data.customers.filter(c=>
      c.name?.toLowerCase().includes(srch.toLowerCase())||(c.phone||"").includes(srch)
    ), [data.customers, srch]);

  const formCols = isMobile ? {display:"flex",flexDirection:"column",gap:12} : C.g3;

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <div style={C.phdr}>
        <h1 style={{...C.h1,fontSize:isMobile?18:20}}>Customers <span style={{fontSize:13,color:"#64748b",fontWeight:400}}>({data.customers.length})</span></h1>
        <button style={{...C.btnP,minHeight:44}} onClick={()=>{setShow(s=>!s);setEditC(null);setDebtC(null);setForm(blank);}}><I n="plus" s={14}/> Add</button>
      </div>

      {show&&!editC&&(
        <div style={{...C.card,marginBottom:14}}>
          <ST>New Customer / Dealer</ST>
          <div style={formCols}>
            <Fld label="Name *"  value={form.name}    onChange={v=>setForm(f=>({...f,name:v}))}/>
            <Fld label="Phone"   value={form.phone}   onChange={v=>setForm(f=>({...f,phone:v}))}/>
            <Fld label="Address" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={{...C.btnP,flex:1,justifyContent:"center",minHeight:46}} onClick={add} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Save"}</button>
            <button style={{...C.btnG,flex:1,justifyContent:"center",minHeight:46}} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}

      {editC&&(
        <div style={{...C.card,marginBottom:14,borderTop:"3px solid #f59e0b"}}>
          <ST>Edit: {editC.name}</ST>
          <div style={formCols}>
            <Fld label="Name *"  value={form.name}    onChange={v=>setForm(f=>({...f,name:v}))}/>
            <Fld label="Phone"   value={form.phone}   onChange={v=>setForm(f=>({...f,phone:v}))}/>
            <Fld label="Address" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={{...C.btnP,flex:1,justifyContent:"center",minHeight:46}} onClick={saveEdit} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Update"}</button>
            <button style={{...C.btnG,flex:1,justifyContent:"center",minHeight:46}} onClick={()=>setEditC(null)}><I n="close" s={14}/> Cancel</button>
          </div>
        </div>
      )}

      {debtC&&(
        <div style={{...C.card,marginBottom:14,borderTop:"3px solid #ef4444"}}>
          <ST>Adjust Debt: {debtC.name}</ST>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,padding:"12px 14px",background:"#0d1117",borderRadius:10}}>
            <span style={{color:"#94a3b8",fontSize:13}}>Current Debt:</span>
            <span style={{fontWeight:800,fontSize:24,color:"#f87171"}}>{fmt(debtC.debt||0)}</span>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            {[["set","Set Amount"],["add","Add Debt"],["sub","Reduce"]].map(([m,l])=>(
              <button key={m} style={{...(debtMode===m?C.btnP:C.btnG),fontSize:12,padding:"8px 14px",flex:1,justifyContent:"center"}} onClick={()=>setDebtMode(m)}>{l}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:8}}>
            <div style={{flex:1}}>
              <label style={C.lbl}>
                {debtMode==="set"?"New Debt Amount ₹":debtMode==="add"?"Amount to Add ₹":"Amount to Reduce ₹"}
              </label>
              <input style={C.inp} type="number" min="0" value={debtVal} onChange={e=>setDebtVal(e.target.value)} placeholder="0.00"/>
            </div>
            {debtMode!=="set"&&debtVal&&(
              <div style={{padding:"10px 14px",background:"#0d1117",borderRadius:8,fontSize:13,color:"#94a3b8",flexShrink:0}}>
                → <b style={{color:debtMode==="add"?"#f87171":"#34d399"}}>
                  {fmt(Math.max(0,(debtC.debt||0)+(debtMode==="add"?+debtVal:-+debtVal)))}
                </b>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button style={{...C.btnP,flex:1,justifyContent:"center",minHeight:46}} onClick={saveDebt} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Save"}</button>
            <button style={{...C.btnG,flex:1,justifyContent:"center",minHeight:46}} onClick={()=>setDebtC(null)}><I n="close" s={14}/> Cancel</button>
          </div>
        </div>
      )}

      <input style={C.srch} placeholder="Search by name or phone…" value={srch} onChange={e=>setSrch(e.target.value)}/>

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.length===0?<MT text="No customers yet"/>:filtered.map(c=>(
            <div key={c.id} style={{...C.card,padding:"14px 14px",borderLeft:`3px solid ${c.debt>0?"#ef4444":"#10b981"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#f0f6ff"}}>{c.name}</div>
                  <div style={{color:"#64748b",fontSize:12,marginTop:2}}>{c.phone||"No phone"}</div>
                  {c.address&&<div style={{color:"#475569",fontSize:11,marginTop:1}}>{c.address}</div>}
                  {c.gst_no&&<div style={{color:"#fbbf24",fontSize:11,marginTop:1}}>GST: {c.gst_no}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                  <div style={{fontWeight:800,fontSize:18,color:c.debt>0?"#f87171":"#34d399"}}>{c.debt>0?fmt(c.debt):"Clear ✓"}</div>
                  {c.debt>0&&<div style={{fontSize:10,color:"#64748b",marginTop:1}}>outstanding</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <button style={{...C.iBtn,flex:1,justifyContent:"center",padding:"9px 0",color:"#94a3b8",fontSize:12,gap:5}} onClick={()=>openEdit(c)}><I n="edit" s={14}/> Edit Info</button>
                <button style={{...C.iBtn,flex:1,justifyContent:"center",padding:"9px 0",color:"#f59e0b",borderColor:"rgba(245,158,11,.3)",fontSize:12,gap:5}} onClick={()=>openDebt(c)}><I n="money" s={14}/> Adj. Debt</button>
                <button style={{...C.iBtn,padding:"9px 12px",color:"#f87171"}} onClick={()=>del(c.id)}><I n="trash" s={15}/></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={C.tbl}>
          <div style={{...C.tr,...C.th,gridTemplateColumns:"2fr 1fr 2fr 120px 110px"}}>
            <span>Name</span><span>Phone</span><span>Address</span><span>Debt</span><span>Actions</span>
          </div>
          {filtered.length===0?<MT text="No customers yet"/>:filtered.map(c=>(
            <div key={c.id} style={{...C.tr,gridTemplateColumns:"2fr 1fr 2fr 120px 110px"}}>
              <span style={{fontWeight:600,color:"#f0f6ff"}}>{c.name}</span>
              <span style={{color:"#94a3b8",fontSize:12}}>{c.phone||"—"}</span>
              <span style={{color:"#94a3b8",fontSize:12}}>{c.address||"—"}</span>
              <span><span style={{fontWeight:700,color:c.debt>0?"#f87171":"#34d399",fontSize:13}}>{c.debt>0?fmt(c.debt):"Clear ✓"}</span></span>
              <span style={{display:"flex",gap:5}}>
                <button style={{...C.iBtn,color:"#94a3b8"}} onClick={()=>openEdit(c)}><I n="edit" s={13}/></button>
                <button style={{...C.iBtn,color:"#f59e0b",borderColor:"rgba(245,158,11,.3)"}} onClick={()=>openDebt(c)}><I n="money" s={13}/></button>
                <button style={{...C.iBtn,color:"#f87171"}} onClick={()=>del(c.id)}><I n="trash" s={13}/></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
