"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY_CODE = "ca_codebase";
const STORAGE_KEY_HISTORY = "ca_history";
const STORAGE_KEY_FILENAME = "ca_filename";

const SUGGESTIONS = [
  "What does this code do overall?",
  "Explain the main functions and their responsibilities",
  "What are potential bugs or edge cases?",
  "Generate a README for this codebase",
  "Write docstrings for every function",
  "How does data flow through this code?",
];

function formatMessage(text) {
  const parts = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", content: text.slice(last, match.index) });
    }
    parts.push({ type: "code", lang: match[1], content: match[2].trim() });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", content: text.slice(last) });
  }
  return parts;
}

function InlineText({ text }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code key={i} style={styles.inlineCode}>
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

function MessageContent({ text }) {
  const parts = formatMessage(text);
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "code") {
          return (
            <div key={i} style={styles.codeBlock}>
              {part.lang && (
                <div style={styles.codeLang}>{part.lang}</div>
              )}
              <pre style={styles.codePre}>{part.content}</pre>
            </div>
          );
        }
        return (
          <p key={i} style={styles.textPara}>
            {part.content.split("\n").map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                <InlineText text={line} />
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <div style={styles.typingWrap}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ ...styles.typingDot, animationDelay: `${i * 0.18}s` }} />
      ))}
    </div>
  );
}

export default function Home() {
  const [codeInput, setCodeInput] = useState("");
  const [codebase, setCodebase] = useState(null);
  const [filename, setFilename] = useState("");
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [codeStats, setCodeStats] = useState(null);
  const messagesRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const savedCode = localStorage.getItem(STORAGE_KEY_CODE);
    const savedHistory = localStorage.getItem(STORAGE_KEY_HISTORY);
    const savedFilename = localStorage.getItem(STORAGE_KEY_FILENAME);
    if (savedCode) {
      setCodebase(savedCode);
      setCodeInput(savedCode);
      setCodeStats(getStats(savedCode));
    }
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch {}
    }
    if (savedFilename) setFilename(savedFilename);
  }, []);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [history, streamingText]);

  function getStats(code) {
    const lines = code.split("\n").length;
    const chars = code.length;
    const words = code.trim().split(/\s+/).length;
    return { lines, chars, words };
  }

  function loadCode() {
    const val = codeInput.trim();
    if (!val) return;
    setCodebase(val);
    setCodeStats(getStats(val));
    setHistory([]);
    localStorage.setItem(STORAGE_KEY_CODE, val);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify([]));
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function resetAll() {
    if (abortRef.current) abortRef.current.abort();
    setCodebase(null);
    setCodeInput("");
    setFilename("");
    setHistory([]);
    setStreamingText("");
    setCodeStats(null);
    setIsStreaming(false);
    localStorage.removeItem(STORAGE_KEY_CODE);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    localStorage.removeItem(STORAGE_KEY_FILENAME);
  }

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || !codebase || isStreaming) return;
    setInput("");

    const newHistory = [...history, { role: "user", content: msg }];
    setHistory(newHistory);
    setIsStreaming(true);
    setStreamingText("");

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory, codebase }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setStreamingText(full);
      }

      const finalHistory = [...newHistory, { role: "assistant", content: full }];
      setHistory(finalHistory);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(finalHistory));
    } catch (err) {
      if (err.name !== "AbortError") {
        const errHistory = [
          ...newHistory,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ];
        setHistory(errHistory);
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  }, [input, codebase, history, isStreaming]);

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  const hasCode = !!codebase;

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.dot(isStreaming ? "pulse" : hasCode ? "ready" : "idle")} />
          <span style={styles.brandMono}>codebase.agent</span>
          <span style={styles.headerSub}>
            {isStreaming ? "thinking..." : hasCode ? `${codeStats?.lines} lines loaded` : "no codebase loaded"}
          </span>
        </div>
        <div style={styles.headerRight}>
          {hasCode && (
            <button style={styles.btnGhost} onClick={resetAll}>
              reset session
            </button>
          )}
        </div>
      </header>

      <div style={styles.body}>
        {/* Left: Code Panel */}
        <div style={styles.codePanel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelLabel}>codebase</span>
            {codeStats && (
              <span style={styles.statsTag}>
                {codeStats.lines} lines · {(codeStats.chars / 1000).toFixed(1)}k chars
              </span>
            )}
          </div>
          <textarea
            style={styles.codeTextarea}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder={"// paste any code here\n// functions, classes, entire files\n// any language works\n\n// tip: the messier the better —\n// that's the real use case"}
            spellCheck={false}
          />
          <div style={styles.codeFooter}>
            <button
              style={styles.btnLoad}
              onClick={loadCode}
              disabled={!codeInput.trim()}
            >
              {hasCode ? "reload →" : "load code →"}
            </button>
            {hasCode && (
              <span style={styles.loadedTag}>✓ loaded</span>
            )}
          </div>
        </div>

        {/* Right: Chat Panel */}
        <div style={styles.chatPanel}>
          <div style={styles.messages} ref={messagesRef}>
            {!hasCode && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>&gt;_</div>
                <div style={styles.emptyTitle}>Load a codebase to start</div>
                <div style={styles.emptyHint}>
                  Paste any code on the left, then ask anything —
                  architecture, docs, bugs, refactors.
                </div>
              </div>
            )}

            {hasCode && history.length === 0 && !isStreaming && (
              <div style={styles.suggestions}>
                <div style={styles.suggestLabel}>try asking</div>
                {SUGGESTIONS.map((s) => (
                  <button key={s} style={styles.chip} onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {history.map((msg, i) => (
              <div key={i} style={styles.msgWrap}>
                <div style={styles.msgRole(msg.role)}>
                  {msg.role === "user" ? "you" : "agent"}
                </div>
                <div style={styles.msgBody}>
                  <MessageContent text={msg.content} />
                </div>
              </div>
            ))}

            {isStreaming && (
              <div style={styles.msgWrap}>
                <div style={styles.msgRole("assistant")}>agent</div>
                <div style={styles.msgBody}>
                  {streamingText ? (
                    <MessageContent text={streamingText} />
                  ) : (
                    <TypingIndicator />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div style={styles.chatFooter}>
            <textarea
              ref={inputRef}
              style={styles.chatInput}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKey}
              placeholder={hasCode ? "Ask anything about the code... (Enter to send, Shift+Enter for newline)" : "Load a codebase first"}
              disabled={!hasCode || isStreaming}
              rows={1}
            />
            <button
              style={styles.btnSend(hasCode && !isStreaming && input.trim())}
              onClick={() => sendMessage()}
              disabled={!hasCode || isStreaming || !input.trim()}
            >
              {isStreaming ? "..." : "↑"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--bg)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  dot: (state) => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: state === "ready" || state === "pulse" ? "var(--green)" : "var(--text-3)",
    flexShrink: 0,
    animation: state === "pulse" ? "pulse 1s ease-in-out infinite" : "none",
  }),
  brandMono: {
    fontFamily: "var(--mono)",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text)",
    letterSpacing: "0.02em",
  },
  headerSub: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--text-3)",
    letterSpacing: "0.04em",
  },
  headerRight: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  btnGhost: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--text-3)",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "4px 10px",
    cursor: "pointer",
    letterSpacing: "0.04em",
    transition: "border-color 0.15s, color 0.15s",
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  codePanel: {
    width: "40%",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--border)",
    flexShrink: 0,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    borderBottom: "1px solid var(--border)",
  },
  panelLabel: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-3)",
  },
  statsTag: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    color: "var(--green)",
    letterSpacing: "0.04em",
  },
  codeTextarea: {
    flex: 1,
    resize: "none",
    border: "none",
    outline: "none",
    padding: "14px",
    fontFamily: "var(--mono)",
    fontSize: 12,
    lineHeight: 1.7,
    background: "var(--bg-2)",
    color: "var(--text)",
    width: "100%",
    caretColor: "var(--green)",
  },
  codeFooter: {
    padding: "10px 14px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  btnLoad: {
    fontFamily: "var(--mono)",
    fontSize: 12,
    fontWeight: 500,
    padding: "6px 16px",
    borderRadius: 6,
    border: "1px solid var(--border-hover)",
    background: "none",
    color: "var(--text)",
    cursor: "pointer",
    transition: "background 0.15s",
    letterSpacing: "0.02em",
  },
  loadedTag: {
    fontFamily: "var(--mono)",
    fontSize: 11,
    color: "var(--green)",
  },
  chatPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 20px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "40px 20px",
    gap: 10,
  },
  emptyIcon: {
    fontFamily: "var(--mono)",
    fontSize: 28,
    color: "var(--text-3)",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 500,
    color: "var(--text-2)",
  },
  emptyHint: {
    fontSize: 13,
    color: "var(--text-3)",
    lineHeight: 1.6,
    maxWidth: 280,
  },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  suggestLabel: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-3)",
    marginBottom: 4,
  },
  chip: {
    fontFamily: "var(--sans)",
    fontSize: 13,
    color: "var(--text-2)",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 12px",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.15s, color 0.15s",
    lineHeight: 1.4,
  },
  msgWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  msgRole: (role) => ({
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: role === "assistant" ? "var(--green)" : "var(--text-3)",
  }),
  msgBody: {
    fontSize: 13,
    lineHeight: 1.7,
    color: "var(--text)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  textPara: {
    margin: 0,
    lineHeight: 1.7,
  },
  inlineCode: {
    fontFamily: "var(--mono)",
    fontSize: 12,
    background: "var(--bg-3)",
    color: "var(--green)",
    padding: "1px 5px",
    borderRadius: 4,
    border: "1px solid var(--border)",
  },
  codeBlock: {
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid var(--border)",
  },
  codeLang: {
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-3)",
    background: "var(--bg-3)",
    padding: "5px 12px",
    borderBottom: "1px solid var(--border)",
  },
  codePre: {
    fontFamily: "var(--mono)",
    fontSize: 12,
    lineHeight: 1.65,
    background: "var(--bg-2)",
    padding: "12px 14px",
    overflowX: "auto",
    color: "var(--text)",
    margin: 0,
    whiteSpace: "pre",
  },
  typingWrap: {
    display: "flex",
    gap: 5,
    alignItems: "center",
    padding: "4px 0",
  },
  typingDot: {
    display: "inline-block",
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "var(--text-3)",
    animation: "bounce 1.2s ease-in-out infinite",
  },
  chatFooter: {
    padding: "12px 16px",
    borderTop: "1px solid var(--border)",
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
  },
  chatInput: {
    flex: 1,
    resize: "none",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "9px 12px",
    fontFamily: "var(--sans)",
    fontSize: 13,
    background: "var(--bg-2)",
    color: "var(--text)",
    lineHeight: 1.5,
    outline: "none",
    maxHeight: 120,
    caretColor: "var(--green)",
    transition: "border-color 0.15s",
  },
  btnSend: (active) => ({
    width: 36,
    height: 36,
    borderRadius: 8,
    border: "1px solid " + (active ? "var(--green)" : "var(--border)"),
    background: active ? "var(--green-dim)" : "none",
    color: active ? "var(--green)" : "var(--text-3)",
    cursor: active ? "pointer" : "default",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.15s",
    fontFamily: "var(--mono)",
  }),
};
