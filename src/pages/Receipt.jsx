import { C, I, fmt, fmtDate } from "../shared.jsx";

export default function Receipt({ rcpt, products, shopGST, onClose }) {
  const doPrint = () => {
    const content = document.getElementById("stow-receipt-body");
    if (!content) return window.print();
    const w = window.open("","_blank","width=420,height=700");
    w.document.write(`<!DOCTYPE html><html><head><title>Bill #${rcpt.id.slice(-8).toUpperCase()}</title>
      <style>body{margin:0;padding:20px;font-family:'Courier New',monospace;background:#fff;color:#111}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:3px 0}
      @media print{button{display:none}}</style></head>
      <body>${content.innerHTML}<script>window.onload=()=>{window.print()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div style={{maxWidth:380,margin:"0 auto",paddingTop:16}}>
      <div id="stow-receipt-body" style={{background:"#fff",color:"#111",padding:24,borderRadius:12,fontFamily:"'Courier New',monospace",fontSize:12}}>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:22,fontWeight:900,letterSpacing:5,marginBottom:2}}>STOW</div>
          <div style={{fontSize:10,color:"#555"}}>Wholesale & Retail</div>
          {(shopGST||rcpt.shopGST)&&<div style={{fontSize:10,color:"#333",marginTop:2}}>GSTIN: {shopGST||rcpt.shopGST}</div>}
          <div style={{borderTop:"1px dashed #ccc",marginTop:8,paddingTop:8,fontSize:10,color:"#777"}}>
            Bill #{rcpt.id.slice(-8).toUpperCase()} · {fmtDate(rcpt.date)}
          </div>
        </div>
        <div style={{fontWeight:700,marginBottom:2,fontSize:13}}>{rcpt.customerName}</div>
        {rcpt.customerGST&&<div style={{fontSize:10,color:"#555",marginBottom:10}}>GSTIN: {rcpt.customerGST}</div>}
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:"1px dashed #ccc"}}>
            <th style={{textAlign:"left",padding:"3px 0",fontWeight:600}}>Item</th>
            <th style={{textAlign:"center",fontWeight:600}}>Qty</th>
            <th style={{textAlign:"right",fontWeight:600}}>Rate</th>
            <th style={{textAlign:"right",fontWeight:600}}>Amt</th>
          </tr></thead>
          <tbody>
            {(rcpt.items||[]).map((item,i)=>{
              const p=products.find(x=>x.id===item.productId);
              return (
                <tr key={i} style={{borderBottom:"1px dashed #eee"}}>
                  <td style={{padding:"3px 0"}}>{p?.name||"?"}</td>
                  <td style={{textAlign:"center"}}>{item.qty}</td>
                  <td style={{textAlign:"right"}}>{fmt(item.price)}</td>
                  <td style={{textAlign:"right",fontWeight:600}}>{fmt(item.price*item.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{marginTop:10,borderTop:"1px dashed #ccc",paddingTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,fontSize:14}}><span>Total</span><span>{fmt(rcpt.total)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",color:"#555",fontSize:13}}><span>Paid</span><span>{fmt(rcpt.paid)}</span></div>
          {rcpt.total-rcpt.paid>0&&(
            <div style={{display:"flex",justifyContent:"space-between",color:"red",fontWeight:700,fontSize:13}}><span>Balance Due</span><span>{fmt(rcpt.total-rcpt.paid)}</span></div>
          )}
        </div>
        {rcpt.note&&<div style={{marginTop:8,fontSize:11,color:"#777"}}>Note: {rcpt.note}</div>}
        <div style={{textAlign:"center",marginTop:12,fontSize:10,color:"#aaa",borderTop:"1px dashed #ccc",paddingTop:8}}>Thank you! Visit again.</div>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:16}} className="no-print">
        <button style={{...C.btnP,padding:"12px 24px",fontSize:14,flex:1,justifyContent:"center",minHeight:50}} onClick={doPrint}><I n="print" s={15}/> Print Bill</button>
        <button style={{...C.btnG,padding:"12px 18px",fontSize:14,flex:1,justifyContent:"center",minHeight:50}} onClick={onClose}><I n="close" s={14}/> Close</button>
      </div>
    </div>
  );
}
