"use client";
import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductForm } from '@/components/product-form';
import { useToast } from '@/hooks/use-toast';
import type { ProductFormData, User } from '@/lib/types';

const USER_STORAGE_KEY = 'hullc-user-data';

function NewProductFormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
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
          window.location.href = '/';
          return;
        }
      } else {
        window.location.href = '/';
        return;
      }
    } catch {
      window.location.href = '/';
      return;
    }
    setIsLoading(false);
  }, []);

  const handleSave = async (data: ProductFormData) => {
    setIsSaving(true);
    const payload = {
      ...data,
      lots: data.lots.map(l => ({
        ...l,
        receiptDate: l.receiptDate instanceof Date ? l.receiptDate.toISOString() : l.receiptDate,
        expirationDate: l.expirationDate instanceof Date ? l.expirationDate.toISOString() : (l.expirationDate ?? null),
      })),
    };
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || 'Failed to create product');
      }
      toast({ title: 'Product Added', description: `"${data.name}" has been added successfully.` });
      window.location.href = '/';
    } catch (error: any) {
      toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin" style={{ color: '#1a7070' }} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen w-full content-with-sidebar" style={{ backgroundColor: '#f0f4f4' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-8" style={{ height: 60, backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => router.push('/')} className="hover:underline" style={{ color: '#1a7070' }}>HULLC Inventory</button>
          <ChevronRight className="h-4 w-4" style={{ color: '#64748b' }} />
          <span style={{ color: '#0f2a2a' }} className="font-medium">Add New Product</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/'} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="product-form" disabled={isSaving} style={{ backgroundColor: '#1a7070' }}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Product
          </Button>
        </div>
      </div>

      <div className="p-8 max-w-4xl">
        {/* Product Information Card */}
        <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }} className="p-6">
          <h2 className="text-lg font-semibold mb-1" style={{ color: '#0f2a2a' }}>Product Information</h2>
          <p className="text-sm mb-6" style={{ color: '#64748b' }}>Fill in the product information and add at least one lot.</p>
          <ProductForm
            product={null}
            onSave={handleSave}
            onCancel={() => window.location.href = '/'}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin" style={{ color: '#1a7070' }} /></div>}>
      <NewProductFormPage />
    </Suspense>
  );
}
