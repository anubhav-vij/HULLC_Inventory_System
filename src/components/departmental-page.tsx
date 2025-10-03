"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, Warehouse, ArrowRightLeft, Loader2, Search, LogOut } from 'lucide-react';
import { TransactionForm } from './transaction-form';
import { type Product, type Lot, type Transaction, type TransactionFormData, type User } from '@/lib/types';
import { StockPilotLogo } from './icons';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

const PRODUCTS_STORAGE_KEY_PREFIX = 'stockpilot-products-data';
const TRANSACTIONS_STORAGE_KEY_PREFIX = 'stockpilot-transactions-data';

type DepartmentalPageProps = {
    user: User;
    onLogout: () => void;
};

export function DepartmentalPage({ user, onLogout }: DepartmentalPageProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [productForTransaction, setProductForTransaction] = useState<Product | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    const department = user.department;
    const productsStorageKey = `${PRODUCTS_STORAGE_KEY_PREFIX}-${department}`;
    const transactionsStorageKey = `${TRANSACTIONS_STORAGE_KEY_PREFIX}-${department}`;

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products;
        const lowercasedQuery = searchQuery.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(lowercasedQuery) ||
            p.vendorPartNumber.toLowerCase().includes(lowercasedQuery) ||
            p.id.toLowerCase().includes(lowercasedQuery)
        );
    }, [products, searchQuery]);

    useEffect(() => {
        setIsLoading(true);
        try {
            const storedProductsItem = window.localStorage.getItem(productsStorageKey);
            if (storedProductsItem) {
                const loadedProducts = JSON.parse(storedProductsItem).map((product: any) => ({
                    ...product,
                    lots: product.lots.map((lot: any) => ({
                        ...lot,
                        receiptDate: new Date(lot.receiptDate),
                        expirationDate: lot.expirationDate ? new Date(lot.expirationDate) : null,
                    })),
                }));
                setProducts(loadedProducts);
            } else {
                setProducts([]);
            }

            const storedTransactionsItem = window.localStorage.getItem(transactionsStorageKey);
            if (storedTransactionsItem) {
                const loadedTransactions = JSON.parse(storedTransactionsItem).map((tx: any) => ({ ...tx, date: new Date(tx.date) }));
                setTransactions(loadedTransactions);
            } else {
                setTransactions([]);
            }
        } catch (error) {
            console.error('Error loading departmental data', error);
            setProducts([]);
            setTransactions([]);
        }
        setIsLoading(false);
    }, [department, productsStorageKey, transactionsStorageKey]);

    useEffect(() => {
        if (!isLoading) {
            try {
                window.localStorage.setItem(productsStorageKey, JSON.stringify(products));
                window.localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions));
            } catch (error) {
                console.error("Failed to save to localStorage:", error);
                toast({
                    title: "Save Error",
                    description: "Could not save changes.",
                    variant: "destructive",
                });
            }
        }
    }, [products, transactions, isLoading, department, productsStorageKey, transactionsStorageKey, toast]);

    const handleNewTransaction = (product: Product) => {
        setProductForTransaction(product);
        setIsTransactionFormOpen(true);
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

        const updatedProduct = { ...productForTransaction, lots: finalLots.filter(lot => lot.quantity > 0) };
        setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p).filter(p => p.lots.length > 0));

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
            requestorName: 'N/A',
            department: department,
        };
        setTransactions([newTransaction, ...transactions]);

        toast({ title: "Consumption Recorded", description: `Recorded use of ${totalQuantityDispensed} of "${productForTransaction.name}".` });
        
        setIsSaving(false);
        setIsTransactionFormOpen(false);
        setProductForTransaction(null);
    };

    const totalQuantity = (lots: Lot[]) => lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const getDisplayLocation = (lots: Lot[]) => {
        if (!lots || lots.length === 0) return 'N/A';
        const uniqueLocations = [...new Set(lots.map(lot => lot.location))];
        if (uniqueLocations.length === 1) return uniqueLocations[0];
        return "Multiple Locations";
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <main className="w-full max-w-7xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <StockPilotLogo className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold text-foreground">{department} Inventory</h1>
                    <div className="ml-auto flex items-center gap-4 text-sm">
                        <div className="text-right">
                            <p className="font-semibold text-foreground">Department Staff</p>
                            <p className="text-muted-foreground">{department} Department</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={onLogout}>
                           <LogOut className="mr-2 h-4 w-4" />
                           Logout
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex-1">
                                <CardTitle>Available Stock</CardTitle>
                                <CardDescription>Record consumption of items allocated to your department.</CardDescription>
                            </div>
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
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Vendor Part #</TableHead>
                                        <TableHead>Total Quantity</TableHead>
                                        <TableHead>Storage Location</TableHead>
                                        <TableHead className="w-[180px] text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map(product => (
                                            <TableRow key={product.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-3"><Package className="h-5 w-5 text-muted-foreground"/><div><div>{product.name}</div><div className="text-xs text-muted-foreground">{product.id}</div></div></div>
                                                </TableCell>
                                                <TableCell>{product.vendorPartNumber}</TableCell>
                                                <TableCell><Badge variant="secondary">{totalQuantity(product.lots)}</Badge></TableCell>
                                                <TableCell><div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-muted-foreground"/>{getDisplayLocation(product.lots)}</div></TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" onClick={() => handleNewTransaction(product)}>
                                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                                        Record Consumption
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                {searchQuery ? 'No products found.' : 'No inventory has been allocated to this department yet.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{`Record Consumption for ${productForTransaction?.name}`}</DialogTitle>
                        <DialogDescription>Record the quantity of items consumed from each lot.</DialogDescription>
                    </DialogHeader>
                    {productForTransaction && (
                        <TransactionForm
                            product={productForTransaction}
                            onSave={handleSaveTransaction}
                            onCancel={() => setIsTransactionFormOpen(false)}
                            isSaving={isSaving}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
