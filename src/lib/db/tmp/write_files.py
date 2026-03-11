import os

# ---- 1. Sidebar component ----
sidebar_content = r'''"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  CheckSquare,
  ArrowLeftRight,
  Truck,
  Settings,
  LogOut,
} from "lucide-react";
import type { User } from "@/lib/types";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inventory", label: "HULLC Inventory", icon: Package },
  { id: "requests", label: "Product Requests", icon: ClipboardList },
  { id: "approvals", label: "Approvals", icon: CheckSquare, roles: ["Director"] },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "fulfillments", label: "Fulfillments", icon: Truck, roles: ["Admin"] },
  { id: "configuration", label: "Configuration", icon: Settings, roles: ["Admin"] },
];

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  user: User;
  onLogout: () => void;
}

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

export function Sidebar({ activeView, onNavigate, user, onLogout }: SidebarProps) {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <aside
      className="sidebar-fixed flex flex-col"
      style={{ backgroundColor: "#0d3d3d" }}
    >
      {/* Logo area */}
      <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <p className="text-white font-bold text-lg leading-tight">HULLC</p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
          Inventory System
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-5 py-2.5 text-sm text-white transition-colors text-left",
                isActive
                  ? "border-l-[3px] pl-[17px]"
                  : "border-l-[3px] border-transparent hover:pl-[17px]"
              )}
              style={
                isActive
                  ? {
                      backgroundColor: "rgba(255,255,255,0.15)",
                      borderLeftColor: "#4db6ac",
                    }
                  : undefined
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "rgba(255,255,255,0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "";
                }
              }}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
            style={{ backgroundColor: "#1a7070", color: "#fff" }}
          >
            {getInitials(user.fullName, user.email)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user.fullName ?? user.email ?? "User"}
            </p>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
              {user.role}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors"
          style={{ color: "rgba(255,255,255,0.7)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "rgba(255,255,255,0.08)";
            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
            (e.currentTarget as HTMLButtonElement).style.color =
              "rgba(255,255,255,0.7)";
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
'''

sidebar_path = r"C:\Users\MV PC\OneDrive\Desktop\HULLC_Inventory_System\src\components\sidebar.tsx"
with open(sidebar_path, "w", encoding="utf-8") as f:
    f.write(sidebar_content)
print(f"Written: {sidebar_path}")

# ---- 2. Migration 005 ----
migration_sql = r'''CREATE TABLE IF NOT EXISTS request_id_sequences (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS request_number INTEGER,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_requests_request_id
  ON product_requests(request_id) WHERE request_id IS NOT NULL;
'''

migrations_dir = r"C:\Users\MV PC\OneDrive\Desktop\HULLC_Inventory_System\src\lib\db\migrations"
migration_path = os.path.join(migrations_dir, "005_add_request_id.sql")
with open(migration_path, "w", encoding="utf-8") as f:
    f.write(migration_sql)
print(f"Written: {migration_path}")

# ---- 3. Request detail page directory ----
detail_dir = r"C:\Users\MV PC\OneDrive\Desktop\HULLC_Inventory_System\src\app\requests\[id]"
os.makedirs(detail_dir, exist_ok=True)

request_detail_content = r'''"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { ProductRequest, RequestLineItem, User } from "@/lib/types";
import { format } from "date-fns";

const USER_STORAGE_KEY = "hullc-user-data";

function getStatusClass(status: string): string {
  switch (status) {
    case "Pending Approval": return "bg-amber-100 text-amber-800";
    case "Approved":         return "bg-green-100 text-green-800";
    case "In Progress":      return "bg-blue-100 text-blue-800";
    case "Completed":        return "bg-slate-100 text-slate-700";
    case "Rejected":         return "bg-red-100 text-red-800";
    case "Pending":          return "bg-amber-100 text-amber-800";
    case "Fulfilled":        return "bg-green-100 text-green-800";
    default:                 return "bg-slate-100 text-slate-700";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusClass(status)}`}>
      {status}
    </span>
  );
}

export default function RequestDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [request, setRequest] = useState<ProductRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Director action state
  const [approveComments, setApproveComments] = useState("");
  const [rejectionNote, setRejectionNote] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (!stored) { router.push("/"); return; }
      const parsed = JSON.parse(stored);
      if (!parsed?.id) { router.push("/"); return; }
      setUser(parsed);
    } catch {
      router.push("/");
    }
  }, []);

  useEffect(() => {
    if (!user || !id) return;
    fetchRequest();
  }, [user, id]);

  const fetchRequest = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        headers: {
          "x-user-role": user.role,
          "x-user-id": user.id ?? "",
          "x-user-email": user.email ?? "",
        },
      });
      if (!res.ok) throw new Error("Request not found");
      const data = await res.json();
      setRequest({ ...data, date: new Date(data.date) });
    } catch {
      toast({ title: "Error", description: "Could not load request.", variant: "destructive" });
      router.push("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !request) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/approve`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user.role,
          "x-user-id": user.id ?? "",
        },
        body: JSON.stringify({ comments: approveComments.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || "Failed to approve");
      }
      toast({ title: "Request Approved" });
      setApproveComments("");
      fetchRequest();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!user || !request || !rejectionNote.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/reject`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user.role,
          "x-user-id": user.id ?? "",
        },
        body: JSON.stringify({ rejectionNote: rejectionNote.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || "Failed to reject");
      }
      toast({ title: "Request Rejected" });
      setRejectionNote("");
      fetchRequest();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) return null;

  const requestDisplayId = (request as any).requestId ?? request.id.slice(0, 8).toUpperCase();
  const canApproveReject = user.role === "Director" && request.status === "Pending Approval";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f0f4f4" }}>
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 h-[60px] flex items-center px-6 gap-3">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Product Requests
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-800">{requestDisplayId}</span>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Request details card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{requestDisplayId}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Submitted {format(new Date(request.date), "PPP")}
              </p>
            </div>
            <StatusBadge status={request.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Product</p>
              <p className="text-sm text-slate-900">{request.productName}</p>
              <p className="text-xs text-slate-400">{request.productId}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Requestor</p>
              <p className="text-sm text-slate-900">{request.requestorName}</p>
              <p className="text-xs text-slate-400">{request.requestorEmail}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Department / Group</p>
              <p className="text-sm text-slate-900">{request.department}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Project</p>
              <p className="text-sm text-slate-900">{request.project ?? "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Justification</p>
              <p className="text-sm text-slate-700">{request.justification}</p>
            </div>
            {request.rejectionNote && (
              <div className="sm:col-span-2 bg-red-50 rounded-lg p-3">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Rejection Note</p>
                <p className="text-sm text-red-700">{request.rejectionNote}</p>
              </div>
            )}
          </div>
        </div>

        {/* Line items card */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Line Items</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Requested</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fulfilled Qty</th>
              </tr>
            </thead>
            <tbody>
              {(request.lineItems ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">No line items found.</td>
                </tr>
              )}
              {(request.lineItems ?? []).map((li: RequestLineItem, idx: number) => (
                <tr key={li.id} className={idx > 0 ? "border-t border-slate-100" : ""}>
                  <td className="px-6 py-3 text-slate-700">{li.requestedDate}</td>
                  <td className="px-6 py-3 text-slate-700">{li.quantity}</td>
                  <td className="px-6 py-3"><StatusBadge status={li.status} /></td>
                  <td className="px-6 py-3 text-slate-700">{li.fulfilledQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Director approve/reject form */}
        {canApproveReject && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Director Action</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Comments (optional)
                </label>
                <Textarea
                  placeholder="Add any optional comments for the requestor..."
                  value={approveComments}
                  onChange={(e) => setApproveComments(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Approve
                </Button>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="Required: explain why the request is being rejected..."
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  rows={3}
                />
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isSaving || !rejectionNote.trim()}
                  className="mt-2"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                  Reject
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'''

detail_page_path = os.path.join(detail_dir, "page.tsx")
with open(detail_page_path, "w", encoding="utf-8") as f:
    f.write(request_detail_content)
print(f"Written: {detail_page_path}")

print("All files written successfully.")
