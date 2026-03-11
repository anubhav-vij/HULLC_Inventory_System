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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const todayStr = new Date().toLocaleDateString('en-CA');

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

    const errors: Record<string, string> = {};

    if (!project) {
      errors.project = 'Please select a project.';
    }

    if (!justification.trim()) {
      errors.justification = 'Justification is required.';
    }

    if (!sopRead) {
      errors.sopRead = 'You must confirm you have read the SOP.';
    }

    if (lineItems.length === 0) {
      errors.lineItems = 'At least one line item is required.';
    }

    const newLineItemErrors: Record<string, string> = {};
    const todayDate = new Date().toLocaleDateString('en-CA');
    for (const li of lineItems) {
      if (!li.requestedDate) {
        newLineItemErrors[li.id] = 'Date is required.';
      } else if (li.requestedDate < todayDate) {
        newLineItemErrors[li.id] = 'Date must be today or in the future.';
      }
      if (li.quantity < 1) {
        newLineItemErrors[`${li.id}-qty`] = 'Quantity must be at least 1.';
      }
    }

    setFormErrors(errors);
    setLineItemErrors(newLineItemErrors);

    if (Object.keys(errors).length > 0 || Object.keys(newLineItemErrors).length > 0) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id ?? '' },
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
        <div className="mb-4 flex items-center gap-2" style={{ backgroundColor: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#92400e' }}>
          <span style={{ color: '#ef4444' }}>*</span> Required fields are marked with an asterisk
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Product Info */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <div style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0', padding: '14px 16px' }}>
                <h3 style={{ color: '#0f2a2a', fontSize: '15px', fontWeight: 700, margin: 0 }}>Product</h3>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: '0 0 12px 12px' }} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Product Name</Label>
                  <Input value={product.name} readOnly style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} className="bg-muted" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Manufacturer Part #</Label>
                  <Input value={(product as any).manufacturerPartNumber ?? ''} readOnly style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} className="bg-muted" />
                </div>
                {(product as any).somApprovalRequired && (
                  <div>
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: '#fff7ed', color: '#c2410c' }}>SOM</span>
                    <span className="text-xs ml-2" style={{ color: '#64748b' }}>This product requires SOM approval</span>
                  </div>
                )}
              </div>
            </div>

            {/* Requestor Info */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <div style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0', padding: '14px 16px' }}>
                <h3 style={{ color: '#0f2a2a', fontSize: '15px', fontWeight: 700, margin: 0 }}>Requestor Information</h3>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: '0 0 12px 12px' }} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Name</Label>
                  <Input value={user.fullName ?? ''} readOnly style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} className="bg-muted" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Email</Label>
                  <Input value={user.email ?? ''} readOnly style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} className="bg-muted" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Functional Group / Department</Label>
                  <Input value={user.functionalGroupName ?? user.department ?? ''} readOnly style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} className="bg-muted" />
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <div style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0', padding: '14px 16px' }}>
                <h3 style={{ color: '#0f2a2a', fontSize: '15px', fontWeight: 700, margin: 0 }}>Request Details</h3>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: '0 0 12px 12px' }} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="project" style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Project<span style={{ color: '#ef4444' }}> *</span></Label>
                  <Select value={project} onValueChange={(v) => { setProject(v); setFormErrors(prev => { const next = { ...prev }; delete next.project; return next; }); }}>
                    <SelectTrigger id="project" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }}>
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.project && <p className="text-xs text-destructive mt-0.5">{formErrors.project}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="justification" style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Justification<span style={{ color: '#ef4444' }}> *</span></Label>
                  <Textarea
                    id="justification"
                    value={justification}
                    onChange={e => { setJustification(e.target.value); if (e.target.value.trim()) setFormErrors(prev => { const next = { ...prev }; delete next.justification; return next; }); }}
                    placeholder="Explain why you need this product..."
                    rows={4}
                    style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }}
                  />
                  {formErrors.justification && <p className="text-xs text-destructive mt-0.5">{formErrors.justification}</p>}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="sop-read"
                      checked={sopRead}
                      onCheckedChange={v => { setSopRead(v === true); if (v === true) setFormErrors(prev => { const next = { ...prev }; delete next.sopRead; return next; }); }}
                    />
                    <Label htmlFor="sop-read" className="cursor-pointer" style={{ color: '#475569', fontSize: '13px' }}>
                      I confirm that I have read and understood the Standard Operating Procedure (SOP) for this product.<span style={{ color: '#ef4444' }}> *</span>
                    </Label>
                  </div>
                  {formErrors.sopRead && <p className="text-xs text-destructive mt-1 ml-6">{formErrors.sopRead}</p>}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                <div style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0', padding: '14px 16px' }} className="flex justify-between items-center">
                  <div>
                    <h3 style={{ color: '#0f2a2a', fontSize: '15px', fontWeight: 700, margin: 0 }}>Requested Quantities</h3>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: 2 }}>Add one row per date you need items delivered.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Row
                  </Button>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: '0 0 12px 12px' }}>
                  {formErrors.lineItems && <p className="text-xs text-destructive mb-2">{formErrors.lineItems}</p>}
                  <div className="border rounded-lg overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#f1f5f9' }}>
                          <TableHead style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Requested Date<span style={{ color: '#ef4444' }}> *</span></TableHead>
                          <TableHead style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Quantity<span style={{ color: '#ef4444' }}> *</span></TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map(li => (
                          <TableRow key={li.id} style={{ backgroundColor: '#fff' }}>
                            <TableCell>
                              <Input
                                type="date"
                                value={li.requestedDate}
                                min={todayStr}
                                onChange={e => updateLineItem(li.id, 'requestedDate', e.target.value)}
                                style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }}
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
                                style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }}
                              />
                              {lineItemErrors[`${li.id}-qty`] && (
                                <p className="text-xs text-destructive mt-1">{lineItemErrors[`${li.id}-qty`]}</p>
                              )}
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
