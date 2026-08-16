/**
 * useBarcodeInput.js
 * ──────────────────────────────────────────────────────────────
 * Always-on hook that listens for USB / HID barcode scanner input
 * (keyboard wedge behavior) globally — without needing the modal open.
 *
 * How keyboard-wedge scanners work:
 *   They type every character in the barcode in rapid succession
 *   (typically < 30 ms between each keystroke), then fire Enter.
 *   Manual typing is much slower (> 100 ms between keystrokes).
 *   We exploit this timing difference to distinguish scanner from human.
 *
 * Usage:
 *   useBarcodeInput(onScan, { enabled: !showModal })
 *
 * The hook does nothing when `enabled` is false (e.g. while the modal
 * is open — so the modal's own input catches keystrokes instead).
 */

import { useEffect, useRef } from "react";

const MIN_LENGTH      = 4;    // ignore codes shorter than this
const MAX_CHAR_GAP_MS = 80;   // max ms between keystrokes to be considered a scanner
const DEDUP_WINDOW_MS = 1500; // ignore same code within this window

export function useBarcodeInput(onScan, { enabled = true } = {}) {
  const bufferRef   = useRef("");
  const lastKeyTime = useRef(0);
  const dedupRef    = useRef({ code:"", ts:0 });
  const onScanRef   = useRef(onScan);

  /* keep ref in sync without re-registering the listener */
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e) => {
      /* ignore keystrokes in input / textarea / select fields —
         let the user type normally without triggering a scan */
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const now = Date.now();

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        lastKeyTime.current = 0;

        if (code.length < MIN_LENGTH) return;

        /* deduplication */
        if (code === dedupRef.current.code && now - dedupRef.current.ts < DEDUP_WINDOW_MS) return;
        dedupRef.current = { code, ts: now };

        onScanRef.current(code);
        return;
      }

      /* only printable single characters */
      if (e.key.length !== 1) return;

      const gap = now - lastKeyTime.current;

      if (lastKeyTime.current !== 0 && gap > MAX_CHAR_GAP_MS) {
        /* gap too large — this is a human typing, not a scanner.
           Reset buffer so we don't mix partial manual input. */
        bufferRef.current = "";
      }

      bufferRef.current  += e.key;
      lastKeyTime.current = now;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
