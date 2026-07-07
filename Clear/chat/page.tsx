"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChatDashboard } from "@/components/chat-dashboard";
import { ensureDatabaseInitialized } from "../actions";

export default function ChatPage() {
  useEffect(() => {
    ensureDatabaseInitialized().catch((error) => {
      console.error("Failed to initialize database:", error);
    });
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      <Link
        href="/"
        className="absolute right-4 top-4 z-20 rounded-full border border-border bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted"
      >
        Home
      </Link>
      <ChatDashboard />
    </div>
  );
}
