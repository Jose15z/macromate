import { BrowserMultiFormatReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { logTarget } from "../utils";

export default function Scan() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { date, meal } = logTarget(searchParams);

  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const foundRef = useRef(false);
  const [cameraError, setCameraError] = useState("");
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
        controlsRef.current = controls;
        if (result && !foundRef.current) {
          foundRef.current = true;
          controls.stop();
          navigate(`/product/${encodeURIComponent(result.getText())}?date=${date}&meal=${meal}`);
        }
      })
      .then((controls) => {
        controlsRef.current = controls;
        if (cancelled) controls.stop();
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === "NotAllowedError") {
          setCameraError(
            "Camera access was denied. Allow camera permission in your browser, or type the barcode below."
          );
        } else if (err?.name === "NotFoundError") {
          setCameraError("No camera found on this device. Type the barcode below instead.");
        } else {
          setCameraError("Could not start the camera. Type the barcode below instead.");
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [navigate, date, meal]);

  function submitManual(e) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    navigate(`/product/${encodeURIComponent(code)}?date=${date}&meal=${meal}`);
  }

  return (
    <div className="scan-page">
      <h2>Scan a barcode</h2>
      <p className="muted small">
        Point your camera at a product barcode — it looks up nutrition on OpenFoodFacts.
      </p>

      {cameraError ? (
        <div className="card empty">{cameraError}</div>
      ) : (
        <div className="scanner-frame">
          {/* muted+playsInline required for mobile autoplay */}
          <video ref={videoRef} muted playsInline />
          <div className="scan-line" aria-hidden="true" />
        </div>
      )}

      <form onSubmit={submitManual} className="manual-barcode">
        <input
          inputMode="numeric"
          placeholder="…or type the barcode number"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />
        <button className="btn primary" disabled={!manualCode.trim()}>
          Search
        </button>
      </form>

      <button className="btn ghost" onClick={() => navigate(-1)}>
        ← Back
      </button>
    </div>
  );
}
