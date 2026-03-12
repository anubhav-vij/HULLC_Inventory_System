"use client";
import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/product-form';
import { useToast } from '@/hooks/use-toast';
import type { ProductFormData, Product, User } from '@/lib/types';
import { deleteFile } from '@/lib/file-store';

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

function EditProductFormPage() {
  const params = useParams();
  const productId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id && parsed?.role === 'Admin') {
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

  const handleSave = async (data: ProductFormData) => {
    if (!product) return;
    setIsSaving(true);
    const originalLotIds = new Set(product.lots.map(l => l.id));
    const currentLotIds = new Set(data.lots.map(l => l.id));
    for (const lotId of originalLotIds) {
      if (!currentLotIds.has(lotId)) {
        const removedLot = product.lots.find(l => l.id === lotId);
        if (removedLot?.file?.id) await deleteFile(removedLot.file.id);
      }
    }
    const payload = {
      ...data,
      lots: data.lots.map(l => ({
        ...l,
        receiptDate: l.receiptDate instanceof Date ? l.receiptDate.toISOString() : l.receiptDate,
        expirationDate: l.expirationDate instanceof Date ? l.expirationDate.toISOString() : (l.expirationDate ?? null),
      })),
    };
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-role': user?.role ?? '', 'x-user-id': user?.id ?? '' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || 'Failed to update product');
      }
      toast({ title: 'Product Updated', description: `"${data.name}" has been updated successfully.` });
      router.push('/');
    } catch (error: any) {
      toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: '#1e40af' }} />
      </div>
    );
  }

  if (!user || !product) return null;

  return (
    <div className="min-h-screen w-full content-with-sidebar" style={{ backgroundColor: '#eef2f7' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-8" style={{ height: 60, backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => router.push('/')} className="hover:underline" style={{ color: '#1e40af' }}>HULLC Inventory</button>
          <ChevronRight className="h-4 w-4" style={{ color: '#64748b' }} />
          <span style={{ color: '#0f172a' }} className="font-medium">Edit Product — {product.name}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/')} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="product-form" disabled={isSaving} style={{ backgroundColor: '#1e40af' }}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="p-8 max-w-4xl">
        <div className="mb-4 flex items-center gap-2" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#1e3a5f' }}>
          <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span> Required fields are marked with an asterisk
        </div>
        <ProductForm
          product={product}
          onSave={handleSave}
          onCancel={() => router.push('/')}
          isSaving={isSaving}
          isAdmin={true}
        />
      </div>
    </div>
  );
}

export default function EditProductPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin" style={{ color: '#1e40af' }} /></div>}>
      <EditProductFormPage />
    </Suspense>
  );
}
