"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronsUpDown, MoreHorizontal, Package, Pencil, PlusCircle, Warehouse, ArrowRightLeft } from 'lucide-react';
import { ProductForm } from './product-form';
import { TransactionForm } from './transaction-form';
import { type Product, type Lot, type ProductFormData, type Transaction, type TransactionFormData } from '@/lib/types';
import { StockPilotLogo } from './icons';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const initialProducts: Product[] = [
    {
        id: "P001",
        name: "Test Product A",
        vendor: "Test Vendor",
        vendorPartNumber: "Part 001",
        location: "Room 1",
        lots: [
            { id: uuidv4(), lotNumber: "Lot 1", quantity: 100, receiptDate: new Date("2025-02-25"), expirationDate: new Date("2026-02-28") },
            { id: uuidv4(), lotNumber: "Lot 2", quantity: 10, receiptDate: new Date("2025-02-02"), expirationDate: new Date("2025-03-03") },
        ]
    },
    {
        id: "P002",
        name: "Another Item B",
        vendor: "Sample Inc.",
        vendorPartNumber: "Item-B-42",
        location: "Warehouse 3",
        lots: [
            { id: uuidv4(), lotNumber: "Lot-XYZ", quantity: 500, receiptDate: new Date("2024-08-15"), expirationDate: new Date("2025-08-15") },
        ]
    }
];

const PRODUCTS_STORAGE_KEY = 'stockpilot-products-data';
const TRANSACTIONS_STORAGE_KEY = 'stockpilot-transactions-data';


export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [productForTransaction, setProductForTransaction] = useState<Product | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const { toast } = useToast();

    useEffect(() => {
        try {
            const storedProductsItem = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
            let loadedProducts: Product[];
            if (storedProductsItem) {
                loadedProducts = JSON.parse(storedProductsItem).map((product: any) => ({
                    ...product,
                    lots: product.lots.map((lot: any) => ({
                        ...lot,
                        receiptDate: new Date(lot.receiptDate),
                        expirationDate: lot.expirationDate ? new Date(lot.expirationDate) : null,
                    })),
                }));
            } else {
                loadedProducts = initialProducts;
            }
            setProducts(loadedProducts);

            const storedTransactionsItem = window.localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
            let loadedTransactions: Transaction[] = [];
            if (storedTransactionsItem) {
                loadedTransactions = JSON.parse(storedTransactionsItem).map((tx: any) => ({
                    ...tx,
                    date: new Date(tx.date),
                }));
            }
            setTransactions(loadedTransactions);

        } catch (error) {
            console.error('Error reading from local storage', error);
            setProducts(initialProducts);
            setTransactions([]);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (!isLoading) {
            window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
            window.localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
        }
    }, [products, transactions, isLoading]);

    const nextProductId = useMemo(() => {
        if (products.length === 0) return 'P001';
        const maxId = products.reduce((max, p) => {
            const num = parseInt(p.id.substring(1));
            return num > max ? num : max;
        }, 0);
        return `P${(maxId + 1).toString().padStart(3, '0')}`;
    }, [products]);

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

    const handleSaveProduct = (data: ProductFormData) => {
        setIsSaving(true);
        setTimeout(() => {
            if (productToEdit) {
                const updatedProduct: Product = { ...productToEdit, ...data };
                setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
                toast({ title: "Product Updated", description: `"${updatedProduct.name}" has been updated successfully.` });
            } else {
                const newProduct: Product = { ...data, id: nextProductId };
                setProducts([...products, newProduct]);
                toast({ title: "Product Added", description: `"${newProduct.name}" has been added successfully.` });
            }
            setIsSaving(false);
            setIsFormOpen(false);
            setProductToEdit(null);
        }, 500);
    };

    const handleSaveTransaction = (data: TransactionFormData) => {
        if (!productForTransaction) return;
        setIsSaving(true);

        setTimeout(() => {
            // Update product lot quantities
            const updatedLots = productForTransaction.lots.map(lot => {
                const transactionItem = data.items.find(item => item.lotId === lot.id);
                if (transactionItem) {
                    return { ...lot, quantity: lot.quantity - transactionItem.quantityTaken };
                }
                return lot;
            });
            const updatedProduct: Product = { ...productForTransaction, lots: updatedLots };
            setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
            
            // Create and save new transaction
            const dispensedItems = data.items
                .filter(item => item.quantityTaken > 0)
                .map(item => {
                    const lot = productForTransaction.lots.find(l => l.id === item.lotId)!;
                    return { lotId: lot.id, lotNumber: lot.lotNumber, quantity: item.quantityTaken };
                });

            const totalQuantity = dispensedItems.reduce((sum, item) => sum + item.quantity, 0);

            const newTransaction: Transaction = {
                id: uuidv4(),
                productId: productForTransaction.id,
                productName: productForTransaction.name,
                date: data.date,
                notes: data.notes,
                items: dispensedItems,
                totalQuantity,
            };

            setTransactions([newTransaction, ...transactions]);

            toast({ title: "Transaction Saved", description: `Dispensed ${totalQuantity} of "${productForTransaction.name}".`});

            setIsSaving(false);
            setIsTransactionFormOpen(false);
            setProductForTransaction(null);
        }, 500);
    }

    const totalQuantity = (lots: Lot[]) => lots.reduce((sum, lot) => sum + lot.quantity, 0);

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <main className="w-full max-w-7xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <StockPilotLogo className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold text-foreground">StockPilot</h1>
                </div>

                <Tabs defaultValue="inventory">
                    <TabsList className="mb-4">
                        <TabsTrigger value="inventory">Inventory</TabsTrigger>
                        <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    </TabsList>
                    <TabsContent value="inventory">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <CardTitle>HULLC Inventory</CardTitle>
                                        <CardDescription>Manage your products and their stock.</CardDescription>
                                    </div>
                                    <Button onClick={handleAddNew}>
                                        <PlusCircle className="mr-2 h-4 w-4" /> Add Product
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
                                                <TableHead>Vendor</TableHead>
                                                <TableHead>Total Quantity</TableHead>
                                                <TableHead>Location</TableHead>
                                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        {isLoading ? (
                                            <TableBody>
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center">Loading inventory...</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        ) : products.length > 0 ? (
                                            products.map(product => (
                                                <TableBody key={product.id} className="[&_tr:last-child]:border-0">
                                                    <Collapsible asChild>
                                                        <>
                                                            <TableRow className="text-sm">
                                                                <TableCell><CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="w-9 p-0 data-[state=open]:rotate-90"><ChevronsUpDown className="h-4 w-4" /><span className="sr-only">Toggle</span></Button></CollapsibleTrigger></TableCell>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex items-center gap-3"><Package className="h-5 w-5 text-muted-foreground"/><div><div>{product.name}</div><div className="text-xs text-muted-foreground">{product.id} / {product.vendorPartNumber}</div></div></div>
                                                                </TableCell>
                                                                <TableCell>{product.vendor}</TableCell>
                                                                <TableCell><Badge variant="secondary">{totalQuantity(product.lots)}</Badge></TableCell>
                                                                <TableCell><div className="flex items-center gap-2"><Warehouse className="h-4 w-4 text-muted-foreground"/>{product.location}</div></TableCell>
                                                                <TableCell className="text-right">
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><span className="sr-only">Open menu</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end">
                                                                            <DropdownMenuItem onClick={() => handleEdit(product)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                                            <DropdownMenuItem onClick={() => handleNewTransaction(product)}><ArrowRightLeft className="mr-2 h-4 w-4" /> New Transaction</DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                            <CollapsibleContent asChild>
                                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                    <TableCell colSpan={6} className="p-0">
                                                                        <div className="p-4"><h4 className="font-semibold mb-2 ml-2">Lots for {product.name}</h4><Table><TableHeader><TableRow><TableHead>Lot #</TableHead><TableHead>Quantity</TableHead><TableHead>Receipt Date</TableHead><TableHead>Expiration Date</TableHead></TableRow></TableHeader><TableBody>{product.lots.map(lot => (<TableRow key={lot.id}><TableCell>{lot.lotNumber}</TableCell><TableCell>{lot.quantity}</TableCell><TableCell>{format(lot.receiptDate, 'PPP')}</TableCell><TableCell>{lot.expirationDate ? format(lot.expirationDate, 'PPP') : 'N/A'}</TableCell></TableRow>))}</TableBody></Table></div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            </CollapsibleContent>
                                                        </>
                                                    </Collapsible>
                                                </TableBody>
                                            ))
                                        ) : (
                                            <TableBody>
                                                <TableRow><TableCell colSpan={6} className="h-24 text-center">No products found. Get started by adding a new product.</TableCell></TableRow>
                                            </TableBody>
                                        )}
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="transactions">
                        <Card>
                            <CardHeader>
                                <CardTitle>Transaction History</CardTitle>
                                <CardDescription>View a log of all inventory transactions.</CardDescription>
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
                                            <TableHead>Notes</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                     {isLoading ? (
                                        <TableBody><TableRow><TableCell colSpan={5} className="h-24 text-center">Loading transactions...</TableCell></TableRow></TableBody>
                                    ) : transactions.length > 0 ? (
                                        transactions.map(tx => (
                                            <TableBody key={tx.id} className="[&_tr:last-child]:border-0">
                                                <Collapsible asChild>
                                                <>
                                                <TableRow>
                                                    <TableCell><CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="w-9 p-0 data-[state=open]:rotate-90"><ChevronsUpDown className="h-4 w-4" /><span className="sr-only">Toggle</span></Button></CollapsibleTrigger></TableCell>
                                                    <TableCell className="font-medium">{tx.productName} <span className="text-muted-foreground text-xs">({tx.productId})</span></TableCell>
                                                    <TableCell>{format(tx.date, 'PPP')}</TableCell>
                                                    <TableCell><Badge variant="outline">-{tx.totalQuantity}</Badge></TableCell>
                                                    <TableCell className="truncate max-w-xs">{tx.notes || 'N/A'}</TableCell>
                                                </TableRow>
                                                <CollapsibleContent asChild>
                                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                        <TableCell colSpan={5} className="p-0">
                                                            <div className="p-4">
                                                                <h4 className="font-semibold mb-2 ml-2">Dispensed Lots</h4>
                                                                <Table><TableHeader><TableRow><TableHead>Lot #</TableHead><TableHead>Quantity Taken</TableHead></TableRow></TableHeader><TableBody>{tx.items.map(item => (<TableRow key={item.lotId}><TableCell>{item.lotNumber}</TableCell><TableCell>{item.quantity}</TableCell></TableRow>))}</TableBody></Table>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                </CollapsibleContent>
                                                </>
                                                </Collapsible>
                                            </TableBody>
                                        ))
                                    ) : (
                                        <TableBody><TableRow><TableCell colSpan={5} className="h-24 text-center">No transactions have been recorded yet.</TableCell></TableRow></TableBody>
                                    )}
                                </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
            
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-3xl">
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

            <Dialog open={isTransactionFormOpen} onOpenChange={setIsTransactionFormOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>New Transaction for {productForTransaction?.name}</DialogTitle>
                        <DialogDescription>Record the quantity of items dispensed from each lot.</DialogDescription>
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
