"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Download, ArrowUpDown, ChevronLeft } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { format } from "date-fns";

const USER_STORAGE_KEY = "hullc-user-data";

interface ReceivedRow {
  product_name: string;
  manufacturer: string;
  manufacturer_part_number: string;
  uom: string;
  lot_number: string;
  quantity: number;
  storage_location: string;
  received_date: string;
}

export default function MetricsReceivedPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ReceivedRow[]>([]);
  const [sortAsc, setSortAsc] = useState(false);

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString("en-CA");
  const today = now.toLocaleDateString("en-CA");

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [appliedFrom, setAppliedFrom] = useState(firstOfMonth);
  const [appliedTo, setAppliedTo] = useState(today);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id) {
          if (!["Admin", "ProjectManager", "Chief"].includes(parsed.role)) {
            router.replace("/");
            return;
          }
          setUser(parsed);
          return;
        }
      }
      router.replace("/");
    } catch {
      router.replace("/");
    }
  }, [router]);

  const fetchData = useCallback(async (from: string, to: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/metrics/received?from=${from}&to=${to}`,
        { headers: { "x-user-role": user.role } }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      setData(await res.json());
    } catch {
      setData([]);
      toast({ title: "Load Error", description: "Could not load received inventory data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData(appliedFrom, appliedTo);
  }, [fetchData, appliedFrom, appliedTo]);

  const handleApply = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const da = new Date(a.received_date).getTime();
      const db = new Date(b.received_date).getTime();
      return sortAsc ? da - db : db - da;
    });
  }, [data, sortAsc]);

  const totalLots = data.length;
  const totalQuantity = data.reduce((sum, r) => sum + r.quantity, 0);

  const handleExport = () => {
    if (data.length === 0) return;
    const rows = sortedData.map((r) => ({
      "Product Name": r.product_name,
      Manufacturer: r.manufacturer,
      "Mfr Part #": r.manufacturer_part_number,
      UoM: r.uom,
      "Lot Number": r.lot_number,
      Quantity: r.quantity,
      "Storage Location": r.storage_location,
      "Date Received": format(new Date(r.received_date), "yyyy-MM-dd"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0]).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...rows.map((row) => String((row as any)[key] ?? "").length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Received");
    XLSX.writeFile(wb, `inventory-received-${appliedFrom}-to-${appliedTo}.xlsx`);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#1e40af" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#eef2f7" }}>
      <Sidebar
        activeView="metrics-received"
        onNavigate={(view) => {
          if (view === "metrics-received") return;
          if (view === "metrics-disbursed") { router.push("/metrics/disbursed"); return; }
          router.push("/");
        }}
        user={user}
        onLogout={() => {
          window.localStorage.removeItem(USER_STORAGE_KEY);
          router.push("/");
        }}
      />
      <div className="content-with-sidebar">
        {/* Top bar */}
        <div
          className="sticky top-0 z-30 flex items-center justify-between px-8"
          style={{ height: 60, backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" style={{ color: "#64748b" }} />
            </button>
            <div>
              <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>
                Inventory Received
              </h1>
              <p className="text-xs" style={{ color: "#64748b" }}>
                Items added to inventory within a date range
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-medium" style={{ color: "#1e40af", borderColor: "#1e40af" }}>
            {user.role}
          </Badge>
        </div>

        <main className="p-8">
          <div style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            {/* Filter bar */}
            <div className="p-6 pb-4" style={{ backgroundColor: "#f1f5f9", borderRadius: "12px 12px 0 0" }}>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "#475569" }}>
                    From
                  </label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-[170px] bg-white"
                    style={{ borderColor: "#e2e8f0" }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "#475569" }}>
                    To
                  </label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-[170px] bg-white"
                    style={{ borderColor: "#e2e8f0" }}
                  />
                </div>
                <Button onClick={handleApply} style={{ backgroundColor: "#1e40af" }}>
                  Apply
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={handleExport} disabled={data.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> Export Excel
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="px-6 pb-6 pt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#1e40af" }} />
                </div>
              ) : data.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm" style={{ color: "#64748b" }}>
                    No records found for the selected date range.
                  </p>
                </div>
              ) : (
                <>
                  <div className="border rounded-lg overflow-hidden" style={{ borderColor: "#e2e8f0" }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: "#f8fafc" }}>
                          <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                            Product Name
                          </TableHead>
                          <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                            Manufacturer
                          </TableHead>
                          <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                            Mfr Part #
                          </TableHead>
                          <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                            UoM
                          </TableHead>
                          <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                            Lot Number
                          </TableHead>
                          <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                            Quantity
                          </TableHead>
                          <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                            Storage Location
                          </TableHead>
                          <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: "#64748b" }} onClick={() => setSortAsc((v) => !v)}>
                            <span className="flex items-center gap-1">
                              Date Received
                              <ArrowUpDown className="h-3.5 w-3.5" />
                            </span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedData.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.product_name}</TableCell>
                            <TableCell>{r.manufacturer}</TableCell>
                            <TableCell>{r.manufacturer_part_number}</TableCell>
                            <TableCell>{r.uom || "—"}</TableCell>
                            <TableCell>{r.lot_number}</TableCell>
                            <TableCell>{r.quantity}</TableCell>
                            <TableCell>{r.storage_location}</TableCell>
                            <TableCell>{format(new Date(r.received_date), "yyyy-MM-dd")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Summary */}
                  <div className="flex gap-6 mt-4 px-2">
                    <p className="text-sm" style={{ color: "#64748b" }}>
                      <span className="font-semibold" style={{ color: "#0f172a" }}>{totalLots}</span> lots received
                    </p>
                    <p className="text-sm" style={{ color: "#64748b" }}>
                      <span className="font-semibold" style={{ color: "#0f172a" }}>{totalQuantity}</span> total quantity
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
