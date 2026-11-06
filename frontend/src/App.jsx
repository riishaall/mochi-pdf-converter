import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown, ArrowRight, Check, CheckCircle2, ChevronDown, Clock3, CloudUpload,
  FileCheck2, FileText, Files, Globe2, Heart, LockKeyhole, Moon, PawPrint,
  ShieldCheck, Sparkles, Sun, Upload, Volume2, WandSparkles, Zap, X,
} from "lucide-react";
import CatImage, { CatFace } from "./CatImage.jsx";
import { RATING_FACES } from "./catImages.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10;

function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description);
  }, [title, description]);
}

function Logo({ onClick }) {
  return (
    <Link className="brand" to="/" aria-label="Mochi Converter home" onClick={onClick}>
      <img className="brand-icon" src="/mochi-logo.svg" alt="" width="44" height="44" />
      <span className="brand-wordmark"><strong>Mochi</strong> <span>Converter</span></span>
    </Link>
  );
}

function AppDialog({ modal, onClose, onDownload }) {
  const reducedMotion = useReducedMotion();
  const dialogRef = useRef(null);
  const [password, setPassword] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [rating, setRating] = useState(0);
  const titleId = "mochi-dialog-title";
  const descriptionId = "mochi-dialog-description";

  useEffect(() => {
    if (!modal) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex='-1'])")];
    (focusable()[0] || dialog).focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus?.();
    };
  }, [modal, onClose]);

  useEffect(() => {
    if (modal?.kind !== "rating") return undefined;
    const timer = window.setTimeout(() => setRating(0), 0);
    return () => window.clearTimeout(timer);
  }, [modal?.kind]);

  if (!modal) return null;
  const isLocked = modal.kind === "locked";
  const isSuccess = modal.kind === "success";
  const config = {
    welcome: ["welcome", "Hi, I'm Mochi!", "Drop a PDF and I'll handle the rest.", "Meet your new favorite little helper."],
    success: ["success", "Your Word files are ready!", "Purrfect! Your editable documents are ready to go.", "Made with a little help from Mochi."],
    error: ["error", "Oops, Mochi knocked something over.", "Please try again. Your original files are safe.", "A tiny hiccup, human."],
    tooBig: ["toobig", "This file is too chonky!", "Max size is 50 MB per file. Try a smaller PDF.", "Mochi needs a bite-sized file."],
    wrongFile: ["wrongfile", "That's not a PDF.", "Mochi only eats PDFs. Choose a .pdf file to continue.", "Let's find the right document."],
    locked: ["locked", "This PDF is locked.", "Enter the password so Mochi can help.", "Your password stays private to this conversion."],
    delete: ["delete", "One last check!", "Delete these files now? They'll disappear like a cat at bath time.", "This only removes the files from the current selection."],
    offline: ["offline", "Mochi is taking a catnap.", "Please check your connection and try again in a minute.", "The conversion service could not be reached."],
    rating: [null, "How was your time with Mochi?", "Pick the face that feels right.", "Your feedback helps make Mochi even better."],
  }[modal.kind] || ["error", "Oops, Mochi knocked something over.", "Please try again.", "A tiny hiccup, human."];
  const [image, title, description, note] = config;

  const submitPassword = async (event) => {
    event.preventDefault();
    setDialogError("");
    try {
      await modal.onUnlock(password);
      setPassword("");
      onClose();
    } catch (error) {
      setDialogError(error.message || "That password didn't work. Please try again.");
    }
  };

  const primary = modal.onConfirm || modal.onPrimary || (["welcome", "error", "tooBig", "wrongFile", "offline"].includes(modal.kind) ? onClose : undefined);
  const primaryLabel = modal.primaryLabel || (modal.kind === "delete" ? "Yes, delete files" : modal.kind === "welcome" ? "Let's get started" : "Try again");
  return (
    <motion.div
      className="dialog-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        className="mochi-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 28 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 18 }}
        transition={reducedMotion ? { duration: 0.01 } : { type: "spring", stiffness: 280, damping: 22 }}
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        {image && <CatImage name={image} className="dialog-mascot" width={240} height={240} loading="eager" fallbackMood={isSuccess ? "delighted" : "happy"} />}
        <span className="dialog-paw" aria-hidden="true"><PawPrint size={17} /></span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        {note && <small className="dialog-note">{note}</small>}

        {isLocked && (
          <form className="dialog-password-form" onSubmit={submitPassword}>
            <label htmlFor="mochi-password">PDF password</label>
            <input id="mochi-password" type="password" autoComplete="current-password" maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
            {dialogError && <p className="dialog-error" role="alert">{dialogError}</p>}
            <button type="submit" className="button button-primary"><PawPrint size={17} /> Unlock & convert</button>
          </form>
        )}

        {isSuccess && modal.job && (
          <div className="dialog-downloads">
            {modal.job.outputs.filter((item) => !item.error).map((item) => {
              const index = modal.job.outputs.indexOf(item);
              return <a className="button button-primary" href={`${API_URL}/api/jobs/${modal.job.id}/download/${index}`} download onClick={onDownload} key={`${item.name}-${index}`}><ArrowDown size={17} /> Grab Your File <span className="dialog-file-name">{item.name}</span></a>;
            })}
            {modal.job.outputs.filter((item) => !item.error).length > 1 && <a className="button button-secondary" href={`${API_URL}/api/jobs/${modal.job.id}/download-all`} download onClick={onDownload}><Files size={17} /> Download all as ZIP</a>}
          </div>
        )}

        {modal.kind === "rating" && (
          <div className="rating-picker" role="radiogroup" aria-label="Rate your experience">
            {RATING_FACES.map((face, index) => (
              <button
                type="button"
                role="radio"
                aria-checked={rating === index + 1}
                aria-label={face.label}
                className={`rating-choice ${rating === index + 1 ? "rating-selected" : ""}`}
                onClick={() => setRating(index + 1)}
                key={face.mood}
              >
                <CatFace mood={face.mood} />
                <span>{face.label}</span>
              </button>
            ))}
          </div>
        )}

        {!isLocked && !isSuccess && modal.kind !== "rating" && (
          <div className="dialog-actions">
            {primary && <button className={`button ${modal.kind === "delete" ? "button-danger" : "button-primary"}`} onClick={() => { primary(); if (primary !== onClose) onClose(); }}>{primaryLabel} <PawPrint size={17} /></button>}
            {modal.kind !== "welcome" && <button className="text-button" onClick={onClose}>Maybe later</button>}
          </div>
        )}
        {modal.kind === "rating" && <button type="button" className="button button-primary rating-done" onClick={onClose}>{rating ? "Thanks, human!" : "Maybe later"} <Heart size={16} fill={rating ? "currentColor" : "none"} /></button>}
        {isSuccess && <button type="button" className="text-button dialog-done" onClick={onClose}>All done</button>}
        {isSuccess && <div className="heart-confetti" aria-hidden="true"><span>♥</span><span>♥</span><span>♥</span><PawPrint /><span>♥</span></div>}
      </motion.section>
    </motion.div>
  );
}

function CookieBanner({ consent, onConsent }) {
  if (consent) return null;
  return (
    <aside className="cookie-banner" aria-label="Cookie preferences">
      <CatImage name="cookie" width={54} height={54} />
      <div className="cookie-copy"><strong>We use cookies. Treat?</strong><span>Optional analytics help us make Mochi a little better.</span></div>
      <div className="cookie-actions">
        <button className="button button-secondary" onClick={() => onConsent("declined")}>Decline</button>
        <button className="button button-primary" onClick={() => onConsent("accepted")}>Accept</button>
      </div>
    </aside>
  );
}

function PawTrail() {
  const [paws, setPaws] = useState([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(pointer: fine)").matches) return undefined;
    let last = 0;
    const onMove = (event) => {
      const now = performance.now();
      if (now - last < 120) return;
      last = now;
      const id = `${now}-${Math.random()}`;
      setPaws((current) => [...current.slice(-7), { id, x: event.clientX, y: event.clientY }]);
      window.setTimeout(() => setPaws((current) => current.filter((paw) => paw.id !== id)), 850);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return <div className="paw-trail" aria-hidden="true">{paws.map((paw) => <PawPrint key={paw.id} style={{ left: paw.x, top: paw.y }} />)}</div>;
}

function useAnalytics(consent) {
  useEffect(() => {
    const id = import.meta.env.VITE_GA_ID;
    if (!id || consent !== "accepted" || document.querySelector(`[data-ga-id="${id}"]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    script.dataset.gaId = id;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id);
  }, [consent]);
}

function Toast({ toast, onClose }) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className={`toast ${toast.type === "error" ? "toast-error" : ""}`}
          role="status"
          aria-live="polite"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        >
          {toast.image ? <CatImage name={toast.image} width={34} height={34} /> : toast.type === "error" ? <PawPrint size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={onClose}><X size={16} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Navbar({ darkMode, onToggleTheme, soundOn, onToggleSound, onWake }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="navbar">
      <div className="nav-inner container">
        <Logo onClick={() => setMenuOpen(false)} />
        <button className="mobile-menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <span className="hamburger"><i /><i /><i /></span>}
        </button>
        <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
          <a href="/#features" onClick={() => setMenuOpen(false)}>Features</a>
          <a href="/#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="/#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <button className={`sound-toggle ${soundOn ? "sound-enabled" : ""}`} onClick={() => { onToggleSound(); onWake(); }} aria-label={soundOn ? "Turn purr sound off" : "Turn purr sound on"} aria-pressed={soundOn}>
            <Volume2 size={17} /><span>Sound {soundOn ? "on" : "off"}</span>
          </button>
          <button className="theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`}>
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a className="nav-cta" href="/#converter" onClick={() => { setMenuOpen(false); onWake(); }}>Meet Mochi <PawPrint size={15} /></a>
        </nav>
      </div>
    </header>
  );
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index > 0 ? 1 : 0)} ${units[index]}`;
}

function getErrorMessage(error) {
  if (error?.name === "AbortError") return "This request took too long. Please try again.";
  if (!navigator.onLine) return "You appear to be offline. Check your connection and try again.";
  return error?.message || "Something went wrong. Please try again.";
}

function AdSlot() {
  const client = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  const slot = import.meta.env.VITE_ADSENSE_SLOT_ID;
  useEffect(() => {
    if (!client || !slot) return undefined;
    let active = true;
    const initializeAd = () => {
      const ad = document.querySelector(".adsbygoogle");
      if (!active || !ad || ad.dataset.initialized) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        ad.dataset.initialized = "true";
      } catch (error) {
        console.error("Could not initialize the AdSense slot.", error);
      }
    };
    let script = document.querySelector("[data-ads-script]");
    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      script.dataset.adsScript = "true";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      script.addEventListener("load", initializeAd, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", initializeAd, { once: true });
      initializeAd();
    }
    return () => { active = false; };
  }, [client, slot]);
  if (!client || !slot) return null;
  return <div className="ad-slot" aria-label="Advertisement"><ins className="adsbygoogle" style={{ display: "block" }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" /></div>;
}

function UploadPanel({ onToast, onHistory, onModal, onPet, onDownload, awake }) {
  const reducedMotion = useReducedMotion();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [ocr, setOcr] = useState(false);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);
  const requestRef = useRef(null);
  const deleteFiles = useCallback((index = null) => {
    onModal({
      kind: "delete",
      onConfirm: () => setFiles((current) => index === null ? [] : current.filter((_, fileIndex) => fileIndex !== index)),
    });
  }, [onModal]);

  const addFiles = useCallback((incoming) => {
    const next = Array.from(incoming || []);
    const invalid = next.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) {
      onModal({ kind: "wrongFile" });
      return;
    }
    const oversized = next.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      onModal({ kind: "tooBig" });
      return;
    }
    setFiles((current) => {
      const merged = [...current, ...next.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size))];
      if (merged.length > MAX_FILES) {
        onModal({ kind: "error", message: `You can convert up to ${MAX_FILES} files in one batch.` });
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
    setError("");
  }, [onModal]);

  const uploadFiles = useCallback(async () => {
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    setJob({ status: "uploading", state: "Uploading", progress: 0, outputs: [] });
    setUploadProgress(0);
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("ocr", String(ocr));
    form.append("password", password);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const jobResponse = await new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", `${API_URL}/api/jobs`);
        request.timeout = 120000;
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const value = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(value);
            setJob((current) => current ? { ...current, progress: value } : current);
          }
        };
        request.onload = () => {
          let data = {};
          try { data = JSON.parse(request.responseText); } catch { /* The API may return a non-JSON gateway error. */ }
          if (request.status >= 200 && request.status < 300) resolve(data);
          else reject(Object.assign(new Error(data.detail || "Upload failed. Please try again."), { status: request.status }));
        };
        request.onerror = () => reject(Object.assign(new Error("Could not reach the conversion service. Please check your connection."), { status: 0 }));
        request.ontimeout = () => reject(new Error("The upload timed out. Try a smaller batch or check your connection."));
        request.onabort = () => reject(new DOMException("Upload cancelled.", "AbortError"));
        controller.signal.addEventListener("abort", () => request.abort(), { once: true });
        request.send(form);
      });
      setJob({ id: jobResponse.id, status: "queued", state: "Analyzing", progress: 0, outputs: [] });
      onToast({ type: "success", image: "upload", message: "Got it! Mochi is sniffing your file..." });
    } catch (uploadError) {
      const message = getErrorMessage(uploadError);
      setError(message);
      const requestStatus = uploadError.status;
      onModal({
        kind: !navigator.onLine || requestStatus === 0 || requestStatus === 503 ? "offline" : requestStatus === 413 ? "tooBig" : requestStatus === 415 ? "wrongFile" : "error",
        message,
      });
      setBusy(false);
    }
  }, [busy, files, ocr, password, onToast, onModal]);

  const retryPassword = useCallback(async (passwordValue) => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/${job?.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ password: passwordValue }),
      });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.detail || "Could not retry this PDF."), { status: response.status });
      setJob((current) => ({ ...current, status: "queued", state: "Analyzing", progress: 0 }));
    } catch (retryError) {
      if (retryError.status === 503 || !navigator.onLine) onModal({ kind: "offline" });
      throw retryError;
    }
  }, [job?.id, onModal]);

  useEffect(() => {
    if (!job?.id || !["queued", "processing"].includes(job.status)) return undefined;
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/jobs/${job.id}`, { signal: requestRef.current?.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not check conversion status.");
        if (!active) return;
        setJob(data);
        if (data.status === "ready") {
          setBusy(false);
          const successful = data.outputs.filter((item) => !item.error);
          successful.forEach((item) => onHistory({ name: item.source_name, output: item.name, pages: item.pages, date: new Date().toISOString() }));
          onModal({ kind: "success", job: data });
        } else if (data.status === "failed") {
          setBusy(false);
          setError(data.error || "We couldn't convert that file. Please check that it opens correctly and try again.");
          onModal({ kind: "error", message: data.error });
        } else if (data.status === "password_required") {
          setBusy(false);
          onModal({ kind: "locked", onUnlock: retryPassword });
        } else {
          timer = window.setTimeout(poll, 1200);
        }
      } catch (pollError) {
        if (!active || pollError.name === "AbortError") return;
        setError(getErrorMessage(pollError));
        setBusy(false);
        onModal({ kind: !navigator.onLine ? "offline" : "error" });
      }
    };
    timer = window.setTimeout(poll, 500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [job?.id, job?.status, onHistory, onModal, retryPassword]);

  useEffect(() => {
    if (!job || !["queued", "processing"].includes(job.status)) return undefined;
    const timer = window.setInterval(() => setMessageIndex((index) => (index + 1) % 4), 2600);
    return () => window.clearInterval(timer);
  }, [job?.id, job?.status]);

  const reset = () => {
    setFiles([]);
    setJob(null);
    setError("");
    setBusy(false);
    setPassword("");
    setUploadProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const fileSize = (item) => formatBytes(item.size);
  const progress = job?.status === "queued" ? Math.max(uploadProgress, 100) : (job?.progress || 0);
  const convertingMessages = [
    "Mochi is chasing the pixels...",
    "Knocking text off the table...",
    "Kneading the tables...",
    "Almost there, just one more nap...",
  ];
  const mascotState = dragging || files.length
    ? "stretching"
    : job?.status === "ready"
      ? "success"
      : job
        ? "typing"
        : awake
          ? "welcome"
          : "sleeping";

  return (
    <section className={`upload-card ${dragging ? "card-dragging" : ""} ${files.length || job ? "card-awake" : ""}`} id="converter" aria-label="Mochi PDF to Word converter">
      <div className="card-glow" aria-hidden="true" />
      <div className={`card-ears ${dragging || files.length ? "ears-up" : ""}`} aria-hidden="true"><i /><i /></div>
      <div className={`resting-mochi ${mascotState === "sleeping" ? "mochi-sleeping" : "mochi-moving"}`}>
        <button type="button" className="mascot-pet-button" onClick={onPet} aria-label="Pet Mochi the kitten">
          <CatImage name={mascotState} className="card-mascot" width={150} height={150} loading="eager" fetchPriority="high" fallbackMood={mascotState === "sleeping" ? "happy" : "delighted"} />
          {mascotState === "sleeping" && <span className="sleep-z">Zzz</span>}
        </button>
      </div>
      <AnimatePresence>{!awake && !job && <motion.span className="idle-egg" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>Mochi's having a tiny nap...</motion.span>}</AnimatePresence>
      {job?.status === "ready" ? (
        <div className="results-view">
          <motion.div className="success-icon" initial={{ scale: 0.4, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 190, damping: 12 }}>
            <PawPrint size={30} />
          </motion.div>
          <p className="eyebrow success-eyebrow">Conversion complete</p>
          <h2>Your Word {job.outputs.filter((item) => !item.error).length === 1 ? "file is" : "files are"} ready</h2>
          <p className="results-subtitle">Your layout is ready to edit, share, and make your own.</p>
          <div className="result-list">
            {job.outputs.map((item, index) => (
              <div className={`result-row ${item.error ? "result-failed" : ""}`} key={`${item.name}-${index}`}>
                <span className="file-icon word-icon"><FileText size={20} /></span>
                <span className="result-file">
                  <strong>{item.name}</strong>
                  <small>{item.error ? item.error : `${formatBytes(item.size)} · ${item.pages} ${item.pages === 1 ? "page" : "pages"}`}</small>
                </span>
                {!item.error && <a className="result-download" href={`${API_URL}/api/jobs/${job.id}/download/${index}`} download aria-label={`Grab ${item.name}`} onClick={onDownload}><ArrowDown size={18} /></a>}
              </div>
            ))}
          </div>
          {job.outputs.filter((item) => !item.error).length > 1 && <a className="button button-primary zip-button" href={`${API_URL}/api/jobs/${job.id}/download-all`} download onClick={onDownload}><Files size={18} /> Download all as ZIP</a>}
          <button className="button button-secondary another-button" onClick={reset}>Another one, please! <ArrowRight size={17} /></button>
          <p className="privacy-note"><LockKeyhole size={14} /> Your files are deleted automatically after 1 hour.</p>
        </div>
      ) : (
        <>
          <div className="upload-card-heading">
            <div className="step-pill"><Sparkles size={13} /> YOUR WORKFLOW, SIMPLIFIED</div>
            <h2>{dragging || files.length ? "Drop it here, human!" : job ? "Mochi's on the job!" : "Drop your PDF here"}</h2>
            <p>{job ? "A little typing, a little tail-wagging, almost done." : "Drop your file and Mochi will do the typing for you."}</p>
          </div>
          {!job && (
            <div
              className={`drop-zone ${dragging ? "drag-active" : ""} ${files.length ? "has-files" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
              onClick={() => { if (!files.length) inputRef.current?.click(); }}
              onKeyDown={(event) => { if (!files.length && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }}
              role={files.length ? undefined : "button"}
              tabIndex={files.length ? undefined : 0}
              aria-label={files.length ? undefined : "Choose PDF files or drag and drop them here"}
              aria-describedby={!files.length ? "upload-requirements" : undefined}
            >
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} aria-label="Select PDF files" />
              {files.length ? (
                <div className="selected-files" onClick={(event) => event.stopPropagation()}>
                  <div className="selected-files-heading">
                    <span><Files size={17} /> {files.length} {files.length === 1 ? "file" : "files"} selected</span>
                    <button className="text-button" onClick={() => deleteFiles()}>Remove all</button>
                  </div>
                  {files.map((file, index) => (
                    <div className="selected-file" key={`${file.name}-${index}`}>
                      <span className="file-icon pdf-icon"><FileText size={18} /></span>
                      <span className="selected-name"><strong>{file.name}</strong><small>{fileSize(file)}</small></span>
                      <button className="icon-button" aria-label={`Remove ${file.name}`} onClick={() => deleteFiles(index)}><X size={16} /></button>
                    </div>
                  ))}
                  <button className="add-more" onClick={() => inputRef.current?.click()}><Upload size={15} /> Add more PDFs</button>
                </div>
              ) : (
                <>
                  <motion.div className="upload-icon-wrap" animate={reducedMotion ? { y: 0 } : { y: dragging ? -5 : [0, -4, 0] }} transition={reducedMotion ? { duration: 0 } : dragging ? { duration: 0.2 } : { duration: 2.3, repeat: Infinity, ease: "easeInOut" }}>
                    <CloudUpload size={30} strokeWidth={1.8} />
                  </motion.div>
                  <strong className="drop-title">{dragging ? "Drop it here, human!" : "Drag & drop your PDF files"}</strong>
                  <span className="drop-or">or</span>
                  <span className="button button-primary browse-button">Choose files <ArrowRight size={16} /></span>
                  <span id="upload-requirements" className="drop-hint">PDF files only · Up to 50 MB each · 10 files max</span>
                </>
              )}
            </div>
          )}
          {job && (
            <div className="progress-area" aria-live="polite">
              <div className="progress-file-list">
                {files.map((file, index) => <div className="progress-file" key={`${file.name}-${index}`}><span className="file-icon pdf-icon"><FileText size={17} /></span><span>{file.name}</span></div>)}
              </div>
              <div className="progress-steps">
                {["Uploading", "Analyzing", "Converting", "Ready"].map((step, index) => {
                  const stepIndex = ["Uploading", "Analyzing", "Converting", "Ready"].indexOf(job.state);
                  const current = job.state === step;
                  return <div className={`progress-step ${index < stepIndex ? "step-done" : ""} ${current ? "step-current" : ""}`} key={step}><span className="step-dot">{index < stepIndex ? <Check size={12} /> : index + 1}</span><span>{step}</span></div>;
                })}
              </div>
              <div className="progress-with-mochi">
                <CatImage name="typing" className="typing-mochi" width={78} height={78} loading="eager" />
                <div className="progress-copy">
                  <p className="conversion-caption" aria-live="polite">{convertingMessages[messageIndex]}</p>
                  <div className="progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label={`${job.state} progress`}>
                    <motion.div className="progress-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
                  </div>
                </div>
              </div>
              <div className="progress-caption"><span>{job.state} your file{files.length > 1 ? "s" : ""}…</span><strong>{progress}%</strong></div>
            </div>
          )}
          {files.length > 0 && !job && <div className="upload-options">
            <label className="toggle-option">
              <input type="checkbox" checked={ocr} onChange={(event) => setOcr(event.target.checked)} />
              <span className="custom-checkbox"><Check size={12} /></span>
              <span><strong>Scanned document? Enable OCR</strong><small>Recognize text in scanned pages</small></span>
            </label>
            <label className="password-option" htmlFor="pdf-password">
              <LockKeyhole size={15} />
              <input id="pdf-password" type="password" autoComplete="off" maxLength={256} placeholder="Password (if protected)" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          </div>}
          {!job && <button className="button button-primary convert-button" disabled={!files.length || busy} onClick={uploadFiles}>
            {busy ? "Mochi is sniffing..." : "Purr-form Magic"}
            {!busy && <PawPrint size={18} />}
          </button>}
          {error && <p className="inline-error" role="alert">{error}</p>}
          {job && job.status !== "password_required" && !busy && (
            <button className="text-button cancel-button" onClick={() => { setJob(null); setError(""); }}>
              {job.status === "uploading" ? "Retry upload" : "Choose another file"}
            </button>
          )}
          <p className="privacy-note"><LockKeyhole size={14} /> Your files are deleted automatically after 1 hour.</p>
        </>
      )}
    </section>
  );
}

const features = [
  { icon: <WandSparkles />, title: "Layout that stays true", text: "Keep the structure, tables, images, and flow of your original PDF." },
  { icon: <ScanIcon />, title: "Scans become editable", text: "Optional OCR turns scanned pages into text you can actually work with." },
  { icon: <ShieldCheck />, title: "Private by design", text: "Encrypted in transit and automatically removed after one hour." },
  { icon: <Zap />, title: "A few clicks. That’s it.", text: "No software to install, and no account or credit card required." },
  { icon: <Files />, title: "Batch without the busywork", text: "Convert up to ten documents together, then download them in one ZIP." },
  { icon: <Globe2 />, title: "Ready when you are", text: "Works in your browser on desktop, tablet, and mobile." },
];

function ScanIcon(props) {
  return <FileCheck2 {...props} />;
}

const faqs = [
  ["How accurate is PDF to Word conversion?", "Mochi Converter preserves text, images, tables, and page structure as closely as possible. PDFs are designed for fixed layouts, so complex designs may need a small amount of adjustment in Word."],
  ["Can I convert a scanned PDF?", "Yes. Turn on “Scanned document? Enable OCR” before converting. OCR recognizes text in scanned pages so the resulting Word document is editable. Recognition quality depends on scan clarity and language."],
  ["Is there a file size limit?", "Each PDF can be up to 50 MB, and you can convert up to 10 files in one batch."],
  ["What happens to my files?", "Your uploaded PDFs and converted documents are stored temporarily to complete your job and are automatically deleted after one hour."],
  ["Can I convert a password-protected PDF?", "Yes. Enter the PDF password in the password field before converting, or enter it when prompted after analysis."],
  ["Do I need to install anything?", "No. Mochi Converter runs in your browser. The conversion happens on our secure server, so there’s nothing to download or install."],
];

function HomePage({ onToast, history, onHistory, onModal, onPet, onDownload, awake }) {
  usePageMeta("Mochi Converter: Convert PDF to Word Free", "Mochi Converter turns your PDF into an editable Word file in seconds. Free, private, and cute.");
  return (
    <main>
      <section className="hero-section">
        <div className="hero-mesh mesh-one" aria-hidden="true" /><div className="hero-mesh mesh-two" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="hero-badge"><span className="badge-dot" /> MEET YOUR NEW FAVORITE LITTLE HELPER</div>
            <h1>Turn your PDF into Word.<br /><span>Soft, sweet, and instant.</span></h1>
            <p className="hero-description">Drop your file and Mochi will do the typing for you.</p>
            <div className="hero-proof">
              <span className="hero-mochi-mark"><PawPrint size={17} fill="currentColor" /></span>
              <span><strong>Free to use · No account needed</strong><small>Your files stay yours, human.</small></span>
            </div>
            <div className="hero-trust"><span><PawPrint size={15} /> No signup needed</span><span><PawPrint size={15} /> Files vanish in 1 hour (like a cat in a cardboard box)</span><span><PawPrint size={15} /> Works on any device</span></div>
          </div>
          <div className="converter-column">
            <UploadPanel onToast={onToast} onHistory={onHistory} onModal={onModal} onPet={onPet} onDownload={onDownload} awake={awake} />
            <div className="supported-files"><span>Works beautifully with</span><i>Reports</i><i>Contracts</i><i>Scanned docs</i></div>
          </div>
        </div>
        <div className="container hero-bottom">
          <div className="format-flow"><span className="file-icon pdf-icon"><FileText size={18} /></span><strong>PDF</strong><span className="flow-line" /><span className="flow-spark"><PawPrint size={14} /></span><span className="flow-line" /><span className="file-icon word-icon"><FileText size={18} /></span><strong>Word</strong></div>
          <a className="scroll-cue" href="#how-it-works">See how it works <ArrowDown size={14} /></a>
        </div>
      </section>

      <section className="trust-strip" aria-label="Service benefits">
        <div className="container trust-inner"><span><PawPrint size={16} /> No signup needed</span><span><PawPrint size={16} /> Files vanish in 1 hour (like a cat in a cardboard box)</span><span><PawPrint size={16} /> Works on any device</span></div>
      </section>

      <section className="section how-section" id="how-it-works">
        <div className="container">
          <div className="section-heading"><span className="eyebrow">THREE STEPS. ZERO DRAMA.</span><h2>From PDF to polished<br className="desktop-break" /> Word doc, just like that.</h2><p>No complicated tools. No waiting around. Just a better way to get work done.</p></div>
          <div className="steps-grid">
            {[
              { no: "01", icon: <CloudUpload />, title: "Drop in your PDF", body: "Choose one PDF or a whole batch. Your files stay private from the start." },
              { no: "02", icon: <Sparkles />, title: "We do the heavy lifting", body: "We map your layout, text, and images into a Word-ready document." },
              { no: "03", icon: <FileCheck2 />, title: "Download & get on with it", body: "Grab your editable .docx and make it your own. That’s the whole thing." },
            ].map((step) => <article className="step-card" key={step.no}><span className="step-number">{step.no}</span><div className="step-icon">{step.icon}</div><h3>{step.title}</h3><p>{step.body}</p></article>)}
          </div>
        </div>
      </section>

      <section className="section features-section" id="features">
        <div className="container">
          <div className="section-heading"><span className="eyebrow">A LITTLE MORE THOUGHTFUL</span><h2>Small details.<br className="desktop-break" /> Big difference.</h2><p>All the practical stuff you need, without the things you don’t.</p></div>
          <div className="features-grid">{features.map((feature) => <article className="feature-card" key={feature.title}><div className="feature-icon">{feature.icon}</div><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div>
        </div>
      </section>

      <section className="why-section">
        <div className="container why-grid">
          <div className="why-copy"><span className="eyebrow">YOUR DOCUMENTS DESERVE BETTER</span><h2>Built to be quick.<br /><span>Designed to be trusted.</span></h2><p>Useful tools should just work. We keep the process simple, the conversion engine powerful, and your files on a short leash.</p><a className="text-link" href="/#converter">Try it for free <ArrowRight size={16} /></a></div>
          <div className="why-cards">
            <article><span className="why-icon purple"><ShieldCheck /></span><div><h3>Your files are yours</h3><p>We use secure connections and automatically delete files after one hour.</p></div></article>
            <article><span className="why-icon blue"><Zap /></span><div><h3>Less waiting, more doing</h3><p>Background processing keeps things moving, even for bigger batches.</p></div></article>
            <article><span className="why-icon mint"><FileCheck2 /></span><div><h3>More than plain text</h3><p>We work to preserve the layout, tables, and images that make your doc yours.</p></div></article>
          </div>
        </div>
      </section>

      <section className="section testimonials-section">
        <div className="container">
          <div className="section-heading"><span className="eyebrow">MADE FOR EVERYDAY WORK</span><h2>One less thing on your list.</h2><p>From the quick one-off to the Friday-afternoon batch, get your documents moving.</p></div>
          <div className="testimonials-grid">
            {[
              ["For busy teams", "Convert a whole batch of reports together and get back to the work that needs you."],
              ["For independent pros", "Turn contracts and client PDFs into editable documents without another app to install."],
              ["For the occasional task", "No account, no setup, no fuss. Upload a PDF, download your Word file, and move on."],
            ].map(([title, text]) => <article className="testimonial-card use-case-card" key={title}><div className="use-case-icon"><CheckCircle2 size={17} /></div><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
      </section>

      {history.length > 0 && <section className="history-section"><div className="container history-box"><div><span className="eyebrow">THIS SESSION</span><h2>Your recent conversions</h2></div><div className="history-list">{history.slice(0, 3).map((item, index) => <div className="history-item" key={`${item.name}-${index}`}><FileCheck2 size={18} /><span><strong>{item.name}</strong><small>{item.pages} {item.pages === 1 ? "page" : "pages"} · {new Date(item.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span></div>)}</div></div></section>}

      <section className="section faq-section" id="faq">
        <div className="container faq-layout">
          <div className="faq-heading"><span className="eyebrow">GOOD QUESTIONS</span><h2>Wondering about<br className="desktop-break" /> something?</h2><p>Here are the things people usually want to know.</p><a className="text-link" href="/contact">Talk to a human <ArrowRight size={16} /></a></div>
          <div className="faq-list">{faqs.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}<ChevronDown size={19} /></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>
      <AdSlot />
      <section className="bottom-cta"><div className="container"><div><span className="eyebrow">YOUR NEXT EDIT STARTS HERE</span><h2>Ready to make that PDF yours?</h2></div><a href="/#converter" className="button button-light">Purr-form Magic <PawPrint size={17} /></a></div></section>
    </main>
  );
}

function InfoPage({ kind }) {
  const content = {
    privacy: {
      title: "Privacy, without the fine print.",
      description: "We built Mochi Converter to make your work easier, not to collect your documents.",
      sections: [
        ["The files you convert", "Your PDFs and generated Word files are processed only to provide the conversion you requested. Files are stored temporarily and automatically deleted within one hour. We do not sell your documents or use their contents for advertising."],
        ["Information we collect", "The service processes technical information needed to deliver and protect the conversion service, such as request time, job status, and basic server logs. If optional analytics are enabled, aggregated website usage may be collected according to your browser settings."],
        ["Security", "Uploads and downloads should be served over HTTPS in production. Access to converted files is limited to unguessable job identifiers and the files are held only for a short period."],
        ["Your choices", "You can choose not to use OCR and can avoid uploading documents containing information you do not wish to process. For privacy questions, contact privacy@mochiconverter.com."],
        ["Changes", "We may update this policy as the service changes. Any update will be posted on this page with a revised effective date."],
      ],
    },
    terms: {
      title: "A few ground rules.",
      description: "Simple, fair terms for using Mochi Converter.",
      sections: [
        ["Using the service", "You may use Mochi Converter to convert documents you own or are authorized to process. You are responsible for ensuring that your use complies with applicable law and the rights of others."],
        ["Conversion results", "Mochi Converter provides document conversion on an as-available basis. PDF layouts vary, so converted documents may need manual formatting adjustments. We cannot guarantee perfect conversion for every file."],
        ["Your documents", "You retain your rights to uploaded documents and conversion results. You grant us limited permission to process files only as needed to provide this service."],
        ["Acceptable use", "Do not use the service to upload malware, interfere with its operation, bypass security controls, or violate another person’s rights. We may limit access to protect the service and its users."],
        ["Service changes", "We may change or discontinue features to maintain and improve the service. These terms may also be updated; continued use after an update means you accept the revised terms."],
      ],
    },
    contact: {
      title: "We’re all ears.",
      description: "Something not working as it should? Have an idea that could make this better? We’d love to hear it.",
      sections: [
        ["Email us", "For help with a conversion or a general question, email hello@mochiconverter.com. Please don’t attach sensitive documents to your message."],
        ["For privacy questions", "Questions about how we handle files or privacy requests? Write to privacy@mochiconverter.com."],
        ["A little context helps", "If you’re reporting a problem, include your browser, roughly when it happened, and the error message you saw. Never send us your PDF password."],
      ],
    },
  }[kind];
  usePageMeta(`${kind[0].toUpperCase()}${kind.slice(1)} — Mochi Converter`, content.description);
  return <main className="info-page"><div className="container info-content"><Link to="/" className="back-link">← Back to Mochi Converter</Link><span className="eyebrow">MOCHI CONVERTER · {kind.toUpperCase()}</span><h1>{content.title}</h1><p className="info-lead">{content.description}</p><p className="effective-date">Effective date: November 6, 2026</p>{content.sections.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}</div></main>;
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand"><Logo /><p>Soft, sweet Word files, in a paw-sec.</p><div className="footer-private"><ShieldCheck size={16} /> Your files are deleted after 1 hour</div></div>
          <div className="footer-column"><strong>Explore</strong><a href="/#features">Features</a><a href="/#how-it-works">How it works</a><a href="/#faq">FAQ</a></div>
          <div className="footer-column"><strong>Good to know</strong><Link to="/privacy">Privacy policy</Link><Link to="/terms">Terms of service</Link><Link to="/contact">Contact us</Link></div>
        </div>
        <div className="footer-bottom"><span>Made with love and a lot of cat hair. © {new Date().getFullYear()} Mochi Converter.</span><span>Soft, sweet Word files, in a paw-sec. <PawPrint size={13} /></span></div>
      </div>
    </footer>
  );
}

function NotFoundPage() {
  usePageMeta("404 — Mochi Converter", "This page ran away. Let's go home.");
  return (
    <main className="not-found-page">
      <CatImage name="404" className="not-found-mochi" width={320} height={320} loading="eager" />
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>This page ran away.<br />Let's go home.</h1>
      <Link to="/" className="button button-primary">Back to home <PawPrint size={17} /></Link>
    </main>
  );
}

export default function App() {
  const [toast, setToast] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("mochi-theme") === "dark");
  const [soundOn, setSoundOn] = useState(false);
  const [history, setHistory] = useState([]);
  const [modal, setModal] = useState(null);
  const [awake, setAwake] = useState(false);
  const [petBubble, setPetBubble] = useState(false);
  const [petLine, setPetLine] = useState(2);
  const [consent, setConsent] = useState(() => localStorage.getItem("mochi-cookie-consent") || "");
  const location = useLocation();
  const showToast = useCallback((value) => setToast(value), []);
  const closeModal = useCallback(() => setModal(null), []);
  const addHistory = useCallback((item) => setHistory((current) => [item, ...current.filter((entry) => entry.name !== item.name)].slice(0, 3)), []);
  const openRating = useCallback(() => setModal({ kind: "rating" }), []);
  useAnalytics(consent);

  const wakeMochi = useCallback(() => {
    setAwake(true);
  }, []);

  useEffect(() => {
    let timer;
    const wake = () => {
      setAwake(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAwake(false), 30000);
    };
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake);
    timer = window.setTimeout(() => setAwake(false), 30000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  useEffect(() => {
    if (localStorage.getItem("mochi-welcome-seen")) return;
    localStorage.setItem("mochi-welcome-seen", "true");
    setModal({ kind: "welcome" });
  }, []);

  const petMochi = useCallback(() => {
    wakeMochi();
    setPetLine((line) => (line + 1) % 3);
    setPetBubble(true);
    window.setTimeout(() => setPetBubble(false), 2600);
    if (soundOn && window.AudioContext) {
      const context = new window.AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(54, context.currentTime);
      oscillator.frequency.linearRampToValueAtTime(68, context.currentTime + 0.18);
      oscillator.frequency.linearRampToValueAtTime(52, context.currentTime + 0.42);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.48);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.5);
      oscillator.addEventListener("ended", () => context.close(), { once: true });
    }
  }, [soundOn, wakeMochi]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("mochi-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  useEffect(() => {
    if (location.hash) window.setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 80);
    else window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return (
    <div className="app-shell">
      <Navbar
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((value) => !value)}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((value) => !value)}
        onWake={wakeMochi}
      />
      <Routes>
        <Route path="/" element={<HomePage onToast={showToast} history={history} onHistory={addHistory} onModal={setModal} onPet={petMochi} onDownload={openRating} awake={awake} />} />
        <Route path="/privacy" element={<InfoPage kind="privacy" />} />
        <Route path="/terms" element={<InfoPage kind="terms" />} />
        <Route path="/contact" element={<InfoPage kind="contact" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
      <AnimatePresence>{toast && <Toast toast={toast} onClose={() => setToast(null)} />}</AnimatePresence>
      <AnimatePresence>{modal && <AppDialog modal={modal} onClose={closeModal} onDownload={openRating} />}</AnimatePresence>
      <CookieBanner
        consent={consent}
        onConsent={(value) => {
          localStorage.setItem("mochi-cookie-consent", value);
          setConsent(value);
        }}
      />
      <PawTrail />
      {petBubble && <motion.div className="pet-speech" initial={{ opacity: 0, scale: 0.8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}><Heart size={13} fill="currentColor" />{["Mrrp!", "Pet me again?", "I'm working on it!"][petLine]}</motion.div>}
    </div>
  );
}
