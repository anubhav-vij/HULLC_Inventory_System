"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { format, isValid } from "date-fns";
import type { Product, Transaction } from "@/lib/types";

interface MaterialAuditReportProps {
  product: Product;
  generatedBy: string;
  onClose: () => void;
}

export function MaterialAuditReport({ product, generatedBy, onClose }: MaterialAuditReportProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById("material-audit-print-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "material-audit-print-root";
      document.body.appendChild(el);
    }
    setPortalRoot(el);
  }, []);

  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        const filtered = data
          .filter((t) => t.items?.some((i: any) => i.productId === product.id) || t.productId === product.id)
          .map((t) => ({ ...t, date: new Date(t.date) }))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(filtered);
      })
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [product.id]);

  useEffect(() => {
    if (!loading && portalRoot) {
      const timer = setTimeout(() => {
        window.print();
        // After print dialog closes, clean up
        setTimeout(() => onClose(), 300);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loading, portalRoot, onClose]);

  if (!portalRoot) return null;

  const totalStock = product.lots.reduce((s, l) => s + l.quantity, 0);
  const now = new Date();

  const reportContent = (
    <div
      style={{
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#0f172a",
        fontSize: "11pt",
        lineHeight: 1.5,
        padding: "0",
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: "3px solid #1e3a5f", paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "18pt", fontWeight: 700, color: "#1e3a5f", margin: 0 }}>
              HULLC Inventory System
            </h1>
            <p style={{ fontSize: "9pt", color: "#64748b", margin: "2px 0 0 0" }}>
              High Use Long Lead Consumables &mdash; NIH/NIAID
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: "9pt", color: "#64748b" }}>
            <p style={{ margin: 0 }}>Material Audit Report</p>
            <p style={{ margin: 0 }}>Generated: {format(now, "PPP 'at' p")}</p>
            <p style={{ margin: 0 }}>By: {generatedBy}</p>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <h2 style={{ fontSize: "14pt", fontWeight: 700, color: "#1e3a5f", margin: "0 0 10px 0" }}>
        Product Details
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: "10pt" }}>
        <tbody>
          {[
            ["Product ID", product.id],
            ["Product Name", product.name],
            ["Manufacturer", product.manufacturer || "—"],
            ["Manufacturer Part #", product.manufacturerPartNumber || "—"],
            ["VWR Part #", (product as any).vwrPartNumber || "—"],
            ["Unit of Measure", product.uom || "—"],
            ["SOM Approval Required", (product as any).somApprovalRequired ? "Yes" : "No"],
            ["Reorder Threshold", product.reorderThreshold != null ? String(product.reorderThreshold) : "—"],
            ["Total Current Stock", String(totalStock)],
          ].map(([label, value]) => (
            <tr key={label}>
              <td
                style={{
                  padding: "5px 12px",
                  fontWeight: 600,
                  width: "200px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                }}
              >
                {label}
              </td>
              <td style={{ padding: "5px 12px", border: "1px solid #e2e8f0" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Lots */}
      <h2 style={{ fontSize: "14pt", fontWeight: 700, color: "#1e3a5f", margin: "0 0 10px 0" }}>
        Lot Inventory ({product.lots.length} lot{product.lots.length !== 1 ? "s" : ""})
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: "10pt" }}>
        <thead>
          <tr style={{ backgroundColor: "#1e3a5f", color: "#ffffff" }}>
            {["Lot #", "Quantity", "Receipt Date", "Expiration Date", "Storage Location", "Notes"].map(
              (h) => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: "9pt" }}>
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {product.lots.map((lot, i) => (
            <tr key={lot.id} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
              <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{lot.lotNumber || "—"}</td>
              <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{lot.quantity}</td>
              <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>
                {lot.receiptDate && isValid(new Date(lot.receiptDate))
                  ? format(new Date(lot.receiptDate), "PPP")
                  : "—"}
              </td>
              <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>
                {lot.expirationDate && isValid(new Date(lot.expirationDate))
                  ? format(new Date(lot.expirationDate), "PPP")
                  : "N/A"}
              </td>
              <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{lot.location || "—"}</td>
              <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{lot.notes || "—"}</td>
            </tr>
          ))}
          {product.lots.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: "12px 10px", textAlign: "center", color: "#64748b", border: "1px solid #e2e8f0" }}>
                No lots on record
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Transaction History */}
      <h2 style={{ fontSize: "14pt", fontWeight: 700, color: "#1e3a5f", margin: "0 0 10px 0" }}>
        Transaction History ({transactions.length} record{transactions.length !== 1 ? "s" : ""})
      </h2>
      {loading ? (
        <p style={{ color: "#64748b" }}>Loading transactions...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: "10pt" }}>
          <thead>
            <tr style={{ backgroundColor: "#1e3a5f", color: "#ffffff" }}>
              {["Date", "Product", "Lot #", "Quantity", "Department", "Requestor", "Notes"].map(
                (h) => (
                  <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: "9pt" }}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) =>
              (tx.items ?? []).map((item, j) => (
                <tr key={`${tx.id}-${j}`} style={{ backgroundColor: (i + j) % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                  <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>
                    {isValid(new Date(tx.date)) ? format(new Date(tx.date), "PPP") : "—"}
                  </td>
                  <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{tx.productName || product.name}</td>
                  <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{item.lotNumber || "—"}</td>
                  <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{item.quantity}</td>
                  <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{tx.department || "—"}</td>
                  <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{tx.requestorName || "—"}</td>
                  <td style={{ padding: "5px 10px", border: "1px solid #e2e8f0" }}>{tx.notes || "—"}</td>
                </tr>
              ))
            )}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "12px 10px", textAlign: "center", color: "#64748b", border: "1px solid #e2e8f0" }}>
                  No transaction records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Confidential footer */}
      <div
        style={{
          borderTop: "2px solid #1e3a5f",
          paddingTop: 10,
          marginTop: 30,
          fontSize: "8pt",
          color: "#64748b",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>CONFIDENTIAL — For Internal Use Only</p>
        <p style={{ margin: "2px 0 0 0" }}>
          HULLC Inventory Management System &mdash; NIH/NIAID &mdash; {format(now, "yyyy")}
        </p>
      </div>
    </div>
  );

  return createPortal(reportContent, portalRoot);
}
