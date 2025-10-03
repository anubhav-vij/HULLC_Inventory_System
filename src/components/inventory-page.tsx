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
import { ChevronsUpDown, MoreHorizontal, Package, Pencil, PlusCircle, Warehouse, ArrowRightLeft, CloudUpload, Loader2, AlertTriangle, Download, Trash2, CheckCircle2, XCircle, Hourglass, FileText, Search, LogOut } from 'lucide-react';
import { ProductForm } from './product-form';
import { TransactionForm } from './transaction-form';
import { RequestForm } from './request-form';
import { type Product, type Lot, type ProductFormData, type Transaction, type TransactionFormData, type User, type UserRole, type ProductRequest, type ProductRequestFormData, type ProductRequestStatus, DEPARTMENTS, type DepartmentalProduct } from '@/lib/types';
import { StockPilotLogo } from './icons';
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

const initialProducts: Product[] = [
    {
        id: "P001",
        name: "Test Product A",
        vendor: "Test Vendor",
        vendorPartNumber: "Part 001",
        reorderThreshold: 20,
        lots: [
            { id: uuidv4(), lotNumber: "Lot 1", quantity: 100, receiptDate: new Date("2025-02-25"), expirationDate: new Date("2026-02-28"), location: "Room 1", file: null },
            { id: uuidv4(), lotNumber: "Lot 2", quantity: 10, receiptDate: new Date("2025-02-02"), expirationDate: new Date("2025-03-03"), location: "Room 2", file: null },
        ]
    },
    {
        id: "P002",
        name: "Another Item B",
        vendor: "Sample Inc.",
        vendorPartNumber: "Item-B-42",
        reorderThreshold: 100,
        lots: [
            { id: uuidv4(), lotNumber: "Lot-XYZ", quantity: 500, receiptDate: new Date("2024-08-15"), expirationDate: new Date("2025-08-15"), location: "Warehouse 3", file: null },
        ]
    }
];

const PRODUCTS_STORAGE_KEY_PREFIX = 'stockpilot-products-data';
const TRANSACTIONS_STORAGE_KEY_PREFIX = 'stockpilot-transactions-data';
const REQUESTS_STORAGE_KEY_PREFIX = 'stockpilot-requests-data';
const USER_STORAGE_KEY = 'stockpilot-user-data';
const DEPT_PRODUCTS_STORAGE_KEY_PREFIX = 'stockpilot-dept-products';


export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [productRequests, setProductRequests] = useState<ProductRequest[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [productForTransaction, setProductForTransaction] = useState<Product | null>(null);
    const [productForRequest, setProductForRequest] = useState<Product | null>(null);
    const [requestToFulfill, setRequestToFulfill] = useState<ProductRequest | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openProductIds, setOpenProductIds] = useState<Set<string>>(new Set());
    const [openTransactionIds, setOpenTransactionIds] = useState<Set<string>>(new Set());
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [requestToReject, setRequestToReject] = useState<ProductRequest | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loginStep, setLoginStep] = useState<'role' | 'department'>('role');
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    
    const { toast } = useToast();

    const department = user?.department || 'core';
    const productsStorageKey = `${PRODUCTS_STORAGE_KEY_PREFIX}-${department}`;
    const transactionsStorageKey = `${TRANSACTIONS_STORAGE_KEY_PREFIX}-${department}`;
    const requestsStorageKey = `${REQUESTS_STORAGE_KEY_PREFIX}-${department}`;

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

    useEffect(() => {
        try {
            const storedUserItem = window.localStorage.getItem(USER_STORAGE_KEY);
            if (storedUserItem) {
                setUser(JSON.parse(storedUserItem));
            }
        } catch (e) { console.error(e) }
        setIsLoading(false);
    }, []);
    
    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        };

        const loadData = () => {
            setIsLoading(true);
            try {
                const isCoreSystem = user.department === 'core';
                const pKey = `${PRODUCTS_STORAGE_KEY_PREFIX}-${user.department}`;
                const tKey = `${TRANSACTIONS_STORAGE_KEY_PREFIX}-${user.department}`;
                const rKey = `${REQUESTS_STORAGE_KEY_PREFIX}-${user.department}`;

                const storedProductsItem = window.localStorage.getItem(pKey);
                let loadedProducts: Product[];
                if (storedProductsItem) {
                    loadedProducts = JSON.parse(storedProductsItem).map((product: any) => ({
                        ...product,
                        reorderThreshold: product.reorderThreshold ?? null,
                        lots: product.lots.map((lot: any) => ({
                            ...lot,
                            location: lot.location || '',
                            receiptDate: new Date(lot.receiptDate),
                            expirationDate: lot.expirationDate ? new Date(lot.expirationDate) : null,
                            file: lot.file,
                        })),
                    }));
                } else {
                    loadedProducts = isCoreSystem ? initialProducts : [];
                }
                setProducts(loadedProducts);

                const storedTransactionsItem = window.localStorage.getItem(tKey);
                setTransactions(storedTransactionsItem ? JSON.parse(storedTransactionsItem).map((tx: any) => ({ ...tx, date: new Date(tx.date) })) : []);
                
                const storedRequestsItem = window.localStorage.getItem(rKey);
                setProductRequests(storedRequestsItem ? JSON.parse(storedRequestsItem).map((req: any) => ({ ...req, date: new Date(req.date) })) : []);

            } catch (error) {
                console.error('Error reading from local storage', error);
                setProducts(user.department === 'core' ? initialProducts : []);
                setTransactions([]);
                setProductRequests([]);
            }
            setIsLoading(false);
        }

        loadData();

    }, [user]);

    useEffect(() => {
        if (!isLoading && user && user.department === 'core') {
            try {
                window.localStorage.setItem(productsStorageKey, JSON.stringify(products));
                window.localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions));
                window.localStorage.setItem(requestsStorageKey, JSON.stringify(productRequests));
                window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            } catch (error) {
                console.error("Failed to save to localStorage:", error);
                toast({
                    title: "Save Error",
                    description: "Could not save changes. Your browser's storage might be full.",
                    variant: "destructive",
                });
            }
        }
    }, [products, transactions, productRequests, user, isLoading, toast, productsStorageKey, transactionsStorageKey, requestsStorageKey]);

    const nextProductId = useMemo(() => {
        if (products.length === 0) return 'P001';
        const maxId = products.reduce((max, p) => {
            const num = parseInt(p.id.substring(1));
            return num > max ? num : max;
        }, 0);
        return `P${(maxId + 1).toString().padStart(3, '0')}`;
    }, [products]);
    
    const handleRoleSelect = (role: UserRole | 'Departmental Staff') => {
        if (role === 'Admin' || role === 'Staff') {
            setUser({ role, department: 'core' });
        } else { // Departmental Staff
            setSelectedRole('Staff');
            setLoginStep('department');
        }
    };

    const handleDepartmentSelect = (department: string) => {
        if (department) {
            setUser({ role: 'Staff', department });
            setLoginStep('role');
            setSelectedRole(null);
        }
    };

    const handleLogout = () => {
        setUser(null);
        window.localStorage.removeItem(USER_STORAGE_KEY);
        setProducts([]);
        setTransactions([]);
        setProductRequests([]);
    };

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

        for (const lot of productToDelete.lots) {
            if (lot.file?.id) {
                await deleteFile(lot.file.id);
            }
        }

        setProducts(products.filter(p => p.id !== productToDelete.id));
        toast({ title: "Product Deleted", description: `"${productToDelete.name}" has been removed.`});
        setProductToDelete(null);
    };

    const handleDeleteTransaction = (transaction: Transaction) => {
        setTransactionToDelete(transaction);
    };

    const handleConfirmDeleteTransaction = () => {
        if (!transactionToDelete) return;
    
        const product = products.find(p => p.id === transactionToDelete.productId);
        if (product) {
            const updatedLots = product.lots.map(lot => {
                const transactionItem = transactionToDelete.items.find(item => item.lotId === lot.id);
                if (transactionItem) {
                    return { ...lot, quantity: lot.quantity + transactionItem.quantity };
                }
                return lot;
            });
            const updatedProduct = { ...product, lots: updatedLots };
            setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
        }
    
        setTransactions(transactions.filter(t => t.id !== transactionToDelete.id));
        toast({ title: "Transaction Deleted", description: `Transaction from ${format(transactionToDelete.date, 'PPP')} has been removed.`});
        setTransactionToDelete(null);
    };

    const handleSaveProduct = async (data: ProductFormData) => {
        setIsSaving(true);
        try {
            if (productToEdit) {
                const originalLotIds = new Set(productToEdit.lots.map(l => l.id));
                const currentLotIds = new Set(data.lots.map(l => l.id));
                for (const lotId of originalLotIds) {
                    if (!currentLotIds.has(lotId)) {
                        const lotToRemove = productToEdit.lots.find(l => l.id === lotId);
                        if (lotToRemove?.file?.id) {
                            await deleteFile(lotToRemove.file.id);
                        }
                    }
                }
                const updatedProducts = products.map(p => p.id === productToEdit.id ? { ...p, ...data } : p);
                setProducts(updatedProducts);
                toast({ title: "Product Updated", description: `"${data.name}" has been updated successfully.` });
            } else {
                const newProduct: Product = { id: nextProductId, ...data, lots: data.lots.map(lot => ({...lot, id: uuidv4()}))};
                setProducts(prevProducts => [...prevProducts, newProduct]);
                toast({ title: "Product Added", description: `"${newProduct.name}" has been added successfully.` });
            }
            setIsFormOpen(false);
            setProductToEdit(null);
        } catch (error) {
            console.error("Error saving product:", error);
            toast({ title: "Save Failed", description: "There was an error saving the product.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const addFulfilledItemsToDepartmentInventory = (request: ProductRequest, transaction: Transaction) => {
        const deptKey = `${DEPT_PRODUCTS_STORAGE_KEY_PREFIX}-${request.department}`;
        const deptProductsRaw = window.localStorage.getItem(deptKey);
        let deptProducts: DepartmentalProduct[] = deptProductsRaw ? JSON.parse(deptProductsRaw) : [];
        
        const coreProduct = products.find(p => p.id === transaction.productId);
        if (!coreProduct) return;

        let deptProduct = deptProducts.find(p => p.id === transaction.productId);

        if (deptProduct) {
            // Product exists, update its quantity
            deptProduct.quantity += transaction.totalQuantity;
        } else {
            // Product is new to the department, create it
            deptProduct = {
                id: coreProduct.id,
                name: coreProduct.name,
                vendor: coreProduct.vendor,
                vendorPartNumber: coreProduct.vendorPartNumber,
                quantity: transaction.totalQuantity,
            };
            deptProducts.push(deptProduct);
        }
        
        window.localStorage.setItem(deptKey, JSON.stringify(deptProducts));
    };


    const handleSaveTransaction = (data: TransactionFormData) => {
        if (!productForTransaction) return;
        setIsSaving(true);
    
        const finalLots = productForTransaction.lots.map(lot => {
            const transactionItem = data.items.find(item => item.lotId === lot.id);
            if (transactionItem) {
                return { ...lot, quantity: lot.quantity - transactionItem.quantityTaken };
            }
            return lot;
        });

        const updatedProduct = { ...productForTransaction, lots: finalLots };
        setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));

        const dispensedItems = data.items
            .filter(item => item.quantityTaken > 0)
            .map(item => {
                const lot = productForTransaction.lots.find(l => l.id === item.lotId)!;
                return { lotId: lot.id, lotNumber: lot.lotNumber, quantity: item.quantityTaken };
            });
        const totalQuantityDispensed = dispensedItems.reduce((sum, item) => sum + item.quantity, 0);

        const newTransaction: Transaction = {
            id: uuidv4(),
            productId: productForTransaction.id,
            productName: productForTransaction.name,
            date: data.date,
            notes: data.notes,
            items: dispensedItems,
            totalQuantity: totalQuantityDispensed,
            ...(requestToFulfill && {
                requestorName: requestToFulfill.requestorName,
                department: requestToFulfill.department
            })
        };
        setTransactions([newTransaction, ...transactions]);
        
        if (requestToFulfill) {
            setProductRequests(productRequests.map(r => 
                r.id === requestToFulfill.id ? { ...r, status: 'Completed' } : r
            ));
            addFulfilledItemsToDepartmentInventory(requestToFulfill, newTransaction);
            toast({ title: "Request Fulfilled", description: `Dispensed ${totalQuantityDispensed} of "${productForTransaction.name}". Stock added to ${requestToFulfill.department} inventory.` });
        } else {
            toast({ title: "Transaction Saved", description: `Dispensed ${totalQuantityDispensed} of "${productForTransaction.name}".` });
        }
        
        setIsSaving(false);
        setIsTransactionFormOpen(false);
        setProductForTransaction(null);
        setRequestToFulfill(null);
    };
    
    const handleSaveRequest = (data: ProductRequestFormData) => {
        if (!productForRequest) return;
        setIsSaving(true);
    
        const newRequest: ProductRequest = {
            id: uuidv4(),
            productId: productForRequest.id,
            productName: productForRequest.name,
            ...data,
            date: new Date(),
            status: 'Pending',
        };
        setProductRequests([newRequest, ...productRequests]);

        toast({
            title: "Request Submitted",
            description: `Your request for ${data.quantity} of "${productForRequest.name}" has been sent for review.`
        });
        setIsSaving(false);
        setIsRequestFormOpen(false);
        setProductForRequest(null);
    };

    const handleFulfillRequest = (request: ProductRequest) => {
        const product = products.find(p => p.id === request.productId);
        if (product) {
            setRequestToFulfill(request);
            setProductForTransaction(product);
            setIsTransactionFormOpen(true);
        } else {
            toast({ title: "Product Not Found", description: "The product for this request no longer exists.", variant: "destructive" });
        }
    };
    
    const handleRejectRequest = (request: ProductRequest) => {
        setRequestToReject(request);
    };
    
    const handleConfirmRejectRequest = () => {
        if (!requestToReject) return;
        setProductRequests(productRequests.map(r => 
            r.id === requestToReject.id ? { ...r, status: 'Rejected' } : r
        ));
        toast({ title: "Request Rejected" });
        setRequestToReject(null);
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
            complete: (results) => {
                try {
                    const requiredHeaders = [
                        'product_id', 'product_name', 'vendor', 'vendor_part_number', 'location', 
                        'lot_number', 'quantity', 'receipt_date', 'expiration_date', 'reorder_threshold'
                    ];
                    const headers = results.meta.fields || [];
                    if (!requiredHeaders.every(h => headers.includes(h))) {
                        throw new Error(`CSV must contain the following headers: ${requiredHeaders.join(', ')}`);
                    }

                    const importedProductsMap = new Map<string, Product>();

                    for (const row of results.data) {
                        const {
                            product_id, product_name, vendor, vendor_part_number, location,
                            lot_number, quantity, receipt_date, expiration_date, reorder_threshold
                        } = row;

                        if (!product_id || !product_name || !lot_number) continue;

                        const lot: Lot = {
                            id: uuidv4(),
                            lotNumber: lot_number,
                            quantity: parseInt(quantity, 10) || 0,
                            receiptDate: new Date(receipt_date),
                            expirationDate: expiration_date ? new Date(expiration_date) : null,
                            location: location,
                            file: null,
                        };

                        if (importedProductsMap.has(product_id)) {
                            importedProductsMap.get(product_id)!.lots.push(lot);
                        } else {
                            const newProduct: Omit<Product, 'lots'> & { lots: Lot[] } = {
                                id: product_id,
                                name: product_name,
                                vendor: vendor,
                                vendorPartNumber: vendor_part_number,
                                reorderThreshold: reorder_threshold ? parseInt(reorder_threshold, 10) : null,
                                lots: [lot]
                            };
                            importedProductsMap.set(product_id, newProduct);
                        }
                    }
                    
                    const newProducts = Array.from(importedProductsMap.values());
                    if (newProducts.length === 0) {
                        toast({ title: "Import Failed", description: "No valid product data found in the file.", variant: "destructive" });
                        return;
                    }

                    const updatedProducts = [...products];
                    newProducts.forEach(newProduct => {
                        const existingIndex = updatedProducts.findIndex(p => p.id === newProduct.id);
                        if (existingIndex > -1) {
                            updatedProducts[existingIndex] = newProduct;
                        } else {
                            updatedProducts.push(newProduct);
                        }
                    });

                    setProducts(updatedProducts);
                    toast({ title: "Import Successful", description: `${newProducts.length} product(s) imported.` });

                } catch (error: any) {
                    toast({ title: "Import Failed", description: error.message, variant: "destructive" });
                } finally {
                    setIsImporting(false);
                    setIsImportDialogOpen(false);
                    if (event.target) {
                        event.target.value = '';
                    }
                }
            },
            error: (error: any) => {
                toast({ title: "Import Error", description: error.message, variant: "destructive" });
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

    const totalQuantity = (lots: Lot[]) => lots.reduce((sum, lot) => sum + lot.quantity, 0);
    
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
            'Completed': { color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle2 },
            'Rejected': { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
        };
        const Icon = statusConfig[status].icon;
        return (
            <Badge className={cn('gap-1', statusConfig[status].color)}>
                <Icon className="h-3 w-3" />
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
         if (loginStep === 'department') {
            return (
                <div className="flex items-center justify-center min-h-screen bg-background">
                    <Card className="w-full max-w-sm">
                        <CardHeader className="text-center">
                            <div className="flex justify-center items-center gap-3 mb-4">
                                <StockPilotLogo className="h-8 w-8 text-primary" />
                                <CardTitle className="text-2xl">Select Department</CardTitle>
                            </div>
                            <CardDescription>Choose your department to access its inventory.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                             <Select onValueChange={handleDepartmentSelect}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEPARTMENTS.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button variant="link" onClick={() => setLoginStep('role')}>Back to role selection</Button>
                        </CardContent>
                    </Card>
                </div>
            )
        }
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Card className="w-full max-w-sm">
                    <CardHeader className="text-center">
                        <div className="flex justify-center items-center gap-3 mb-4">
                            <StockPilotLogo className="h-8 w-8 text-primary" />
                            <CardTitle className="text-2xl">StockPilot</CardTitle>
                        </div>
                        <CardDescription>Select a role to sign in.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
                         <Button size="lg" onClick={() => handleRoleSelect('Admin')}>Admin (Core System)</Button>
                         <Button size="lg" variant="secondary" onClick={() => handleRoleSelect('Staff')}>Staff (Request System)</Button>
                         <Button size="lg" variant="outline" onClick={() => handleRoleSelect('Departmental Staff')}>Departmental Staff</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (user.department !== 'core') {
        return <DepartmentalPage user={user} onLogout={handleLogout} />;
    }

    const inventoryColSpan = user.role === 'Admin' ? 7 : 4;

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".csv" />
            <TooltipProvider>
                <main className="w-full max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-8">
                        <StockPilotLogo className="h-8 w-8 text-primary" />
                        <h1 className="text-3xl font-bold text-foreground">Core Inventory</h1>
                         <div className="ml-auto flex items-center gap-4 text-sm">
                            <div className="text-right">
                                <p className="font-semibold text-foreground">{user.role} User</p>
                                <p className="text-muted-foreground">Core System</p>
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
                            {user.role === 'Admin' && <TabsTrigger value="transactions">Transactions</TabsTrigger>}
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
                                                    productRequests.map(req => (
                                                        <TableRow key={req.id}>
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
                                                                        <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req)}>Reject</Button>
                                                                        <Button size="sm" onClick={() => handleFulfillRequest(req)}>Fulfill</Button>
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="h-24 text-center">No product requests have been submitted yet.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        }
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
                    </Tabs>
                </main>
            </TooltipProvider>
            
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
                    setRequestToFulfill(null);
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
                                setRequestToFulfill(null);
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
                            product_id,product_name,vendor,vendor_part_number,location,lot_number,quantity,receipt_date,expiration_date,reorder_threshold
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
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will mark the request from {requestToReject?.requestorName} as 'Rejected'. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRequestToReject(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmRejectRequest}>Reject Request</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
