"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, CloudUpload, ChevronLeft, History, Trash2 } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { PaginationControls, paginate } from "@/components/pagination-controls";

const USER_STORAGE_KEY = "hullc-user-data";

interface HistoricalRecord {
  id: string;
  type: string;
  event_date: string | null;
  product_name: string;
  manufacturer: string | null;
  manufacturer_part_number: string | null;
  uom: string | null;
  quantity: number;
  department: string | null;
  project: string | null;
  lot_number: string | null;
  created_at: string;
}

export default function HistoricalImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<HistoricalRecord[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sheetSelectorOpen, setSheetSelectorOpen] = useState(false);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [pendingWorkbook, setPendingWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "In" | "Out">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [histPage, setHistPage] = useState(1);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed.role === "Admin") {
          setUser(parsed);
          return;
        }
      }
      router.replace("/");
    } catch {
      router.replace("/");
    }
  }, [router]);

  const authHeaders = useCallback((): HeadersInit => ({
    "Content-Type": "application/json",
    "x-user-role": user?.role ?? "",
    "x-user-id": user?.id ?? "",
  }), [user]);

  const fetchRecords = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/historical-records", {
        headers: { "x-user-role": user.role, "x-user-id": user.id ?? "" },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      setRecords(await res.json());
    } catch {
      toast({ title: "Error", description: "Could not load historical records.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const processImportSheet = async (workbook: XLSX.WorkBook, selectedSheet: string) => {
    setIsImporting(true);
    try {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[selectedSheet], { defval: "" });

      if (rows.length === 0) {
        toast({ title: "Import Failed", description: "No data found in the selected sheet.", variant: "destructive" });
        return;
      }

      // Validate required columns exist
      const headers = Object.keys(rows[0]);
      const requiredMap: Record<string, string[]> = {
        "In or Out": ["In or Out", "in or out", "In Or Out"],
        "Consumable": ["Consumable", "consumable"],
      };
      const findHeader = (candidates: string[]) =>
        headers.find(h => candidates.some(c => c.toLowerCase() === h.toLowerCase()));

      const typeCol = findHeader(["In or Out"]);
      const dateCol = findHeader(["Request Fulfilled Date", "Fulfilled Date"]);
      const nameCol = findHeader(["Consumable", "Product Name"]);
      const mfrCol = findHeader(["Manufacturer"]);
      const partCol = findHeader(["Vendor Part #", "Vendor Part"]);
      const uomCol = findHeader(["U of M", "UoM", "Unit of Measure"]);
      const addedCol = findHeader(["Added Amount", "Added"]);
      const reqQtyCol = findHeader(["Requested Quantity", "Qty Requested"]);
      const deptCol = findHeader(["Department"]);
      const projectCol = findHeader(["Project"]);

      if (!typeCol || !nameCol) {
        throw new Error(
          `File must contain at least "In or Out" and "Consumable" columns. ` +
          `Found headers: ${headers.join(", ")}`
        );
      }

      const formatDate = (d: unknown): string | undefined => {
        if (!d || d === "") return undefined;
        if (d instanceof Date) {
          return isNaN(d.getTime()) ? undefined : format(d, "yyyy-MM-dd");
        }
        const parsed = new Date(String(d));
        return isNaN(parsed.getTime()) ? undefined : format(parsed, "yyyy-MM-dd");
      };

      const parsed: Array<{
        type: string;
        event_date?: string;
        product_name: string;
        manufacturer?: string;
        manufacturer_part_number?: string;
        uom?: string;
        quantity?: number;
        department?: string;
        project?: string;
      }> = [];

      let skipped = 0;
      for (const row of rows) {
        const rawType = String(row[typeCol!] ?? "").trim();
        const type = rawType.toLowerCase() === "in" ? "In" : rawType.toLowerCase() === "out" ? "Out" : null;
        const productName = String(row[nameCol!] ?? "").trim();

        if (!type || !productName) {
          skipped++;
          continue;
        }

        const qty = type === "In"
          ? (addedCol ? parseFloat(String(row[addedCol] ?? "0")) || 0 : 0)
          : (reqQtyCol ? parseFloat(String(row[reqQtyCol] ?? "0")) || 0 : 0);

        parsed.push({
          type,
          event_date: dateCol ? formatDate(row[dateCol]) : undefined,
          product_name: productName,
          manufacturer: mfrCol ? String(row[mfrCol] ?? "").trim() || undefined : undefined,
          manufacturer_part_number: partCol ? String(row[partCol] ?? "").trim() || undefined : undefined,
          uom: uomCol ? String(row[uomCol] ?? "").trim() || undefined : undefined,
          quantity: qty,
          department: deptCol ? String(row[deptCol] ?? "").trim() || undefined : undefined,
          project: projectCol ? String(row[projectCol] ?? "").trim() || undefined : undefined,
        });
      }

      if (parsed.length === 0) {
        toast({
          title: "Import Failed",
          description: `No valid records found. ${skipped} rows skipped (missing type or product name).`,
          variant: "destructive",
        });
        return;
      }

      const res = await fetch("/api/historical-records", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ records: parsed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Import failed");
      }

      const result = await res.json() as { message: string };
      toast({
        title: "Import Successful",
        description: `${result.message}${skipped > 0 ? ` (${skipped} rows skipped)` : ""}`,
      });
      await fetchRecords();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Import Failed", description: msg, variant: "destructive" });
    } finally {
      setIsImporting(false);
      setIsImportDialogOpen(false);
      setSheetSelectorOpen(false);
      setPendingWorkbook(null);
      setSheetNames([]);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (event.target) event.target.value = "";

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });

      if (!workbook.SheetNames.length) {
        toast({ title: "Import Failed", description: "No sheets found in the file.", variant: "destructive" });
        return;
      }

      if (workbook.SheetNames.length > 1) {
        setPendingWorkbook(workbook);
        setSheetNames(workbook.SheetNames);
        setSheetSelectorOpen(true);
        setIsImportDialogOpen(false);
      } else {
        await processImportSheet(workbook, workbook.SheetNames[0]);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Import Failed", description: msg, variant: "destructive" });
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await fetch("/api/historical-records", {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to clear records");
      setRecords([]);
      toast({ title: "Cleared", description: "All historical records have been deleted." });
    } catch {
      toast({ title: "Error", description: "Could not clear historical records.", variant: "destructive" });
    } finally {
      setConfirmClearOpen(false);
    }
  };

  const filteredRecords = useMemo(() => {
    let result = records;
    if (typeFilter !== "all") {
      result = result.filter(r => r.type === typeFilter);
    }
    if (dateFrom) {
      result = result.filter(r => r.event_date && r.event_date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(r => r.event_date && r.event_date <= dateTo);
    }
    return result;
  }, [records, typeFilter, dateFrom, dateTo]);

  useEffect(() => { setHistPage(1); }, [typeFilter, dateFrom, dateTo]);
  const hasFilters = typeFilter !== "all" || dateFrom || dateTo;
  const inCount = records.filter(r => r.type === "In").length;
  const outCount = records.filter(r => r.type === "Out").length;

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
        activeView="historical-import"
        onNavigate={(view) => {
          if (view === "historical-import") return;
          if (view === "metrics-dashboard") { router.push("/metrics/dashboard"); return; }
          if (view === "metrics-received") { router.push("/metrics/received"); return; }
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
                Historical Data Import
              </h1>
              <p className="text-xs" style={{ color: "#64748b" }}>
                Import legacy inventory data for metrics reporting
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs font-medium" style={{ color: "#1e40af", borderColor: "#1e40af" }}>
            {user.role}
          </Badge>
        </div>

        <main className="p-8">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button
              onClick={() => setIsImportDialogOpen(true)}
              style={{ backgroundColor: "#1e40af" }}
            >
              <CloudUpload className="mr-2 h-4 w-4" />
              Import Legacy Excel
            </Button>
            {records.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setConfirmClearOpen(true)}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear All Records
              </Button>
            )}
            <div className="flex-1" />
            <div className="flex gap-4 text-sm" style={{ color: "#64748b" }}>
              <span>
                <span className="font-semibold" style={{ color: "#0f172a" }}>{records.length}</span> total
              </span>
              <span>
                <span className="font-semibold" style={{ color: "#16a34a" }}>{inCount}</span> received
              </span>
              <span>
                <span className="font-semibold" style={{ color: "#dc2626" }}>{outCount}</span> disbursed
              </span>
            </div>
          </div>

          {/* Filter bar */}
          {records.length > 0 && (
            <div className="flex flex-wrap items-end gap-4 mb-6 p-4 rounded-lg" style={{ backgroundColor: "#f1f5f9" }}>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "#475569" }}>
                  Type
                </label>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "In" | "Out")}>
                  <SelectTrigger className="w-[140px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="In">In (Received)</SelectItem>
                    <SelectItem value="Out">Out (Disbursed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: "#475569" }}>
                  From
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
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
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[170px] bg-white"
                  style={{ borderColor: "#e2e8f0" }}
                />
              </div>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTypeFilter("all"); setDateFrom(""); setDateTo(""); }}
                >
                  Clear Filters
                </Button>
              )}
              {hasFilters && (
                <span className="text-sm ml-auto" style={{ color: "#64748b" }}>
                  Showing <span className="font-semibold" style={{ color: "#0f172a" }}>{filteredRecords.length}</span> of {records.length} records
                </span>
              )}
            </div>
          )}

          {/* Records table */}
          <div style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <div className="px-6 pb-6 pt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#1e40af" }} />
                </div>
              ) : filteredRecords.length === 0 && records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <History className="h-12 w-12" style={{ color: "#cbd5e1" }} />
                  <p className="text-sm font-medium" style={{ color: "#64748b" }}>
                    No historical records imported yet
                  </p>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    Use the &quot;Import Legacy Excel&quot; button to upload your historical inventory data.
                  </p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm" style={{ color: "#64748b" }}>
                    No records match the selected filters.
                  </p>
                </div>
              ) : (
                <>
                <div className="border rounded-lg overflow-auto" style={{ borderColor: "#e2e8f0" }}>
                  <Table>
                    <TableHeader>
                      <TableRow style={{ backgroundColor: "#f8fafc" }}>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Type</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Date</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Product</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Manufacturer</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Part #</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>UoM</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Qty</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Department</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Project</TableHead>
                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>Lot #</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginate(filteredRecords, histPage).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={
                                r.type === "In"
                                  ? { color: "#16a34a", borderColor: "#16a34a", backgroundColor: "#f0fdf4" }
                                  : { color: "#dc2626", borderColor: "#dc2626", backgroundColor: "#fef2f2" }
                              }
                            >
                              {r.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {r.event_date ? format(new Date(r.event_date), "yyyy-MM-dd") : "—"}
                          </TableCell>
                          <TableCell className="font-medium">{r.product_name}</TableCell>
                          <TableCell>{r.manufacturer || "—"}</TableCell>
                          <TableCell>{r.manufacturer_part_number || "—"}</TableCell>
                          <TableCell>{r.uom || "—"}</TableCell>
                          <TableCell>{r.quantity}</TableCell>
                          <TableCell>{r.department || "—"}</TableCell>
                          <TableCell>{r.project || "—"}</TableCell>
                          <TableCell className="text-xs" style={{ color: "#94a3b8" }}>{r.lot_number || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls currentPage={histPage} totalItems={filteredRecords.length} onPageChange={setHistPage} label="records" />
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Import dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Legacy Historical Data</DialogTitle>
            <DialogDescription>
              Upload the legacy Excel file with historical inventory received/disbursed records.
              This data will appear in the Metrics reports alongside live data.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm bg-muted p-4 rounded-md space-y-2">
            <p className="font-semibold text-xs uppercase tracking-wider" style={{ color: "#475569" }}>
              Expected columns from legacy Excel:
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: "#334155" }}>
              <span><strong>In or Out</strong> — &quot;In&quot; or &quot;Out&quot;</span>
              <span><strong>Request Fulfilled Date</strong> — event date</span>
              <span><strong>Consumable</strong> — product name</span>
              <span><strong>Manufacturer</strong></span>
              <span><strong>Vendor Part #</strong> — part number</span>
              <span><strong>U of M</strong> — unit of measure</span>
              <span><strong>Added Amount</strong> — qty for &quot;In&quot;</span>
              <span><strong>Requested Quantity</strong> — qty for &quot;Out&quot;</span>
              <span><strong>Department</strong> — functional group</span>
              <span><strong>Project</strong></span>
            </div>
            <p className="text-xs mt-2" style={{ color: "#64748b" }}>
              Columns like &quot;Request Fulfilled&quot;, &quot;Archive&quot;, &quot;SOP&quot;, &quot;Created&quot;, and &quot;In Stock&quot; are ignored.
              Lot numbers are auto-generated as LOT-#-Missing.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
            <label>
              <Button asChild>
                <span>
                  <CloudUpload className="mr-2 h-4 w-4" />
                  Select File
                </span>
              </Button>
              <input
                type="file"
                onChange={handleFileSelect}
                style={{ display: "none" }}
                accept=".xlsx,.xls,.csv"
              />
            </label>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet selector for multi-sheet files */}
      <Dialog
        open={sheetSelectorOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSheetSelectorOpen(false);
            setPendingWorkbook(null);
            setSheetNames([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Sheet</DialogTitle>
            <DialogDescription>
              This file contains multiple sheets. Select the sheet to import:
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {sheetNames.map((name) => (
              <Button
                key={name}
                variant="outline"
                className="justify-start"
                disabled={isImporting}
                onClick={() => {
                  if (pendingWorkbook) {
                    processImportSheet(pendingWorkbook, name);
                  }
                }}
              >
                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm clear dialog */}
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Historical Records?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {records.length} imported historical records.
              This cannot be undone. The records will no longer appear in metrics reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
