"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Settings,
  Download,
  FileJson,
  ChevronDown,
  Sparkles,
  Bot,
  User,
} from "lucide-react";
import { handleUserMessage, generatePdfAction } from "@/app/actions";

interface Message {
  id: string;
  role: "user" | "assistant";
  type: "chat" | "document";
  content: string;
  html?: string;
  json?: Record<string, any>;
  fileName?: string;
  templateType?: string;
}

const PROVIDERS = [
  { value: "gemini", label: "Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude" },
  { value: "deepseek", label: "DeepSeek" },
] as const;

export function ChatDashboard() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      type: "chat",
      content:
        'Hi! I can help you generate invoices, quotations, and proposals — or just answer questions. Try:\n• "Create an invoice for John Doe, $3000 for web design, due Jan 31"\n• "What\'s the difference between a quote and a proposal?"',
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<
    "gemini" | "openai" | "claude"
  >("gemini");
  const [showSettings, setShowSettings] = useState(false);
  // Per-message JSON tab state: messageId -> boolean
  const [jsonTabOpen, setJsonTabOpen] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Build conversation history for context (chat messages only)
  const conversationHistory = messages
    .filter((m) => m.type === "chat")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      type: "document", // user messages are always "chat" type for history
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      // Single entry point — routes to chat or document internally
      const result = await handleUserMessage(
        text,
        conversationHistory,
        activeProvider,
      );

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        type: result.type,
        content: result.message,
        ...(result.type === "document" && {
          html: result.html,
          json: result.json,
          fileName: result.fileName,
          templateType: result.templateType,
        }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          type: "chat",
          content: "Something went wrong. Please try again.",
        },
      ]);
    }

    setIsLoading(false);
  };
  const handleDownloadPdf = async (msg: Message) => {
    if (!msg.json) return;
    try {
      const pdfBase64 = await generatePdfAction(
        msg.json,
        msg.templateType ?? "invoice",
      );

      const byteChars = atob(pdfBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (msg.fileName || "document").replace(/\.html$/, "") + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download PDF:", err);
    }
  };

  const toggleJsonTab = (id: string) =>
    setJsonTabOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-none">
        <div className="flex items-center justify-between">
          <img
            src="/icon.png"
            alt="Assistant"
            className="w-10 h-10 object-contain"
          />
          <h1 className="text-xl font-bold text-foreground">
            Document Assistant
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="px-6 py-4 border-b border-border bg-muted/40">
          <p className="text-sm font-medium text-foreground mb-2">
            LLM Provider
          </p>
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setActiveProvider(p.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeProvider === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border border-border text-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* Avatar */}
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot size={16} className="text-primary" />
                </div>
              )}

              <div
                className={`flex flex-col gap-2 max-w-xl ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                {/* Bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : msg.type === "document"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-foreground rounded-bl-none"
                        : "bg-muted text-foreground rounded-bl-none"
                  }`}
                >
                  {/* Badge for document messages */}
                  {msg.type === "document" && msg.templateType && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide">
                      <Sparkles size={12} />
                      {msg.templateType} generated
                    </span>
                  )}
                  <p>{msg.content}</p>
                </div>

                {/* Document Preview Card */}
                {msg.type === "document" && msg.html && (
                  <div className="w-full min-w-[1000px] bg-background border border-border rounded-xl overflow-hidden shadow-sm">
                    {/* Tabs */}
                    <div className="flex border-b border-border">
                      <button
                        onClick={() =>
                          setJsonTabOpen((prev) => ({
                            ...prev,
                            [msg.id]: false,
                          }))
                        }
                        className={`px-4 py-2 text-xs font-medium transition-colors ${
                          !jsonTabOpen[msg.id]
                            ? "text-primary border-b-2 border-primary bg-background"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Preview
                      </button>
                      {/* <button
                        onClick={() => toggleJsonTab(msg.id)}
                        className={`px-4 py-2 text-xs font-medium transition-colors ${
                          jsonTabOpen[msg.id]
                            ? "text-primary border-b-2 border-primary bg-background"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        JSON
                      </button> */}
                    </div>

                    {/* Preview */}
                    {!jsonTabOpen[msg.id] && (
                      <iframe
                        srcDoc={msg.html}
                        title="Document Preview"
                        className="w-full h-100 border-0"
                        sandbox="allow-same-origin"
                      />
                    )}

                    {/* JSON */}
                    {jsonTabOpen[msg.id] && msg.json && (
                      <pre className="p-4 text-xs font-mono text-foreground overflow-auto max-h-56 bg-muted/30">
                        {JSON.stringify(msg.json, null, 2)}
                      </pre>
                    )}

                    {/* Download row */}
                    <div className="flex gap-2 px-4 py-3 border-t border-border bg-muted/20">
                      <button
                        onClick={() => handleDownloadPdf(msg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-background border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        <Download size={13} /> PDF
                      </button>
                      {/* {msg.json && (
                        <button
                          onClick={() =>
                            downloadFile(
                              JSON.stringify(msg.json, null, 2),
                              (msg.fileName || "document").replace(
                                ".html",
                                ".json",
                              ),
                              "application/json",
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-background border border-border rounded-lg hover:bg-muted transition-colors"
                        >
                          <FileJson size={13} /> JSON
                        </button>
                      )} */}
                    </div>
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <User size={16} className="text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-primary" />
              </div>
              <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-none mb-1">
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <img
                  src="/loading.gif"
                  alt="Assistant"
                  className="w-20 object-contain"
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input ── */}
      <div className="border-t border-border px-4 py-4 bg-background">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything, or describe a document to generate..."
              className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              rows={2}
              disabled={isLoading}
            />
            {isLoading == false && (
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <Send size={18} />
              </button>
            )}

            {isLoading && (
              <img
                src="/Totoro.gif"
                alt="Assistant"
                className="w-11 h-11 object-contain"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 px-1">
            Shift+Enter for new line · AI auto-detects invoice, quotation, or
            proposal
          </p>
        </div>
      </div>
    </div>
  );
}
