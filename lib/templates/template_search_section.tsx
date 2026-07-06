"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { findMatchingTemplates, fillTemplateFromText } from "@/app/actions";
import type { TemplateMatch, FillTemplateResult } from "@/app/upload_action";
import { downloadBase64File } from "@/lib/download";

export function TemplateSearchSection() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [matches, setMatches] = useState<TemplateMatch[]>([]);
  const [selected, setSelected] = useState<TemplateMatch | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [userInput, setUserInput] = useState("");
  const [isFilling, setIsFilling] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);
  const [fillResult, setFillResult] = useState<FillTemplateResult | null>(null);
  const [hasFilled, setHasFilled] = useState(false);

  const text_area = [
    { value: "search", label: "search" },
    { value: "fill", label: "fill" },
  ];

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchError("Please describe what you need first");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setMatches([]);
    setSelected(null);
    setFillResult(null);
    setFillError(null);
    setHasSearched(true);

    try {
      const result = await findMatchingTemplates(trimmed, { limit: 5 });
      if (result.success) {
        const data = result.data ?? [];
        setMatches(data);
        setSelected(data[0] ?? null);
      } else {
        setSearchError(result.error || "Search failed");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleFill = async () => {
    if (!selected) {
      setFillError("Select a matching template first");
      return;
    }
    const trimmedInput = userInput.trim();
    if (!trimmedInput) {
      setFillError("Describe the values to fill in first");
      return;
    }

    setIsFilling(true);
    setFillError(null);
    setFillResult(null);

    try {
      const result = await fillTemplateFromText(
        selected.templateId,
        trimmedInput,
      );
      if (result.success && result.data) {
        setFillResult(result.data);
      } else {
        setFillError(result.error || "Fill failed");
      }
    } catch (err) {
      setFillError(err instanceof Error ? err.message : "Fill failed");
    } finally {
      setIsFilling(false);
    }
  };

  const handleDownload = () => {
    if (!fillResult) return;
    downloadBase64File(fillResult.fileBase64, fillResult.fileName);
  };

  return (
    <div className="flex flex-col justify-end items-center gap-6">
      {/* ── Step 1: Search ───────────────────────────────────────────── */}
      {/* <div className="rounded-3xl border border-border bg-background/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <h2 className="mb-2 text-2xl font-bold text-foreground">
          1. Describe what you need
        </h2>
        <p className="mb-4 text-muted-foreground">
          Enter a natural-language description and we&apos;ll find the closest
          matching uploaded template.
        </p>

        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. I need an invoice for a client"
          rows={4}
          disabled={isSearching}
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSearch();
            }
          }}
        />

        <Button
          onClick={handleSearch}
          disabled={isSearching}
          className="mt-4 bg-accent text-white hover:bg-accent-light"
        >
          {isSearching ? "Searching..." : "Find matching template"}
        </Button>

        {searchError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchError}
          </div>
        )}

        {hasSearched && !searchError && matches.length === 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No matching templates found. Try uploading a template first.
          </div>
        )}

        {matches.length > 0 && (
          <div className="mt-6">
            <label
              htmlFor="template-match-select"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Matches
            </label>
            <select
              id="template-match-select"
              value={selected?.templateId ?? ""}
              onChange={(e) => {
                const next =
                  matches.find((m) => m.templateId === e.target.value) ?? null;
                setSelected(next);
                setFillResult(null);
                setFillError(null);
              }}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary"
            >
              {matches.map((match) => (
                <option key={match.templateId} value={match.templateId}>
                  {match.filename} — {(match.score * 100).toFixed(1)}% match (
                  {match.templateType}, {match.placeholders.length} placeholder
                  {match.placeholders.length === 1 ? "" : "s"})
                </option>
              ))}
            </select>

            {selected && (
              <p className="mt-2 text-xs text-muted-foreground">
                Placeholders: {selected.placeholders.join(", ")}
              </p>
            )}
          </div>
        )}
      </div> */}

      <div className="flex flex-row justify-center items-center gap-4">
        <select
          value={isFilling ? "fill" : "search"}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "search") {
              setIsFilling(false);
              setFillResult(null);
              setFillError(null);
            } else if (value === "fill") {
              setIsFilling(true);
              setSearchError(null);
            }
          }}
          className="mb-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary"
        >
          <option value="search">search</option>
          <option value="fill">fill</option>
        </select>

        {isFilling == false ? (
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. I need an invoice for a client"
            rows={4}
            disabled={isSearching}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
        ) : (
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Describe the values, e.g. client Acme Corp, invoice number INV-001, amount $1,250, due August 15 2026"
            rows={5}
            disabled={isFilling}
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleFill();
              }
            }}
          />
        )}
        {searchError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchError}
          </div>
        )}

        {hasSearched && !searchError && matches.length === 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No matching templates found. Try uploading a template first.
          </div>
        )}

        {matches.length > 0 && (
          <div className="mt-6">
            <label
              htmlFor="template-match-select"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Matches
            </label>
            <select
              id="template-match-select"
              value={selected?.templateId ?? ""}
              onChange={(e) => {
                const next =
                  matches.find((m) => m.templateId === e.target.value) ?? null;
                setSelected(next);
                setFillResult(null);
                setFillError(null);
              }}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary"
            >
              {matches.map((match) => (
                <option key={match.templateId} value={match.templateId}>
                  {match.filename} — {(match.score * 100).toFixed(1)}% match (
                  {match.templateType}, {match.placeholders.length} placeholder
                  {match.placeholders.length === 1 ? "" : "s"})
                </option>
              ))}
            </select>

            {selected && (
              <p className="mt-2 text-xs text-muted-foreground">
                Placeholders: {selected.placeholders.join(", ")}
              </p>
            )}
          </div>
        )}

        {fillError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {fillError}
          </div>
        )}

        {fillResult && (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Extracted fields
              </p>
              <div className="mt-2 space-y-1">
                {Object.entries(fillResult.fields).map(([key, value]) => (
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
                ))}
              </div>
            </div>

            {fillResult.unfilledPlaceholders.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Could not confidently determine:{" "}
                {fillResult.unfilledPlaceholders.join(", ")}. These were left
                blank in the downloaded document.
              </div>
            )}

            <Button
              onClick={handleDownload}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Download {fillResult.fileName}
            </Button>
          </div>
        )}

        {isSearching && (
          <img
            src="/Totoro.gif"
            alt="Assistant"
            className="w-11 h-11 object-contain"
          />
        )}
      </div>

      {/* ── Step 2: Fill ─────────────────────────────────────────────── */}
      {/* <div className="rounded-3xl border border-border bg-background/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <h2 className="mb-2 text-2xl font-bold text-foreground">
          2. Fill the template
        </h2>

        {!selected ? (
          <p className="text-muted-foreground">
            Select a matching template on the left to continue.
          </p>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-sm font-medium text-foreground">
                {selected.filename}
              </p>
            </div>

            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Describe the values, e.g. client Acme Corp, invoice number INV-001, amount $1,250, due August 15 2026"
              rows={5}
              disabled={isFilling}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm outline-none focus:border-primary disabled:opacity-60"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleFill();
                }
              }}
            />

            <Button
              onClick={handleFill}
              disabled={isFilling}
              className="mt-4 bg-accent text-white hover:bg-accent-light"
            >
              {isFilling ? "Filling..." : "Fill template"}
            </Button>

            {fillError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {fillError}
              </div>
            )}

            {fillResult && (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Extracted fields
                  </p>
                  <div className="mt-2 space-y-1">
                    {Object.entries(fillResult.fields).map(([key, value]) => (
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
                    ))}
                  </div>
                </div>

                {fillResult.unfilledPlaceholders.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Could not confidently determine:{" "}
                    {fillResult.unfilledPlaceholders.join(", ")}. These were
                    left blank in the downloaded document.
                  </div>
                )}

                <Button
                  onClick={handleDownload}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Download {fillResult.fileName}
                </Button>
              </div>
            )}
          </>
        )}
      </div> */}
    </div>
  );
}
