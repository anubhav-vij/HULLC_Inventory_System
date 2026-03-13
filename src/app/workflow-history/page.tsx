"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft, ArrowRight } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/types";
import { format } from "date-fns";
import { PaginationControls, paginate } from "@/components/pagination-controls";

const USER_STORAGE_KEY = "hullc-user-data";

interface HistoryEntry {
  id: string;
  requestId: string;
  requestDisplayId: string | null;
  productName: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  changedByName: string | null;
  comments: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Pending Approval": { bg: "#fef3c7", text: "#92400e" },
  "Pending SciOps Approval": { bg: "#fff7ed", text: "#c2410c" },
  "Approved": { bg: "#dbeafe", text: "#1e40af" },
  "In Progress": { bg: "#ede9fe", text: "#6d28d9" },
  "Completed": { bg: "#dcfce7", text: "#166534" },
  "Rejected": { bg: "#fee2e2", text: "#991b1b" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: "#f1f5f9", text: "#475569" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {status}
    </span>
  );
}

export default function WorkflowHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed.role === "Admin") {
          setUser(parsed);
        } else {
          router.replace("/");
          return;
        }
      } else {
        router.replace("/");
        return;
      }
    } catch {
      router.replace("/");
    }
  }, [router]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setFetchError(false);
    try {
      const res = await fetch("/api/workflow-history", {
        headers: { "x-user-role": user.role },
      });
      if (res.ok) {
        setEntries(await res.json());
      } else {
        console.error("[workflow-history] API returned", res.status);
        setFetchError(true);
      }
    } catch (err) {
      console.error("[workflow-history] fetch failed:", err);
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset page on search change
  useEffect(() => { setPage(1); }, [search]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.requestDisplayId ?? "").toLowerCase().includes(q) ||
      e.productName.toLowerCase().includes(q) ||
      (e.changedByName ?? "").toLowerCase().includes(q) ||
      (e.comments ?? "").toLowerCase().includes(q) ||
      e.toStatus.toLowerCase().includes(q)
    );
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: "#1e40af" }} />
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
  };

  return (
    <div className="min-h-screen w-full content-with-sidebar" style={{ backgroundColor: "#eef2f7" }}>
      <Sidebar
        activeView="workflow-history"
        onNavigate={(view) => {
          if (view === "workflow-history") return;
          router.push("/");
        }}
        user={user}
        onLogout={() => {
          window.localStorage.removeItem(USER_STORAGE_KEY);
          router.push("/");
        }}
      />

      <div
        className="sticky top-0 z-30 flex items-center justify-between px-8"
        style={{ height: 60, backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0" }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")} title="Back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Workflow History</h1>
            <p className="text-xs" style={{ color: "#64748b" }}>Request status changes and audit trail</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-medium" style={{ color: "#1e40af", borderColor: "#1e40af" }}>
          {user.role}
        </Badge>
      </div>

      <div className="p-8">
        <div className="mb-4 flex items-center gap-3">
          <Input
            placeholder="Search by request ID, product, user, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 400, backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: 8 }}
          />
          <span className="text-xs" style={{ color: "#64748b" }}>{filtered.length} entries</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#1e40af" }} />
          </div>
        ) : fetchError ? (
          <div className="text-center py-24" style={{ color: "#64748b" }}>
            <p className="text-base font-medium mb-2" style={{ color: "#0f172a" }}>Unable to load workflow history</p>
            <p className="text-sm">The status history table may not be available yet. Please ensure database migrations have been run.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchHistory()}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24" style={{ color: "#64748b" }}>
            {entries.length === 0 ? "No workflow history yet. Status changes will appear here as requests are processed." : "No entries match your search."}
          </div>
        ) : (
          <>
          <div style={cardStyle}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Date & Time</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Request</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Product</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Status Change</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Changed By</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Comments</th>
                </tr>
              </thead>
              <tbody>
                {paginate(filtered, page).map((entry) => (
                  <tr key={entry.id} className="border-t" style={{ borderColor: "#e2e8f0" }}>
                    <td className="px-6 py-3 whitespace-nowrap" style={{ color: "#475569" }}>
                      {format(new Date(entry.createdAt), "MMM d, yyyy h:mm a")}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        className="text-sm font-medium hover:underline"
                        style={{ color: "#1e40af" }}
                        onClick={() => router.push(`/requests/${entry.requestId}`)}
                      >
                        {entry.requestDisplayId ?? entry.requestId.slice(0, 8)}
                      </button>
                    </td>
                    <td className="px-6 py-3 font-medium" style={{ color: "#0f172a" }}>{entry.productName}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {entry.fromStatus && <StatusBadge status={entry.fromStatus} />}
                        {entry.fromStatus && <ArrowRight className="h-3 w-3" style={{ color: "#94a3b8" }} />}
                        <StatusBadge status={entry.toStatus} />
                      </div>
                    </td>
                    <td className="px-6 py-3" style={{ color: "#475569" }}>{entry.changedByName ?? "System"}</td>
                    <td className="px-6 py-3 text-xs max-w-[300px]" style={{ color: "#64748b" }}>
                      {entry.comments || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls currentPage={page} totalItems={filtered.length} onPageChange={setPage} label="entries" />
          </>
        )}
      </div>
    </div>
  );
}
