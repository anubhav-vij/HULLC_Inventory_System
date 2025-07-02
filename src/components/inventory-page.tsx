"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronsUpDown, MoreHorizontal, Package, Pencil, PlusCircle, Trash2, Warehouse } from 'lucide-react';
import { ProductForm } from './product-form';
import { type Product, type Lot } from '@/lib/types';
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

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const { toast } = useToast();

    const nextProductId = useMemo(() => {
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

    const handleDelete = (product: Product) => {
        setProductToDelete(product);
        setIsAlertOpen(true);
    }
    
    const confirmDelete = () => {
        if(productToDelete) {
            setProducts(products.filter(p => p.id !== productToDelete.id));
            toast({ title: 'Product Deleted', description: `"${productToDelete.name}" has been removed.`});
        }
        setIsAlertOpen(false);
        setProductToDelete(null);
    }

    const handleSaveProduct = (data: Product) => {
        setIsSaving(true);
        // Simulate async save
        setTimeout(() => {
            if (productToEdit) {
                setProducts(products.map(p => p.id === data.id ? data : p));
                toast({ title: "Product Updated", description: `"${data.name}" has been updated successfully.` });
            } else {
                const newProduct = { ...data, id: nextProductId };
                setProducts([...products, newProduct]);
                toast({ title: "Product Added", description: `"${data.name}" has been added successfully.` });
            }
            setIsSaving(false);
            setIsFormOpen(false);
            setProductToEdit(null);
        }, 500);
    };

    const totalQuantity = (lots: Lot[]) => lots.reduce((sum, lot) => sum + lot.quantity, 0);

    return (
        <div className="min-h-screen w-full bg-background flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <main className="w-full max-w-7xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <StockPilotLogo className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-bold text-foreground">StockPilot</h1>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle>Inventory</CardTitle>
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
                                <TableBody>
                                    {products.length > 0 ? products.map(product => (
                                        <Collapsible asChild key={product.id}>
                                            <React.Fragment>
                                                <TableRow className="text-sm">
                                                    <TableCell>
                                                        <CollapsibleTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="w-9 p-0 data-[state=open]:rotate-90">
                                                                <ChevronsUpDown className="h-4 w-4" />
                                                                <span className="sr-only">Toggle</span>
                                                            </Button>
                                                        </CollapsibleTrigger>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-3">
                                                            <Package className="h-5 w-5 text-muted-foreground"/>
                                                            <div>
                                                                <div>{product.name}</div>
                                                                <div className="text-xs text-muted-foreground">{product.id} / {product.vendorPartNumber}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{product.vendor}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">{totalQuantity(product.lots)}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Warehouse className="h-4 w-4 text-muted-foreground"/>
                                                            {product.location}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleEdit(product)}>
                                                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleDelete(product)} className="text-destructive focus:text-destructive">
                                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                                <CollapsibleContent asChild>
                                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                        <TableCell colSpan={6} className="p-0">
                                                            <div className="p-4">
                                                                <h4 className="font-semibold mb-2 ml-2">Lots for {product.name}</h4>
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>Lot #</TableHead>
                                                                            <TableHead>Quantity</TableHead>
                                                                            <TableHead>Receipt Date</TableHead>
                                                                            <TableHead>Expiration Date</TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {product.lots.map(lot => (
                                                                            <TableRow key={lot.id}>
                                                                                <TableCell>{lot.lotNumber}</TableCell>
                                                                                <TableCell>{lot.quantity}</TableCell>
                                                                                <TableCell>{format(lot.receiptDate, 'PPP')}</TableCell>
                                                                                <TableCell>{lot.expirationDate ? format(lot.expirationDate, 'PPP') : 'N/A'}</TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                </CollapsibleContent>
                                            </React.Fragment>
                                        </Collapsible>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                No products found. Get started by adding a new product.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
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

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the product "{productToDelete?.name}" and all of its associated lots. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
