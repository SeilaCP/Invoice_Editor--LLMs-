"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, RefreshCw, Download } from "lucide-react";
import { findMatchingTemplates, fillTemplateFromText } from "@/app/actions";
import type { TemplateMatch, FillTemplateResult } from "@/app/upload_action";
import { downloadBase64File } from "@/lib/download";

interface Message {
  id: string;
  role: "user" | "assistant";
  type: "chat" | "search" | "fill";
  content: string;
  matches?: TemplateMatch[];
  selectedTemplateId?: string;
  fillResult?: FillTemplateResult;
}

export function TemplateChatDashboard() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      type: "chat",
      content:
        "Hi! Describe what kind of document you need (e.g. \"I need an invoice for a client\") and I'll find the closest matching uploaded template. Once you pick one, describe the values and I'll fill it in for you.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Once a template is selected from a search result, subsequent messages are
  // treated as fill instructions for that template instead of new searches.
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateMatch | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectMatch = (messageId: string, templateId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, selectedTemplateId: templateId } : m,
      ),
    );
    const message = messages.find((m) => m.id === messageId);
    const match = message?.matches?.find((m) => m.templateId === templateId);
    if (!match) return;

    setSelectedTemplate(match);
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-note`,
        role: "assistant",
        type: "chat",
        content: `Selected "${match.filename}". Now describe the values to fill it in — for example, mention each of: ${match.placeholders.join(", ")}.`,
      },
    ]);
  };

  const handleNewSearch = () => {
    setSelectedTemplate(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-note`,
        role: "assistant",
        type: "chat",
        content: "Okay, describe what you need and I'll search again.",
      },
    ]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      type: "chat",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      if (!selectedTemplate) {
        // ── Search mode ──
        const result = await findMatchingTemplates(text, { limit: 5 });
        if (!result.success) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              type: "chat",
              content: result.error || "Search failed. Please try again.",
            },
          ]);
        } else if (!result.data || result.data.length === 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              type: "chat",
              content:
                "No matching templates found. Try uploading a template first, or describe it differently.",
            },
          ]);
        } else {
          const matches = result.data;
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              type: "search",
              content: "Here's the best match I found. Pick one to continue:",
              matches,
              selectedTemplateId: matches[0].templateId,
            },
          ]);
        }
      } else {
        // ── Fill mode ──
        const result = await fillTemplateFromText(
          selectedTemplate.templateId,
          text,
        );
        if (!result.success || !result.data) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              type: "chat",
              content: result.error || "Fill failed. Please try again.",
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "assistant",
              type: "fill",
              content: `Filled "${selectedTemplate.filename}" — review the extracted fields below.`,
              fillResult: result.data,
            },
          ]);
        }
      }
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

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-none">
        <div className="flex items-center gap-3">
          <img
            src="/icon.png"
            alt="Assistant"
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Template Search & Fill
            </h1>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground">
                Filling: {selectedTemplate.filename}
              </p>
            )}
          </div>
        </div>
        {/* <div className="flex items-center gap-2">
          {selectedTemplate && (
            <button
              onClick={handleNewSearch}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
              title="Start a new search"
            >
              <RefreshCw size={14} /> New search
            </button>
          )}
        </div> */}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot size={16} className="text-primary" />
                </div>
              )}

              <div
                className={`flex flex-col gap-2 max-w-xl ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : msg.type === "fill" || msg.type === "search"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-foreground rounded-bl-none"
                        : "bg-muted text-foreground rounded-bl-none"
                  }`}
                >
                  <p>{msg.content}</p>
                </div>

                {/* Search results: select dropdown */}
                {msg.type === "search" && msg.matches && (
                  <div className="w-full min-w-[420px] bg-background border border-border rounded-xl p-4 shadow-sm">
                    <label
                      htmlFor={`match-select-${msg.id}`}
                      className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Matches
                    </label>
                    <select
                      id={`match-select-${msg.id}`}
                      value={msg.selectedTemplateId ?? ""}
                      onChange={(e) =>
                        handleSelectMatch(msg.id, e.target.value)
                      }
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary"
                    >
                      {msg.matches.map((match) => (
                        <option key={match.templateId} value={match.templateId}>
                          {match.filename} — {(match.score * 100).toFixed(1)}%
                          match ({match.templateType},{" "}
                          {match.placeholders.length} placeholder
                          {match.placeholders.length === 1 ? "" : "s"})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() =>
                        handleSelectMatch(
                          msg.id,
                          msg.selectedTemplateId ?? msg.matches![0].templateId,
                        )
                      }
                      disabled={
                        selectedTemplate?.templateId === msg.selectedTemplateId
                      }
                      className="mt-3 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {selectedTemplate?.templateId === msg.selectedTemplateId
                        ? "Selected"
                        : "Use this template"}
                    </button>
                  </div>
                )}

                {/* Fill results: extracted fields + download */}
                {msg.type === "fill" && msg.fillResult && (
                  <div className="w-full min-w-[420px] bg-background border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Extracted fields
                      </p>
                      {Object.entries(msg.fillResult.fields).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="text-muted-foreground">{key}</span>
                            <span
                              className={
                                value === null
                                  ? "italic text-amber-600"
                                  : "font-medium text-foreground"
                              }
                            >
                              {value === null ? "not found" : value}
                            </span>
                          </div>
                        ),
                      )}

                      {msg.fillResult.unfilledPlaceholders.length > 0 && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                          Could not confidently determine:{" "}
                          {msg.fillResult.unfilledPlaceholders.join(", ")}.
                          These were left blank in the downloaded document.
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 px-4 py-3 border-t border-border bg-muted/20">
                      <button
                        onClick={() =>
                          downloadBase64File(
                            msg.fillResult!.fileBase64,
                            msg.fillResult!.fileName,
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-background border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        <Download size={13} /> {msg.fillResult.fileName}
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
              placeholder={
                selectedTemplate
                  ? "Describe the values to fill in..."
                  : "Describe what document you need..."
              }
              className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              rows={2}
              disabled={isLoading}
            />
            {isLoading ? (
              <img
                src="/Totoro.gif"
                alt="Assistant"
                className="w-11 h-11 object-contain"
              />
            ) : (
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <Send size={18} />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 px-1">
            Shift+Enter for new line ·{" "}
            {selectedTemplate
              ? "Describe the field values to fill this template"
              : "Describe what you need to find a matching template"}
          </p>
        </div>
      </div>
    </div>
  );
}
