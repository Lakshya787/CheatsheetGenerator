"use client";

import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  Zap,
  Download,
  FileDown,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Scissors,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppState = "idle" | "running" | "done" | "error";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "https://cheatsheetgenerator.onrender.com"
).replace(/\/+$/, "");



// ---------------------------------------------------------------------------
// Code block component (copy-to-clipboard)
// ---------------------------------------------------------------------------

function CodeBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const copy = useCallback(() => {
    const text = codeRef.current?.textContent ?? "";
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid #2a2a3a",
        borderRadius: "10px",
        margin: "1rem 0",
        overflow: "hidden",
      }}
    >
      {/* Code block header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "#161b22",
          borderBottom: "1px solid #2a2a3a",
        }}
      >
        <div style={{ display: "flex", gap: "6px" }}>
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#ff5f57",
              display: "block",
            }}
          />
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#febc2e",
              display: "block",
            }}
          />
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#28c840",
              display: "block",
            }}
          />
        </div>
        <button
          onClick={copy}
          title="Copy code"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "transparent",
            border: "1px solid #2a2a3a",
            borderRadius: "6px",
            padding: "3px 10px",
            color: copied ? "#4ade80" : "#8888a0",
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Actual code */}
      <div style={{ padding: "16px", overflowX: "auto" }}>
        <code
          ref={codeRef}
          className={className}
          style={{
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: "0.85rem",
            lineHeight: 1.7,
          }}
        >
          {children}
        </code>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

function StatusPill({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "#1a1a24",
        border: "1px solid #2a2a3a",
        borderRadius: "24px",
        padding: "10px 18px",
        fontSize: "0.875rem",
        color: "#c8c8d8",
        marginBottom: "20px",
      }}
      className="fade-in"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#7c6ef7",
          flexShrink: 0,
        }}
        className="dot-pulse"
      />
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<AppState>("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // ---- Generate --------------------------------------------------------

  const handleGenerate = useCallback(async () => {
    if (!url.trim()) return;

    // Reset
    setMarkdown("");
    setError("");
    setStatusMsg("Connecting…");
    setState("running");
    setIsStreaming(false);

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`${BACKEND_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;

          try {
            const event = JSON.parse(raw);
            switch (event.type) {
              case "status":
                setStatusMsg(event.message);
                break;
              case "token":
                setIsStreaming(true);
                setMarkdown((prev) => prev + event.token);
                // Scroll to bottom smoothly
                setTimeout(() => {
                  outputRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "end",
                  });
                }, 50);
                break;
              case "done":
                setState("done");
                setIsStreaming(false);
                setStatusMsg("");
                break;
              case "error":
                setError(event.message);
                setState("error");
                setIsStreaming(false);
                break;
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setState("error");
      setIsStreaming(false);
    }
  }, [url]);

  // ---- Stop ------------------------------------------------------------

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
    setStatusMsg("");
    setIsStreaming(false);
  }, []);

  // ---- Reset -----------------------------------------------------------

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
    setMarkdown("");
    setError("");
    setStatusMsg("");
    setIsStreaming(false);
    setUrl("");
  }, []);

  // ---- Download Markdown ------------------------------------------------

  const handleDownloadMarkdown = useCallback(() => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "cheatsheet.md";
    a.click();
    URL.revokeObjectURL(href);
  }, [markdown]);

  // ---- Download PDF ----------------------------------------------------

  const handleDownloadPDF = useCallback(async () => {
    if (!markdown) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/download/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "cheatsheet.pdf";
      a.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      console.error("PDF download failed:", err);
    }
  }, [markdown]);


  // ---- Key handler -----------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && state === "idle") handleGenerate();
    },
    [state, handleGenerate]
  );

  const isRunning = state === "running";
  const isDone = state === "done";
  const hasOutput = markdown.length > 0;

  // ---- Render ----------------------------------------------------------

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav
        style={{
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          padding: "0 24px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: "rgba(64, 242, 221, 0.88)",
          backdropFilter: "blur(12px)",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src="/cheaticon.png"
            alt="CheatSheet.ai logo"
            style={{ width: 32, height: 32, borderRadius: "8px" }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: "1rem",
              color: "#0a0a0f",
              letterSpacing: "-0.01em",
            }}
          >
            CheatSheet
            <span style={{ color: "#006663" }}>.ai</span>
          </span>
        </div>

        {hasOutput && (
          <button
            onClick={handleReset}
            style={{
              background: "rgba(0,0,0,0.06)",
              border: "1px solid rgba(0,0,0,0.15)",
              borderRadius: "8px",
              padding: "6px 14px",
              color: "#0a0a0f",
              cursor: "pointer",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.06)";
            }}
          >
            <RotateCcw size={14} />
            Start over
          </button>
        )}
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: hasOutput ? "32px 24px 0" : "72px 24px 48px",
          textAlign: "center",
          transition: "padding 0.4s ease",
        }}
      >
        {!hasOutput && (
          <>
            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(0, 0, 0, 0.08)",
                border: "1px solid rgba(0, 0, 0, 0.12)",
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "0.78rem",
                color: "#0a0a0f",
                marginBottom: "24px",
                fontWeight: 600,
              }}
            >
              <img
                src="/cheaticon.png"
                alt=""
                style={{ width: 16, height: 16, borderRadius: "4px" }}
              />
              AI-Powered Documentation Summarizer
            </div>

            {/* Headline */}
            <h1
              style={{
                fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                margin: "0 0 16px",
                color: "#0a0a0f",
              }}
            >
              Paste a doc link.
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #09090b 0%, #0369a1 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Get a cheat sheet.
              </span>
            </h1>

            <p
              style={{
                fontSize: "1.05rem",
                color: "#1e293b",
                maxWidth: "480px",
                margin: "0 auto 40px",
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              Drop any documentation URL. We crawl, extract, and generate a
              clean structured cheat sheet — streamed live.
            </p>
          </>
        )}

        {/* ── Input card ─────────────────────────────────────────────── */}
        <div
          style={{
            maxWidth: "680px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "10px",
              background: "var(--surface)",
              border: `1px solid ${isRunning ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "14px",
              padding: "6px",
              transition: "border-color 0.2s",
              boxShadow: isRunning
                ? "0 0 0 3px var(--accent-glow)"
                : "0 4px 24px rgba(0,0,0,0.4)",
            }}
          >
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://go.dev/doc/"
              disabled={isRunning}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text)",
                fontSize: "0.95rem",
                padding: "10px 14px",
                fontFamily: "inherit",
                caretColor: "var(--accent)",
              }}
            />
            {isRunning ? (
              <button
                onClick={handleStop}
                style={{
                  background: "#2a1a1a",
                  border: "1px solid #f87171",
                  borderRadius: "10px",
                  padding: "10px 20px",
                  color: "#f87171",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                }}
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!url.trim()}
                style={{
                  background:
                    url.trim()
                      ? "linear-gradient(135deg, #40f2dd 0%, #1cd4bd 100%)"
                      : "var(--surface-2)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 22px",
                  color: url.trim() ? "#0a0a0f" : "var(--text-muted)",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: url.trim() ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.15s",
                  boxShadow: url.trim()
                    ? "0 2px 14px rgba(64,242,221,0.5)"
                    : "none",
                }}
              >
                <Zap size={16} />
                Generate
              </button>
            )}
          </div>

          {/* Example hint */}
          {!hasOutput && !isRunning && (
            <p
              style={{
                fontSize: "0.78rem",
                color: "#1e293b",
                marginTop: "12px",
                fontWeight: 500,
              }}
            >
              Try:{" "}
              {[
                "https://go.dev/doc/",
                "https://docs.python.org/3/",
                "https://react.dev/learn",
              ].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setUrl(ex)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0a0a0f",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.78rem",
                    fontFamily: "inherit",
                    padding: "0 4px",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  }}
                >
                  {ex}
                </button>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          maxWidth: "860px",
          width: "100%",
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
      >
        {/* Status */}
        {isRunning && statusMsg && !isStreaming && (
          <div style={{ marginTop: "32px" }}>
            <StatusPill message={statusMsg} />
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div
            className="fade-in"
            style={{
              marginTop: "32px",
              background: "#1a0f0f",
              border: "1px solid #f87171",
              borderRadius: "12px",
              padding: "20px 24px",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
            }}
          >
            <AlertTriangle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <p
                style={{
                  margin: "0 0 8px",
                  color: "#f87171",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
              >
                Something went wrong
              </p>
              <p
                style={{
                  margin: "0 0 14px",
                  color: "var(--text-muted)",
                  fontSize: "0.875rem",
                }}
              >
                {error}
              </p>
              <button
                onClick={handleReset}
                style={{
                  background: "transparent",
                  border: "1px solid #f87171",
                  borderRadius: "8px",
                  padding: "6px 14px",
                  color: "#f87171",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RotateCcw size={14} />
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── Cheatsheet output ─────────────────────────────────────── */}
        {hasOutput && (
          <div style={{ marginTop: "40px" }} className="fade-in">
            {/* Download bar */}
            {isDone && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "14px 20px",
                  marginBottom: "28px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
                className="fade-in"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <CheckCircle2 size={18} color="var(--green)" style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      color: "var(--green)",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    Cheat sheet ready
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={handleDownloadMarkdown}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      color: "var(--text)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                      e.currentTarget.style.color = "var(--accent-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.color = "var(--text)";
                    }}
                  >
                    <Download size={14} />
                    Download .md
                  </button>

                  {/* PDF download */}
                  <button
                    onClick={handleDownloadPDF}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      background: "linear-gradient(135deg, #40f2dd, #14b8a6)",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      color: "#0a0a0f",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      fontFamily: "inherit",
                      boxShadow: "0 2px 12px rgba(64,242,221,0.4)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.85";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    <FileDown size={14} />
                    Download PDF
                  </button>

                </div>
              </div>
            )}

            {/* Status while streaming */}
            {isRunning && isStreaming && statusMsg && (
              <div style={{ marginBottom: "12px" }}>
                <StatusPill message="Generating…" />
              </div>
            )}

            {/* Markdown output */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "36px 40px",
              }}
            >
              <div
                className={`prose ${isStreaming ? "cursor-blink" : ""}`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeHighlight]}
                  components={{
                    // Custom code block with copy button
                    pre({ children }) {
                      return <>{children}</>;
                    },
                    code({ className, children, ...props }) {
                      const isBlock = className?.startsWith("language-");
                      if (isBlock) {
                        return (
                          <CodeBlock className={className}>
                            {children}
                          </CodeBlock>
                        );
                      }
                      // Inline code — default styling from globals.css
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            </div>

            {/* Scroll anchor */}
            <div ref={outputRef} style={{ height: "1px" }} />
          </div>
        )}

        {/* ── Empty state (idle, no output) ────────────────────────── */}
        {!hasOutput && !isRunning && state !== "error" && (
          <div
            style={{
              marginTop: "60px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "20px",
            }}
          >
            {/* Feature cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                maxWidth: "640px",
                width: "100%",
                marginTop: "8px",
              }}
            >
              {[
                {
                  icon: Globe,
                  title: "Smart Crawl",
                  desc: "Discovers up to 30 doc pages automatically",
                },
                {
                  icon: Scissors,
                  title: "Clean Extract",
                  desc: "Strips nav, ads & boilerplate",
                },
                {
                  icon: Zap,
                  title: "Live Stream",
                  desc: "Cheat sheet renders as it's generated",
                },
                {
                  icon: FileDown,
                  title: "Download",
                  desc: "Export as Markdown or PDF instantly",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "18px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      color: "var(--accent)",
                      marginBottom: "10px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <f.icon size={22} />
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "#fff",
                      marginBottom: "4px",
                    }}
                  >
                    {f.title}
                  </div>
                  <div
                    style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}
                  >
                    {f.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid rgba(0,0,0,0.08)",
          padding: "16px 24px",
          textAlign: "center",
          fontSize: "0.78rem",
          color: "#0a0a0f",
          fontWeight: 500,
        }}
      >
        Built by{" "}
        <a
          href="https://github.com/Lakshya787"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#000", fontWeight: 700, textDecoration: "underline" }}
        >
          Lakshya
        </a>{" "}
        · Crawl → Extract → Generate · No auth, no DB, no BS.
      </footer>
    </div>
  );
}
