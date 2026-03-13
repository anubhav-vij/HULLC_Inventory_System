"use client";
import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ChevronRight, Pencil, ArrowRightLeft, Printer } from 'lucide-react';
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
        if (parsed?.id) {
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

  const cardStyle: React.CSSProperties = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 };
  const headerStyle: React.CSSProperties = { backgroundColor: '#1e3a5f', borderRadius: '12px 12px 0 0', padding: '14px 16px' };
  const headerTextStyle: React.CSSProperties = { color: '#ffffff', fontSize: '15px', fontWeight: 700, margin: 0 };
  const labelStyle: React.CSSProperties = { color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 };
  const valueStyle: React.CSSProperties = { color: '#0f172a', fontSize: '14px' };

  return (
    <div className="min-h-screen w-full content-with-sidebar" style={{ backgroundColor: '#eef2f7' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-8" style={{ height: 60, backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => router.push('/')} className="hover:underline" style={{ color: '#1e40af' }}>HULLC Inventory</button>
          <ChevronRight className="h-4 w-4" style={{ color: '#64748b' }} />
          <span style={{ color: '#0f172a' }} className="font-medium">{product.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-medium mr-2" style={{ color: '#1e40af', borderColor: '#1e40af' }}>
            {user.role}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setAuditProduct(product)}>
            <Printer className="mr-2 h-4 w-4" /> Print Audit
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => router.push(`/products/${product.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
              {/* Navigate back to main inventory page; could be enhanced with query params to pre-select product */}
              <Button size="sm" style={{ backgroundColor: '#1e40af' }} onClick={() => router.push('/')}>
                <ArrowRightLeft className="mr-2 h-4 w-4" /> New Transaction
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-8 max-w-5xl">
        {/* Product Info */}
        <div style={cardStyle} className="mb-6">
          <div style={headerStyle}>
            <h3 style={headerTextStyle}>Product Details</h3>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: '0 0 12px 12px' }}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
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
              <div>
                <p style={labelStyle}>Total Stock</p>
                <p style={{ ...valueStyle, fontWeight: 700 }} className="mt-1">{totalStock} units</p>
              </div>
              <div>
                <p style={labelStyle}>Reorder Threshold</p>
                <p style={valueStyle} className="mt-1">{product.reorderThreshold ?? 'Not set'}</p>
              </div>
              {(product as any).somApprovalRequired && (
                <div>
                  <p style={labelStyle}>SOM Approval</p>
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1" style={{ backgroundColor: '#fff7ed', color: '#c2410c' }}>Required</span>
                </div>
              )}
              {(product as any).costPerUnit != null && (
                <div>
                  <p style={labelStyle}>Cost Per Unit</p>
                  <p style={valueStyle} className="mt-1">${Number((product as any).costPerUnit).toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lots Table */}
        <div style={cardStyle}>
          <div style={headerStyle} className="flex justify-between items-center">
            <h3 style={headerTextStyle}>Lots ({sortedLots.length})</h3>
          </div>
          <div className="overflow-x-auto">
            {sortedLots.length === 0 ? (
              <div className="p-8 text-center" style={{ color: '#64748b' }}>No lots found for this product.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#f8fafc' }}>
                    <TableHead style={labelStyle}>Lot #</TableHead>
                    <TableHead style={labelStyle}>Quantity</TableHead>
                    <TableHead style={labelStyle}>Receipt Date</TableHead>
                    <TableHead style={labelStyle}>Expiration Date</TableHead>
                    <TableHead style={labelStyle}>Storage Location</TableHead>
                    <TableHead style={labelStyle}>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLots.map(lot => (
                    <TableRow key={lot.id}>
                      <TableCell className="font-medium" style={valueStyle}>{lot.lotNumber}</TableCell>
                      <TableCell style={valueStyle}>{lot.quantity}</TableCell>
                      <TableCell style={valueStyle}>{isValid(lot.receiptDate) ? format(lot.receiptDate, 'PPP') : 'N/A'}</TableCell>
                      <TableCell style={valueStyle}>{lot.expirationDate && isValid(lot.expirationDate) ? format(lot.expirationDate, 'PPP') : 'N/A'}</TableCell>
                      <TableCell style={valueStyle}>{lot.location}</TableCell>
                      <TableCell className="text-xs" style={{ color: '#64748b' }}>{lot.notes || 'N/A'}</TableCell>
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
