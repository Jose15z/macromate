import { BrowserMultiFormatReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useT } from "../i18n";
import { logTarget } from "../utils";

export default function Scan() {
  const { t } = useT();
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
          navigate(
            `/product/${encodeURIComponent(result.getText())}?date=${date}&meal=${meal}`
          );
        }
      })
      .then((controls) => {
        controlsRef.current = controls;
        if (cancelled) controls.stop();
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === "NotAllowedError") setCameraError(t("scan.denied"));
        else if (err?.name === "NotFoundError") setCameraError(t("scan.noCamera"));
        else setCameraError(t("scan.failed"));
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [navigate, date, meal, t]);

  function submitManual(e) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    navigate(`/product/${encodeURIComponent(code)}?date=${date}&meal=${meal}`);
  }

  return (
    <div className="scan-page">
      <h2>{t("scan.title")}</h2>
      <p className="muted small">{t("scan.intro")}</p>

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
          placeholder={t("scan.typePlaceholder")}
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />
        <button className="btn primary" disabled={!manualCode.trim()}>
          {t("scan.search")}
        </button>
      </form>

      <button className="btn ghost" onClick={() => navigate(-1)}>
        {t("common.back")}
      </button>
    </div>
  );
}
