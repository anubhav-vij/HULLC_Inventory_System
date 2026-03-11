"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle2, XCircle, Package, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { ProductRequest, RequestLineItem, User, Lot } from "@/lib/types";
import { format } from "date-fns";

const USER_STORAGE_KEY = "hullc-user-data";

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "Pending Approval":
      return "bg-orange-100 text-orange-800";
    case "Pending SciOps Approval":
      return "bg-amber-100 text-amber-800";
    case "Approved":
      return "bg-purple-100 text-purple-800";
    case "In Progress":
      return "bg-blue-100 text-blue-800";
    case "Completed":
      return "bg-green-100 text-green-800";
    case "Rejected":
      return "bg-red-100 text-red-800";
    case "Pending":
      return "bg-yellow-100 text-yellow-800";
    case "Fulfilled":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(status)}`}
    >
      {status}
    </span>
  );
}

interface FulfillFormProps {
  requestId: string;
  lineItem: RequestLineItem;
  productId: string;
  user: User;
  onComplete: () => void;
  onCancel: () => void;
}

function FulfillForm({ requestId, lineItem, productId, user, onComplete, onCancel }: FulfillFormProps) {
  const { toast } = useToast();
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fulfillDate, setFulfillDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lotQuantities, setLotQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`/api/products/${productId}`, {
      headers: { "x-user-role": user.role },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.lots) {
          const available = data.lots.filter((l: Lot) => l.quantity > 0);
          setLots(available);
        }
      })
      .catch(() => {
        toast({ title: "Error", description: "Could not load product lots.", variant: "destructive" });
      })
      .finally(() => setIsLoadingLots(false));
  }, [productId, user.role, toast]);

  const totalSelected = Object.values(lotQuantities).reduce((s, v) => s + (v || 0), 0);

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast({ title: "Validation Error", description: "Notes are required.", variant: "destructive" });
      return;
    }
    if (totalSelected < 1) {
      toast({ title: "Validation Error", description: "Select at least one lot with quantity > 0.", variant: "destructive" });
      return;
    }

    const items = Object.entries(lotQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([lotId, quantityTaken]) => ({ lotId, quantityTaken }));

    setIsSaving(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/line-items/${lineItem.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user.role,
          "x-user-id": user.id ?? "",
        },
        body: JSON.stringify({ date: fulfillDate, notes: notes.trim(), items }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error || "Failed to fulfill");
      }
      toast({ title: "Line Item Fulfilled", description: `Dispensed ${totalSelected} unit(s) successfully.` });
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingLots) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#1e40af" }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "#0f172a" }}>
          Fulfill Line Item — {lineItem.requestedDate} (Qty: {lineItem.quantity})
        </h3>
        <button onClick={onCancel} className="p-1 rounded hover:bg-gray-100">
          <X className="h-4 w-4" style={{ color: "#64748b" }} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fulfill-date">Date *</Label>
          <Input
            id="fulfill-date"
            type="date"
            value={fulfillDate}
            onChange={(e) => setFulfillDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Total Selected</Label>
          <div className="flex items-center h-9 px-3 rounded-md border text-sm" style={{ backgroundColor: "#f8fafc" }}>
            {totalSelected} / {lineItem.quantity} requested
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fulfill-notes">Notes *</Label>
        <Textarea
          id="fulfill-notes"
          placeholder="Describe the fulfillment..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      {lots.length === 0 ? (
        <p className="text-sm py-2" style={{ color: "#dc2626" }}>
          No lots with available stock found for this product.
        </p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase" style={{ color: "#64748b" }}>Lot</th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase" style={{ color: "#64748b" }}>Available</th>
                <th className="text-left px-4 py-2 text-xs font-semibold uppercase" style={{ color: "#64748b" }}>Take</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot, idx) => (
                <tr key={lot.id} style={idx > 0 ? { borderTop: "1px solid #f1f5f9" } : undefined}>
                  <td className="px-4 py-2" style={{ color: "#0f172a" }}>
                    {lot.lotNumber || lot.id.slice(0, 8)}
                    {lot.location && <span className="text-xs ml-2" style={{ color: "#64748b" }}>({lot.location})</span>}
                  </td>
                  <td className="px-4 py-2" style={{ color: "#0f172a" }}>{lot.quantity}</td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0}
                      max={lot.quantity}
                      value={lotQuantities[lot.id] ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(lot.quantity, parseInt(e.target.value, 10) || 0));
                        setLotQuantities((prev) => ({ ...prev, [lot.id]: val }));
                      }}
                      className="w-20 h-8"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSaving || totalSelected < 1}
          style={{ backgroundColor: "#1e40af", color: "#fff" }}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm Fulfillment
        </Button>
      </div>
    </div>
  );
}

function RequestDetailContent() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [request, setRequest] = useState<ProductRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fulfillingLineItemId, setFulfillingLineItemId] = useState<string | null>(null);

  // Director action state
  const [directorComments, setDirectorComments] = useState("");
  const [rejectionError, setRejectionError] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (!stored) {
        router.push("/");
        return;
      }
      const parsed = JSON.parse(stored);
      if (!parsed?.id) {
        router.push("/");
        return;
      }
      setUser(parsed);
    } catch {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    if (!user || !id) return;
    fetchRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          "x-user-functional-group": user.functionalGroupId ?? "",
        },
      });
      if (!res.ok) throw new Error("Request not found");
      const data = await res.json();
      setRequest(data);
    } catch {
      toast({
        title: "Error",
        description: "Could not load request.",
        variant: "destructive",
      });
      router.push("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!user || !request) return;
    setRejectionError("");
    setIsSaving(true);

    const isSciOps = request.status === "Pending SciOps Approval";
    const endpoint = isSciOps
      ? `/api/requests/${request.id}/sciops-approve`
      : `/api/requests/${request.id}/approve`;

    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user.role,
          "x-user-id": user.id ?? "",
          "x-user-functional-group": user.functionalGroupId ?? "",
        },
        body: JSON.stringify({
          comments: directorComments.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).error || "Failed to approve"
        );
      }
      toast({ title: "Request Approved", description: "The request has been approved successfully." });
      await fetchRequest();
      setDirectorComments("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!user || !request) return;
    if (!directorComments.trim()) {
      setRejectionError("A comment is required when rejecting a request.");
      return;
    }
    setRejectionError("");
    setIsSaving(true);

    const isSciOps = request.status === "Pending SciOps Approval";
    const endpoint = isSciOps
      ? `/api/requests/${request.id}/sciops-reject`
      : `/api/requests/${request.id}/reject`;

    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user.role,
          "x-user-id": user.id ?? "",
          "x-user-functional-group": user.functionalGroupId ?? "",
        },
        body: JSON.stringify({ rejectionNote: directorComments.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as Record<string, string>).error || "Failed to reject"
        );
      }
      toast({ title: "Request Rejected", description: "The request has been rejected." });
      await fetchRequest();
      setDirectorComments("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div
        className="content-with-sidebar flex items-center justify-center min-h-screen"
        style={{ backgroundColor: "#eef2f7" }}
      >
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#1e40af" }} />
      </div>
    );
  }

  if (!request) return null;

  const requestDisplayId =
    request.requestId ?? request.id.slice(0, 8).toUpperCase();
  const canDirectorApproveReject =
    user.role === "Director" && request.status === "Pending Approval";
  const canSciOpsApproveReject =
    user.role === "Director" && request.status === "Pending SciOps Approval";
  const canApproveReject = canDirectorApproveReject || canSciOpsApproveReject;
  const isAdmin = user.role === "Admin";
  const showFulfillButton =
    isAdmin &&
    (request.status === "Approved" || request.status === "In Progress");
  const isSomRequest = !!(request as any).somApprovalRequired;

  return (
    <div
      className="content-with-sidebar min-h-screen"
      style={{ backgroundColor: "#eef2f7", marginLeft: "240px" }}
    >
      {/* Top bar */}
      <div
        className="bg-white flex items-center px-6 gap-2"
        style={{
          height: "60px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1 text-sm transition-colors"
          style={{ color: "#64748b" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "#0f172a")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "#64748b")
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Product Requests
        </button>
        <ChevronRight className="h-3.5 w-3.5" style={{ color: "#64748b" }} />
        <span className="text-sm font-medium" style={{ color: "#0f172a" }}>
          {requestDisplayId}
        </span>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Request Details card */}
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          <div style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0', padding: '16px 24px' }} className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: '#0f172a' }}>
                {requestDisplayId}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>
                Submitted {format(new Date(request.date), "PPP")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSomRequest && (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: '#fff7ed', color: '#c2410c' }}>SOM</span>
              )}
              <StatusBadge status={request.status} />
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569', fontSize: '11px', letterSpacing: '0.05em' }}>
                Product
              </p>
              <p className="text-sm font-medium" style={{ color: '#0f172a' }}>
                {request.productName}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569', fontSize: '11px', letterSpacing: '0.05em' }}>
                Manufacturer Part #
              </p>
              <p className="text-sm" style={{ color: '#0f172a' }}>
                {(request as any).manufacturerPartNumber || '\u2014'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569', fontSize: '11px', letterSpacing: '0.05em' }}>
                Requestor
              </p>
              <p className="text-sm" style={{ color: '#0f172a' }}>
                {request.requestorName}
              </p>
              <p className="text-xs" style={{ color: '#64748b' }}>
                {request.requestorEmail}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569', fontSize: '11px', letterSpacing: '0.05em' }}>
                Department
              </p>
              <p className="text-sm" style={{ color: '#0f172a' }}>
                {request.department}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569', fontSize: '11px', letterSpacing: '0.05em' }}>
                Project
              </p>
              <p className="text-sm" style={{ color: '#0f172a' }}>
                {request.project ?? '\u2014'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569', fontSize: '11px', letterSpacing: '0.05em' }}>
                UoM
              </p>
              <p className="text-sm" style={{ color: '#0f172a' }}>
                {(request as any).uom || '\u2014'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#475569', fontSize: '11px', letterSpacing: '0.05em' }}>
                Justification
              </p>
              <p className="text-sm" style={{ color: '#0f172a' }}>
                {request.justification}
              </p>
            </div>
            {request.rejectionNote && (
              <div className="sm:col-span-2 bg-red-50 rounded-lg p-3">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">
                  Rejection Note
                  {(request as any).rejectionStage && (
                    <span className="ml-1 normal-case font-normal">
                      ({(request as any).rejectionStage === 'sciops' ? 'Sci-Ops Director' : (request as any).rejectionStage === 'director' ? 'Director' : 'Admin'})
                    </span>
                  )}
                </p>
                <p className="text-sm text-red-700">
                  {request.rejectionNote}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Line Items card */}
        <div
          className="overflow-hidden"
          style={{
            backgroundColor: '#f8fafc',
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
          }}
        >
          <div
            className="px-6 py-3"
            style={{ backgroundColor: '#f1f5f9', borderBottom: "1px solid #e2e8f0" }}
          >
            <h3
              className="text-sm font-semibold"
              style={{ color: "#0f172a" }}
            >
              Line Items
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#f8fafc" }}>
                <th
                  className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#64748b" }}
                >
                  Requested Date
                </th>
                <th
                  className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#64748b" }}
                >
                  Quantity
                </th>
                <th
                  className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#64748b" }}
                >
                  Status
                </th>
                <th
                  className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#64748b" }}
                >
                  Fulfilled Qty
                </th>
                {showFulfillButton && (
                  <th
                    className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "#64748b" }}
                  >
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(request.lineItems ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={showFulfillButton ? 5 : 4}
                    className="px-6 py-8 text-center"
                    style={{ color: "#64748b" }}
                  >
                    No line items found.
                  </td>
                </tr>
              )}
              {(request.lineItems ?? []).map(
                (li: RequestLineItem, idx: number) => {
                  const isPending = li.status === "Pending";
                  const isFulfilling = fulfillingLineItemId === li.id;
                  return (
                    <tr
                      key={li.id}
                      style={
                        idx > 0
                          ? { borderTop: "1px solid #f1f5f9" }
                          : undefined
                      }
                    >
                      <td
                        className="px-6 py-3"
                        style={{ color: "#0f172a" }}
                      >
                        {li.requestedDate}
                      </td>
                      <td
                        className="px-6 py-3"
                        style={{ color: "#0f172a" }}
                      >
                        {li.quantity}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={li.status} />
                      </td>
                      <td
                        className="px-6 py-3"
                        style={{ color: "#0f172a" }}
                      >
                        {li.fulfilledQuantity}
                      </td>
                      {showFulfillButton && (
                        <td className="px-6 py-3">
                          {isPending && !isFulfilling ? (
                            <Button
                              size="sm"
                              onClick={() => setFulfillingLineItemId(li.id)}
                              style={{
                                backgroundColor: "#1e40af",
                                color: "#fff",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#1e3a8a")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#1e40af")
                              }
                            >
                              <Package className="mr-1.5 h-3.5 w-3.5" />
                              Fulfill
                            </Button>
                          ) : !isPending ? (
                            <span
                              className="text-xs"
                              style={{ color: "#64748b" }}
                            >
                              --
                            </span>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>

          {/* Inline fulfillment form */}
          {fulfillingLineItemId && request && user && (
            <div className="px-6 py-4" style={{ borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
              <FulfillForm
                requestId={request.id}
                lineItem={(request.lineItems ?? []).find((li) => li.id === fulfillingLineItemId)!}
                productId={request.productId}
                user={user}
                onComplete={() => {
                  setFulfillingLineItemId(null);
                  fetchRequest();
                }}
                onCancel={() => setFulfillingLineItemId(null)}
              />
            </div>
          )}
        </div>

        {/* Director / Sci-Ops Action card */}
        {canApproveReject && (
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <div style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0', padding: '12px 20px' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#0f172a' }}>
                {canSciOpsApproveReject ? 'Sci-Ops Director Action' : 'Director Action'}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <Label
                  htmlFor="director-comments"
                  style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}
                >
                  Comments{" "}
                  <span style={{ color: '#94a3b8', fontWeight: 400, textTransform: 'none', fontSize: '11px' }}>
                    (optional for approve, required for reject)
                  </span>
                </Label>
                <Textarea
                  id="director-comments"
                  placeholder="Add comments for the requestor..."
                  value={directorComments}
                  onChange={(e) => {
                    setDirectorComments(e.target.value);
                    if (rejectionError) setRejectionError("");
                  }}
                  rows={3}
                  className="mt-1.5"
                  style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }}
                />
                {rejectionError && (
                  <p className="text-xs text-destructive mt-1">
                    {rejectionError}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleApprove}
                  disabled={isSaving}
                  className="text-white"
                  style={{ backgroundColor: "#16a34a" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#15803d")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#16a34a")
                  }
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={isSaving}
                  className="text-white"
                  style={{ backgroundColor: "#dc2626" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#b91c1c")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#dc2626")
                  }
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Staff view note */}
        {user.role === "Staff" && (
          <div
            className="bg-white p-6 text-center"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
            }}
          >
            <p className="text-sm" style={{ color: "#64748b" }}>
              This request is currently{" "}
              <span className="font-medium" style={{ color: "#0f172a" }}>
                {request.status}
              </span>
              . You will be notified when the status changes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RequestDetailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="content-with-sidebar flex items-center justify-center min-h-screen"
          style={{ backgroundColor: "#eef2f7", marginLeft: "240px" }}
        >
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: "#1e40af" }} />
        </div>
      }
    >
      <RequestDetailContent />
    </Suspense>
  );
}
