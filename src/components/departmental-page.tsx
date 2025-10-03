"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowRightLeft, Loader2, Search, LogOut, History } from 'lucide-react';
import { type DepartmentalProduct, type DepartmentalTransaction, type User } from '@/lib/types';
import { StockPilotLogo } from './icons';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '@/components/ui/input';
import { Label } from './ui/label';
import { format } from 'date-fns';

const DEPT_PRODUCTS_STORAGE_KEY_PREFIX = 'stockpilot-dept-products';
const DEPT_TRANSACTIONS_STORAGE_KEY_PREFIX = 'stockpilot-dept-transactions';

type DepartmentalPageProps = {
    user: User;
    onLogout: () => void;
};

export function DepartmentalPage({ user, onLogout }: DepartmentalPageProps) {
    const [products, setProducts] = useState<DepartmentalProduct[]>([]);
    const [transactions, setTransactions] = useState<DepartmentalTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isConsumptionFormOpen, setIsConsumptionFormOpen] = useState(false);
    const [productForConsumption, setProductForConsumption] = useState<DepartmentalProduct | null>(null);
    const [consumptionQuantity, setConsumptionQuantity] = useState(1);
    const [consumedBy, setConsumedBy] = useState('');
    const [consumptionNotes, setConsumptionNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();

    const department = user.department;
    const productsStorageKey = `${DEPT_PRODUCTS_STORAGE_KEY_PREFIX}-${department}`;
    const transactionsStorageKey = `${DEPT_TRANSACTIONS_STORAGE_KEY_PREFIX}-${department}`;

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
            setProducts(storedProductsItem ? JSON.parse(storedProductsItem) : []);

            const storedTransactionsItem = window.localStorage.getItem(transactionsStorageKey);
            setTransactions(storedTransactionsItem ? JSON.parse(storedTransactionsItem).map((tx: any) => ({ ...tx, date: new Date(tx.date) })) : []);

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
    }, [products, transactions, isLoading, productsStorageKey, transactionsStorageKey, toast]);

    const handleOpenConsumptionForm = (product: DepartmentalProduct) => {
        setProductForConsumption(product);
        setConsumptionQuantity(1);
        setConsumedBy('');
        setConsumptionNotes('');
        setIsConsumptionFormOpen(true);
    };

    const handleRecordConsumption = () => {
        if (!productForConsumption || consumptionQuantity <= 0 || !consumedBy) {
            toast({
                title: 'Invalid Input',
                description: 'Please fill out all fields and enter a valid quantity.',
                variant: 'destructive',
            });
            return;
        }

        if (consumptionQuantity > productForConsumption.quantity) {
             toast({
                title: 'Insufficient Stock',
                description: 'Consumption quantity cannot exceed available stock.',
                variant: 'destructive',
            });
            return;
        }

        setIsSaving(true);

        const updatedProduct = {
            ...productForConsumption,
            quantity: productForConsumption.quantity - consumptionQuantity,
        };
        
        setProducts(
            products.map(p => p.id === updatedProduct.id ? updatedProduct : p).filter(p => p.quantity > 0)
        );

        const newTransaction: DepartmentalTransaction = {
            id: uuidv4(),
            productId: productForConsumption.id,
            productName: productForConsumption.name,
            date: new Date(),
            notes: consumptionNotes,
            quantity: consumptionQuantity,
            consumedBy: consumedBy,
        };
        setTransactions([newTransaction, ...transactions]);

        toast({ title: "Consumption Recorded", description: `Recorded use of ${consumptionQuantity} of "${productForConsumption.name}".` });
        
        setIsSaving(false);
        setIsConsumptionFormOpen(false);
        setProductForConsumption(null);
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
            <main className="w-full max-w-7xl mx-auto space-y-8">
                <div className="flex items-center gap-3">
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
                                                <TableCell><Badge variant="secondary">{product.quantity}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" onClick={() => handleOpenConsumptionForm(product)}>
                                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                                        Record Consumption
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                {searchQuery ? 'No products found.' : 'No inventory has been allocated to this department yet.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            <div className="flex items-center gap-2">
                                <History className="h-5 w-5" />
                                Consumption History
                            </div>
                        </CardTitle>
                         <CardDescription>A log of all items consumed by this department.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Consumed By</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Quantity</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length > 0 ? (
                                        transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="font-medium">{tx.productName} <span className="text-xs text-muted-foreground">({tx.productId})</span></TableCell>
                                                <TableCell>{tx.consumedBy}</TableCell>
                                                <TableCell>{format(tx.date, 'PPP')}</TableCell>
                                                <TableCell><Badge variant="outline">-{tx.quantity}</Badge></TableCell>
                                                <TableCell className="truncate max-w-xs">{tx.notes || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">No consumption has been recorded yet.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isConsumptionFormOpen} onOpenChange={setIsConsumptionFormOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{`Record Consumption for ${productForConsumption?.name}`}</DialogTitle>
                        <DialogDescription>Record the quantity of items consumed from local stock.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                             <Label htmlFor="consumedBy">Consumed By</Label>
                             <Input id="consumedBy" value={consumedBy} onChange={(e) => setConsumedBy(e.target.value)} placeholder="Your Name" />
                        </div>
                         <div className="space-y-2">
                             <Label htmlFor="quantity">Quantity Consumed</Label>
                             <Input id="quantity" type="number" value={consumptionQuantity} min={1} max={productForConsumption?.quantity} onChange={(e) => setConsumptionQuantity(Number(e.target.value))} />
                        </div>
                         <div className="space-y-2">
                             <Label htmlFor="notes">Notes (Optional)</Label>
                             <Input id="notes" value={consumptionNotes} onChange={(e) => setConsumptionNotes(e.target.value)} placeholder="e.g. For project X" />
                        </div>
                    </div>
                    <DialogFooter>
                         <Button variant="ghost" onClick={() => setIsConsumptionFormOpen(false)} disabled={isSaving}>Cancel</Button>
                         <Button onClick={handleRecordConsumption} disabled={isSaving}>
                             {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Record
                         </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
