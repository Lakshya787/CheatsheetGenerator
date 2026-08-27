"use client";

import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppState = "idle" | "running" | "done" | "error";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Icons (inline SVG to avoid extra deps)
// ---------------------------------------------------------------------------

const IconBolt = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconDownload = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconCopy = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconRefresh = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

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
          {copied ? <IconCheck /> : <IconCopy />}
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
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: "rgba(10,10,15,0.85)",
          backdropFilter: "blur(12px)",
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #7c6ef7, #a78bfa)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconBolt />
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: "1rem",
              color: "#fff",
              letterSpacing: "-0.01em",
            }}
          >
            CheatSheet
            <span style={{ color: "var(--accent)" }}>.ai</span>
          </span>
        </div>

        {hasOutput && (
          <button
            onClick={handleReset}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "6px 14px",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text)";
              e.currentTarget.style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <IconRefresh />
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
                gap: "6px",
                background: "var(--accent-glow)",
                border: "1px solid #7c6ef750",
                borderRadius: "20px",
                padding: "5px 14px",
                fontSize: "0.78rem",
                color: "var(--accent-hover)",
                marginBottom: "24px",
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent-hover)",
                }}
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
                color: "#fff",
              }}
            >
              Paste a doc link.
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #7c6ef7 0%, #c084fc 50%, #818cf8 100%)",
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
                color: "var(--text-muted)",
                maxWidth: "480px",
                margin: "0 auto 40px",
                lineHeight: 1.6,
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
                      ? "linear-gradient(135deg, #7c6ef7 0%, #9b74f5 100%)"
                      : "var(--surface-2)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "10px 22px",
                  color: url.trim() ? "#fff" : "var(--text-muted)",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: url.trim() ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.15s",
                  boxShadow: url.trim()
                    ? "0 2px 12px rgba(124,110,247,0.4)"
                    : "none",
                }}
              >
                <IconBolt />
                Generate
              </button>
            )}
          </div>

          {/* Example hint */}
          {!hasOutput && !isRunning && (
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                marginTop: "12px",
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
                    color: "var(--accent-hover)",
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
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
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
                <IconRefresh />
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
                  <span style={{ fontSize: "1.1rem" }}>✅</span>
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
                    <IconDownload />
                    Download .md
                  </button>

                  {/* PDF — placeholder for user to implement */}
                  <button
                    title="PDF export — coming soon (implement in backend/generator.py)"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      background: "linear-gradient(135deg, #7c6ef7, #9b74f5)",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      color: "#fff",
                      cursor: "not-allowed",
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      fontFamily: "inherit",
                      opacity: 0.5,
                    }}
                  >
                    <IconDownload />
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
                  icon: "🕷️",
                  title: "Smart Crawl",
                  desc: "Discovers up to 30 doc pages automatically",
                },
                {
                  icon: "✂️",
                  title: "Clean Extract",
                  desc: "Strips nav, ads & boilerplate",
                },
                {
                  icon: "⚡",
                  title: "Live Stream",
                  desc: "Cheat sheet renders as it's generated",
                },
                {
                  icon: "💾",
                  title: "Download",
                  desc: "Export as Markdown instantly",
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
                  <div style={{ fontSize: "1.4rem", marginBottom: "8px" }}>
                    {f.icon}
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
          borderTop: "1px solid var(--border)",
          padding: "16px 24px",
          textAlign: "center",
          fontSize: "0.78rem",
          color: "var(--text-muted)",
        }}
      >
        Built by{" "}
        <a
          href="https://github.com/Lakshya787"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent-hover)", textDecoration: "none" }}
        >
          Lakshya
        </a>{" "}
        · Crawl → Extract → Generate · No auth, no DB, no BS.
      </footer>
    </div>
  );
}
