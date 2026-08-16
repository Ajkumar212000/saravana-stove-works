import { useState, useMemo } from "react";
import { C, I, ST, MT, Fld, Toast, useToast, sb, uid, fmt } from "../shared.jsx";

export default function Suppliers({ data, refresh, shopGST, saveShopGST, isMobile }) {
  const blank = {name:"",phone:"",address:"",gst_no:""};
  const [form,    setForm]    = useState(blank);
  const [show,    setShow]    = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [editS,   setEditS]   = useState(null);
  const [srch,    setSrch]    = useState("");
  const [editGST, setEditGST] = useState(false);
  const [gstDraft,setGstDraft]= useState(shopGST||"");
  const [t, toast] = useToast();

  const suppliers = data.suppliers || [];

  const add = async () => {
    if (!form.name) return toast("Enter supplier name","err");
    setBusy(true);
    try {
      await sb.upsert("suppliers",{...form,id:uid(),debt:0,created_at:Date.now()});
      await refresh(['suppliers']); setForm(blank); setShow(false); toast("Supplier added ✓");
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editS) return;
    setBusy(true);
    try {
      await sb.upsert("suppliers",{...editS,name:form.name,phone:form.phone,address:form.address,gst_no:form.gst_no||""});
      await refresh(['suppliers']); setEditS(null); setForm(blank); toast("Supplier updated ✓");
    } finally { setBusy(false); }
  };

  const del = async id => {
    const s=suppliers.find(x=>x.id===id);
    if (s?.debt>0&&!confirm(`You owe this supplier ${fmt(s.debt)}. Delete anyway?`)) return;
    await sb.del("suppliers",id); await refresh(['suppliers']); toast("Supplier deleted");
  };

  const openEdit = s => { setEditS(s); setForm({name:s.name,phone:s.phone||"",address:s.address||"",gst_no:s.gst_no||""}); setShow(false); };

  const filtered = useMemo(() =>
    suppliers.filter(s=>
      s.name?.toLowerCase().includes(srch.toLowerCase())||(s.phone||"").includes(srch)||(s.gst_no||"").toLowerCase().includes(srch.toLowerCase())
    ), [suppliers, srch]);
  const totalDebt = useMemo(() => suppliers.reduce((a,s)=>a+(s.debt||0),0), [suppliers]);
  const formCols  = isMobile ? {display:"flex",flexDirection:"column",gap:12} : C.g3;

  return (
    <div style={C.pg}>
      <Toast t={t}/>
      <div style={C.phdr}>
        <h1 style={{...C.h1,fontSize:isMobile?18:20}}>Suppliers <span style={{fontSize:13,color:"#64748b",fontWeight:400}}>({suppliers.length})</span></h1>
        <button style={{...C.btnP,minHeight:44}} onClick={()=>{setShow(s=>!s);setEditS(null);setForm(blank);}}><I n="plus" s={14}/> Add</button>
      </div>

      <div style={{...C.card,marginBottom:14,borderTop:"3px solid #818cf8"}}>
        <ST>Your Shop GST Number (printed on all bills)</ST>
        {editGST ? (
          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <div style={{flex:1}}>
              <input style={{...C.inp,fontFamily:"monospace",letterSpacing:1}} value={gstDraft}
                onChange={e=>setGstDraft(e.target.value.toUpperCase())} placeholder="e.g. 33ABCDE1234F1Z5" maxLength={15}/>
            </div>
            <button style={{...C.btnP,minHeight:44,padding:"0 18px"}} onClick={async()=>{await saveShopGST(gstDraft.trim());setEditGST(false);toast("Shop GST saved ✓");}}>
              <I n="check" s={14}/> Save
            </button>
            <button style={{...C.btnG,minHeight:44,padding:"0 14px"}} onClick={()=>{setEditGST(false);setGstDraft(shopGST||"");}}>
              <I n="close" s={14}/>
            </button>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <span style={{fontFamily:"monospace",fontSize:15,color:shopGST?"#fbbf24":"#475569",letterSpacing:1}}>
              {shopGST||"Not set — click Edit to add"}
            </span>
            <button style={{...C.btnG,padding:"8px 14px",fontSize:12}} onClick={()=>{setEditGST(true);setGstDraft(shopGST||"");}}>
              <I n="edit" s={13}/> Edit
            </button>
          </div>
        )}
      </div>

      {totalDebt>0&&(
        <div style={{...C.card,marginBottom:14,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"3px solid #f87171"}}>
          <span style={{color:"#94a3b8",fontSize:13}}>Total Owed to Suppliers</span>
          <span style={{fontWeight:800,fontSize:22,color:"#f87171"}}>{fmt(totalDebt)}</span>
        </div>
      )}

      {show&&!editS&&(
        <div style={{...C.card,marginBottom:14}}>
          <ST>New Supplier</ST>
          <div style={formCols}>
            <Fld label="Name *"  value={form.name}    onChange={v=>setForm(f=>({...f,name:v}))}/>
            <Fld label="Phone"   value={form.phone}   onChange={v=>setForm(f=>({...f,phone:v}))}/>
            <Fld label="Address" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
            <Fld label="GST No"  value={form.gst_no}  onChange={v=>setForm(f=>({...f,gst_no:v.toUpperCase()}))} ph="Supplier GSTIN"/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={{...C.btnP,flex:1,justifyContent:"center",minHeight:46}} onClick={add} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Save"}</button>
            <button style={{...C.btnG,flex:1,justifyContent:"center",minHeight:46}} onClick={()=>setShow(false)}>Cancel</button>
          </div>
        </div>
      )}

      {editS&&(
        <div style={{...C.card,marginBottom:14,borderTop:"3px solid #f59e0b"}}>
          <ST>Edit: {editS.name}</ST>
          <div style={formCols}>
            <Fld label="Name *"  value={form.name}    onChange={v=>setForm(f=>({...f,name:v}))}/>
            <Fld label="Phone"   value={form.phone}   onChange={v=>setForm(f=>({...f,phone:v}))}/>
            <Fld label="Address" value={form.address} onChange={v=>setForm(f=>({...f,address:v}))}/>
            <Fld label="GST No"  value={form.gst_no}  onChange={v=>setForm(f=>({...f,gst_no:v.toUpperCase()}))} ph="Supplier GSTIN"/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button style={{...C.btnP,flex:1,justifyContent:"center",minHeight:46}} onClick={saveEdit} disabled={busy}><I n="check" s={14}/> {busy?"Saving…":"Update"}</button>
            <button style={{...C.btnG,flex:1,justifyContent:"center",minHeight:46}} onClick={()=>setEditS(null)}><I n="close" s={14}/> Cancel</button>
          </div>
        </div>
      )}

      <div style={{...C.alertW,marginBottom:14,fontSize:12}}>
        <I n="warn" s={13}/> Supplier debt is managed automatically — increases when you record a Purchase expense, and can be paid off from the <b>Debts</b> tab.
      </div>

      <input style={C.srch} placeholder="Search by name, phone or GST…" value={srch} onChange={e=>setSrch(e.target.value)}/>

      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.length===0?<MT text="No suppliers yet"/>:filtered.map(s=>(
            <div key={s.id} style={{...C.card,padding:"14px 14px",borderLeft:`3px solid ${s.debt>0?"#f87171":"#10b981"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#f0f6ff"}}>{s.name}</div>
                  <div style={{color:"#64748b",fontSize:12,marginTop:2}}>{s.phone||"No phone"}</div>
                  {s.address&&<div style={{color:"#475569",fontSize:11,marginTop:1}}>{s.address}</div>}
                  {s.gst_no&&<div style={{color:"#fbbf24",fontSize:11,marginTop:1,fontFamily:"monospace"}}>GST: {s.gst_no}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                  <div style={{fontWeight:800,fontSize:18,color:s.debt>0?"#f87171":"#34d399"}}>{s.debt>0?fmt(s.debt):"Clear ✓"}</div>
                  {s.debt>0&&<div style={{fontSize:10,color:"#64748b",marginTop:1}}>we owe them</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <button style={{...C.iBtn,flex:1,justifyContent:"center",padding:"9px 0",color:"#94a3b8",fontSize:12,gap:5}} onClick={()=>openEdit(s)}><I n="edit" s={14}/> Edit Info</button>
                <button style={{...C.iBtn,padding:"9px 12px",color:"#f87171"}} onClick={()=>del(s.id)}><I n="trash" s={15}/></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={C.tbl}>
          <div style={{...C.tr,...C.th,gridTemplateColumns:"2fr 1fr 2fr 120px 80px"}}>
            <span>Name</span><span>Phone</span><span>GST No</span><span>We Owe</span><span>Actions</span>
          </div>
          {filtered.length===0?<MT text="No suppliers yet"/>:filtered.map(s=>(
            <div key={s.id} style={{...C.tr,gridTemplateColumns:"2fr 1fr 2fr 120px 80px"}}>
              <div>
                <div style={{fontWeight:600,color:"#f0f6ff",fontSize:13}}>{s.name}</div>
                {s.phone&&<div style={{color:"#475569",fontSize:11,marginTop:2}}>{s.phone}</div>}
              </div>
              <span style={{color:"#94a3b8",fontSize:12}}>{s.phone||"—"}</span>
              <span style={{color:"#fbbf24",fontSize:12,fontFamily:"monospace"}}>{s.gst_no||"—"}</span>
              <span><span style={{fontWeight:700,color:s.debt>0?"#f87171":"#34d399",fontSize:13}}>{s.debt>0?fmt(s.debt):"Clear ✓"}</span></span>
              <span style={{display:"flex",gap:5}}>
                <button style={{...C.iBtn,color:"#94a3b8"}} onClick={()=>openEdit(s)}><I n="edit" s={13}/></button>
                <button style={{...C.iBtn,color:"#f87171"}} onClick={()=>del(s.id)}><I n="trash" s={13}/></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
