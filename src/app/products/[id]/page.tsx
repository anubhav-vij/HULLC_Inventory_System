"use client";
import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Pencil, ArrowRightLeft, Printer, Package, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import type { Product, User } from '@/lib/types';
import { format, isValid } from 'date-fns';
import { MaterialAuditReport } from '@/components/material-audit-report';

const USER_STORAGE_KEY = 'hullc-user-data';

function coerceProduct(p: any): Product {
  return {
    ...p,
    lots: (p.lots ?? []).map((l: any) => ({
      ...l,
      receiptDate: new Date(l.receiptDate),
      expirationDate: l.expirationDate ? new Date(l.expirationDate) : null,
    })),
  };
}

function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [auditProduct, setAuditProduct] = useState<Product | null>(null);

  const canEdit = user?.role === 'Admin';

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed.role === 'Admin') {
          setUser(parsed);
        } else {
          router.replace('/');
          return;
        }
      } else {
        router.replace('/');
        return;
      }
    } catch {
      router.replace('/');
      return;
    }

    if (!productId) {
      router.replace('/');
      return;
    }

    fetch(`/api/products/${productId}`)
      .then(res => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then(data => setProduct(coerceProduct(data)))
      .catch(() => {
        toast({ title: 'Error', description: 'Product not found.', variant: 'destructive' });
        router.replace('/');
      })
      .finally(() => setIsLoading(false));
  }, [productId, router, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: '#1e40af' }} />
      </div>
    );
  }

  if (!user || !product) return null;

  const sortedLots = [...product.lots].sort(
    (a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime()
  );

  const totalStock = product.lots.reduce((sum, l) => sum + l.quantity, 0);
  const lotCount = product.lots.length;

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: 14,
    boxShadow: '0 1px 4px rgba(15,23,42,0.07), 0 4px 12px rgba(15,23,42,0.04)',
  };
  const labelStyle: React.CSSProperties = { color: '#1e40af', fontSize: '12px', fontWeight: 600, letterSpacing: '0.02em' };
  const valueStyle: React.CSSProperties = { color: '#0f172a', fontSize: '14px' };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: '#eef2f7' }}>
      {/* Header bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-6 md:px-8" style={{ height: 72, backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        {/* Left: back + title */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="flex items-center justify-center h-9 w-9 rounded-full transition-colors hover:bg-slate-100"
            title="Back to Inventory"
            style={{ color: '#475569' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <FlaskConical className="h-6 w-6 shrink-0" style={{ color: '#1e40af' }} />
              <h1 className="text-xl font-bold truncate" style={{ color: '#0f172a' }}>{product.id}</h1>
            </div>
            <p className="text-sm mt-0.5 truncate" style={{ color: '#64748b' }}>
              {product.name}
              {(product as any).manufacturer && (
                <span> &middot; {(product as any).manufacturer}{(product as any).manufacturerAlternateName ? ` (${(product as any).manufacturerAlternateName})` : ''}</span>
              )}
            </p>
          </div>
        </div>

        {/* Right: action buttons + role badge */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAuditProduct(product)}
            className="h-9 px-4"
            style={{ borderColor: '#1e40af', color: '#1e40af' }}
          >
            <Printer className="mr-2 h-4 w-4" /> Print Audit
          </Button>
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/products/${product.id}/edit`)}
                className="h-9 px-4"
                style={{ borderColor: '#1e40af', color: '#1e40af' }}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button
                size="sm"
                onClick={() => router.push('/')}
                className="h-9 px-4"
                style={{ backgroundColor: '#1e40af', color: '#fff' }}
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" /> New Transaction
              </Button>
            </>
          )}
          <div className="ml-2 pl-3" style={{ borderLeft: '1px solid #e2e8f0' }}>
            <Badge variant="outline" className="text-xs font-medium" style={{ color: '#1e40af', borderColor: '#1e40af' }}>
              {user.fullName || user.email || 'User'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Stock', value: `${totalStock}`, sub: (product as any).uom || 'units', color: '#1e40af', accent: '#1e40af' },
            { label: 'Lots', value: `${lotCount}`, sub: lotCount === 1 ? 'lot' : 'lots', color: '#0f172a', accent: '#2563eb' },
            { label: 'Reorder At', value: product.reorderThreshold != null ? `${product.reorderThreshold}` : '--', sub: product.reorderThreshold != null ? 'units' : 'not set', color: totalStock <= (product.reorderThreshold ?? 0) && product.reorderThreshold ? '#dc2626' : '#0f172a', accent: totalStock <= (product.reorderThreshold ?? 0) && product.reorderThreshold ? '#dc2626' : '#2563eb' },
            { label: 'Cost / Unit', value: (product as any).costPerUnit != null ? `$${Number((product as any).costPerUnit).toFixed(2)}` : '--', sub: (product as any).costPerUnit != null ? 'per unit' : 'not set', color: '#0f172a', accent: '#2563eb' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                ...cardStyle,
                padding: '20px 20px 16px',
                borderTop: `3px solid ${stat.accent}`,
              }}
            >
              <p style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</p>
              <p className="mt-1" style={{ color: stat.color, fontSize: '28px', fontWeight: 700, lineHeight: 1.1 }}>{stat.value}</p>
              <p className="mt-1" style={{ color: '#94a3b8', fontSize: '12px' }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Product Information card */}
          <div style={cardStyle}>
            <div style={{ padding: '20px 24px 16px' }}>
              <h3 style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>Product Information</h3>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <p style={labelStyle}>Product ID</p>
                  <p style={valueStyle} className="mt-1 font-medium">{product.id}</p>
                </div>
                <div>
                  <p style={labelStyle}>Product Name</p>
                  <p style={valueStyle} className="mt-1 font-medium">{product.name}</p>
                </div>
                <div>
                  <p style={labelStyle}>Manufacturer</p>
                  <p style={valueStyle} className="mt-1">{(product as any).manufacturer || 'N/A'}</p>
                  {(product as any).manufacturerAlternateName && (
                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>aka {(product as any).manufacturerAlternateName}</p>
                  )}
                </div>
                <div>
                  <p style={labelStyle}>Manufacturer Part #</p>
                  <p style={valueStyle} className="mt-1">{(product as any).manufacturerPartNumber || (product as any).vendorPartNumber || 'N/A'}</p>
                </div>
                <div>
                  <p style={labelStyle}>VWR Part #</p>
                  <p style={valueStyle} className="mt-1">{(product as any).vwrPartNumber || 'N/A'}</p>
                </div>
                <div>
                  <p style={labelStyle}>Unit of Measure</p>
                  <p style={valueStyle} className="mt-1">{(product as any).uom || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Storage & Status card */}
          <div style={cardStyle}>
            <div style={{ padding: '20px 24px 16px' }}>
              <h3 style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>Storage & Status</h3>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              {sortedLots.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px' }}>No lots / storage locations.</p>
              ) : (
                <div className="space-y-3">
                  {/* Unique locations with stock counts */}
                  {(() => {
                    const locationMap = new Map<string, number>();
                    for (const lot of product.lots) {
                      const loc = lot.location || 'Unassigned';
                      locationMap.set(loc, (locationMap.get(loc) ?? 0) + lot.quantity);
                    }
                    return Array.from(locationMap.entries()).map(([loc, qty]) => (
                      <div
                        key={loc}
                        style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4" style={{ color: '#1e40af' }} />
                          <span className="text-sm font-semibold" style={{ color: '#1e40af' }}>{loc}</span>
                        </div>
                        <p className="text-sm ml-6" style={{ color: '#475569' }}>
                          {qty} {(product as any).uom || 'units'}
                        </p>
                      </div>
                    ));
                  })()}
                </div>
              )}
              {(product as any).somApprovalRequired && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #e2e8f0' }}>
                  <p style={labelStyle}>SOM Approval</p>
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1" style={{ backgroundColor: '#fff7ed', color: '#c2410c' }}>Required</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lots Table */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px 16px' }} className="flex justify-between items-center">
            <h3 style={{ color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>Lots ({sortedLots.length})</h3>
          </div>
          <div className="overflow-x-auto">
            {sortedLots.length === 0 ? (
              <div className="p-8 text-center" style={{ color: '#64748b' }}>No lots found for this product.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#f8fafc' }}>
                    <TableHead style={{ ...labelStyle, padding: '10px 16px' }}>Lot #</TableHead>
                    <TableHead style={{ ...labelStyle, padding: '10px 16px' }}>Quantity</TableHead>
                    <TableHead style={{ ...labelStyle, padding: '10px 16px' }}>Receipt Date</TableHead>
                    <TableHead style={{ ...labelStyle, padding: '10px 16px' }}>Expiration Date</TableHead>
                    <TableHead style={{ ...labelStyle, padding: '10px 16px' }}>Storage Location</TableHead>
                    <TableHead style={{ ...labelStyle, padding: '10px 16px' }}>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLots.map(lot => (
                    <TableRow key={lot.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium px-4" style={valueStyle}>{lot.lotNumber}</TableCell>
                      <TableCell className="px-4" style={valueStyle}>{lot.quantity}</TableCell>
                      <TableCell className="px-4" style={valueStyle}>{isValid(lot.receiptDate) ? format(lot.receiptDate, 'PPP') : 'N/A'}</TableCell>
                      <TableCell className="px-4" style={valueStyle}>{lot.expirationDate && isValid(lot.expirationDate) ? format(lot.expirationDate, 'PPP') : 'N/A'}</TableCell>
                      <TableCell className="px-4" style={valueStyle}>{lot.location}</TableCell>
                      <TableCell className="text-xs px-4" style={{ color: '#64748b' }}>{lot.notes || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {/* Print Audit Report Portal */}
      {auditProduct && (
        <MaterialAuditReport
          product={auditProduct}
          generatedBy={user.fullName || user.email || 'Unknown'}
          onClose={() => setAuditProduct(null)}
        />
      )}
    </div>
  );
}

export default function ProductDetailPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin" style={{ color: '#1e40af' }} /></div>}>
      <ProductDetailPage />
    </Suspense>
  );
}
