"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { useTranslation } from "@/i18n";

/**
 * Archive Detail — redirects to the Analysis board with the game's PGN.
 * Passes PGN via localStorage key 'ag_import_pgn' so the analysis page
 * can pick it up and load the full engine.
 */
export default function ArchiveRedirect() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        const rawUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          (typeof window !== "undefined"
            ? window.location.hostname + ":8787"
            : "localhost:8787");
        const host = rawUrl.replace(/^https?:\/\//, "");
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";

        const res = await fetch(`${protocol}//${host}/api/archive/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const pgn: string = data?.pgn || "";

        if (!pgn) {
          setError("No PGN found for this match.");
          return;
        }

        // Hand off PGN to Analysis board via localStorage
        localStorage.setItem("ag_import_pgn", pgn);
        router.replace("/analysis");
      } catch (e: any) {
        setError(e?.message || "Failed to load match.");
      }
    };

    load();
  }, [id, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center gap-4 text-white">
        <p className="text-red-400 font-bold">{error}</p>
        <button
          onClick={() => router.push("/archive")}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all"
        >
          {t("back_archive")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center gap-4 text-white">
      <Activity className="w-10 h-10 text-blue-400 animate-pulse" />
      <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">
        {t("loading_pgn") || "Opening Analysis Board…"}
      </p>
    </div>
  );
}
