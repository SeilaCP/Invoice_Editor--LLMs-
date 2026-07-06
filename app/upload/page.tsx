"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UploadSection } from "@/lib/upload/upload_section";
import { ensureDatabaseInitialized } from "../actions";

export default function UploadPage() {
  const [lastUploadType, setLastUploadType] = useState<"docx" | "pdf" | null>(
    null,
  );

  useEffect(() => {
    ensureDatabaseInitialized().catch((error) => {
      console.error("Failed to initialize database:", error);
    });
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(236,253,245,0.9),_rgba(255,255,255,1)_42%,_rgba(226,232,240,1)_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-border bg-background/80 px-5 py-4 shadow-sm backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Route
            </p>
            <h1 className="text-lg font-semibold text-foreground">
              Upload Center
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Home
          </Link>
        </div>

        <div className="mb-8 max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Upload documents for extraction.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Drop a DOCX template or PDF document to extract structured content
            and store it in the system.
          </p>
        </div>

        {lastUploadType && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Last successful upload: {lastUploadType.toUpperCase()}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-background/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <UploadSection
              type="docx"
              title="DOCX Template"
              description="Upload a DOC or DOCX template for placeholder extraction and analysis."
              onUploadSuccess={() => setLastUploadType("docx")}
            />
          </div>

          <div className="rounded-3xl border border-border bg-background/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <UploadSection
              type="pdf"
              title="PDF Document"
              description="Upload a PDF to store it and make it searchable."
              onUploadSuccess={() => setLastUploadType("pdf")}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
