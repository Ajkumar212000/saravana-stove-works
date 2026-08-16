/**
 * BarcodeScanner.jsx
 * ──────────────────────────────────────────────────────────────
 * Two scanning modes in one modal:
 *
 *  1. CAMERA   — @zxing/browser (lazy chunk) decodes EAN-13, UPC-A,
 *                Code 128 from live video stream.
 *
 *  2. USB/HID  — Hardware barcode scanners act as "keyboard wedge":
 *                they type the barcode digits + Enter very fast
 *                (< 50 ms between keystrokes). This mode shows a
 *                focused input that catches those keystrokes.
 *
 * Install:  npm install @zxing/browser
 *
 * Props:
 *   onScan(code: string)  — fires once with the clean barcode string
 *   onClose()             — dismiss modal
 *   title?                — heading text
 */

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { C, I } from "../shared.jsx";

/* ── Web Audio beep (no external file) ─────────────────────── */
function beep(ok = true) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = "sine";
    osc.frequency.value = ok ? 1318 : 440;           // E6 = success, A4 = error
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* blocked by browser policy — silent */ }
}

/* ── Scanning states ──────────────────────────────────────── */
const S = { IDLE:"idle", LOADING:"loading", ACTIVE:"active", OK:"ok", ERR:"err" };

/* ── Camera scanner (ZXing) ───────────────────────────────── */
function CameraScanner({ onScan }) {
  const videoRef  = useRef(null);
  const readerRef = useRef(null);
  const dedupRef  = useRef({ code:"", ts:0 });       // prevent duplicate fires

  const [camState,  setCamState]  = useState(S.IDLE);
  const [errMsg,    setErrMsg]    = useState("");
  const [lastCode,  setLastCode]  = useState("");
  const [flash,     setFlash]     = useState(false);
  const [cameras,   setCameras]   = useState([]);
  const [activeCam, setActiveCam] = useState(null);
  const [libReady,  setLibReady]  = useState(false);

  /* load @zxing/browser lazily */
  useEffect(() => {
    import("@zxing/browser").then(mod => {
      /*
       * BrowserMultiFormatReader tries every format on each frame.
       * For a POS environment we restrict to the three most common
       * retail formats — this cuts per-frame CPU cost significantly.
       */
      const hints = new Map();
      const { BarcodeFormat, DecodeHintType } = mod;
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ]);
      readerRef.current = new mod.BrowserMultiFormatReader(hints);
      setLibReady(true);
    }).catch(() => {
      setErrMsg("Could not load scanner. Run: npm install @zxing/browser");
      setCamState(S.ERR);
    });
    return () => { try { readerRef.current?.reset(); } catch {} };
  }, []);

  /* enumerate cameras once library is ready */
  useEffect(() => {
    if (!libReady) return;
    import("@zxing/browser").then(mod => {
      mod.BrowserCodeReader.listVideoInputDevices()
        .then(devs => {
          setCameras(devs);
          // prefer rear / environment camera on mobile
          const rear = devs.find(d => /back|rear|environment/i.test(d.label));
          setActiveCam(rear?.deviceId ?? devs[0]?.deviceId ?? null);
        })
        .catch(() => setActiveCam(undefined));
    });
  }, [libReady]);

  const stopCam = useCallback(() => {
    try { readerRef.current?.reset(); } catch {}
  }, []);

  const startCam = useCallback(async () => {
    if (!libReady || !videoRef.current) return;
    setCamState(S.LOADING);
    setErrMsg("");
    setLastCode("");
    dedupRef.current = { code:"", ts:0 };
    try {
      await readerRef.current.decodeFromVideoDevice(
        activeCam ?? undefined,
        videoRef.current,
        (result) => {
          if (!result) return;
          const code = result.getText().trim();
          if (!code) return;
          /* dedup: ignore same barcode within 1.5 s */
          const now = Date.now();
          if (code === dedupRef.current.code && now - dedupRef.current.ts < 1500) return;
          dedupRef.current = { code, ts: now };

          beep(true);
          setFlash(true);
          setTimeout(() => setFlash(false), 500);
          setCamState(S.OK);
          setLastCode(code);
          stopCam();
          onScan(code);
        }
      );
      setCamState(S.ACTIVE);
    } catch (e) {
      const m = e?.message ?? String(e);
      if (/NotAllowed|Permission/i.test(m))
        setErrMsg("Camera permission denied. Allow camera access in browser settings.");
      else if (/NotFound|Devices/i.test(m))
        setErrMsg("No camera detected on this device.");
      else
        setErrMsg("Camera error: " + m);
      setCamState(S.ERR);
    }
  }, [libReady, activeCam, onScan, stopCam]);

  const switchCam = () => {
    stopCam(); setCamState(S.IDLE);
    const idx  = cameras.findIndex(c => c.deviceId === activeCam);
    const next = cameras[(idx + 1) % cameras.length];
    setActiveCam(next.deviceId);
  };

  const isActive = camState === S.ACTIVE;

  return (
    <div>
      {/* Viewport */}
      <div style={{position:"relative", background:"#000", aspectRatio:"4/3", overflow:"hidden"}}>
        <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
          playsInline muted/>

        {/* Scanning overlay */}
        {isActive && <>
          {/* Corner brackets */}
          {[{top:16,left:16,borderTop:"3px solid #f59e0b",borderLeft:"3px solid #f59e0b"},
            {top:16,right:16,borderTop:"3px solid #f59e0b",borderRight:"3px solid #f59e0b"},
            {bottom:16,left:16,borderBottom:"3px solid #f59e0b",borderLeft:"3px solid #f59e0b"},
            {bottom:16,right:16,borderBottom:"3px solid #f59e0b",borderRight:"3px solid #f59e0b"},
          ].map((s,i) => <div key={i} style={{position:"absolute",width:24,height:24,...s}}/>)}

          {/* Horizontal scan bar */}
          <div style={{
            position:"absolute",left:"8%",right:"8%",height:2,
            background:"linear-gradient(90deg,transparent,#f59e0b,transparent)",
            boxShadow:"0 0 10px #f59e0b",
            animation:"barScan 1.6s ease-in-out infinite",
          }}/>

          {/* Dimmed border vignette */}
          <div style={{
            position:"absolute",inset:0,
            boxShadow:"inset 0 0 0 50px rgba(0,0,0,.4)",
            pointerEvents:"none",
          }}/>

          {/* Aim label */}
          <div style={{
            position:"absolute",bottom:12,left:0,right:0,
            textAlign:"center",fontSize:11,color:"rgba(255,255,255,.6)",
            letterSpacing:.5,
          }}>Align barcode in frame</div>
        </>}

        {/* Success flash */}
        {flash && (
          <div style={{
            position:"absolute",inset:0,
            background:"rgba(16,185,129,.4)",
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <div style={{
              width:56,height:56,borderRadius:"50%",
              background:"#10b981",
              display:"flex",alignItems:"center",justifyContent:"center",
              animation:"bPop .3s ease-out",
            }}>
              <I n="check" s={28}/>
            </div>
          </div>
        )}

        {/* Idle / loading placeholder */}
        {(camState === S.IDLE || camState === S.LOADING) && !flash && (
          <div style={{
            position:"absolute",inset:0,background:"#050a12",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,
          }}>
            {camState === S.LOADING
              ? <div style={C.spinner}/>
              : <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#1e293b" strokeWidth="1.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
            }
            {camState === S.IDLE && <span style={{fontSize:11,color:"#334155"}}>Camera off</span>}
          </div>
        )}

        {/* Error overlay */}
        {camState === S.ERR && (
          <div style={{
            position:"absolute",inset:0,background:"#050a12",
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            padding:20,gap:10,textAlign:"center",
          }}>
            <div style={{
              width:44,height:44,borderRadius:"50%",
              background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}><I n="warn" s={20}/></div>
            <div style={{color:"#f87171",fontSize:13,lineHeight:1.5}}>{errMsg}</div>
          </div>
        )}

        {/* Camera flip */}
        {cameras.length > 1 && isActive && (
          <button onClick={switchCam} style={{
            position:"absolute",top:10,right:10,
            background:"rgba(0,0,0,.55)",border:"1px solid rgba(255,255,255,.15)",
            borderRadius:8,padding:"6px 10px",color:"#e2e8f0",cursor:"pointer",
            display:"flex",alignItems:"center",gap:5,fontSize:11,
            backdropFilter:"blur(4px)",
          }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Flip
          </button>
        )}
      </div>

      {/* Last scanned code */}
      {lastCode && (
        <div style={{
          margin:"10px 0 0",padding:"8px 12px",
          background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:8,
          fontSize:12,color:"#34d399",fontFamily:"monospace",letterSpacing:1,
          display:"flex",alignItems:"center",gap:8,
        }}>
          <I n="check" s={13}/> {lastCode}
        </div>
      )}

      {/* Controls */}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        {isActive ? (
          <button onClick={()=>{stopCam();setCamState(S.IDLE);}}
            style={{...C.btnG,flex:1,justifyContent:"center",minHeight:44,color:"#f87171",borderColor:"rgba(248,113,113,.3)"}}>
            <I n="close" s={14}/> Stop
          </button>
        ) : (
          <button onClick={startCam} disabled={!libReady||camState===S.LOADING}
            style={{...C.btnP,flex:1,justifyContent:"center",minHeight:44,opacity:(!libReady||camState===S.LOADING)?.65:1}}>
            {camState===S.LOADING?"Starting…":camState===S.OK?"Scan Again":"Start Camera"}
          </button>
        )}
      </div>

      <style>{`
        @keyframes barScan{0%{top:15%}50%{top:78%}100%{top:15%}}
        @keyframes bPop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
      `}</style>
    </div>
  );
}

/* ── USB / Keyboard-wedge scanner ─────────────────────────── */
const UsbScanner = memo(function UsbScanner({ onScan }) {
  const inputRef  = useRef(null);
  const [val,     setVal]     = useState("");
  const [lastCode,setLastCode]= useState("");
  const [errMsg,  setErrMsg]  = useState("");
  const dedupRef  = useRef({ code:"", ts:0 });

  /* auto-focus so USB scanner keystrokes are captured immediately */
  useEffect(() => { inputRef.current?.focus(); }, []);

  const processCode = useCallback((raw) => {
    const code = raw.trim();
    if (code.length < 4) { setErrMsg("Too short — minimum 4 characters."); beep(false); return; }

    const now = Date.now();
    if (code === dedupRef.current.code && now - dedupRef.current.ts < 1500) return;
    dedupRef.current = { code, ts: now };

    beep(true);
    setLastCode(code);
    setErrMsg("");
    setVal("");
    onScan(code);
  }, [onScan]);

  const onKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      processCode(val);
    }
  }, [val, processCode]);

  return (
    <div style={{padding:"4px 0"}}>
      <div style={{
        marginBottom:12,padding:"10px 14px",
        background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.2)",
        borderRadius:8,fontSize:12,color:"#94a3b8",lineHeight:1.6,
        display:"flex",gap:8,
      }}>
        <I n="warn" s={14}/>
        <span>
          Plug in your USB barcode scanner. It will type the barcode + Enter automatically.
          Keep this tab open and scan any product.
        </span>
      </div>

      <label style={C.lbl}>Barcode input (auto-filled by scanner)</label>
      <div style={{position:"relative"}}>
        <input
          ref={inputRef}
          style={{
            ...C.inp,
            fontFamily:"monospace",fontSize:18,letterSpacing:2,
            paddingRight:44,
            borderColor: lastCode ? "rgba(16,185,129,.5)" : C.inp.borderColor,
          }}
          value={val}
          onChange={e => { setVal(e.target.value); setErrMsg(""); }}
          onKeyDown={onKeyDown}
          placeholder="Scan or type barcode…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        {/* Manual submit */}
        <button
          onClick={() => processCode(val)}
          style={{
            position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",
            background:"none",border:"none",color:"#f59e0b",cursor:"pointer",
            padding:"4px 6px",borderRadius:6,display:"flex",
          }}
          title="Submit (or press Enter)"
        >
          <I n="check" s={18}/>
        </button>
      </div>

      {errMsg && (
        <div style={{marginTop:8,fontSize:12,color:"#f87171",display:"flex",gap:6,alignItems:"center"}}>
          <I n="warn" s={13}/> {errMsg}
        </div>
      )}

      {lastCode && (
        <div style={{
          marginTop:10,padding:"8px 12px",
          background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",
          borderRadius:8,fontSize:12,color:"#34d399",
          fontFamily:"monospace",letterSpacing:1,
          display:"flex",alignItems:"center",gap:8,
        }}>
          <I n="check" s={13}/> Last scanned: {lastCode}
        </div>
      )}
    </div>
  );
});

/* ── Main modal ───────────────────────────────────────────── */
export default function BarcodeScanner({ onScan, onClose, title = "Scan Barcode" }) {
  const [mode, setMode] = useState("camera"); // "camera" | "usb"

  /* Esc to close */
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:"fixed",inset:0,zIndex:700,
        background:"rgba(0,0,0,.82)",
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:16,
        backdropFilter:"blur(6px)",
        WebkitBackdropFilter:"blur(6px)",
      }}
    >
      <div style={{
        background:"#0a0f1a",
        border:"1px solid #1e293b",
        borderRadius:20,
        width:"100%",maxWidth:420,
        overflow:"hidden",
        boxShadow:"0 32px 80px rgba(0,0,0,.8)",
        maxHeight:"90vh",
        display:"flex",flexDirection:"column",
      }}>

        {/* Header */}
        <div style={{
          display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"14px 18px 10px",
          borderBottom:"1px solid #1a2235",
          flexShrink:0,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{
              width:32,height:32,borderRadius:9,
              background:"linear-gradient(135deg,#f59e0b,#b45309)",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              {/* barcode icon */}
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#0d1117" strokeWidth="2.2" strokeLinecap="round">
                <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14"/>
                <path d="M3 5h2M3 19h2M19 5h2M19 19h2"/>
              </svg>
            </div>
            <div>
              <div style={{fontWeight:800,fontSize:14,color:"#f0f6ff"}}>{title}</div>
              <div style={{fontSize:10,color:"#475569",marginTop:1}}>
                EAN-13 · UPC-A · Code 128
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",padding:6,borderRadius:8,display:"flex"}}>
            <I n="close" s={20}/>
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{
          display:"flex",gap:1,padding:"10px 16px 0",
          borderBottom:"1px solid #1a2235",
          flexShrink:0,
        }}>
          {[["camera","📷  Camera"],["usb","🔌  USB Scanner"]].map(([m,l]) => (
            <button key={m} onClick={()=>setMode(m)} style={{
              flex:1,padding:"8px 0",fontSize:12,fontWeight:600,
              background:"none",border:"none",
              borderBottom: mode===m ? "2px solid #f59e0b" : "2px solid transparent",
              color: mode===m ? "#f59e0b" : "#475569",
              cursor:"pointer",
              transition:"color .15s",
              marginBottom:-1,
            }}>{l}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{overflowY:"auto",padding:"14px 16px 18px",flex:1}}>
          {mode === "camera"
            ? <CameraScanner onScan={onScan}/>
            : <UsbScanner    onScan={onScan}/>
          }
        </div>
      </div>
    </div>
  );
}
