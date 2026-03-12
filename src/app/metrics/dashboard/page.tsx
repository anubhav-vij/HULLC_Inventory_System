"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Download, ChevronLeft } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/types";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const USER_STORAGE_KEY = "hullc-user-data";

interface DashboardData {
  transactionsPerDay: { day: string; count: number }[];
  transactionsPerWeek: { week: string; count: number }[];
  requestsByGroup: { group_name: string; count: number }[];
  requestsByStatus: { status: string; count: number }[];
  productsOverTime: { month: string; count: number; cumulative: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  "Pending Approval": "#f59e0b",
  "Pending SciOps Approval": "#f97316",
  "Approved": "#3b82f6",
  "In Progress": "#8b5cf6",
  "Completed": "#22c55e",
  "Rejected": "#ef4444",
};
const DEFAULT_PIE_COLORS = ["#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];

export default function MetricsDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && ["Admin", "ProjectManager", "Chief"].includes(parsed.role)) {
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
      return;
    }
    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (appliedFrom && appliedTo) {
      params.set("from", appliedFrom);
      params.set("to", appliedTo);
    }
    fetch(`/api/metrics/dashboard?${params.toString()}`, {
      headers: { "x-user-role": user.role },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, [user, appliedFrom, appliedTo]);

  const applyFilter = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const clearFilter = () => {
    setFromDate("");
    setToDate("");
    setAppliedFrom("");
    setAppliedTo("");
  };

  const exportToExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    const txDayWs = XLSX.utils.json_to_sheet(
      data.transactionsPerDay.map((r) => ({
        Date: format(new Date(r.day), "yyyy-MM-dd"),
        Transactions: r.count,
      }))
    );
    XLSX.utils.book_append_sheet(wb, txDayWs, "Transactions per Day");

    const txWeekWs = XLSX.utils.json_to_sheet(
      data.transactionsPerWeek.map((r) => ({
        "Week Starting": format(new Date(r.week), "yyyy-MM-dd"),
        Transactions: r.count,
      }))
    );
    XLSX.utils.book_append_sheet(wb, txWeekWs, "Transactions per Week");

    const reqGroupWs = XLSX.utils.json_to_sheet(
      data.requestsByGroup.map((r) => ({
        "Functional Group": r.group_name,
        Requests: r.count,
      }))
    );
    XLSX.utils.book_append_sheet(wb, reqGroupWs, "Requests by Group");

    const reqStatusWs = XLSX.utils.json_to_sheet(
      data.requestsByStatus.map((r) => ({
        Status: r.status,
        Count: r.count,
      }))
    );
    XLSX.utils.book_append_sheet(wb, reqStatusWs, "Requests by Status");

    const prodWs = XLSX.utils.json_to_sheet(
      data.productsOverTime.map((r) => ({
        Month: format(new Date(r.month), "yyyy-MM"),
        "Added": r.count,
        "Cumulative Total": r.cumulative,
      }))
    );
    XLSX.utils.book_append_sheet(wb, prodWs, "Products Over Time");

    XLSX.writeFile(wb, `HULLC_Metrics_Dashboard_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

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
  const cardHeaderStyle: React.CSSProperties = {
    backgroundColor: "#1e3a5f",
    padding: "12px 16px",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
  };

  return (
    <div className="min-h-screen w-full content-with-sidebar" style={{ backgroundColor: "#eef2f7" }}>
      <Sidebar
        activeView="metrics-dashboard"
        onNavigate={(view) => {
          if (view === "metrics-received") router.push("/metrics/received");
          else if (view === "metrics-disbursed") router.push("/metrics/disbursed");
          else if (view === "metrics-dashboard") return;
          else router.push("/");
        }}
        user={user}
        onLogout={() => {
          window.localStorage.removeItem(USER_STORAGE_KEY);
          router.push("/");
        }}
      />

      {/* Top bar */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-8"
        style={{ height: 60, backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0" }}
      >
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")} title="Back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "#0f172a" }}>Metrics Dashboard</h1>
            <p className="text-xs" style={{ color: "#64748b" }}>Charts and analytics overview</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs font-medium" style={{ color: "#1e40af", borderColor: "#1e40af" }}>
            {user.role}
          </Badge>
        </div>
      </div>

      <div className="p-8">
        {/* Date range filter */}
        <div className="flex flex-wrap items-end gap-3 mb-6" style={{ ...cardStyle, padding: 16 }}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#64748b" }}>From</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: 170 }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "#64748b" }}>To</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: 170 }} />
          </div>
          <Button onClick={applyFilter} disabled={!fromDate || !toDate} style={{ backgroundColor: "#1e40af" }}>
            Apply
          </Button>
          {(appliedFrom || appliedTo) && (
            <Button variant="outline" onClick={clearFilter}>Clear</Button>
          )}
          <div className="ml-auto">
            <Button variant="outline" onClick={exportToExcel} disabled={!data}>
              <Download className="mr-2 h-4 w-4" /> Export Excel
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#1e40af" }} />
          </div>
        ) : !data ? (
          <div className="text-center py-24" style={{ color: "#64748b" }}>Failed to load metrics data.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transactions per Day — Line Chart */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Transactions per Day</div>
              <div style={{ padding: 16, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.transactionsPerDay.map((r) => ({ ...r, day: format(new Date(r.day), "MMM d") }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" name="Transactions" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transactions per Week — Bar Chart */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Transactions per Week</div>
              <div style={{ padding: 16, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.transactionsPerWeek.map((r) => ({ ...r, week: format(new Date(r.week), "MMM d") }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Transactions" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Requests by Functional Group — Bar Chart */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Requests by Functional Group</div>
              <div style={{ padding: 16, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.requestsByGroup} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="group_name" type="category" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Requests" fill="#1e40af" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Requests by Status — Donut Chart */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>Requests by Status</div>
              <div style={{ padding: 16, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.requestsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={100}
                      dataKey="count"
                      nameKey="status"
                      label={({ status, count }) => `${status}: ${count}`}
                      labelLine={false}
                    >
                      {data.requestsByStatus.map((entry, index) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || DEFAULT_PIE_COLORS[index % DEFAULT_PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Products Added Over Time — Cumulative Line Chart */}
            <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
              <div style={cardHeaderStyle}>Products Added Over Time (Cumulative)</div>
              <div style={{ padding: 16, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.productsOverTime.map((r) => ({ ...r, month: format(new Date(r.month), "MMM yyyy") }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cumulative" name="Total Products" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="count" name="Added This Month" stroke="#2563eb" strokeWidth={1} strokeDasharray="5 5" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
