"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getFounderSession, clearFounderSession } from "@/lib/founderAuth";
import { FounderDataProvider } from "./FounderContext";
import { FounderShell } from "./FounderNav";
import FounderLogin from "./FounderLogin";

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof getFounderSession>>(null);

  useEffect(() => {
    setSession(getFounderSession());
    setReady(true);
  }, []);

  const onExit = useCallback(() => {
    clearFounderSession();
    setSession(null);
    router.replace("/founder");
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="animate-spin text-text-muted" size={20} />
      </div>
    );
  }

  if (!session) {
    return (
      <FounderLogin
        onSuccess={() => {
          const s = getFounderSession();
          if (s) setSession(s);
        }}
      />
    );
  }

  return (
    <FounderDataProvider>
      <FounderShell email={session.email} name={session.name} onExit={onExit}>
        {children}
      </FounderShell>
    </FounderDataProvider>
  );
}
