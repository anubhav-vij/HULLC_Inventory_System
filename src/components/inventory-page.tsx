
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sidebar } from '@/components/sidebar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ChevronsUpDown, MoreHorizontal, Package, Pencil, PlusCircle, Warehouse, ArrowRightLeft, CloudUpload, Loader2, AlertTriangle, Download, Trash2, CheckCircle2, XCircle, Hourglass, FileText, Search, LogOut, Users, Building2, UserCog, ShieldAlert, ChevronRight, Printer, Menu, Eye } from 'lucide-react';
import { ProductForm } from './product-form';
import { TransactionForm } from './transaction-form';
import { RequestForm } from './request-form';
import { type Product, type Lot, type ProductFormData, type Transaction, type TransactionFormData, type User, type UserRole, USER_ROLES, type SystemUser, type FunctionalGroup, type ProductRequest, type RequestLineItem, type ProductRequestFormData, type ProductRequestStatus, DEPARTMENTS, type DepartmentalProduct, type Fulfillment } from '@/lib/types';
import { HullcLogo } from './icons';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { format, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { deleteFile, getFile } from '@/lib/file-store';
import { Input } from '@/components/ui/input';
import { DepartmentalPage } from './departmental-page';
import { MaterialAuditReport } from './material-audit-report';
import { PaginationControls, paginate, PAGE_SIZE } from './pagination-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

const USER_STORAGE_KEY = 'hullc-user-data';
const DEPT_PRODUCTS_STORAGE_KEY_PREFIX = 'hullc-dept-products';

function getDefaultView(role: string): string {
    if (role === 'Admin') return 'dashboard';
    return 'inventory';
}

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

// Demo product shown when inventory is empty (not stored in DB).
// Disappears as soon as a real product is added via form or import.
const DEMO_PRODUCT: Product = {
    id: 'DEMO-0000',
    name: 'DPBS (Dulbecco\'s Phosphate Buffered Saline)',
    manufacturer: 'Thermo Fisher Scientific',
    manufacturerPartNumber: '14190144',
    vwrPartNumber: '45000-434',
    uom: 'Bottle (500 mL)',
    somApprovalRequired: false,
    costPerUnit: 12.50,
    reorderThreshold: 5,
    lots: [
        {
            id: 'demo-lot-1',
            lotNumber: '2587341',
            quantity: 12,
            receiptDate: new Date(),
            expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            location: 'Cold Storage Room A',
            file: null,
        },
    ],
};


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
    const [sheetSelectorOpen, setSheetSelectorOpen] = useState(false);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [pendingWorkbook, setPendingWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [openProductIds, setOpenProductIds] = useState<Set<string>>(new Set());
    const [openTransactionIds, setOpenTransactionIds] = useState<Set<string>>(new Set());
    const [openRequestIds, setOpenRequestIds] = useState<Set<string>>(new Set());
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [requestToReject, setRequestToReject] = useState<ProductRequest | null>(null);
    const [requestToApprove, setRequestToApprove] = useState<ProductRequest | null>(null);
    const [approveComments, setApproveComments] = useState('');
    const [fulfillmentToCancel, setFulfillmentToCancel] = useState<Fulfillment | null>(null);
    const [rejectionNote, setRejectionNote] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('');

    // Inventory filter state (set from dashboard cards)
    const [inventoryFilter, setInventoryFilter] = useState<'all' | 'missing-data' | 'added-this-week' | 'low-stock'>('all');
    const [inventoryPage, setInventoryPage] = useState(1);
    const PRODUCTS_PER_PAGE = PAGE_SIZE;
    const [txPage, setTxPage] = useState(1);
    const [reqPage, setReqPage] = useState(1);
    const [mfgPage, setMfgPage] = useState(1);
    const [usersPage, setUsersPage] = useState(1);
    const [groupsPage, setGroupsPage] = useState(1);
    const [projectsPage, setProjectsPage] = useState(1);
    const [locationsPage, setLocationsPage] = useState(1);

    // Filter state
    const [txDateFrom, setTxDateFrom] = useState('');
    const [txDateTo, setTxDateTo] = useState('');
    const [txDeptFilter, setTxDeptFilter] = useState('');
    const [reqStatusFilter, setReqStatusFilter] = useState('');
    const [reqDateFrom, setReqDateFrom] = useState('');
    const [reqDateTo, setReqDateTo] = useState('');

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

    // Projects state
    const [appProjects, setAppProjects] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
    const [isProjectFormOpen, setIsProjectFormOpen] = useState(false);
    const [projectToEdit, setProjectToEdit] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
    const [projectFormName, setProjectFormName] = useState('');

    // Manufacturers state
    const [appManufacturers, setAppManufacturers] = useState<{ id: string; name: string; alternateNames?: string; isActive: boolean }[]>([]);
    const [isManufacturerFormOpen, setIsManufacturerFormOpen] = useState(false);
    const [manufacturerToEdit, setManufacturerToEdit] = useState<{ id: string; name: string; alternateNames?: string; isActive: boolean } | null>(null);
    const [manufacturerFormName, setManufacturerFormName] = useState('');
    const [manufacturerFormAltNames, setManufacturerFormAltNames] = useState('');

    // Storage Locations state
    const [appLocations, setAppLocations] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
    const [isLocationFormOpen, setIsLocationFormOpen] = useState(false);
    const [locationToEdit, setLocationToEdit] = useState<{ id: string; name: string; isActive: boolean } | null>(null);
    const [locationFormName, setLocationFormName] = useState('');

    // Audit report state
    const [auditProduct, setAuditProduct] = useState<Product | null>(null);

    // Mobile sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [activeView, setActiveView] = useState('inventory');

    const { toast } = useToast();
    const router = useRouter();

        const totalQuantity = (lots: Lot[]) => lots.reduce((sum, lot) => sum + lot.quantity, 0);

    // Show demo product when inventory is empty (disappears once real data exists)
    const showDemoProduct = products.length === 0;

    // Detect products with placeholder/missing data that admins need to fix
    const MISSING_SENTINEL_DATE = new Date('1900-01-01');
    const hasMissingData = (product: Product): boolean => {
        const missingPatterns = [/^PRODUCT-\d+-Missing$/, /^MFR-\d+-Missing$/, /^PART-\d+-Missing$/];
        if (missingPatterns.some(p => p.test(product.name))) return true;
        if (missingPatterns.some(p => p.test(product.manufacturer))) return true;
        if (missingPatterns.some(p => p.test(product.manufacturerPartNumber))) return true;
        return product.lots.some(l =>
            /^LOT-\d+-Missing$/.test(l.lotNumber) ||
            /^LOC-\d+-Missing$/.test(l.location) ||
            (l.receiptDate && new Date(l.receiptDate).getFullYear() === 1900)
        );
    };

    const missingDataProducts = useMemo(() => products.filter(hasMissingData), [products]);

    const filteredProducts = useMemo(() => {
        let result = showDemoProduct ? [DEMO_PRODUCT] : products;

        // Dashboard filter: missing data, added this week, or low stock
        if (inventoryFilter === 'missing-data') {
            result = result.filter(hasMissingData);
        } else if (inventoryFilter === 'added-this-week') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            sevenDaysAgo.setHours(0, 0, 0, 0);
            result = result.filter(p =>
                p.lots.some(l => l.receiptDate && new Date(l.receiptDate) >= sevenDaysAgo && new Date(l.receiptDate).getFullYear() !== 1900)
            );
        } else if (inventoryFilter === 'low-stock') {
            result = result.filter(p => {
                const stock = totalQuantity(p.lots);
                return p.reorderThreshold != null && p.reorderThreshold > 0 && stock <= p.reorderThreshold;
            });
        }

        if (locationFilter) {
            result = result.filter(product =>
                product.lots.some(l => l.location === locationFilter)
            );
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(product =>
                product.name.toLowerCase().includes(q) ||
                product.manufacturerPartNumber.toLowerCase().includes(q) ||
                product.id.toLowerCase().includes(q) ||
                (product.manufacturer ?? '').toLowerCase().includes(q) ||
                product.lots.some(l => l.lotNumber.toLowerCase().includes(q))
            );
        }
        return result;
    }, [products, showDemoProduct, searchQuery, locationFilter, inventoryFilter]);

    // Pagination
    const paginatedProducts = useMemo(() => {
        const start = (inventoryPage - 1) * PRODUCTS_PER_PAGE;
        return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
    }, [filteredProducts, inventoryPage]);

    // Reset pages when filters change
    useEffect(() => { setInventoryPage(1); }, [inventoryFilter, searchQuery, locationFilter]);
    useEffect(() => { setTxPage(1); }, [txDateFrom, txDateTo, txDeptFilter]);
    useEffect(() => { setReqPage(1); }, [reqStatusFilter, reqDateFrom, reqDateTo]);

    const filteredTransactions = useMemo(() => {
        let result = transactions;
        if (txDateFrom) {
            const from = new Date(txDateFrom + 'T00:00:00');
            result = result.filter(t => new Date(t.date) >= from);
        }
        if (txDateTo) {
            const to = new Date(txDateTo + 'T23:59:59.999');
            result = result.filter(t => new Date(t.date) <= to);
        }
        if (txDeptFilter) {
            result = result.filter(t => t.department === txDeptFilter);
        }
        return result;
    }, [transactions, txDateFrom, txDateTo, txDeptFilter]);

    const filteredRequests = useMemo(() => {
        let result = productRequests;
        if (reqStatusFilter) {
            result = result.filter(r => r.status === reqStatusFilter);
        }
        if (reqDateFrom) {
            const from = new Date(reqDateFrom + 'T00:00:00');
            result = result.filter(r => new Date(r.date) >= from);
        }
        if (reqDateTo) {
            const to = new Date(reqDateTo + 'T23:59:59.999');
            result = result.filter(r => new Date(r.date) <= to);
        }
        return result;
    }, [productRequests, reqStatusFilter, reqDateFrom, reqDateTo]);

    const txDepartments = useMemo(() => {
        const depts = new Set(transactions.map(t => t.department).filter(Boolean));
        return Array.from(depts).sort();
    }, [transactions]);

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
                    setActiveView(getDefaultView(parsed.role));
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

        const controller = new AbortController();
        const signal = controller.signal;

        const loadData = async () => {
            setIsLoading(true);
            try {
                const [pRes, tRes, rRes, fRes] = await Promise.all([
                    fetch('/api/products', { signal }),
                    fetch('/api/transactions', { signal }),
                    fetch('/api/requests', { headers: requestHeaders(), signal }),
                    fetch('/api/fulfillments', { signal }),
                ]);
                if (!pRes.ok) throw new Error('Failed to load products');
                if (!tRes.ok) throw new Error('Failed to load transactions');
                if (!rRes.ok) throw new Error('Failed to load requests');
                if (!fRes.ok) throw new Error('Failed to load fulfillments');
                const [pData, tData, rData, fData] = await Promise.all([
                    pRes.json(), tRes.json(), rRes.json(), fRes.json(),
                ]);
                if (signal.aborted) return;
                setProducts(pData.map(coerceProduct));
                setTransactions(tData.map((tx: any) => ({ ...tx, date: new Date(tx.date) })));
                setProductRequests(rData.map((r: any) => ({ ...r, date: new Date(r.date) })));
                setFulfillments(fData.map((f: any) => ({
                    ...f,
                    dispensedItems: (f.dispensedItems ?? []).map((tx: any) => ({ ...tx, date: new Date(tx.date) })),
                })));

                // Load config data for Admin, ProjectManager, Chief
                if (['Admin', 'ProjectManager', 'Chief'].includes(user.role)) {
                    const roleHeaders = authHeaders(false);
                    const [usersRes, groupsRes, projectsRes, mfrsRes, locationsRes] = await Promise.all([
                        fetch('/api/users', { headers: roleHeaders, signal }),
                        fetch('/api/functional-groups?active=false', { signal }),
                        fetch('/api/projects', { headers: roleHeaders, signal }),
                        fetch('/api/manufacturers', { headers: roleHeaders, signal }),
                        fetch('/api/storage-locations', { headers: roleHeaders, signal }),
                    ]);
                    if (signal.aborted) return;
                    if (usersRes.ok) setAppUsers(await usersRes.json());
                    if (groupsRes.ok) setFunctionalGroups(await groupsRes.json());
                    if (projectsRes.ok) setAppProjects(await projectsRes.json());
                    if (mfrsRes.ok) setAppManufacturers(await mfrsRes.json());
                    if (locationsRes.ok) setAppLocations(await locationsRes.json());
                }
            } catch (error: any) {
                if (error.name === 'AbortError') return;
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
        return () => controller.abort();
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
            setActiveView(getDefaultView(loggedInUser.role));
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
        setAppProjects([]);
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
    };

    // ─── User Management handlers ────────────────────────────────────────────

    const authHeaders = (contentType = true) => {
        const h: Record<string, string> = { 'x-user-role': user?.role ?? '', 'x-user-id': user?.id ?? '' };
        if (contentType) h['Content-Type'] = 'application/json';
        return h;
    };

    /** Auth headers extended with email/group — needed for role-aware request filtering */
    const requestHeaders = () => ({
        ...authHeaders(false),
        'x-user-email': user?.email ?? '',
        'x-user-functional-group': user?.functionalGroupName ?? '',
    });

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
            const isSystemEdit = userToEdit?.isSystem;
            const body: any = {
                fullName: userFormData.fullName,
                ...(!isSystemEdit && { email: userFormData.email }),
                ...(!isSystemEdit && { role: userFormData.role }),
                functionalGroupId: userFormData.functionalGroupId || null,
                department: 'core',
            };
            if (!userToEdit) body.password = userFormData.password;

            const url = userToEdit ? `/api/users/${userToEdit.id}` : '/api/users';
            const method = userToEdit ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
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
                headers: authHeaders(),
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
            const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify({ name: groupFormName }) });
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
                headers: authHeaders(),
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

    // ─── Project handlers ────────────────────────────────────────────────────

    const handleOpenProjectForm = (p: { id: string; name: string; isActive: boolean } | null) => {
        setProjectToEdit(p);
        setProjectFormName(p ? p.name : '');
        setIsProjectFormOpen(true);
    };

    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isEdit = !!projectToEdit;
            const res = isEdit
                ? await fetch(`/api/projects/${projectToEdit!.id}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ name: projectFormName }),
                  })
                : await fetch('/api/projects', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ name: projectFormName }),
                  });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to save project');
            }
            const saved = await res.json();
            if (isEdit) {
                setAppProjects(prev => prev.map(p => p.id === saved.id ? saved : p));
                toast({ title: 'Project Updated' });
            } else {
                setAppProjects(prev => [...prev, saved]);
                toast({ title: 'Project Created' });
            }
            setIsProjectFormOpen(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleProjectStatus = async (p: { id: string; name: string; isActive: boolean }) => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/projects/${p.id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ isActive: !p.isActive }),
            });
            if (!res.ok) throw new Error('Failed to update project');
            const updated = await res.json();
            setAppProjects(prev => prev.map(proj => proj.id === updated.id ? updated : proj));
            toast({ title: p.isActive ? 'Project Deactivated' : 'Project Activated' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Manufacturer Management handlers ──────────────────────────────────────────

    const handleOpenManufacturerForm = (m: { id: string; name: string; alternateNames?: string; isActive: boolean } | null) => {
        setManufacturerToEdit(m);
        setManufacturerFormName(m ? m.name : '');
        setManufacturerFormAltNames(m?.alternateNames ?? '');
        setIsManufacturerFormOpen(true);
    };

    const handleSaveManufacturer = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isEdit = !!manufacturerToEdit;
            const res = isEdit
                ? await fetch(`/api/manufacturers/${manufacturerToEdit!.id}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ name: manufacturerFormName, alternateNames: manufacturerFormAltNames }),
                  })
                : await fetch('/api/manufacturers', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ name: manufacturerFormName, alternateNames: manufacturerFormAltNames }),
                  });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to save manufacturer');
            }
            const saved = await res.json();
            if (isEdit) {
                setAppManufacturers(prev => prev.map(m => m.id === saved.id ? saved : m));
                toast({ title: 'Manufacturer Updated' });
            } else {
                setAppManufacturers(prev => [...prev, saved]);
                toast({ title: 'Manufacturer Created' });
            }
            setIsManufacturerFormOpen(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleManufacturerStatus = async (m: { id: string; name: string; isActive: boolean }) => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/manufacturers/${m.id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ isActive: !m.isActive }),
            });
            if (!res.ok) throw new Error('Failed to update manufacturer');
            const updated = await res.json();
            setAppManufacturers(prev => prev.map(mf => mf.id === updated.id ? updated : mf));
            toast({ title: m.isActive ? 'Manufacturer Deactivated' : 'Manufacturer Activated' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Storage Location Management handlers ─────────────────────────────────

    const handleOpenLocationForm = (l: { id: string; name: string; isActive: boolean } | null) => {
        setLocationToEdit(l);
        setLocationFormName(l ? l.name : '');
        setIsLocationFormOpen(true);
    };

    const handleSaveLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const isEdit = !!locationToEdit;
            const res = isEdit
                ? await fetch(`/api/storage-locations/${locationToEdit!.id}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ name: locationFormName }),
                  })
                : await fetch('/api/storage-locations', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ name: locationFormName }),
                  });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to save storage location');
            }
            const saved = await res.json();
            if (isEdit) {
                setAppLocations(prev => prev.map(l => l.id === saved.id ? saved : l));
                toast({ title: 'Storage Location Updated' });
            } else {
                setAppLocations(prev => [...prev, saved]);
                toast({ title: 'Storage Location Created' });
            }
            setIsLocationFormOpen(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleLocationStatus = async (l: { id: string; name: string; isActive: boolean }) => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/storage-locations/${l.id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ isActive: !l.isActive }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to update storage location');
            }
            const updated = await res.json();
            setAppLocations(prev => prev.map(loc => loc.id === updated.id ? updated : loc));
            toast({ title: l.isActive ? 'Storage Location Deactivated' : 'Storage Location Activated' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Product handlers ────────────────────────────────────────────────────

    const handleAddNew = () => {
        router.push('/products/new');
    };

    const handleEdit = (product: Product) => {
        router.push(`/products/${product.id}/edit`);
    };

    const handleNewTransaction = (product: Product) => {
        setProductForTransaction(product);
        setIsTransactionFormOpen(true);
    };

    const handleRequestProduct = (product: Product) => {
        router.push(`/requests/new?productId=${product.id}`);
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
                    headers: authHeaders(),
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
                    headers: authHeaders(),
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
                manufacturer: coreProduct.manufacturer,
                manufacturerPartNumber: coreProduct.manufacturerPartNumber,
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
                // Check if this is a line item fulfillment (id starts with 'line:')
                const isLineItemMode = fulfillmentToUpdate.id.startsWith('line:');

                let res: Response;
                if (isLineItemMode) {
                    // Path B2: fulfill via line item endpoint
                    const parts = fulfillmentToUpdate.id.split(':');
                    const reqId = parts[1];
                    const lineItemId = parts[2];
                    res = await fetch(`/api/requests/${reqId}/line-items/${lineItemId}`, {
                        method: 'PUT',
                        headers: authHeaders(),
                        body: JSON.stringify({
                            date: data.date instanceof Date ? data.date.toISOString() : data.date,
                            notes: data.notes,
                            items: activeItems.map(i => ({ lotId: i.lotId, quantityTaken: i.quantityTaken })),
                        }),
                    });
                } else {
                    // Path B: dispense for a legacy fulfillment
                    res = await fetch(`/api/fulfillments/${fulfillmentToUpdate.id}`, {
                        method: 'PUT',
                        headers: authHeaders(),
                        body: JSON.stringify({
                            date: data.date instanceof Date ? data.date.toISOString() : data.date,
                            notes: data.notes,
                            items: activeItems.map(i => ({ lotId: i.lotId, quantityTaken: i.quantityTaken })),
                        }),
                    });
                }

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
                    fetch('/api/requests', { headers: requestHeaders() }),
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
                    headers: authHeaders(),
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
                description: `Your request for "${productForRequest.name}" has been sent for review.`,
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

    const handleApproveRequest = (request: ProductRequest) => {
        setRequestToApprove(request);
        setApproveComments('');
    };

    const handleConfirmApproveRequest = async () => {
        if (!requestToApprove || !user) return;
        setIsSaving(true);
        const isSciOps = requestToApprove.status === 'Pending SciOps Approval';
        const endpoint = isSciOps
            ? `/api/requests/${requestToApprove.id}/sciops-approve`
            : `/api/requests/${requestToApprove.id}/approve`;
        try {
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-user-role': user.role, 'x-user-id': user.id ?? '', 'x-user-functional-group': user.functionalGroupId ?? '' },
                body: JSON.stringify({ comments: approveComments.trim() || undefined }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error((body as any).error || 'Failed to approve request');
            }
            const updated = await res.json();
            setProductRequests(prev => prev.map(r => r.id === updated.id ? { ...updated, date: new Date(updated.date) } : r));
            toast({ title: 'Request Approved', description: `Request for "${requestToApprove.productName}" has been approved.` });
            setRequestToApprove(null);
            // Re-fetch requests with role headers to get fresh data
            const userH = { 'x-user-role': user.role, 'x-user-id': user.id ?? '', 'x-user-email': user.email ?? '', 'x-user-functional-group': user.functionalGroupName ?? '' };
            const [rRes, pRes] = await Promise.all([
                fetch('/api/requests', { headers: userH }),
                fetch('/api/products'),
            ]);
            if (rRes.ok) setProductRequests((await rRes.json()).map((r: any) => ({ ...r, date: new Date(r.date) })));
            if (pRes.ok) setProducts((await pRes.json()).map(coerceProduct));
        } catch (error: any) {
            toast({ title: 'Approve Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleFulfillLineItem = (request: ProductRequest, lineItem: RequestLineItem) => {
        const product = products.find(p => p.id === request.productId);
        if (product) {
            setProductForTransaction(product);
            setFulfillmentToUpdate({
                id: `line:${request.id}:${lineItem.id}`,
                requestId: request.id,
                productId: request.productId,
                productName: request.productName,
                department: request.department,
                totalQuantityRequested: lineItem.quantity,
                dispensedItems: [],
                requestLineItemId: lineItem.id,
            });
            setIsTransactionFormOpen(true);
        }
    };

    const handleConfirmRejectRequest = async () => {
        if (!requestToReject || !user) return;
        if (!rejectionNote.trim()) {
            toast({ title: 'Note Required', description: 'Please provide a reason for rejecting the request.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        const isSciOps = requestToReject.status === 'Pending SciOps Approval';
        const endpoint = isSciOps
            ? `/api/requests/${requestToReject.id}/sciops-reject`
            : `/api/requests/${requestToReject.id}/reject`;
        try {
            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-user-role': user.role, 'x-user-id': user.id ?? '', 'x-user-functional-group': user.functionalGroupId ?? '' },
                body: JSON.stringify({ rejectionNote }),
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
            // Re-fetch requests and products (reservation release) with role headers
            const userH = { 'x-user-role': user.role, 'x-user-id': user.id ?? '', 'x-user-email': user.email ?? '', 'x-user-functional-group': user.functionalGroupName ?? '' };
            const [rRes, pRes] = await Promise.all([
                fetch('/api/requests', { headers: userH }),
                fetch('/api/products'),
            ]);
            if (rRes.ok) setProductRequests((await rRes.json()).map((r: any) => ({ ...r, date: new Date(r.date) })));
            if (pRes.ok) setProducts((await pRes.json()).map(coerceProduct));
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
            const rRes = await fetch('/api/requests', { headers: requestHeaders() });
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

    const processImportSheet = async (workbook: XLSX.WorkBook, selectedSheet: string) => {
        setIsImporting(true);
        try {
            const rows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[selectedSheet], { defval: '' });

            if (rows.length === 0) {
                toast({ title: 'Import Failed', description: 'No data rows found in the file.', variant: 'destructive' });
                return;
            }

            // Group rows into products by (product_name + manufacturer + manufacturer_part_number).
            // Empty grouping fields are kept as-is — the server assigns placeholders.
            const importedProductsMap = new Map<string, any>();
            const formatDate = (d: any): string | null => {
                if (!d || d === '') return null;
                if (d instanceof Date) return isValid(d) ? format(d, 'yyyy-MM-dd') : null;
                const parsed = new Date(String(d));
                return isValid(parsed) ? format(parsed, 'yyyy-MM-dd') : null;
            };

            // Track which rows had no grouping fields to give them unique keys
            let emptyGroupCounter = 0;

            for (const row of rows) {
                const {
                    product_name, manufacturer, manufacturer_part_number, location,
                    lot_number, quantity, receipt_date, expiration_date, notes,
                    vwr_part_number, uom, som_approval_required, cost_per_unit,
                    reorder_threshold
                } = row;

                const pName = String(product_name ?? '').trim();
                const pMfr = String(manufacturer ?? '').trim();
                const pPart = String(manufacturer_part_number ?? '').trim();

                // Build grouping key — if all three are empty, each row is its own product
                let groupKey = `${pName}||${pMfr}||${pPart}`;
                if (!pName && !pMfr && !pPart) {
                    groupKey = `__empty_${++emptyGroupCounter}`;
                }

                // Ensure the product entry exists
                if (!importedProductsMap.has(groupKey)) {
                    const somFlag = som_approval_required
                        ? String(som_approval_required).toLowerCase() === 'yes' || String(som_approval_required).toLowerCase() === 'true'
                        : false;
                    importedProductsMap.set(groupKey, {
                        name: pName || undefined,
                        manufacturer: pMfr || undefined,
                        manufacturerPartNumber: pPart || undefined,
                        vwrPartNumber: vwr_part_number ? String(vwr_part_number).trim() : undefined,
                        uom: uom ? String(uom).trim() : undefined,
                        somApprovalRequired: somFlag,
                        costPerUnit: cost_per_unit ? parseFloat(String(cost_per_unit)) || null : null,
                        reorderThreshold: reorder_threshold ? parseInt(String(reorder_threshold), 10) : null,
                        lots: [] as any[],
                    });
                }

                // Add a lot for every row (server fills missing lot_number/location)
                const lotNum = String(lot_number ?? '').trim();
                const loc = String(location ?? '').trim();
                const receiptDateStr = formatDate(receipt_date);
                const expirationDateStr = formatDate(expiration_date);

                // Only add a lot row if there's at least one lot-level field present
                // (lot_number, quantity, receipt_date, or location)
                const hasLotData = lotNum || (quantity && Number(quantity) !== 0) || receiptDateStr || loc;
                if (hasLotData) {
                    importedProductsMap.get(groupKey).lots.push({
                        lotNumber: lotNum || undefined,
                        quantity: parseInt(String(quantity), 10) || 0,
                        receiptDate: receiptDateStr || undefined,
                        expirationDate: expirationDateStr,
                        location: loc || undefined,
                        notes: String(notes || '').trim() || undefined,
                    });
                }
            }

            const xlsxProducts = Array.from(importedProductsMap.values());
            if (xlsxProducts.length === 0) {
                toast({ title: 'Import Failed', description: 'No valid product data found in the file.', variant: 'destructive' });
                return;
            }

            // Send all products to the bulk-import endpoint in one request.
            // The server assigns persistent placeholder counters for missing fields.
            const res = await fetch('/api/products/bulk-import', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ products: xlsxProducts }),
            });

            if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error((b as any).error || 'Bulk import failed');
            }

            const result = await res.json() as { created: number };

            const pRes = await fetch('/api/products');
            if (pRes.ok) setProducts((await pRes.json()).map(coerceProduct));

            toast({ title: 'Import Successful', description: `${result.created} product(s) imported.` });
        } catch (error: any) {
            toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsImporting(false);
            setIsImportDialogOpen(false);
            setSheetSelectorOpen(false);
            setPendingWorkbook(null);
            setSheetNames([]);
        }
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (event.target) event.target.value = '';

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { cellDates: true });

            if (!workbook.SheetNames.length) {
                toast({ title: 'Import Failed', description: 'No sheets found in the file.', variant: 'destructive' });
                return;
            }

            if (workbook.SheetNames.length > 1) {
                // Multi-sheet file — show sheet selector
                setPendingWorkbook(workbook);
                setSheetNames(workbook.SheetNames);
                setSheetSelectorOpen(true);
                setIsImportDialogOpen(false);
            } else {
                // Single sheet — proceed directly
                await processImportSheet(workbook, workbook.SheetNames[0]);
            }
        } catch (error: any) {
            toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
        }
    };

    const exportToExcel = (data: Record<string, any>[], filename: string, sheetName = 'Sheet1') => {
        const ws = XLSX.utils.json_to_sheet(data);
        // Auto-size columns
        const colWidths = Object.keys(data[0] || {}).map(key => {
            const maxLen = Math.max(key.length, ...data.map(row => String(row[key] ?? '').length));
            return { wch: Math.min(maxLen + 2, 40) };
        });
        ws['!cols'] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, filename);
    };

    const handleExportInventory = () => {
        const dataToExport = filteredProducts.flatMap(product =>
            product.lots.map(lot => ({
                'Product ID': product.id,
                'Product Name': product.name,
                'Manufacturer': product.manufacturer,
                'Manufacturer Alternate Name': product.manufacturerAlternateName ?? '',
                'Manufacturer Part #': product.manufacturerPartNumber,
                'VWR Part #': (product as any).vwrPartNumber ?? '',
                'UoM': product.uom ?? '',
                'Reorder Threshold': product.reorderThreshold ?? '',
                'Lot Number': lot.lotNumber,
                'Quantity': lot.quantity,
                'Receipt Date': isValid(lot.receiptDate) ? format(lot.receiptDate, 'yyyy-MM-dd') : '',
                'Expiration Date': lot.expirationDate && isValid(lot.expirationDate) ? format(lot.expirationDate, 'yyyy-MM-dd') : '',
                'Storage Location': lot.location,
                'Notes': lot.notes ?? '',
            }))
        );

        if (dataToExport.length === 0) {
            toast({ title: "No Data", description: "There is no inventory data to export.", variant: "destructive" });
            return;
        }

        exportToExcel(dataToExport, 'inventory_export.xlsx', 'Inventory');
        toast({ title: "Export Started", description: "Your inventory data is downloading." });
    };

    const handleExportTransactions = () => {
        const dataToExport = filteredTransactions.flatMap(tx =>
            tx.items.map(item => ({
                'Transaction ID': tx.id,
                'Date': format(tx.date, 'yyyy-MM-dd HH:mm:ss'),
                'Product ID': tx.productId,
                'Product Name': tx.productName,
                'Requestor': tx.requestorName ?? 'N/A',
                'Department': tx.department ?? 'N/A',
                'Lot Number': item.lotNumber,
                'Quantity Dispensed': item.quantity,
                'Notes': tx.notes ?? '',
            }))
        );

        if (dataToExport.length === 0) {
            toast({ title: "No Data", description: "There are no transactions to export.", variant: "destructive" });
            return;
        }

        exportToExcel(dataToExport, 'transactions_export.xlsx', 'Transactions');
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
        const statusConfig: Record<ProductRequestStatus, { color: string; icon: React.ElementType }> = {
            'Pending Approval': { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: Hourglass },
            'Pending SciOps Approval': { color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', icon: Hourglass },
            'Approved': { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: CheckCircle2 },
            'In Progress': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: ArrowRightLeft },
            'Completed': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
            'Rejected': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
        };
        const cfg = statusConfig[status] ?? { color: 'bg-gray-100 text-gray-800', icon: Hourglass };
        const Icon = cfg.icon;
        return (
            <Badge className={cn('gap-1', cfg.color)}>
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
            <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#eef2f7' }}>
                <div className="w-full max-w-sm" style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                    <div className="p-6 pb-2 text-center">
                        <h1 className="text-2xl font-bold mb-1" style={{ color: '#0f172a' }}>HULLC Inventory</h1>
                        <p className="text-xs mb-1" style={{ color: '#64748b' }}>High Use Long Lead Consumables</p>
                        <p className="text-sm mt-3" style={{ color: '#64748b' }}>Sign in with your HULLC account.</p>
                    </div>
                    <div className="p-6 pt-4">
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
                            <Button type="submit" disabled={isLoginLoading} className="w-full" style={{ backgroundColor: '#1e40af' }}>
                                {isLoginLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Sign In
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    if (user.department !== 'core') {
        return <DepartmentalPage user={user} onLogout={handleLogout} />;
    }

    const canEdit = user.role === 'Admin';
    const hasFullView = ['Admin', 'ProjectManager', 'Chief'].includes(user.role);
    const inventoryColSpan = canEdit ? 10 : (hasFullView ? 8 : 4);
    const requestsColSpan = 7;

    const pageTitle: Record<string, { title: string; subtitle?: string }> = {
        dashboard: { title: 'Dashboard', subtitle: 'Overview of your inventory system' },
        inventory: { title: 'HULLC Inventory', subtitle: 'High Use Long Lead Consumables' },
        requests: { title: 'Product Requests', subtitle: 'Manage and track product requests' },
        approvals: { title: 'Approvals', subtitle: 'Pending requests awaiting your approval' },
        transactions: { title: 'Transactions', subtitle: 'History of all inventory transactions' },
        fulfillments: { title: 'Fulfillments', subtitle: 'Approved and in-progress fulfillments' },
        configuration: { title: 'Configuration', subtitle: 'Manage users, groups, and projects' },
    };

    const currentPage = pageTitle[activeView] ?? pageTitle.inventory;

    return (
        <div className="min-h-screen w-full" style={{ backgroundColor: '#eef2f7' }}>
            <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".xlsx,.xls,.csv" />
            <Sidebar activeView={activeView} onNavigate={(view) => {
                if (view === 'metrics-dashboard') { router.push('/metrics/dashboard'); return; }
                if (view === 'metrics-received') { router.push('/metrics/received'); return; }
                if (view === 'metrics-disbursed') { router.push('/metrics/disbursed'); return; }
                if (view === 'historical-import') { router.push('/historical-import'); return; }
                if (view === 'workflow-history') { router.push('/workflow-history'); return; }
                if (view !== 'inventory') setInventoryFilter('all');
                setActiveView(view);
            }} user={user} onLogout={handleLogout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
            <div className="content-with-sidebar">
                {/* Top bar */}
                <div className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8" style={{ height: 60, backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
                            <Menu className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-base md:text-lg font-semibold" style={{ color: '#0f172a' }}>{currentPage.title}</h1>
                            {currentPage.subtitle && <p className="text-xs hidden sm:block" style={{ color: '#64748b' }}>{currentPage.subtitle}</p>}
                        </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-medium" style={{ color: '#1e40af', borderColor: '#1e40af' }}>{user.role}</Badge>
                </div>

            <TooltipProvider>
                <main className="p-4 md:p-8">

                {/* ── Dashboard View (Admin only) ─────────────────────── */}
                {activeView === 'dashboard' && user.role === 'Admin' && (() => {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    sevenDaysAgo.setHours(0, 0, 0, 0);
                    const recentProducts = products.filter(p => {
                        const lots = p.lots ?? [];
                        return lots.some(l => l.receiptDate && new Date(l.receiptDate) >= sevenDaysAgo && new Date(l.receiptDate).getFullYear() !== 1900);
                    });

                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const todayTransactions = transactions.filter(t => new Date(t.date) >= todayStart);

                    // Admin dashboard — show unfulfilled requests count
                    const pendingLabel = 'Unfulfilled Requests';
                    const pendingCount = productRequests.filter(r => r.status === 'Approved' || r.status === 'In Progress').length;

                    const lowStockProducts = products.filter(p => {
                        const stock = totalQuantity(p.lots);
                        return p.reorderThreshold != null && p.reorderThreshold > 0 && stock <= p.reorderThreshold;
                    });

                    const cardStyle = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 };
                    const clickableCardStyle = { ...cardStyle, cursor: 'pointer' as const, transition: 'box-shadow 0.15s' };
                    const labelStyle = { color: '#64748b' };
                    const valueStyle = { color: '#0f172a' };

                    return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Total Products */}
                            <div style={cardStyle} className="p-6">
                                <p className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>Total Products</p>
                                <p className="text-3xl font-bold mt-2" style={valueStyle}>{products.length}</p>
                                <p className="text-xs mt-1" style={labelStyle}>Total stock: {products.reduce((s, p) => s + totalQuantity(p.lots), 0)} units</p>
                            </div>

                            {/* Products added in last 7 days */}
                            <div
                                style={clickableCardStyle}
                                className="p-6 hover:shadow-md"
                                onClick={() => { setInventoryFilter('added-this-week'); setActiveView('inventory'); }}
                            >
                                <p className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>Added This Week</p>
                                <p className="text-3xl font-bold mt-2" style={valueStyle}>{recentProducts.length}</p>
                                <p className="text-xs mt-1" style={{ color: '#1e40af' }}>Click to view filtered</p>
                            </div>

                            {/* Transactions today */}
                            <div
                                style={clickableCardStyle}
                                className="p-6 hover:shadow-md"
                                onClick={() => {
                                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                                    setTxDateFrom(todayStr);
                                    setTxDateTo(todayStr);
                                    setActiveView('transactions');
                                }}
                            >
                                <p className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>Transactions Today</p>
                                <p className="text-3xl font-bold mt-2" style={valueStyle}>{todayTransactions.length}</p>
                                <p className="text-xs mt-1" style={{ color: '#1e40af' }}>Click to view today&apos;s only</p>
                            </div>

                            {/* Pending items — role-aware */}
                            <div
                                style={clickableCardStyle}
                                className="p-6 hover:shadow-md"
                                onClick={() => {
                                    setActiveView('fulfillments');
                                }}
                            >
                                <p className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>{pendingLabel}</p>
                                <p className="text-3xl font-bold mt-2" style={pendingCount > 0 ? { color: '#ea580c' } : valueStyle}>{pendingCount}</p>
                                <p className="text-xs mt-1" style={{ color: '#1e40af' }}>Click to view</p>
                            </div>

                            {/* Products at/below reorder threshold */}
                            <div
                                style={clickableCardStyle}
                                className="p-6 hover:shadow-md"
                                onClick={() => { setInventoryFilter('low-stock'); setActiveView('inventory'); }}
                            >
                                <p className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>Low Stock Alert</p>
                                <p className="text-3xl font-bold mt-2" style={lowStockProducts.length > 0 ? { color: '#dc2626' } : valueStyle}>{lowStockProducts.length}</p>
                                <p className="text-xs mt-1" style={{ color: '#1e40af' }}>Click to view low stock only</p>
                            </div>

                            {/* Missing data needing admin attention */}
                            {missingDataProducts.length > 0 && (
                            <div
                                style={clickableCardStyle}
                                className="p-6 hover:shadow-md"
                                onClick={() => { setInventoryFilter('missing-data'); setActiveView('inventory'); }}
                            >
                                <p className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>Missing Data</p>
                                <p className="text-3xl font-bold mt-2" style={{ color: '#ea580c' }}>{missingDataProducts.length}</p>
                                <p className="text-xs mt-1" style={{ color: '#1e40af' }}>Products with placeholder values — click to review</p>
                            </div>
                            )}
                        </div>

                        {/* Low stock detail table */}
                        {lowStockProducts.length > 0 && (
                            <div style={cardStyle}>
                                <div className="px-6 py-4" style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
                                    <h3 className="text-sm font-semibold" style={{ color: '#0f172a' }}>Low Stock Products</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ backgroundColor: '#f8fafc' }}>
                                                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>Product ID</th>
                                                <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>Name</th>
                                                <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>Current Stock</th>
                                                <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={labelStyle}>Reorder At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lowStockProducts.map(p => (
                                                <tr key={p.id} className="border-t" style={{ borderColor: '#e2e8f0' }}>
                                                    <td className="px-6 py-3 text-sm" style={{ color: '#1e40af' }}>{p.id}</td>
                                                    <td className="px-6 py-3 text-sm font-medium" style={valueStyle}>{p.name}</td>
                                                    <td className="px-6 py-3 text-sm text-right font-semibold" style={{ color: '#dc2626' }}>{totalQuantity(p.lots)}</td>
                                                    <td className="px-6 py-3 text-sm text-right" style={labelStyle}>{p.reorderThreshold}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                    );
                })()}

                {/* ── Inventory View ──────────────────────────────────── */}
                {activeView === 'inventory' && (
                            <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                <div className="p-4 md:p-6 pb-4">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div className="flex-1">
                                            <h2 className="text-base md:text-lg font-semibold" style={{ color: '#0f172a' }}>Master Inventory</h2>
                                            <p className="text-sm" style={{ color: '#64748b' }}>Manage all products and their stock.</p>
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
                                            {hasFullView && appLocations.length > 0 && (
                                                <Select value={locationFilter} onValueChange={(v) => setLocationFilter(v === 'all' ? '' : v)}>
                                                    <SelectTrigger className="w-full sm:w-[200px]">
                                                        <SelectValue placeholder="All Locations" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Locations</SelectItem>
                                                        {appLocations.filter(l => l.isActive).map(l => (
                                                            <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            {hasFullView && (
                                                <div className="flex gap-2">
                                                    <Button variant="outline" onClick={handleExportInventory}>
                                                        <Download className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Export</span>
                                                    </Button>
                                                    {canEdit && (
                                                        <>
                                                            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                                                                <CloudUpload className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Import</span>
                                                            </Button>
                                                            <Button onClick={handleAddNew}>
                                                                <PlusCircle className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span>
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="px-4 md:px-6 pb-6">
                                    {showDemoProduct && (
                                        <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }}>
                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                            <span>This is <strong>sample data</strong> for demonstration. It will be replaced once you import or add real products.</span>
                                        </div>
                                    )}
                                    {inventoryFilter !== 'all' && !showDemoProduct && (
                                        <div className="mb-4 p-3 rounded-lg text-sm flex items-center justify-between" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a5f' }}>
                                            <span>
                                                {inventoryFilter === 'missing-data' && `Showing ${filteredProducts.length} product(s) with missing/placeholder data`}
                                                {inventoryFilter === 'added-this-week' && `Showing ${filteredProducts.length} product(s) added in the last 7 days`}
                                                {inventoryFilter === 'low-stock' && `Showing ${filteredProducts.length} product(s) at or below reorder threshold`}
                                            </span>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setInventoryFilter('all')}>
                                                Clear Filter
                                            </Button>
                                        </div>
                                    )}
                                    {/* Mobile card view */}
                                    <div className="md:hidden space-y-3">
                                        {paginatedProducts.length > 0 ? paginatedProducts.map(product => {
                                            const stock = totalQuantity(product.lots);
                                            return (
                                                <div key={product.id} className="rounded-lg border p-4" style={{ backgroundColor: '#fff', borderColor: '#e2e8f0' }}>
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <p className="font-medium text-sm" style={{ color: '#0f172a' }}>{product.name}</p>
                                                            <p className="text-xs text-muted-foreground">{product.id}</p>
                                                        </div>
                                                        {hasFullView && (
                                                            <Badge variant={needsReorder(product) ? "destructive" : "secondary"} className="text-xs">{stock}</Badge>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3" style={{ color: '#475569' }}>
                                                        <div><span className="font-medium">Mfr:</span> {product.manufacturer || '—'}{product.manufacturerAlternateName ? ` (${product.manufacturerAlternateName})` : ''}</div>
                                                        <div><span className="font-medium">Part #:</span> {product.manufacturerPartNumber || '—'}</div>
                                                        <div><span className="font-medium">UoM:</span> {product.uom || '—'}</div>
                                                    </div>
                                                    {!showDemoProduct && (
                                                    <div className="flex gap-2">
                                                        {canEdit ? (
                                                            <>
                                                                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleEdit(product)}>Edit</Button>
                                                                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleNewTransaction(product)}>Transaction</Button>
                                                                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAuditProduct(product)}><Printer className="h-3 w-3" /></Button>
                                                            </>
                                                        ) : hasFullView ? (
                                                            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAuditProduct(product)}><Printer className="h-3 w-3 mr-1" /> Audit</Button>
                                                        ) : (
                                                            <Button size="sm" className="text-xs h-7" onClick={() => handleRequestProduct(product)}>Request Item</Button>
                                                        )}
                                                    </div>
                                                    )}
                                                </div>
                                            );
                                        }) : (
                                            <div className="text-center py-12 text-muted-foreground">
                                                {searchQuery ? 'No products found.' : 'No products yet.'}
                                            </div>
                                        )}
                                    </div>
                                    {/* Desktop table view */}
                                    <div className="hidden md:block border rounded-lg overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                                        <Table>
                                            <TableHeader>
                                                <TableRow style={{ backgroundColor: '#f8fafc' }}>
                                                    {hasFullView && <TableHead className="w-[50px]"></TableHead>}
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Product</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Manufacturer</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Mfr Part #</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>VWR Part #</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>UoM</TableHead>
                                                    {hasFullView && <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Total Quantity</TableHead>}
                                                    {canEdit && <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Reserved</TableHead>}
                                                    {canEdit && <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Available</TableHead>}
                                                    {hasFullView && <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Storage Location</TableHead>}
                                                    {hasFullView ?
                                                        <TableHead className={cn("text-right", canEdit ? "w-[100px]" : "w-[80px]")}>{canEdit ? 'Actions' : ''}</TableHead> :
                                                        <TableHead className="w-[120px] text-right">Action</TableHead>
                                                    }
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paginatedProducts.length > 0 ? (
                                                    paginatedProducts.map(product => {
                                                        const outOfStock = isProductOutOfStock(product);
                                                        const isExpiredFlag = !outOfStock && isProductExpired(product);
                                                        const isOpen = openProductIds.has(product.id);

                                                        return (
                                                            <React.Fragment key={product.id}>
                                                                <TableRow
                                                                    data-state={isOpen ? 'open' : 'closed'}
                                                                    className={cn("text-sm", {
                                                                        "bg-destructive/10 hover:bg-destructive/20": outOfStock,
                                                                        "bg-orange-100 dark:bg-orange-950 hover:bg-orange-200 dark:hover:bg-orange-900": isExpiredFlag,
                                                                    })}
                                                                >
                                                                    {hasFullView && (
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
                                                                    <TableCell>
                                                                        <div>{product.manufacturer}</div>
                                                                        {product.manufacturerAlternateName && (
                                                                            <div className="text-xs text-muted-foreground">{product.manufacturerAlternateName}</div>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell>{product.manufacturerPartNumber}</TableCell>
                                                                    <TableCell>{(product as any).vwrPartNumber ?? ''}</TableCell>
                                                                    <TableCell>{product.uom ?? '—'}</TableCell>
                                                                    {hasFullView && (
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
                                                                    {canEdit && (
                                                                        <TableCell>
                                                                            {(product.reservedQuantity ?? 0) > 0 ? (
                                                                                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">{product.reservedQuantity}</Badge>
                                                                            ) : (
                                                                                <span className="text-muted-foreground text-xs">0</span>
                                                                            )}
                                                                        </TableCell>
                                                                    )}
                                                                    {canEdit && (
                                                                        <TableCell>
                                                                            <Badge variant={totalQuantity(product.lots) - (product.reservedQuantity ?? 0) <= (product.reorderThreshold ?? 0) ? "destructive" : "secondary"}>
                                                                                {totalQuantity(product.lots) - (product.reservedQuantity ?? 0)}
                                                                            </Badge>
                                                                        </TableCell>
                                                                    )}
                                                                    {hasFullView && (
                                                                        <TableCell><div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-muted-foreground"/>{getDisplayLocation(product.lots)}</div></TableCell>
                                                                    )}
                                                                    {showDemoProduct ? (
                                                                        <TableCell className="text-right">
                                                                            <span className="text-xs italic" style={{ color: '#94a3b8' }}>Demo</span>
                                                                        </TableCell>
                                                                    ) : canEdit ? (
                                                                        <TableCell className="text-right">
                                                                            <DropdownMenu>
                                                                                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                                <DropdownMenuContent align="end">
                                                                                    <DropdownMenuItem onClick={() => router.push(`/products/${product.id}`)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => handleEdit(product)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => handleNewTransaction(product)}><ArrowRightLeft className="mr-2 h-4 w-4" /> New Transaction</DropdownMenuItem>
                                                                                    <DropdownMenuItem onClick={() => setAuditProduct(product)}><Printer className="mr-2 h-4 w-4" /> Print Audit</DropdownMenuItem>
                                                                                    <DropdownMenuSeparator />
                                                                                    <DropdownMenuItem onClick={() => handleDeleteProduct(product)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                                                                </DropdownMenuContent>
                                                                            </DropdownMenu>
                                                                        </TableCell>
                                                                    ) : hasFullView ? (
                                                                        <TableCell className="text-right">
                                                                            <Button variant="ghost" size="sm" onClick={() => setAuditProduct(product)} title="Print Audit">
                                                                                <Printer className="h-4 w-4" />
                                                                            </Button>
                                                                        </TableCell>
                                                                    ) : (
                                                                        <TableCell className="text-right">
                                                                            <Button size="sm" onClick={() => handleRequestProduct(product)}>
                                                                                Request Item
                                                                            </Button>
                                                                        </TableCell>
                                                                    )}
                                                                </TableRow>
                                                                {isOpen && hasFullView && (
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
                                                                                        {[...product.lots].sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime()).slice(0, 3).map(lot => (
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
                                                                                {product.lots.length > 3 && (
                                                                                    <p className="text-xs text-muted-foreground mt-2 ml-2">
                                                                                        Showing 3 of {product.lots.length} lots.{canEdit && (
                                                                                            <>
                                                                                                {' '}
                                                                                                <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => router.push(`/products/${product.id}`)}>
                                                                                                    View all lots
                                                                                                </Button>
                                                                                            </>
                                                                                        )}
                                                                                    </p>
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
                                                        <TableCell colSpan={inventoryColSpan} className="h-24 text-center">
                                                            {searchQuery ? 'No products found for your search.' : 'No products found. Get started by adding a new product.'}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {/* Pagination */}
                                    <PaginationControls currentPage={inventoryPage} totalItems={filteredProducts.length} onPageChange={setInventoryPage} label="products" />
                                </div>
                            </div>
                )}

                {/* ── Requests View (Admin, Director, Staff) ──────────── */}
                {activeView === 'requests' && user.role !== 'ProjectManager' && user.role !== 'Chief' && (
                                <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                    <div className="p-6 pb-4">
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <h2 className="text-lg font-semibold" style={{ color: '#0f172a' }}>Product Requests</h2>
                                                <p className="text-sm" style={{ color: '#64748b' }}>
                                                    {hasFullView
                                                        ? 'Approved requests ready for fulfillment. Expand each request to fulfill individual line items.'
                                                        : 'Your pending approval requests.'}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-end gap-3">
                                                <div>
                                                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#64748b' }}>Status</label>
                                                    <select
                                                        value={reqStatusFilter}
                                                        onChange={(e) => setReqStatusFilter(e.target.value)}
                                                        className="h-10 rounded-md border px-3 text-sm w-[200px]"
                                                        style={{ borderColor: '#e2e8f0' }}
                                                    >
                                                        <option value="">All statuses</option>
                                                        <option value="Pending Approval">Pending Approval</option>
                                                        <option value="Pending SciOps Approval">Pending SciOps Approval</option>
                                                        <option value="Approved">Approved</option>
                                                        <option value="In Progress">In Progress</option>
                                                        <option value="Completed">Completed</option>
                                                        <option value="Rejected">Rejected</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#64748b' }}>From</label>
                                                    <Input type="date" value={reqDateFrom} onChange={(e) => setReqDateFrom(e.target.value)} className="w-[160px]" />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#64748b' }}>To</label>
                                                    <Input type="date" value={reqDateTo} onChange={(e) => setReqDateTo(e.target.value)} className="w-[160px]" />
                                                </div>
                                                {(reqStatusFilter || reqDateFrom || reqDateTo) && (
                                                    <Button variant="ghost" size="sm" onClick={() => { setReqStatusFilter(''); setReqDateFrom(''); setReqDateTo(''); }}>
                                                        Clear filters
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-6 pb-6">
                                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                                        <Table>
                                            <TableHeader>
                                                <TableRow style={{ backgroundColor: '#f8fafc' }}>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Request ID</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Requestor</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Product</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Submitted</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Status</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider text-right" style={{ color: '#64748b' }}>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredRequests.length > 0 ? (
                                                    paginate(filteredRequests, reqPage).map(req => {
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
                                                                        <button onClick={() => router.push(`/requests/${req.id}`)} className="text-sm font-medium hover:underline" style={{ color: '#1e40af' }}>
                                                                            {(req as any).requestId ?? req.id.slice(0, 8)}
                                                                        </button>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div>{req.requestorName}</div>
                                                                        <div className="text-xs" style={{ color: '#64748b' }}>{req.department}</div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div>{req.productName}</div>
                                                                        <div className="text-xs" style={{ color: '#64748b' }}>{(req as any).manufacturerPartNumber || '\u2014'}</div>
                                                                    </TableCell>
                                                                    <TableCell>{format(new Date(req.date), 'PPP')}</TableCell>
                                                                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                                                                    <TableCell className="text-right">
                                                                        {(req.status === 'Approved' || req.status === 'In Progress') && canEdit && (
                                                                            <Button size="sm" variant="outline" disabled={isSaving} onClick={() => handleRejectRequest(req)}>Reject</Button>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                                {isOpen && (
                                                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                        <TableCell colSpan={6} className="p-4">
                                                                            <div className="space-y-4">
                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                                                                                    <div>
                                                                                        <h4 className="font-semibold text-xs mb-1">Project</h4>
                                                                                        <p className="text-sm">{Array.isArray(req.project) ? req.project.join(', ') : (req.project ?? '—')}</p>
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
                                                                                {(req.lineItems ?? []).length > 0 && (
                                                                                    <div>
                                                                                        <h4 className="font-semibold text-xs mb-2">Line Items</h4>
                                                                                        <Table>
                                                                                            <TableHeader>
                                                                                                <TableRow>
                                                                                                    <TableHead>Requested Date</TableHead>
                                                                                                    <TableHead>Quantity</TableHead>
                                                                                                    <TableHead>Status</TableHead>
                                                                                                    {canEdit && <TableHead className="text-right">Action</TableHead>}
                                                                                                </TableRow>
                                                                                            </TableHeader>
                                                                                            <TableBody>
                                                                                                {(req.lineItems ?? []).map(li => (
                                                                                                    <TableRow key={li.id}>
                                                                                                        <TableCell>{li.requestedDate}</TableCell>
                                                                                                        <TableCell>{li.quantity}</TableCell>
                                                                                                        <TableCell>
                                                                                                            <Badge className={li.status === 'Fulfilled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                                                                                                {li.status}
                                                                                                            </Badge>
                                                                                                        </TableCell>
                                                                                                        {canEdit && (
                                                                                                            <TableCell className="text-right">
                                                                                                                {li.status === 'Pending' && (req.status === 'Approved' || req.status === 'In Progress') && (
                                                                                                                    <Button size="sm" disabled={isSaving} onClick={() => handleFulfillLineItem(req, li)}>
                                                                                                                        Fulfill
                                                                                                                    </Button>
                                                                                                                )}
                                                                                                            </TableCell>
                                                                                                        )}
                                                                                                    </TableRow>
                                                                                                ))}
                                                                                            </TableBody>
                                                                                        </Table>
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
                                                        <TableCell colSpan={7} className="h-24 text-center">{(reqStatusFilter || reqDateFrom || reqDateTo) ? 'No requests match your filters.' : 'No product requests found.'}</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                        <PaginationControls currentPage={reqPage} totalItems={filteredRequests.length} onPageChange={setReqPage} label="requests" />
                                    </div>
                                </div>
                )}

                {/* ── Approvals View (Director + Admin) ─────────────── */}
                {activeView === 'approvals' && (user.role === 'Director' || user.role === 'Admin') && (
                                <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                    <div className="p-6 pb-4">
                                        <h2 className="text-lg font-semibold" style={{ color: '#0f172a' }}>Pending Approvals</h2>
                                        <p className="text-sm" style={{ color: '#64748b' }}>
                                            {user.role === 'Admin'
                                                ? 'All pending requests across functional groups. Approve on behalf of OOO Directors.'
                                                : 'Product requests from your functional group awaiting your approval.'}
                                        </p>
                                    </div>
                                    <div className="px-6 pb-6">
                                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                                        <Table>
                                            <TableHeader>
                                                <TableRow style={{ backgroundColor: '#f8fafc' }}>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Request ID</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Requestor</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Product</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Total Items</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Submitted</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Status</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider text-right" style={{ color: '#64748b' }}>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {productRequests.filter(r => r.status === 'Pending Approval' || r.status === 'Pending SciOps Approval').length > 0 ? (
                                                    productRequests.filter(r => r.status === 'Pending Approval' || r.status === 'Pending SciOps Approval').map(req => {
                                                        const isOpen = openRequestIds.has(req.id);
                                                        const totalItems = (req.lineItems ?? []).reduce((sum, li) => sum + li.quantity, 0);
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
                                                                        <button onClick={() => router.push(`/requests/${req.id}`)} className="text-sm font-medium hover:underline" style={{ color: '#1e40af' }}>
                                                                            {(req as any).requestId ?? req.id.slice(0, 8)}
                                                                        </button>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div>{req.requestorName}</div>
                                                                        <div className="text-xs" style={{ color: '#64748b' }}>{req.requestorEmail}</div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div>{req.productName}</div>
                                                                        <div className="text-xs" style={{ color: '#64748b' }}>{(req as any).manufacturerPartNumber || '\u2014'}</div>
                                                                    </TableCell>
                                                                    <TableCell>{totalItems}</TableCell>
                                                                    <TableCell>{format(new Date(req.date), 'PPP')}</TableCell>
                                                                    <TableCell>{getStatusBadge(req.status)}</TableCell>
                                                                    <TableCell className="text-right">
                                                                        <div className="flex gap-2 justify-end">
                                                                            <Button size="sm" variant="outline" disabled={isSaving} onClick={() => handleRejectRequest(req)}>Reject</Button>
                                                                            <Button size="sm" disabled={isSaving} onClick={() => handleApproveRequest(req)}>Approve</Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                                {isOpen && (
                                                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                        <TableCell colSpan={8} className="p-4">
                                                                            <div className="space-y-4">
                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                                                                                    <div>
                                                                                        <h4 className="font-semibold text-xs mb-1">Project</h4>
                                                                                        <p className="text-sm">{Array.isArray(req.project) ? req.project.join(', ') : (req.project ?? '—')}</p>
                                                                                    </div>
                                                                                    <div>
                                                                                        <h4 className="font-semibold text-xs mb-1">Justification</h4>
                                                                                        <p className="text-sm text-muted-foreground">{req.justification}</p>
                                                                                    </div>
                                                                                </div>
                                                                                {(req.lineItems ?? []).length > 0 && (
                                                                                    <div>
                                                                                        <h4 className="font-semibold text-xs mb-2">Requested Line Items</h4>
                                                                                        <Table>
                                                                                            <TableHeader>
                                                                                                <TableRow>
                                                                                                    <TableHead>Date Needed</TableHead>
                                                                                                    <TableHead>Quantity</TableHead>
                                                                                                </TableRow>
                                                                                            </TableHeader>
                                                                                            <TableBody>
                                                                                                {(req.lineItems ?? []).map(li => (
                                                                                                    <TableRow key={li.id}>
                                                                                                        <TableCell>{li.requestedDate}</TableCell>
                                                                                                        <TableCell>{li.quantity}</TableCell>
                                                                                                    </TableRow>
                                                                                                ))}
                                                                                            </TableBody>
                                                                                        </Table>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="h-24 text-center">No pending approvals for your group.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                    </div>
                                </div>
                )}

                {/* ── Fulfillments View ──────────────────────────────── */}
                {activeView === 'fulfillments' && canEdit && (
                    <div className="space-y-6">
                    {/* Approved/In-Progress requests with line-item fulfill */}
                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                        <div className="p-6 pb-4">
                            <h2 className="text-lg font-semibold" style={{ color: '#0f172a' }}>Requests Ready for Fulfillment</h2>
                            <p className="text-sm" style={{ color: '#64748b' }}>Approved and in-progress requests with line items to fulfill.</p>
                        </div>
                        <div className="px-6 pb-6">
                            <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                                <Table>
                                    <TableHeader>
                                        <TableRow style={{ backgroundColor: '#f8fafc' }}>
                                            <TableHead className="w-[50px]"></TableHead>
                                            <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Request ID</TableHead>
                                            <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Product</TableHead>
                                            <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Requestor</TableHead>
                                            <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Status</TableHead>
                                            <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider text-right" style={{ color: '#64748b' }}>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {productRequests.filter(r => r.status === 'Approved' || r.status === 'In Progress').length > 0 ? (
                                            productRequests.filter(r => r.status === 'Approved' || r.status === 'In Progress').map(req => {
                                                const isOpen = openRequestIds.has(req.id);
                                                return (
                                                    <React.Fragment key={req.id}>
                                                        <TableRow data-state={isOpen ? 'open' : 'closed'}>
                                                            <TableCell>
                                                                <Button variant="ghost" size="sm" className="w-9 p-0" onClick={() => toggleRequestCollapse(req.id)}>
                                                                    <ChevronsUpDown className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                            <TableCell>
                                                                <button onClick={() => router.push(`/requests/${req.id}`)} className="text-sm font-medium hover:underline" style={{ color: '#1e40af' }}>
                                                                    {(req as any).requestId ?? req.id.slice(0, 8)}
                                                                </button>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div>{req.productName}</div>
                                                                <div className="text-xs" style={{ color: '#64748b' }}>{(req as any).manufacturerPartNumber || '\u2014'}</div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div>{req.requestorName}</div>
                                                                <div className="text-xs" style={{ color: '#64748b' }}>{req.department}</div>
                                                            </TableCell>
                                                            <TableCell>{getStatusBadge(req.status)}</TableCell>
                                                            <TableCell className="text-right">
                                                                {canEdit && <Button size="sm" variant="outline" disabled={isSaving} onClick={() => handleRejectRequest(req)}>Reject</Button>}
                                                            </TableCell>
                                                        </TableRow>
                                                        {isOpen && (
                                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                <TableCell colSpan={6} className="p-4">
                                                                    <h4 className="font-semibold text-xs mb-2">Line Items</h4>
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow>
                                                                                <TableHead>Requested Date</TableHead>
                                                                                <TableHead>Quantity</TableHead>
                                                                                <TableHead>Status</TableHead>
                                                                                {canEdit && <TableHead className="text-right">Action</TableHead>}
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {(req.lineItems ?? []).map(li => (
                                                                                <TableRow key={li.id}>
                                                                                    <TableCell>{li.requestedDate}</TableCell>
                                                                                    <TableCell>{li.quantity}</TableCell>
                                                                                    <TableCell>
                                                                                        <Badge className={li.status === 'Fulfilled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                                                                                            {li.status}
                                                                                        </Badge>
                                                                                    </TableCell>
                                                                                    {canEdit && <TableCell className="text-right">
                                                                                        {li.status === 'Pending' && (
                                                                                            <Button size="sm" disabled={isSaving} onClick={() => handleFulfillLineItem(req, li)} style={{ backgroundColor: '#1e40af' }}>
                                                                                                Fulfill
                                                                                            </Button>
                                                                                        )}
                                                                                    </TableCell>}
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center">No requests ready for fulfillment.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    {/* Legacy fulfillments (read-only history) */}
                    {fulfillments.length > 0 && (
                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                        <div className="p-6 pb-4">
                            <h2 className="text-lg font-semibold" style={{ color: '#0f172a' }}>Legacy Fulfillments</h2>
                            <p className="text-sm" style={{ color: '#64748b' }}>Historical fulfillment records. Use the line-item flow above for new fulfillments.</p>
                        </div>
                        <div className="px-6 pb-6">
                            <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow style={{ backgroundColor: '#f8fafc' }}>
                                                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Request</TableHead>
                                                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Product</TableHead>
                                                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Department</TableHead>
                                                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Dispensed</TableHead>
                                                        <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Dispensed Dates</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {fulfillments.map(f => {
                                                        const dispensed = f.dispensedItems.reduce((sum, tx) => sum + tx.totalQuantity, 0);
                                                        const matchingReq = productRequests.find(r => r.id === f.requestId);
                                                        return (
                                                            <TableRow key={f.id}>
                                                                <TableCell>
                                                                    {f.requestId ? (
                                                                        <button onClick={() => router.push(`/requests/${f.requestId}`)} className="text-sm font-medium hover:underline" style={{ color: '#1e40af' }}>
                                                                            {(matchingReq as any)?.requestId ?? f.requestId.slice(0, 8)}
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">—</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div>{f.productName}</div>
                                                                    <div className="text-xs text-muted-foreground">{f.productId}</div>
                                                                </TableCell>
                                                                <TableCell>{f.department}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline">{dispensed} units</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-xs" style={{ color: '#64748b' }}>
                                                                    {f.dispensedItems.length > 0
                                                                        ? f.dispensedItems.map(tx => format(new Date(tx.date), 'MMM d, yyyy')).join(', ')
                                                                        : '—'}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                        </div>
                                    </div>
                    )}
                    </div>
                )}

                {/* ── Transactions View ──────────────────────────────── */}
                {activeView === 'transactions' && hasFullView && (
                                <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                    <div className="p-6 pb-4">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h2 className="text-lg font-semibold" style={{ color: '#0f172a' }}>Transaction History</h2>
                                                    <p className="text-sm" style={{ color: '#64748b' }}>View a log of all inventory transactions.</p>
                                                </div>
                                                <Button variant="outline" onClick={handleExportTransactions}>
                                                    <Download className="mr-2 h-4 w-4" /> Export Excel
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap items-end gap-3">
                                                <div>
                                                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#64748b' }}>From</label>
                                                    <Input type="date" value={txDateFrom} onChange={(e) => setTxDateFrom(e.target.value)} className="w-[160px]" />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#64748b' }}>To</label>
                                                    <Input type="date" value={txDateTo} onChange={(e) => setTxDateTo(e.target.value)} className="w-[160px]" />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#64748b' }}>Department</label>
                                                    <select
                                                        value={txDeptFilter}
                                                        onChange={(e) => setTxDeptFilter(e.target.value)}
                                                        className="h-10 rounded-md border px-3 text-sm w-[200px]"
                                                        style={{ borderColor: '#e2e8f0' }}
                                                    >
                                                        <option value="">All departments</option>
                                                        {txDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                                                    </select>
                                                </div>
                                                {(txDateFrom || txDateTo || txDeptFilter) && (
                                                    <Button variant="ghost" size="sm" onClick={() => { setTxDateFrom(''); setTxDateTo(''); setTxDeptFilter(''); }}>
                                                        Clear filters
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-6 pb-6">
                                        <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
                                        <Table>
                                            <TableHeader>
                                                <TableRow style={{ backgroundColor: '#f8fafc' }}>
                                                    <TableHead className="w-[50px]"></TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Product</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Date</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Quantity Dispensed</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Requestor</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Department</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>Notes</TableHead>
                                                    <TableHead className="text-[11.5px] font-semibold uppercase tracking-wider text-right" style={{ color: '#64748b' }}>Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                            {filteredTransactions.length > 0 ? (
                                                paginate(filteredTransactions, txPage).map(tx => {
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
                                                                    {canEdit && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                            <DropdownMenuContent align="end">
                                                                                <DropdownMenuItem onClick={() => handleDeleteTransaction(tx)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
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
                                                <TableRow><TableCell colSpan={8} className="h-24 text-center">{(txDateFrom || txDateTo || txDeptFilter) ? 'No transactions match your filters.' : 'No transactions have been recorded yet.'}</TableCell></TableRow>
                                            )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                        <PaginationControls currentPage={txPage} totalItems={filteredTransactions.length} onPageChange={setTxPage} label="transactions" />
                                    </div>
                                </div>
                )}

                {/* ── Config: Users ──────────────────────────────── */}
                {(activeView === 'configuration' || activeView === 'config-users') && canEdit && (
                                <div className="space-y-6">
                                    {/* Users table */}
                                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                        <div className="p-6 pb-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#0f172a' }}><UserCog className="h-5 w-5" /> Users</h2>
                                                    <p className="text-sm" style={{ color: '#64748b' }}>Manage system users, roles, and functional group assignments.</p>
                                                </div>
                                                {canEdit && (
                                                    <Button onClick={() => handleOpenUserForm(null)} style={{ backgroundColor: '#1e40af' }}>
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Add User
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="px-6 pb-6">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Email</TableHead>
                                                        <TableHead>Role</TableHead>
                                                        <TableHead>Functional Group</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {appUsers.length === 0 && (
                                                        <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground py-8">No users found.</TableCell></TableRow>
                                                    )}
                                                    {paginate(appUsers, usersPage).map(u => (
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
                                                            {canEdit && <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1 items-center">
                                                                    {u.isSystem && <span className="text-xs mr-1" style={{ color: '#64748b' }}>System Admin</span>}
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleOpenUserForm(u)}>
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Edit user</TooltipContent>
                                                                    </Tooltip>
                                                                    {!u.isSystem && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleToggleUserStatus(u)}>
                                                                                {u.isActive ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{u.isActive ? 'Deactivate user' : 'Activate user'}</TooltipContent>
                                                                    </Tooltip>
                                                                    )}
                                                                </div>
                                                            </TableCell>}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <PaginationControls currentPage={usersPage} totalItems={appUsers.length} onPageChange={setUsersPage} label="users" />
                                        </div>
                                    </div>
                                </div>
                )}

                {/* ── Config: Functional Groups ──────────────────────────── */}
                {(activeView === 'configuration' || activeView === 'config-groups') && canEdit && (
                                <div className="space-y-6">
                                    {/* Functional Groups table */}
                                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                        <div className="p-6 pb-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#0f172a' }}><Building2 className="h-5 w-5" /> Functional Groups</h2>
                                                    <p className="text-sm" style={{ color: '#64748b' }}>Manage HULLC functional groups. Deactivating a group does not remove existing user assignments.</p>
                                                </div>
                                                {canEdit && (
                                                    <Button onClick={() => handleOpenGroupForm(null)} style={{ backgroundColor: '#1e40af' }}>
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Group
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="px-6 pb-6">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Group Name</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {functionalGroups.length === 0 && (
                                                        <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center text-muted-foreground py-8">No functional groups found.</TableCell></TableRow>
                                                    )}
                                                    {paginate(functionalGroups, groupsPage).map(g => (
                                                        <TableRow key={g.id}>
                                                            <TableCell className="font-medium">{g.name}</TableCell>
                                                            <TableCell>
                                                                <Badge className={g.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}>
                                                                    {g.isActive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                                                    {g.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </TableCell>
                                                            {canEdit && <TableCell className="text-right">
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
                                                            </TableCell>}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <PaginationControls currentPage={groupsPage} totalItems={functionalGroups.length} onPageChange={setGroupsPage} label="groups" />
                                        </div>
                                    </div>
                                </div>
                )}

                {/* ── Config: Projects ──────────────────────────── */}
                {(activeView === 'configuration' || activeView === 'config-projects') && canEdit && (
                                <div className="space-y-6">
                                    {/* Projects table */}
                                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                        <div className="p-6 pb-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#0f172a' }}><Package className="h-5 w-5" /> Projects</h2>
                                                    <p className="text-sm" style={{ color: '#64748b' }}>Manage projects available for product requests.</p>
                                                </div>
                                                {canEdit && (
                                                    <Button onClick={() => handleOpenProjectForm(null)} style={{ backgroundColor: '#1e40af' }}>
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Project
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="px-6 pb-6">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Project Name</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {appProjects.length === 0 && (
                                                        <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center text-muted-foreground py-8">No projects found.</TableCell></TableRow>
                                                    )}
                                                    {paginate(appProjects, projectsPage).map(p => (
                                                        <TableRow key={p.id}>
                                                            <TableCell className="font-medium">{p.name}</TableCell>
                                                            <TableCell>
                                                                <Badge className={p.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}>
                                                                    {p.isActive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                                                    {p.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </TableCell>
                                                            {canEdit && <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleOpenProjectForm(p)}>
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Rename project</TooltipContent>
                                                                    </Tooltip>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleToggleProjectStatus(p)}>
                                                                                {p.isActive ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{p.isActive ? 'Deactivate project' : 'Activate project'}</TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </TableCell>}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <PaginationControls currentPage={projectsPage} totalItems={appProjects.length} onPageChange={setProjectsPage} label="projects" />
                                        </div>
                                    </div>
                                </div>
                )}

                {/* ── Config: Manufacturers ──────────────────────────── */}
                {activeView === 'config-manufacturers' && canEdit && (
                                <div className="space-y-6">
                                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                        <div className="p-6 pb-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#0f172a' }}>Manufacturers</h2>
                                                    <p className="text-sm" style={{ color: '#64748b' }}>Manage manufacturers for products.</p>
                                                </div>
                                                {canEdit && (
                                                    <Button onClick={() => handleOpenManufacturerForm(null)} style={{ backgroundColor: '#1e40af' }}>
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Manufacturer
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="px-6 pb-6">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Manufacturer Name</TableHead>
                                                        <TableHead>Alternate Name</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {appManufacturers.length === 0 && (
                                                        <TableRow><TableCell colSpan={canEdit ? 4 : 3} className="text-center text-muted-foreground py-8">No manufacturers found.</TableCell></TableRow>
                                                    )}
                                                    {paginate(appManufacturers, mfgPage).map(m => (
                                                        <TableRow key={m.id}>
                                                            <TableCell className="font-medium">{m.name}</TableCell>
                                                            <TableCell className="text-muted-foreground text-sm">{m.alternateNames || '\u2014'}</TableCell>
                                                            <TableCell>
                                                                <Badge className={m.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}>
                                                                    {m.isActive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                                                    {m.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </TableCell>
                                                            {canEdit && <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleOpenManufacturerForm(m)}>
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Edit manufacturer</TooltipContent>
                                                                    </Tooltip>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleToggleManufacturerStatus(m)}>
                                                                                {m.isActive ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{m.isActive ? 'Deactivate manufacturer' : 'Activate manufacturer'}</TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </TableCell>}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <PaginationControls currentPage={mfgPage} totalItems={appManufacturers.length} onPageChange={setMfgPage} label="manufacturers" />
                                        </div>
                                    </div>
                                </div>
                )}

                {/* ── Config: Storage Locations ──────────────────────────── */}
                {activeView === 'config-locations' && canEdit && (
                                <div className="space-y-6">
                                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                                        <div className="p-6 pb-4">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#0f172a' }}>Storage Locations</h2>
                                                    <p className="text-sm" style={{ color: '#64748b' }}>Manage storage locations for lot rows. Locations in use by active lots cannot be deactivated.</p>
                                                </div>
                                                {canEdit && (
                                                    <Button onClick={() => handleOpenLocationForm(null)} style={{ backgroundColor: '#1e40af' }}>
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Location
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="px-6 pb-6">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Location Name</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        {canEdit && <TableHead className="text-right">Actions</TableHead>}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {appLocations.length === 0 && (
                                                        <TableRow><TableCell colSpan={canEdit ? 3 : 2} className="text-center text-muted-foreground py-8">No storage locations found.</TableCell></TableRow>
                                                    )}
                                                    {paginate(appLocations, locationsPage).map(l => (
                                                        <TableRow key={l.id}>
                                                            <TableCell className="font-medium">{l.name}</TableCell>
                                                            <TableCell>
                                                                <Badge className={l.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}>
                                                                    {l.isActive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                                                                    {l.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </TableCell>
                                                            {canEdit && <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleOpenLocationForm(l)}>
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Rename location</TooltipContent>
                                                                    </Tooltip>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="sm" variant="ghost" onClick={() => handleToggleLocationStatus(l)}>
                                                                                {l.isActive ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{l.isActive ? 'Deactivate location' : 'Activate location'}</TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            </TableCell>}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            <PaginationControls currentPage={locationsPage} totalItems={appLocations.length} onPageChange={setLocationsPage} label="locations" />
                                        </div>
                                    </div>
                                </div>
                )}

                </main>
            </TooltipProvider>
            </div>

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
                            <Label htmlFor="uf-fullname" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Full Name<span style={{ color: '#ef4444' }}> *</span></Label>
                            <Input id="uf-fullname" value={userFormData.fullName} onChange={e => setUserFormData(p => ({ ...p, fullName: e.target.value }))} required placeholder="Jane Smith" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="uf-email" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Email<span style={{ color: '#ef4444' }}> *</span></Label>
                            <Input id="uf-email" type="email" value={userFormData.email} onChange={e => setUserFormData(p => ({ ...p, email: e.target.value }))} required placeholder="jane@nih.gov" disabled={!!userToEdit?.isSystem} style={{ backgroundColor: userToEdit?.isSystem ? '#f1f5f9' : '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                            {userToEdit?.isSystem && <p className="text-xs" style={{ color: '#64748b' }}>System Administrator email cannot be changed.</p>}
                        </div>
                        {!userToEdit && (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="uf-password" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Temporary Password<span style={{ color: '#ef4444' }}> *</span></Label>
                                <Input id="uf-password" type="password" value={userFormData.password} onChange={e => setUserFormData(p => ({ ...p, password: e.target.value }))} required minLength={8} placeholder="Min. 8 characters" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                            </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="uf-role" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Role</Label>
                            <Select value={userFormData.role} onValueChange={v => setUserFormData(p => ({ ...p, role: v as UserRole }))} disabled={!!userToEdit?.isSystem}>
                                <SelectTrigger id="uf-role" style={{ backgroundColor: userToEdit?.isSystem ? '#f1f5f9' : '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {USER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="uf-group" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Functional Group</Label>
                            {userFormData.role === 'Director' && (
                                <p className="text-xs text-amber-600 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Only one active Director is allowed per group.</p>
                            )}
                            <Select value={userFormData.functionalGroupId || 'none'} onValueChange={v => setUserFormData(p => ({ ...p, functionalGroupId: v === 'none' ? '' : v }))}>
                                <SelectTrigger id="uf-group" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }}><SelectValue placeholder="None" /></SelectTrigger>
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
                            <Label htmlFor="gf-name" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Group Name<span style={{ color: '#ef4444' }}> *</span></Label>
                            <Input id="gf-name" value={groupFormName} onChange={e => setGroupFormName(e.target.value)} required placeholder="e.g., Formulation Development" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
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

            {/* ── Project Form Dialog ──────────────────────────────── */}
            <Dialog open={isProjectFormOpen} onOpenChange={setIsProjectFormOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{projectToEdit ? 'Rename Project' : 'Add Project'}</DialogTitle>
                        <DialogDescription>
                            {projectToEdit ? 'Update the name of this project.' : 'Add a new project to the system.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveProject} className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="pf-name" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Project Name<span style={{ color: '#ef4444' }}> *</span></Label>
                            <Input id="pf-name" value={projectFormName} onChange={e => setProjectFormName(e.target.value)} required placeholder="e.g., Project Alpha" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsProjectFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {projectToEdit ? 'Save Changes' : 'Create Project'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Manufacturer Form Dialog ──────────────────────────────── */}
            <Dialog open={isManufacturerFormOpen} onOpenChange={setIsManufacturerFormOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{manufacturerToEdit ? 'Edit Manufacturer' : 'Add Manufacturer'}</DialogTitle>
                        <DialogDescription>
                            {manufacturerToEdit ? 'Update the manufacturer details.' : 'Add a new manufacturer to the system.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveManufacturer} className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="mf-name" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Manufacturer Name<span style={{ color: '#ef4444' }}> *</span></Label>
                            <Input id="mf-name" value={manufacturerFormName} onChange={e => setManufacturerFormName(e.target.value)} required placeholder="e.g., Genentech" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="mf-altnames" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Alternate Names (optional)</Label>
                            <Input id="mf-altnames" value={manufacturerFormAltNames} onChange={e => setManufacturerFormAltNames(e.target.value)} placeholder="e.g., Roche, Hoffman-La Roche" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                            <p className="text-xs" style={{ color: '#94a3b8' }}>Comma-separated alternate names</p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsManufacturerFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {manufacturerToEdit ? 'Save Changes' : 'Create Manufacturer'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── Storage Location Form Dialog ──────────────────────── */}
            <Dialog open={isLocationFormOpen} onOpenChange={setIsLocationFormOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{locationToEdit ? 'Rename Storage Location' : 'Add Storage Location'}</DialogTitle>
                        <DialogDescription>
                            {locationToEdit ? 'Update the name of this storage location.' : 'Add a new storage location to the system.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveLocation} className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="lf-name" style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Location Name<span style={{ color: '#ef4444' }}> *</span></Label>
                            <Input id="lf-name" value={locationFormName} onChange={e => setLocationFormName(e.target.value)} required placeholder="e.g., Room 101, Shelf A" style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: 8 }} />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsLocationFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {locationToEdit ? 'Save Changes' : 'Create Location'}
                            </Button>
                        </div>
                    </form>
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
                        <DialogTitle>Import Products from Excel</DialogTitle>
                        <DialogDescription>
                            Upload an Excel (.xlsx) or CSV file to bulk-import products. Product IDs are auto-generated.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm bg-muted p-4 rounded-md overflow-x-auto space-y-2">
                        <div>
                            <span className="font-semibold">Supported columns:</span>{' '}
                            <code className="font-mono whitespace-nowrap">
                                product_name, manufacturer, manufacturer_part_number, lot_number, quantity, receipt_date, location, vwr_part_number, uom, som_approval_required, cost_per_unit, reorder_threshold, expiration_date, notes
                            </code>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Each row represents a single lot. Rows with the same product_name + manufacturer + manufacturer_part_number are grouped under one product. Missing mandatory values are auto-filled with placeholders (e.g. LOT-1-Missing) for admin review. If the file contains multiple sheets, you will be asked to select which sheet to import.
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

            {/* Sheet selector dialog for multi-sheet Excel files */}
            <Dialog open={sheetSelectorOpen} onOpenChange={(open) => {
                if (!open) {
                    setSheetSelectorOpen(false);
                    setPendingWorkbook(null);
                    setSheetNames([]);
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Sheet</DialogTitle>
                        <DialogDescription>
                            This file contains multiple sheets. Select the sheet to import:
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        {sheetNames.map((name) => (
                            <button
                                key={name}
                                onClick={() => {
                                    if (pendingWorkbook) {
                                        processImportSheet(pendingWorkbook, name);
                                    }
                                }}
                                disabled={isImporting}
                                className="w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50"
                                style={{ borderColor: '#e2e8f0', color: '#0f172a' }}
                            >
                                {isImporting ? (
                                    <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Importing...</span>
                                ) : name}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-end pt-2">
                        <Button variant="ghost" onClick={() => {
                            setSheetSelectorOpen(false);
                            setPendingWorkbook(null);
                            setSheetNames([]);
                        }} disabled={isImporting}>Cancel</Button>
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

            <AlertDialog open={!!requestToApprove} onOpenChange={(open) => !open && setRequestToApprove(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Request</AlertDialogTitle>
                        <AlertDialogDescription>
                            Approve the request from {requestToApprove?.requestorName} for &quot;{requestToApprove?.productName}&quot;. You may add optional comments.
                        </AlertDialogDescription>
                        <div className="space-y-2 pt-2">
                            <Label htmlFor="approve-comments" className="sr-only">Comments (optional)</Label>
                            <Textarea
                                id="approve-comments"
                                placeholder="Optional comments for the requestor..."
                                value={approveComments}
                                onChange={(e) => setApproveComments(e.target.value)}
                            />
                        </div>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRequestToApprove(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmApproveRequest}>Confirm Approve</AlertDialogAction>
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

            {/* Material Audit Report (Phase 12) */}
            {auditProduct && (
                <MaterialAuditReport
                    product={auditProduct}
                    generatedBy={user.fullName ?? user.email ?? 'Unknown'}
                    onClose={() => setAuditProduct(null)}
                />
            )}
        </div>
    );
}
