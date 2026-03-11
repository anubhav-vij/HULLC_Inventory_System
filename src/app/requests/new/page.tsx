"use client";

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
// Card components no longer used - using inline styled divs
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Trash2, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, User } from '@/lib/types';

interface AppProject { id: string; name: string; isActive: boolean; }

const USER_STORAGE_KEY = 'hullc-user-data';

interface LineItem {
  id: string;
  requestedDate: string;
  quantity: number;
}

function NewRequestForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const productId = searchParams.get('productId');

  const [user, setUser] = useState<User | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [project, setProject] = useState('');
  const [justification, setJustification] = useState('');
  const [sopRead, setSopRead] = useState(false);
  const [lineItemErrors, setLineItemErrors] = useState<Record<string, string>>({});

  const todayStr = new Date().toISOString().split('T')[0];

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), requestedDate: '', quantity: 1 },
  ]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          setUser(parsed);
        } else {
          router.push('/');
          return;
        }
      } else {
        router.push('/');
        return;
      }
    } catch {
      router.push('/');
      return;
    }

    if (!productId) {
      router.push('/');
      return;
    }

    fetch(`/api/products/${productId}`)
      .then(res => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then(data => setProduct(data))
      .catch(() => {
        toast({ title: 'Error', description: 'Product not found.', variant: 'destructive' });
        router.push('/');
      })
      .finally(() => setIsLoading(false));

    fetch('/api/projects')
      .then(res => res.ok ? res.json() : [])
      .then(data => setProjects(data.filter((p: AppProject) => p.isActive)))
      .catch(() => {});
  }, [productId]);

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: crypto.randomUUID(), requestedDate: '', quantity: 1 }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(li => li.id !== id));
  };

  const updateLineItem = (id: string, field: keyof Omit<LineItem, 'id'>, value: string | number) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));
    if (field === 'requestedDate') {
      const dateVal = value as string;
      if (dateVal && dateVal < todayStr) {
        setLineItemErrors(prev => ({ ...prev, [id]: 'Date must be today or in the future.' }));
      } else {
        setLineItemErrors(prev => { const next = { ...prev }; delete next[id]; return next; });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !product) return;

    if (!project) {
      toast({ title: 'Validation Error', description: 'Please select a project.', variant: 'destructive' });
      return;
    }

    if (!justification.trim()) {
      toast({ title: 'Validation Error', description: 'Justification is required.', variant: 'destructive' });
      return;
    }

    if (!sopRead) {
      toast({ title: 'Validation Error', description: 'You must confirm you have read the SOP.', variant: 'destructive' });
      return;
    }

    if (lineItems.length === 0) {
      toast({ title: 'Validation Error', description: 'At least one line item is required.', variant: 'destructive' });
      return;
    }

    for (const li of lineItems) {
      if (!li.requestedDate) {
        toast({ title: 'Validation Error', description: 'All line items must have a date.', variant: 'destructive' });
        return;
      }
      if (li.quantity < 1) {
        toast({ title: 'Validation Error', description: 'All quantities must be at least 1.', variant: 'destructive' });
        return;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const li of lineItems) {
      const d = new Date(li.requestedDate);
      if (d < today) {
        toast({ title: 'Validation Error', description: 'Requested dates must be today or in the future.', variant: 'destructive' });
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          requestorName: user.fullName ?? user.email ?? '',
          requestorEmail: user.email ?? '',
          department: user.functionalGroupName ?? user.department ?? '',
          project: project.trim() || undefined,
          justification: justification.trim(),
          sopRead,
          lineItems: lineItems.map(li => ({
            requestedDate: li.requestedDate,
            quantity: li.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || 'Failed to submit request');
      }

      toast({
        title: 'Request Submitted',
        description: `Your request for "${product.name}" has been submitted for approval.`,
      });
      router.push('/');
    } catch (error: any) {
      toast({ title: 'Submit Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !product) return null;

  return (
    <div className="min-h-screen w-full content-with-sidebar" style={{ backgroundColor: '#f0f4f4' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center px-8" style={{ height: 60, backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => router.push('/')} className="hover:underline" style={{ color: '#1a7070' }}>Product Requests</button>
          <ChevronRight className="h-4 w-4" style={{ color: '#64748b' }} />
          <span style={{ color: '#0f2a2a' }} className="font-medium">New Request</span>
        </div>
      </div>

      <div className="p-8 max-w-3xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Product Info */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }} className="p-6">
              <h2 className="text-lg font-semibold mb-1" style={{ color: '#0f2a2a' }}>Product</h2>
              <p className="text-sm mb-4" style={{ color: '#64748b' }}>The product you are requesting.</p>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Product Name</Label>
                  <Input value={product.name} readOnly className="bg-muted" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Product ID</Label>
                  <Input value={product.id} readOnly className="bg-muted" />
                </div>
              </div>
            </div>

            {/* Requestor Info */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }} className="p-6">
              <h2 className="text-lg font-semibold mb-1" style={{ color: '#0f2a2a' }}>Requestor Information</h2>
              <p className="text-sm mb-4" style={{ color: '#64748b' }}>Your details from your account.</p>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Name</Label>
                  <Input value={user.fullName ?? ''} readOnly className="bg-muted" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Email</Label>
                  <Input value={user.email ?? ''} readOnly className="bg-muted" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Functional Group / Department</Label>
                  <Input value={user.functionalGroupName ?? user.department ?? ''} readOnly className="bg-muted" />
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }} className="p-6">
              <h2 className="text-lg font-semibold mb-4" style={{ color: '#0f2a2a' }}>Request Details</h2>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="project">Project *</Label>
                  <Select value={project} onValueChange={setProject}>
                    <SelectTrigger id="project">
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="justification">Justification *</Label>
                  <Textarea
                    id="justification"
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    placeholder="Explain why you need this product..."
                    rows={4}
                    required
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sop-read"
                    checked={sopRead}
                    onCheckedChange={v => setSopRead(v === true)}
                  />
                  <Label htmlFor="sop-read" className="cursor-pointer">
                    I confirm that I have read and understood the Standard Operating Procedure (SOP) for this product.
                  </Label>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }} className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: '#0f2a2a' }}>Requested Quantities</h2>
                    <p className="text-sm" style={{ color: '#64748b' }}>Add one row per date you need items delivered.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Row
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested Date *</TableHead>
                        <TableHead>Quantity *</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map(li => (
                        <TableRow key={li.id}>
                          <TableCell>
                            <Input
                              type="date"
                              value={li.requestedDate}
                              min={todayStr}
                              onChange={e => updateLineItem(li.id, 'requestedDate', e.target.value)}
                              required
                            />
                            {lineItemErrors[li.id] && (
                              <p className="text-xs text-destructive mt-1">{lineItemErrors[li.id]}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={li.quantity}
                              onChange={e => updateLineItem(li.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                              required
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(li.id)}
                              disabled={lineItems.length === 1}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pb-8">
              <Button type="button" variant="outline" onClick={() => router.push('/')} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} style={{ backgroundColor: '#1a7070' }}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <NewRequestForm />
    </Suspense>
  );
}
