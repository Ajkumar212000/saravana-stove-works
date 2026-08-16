import { useState } from "react";
import { C, I, ST, sb, uid, fmt, toISO } from "../shared.jsx";

export default function ImportData({ data, refresh, isMobile }) {
  const [busy,   setBusy]   = useState(false);
  const [status, setStatus] = useState("");
  const [pct,    setPct]    = useState(0);
  const [log,    setLog]    = useState([]);

  const addLog = (msg, t="info") => setLog(l=>[...l,{msg,t}]);

  const chunk = async (table, rows, size=20) => {
    let done=0;
    for (let i=0;i<rows.length;i+=size){
      await sb.upsertMany(table, rows.slice(i,i+size));
      done+=Math.min(size,rows.length-i);
      setPct(Math.round((done/rows.length)*100));
    }
  };

  const go = async e => {
    const file=e.target.files[0]; if (!file) return;
    setBusy(true); setLog([]); setPct(0);
    try {
      setStatus("Reading Excel file…");
      const [buf, XLSX] = await Promise.all([
        file.arrayBuffer(),
        import("xlsx"),
      ]);
      // cellDates:true → Date objects; cellNF:false; raw values + cached formula results
      const wb = XLSX.read(buf, { type:"array", cellDates:true });
      addLog(`Sheets found: ${wb.SheetNames.join(", ")}`);

      /* ── 1. PRODUCTS ── */
      const prodSheet = wb.SheetNames.includes("products")  ? "products"
                      : wb.SheetNames.includes("Inventory") ? "Inventory"
                      : null;
      if (prodSheet) {
        setStatus("Importing products…"); setPct(0);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[prodSheet]);
        addLog(`  "${prodSheet}" — ${rows.length} raw rows`);
        let prods;
        if (prodSheet === "products") {
          const valid = rows.filter(r => r["name"] && r["sell_price"] != null && !String(r["name"]).startsWith("="));
          prods = valid.map(r => ({
            id:         uid(),
            name:       String(r["name"]).trim(),
            category:   String(r["category"] || "").trim(),
            buy_price:  Number(r["buy_price"]  || 0),
            sell_price: Number(r["sell_price"] || 0),
            gst:        Number(r["gst"]        || 0),
            stock:      Number(r["stock"]      || 0),
            unit:       String(r["unit"]       || "pcs").trim(),
            barcode:    String(r["barcode"] || "").trim()
          }));
        } else {
          const valid = rows.filter(r => r["Product Name"] && r["Selling Price"] != null && !String(r["Product Name"]).startsWith("="));
          prods = valid.map(r => ({
            id:         uid(),
            name:       String(r["Product Name"]).trim(),
            category:   String(r["Category"]   || "").trim(),
            buy_price:  Number(r["Buying Price"]|| 0),
            sell_price: Number(r["Selling Price"]|| 0),
            gst:        Number(r["GST"]         || r["gst"] || 0),
            stock:      Number(r["Stock"]       || 0),
            unit:       String(r["Unit"]        || "pcs").trim(),
            barcode:    String(r["barcode"] || "").trim(),
          }));
        }
        if (prods.length) { await chunk("products", prods, 20); addLog(`✓ ${prods.length} products imported`, "ok"); }
        else addLog("  No valid product rows found — check column names", "err");
      } else {
        addLog('  No products sheet found (expected "products" or "Inventory")', "err");
      }

      /* ── 2. DEALERS / CUSTOMERS ── */
      if (wb.SheetNames.includes("Dealers")) {
        setStatus("Importing customers…"); setPct(0);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets["Dealers"]);
        const v = (r, ...keys) => { for (const k of keys) if (r[k] != null) return r[k]; return ""; };
        const valid = rows.filter(r =>
          (r["Name"] || r["name"]) &&
          !String(r["Name"] || r["name"] || "").startsWith("=")
        );
        const custs = valid.map(r => ({
          id:      uid(),
          name:    String(v(r,"Name","name")).trim(),
          phone:   String(v(r,"Phone","phone","Mobile","mobile")).trim(),
          address: String(v(r,"Address","address")).trim(),
          debt:    Number(v(r,"Debt","debt","Outstanding","outstanding") || 0),
        }));
        if (custs.length) { await chunk("customers", custs, 20); addLog(`✓ ${custs.length} dealers/customers imported`, "ok"); }
        else addLog('  Dealers sheet is empty — skipped', "info");
      }

      /* ── 3. EXPENSES ── */
      const expSheet = wb.SheetNames.includes("expenses") ? "expenses"
                     : wb.SheetNames.includes("Salary")   ? "Salary"
                     : null;
      if (expSheet) {
        setStatus("Importing expenses…"); setPct(0);
        let exps;
        if (expSheet === "expenses") {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets["expenses"], { range: 2, raw: false });
          addLog(`  "expenses" — ${rows.length} data rows`);
          const valid = rows.filter(r => r["amount"] && r["DATE"] && !String(r["amount"]).startsWith("="));
          exps = valid.map(r => ({
            id:          uid(),
            date:        toISO(r["DATE"]),
            amount:      Number(r["amount"] || 0),
            description: String(r["DISCREPTION"] || r["description"] || "salary").toLowerCase().trim(),
            created_at:  Date.now(),
          }));
        } else {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets["Salary"], { raw: false });
          const valid = rows.filter(r => r["Amount"] && r["Date"] && !String(r["Amount"]).startsWith("="));
          exps = valid.map(r => ({
            id:          uid(),
            date:        toISO(r["Date"]),
            amount:      Number(r["Amount"] || 0),
            description: String(r["Type"] || "salary").toLowerCase().trim(),
            created_at:  Date.now(),
          }));
        }
        if (exps.length) { await chunk("expenses", exps, 20); addLog(`✓ ${exps.length} expense entries imported`, "ok"); }
        else addLog("  No valid expense rows found", "err");
      } else {
        addLog('  No expenses sheet found (expected "expenses" or "Salary")', "err");
      }

      /* ── 4. SALES ── */
      if (wb.SheetNames.includes("Sales")) {
        setStatus("Importing sales…"); setPct(0);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets["Sales"], { raw: true, cellDates: true });
        addLog(`  "Sales" — ${rows.length} raw line-item rows`);
        const valid = rows.filter(r =>
          r["Product Name"] &&
          !String(r["Product Name"]).startsWith("=") &&
          r["Date"]
        );
        const pMap = {};
        data.products.forEach(p => { pMap[p.name.trim().toLowerCase()] = p.id; });
        const grouped = {};
        valid.forEach(r => {
          const d = toISO(r["Date"]);
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push(r);
        });
        const saleDocs = Object.entries(grouped).map(([date, items]) => {
          const saleItems = items.map(r => ({
            productId: pMap[String(r["Product Name"]).trim().toLowerCase()] || uid(),
            qty:   Number(r["Quantity"]      || 1),
            price: Number(r["Selling Price"] || 0),
          }));
          const total  = items.reduce((a, r) => a + Number(r["Total"]   || 0), 0) ||
                         saleItems.reduce((a, i) => a + i.price * i.qty, 0);
          const profit = items.reduce((a, r) => a + Number(r["Profits"] || 0), 0) ||
                         items.reduce((a, r) => a + Number(r["Selling Price"] || 0) * Number(r["Quantity"] || 1)
                                               - Number(r["Buying prize"]    || 0) * Number(r["Quantity"] || 1), 0);
          return {
            id: uid(), date,
            created_at: new Date(date).getTime() || Date.now(),
            customer_id: null, walk_in_name: null,
            items: saleItems, total, profit, paid: total, note: "",
          };
        });
        if (saleDocs.length) { await chunk("sales", saleDocs, 20); addLog(`✓ ${saleDocs.length} sale records imported (${valid.length} line items)`, "ok"); }
        else addLog("  No valid sales rows found", "err");
      }

      await refresh(); // full refresh — import may have touched all tables
      setStatus("Import complete! 🎉");
      addLog("All data is now live in Supabase.", "ok");
    } catch(e) {
      addLog("Error: " + e.message, "err");
      setStatus("Import failed — check log below");
      console.error(e);
    }
    setBusy(false); setPct(0); e.target.value = "";
  };

  return (
    <div style={C.pg}>
      <h1 style={{...C.h1,fontSize:isMobile?18:20}}>Import Data</h1>
      <div style={C.card}>
        <ST>Upload Excel File</ST>
        <p style={{color:"#94a3b8",fontSize:13,marginBottom:12,lineHeight:1.6}}>
          Upload <b style={{color:"#f59e0b"}}>Sales_Inventory_Template.xlsx</b><br/>
          <span style={{color:"#64748b",fontSize:12}}>
            Imports all 4 sheets automatically:<br/>
            <b style={{color:"#94a3b8"}}>products</b> → inventory with GST &nbsp;·&nbsp;
            <b style={{color:"#94a3b8"}}>Dealers</b> → customers with debt<br/>
            <b style={{color:"#94a3b8"}}>expenses</b> → salary & costs &nbsp;·&nbsp;
            <b style={{color:"#94a3b8"}}>Sales</b> → all sale records
          </span>
        </p>
        <div style={{...C.alertW,marginBottom:14}}><I n="warn" s={14}/> Safe to run multiple times</div>
        <label style={{...C.btnP,cursor:"pointer",display:"inline-flex",gap:6,minHeight:48,padding:"12px 20px",fontSize:14}}>
          <I n="upload" s={16}/> {busy?"Importing…":"Choose Excel File"}
          <input type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={go} disabled={busy}/>
        </label>
      </div>
      {(status||log.length>0)&&(
        <div style={{...C.card,marginTop:12}}>
          <ST>Import Log</ST>
          {status&&<div style={{color:"#f59e0b",fontWeight:600,marginBottom:10,fontSize:13}}>{status}</div>}
          {busy&&pct>0&&(
            <div style={{marginBottom:12}}>
              <div style={{background:"#0f172a",borderRadius:6,height:8,overflow:"hidden"}}>
                <div style={{background:"#f59e0b",height:"100%",width:`${pct}%`,transition:"width .3s",borderRadius:6}}/>
              </div>
              <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{pct}%</div>
            </div>
          )}
          <div style={{maxHeight:200,overflow:"auto"}}>
            {log.map((l,i)=>(
              <div key={i} style={{fontSize:12,padding:"4px 0",color:l.t==="ok"?"#34d399":l.t==="err"?"#f87171":"#94a3b8"}}>{l.msg}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{...C.card,marginTop:12}}>
        <ST>Current DB Status</ST>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["Products",data.products.length,"#f59e0b"],["Customers",data.customers.length,"#10b981"],["Sales",data.sales.length,"#818cf8"],["Expenses",data.expenses.length,"#64748b"]].map(([l,v,a])=>(
            <div key={l} style={{background:"#0f172a",borderRadius:10,padding:"12px 16px",border:"1px solid #1e293b"}}>
              <div style={{color:"#64748b",fontSize:11,marginBottom:4}}>{l}</div>
              <div style={{fontSize:22,fontWeight:800,color:a}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
