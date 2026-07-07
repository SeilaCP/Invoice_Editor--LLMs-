"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TemplateChatDashboard } from "@/components/template-chat-dashboard";
import { ensureDatabaseInitialized } from "../upload_action";

export default function TemplatesPage() {
  useEffect(() => {
    ensureDatabaseInitialized().catch((error) => {
      console.error("Failed to initialize database:", error);
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <Link
          href="/upload"
          className="rounded-full border border-border bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted"
        >
          Upload
        </Link>
        <Link
          href="/"
          className="rounded-full border border-border bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted"
        >
          Home
        </Link>
      </div>
      <TemplateChatDashboard />
    </div>
  );
}
