
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ChevronsUpDown, MoreHorizontal, Package, Pencil, PlusCircle, Warehouse, ArrowRightLeft, CloudUpload, Loader2, AlertTriangle, Download, Trash2, CheckCircle2, XCircle, Hourglass, FileText, Search, LogOut, Users, Building2, UserCog, ShieldAlert } from 'lucide-react';
import { ProductForm } from './product-form';
import { TransactionForm } from './transaction-form';
import { RequestForm } from './request-form';
import { type Product, type Lot, type ProductFormData, type Transaction, type TransactionFormData, type User, type UserRole, USER_ROLES, type SystemUser, type FunctionalGroup, type ProductRequest, type ProductRequestFormData, type ProductRequestStatus, DEPARTMENTS, type DepartmentalProduct, type Fulfillment } from '@/lib/types';
import { HullcLogo } from './icons';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { format, isValid } from 'date-fns';
import Papa from 'papaparse';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { deleteFile, getFile } from '@/lib/file-store';
import { Input } from '@/components/ui/input';
import { DepartmentalPage } from './departmental-page';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

const USER_STORAGE_KEY = 'hullc-user-data';
const DEPT_PRODUCTS_STORAGE_KEY_PREFIX = 'hullc-dept-products';

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


export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [productRequests, setProductRequests] = useState<ProductRequest[]>([]);
    const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [productForTransaction, setProductForTransaction] = useState<Product | null>(null);
    const [productForRequest, setProductForRequest] = useState<Product | null>(null);
    const [fulfillmentToUpdate, setFulfillmentToUpdate] = useState<Fulfillment | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openProductIds, setOpenProductIds] = useState<Set<string>>(new Set());
    const [openTransactionIds, setOpenTransactionIds] = useState<Set<string>>(new Set());
    const [openRequestIds, setOpenRequestIds] = useState<Set<string>>(new Set());
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [requestToReject, setRequestToReject] = useState<ProductRequest | null>(null);
    const [fulfillmentToCancel, setFulfillmentToCancel] = useState<Fulfillment | null>(null);
    const [rejectionNote, setRejectionNote] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Login form state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isLoginLoading, setIsLoginLoading] = useState(false);

    // User Management state
    const [appUsers, setAppUsers] = useState<SystemUser[]>([]);
    const [functionalGroups, setFunctionalGroups] = useState<FunctionalGroup[]>([]);
    const [isUserFormOpen, setIsUserFormOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<SystemUser | null>(null);
    const [userFormData, setUserFormData] = useState({ fullName: '', email: '', password: '', role: 'Staff' as UserRole, functionalGroupId: '' });
    const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<FunctionalGroup | null>(null);
    const [groupFormName, setGroupFormName] = useState('');

    const { toast } = useToast();

        const totalQuantity = (lots: Lot[]) => lots.reduce((sum, lot) => sum + lot.quantity, 0);

    const productDemand = useMemo(() => {
        const demandMap = new Map<string, number>();

        productRequests.forEach(req => {
            if (req.status === 'Pending' || req.status === 'In Progress') {
                demandMap.set(req.productId, (demandMap.get(req.productId) || 0) + req.quantity);
            }
        });

        return demandMap;
    }, [productRequests]);

    const filteredProducts = useMemo(() => {
        if (!searchQuery) {
            return products;
        }
        const lowercasedQuery = searchQuery.toLowerCase();
        return products.filter(product =>
            product.name.toLowerCase().includes(lowercasedQuery) ||
            product.vendorPartNumber.toLowerCase().includes(lowercasedQuery) ||
            product.id.toLowerCase().includes(lowercasedQuery)
        );
    }, [products, searchQuery]);

    const toggleProductCollapse = (productId: string) => {
        setOpenProductIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };

    const toggleTransactionCollapse = (transactionId: string) => {
        setOpenTransactionIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(transactionId)) {
                newSet.delete(transactionId);
            } else {
                newSet.add(transactionId);
            }
            return newSet;
        });
    };

    const toggleRequestCollapse = (requestId: string) => {
        setOpenRequestIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(requestId)) {
                newSet.delete(requestId);
            } else {
                newSet.add(requestId);
            }
            return newSet;
        });
    };

    useEffect(() => {
        try {
            const storedUserItem = window.localStorage.getItem(USER_STORAGE_KEY);
            if (storedUserItem) {
                const parsed = JSON.parse(storedUserItem);
                // Only restore sessions that came from the new login flow (have an id)
                if (parsed && parsed.id) {
                    setUser(parsed);
                } else {
                    // Clear old-format placeholder sessions
                    window.localStorage.removeItem(USER_STORAGE_KEY);
                }
            }
        } catch (e) { console.error(e) }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const loadData = async () => {
            setIsLoading(true);
            try {
                const adminHeaders = { 'x-user-role': user.role };
                const [pRes, tRes, rRes, fRes] = await Promise.all([
                    fetch('/api/products'),
                    fetch('/api/transactions'),
                    fetch('/api/requests'),
                    fetch('/api/fulfillments'),
                ]);
                if (!pRes.ok) throw new Error('Failed to load products');
                if (!tRes.ok) throw new Error('Failed to load transactions');
                if (!rRes.ok) throw new Error('Failed to load requests');
                if (!fRes.ok) throw new Error('Failed to load fulfillments');
                const [pData, tData, rData, fData] = await Promise.all([
                    pRes.json(), tRes.json(), rRes.json(), fRes.json(),
                ]);
                setProducts(pData.map(coerceProduct));
                setTransactions(tData.map((tx: any) => ({ ...tx, date: new Date(tx.date) })));
                setProductRequests(rData.map((r: any) => ({ ...r, date: new Date(r.date) })));
                setFulfillments(fData.map((f: any) => ({
                    ...f,
                    dispensedItems: (f.dispensedItems ?? []).map((tx: any) => ({ ...tx, date: new Date(tx.date) })),
                })));

                // Load user management data for Admin
                if (user.role === 'Admin') {
                    const [usersRes, groupsRes] = await Promise.all([
                        fetch('/api/users', { headers: adminHeaders }),
                        fetch('/api/functional-groups?active=false'),
                    ]);
                    if (usersRes.ok) setAppUsers(await usersRes.json());
                    if (groupsRes.ok) setFunctionalGroups(await groupsRes.json());
                }
            } catch (error: any) {
                console.error('Error loading data', error);
                toast({ title: 'Load Error', description: error.message || 'Could not load inventory data.', variant: 'destructive' });
                setProducts([]);
                setTransactions([]);
                setProductRequests([]);
                setFulfillments([]);
            }
            setIsLoading(false);
        };

        loadData();
    }, [user]);


    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoginLoading(true);
        setLoginError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail, password: loginPassword }),
            });
            const data = await res.json();
            if (!res.ok) {
                setLoginError(data.error || 'Login failed');
                return;
            }
            const loggedInUser: User = {
                id: data.id,
                role: data.role,
                department: data.department ?? 'core',
                fullName: data.fullName,
                email: data.email,
                functionalGroupId: data.functionalGroupId,
                functionalGroupName: data.functionalGroupName,
                isActive: data.isActive,
            };
            setUser(loggedInUser);
            window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
        } catch {
            setLoginError('Network error. Please try again.');
        } finally {
            setIsLoginLoading(false);
        }
    };

    const handleLogout = () => {
        setUser(null);
        window.localStorage.removeItem(USER_STORAGE_KEY);
        setProducts([]);
        setTransactions([]);
        setProductRequests([]);
        setAppUsers([]);
        setFunctionalGroups([]);
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
    };

    // ─── User Management handlers ────────────────────────────────────────────

    const adminHeaders = () => ({ 'Content-Type': 'application/json', 'x-user-role': user?.role ?? '' });

    const handleOpenUserForm = (u: SystemUser | null) => {
        setUserToEdit(u);
        setUserFormData(u
            ? { fullName: u.fullName, email: u.email, password: '', role: u.role, functionalGroupId: u.functionalGroupId ?? '' }
            : { fullName: '', email: '', password: '', role: 'Staff', functionalGroupId: '' }
        );
        setIsUserFormOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const body: any = {
                fullName: userFormData.fullName,
                email: userFormData.email,
                role: userFormData.role,
                functionalGroupId: userFormData.functionalGroupId || null,
                department: 'core',
            };
            if (!userToEdit) body.password = userFormData.password;

            const url = userToEdit ? `/api/users/${userToEdit.id}` : '/api/users';
            const method = userToEdit ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: adminHeaders(), body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save user');

            if (userToEdit) {
                setAppUsers(prev => prev.map(u => u.id === data.id ? data : u));
                toast({ title: 'User Updated', description: `${data.fullName} has been updated.` });
            } else {
                setAppUsers(prev => [...prev, data]);
                toast({ title: 'User Created', description: `${data.fullName} has been added.` });
            }
            setIsUserFormOpen(false);
        } catch (error: any) {
            toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleUserStatus = async (u: SystemUser) => {
        try {
            const res = await fetch(`/api/users/${u.id}/status`, {
                method: 'PUT',
                headers: adminHeaders(),
                body: JSON.stringify({ isActive: !u.isActive }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update status');
            setAppUsers(prev => prev.map(su => su.id === u.id ? { ...su, isActive: data.isActive } : su));
            toast({ title: u.isActive ? 'User Deactivated' : 'User Activated', description: `${u.fullName} is now ${data.isActive ? 'active' : 'inactive'}.` });
        } catch (error: any) {
            toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
        }
    };

    const handleOpenGroupForm = (g: FunctionalGroup | null) => {
        setGroupToEdit(g);
        setGroupFormName(g?.name ?? '');
        setIsGroupFormOpen(true);
    };

    const handleSaveGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const url = groupToEdit ? `/api/functional-groups/${groupToEdit.id}` : '/api/functional-groups';
            const method = groupToEdit ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: adminHeaders(), body: JSON.stringify({ name: groupFormName }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save group');

            if (groupToEdit) {
                setFunctionalGroups(prev => prev.map(g => g.id === data.id ? data : g));
                toast({ title: 'Group Updated', description: `"${data.name}" has been updated.` });
            } else {
                setFunctionalGroups(prev => [...prev, data]);
                toast({ title: 'Group Created', description: `"${data.name}" has been added.` });
            }
            setIsGroupFormOpen(false);
        } catch (error: any) {
            toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleGroupStatus = async (g: FunctionalGroup) => {
        try {
            const res = await fetch(`/api/functional-groups/${g.id}`, {
                method: 'PUT',
                headers: adminHeaders(),
                body: JSON.stringify({ isActive: !g.isActive }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update group');
            setFunctionalGroups(prev => prev.map(fg => fg.id === g.id ? data : fg));
            toast({ title: g.isActive ? 'Group Deactivated' : 'Group Activated', description: `"${g.name}" is now ${data.isActive ? 'active' : 'inactive'}.` });
        } catch (error: any) {
            toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
        }
    };

    // ─── Product handlers ────────────────────────────────────────────────────

    const handleAddNew = () => {
        setProductToEdit(null);
        setIsFormOpen(true);
    };

    const handleEdit = (product: Product) => {
        setProductToEdit(product);
        setIsFormOpen(true);
    };

    const handleNewTransaction = (product: Product) => {
        setProductForTransaction(product);
        setIsTransactionFormOpen(true);
    };

    const handleRequestProduct = (product: Product) => {
        setProductForRequest(product);
        setIsRequestFormOpen(true);
    };

    const handleDeleteProduct = (product: Product) => {
        setProductToDelete(product);
    };

    const handleConfirmDeleteProduct = async () => {
        if (!productToDelete) return;
        setIsSaving(true);
        try {
            for (const lot of productToDelete.lots) {
                if (lot.file?.id) await deleteFile(lot.file.id);
            }
            const res = await fetch(`/api/products/${productToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to delete product');
            }
            setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
            toast({ title: 'Product Deleted', description: `"${productToDelete.name}" has been removed.` });
            setProductToDelete(null);
        } catch (error: any) {
            toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTransaction = (transaction: Transaction) => {
        setTransactionToDelete(transaction);
    };

    const handleConfirmDeleteTransaction = async () => {
        if (!transactionToDelete) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/transactions/${transactionToDelete.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to delete transaction');
            }
            setTransactions(prev => prev.filter(t => t.id !== transactionToDelete.id));
            const pRes = await fetch('/api/products');
            if (pRes.ok) setProducts((await pRes.json()).map(coerceProduct));
            toast({ title: 'Transaction Deleted', description: `Transaction from ${format(transactionToDelete.date, 'PPP')} has been removed.` });
            setTransactionToDelete(null);
        } catch (error: any) {
            toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveProduct = async (data: ProductFormData) => {
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
            if (productToEdit) {
                const originalLotIds = new Set(productToEdit.lots.map(l => l.id));
                const currentLotIds = new Set(data.lots.map(l => l.id));
                for (const lotId of originalLotIds) {
                    if (!currentLotIds.has(lotId)) {
                        const lotToRemove = productToEdit.lots.find(l => l.id === lotId);
                        if (lotToRemove?.file?.id) await deleteFile(lotToRemove.file.id);
                    }
                }
                const res = await fetch(`/api/products/${productToEdit.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error((body as any).error || 'Failed to update product');
                }
                const updated = coerceProduct(await res.json());
                setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
                toast({ title: 'Product Updated', description: `"${data.name}" has been updated successfully.` });
            } else {
                const res = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error((body as any).error || 'Failed to create product');
                }
                const created = coerceProduct(await res.json());
                setProducts(prev => [...prev, created]);
                toast({ title: 'Product Added', description: `"${data.name}" has been added successfully.` });
            }
            setIsFormOpen(false);
            setProductToEdit(null);
        } catch (error: any) {
            console.error('Error saving product:', error);
            toast({ title: 'Save Failed', description: error.message || 'There was an error saving the product.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const addFulfilledItemsToDepartmentInventory = (department: string, productId: string, quantity: number) => {
        const deptKey = `${DEPT_PRODUCTS_STORAGE_KEY_PREFIX}-${department}`;
        const deptProductsRaw = window.localStorage.getItem(deptKey);
        let deptProducts: DepartmentalProduct[] = deptProductsRaw ? JSON.parse(deptProductsRaw) : [];

        const coreProduct = products.find(p => p.id === productId);
        if (!coreProduct) return;

        const deptProductIndex = deptProducts.findIndex(p => p.id === productId);

        if (deptProductIndex > -1) {
            deptProducts = deptProducts.map((p, index) =>
                index === deptProductIndex
                    ? { ...p, quantity: p.quantity + quantity }
                    : p
            );
        } else {
            const newDeptProduct: DepartmentalProduct = {
                id: coreProduct.id,
                name: coreProduct.name,
                vendor: coreProduct.vendor,
                vendorPartNumber: coreProduct.vendorPartNumber,
                quantity: quantity,
            };
            deptProducts.push(newDeptProduct);
        }

        window.localStorage.setItem(deptKey, JSON.stringify(deptProducts));
    };


    const handleSaveTransaction = async (data: TransactionFormData) => {
        if (!productForTransaction) return;
        setIsSaving(true);
        try {
            const activeItems = data.items.filter(item => item.quantityTaken > 0);
            const totalDispensed = activeItems.reduce((sum, i) => sum + i.quantityTaken, 0);

            if (fulfillmentToUpdate) {
                // Path B: dispense for a fulfillment
                const res = await fetch(`/api/fulfillments/${fulfillmentToUpdate.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: data.date instanceof Date ? data.date.toISOString() : data.date,
                        notes: data.notes,
                        items: activeItems.map(i => ({ lotId: i.lotId, quantityTaken: i.quantityTaken })),
                    }),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error((body as any).error || 'Failed to dispense items');
                }
                const request = productRequests.find(r => r.id === fulfillmentToUpdate.requestId);
                if (request) {
                    addFulfilledItemsToDepartmentInventory(request.department, productForTransaction.id, totalDispensed);
                }
                // Re-fetch all affected state
                const [fRes, rRes, txRes, pRes] = await Promise.all([
                    fetch('/api/fulfillments'),
                    fetch('/api/requests'),
                    fetch('/api/transactions'),
                    fetch('/api/products'),
                ]);
                if (fRes.ok) {
                    const fData = await fRes.json();
                    setFulfillments(fData.map((f: any) => ({
                        ...f,
                        dispensedItems: (f.dispensedItems ?? []).map((tx: any) => ({ ...tx, date: new Date(tx.date) })),
                    })));
                }
                if (rRes.ok) setProductRequests((await rRes.json()).map((r: any) => ({ ...r, date: new Date(r.date) })));
                if (txRes.ok) setTransactions((await txRes.json()).map((tx: any) => ({ ...tx, date: new Date(tx.date) })));
                if (pRes.ok) setProducts((await pRes.json()).map(coerceProduct));
                toast({ title: 'Dispensation Saved', description: `Dispensed ${totalDispensed} of "${productForTransaction.name}".` });
            } else {
                // Path A: standalone transaction
                const res = await fetch('/api/transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productId: productForTransaction.id,
                        date: data.date instanceof Date ? data.date.toISOString() : data.date,
                        notes: data.notes,
                        items: activeItems.map(i => ({ lotId: i.lotId, quantityTaken: i.quantityTaken })),
                    }),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error((body as any).error || 'Failed to create transaction');
                }
                const created = await res.json();
                setTransactions(prev => [{ ...created, date: new Date(created.date) }, ...prev]);
                const pRes = await fetch('/api/products');
                if (pRes.ok) setProducts((await pRes.json()).map(coerceProduct));
                toast({ title: 'Transaction Saved', description: `Dispensed ${totalDispensed} of "${productForTransaction.name}".` });
            }
            setIsTransactionFormOpen(false);
            setProductForTransaction(null);
            setFulfillmentToUpdate(null);
        } catch (error: any) {
            toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveRequest = async (data: ProductRequestFormData) => {
        if (!productForRequest) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: productForRequest.id,
                    productName: productForRequest.name,
                    ...data,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to submit request');
            }
            const created = await res.json();
            setProductRequests(prev => [{ ...created, date: new Date(created.date) }, ...prev]);
            toast({
                title: 'Request Submitted',
                description: `Your request for ${data.quantity} of "${productForRequest.name}" has been sent for review.`,
            });
            setIsRequestFormOpen(false);
            setProductForRequest(null);
        } catch (error: any) {
            toast({ title: 'Submit Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFulfillRequest = async (request: ProductRequest) => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/fulfillments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: request.id }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to start fulfillment');
            }
            const created = await res.json();
            setFulfillments(prev => [...prev, {
                ...created,
                dispensedItems: (created.dispensedItems ?? []).map((tx: any) => ({ ...tx, date: new Date(tx.date) })),
            }]);
            setProductRequests(prev => prev.map(r =>
                r.id === request.id ? { ...r, status: 'In Progress' as ProductRequestStatus } : r
            ));
            toast({ title: 'Request In Progress', description: `Request for "${request.productName}" is now being fulfilled.` });
        } catch (error: any) {
            toast({ title: 'Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDispenseForFulfillment = (fulfillment: Fulfillment) => {
        const product = products.find(p => p.id === fulfillment.productId);
        if (product) {
            setFulfillmentToUpdate(fulfillment);
            setProductForTransaction(product);
            setIsTransactionFormOpen(true);
        } else {
            toast({ title: "Product Not Found", description: "The product for this fulfillment no longer exists.", variant: "destructive" });
        }
    };

    const handleRejectRequest = (request: ProductRequest) => {
        setRequestToReject(request);
        setRejectionNote('');
    };

    const handleConfirmRejectRequest = async () => {
        if (!requestToReject) return;
        if (!rejectionNote.trim()) {
            toast({ title: 'Note Required', description: 'Please provide a reason for rejecting the request.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch(`/api/requests/${requestToReject.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Rejected', rejectionNote }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to reject request');
            }
            const updated = await res.json();
            setProductRequests(prev => prev.map(r =>
                r.id === updated.id ? { ...updated, date: new Date(updated.date) } : r
            ));
            toast({ title: 'Request Rejected' });
            setRequestToReject(null);
        } catch (error: any) {
            toast({ title: 'Reject Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelFulfillment = (fulfillment: Fulfillment) => {
        setFulfillmentToCancel(fulfillment);
    };

    const handleConfirmCancelFulfillment = async () => {
        if (!fulfillmentToCancel) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/fulfillments/${fulfillmentToCancel.id}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to cancel fulfillment');
            }
            setFulfillments(prev => prev.filter(f => f.id !== fulfillmentToCancel.id));
            const rRes = await fetch('/api/requests');
            if (rRes.ok) setProductRequests((await rRes.json()).map((r: any) => ({ ...r, date: new Date(r.date) })));
            toast({ title: 'Fulfillment Cancelled', description: `The fulfillment for "${fulfillmentToCancel.productName}" has been cancelled.` });
            setFulfillmentToCancel(null);
        } catch (error: any) {
            toast({ title: 'Cancel Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        Papa.parse<any>(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const requiredHeaders = [
                        'product_id', 'product_name', 'vendor', 'vendor_part_number', 'location',
                        'lot_number', 'quantity', 'receipt_date', 'expiration_date', 'reorder_threshold', 'notes'
                    ];
                    const headers = results.meta.fields || [];
                    if (!requiredHeaders.every(h => headers.includes(h))) {
                        throw new Error(`CSV must contain the following headers: ${requiredHeaders.join(', ')}`);
                    }

                    const importedProductsMap = new Map<string, any>();
                    for (const row of results.data) {
                        const {
                            product_id, product_name, vendor, vendor_part_number, location,
                            lot_number, quantity, receipt_date, expiration_date, reorder_threshold, notes
                        } = row;
                        if (!product_id || !product_name || !lot_number) continue;
                        const lot = {
                            id: uuidv4(),
                            lotNumber: lot_number,
                            quantity: parseInt(quantity, 10) || 0,
                            receiptDate: receipt_date,
                            expirationDate: expiration_date || null,
                            location,
                            file: null,
                            notes: notes || '',
                        };
                        if (importedProductsMap.has(product_id)) {
                            importedProductsMap.get(product_id).lots.push(lot);
                        } else {
                            importedProductsMap.set(product_id, {
                                id: product_id,
                                name: product_name,
                                vendor,
                                vendorPartNumber: vendor_part_number,
                                reorderThreshold: reorder_threshold ? parseInt(reorder_threshold, 10) : null,
                                lots: [lot],
                            });
                        }
                    }

                    const csvProducts = Array.from(importedProductsMap.values());
                    if (csvProducts.length === 0) {
                        toast({ title: 'Import Failed', description: 'No valid product data found in the file.', variant: 'destructive' });
                        return;
                    }

                    const existingIds = new Set(products.map(p => p.id));
                    let successCount = 0;
                    const importErrors: string[] = [];

                    for (const product of csvProducts) {
                        try {
                            if (existingIds.has(product.id)) {
                                const res = await fetch(`/api/products/${product.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(product),
                                });
                                if (!res.ok) {
                                    const b = await res.json().catch(() => ({}));
                                    importErrors.push(`${product.id}: ${(b as any).error || 'update failed'}`);
                                } else { successCount++; }
                            } else {
                                const { id: _ignored, ...productWithoutId } = product;
                                const res = await fetch('/api/products', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(productWithoutId),
                                });
                                if (!res.ok) {
                                    const b = await res.json().catch(() => ({}));
                                    importErrors.push(`${product.name}: ${(b as any).error || 'create failed'}`);
                                } else { successCount++; }
                            }
                        } catch { importErrors.push(`${product.name}: network error`); }
                    }

                    const pRes = await fetch('/api/products');
                    if (pRes.ok) setProducts((await pRes.json()).map(coerceProduct));

                    if (importErrors.length > 0) {
                        toast({ title: 'Import Partial', description: `${successCount} imported, ${importErrors.length} failed: ${importErrors.slice(0, 2).join('; ')}`, variant: 'destructive' });
                    } else {
                        toast({ title: 'Import Successful', description: `${successCount} product(s) imported.` });
                    }
                } catch (error: any) {
                    toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
                } finally {
                    setIsImporting(false);
                    setIsImportDialogOpen(false);
                    if (event.target) event.target.value = '';
                }
            },
            error: (error: any) => {
                toast({ title: 'Import Error', description: error.message, variant: 'destructive' });
                setIsImporting(false);
            }
        });
    };

    const handleExportInventory = () => {
        const dataToExport = products.flatMap(product =>
            product.lots.map(lot => ({
                'product_id': product.id,
                'product_name': product.name,
                'vendor': product.vendor,
                'vendor_part_number': product.vendorPartNumber,
                'reorder_threshold': product.reorderThreshold ?? '',
                'lot_id': lot.id,
                'lot_number': lot.lotNumber,
                'quantity': lot.quantity,
                'receipt_date': isValid(lot.receiptDate) ? format(lot.receiptDate, 'yyyy-MM-dd') : '',
                'expiration_date': lot.expirationDate && isValid(lot.expirationDate) ? format(lot.expirationDate, 'yyyy-MM-dd') : '',
                'location': lot.location,
                'file_name': lot.file?.name ?? '',
                'notes': lot.notes ?? '',
            }))
        );

        if (dataToExport.length === 0) {
            toast({ title: "No Data", description: "There is no inventory data to export.", variant: "destructive" });
            return;
        }

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.href) {
            URL.revokeObjectURL(link.href);
        }
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', 'inventory_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Export Started", description: "Your inventory data is downloading." });
    };

    const handleExportTransactions = () => {
        const dataToExport = transactions.flatMap(tx =>
            tx.items.map(item => ({
                'transaction_id': tx.id,
                'transaction_date': format(tx.date, 'yyyy-MM-dd HH:mm:ss'),
                'transaction_notes': tx.notes ?? '',
                'product_id': tx.productId,
                'product_name': tx.productName,
                'requestor_name': tx.requestorName ?? 'N/A',
                'department': tx.department ?? 'N/A',
                'lot_id': item.lotId,
                'lot_number': item.lotNumber,
                'quantity_dispensed': item.quantity,
            }))
        );

        if (dataToExport.length === 0) {
            toast({ title: "No Data", description: "There are no transactions to export.", variant: "destructive" });
            return;
        }

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.href) {
            URL.revokeObjectURL(link.href);
        }
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', 'transactions_export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Export Started", description: "Your transaction data is downloading." });
    };

    const handleDownloadFile = async (lot: Lot) => {
        if (lot.file?.id) {
            const fileBlob = await getFile(lot.file.id);
            if (fileBlob) {
                const url = URL.createObjectURL(fileBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = lot.file.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                toast({ title: "Download Failed", description: "File not found in storage.", variant: "destructive" });
            }
        }
    };

    const getDisplayLocation = (lots: Lot[]) => {
        if (!lots || lots.length === 0) return 'N/A';
        const uniqueLocations = [...new Set(lots.map(lot => lot.location))];
        if (uniqueLocations.length === 1) return uniqueLocations[0];
        return "Multiple Locations";
    };

    const needsReorder = (product: Product) => {
        if (product.reorderThreshold === null || product.reorderThreshold === undefined) {
            return false;
        }
        return totalQuantity(product.lots) <= product.reorderThreshold;
    };

    const isProductOutOfStock = (product: Product) => {
        return totalQuantity(product.lots) === 0;
    };

    const isProductExpired = (product: Product) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return product.lots.some(
            (lot) => lot.quantity > 0 && lot.expirationDate && isValid(lot.expirationDate) && lot.expirationDate < today
        );
    };

    const getStatusBadge = (status: ProductRequestStatus) => {
        const statusConfig = {
            'Pending': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Hourglass },
            'In Progress': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: ArrowRightLeft },
            'Completed': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
            'Rejected': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
        };
        const Icon = statusConfig[status].icon;
        return (
            <Badge className={cn('gap-1', statusConfig[status].color)}>
                <Icon className={cn("h-3 w-3")} />
                {status}
            </Badge>
        );
    };

    if (isLoading && !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Card className="w-full max-w-sm">
                    <CardHeader className="text-center">
                        <div className="flex justify-center items-center gap-3 mb-4">
                            <HullcLogo className="h-8 w-8 text-primary" />
                            <CardTitle className="text-2xl">HULLC Inventory Management System</CardTitle>
                        </div>
                        <CardDescription>Sign in with your HULLC account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="login-email">Email</Label>
                                <Input
                                    id="login-email"
                                    type="email"
                                    placeholder="your@nih.gov"
                                    value={loginEmail}
                                    onChange={e => setLoginEmail(e.target.value)}
                                    required
                                    disabled={isLoginLoading}
                                    autoComplete="email"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="login-password">Password</Label>
                                <Input
                                    id="login-password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={loginPassword}
                                    onChange={e => setLoginPassword(e.target.value)}
                                    required
                                    disabled={isLoginLoading}
                                    autoComplete="current-password"
                                />
                            </div>
                            {loginError && (
                                <p className="text-sm text-destructive flex items-center gap-1.5">
                                    <ShieldAlert className="h-4 w-4 shrink-0" />
                                    {loginError}
                                </p>
                            )}
                            <Button type="submit" disabled={isLoginLoading} className="w-full">
                                {isLoginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sign In
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (user.department !== 'core') {
        return <DepartmentalPage user={user} onLogout={handleLogout} />;
    }

    const inventoryColSpan = user.role === 'Admin' ? 8 : 4;
    const requestsColSpan = 7;

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".csv" />
            <TooltipProvider>
                <main className="w-full max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-8">
                        <HullcLogo className="h-8 w-8 text-primary" />
                        <h1 className="text-3xl font-bold text-foreground">Core Inventory</h1>
                         <div className="ml-auto flex items-center gap-4 text-sm">
                            <div className="text-right">
                                <p className="font-semibold text-foreground">{user.fullName || user.role}</p>
                                <p className="text-muted-foreground">{user.role} · Core System</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </Button>
                        </div>
                    </div>

                    <Tabs defaultValue="inventory">
                        <TabsList className="mb-4">
                            <TabsTrigger value="inventory">Inventory</TabsTrigger>
                            {user.role === 'Admin' && <TabsTrigger value="requests">Product Requests <Badge className="ml-2 bg-primary/20 text-primary">{productRequests.filter(r => r.status === 'Pending').length}</Badge></TabsTrigger>}
                            {user.role === 'Admin' && <TabsTrigger value="fulfillments">Fulfillments <Badge className="ml-2 bg-primary/20 text-primary">{fulfillments.length}</Badge></TabsTrigger>}
                            {user.role === 'Admin' && <TabsTrigger value="transactions">Transactions</TabsTrigger>}
                            {user.role === 'Admin' && <TabsTrigger value="user-management"><Users className="mr-1.5 h-4 w-4" />User Management</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="inventory">
                            <Card>
                                <CardHeader>
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex-1">
                                            <CardTitle>Master Inventory</CardTitle>
                                            <CardDescription>Manage all products and their stock.</CardDescription>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 w-full sm:w-auto">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="search"
                                                    placeholder="Search products..."
                                                    className="pl-8 sm:w-[300px] w-full"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                />
                                            </div>
                                            {user.role === 'Admin' && (
                                                <div className="flex gap-2">
                                                    <Button variant="outline" onClick={handleExportInventory}>
                                                        <Download className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Export</span>
                                                    </Button>
                                                    <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                                                        <CloudUpload className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Import</span>
                                                    </Button>
                                                    <Button onClick={handleAddNew}>
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {user.role === 'Admin' && <TableHead className="w-[50px]"></TableHead>}
                                                    <TableHead>Product</TableHead>
                                                    <TableHead>Vendor</TableHead>
                                                    <TableHead>Vendor Part #</TableHead>
                                                    {user.role === 'Admin' && <TableHead>Total Quantity</TableHead>}
                                                    {user.role === 'Admin' && <TableHead>Needed</TableHead>}
                                                    {user.role === 'Admin' && <TableHead>Storage Location</TableHead>}
                                                    {user.role === 'Admin' ?
                                                        <TableHead className="w-[100px] text-right">Actions</TableHead> :
                                                        <TableHead className="w-[120px] text-right">Action</TableHead>
                                                    }
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredProducts.length > 0 ? (
                                                    filteredProducts.map(product => {
                                                        const outOfStock = isProductOutOfStock(product);
                                                        const isExpiredFlag = !outOfStock && isProductExpired(product);
                                                        const isOpen = openProductIds.has(product.id);
                                                        const demand = productDemand.get(product.id) || 0;
                                                        const needed = Math.max(0, demand - totalQuantity(product.lots));

                                                        return (
                                                            <React.Fragment key={product.id}>
                                                                <TableRow
                                                                    data-state={isOpen ? 'open' : 'closed'}
                                                                    className={cn("text-sm", {
                                                                        "bg-destructive/10 hover:bg-destructive/20": outOfStock,
                                                                        "bg-orange-100 dark:bg-orange-950 hover:bg-orange-200 dark:hover:bg-orange-900": isExpiredFlag,
                                                                    })}
                                                                >
                                                                    {user.role === 'Admin' && (
                                                                        <TableCell>
                                                                            <Button variant="ghost" size="sm" className="w-9 p-0 data-[state=open]:rotate-90" onClick={() => toggleProductCollapse(product.id)} data-state={isOpen ? 'open' : 'closed'}>
                                                                                <ChevronsUpDown className="h-4 w-4" />
                                                                                <span className="sr-only">Toggle</span>
                                                                            </Button>
                                                                        </TableCell>
                                                                    )}
                                                                    <TableCell className="font-medium">
                                                                        <div className="flex items-center gap-3"><Package className="h-5 w-5 text-muted-foreground"/><div><div>{product.name}</div><div className="text-xs text-muted-foreground">{product.id}</div></div></div>
                                                                    </TableCell>
                                                                    <TableCell>{product.vendor}</TableCell>
                                                                    <TableCell>{product.vendorPartNumber}</TableCell>
                                                                    {user.role === 'Admin' && (
                                                                        <TableCell>
                                                                            <div className="flex items-center gap-2">
                                                                                <Badge variant={needsReorder(product) ? "destructive" : "secondary"}>{totalQuantity(product.lots)}</Badge>
                                                                                {needsReorder(product) && (
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger>
                                                                                            <AlertTriangle className="h-4 w-4 text-destructive" />
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>
                                                                                            <p>Quantity is at or below reorder threshold ({product.reorderThreshold})</p>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    )}
                                                                    {user.role === 'Admin' && (
                                                                        <TableCell>
                                                                            {needed > 0 ? (
                                                                                <Tooltip>
                                                                                    <TooltipTrigger className="flex items-center gap-2">
                                                                                        <Badge variant="destructive">{needed}</Badge>
                                                                                        <AlertTriangle className="h-4 w-4 text-destructive" />
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>{demand} items requested, only {totalQuantity(product.lots)} in stock.</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            ) : (
                                                                                <span className="text-muted-foreground">-</span>
                                                                            )}
                                                                        </TableCell>
                                                                    )}
                                                                    {user.role === 'Admin' && (
                                                                        <TableCell><div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-muted-foreground"/>{getDisplayLocation(product.lots)}</div></TableCell>
                                                                    )}
                                                                    {user.role === 'Admin' ? (
                                                                        <TableCell className="text-right">
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end">
                                                                                    <DropdownMenuItem onClick={() => handleEdit(product)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => handleNewTransaction(product)}><ArrowRightLeft className="mr-2 h-4 w-4" /> New Transaction</DropdownMenuItem>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem onClick={() => handleDeleteProduct(product)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </TableCell>
                                                                    ) : (
                                                                        <TableCell className="text-right">
                                                                            <Button size="sm" onClick={() => handleRequestProduct(product)}>
                                                                                Request Item
                                                                            </Button>
                                                                        </TableCell>
                                                                    )}
                                                                </TableRow>
                                                                {isOpen && user.role === 'Admin' && (
                                                                     <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                        <TableCell colSpan={inventoryColSpan} className="p-0">
                                                                            <div className="p-4">
                                                                                <h4 className="font-semibold mb-2 ml-2">Lots for {product.name}</h4>
                                                                                <Table>
                                                                                    <TableHeader>
                                                                                        <TableRow>
                                                                                            <TableHead>Lot #</TableHead>
                                                                                            <TableHead>Quantity</TableHead>
                                                                                            <TableHead>Receipt Date</TableHead>
                                                                                            <TableHead>Expiration Date</TableHead>
                                                                                            <TableHead>Storage Location</TableHead>
                                                                                            <TableHead>File</TableHead>
                                                                                            <TableHead>Notes</TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody>
                                                                                        {product.lots.map(lot => (
                                                                                            <TableRow key={lot.id}>
                                                                                                <TableCell>{lot.lotNumber}</TableCell>
                                                                                                <TableCell>{lot.quantity}</TableCell>
                                                                                                <TableCell>{isValid(lot.receiptDate) ? format(lot.receiptDate, 'PPP') : 'Invalid Date'}</TableCell>
                                                                                                <TableCell>{lot.expirationDate && isValid(lot.expirationDate) ? format(lot.expirationDate, 'PPP') : 'N/A'}</TableCell>
                                                                                                <TableCell>{lot.location}</TableCell>
                                                                                                <TableCell>
                                                                                                    {lot.file ? (
                                                                                                        <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => handleDownloadFile(lot)}>
                                                                                                            <FileText className="mr-2 h-4 w-4" />
                                                                                                            <span className="truncate max-w-[150px]">{lot.file.name}</span>
                                                                                                        </Button>
                                                                                                    ) : (
                                                                                                        <span className="text-muted-foreground text-xs">No file</span>
                                                                                                    )}
                                                                                                </TableCell>
                                                                                                <TableCell className="text-xs text-muted-foreground">{lot.notes || 'N/A'}</TableCell>
                                                                                            </TableRow>
                                                                                        ))}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </React.Fragment>
                                                        )
                                                    })
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={inventoryColSpan} className="h-24 text-center">
                                                            {searchQuery ? 'No products found for your search.' : 'No products found. Get started by adding a new product.'}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                 </CardContent>
                            </Card>
                        </TabsContent>
                        {user.role === 'Admin' &&
                            <TabsContent value="requests">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Product Requests</CardTitle>
                                        <CardDescription>Review and fulfill pending product requests from staff.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                    <TableHead>Requestor</TableHead>
                                                    <TableHead>Product</TableHead>
                                                    <TableHead>Qty Req.</TableHead>
                                                    <TableHead>Submitted</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {productRequests.length > 0 ? (
                                                    productRequests.map(req => {
                                                         const isOpen = openRequestIds.has(req.id);
                                                         return (
                                                            <React.Fragment key={req.id}>
                                                                <TableRow data-state={isOpen ? 'open' : 'closed'}>
                                                                    <TableCell>
                                                                        <Button variant="ghost" size="sm" className="w-9 p-0 data-[state=open]:rotate-90" onClick={() => toggleRequestCollapse(req.id)} data-state={isOpen ? 'open' : 'closed'}>
                                                                            <ChevronsUpDown className="h-4 w-4" />
                                                                            <span className="sr-only">Toggle</span>
                                                                        </Button>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div>{req.requestorName}</div>
                                                                        <div className="text-xs text-muted-foreground">{req.department}</div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div>{req.productName}</div>
                                                                        <div className="text-xs text-muted-foreground">{req.productId}</div>
                                                                    </TableCell>
                                                                    <TableCell>{req.quantity}</TableCell>
                                                                    <TableCell>{format(req.date, 'PPP')}</TableCell>
                                                                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                                                                    <TableCell className="text-right">
                                                                        {req.status === 'Pending' && (
                                                                            <div className="flex gap-2 justify-end">
                                                                                <Button size="sm" variant="outline" disabled={isSaving} onClick={() => handleRejectRequest(req)}>Reject</Button>
                                                                                <Button size="sm" disabled={isSaving} onClick={() => handleFulfillRequest(req)}>Fulfill</Button>
                                                                            </div>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                                {isOpen && (
                                                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                        <TableCell colSpan={requestsColSpan} className="p-4">
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                                                                                <div>
                                                                                    <h4 className="font-semibold text-xs mb-1">Project</h4>
                                                                                    <p className="text-sm">{req.project}</p>
                                                                                </div>
                                                                                 <div>
                                                                                    <h4 className="font-semibold text-xs mb-1">Justification</h4>
                                                                                    <p className="text-sm text-muted-foreground">{req.justification}</p>
                                                                                </div>
                                                                                 {req.status === 'Rejected' && req.rejectionNote && (
                                                                                     <div className="col-span-2">
                                                                                         <h4 className="font-semibold text-xs mb-1 text-destructive">Rejection Note</h4>
                                                                                         <p className="text-sm text-destructive/80">{req.rejectionNote}</p>
                                                                                     </div>
                                                                                 )}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </React.Fragment>
                                                        )
                                                    })
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={requestsColSpan} className="h-24 text-center">No product requests have been submitted yet.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        }
                        {user.role === 'Admin' && (
                            <TabsContent value="fulfillments">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>In-Progress Fulfillments</CardTitle>
                                        <CardDescription>Manage requests that are being partially dispensed over time.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Product</TableHead>
                                                        <TableHead>Department</TableHead>
                                                        <TableHead>Quantity</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {fulfillments.length > 0 ? (
                                                        fulfillments.map(f => {
                                                            const dispensed = f.dispensedItems.reduce((sum, tx) => sum + tx.totalQuantity, 0);
                                                            return (
                                                                <TableRow key={f.id}>
                                                                    <TableCell>
                                                                        <div>{f.productName}</div>
                                                                        <div className="text-xs text-muted-foreground">{f.productId}</div>
                                                                    </TableCell>
                                                                    <TableCell>{f.department}</TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline">{dispensed} / {f.totalQuantityRequested}</Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <div className="flex gap-2 justify-end">
                                                                            <Button size="sm" variant="outline" disabled={isSaving} onClick={() => handleCancelFulfillment(f)}>
                                                                                Cancel
                                                                            </Button>
                                                                            <Button size="sm" disabled={isSaving} onClick={() => handleDispenseForFulfillment(f)}>
                                                                                Dispense Items
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="h-24 text-center">No requests are currently in progress.</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}
                        {user.role === 'Admin' &&
                            <TabsContent value="transactions">
                                <Card>
                                    <CardHeader>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <CardTitle>Transaction History</CardTitle>
                                                <CardDescription>View a log of all inventory transactions.</CardDescription>
                                            </div>
                                            <Button variant="outline" onClick={handleExportTransactions}>
                                                <Download className="mr-2 h-4 w-4" /> Export CSV
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                    <TableHead>Product</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Quantity Dispensed</TableHead>
                                                    <TableHead>Requestor</TableHead>
                                                    <TableHead>Department</TableHead>
                                                    <TableHead>Notes</TableHead>
                                                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                            {transactions.length > 0 ? (
                                                transactions.map(tx => {
                                                    const isOpen = openTransactionIds.has(tx.id);
                                                    return (
                                                        <React.Fragment key={tx.id}>
                                                            <TableRow data-state={isOpen ? 'open' : 'closed'}>
                                                                <TableCell>
                                                                    <Button variant="ghost" size="sm" className="w-9 p-0 data-[state=open]:rotate-90" onClick={() => toggleTransactionCollapse(tx.id)} data-state={isOpen ? 'open' : 'closed'}>
                                                                        <ChevronsUpDown className="h-4 w-4" />
                                                                        <span className="sr-only">Toggle</span>
                                                                    </Button>
                                                                </TableCell>
                                                                <TableCell className="font-medium">{tx.productName} <span className="text-muted-foreground text-xs">({tx.productId})</span></TableCell>
                                                                <TableCell>{format(tx.date, 'PPP')}</TableCell>
                                                                <TableCell><Badge variant="outline">-{tx.totalQuantity}</Badge></TableCell>
                                                                <TableCell>
                                                                    {tx.requestorName || <span className="text-muted-foreground">Manual Entry</span>}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {tx.department || <span className="text-muted-foreground">N/A</span>}
                                                                </TableCell>
                                                                <TableCell className="truncate max-w-xs">{tx.notes || 'N/A'}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuItem onClick={() => handleDeleteTransaction(tx)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                            {isOpen && (
                                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                    <TableCell colSpan={8} className="p-0">
                                                                        <div className="p-4">
                                                                            <h4 className="font-semibold mb-2 ml-2">Dispensed Lots</h4>
                                                                            <Table><TableHeader><TableRow><TableHead>Lot #</TableHead><TableHead>Quantity Taken</TableHead></TableRow></TableHeader><TableBody>{tx.items.map(item => (<TableRow key={item.lotId}><TableCell>{item.lotNumber}</TableCell><TableCell>{item.quantity}</TableCell></TableRow>))}</TableBody></Table>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )}
                                                        </React.Fragment>
                                                    )
                                                })
                                            ) : (
                                                <TableRow><TableCell colSpan={8} className="h-24 text-center">No transactions have been recorded yet.</TableCell></TableRow>
                                            )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        }

                        {/* ── User Management Tab ───────────────────────────── */}
                        {user.role === 'Admin' && (
                            <TabsContent value="user-management">
                                <div className="space-y-6">
                                    {/* Users table */}
                                    <Card>
                                        <CardHeader>
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> Users</CardTitle>
                                                    <CardDescription>Manage system users, roles, and functional group assignments.</CardDescription>
                                                </div>
                                                <Button onClick={() => handleOpenUserForm(null)}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Add User
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Email</TableHead>
                                                        <TableHead>Role</TableHead>
                                                        <TableHead>Functional Group</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {appUsers.length === 0 && (
                                                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found.</TableCell></TableRow>
                                                    )}
                                                    {appUsers.map(u => (
                                                        <TableRow key={u.id}>
                                                            <TableCell className="font-medium">{u.fullName}</TableCell>
                                                            <TableCell className="text-muted-foreground">{u.email}</TableCell>
                                                            <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                                                            <TableCell>{u.functionalGroupName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                                            <TableCell>
                                                                <Badge className={u.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}>
                                                                    {u.isActive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                                                    {u.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleOpenUserForm(u)}>
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Edit user</TooltipContent>
                                                                    </Tooltip>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleToggleUserStatus(u)}>
                                                                                {u.isActive ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{u.isActive ? 'Deactivate user' : 'Activate user'}</TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>

                                    {/* Functional Groups table */}
                                    <Card>
                                        <CardHeader>
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Functional Groups</CardTitle>
                                                    <CardDescription>Manage HULLC functional groups. Deactivating a group does not remove existing user assignments.</CardDescription>
                                                </div>
                                                <Button onClick={() => handleOpenGroupForm(null)}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Group
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Group Name</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {functionalGroups.length === 0 && (
                                                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No functional groups found.</TableCell></TableRow>
                                                    )}
                                                    {functionalGroups.map(g => (
                                                        <TableRow key={g.id}>
                                                            <TableCell className="font-medium">{g.name}</TableCell>
                                                            <TableCell>
                                                                <Badge className={g.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}>
                                                                    {g.isActive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                                                    {g.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleOpenGroupForm(g)}>
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Rename group</TooltipContent>
                                                                    </Tooltip>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleToggleGroupStatus(g)}>
                                                                                {g.isActive ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{g.isActive ? 'Deactivate group' : 'Activate group'}</TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>
                        )}
                    </Tabs>
                </main>
            </TooltipProvider>

            {/* ── User Form Dialog ─────────────────────────────────────── */}
            <Dialog open={isUserFormOpen} onOpenChange={setIsUserFormOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{userToEdit ? 'Edit User' : 'Add User'}</DialogTitle>
                        <DialogDescription>
                            {userToEdit ? 'Update user details, role, or functional group.' : 'Create a new user account. They can log in immediately.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveUser} className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="uf-fullname">Full Name</Label>
                            <Input id="uf-fullname" value={userFormData.fullName} onChange={e => setUserFormData(p => ({ ...p, fullName: e.target.value }))} required placeholder="Jane Smith" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="uf-email">Email</Label>
                            <Input id="uf-email" type="email" value={userFormData.email} onChange={e => setUserFormData(p => ({ ...p, email: e.target.value }))} required placeholder="jane@nih.gov" />
                        </div>
                        {!userToEdit && (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="uf-password">Temporary Password</Label>
                                <Input id="uf-password" type="password" value={userFormData.password} onChange={e => setUserFormData(p => ({ ...p, password: e.target.value }))} required minLength={8} placeholder="Min. 8 characters" />
                            </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="uf-role">Role</Label>
                            <Select value={userFormData.role} onValueChange={v => setUserFormData(p => ({ ...p, role: v as UserRole }))}>
                                <SelectTrigger id="uf-role"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {USER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="uf-group">Functional Group</Label>
                            {userFormData.role === 'Director' && (
                                <p className="text-xs text-amber-600 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Only one active Director is allowed per group.</p>
                            )}
                            <Select value={userFormData.functionalGroupId || 'none'} onValueChange={v => setUserFormData(p => ({ ...p, functionalGroupId: v === 'none' ? '' : v }))}>
                                <SelectTrigger id="uf-group"><SelectValue placeholder="None" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {functionalGroups.filter(g => g.isActive).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setIsUserFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {userToEdit ? 'Save Changes' : 'Create User'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Functional Group Form Dialog ─────────────────────────── */}
            <Dialog open={isGroupFormOpen} onOpenChange={setIsGroupFormOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{groupToEdit ? 'Rename Group' : 'Add Functional Group'}</DialogTitle>
                        <DialogDescription>
                            {groupToEdit ? 'Update the name of this functional group.' : 'Add a new functional group to the system.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveGroup} className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="gf-name">Group Name</Label>
                            <Input id="gf-name" value={groupFormName} onChange={e => setGroupFormName(e.target.value)} required placeholder="e.g., Formulation Development" />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsGroupFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {groupToEdit ? 'Save Changes' : 'Create Group'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-3xl flex flex-col max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>{productToEdit ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                    </DialogHeader>
                    <ProductForm
                        product={productToEdit}
                        onSave={handleSaveProduct}
                        onCancel={() => setIsFormOpen(false)}
                        isSaving={isSaving}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isTransactionFormOpen} onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setIsTransactionFormOpen(false);
                    setProductForTransaction(null);
                    setFulfillmentToUpdate(null);
                } else {
                    setIsTransactionFormOpen(true);
                }
            }}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{`New Transaction for ${productForTransaction?.name}`}</DialogTitle>
                        <DialogDescription>Record the quantity of items dispensed from each lot.</DialogDescription>
                    </DialogHeader>
                    {productForTransaction && (
                        <TransactionForm
                            product={productForTransaction}
                            onSave={handleSaveTransaction}
                            onCancel={() => {
                                setIsTransactionFormOpen(false);
                                setProductForTransaction(null);
                                setFulfillmentToUpdate(null);
                            }}
                            isSaving={isSaving}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isRequestFormOpen} onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setIsRequestFormOpen(false);
                    setProductForRequest(null);
                } else {
                    setIsRequestFormOpen(true);
                }
            }}>
                <DialogContent className="max-w-3xl flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Product Request</DialogTitle>
                        <DialogDescription>
                            Fill out the form below to request a product. Your request will be sent for review.
                        </DialogDescription>
                    </DialogHeader>
                    {productForRequest && (
                        <RequestForm
                            product={productForRequest}
                            onSave={handleSaveRequest}
                            onCancel={() => {
                                setIsRequestFormOpen(false);
                                setProductForRequest(null);
                            }}
                            isSaving={isSaving}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Products from CSV</DialogTitle>
                        <DialogDescription>
                            Upload a CSV file to bulk-import products. The file must have the following headers:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm bg-muted p-4 rounded-md overflow-x-auto">
                        <code className="font-mono whitespace-nowrap">
                            product_id,product_name,vendor,vendor_part_number,location,lot_number,quantity,receipt_date,expiration_date,reorder_threshold,notes
                        </code>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Each row in the CSV represents a single lot. Products with multiple lots should have multiple rows with the same product information. The `reorder_threshold` applies to the product and should be the same on all rows for that product. Dates should be in YYYY-MM-DD format.
                    </p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setIsImportDialogOpen(false)} disabled={isImporting}>Cancel</Button>
                        <Button onClick={handleImportClick} disabled={isImporting}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}
                            {isImporting ? 'Importing...' : 'Select File'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the product "{productToDelete?.name}" and all associated lot files.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDeleteProduct}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the transaction from {transactionToDelete && format(transactionToDelete.date, 'PPP')} and return the dispensed items to inventory.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDeleteTransaction}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!requestToReject} onOpenChange={(open) => !open && setRequestToReject(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Provide a mandatory reason for rejecting this request from {requestToReject?.requestorName}.
                        </AlertDialogDescription>
                        <div className="space-y-2 pt-2">
                             <Label htmlFor="rejection-note" className="sr-only">Rejection Note</Label>
                             <Textarea
                                id="rejection-note"
                                placeholder="e.g., Request exceeds quarterly budget..."
                                value={rejectionNote}
                                onChange={(e) => setRejectionNote(e.target.value)}
                             />
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRequestToReject(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRejectRequest}>Reject Request</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

             <AlertDialog open={!!fulfillmentToCancel} onOpenChange={(open) => !open && setFulfillmentToCancel(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will cancel the remainder of the fulfillment for "{fulfillmentToCancel?.productName}". The original request will be marked as completed based on items already dispensed. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setFulfillmentToCancel(null)}>Nevermind</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmCancelFulfillment}>Confirm Cancellation</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
