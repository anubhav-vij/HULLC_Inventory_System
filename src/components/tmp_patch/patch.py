import sys

fp = r'C:\Users\MV PC\OneDrive\Desktop\HULLC_Inventory_System\src\components\inventory-page.tsx'

with open(fp, 'r', encoding='utf-8') as f:
    src = f.read()

errors = []

def rep(name, old, new):
    global src
    if old not in src:
        errors.append(f'NOT FOUND: {name}')
        return
    cnt = src.count(old)
    if cnt > 1:
        print(f'WARNING {name}: {cnt} occurrences')
    src = src.replace(old, new, 1)
    print(f'OK: {name}')

# ── 1. Remove initialProducts + simplify storage constants ────────────────
rep('constants', """const initialProducts: Product[] = [
    {
        id: "P001",
        name: "Test Product A",
        vendor: "Test Vendor",
        vendorPartNumber: "Part 001",
        reorderThreshold: 20,
        lots: [
            { id: uuidv4(), lotNumber: "Lot 1", quantity: 100, receiptDate: new Date("2025-02-25"), expirationDate: new Date("2026-02-28"), location: "Room 1", file: null, notes: "Initial stock" },
            { id: uuidv4(), lotNumber: "Lot 2", quantity: 10, receiptDate: new Date("2025-02-02"), expirationDate: new Date("2025-03-03"), location: "Room 2", file: null, notes: "" },
        ]
    },
    {
        id: "P002",
        name: "Another Item B",
        vendor: "Sample Inc.",
        vendorPartNumber: "Item-B-42",
        reorderThreshold: 100,
        lots: [
            { id: uuidv4(), lotNumber: "Lot-XYZ", quantity: 500, receiptDate: new Date("2024-08-15"), expirationDate: new Date("2025-08-15"), location: "Warehouse 3", file: null, notes: "Bulk order" },
        ]
    }
];

const PRODUCTS_STORAGE_KEY_PREFIX = 'hullc-products-data';
const TRANSACTIONS_STORAGE_KEY_PREFIX = 'hullc-transactions-data';
const REQUESTS_STORAGE_KEY_PREFIX = 'hullc-requests-data';
const FULFILLMENTS_STORAGE_KEY_PREFIX = 'hullc-fulfillments-data';
const USER_STORAGE_KEY = 'hullc-user-data';
const DEPT_PRODUCTS_STORAGE_KEY_PREFIX = 'hullc-dept-products';""",
"""const USER_STORAGE_KEY = 'hullc-user-data';
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
}""")

# ── 2. Remove per-department storage key variables ────────────────────────
rep('dept-keys', """    const department = user?.department || 'core';
    const productsStorageKey = `${PRODUCTS_STORAGE_KEY_PREFIX}-${department}`;
    const transactionsStorageKey = `${TRANSACTIONS_STORAGE_KEY_PREFIX}-${department}`;
    const requestsStorageKey = `${REQUESTS_STORAGE_KEY_PREFIX}-${department}`;
    const fulfillmentsStorageKey = `${FULFILLMENTS_STORAGE_KEY_PREFIX}-${department}`;

    """, "    ")

# ── 3. Replace data-load useEffect ────────────────────────────────────────
rep('load-effect', """    useEffect(() => {
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
                const fKey = `${FULFILLMENTS_STORAGE_KEY_PREFIX}-${user.department}`;

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
                            notes: lot.notes || '',
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

                const storedFulfillmentsItem = window.localStorage.getItem(fKey);
                setFulfillments(storedFulfillmentsItem ? JSON.parse(storedFulfillmentsItem).map((f: any) => ({ ...f, dispensedItems: f.dispensedItems.map((tx:any) => ({...tx, date: new Date(tx.date)})) })) : []);

            } catch (error) {
                console.error('Error reading from local storage', error);
                setProducts(user.department === 'core' ? initialProducts : []);
                setTransactions([]);
                setProductRequests([]);
                setFulfillments([]);
            }
            setIsLoading(false);
        }

        loadData();

    }, [user]);""",
"""    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const loadData = async () => {
            setIsLoading(true);
            try {
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
    }, [user]);""")

# ── 4. Remove persist-on-change useEffect ────────────────────────────────
rep('save-effect', """
    useEffect(() => {
        if (!isLoading && user && user.department === 'core') {
            try {
                window.localStorage.setItem(productsStorageKey, JSON.stringify(products));
                window.localStorage.setItem(transactionsStorageKey, JSON.stringify(transactions));
                window.localStorage.setItem(requestsStorageKey, JSON.stringify(productRequests));
                window.localStorage.setItem(fulfillmentsStorageKey, JSON.stringify(fulfillments));
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
    }, [products, transactions, productRequests, fulfillments, user, isLoading, toast, productsStorageKey, transactionsStorageKey, requestsStorageKey, fulfillmentsStorageKey]);
""", "\n")

# ── 5. Remove nextProductId useMemo ───────────────────────────────────────
rep('nextProductId', """    const nextProductId = useMemo(() => {
        if (products.length === 0) return 'P001';
        const maxId = products.reduce((max, p) => {
            const num = parseInt(p.id.substring(1));
            return num > max ? num : max;
        }, 0);
        return `P${(maxId + 1).toString().padStart(3, '0')}`;
    }, [products]);
    """, "    ")

# ── 6. handleConfirmDeleteProduct ─────────────────────────────────────────
rep('handleConfirmDeleteProduct', """    const handleConfirmDeleteProduct = async () => {
        if (!productToDelete) return;

        for (const lot of productToDelete.lots) {
            if (lot.file?.id) {
                await deleteFile(lot.file.id);
            }
        }

        setProducts(products.filter(p => p.id !== productToDelete.id));
        toast({ title: "Product Deleted", description: `"${productToDelete.name}" has been removed.`});
        setProductToDelete(null);
    };""",
"""    const handleConfirmDeleteProduct = async () => {
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
    };""")

# ── 7. handleConfirmDeleteTransaction ────────────────────────────────────
rep('handleConfirmDeleteTransaction', """    const handleConfirmDeleteTransaction = () => {
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
    };""",
"""    const handleConfirmDeleteTransaction = async () => {
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
    };""")

# ── 8. handleSaveProduct ──────────────────────────────────────────────────
rep('handleSaveProduct', """    const handleSaveProduct = async (data: ProductFormData) => {
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
    };""",
"""    const handleSaveProduct = async (data: ProductFormData) => {
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
    };""")

# ── 9. handleSaveTransaction ──────────────────────────────────────────────
rep('handleSaveTransaction', """    const handleSaveTransaction = (data: TransactionFormData) => {
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

        const request = productRequests.find(r => r.id === fulfillmentToUpdate?.requestId);

        const newTransaction: Transaction = {
            id: uuidv4(),
            productId: productForTransaction.id,
            productName: productForTransaction.name,
            date: data.date,
            notes: data.notes,
            items: dispensedItems,
            totalQuantity: totalQuantityDispensed,
            ...(request && {
                requestorName: request.requestorName,
                department: request.department
            }),
            ...(fulfillmentToUpdate && { fulfillmentId: fulfillmentToUpdate.id })
        };
        setTransactions([newTransaction, ...transactions]);

        if (fulfillmentToUpdate && request) {
            const updatedFulfillment: Fulfillment = {
                ...fulfillmentToUpdate,
                dispensedItems: [...fulfillmentToUpdate.dispensedItems, newTransaction]
            };
            const totalFulfilled = updatedFulfillment.dispensedItems.reduce((sum, tx) => sum + tx.totalQuantity, 0);

            if(totalFulfilled >= updatedFulfillment.totalQuantityRequested) {
                setProductRequests(productRequests.map(r => r.id === fulfillmentToUpdate.requestId ? { ...r, status: 'Completed' } : r));
                setFulfillments(fulfillments.filter(f => f.id !== fulfillmentToUpdate.id));
                toast({ title: "Fulfillment Completed", description: `Final dispensation of ${totalQuantityDispensed} of "${productForTransaction.name}" recorded.` });
            } else {
                setFulfillments(fulfillments.map(f => f.id === updatedFulfillment.id ? updatedFulfillment : f));
                toast({ title: "Partial Dispensation Saved", description: `Dispensed ${totalQuantityDispensed} of "${productForTransaction.name}".` });
            }
            addFulfilledItemsToDepartmentInventory(request.department, productForTransaction.id, totalQuantityDispensed);

        } else {
            toast({ title: "Transaction Saved", description: `Dispensed ${totalQuantityDispensed} of "${productForTransaction.name}".` });
        }

        setIsSaving(false);
        setIsTransactionFormOpen(false);
        setProductForTransaction(null);
        setFulfillmentToUpdate(null);
    };""",
"""    const handleSaveTransaction = async (data: TransactionFormData) => {
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
    };""")

# ── 10. handleSaveRequest ─────────────────────────────────────────────────
rep('handleSaveRequest', """    const handleSaveRequest = (data: ProductRequestFormData) => {
        if (!productForRequest) return;
        setIsSaving(true);

        const newRequest: ProductRequest = {
            id: uuidv4(),
            productId: productForRequest.id,
            productName: productForRequest.name,
            ...data,
            date: new Date(),
            status: 'Pending',
            rejectionNote: '',
        };
        setProductRequests([newRequest, ...productRequests]);

        toast({
            title: "Request Submitted",
            description: `Your request for ${data.quantity} of "${productForRequest.name}" has been sent for review.`
        });
        setIsSaving(false);
        setIsRequestFormOpen(false);
        setProductForRequest(null);
    };""",
"""    const handleSaveRequest = async (data: ProductRequestFormData) => {
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
    };""")

# ── 11. handleFulfillRequest ──────────────────────────────────────────────
rep('handleFulfillRequest', """    const handleFulfillRequest = (request: ProductRequest) => {
        const newFulfillment: Fulfillment = {
            id: uuidv4(),
            requestId: request.id,
            productId: request.productId,
            productName: request.productName,
            department: request.department,
            totalQuantityRequested: request.quantity,
            dispensedItems: []
        };
        setFulfillments([...fulfillments, newFulfillment]);
        setProductRequests(productRequests.map(r => r.id === request.id ? {...r, status: 'In Progress'} : r));
        toast({ title: "Request In Progress", description: `Request for "${request.productName}" is now being fulfilled.` });
    };""",
"""    const handleFulfillRequest = async (request: ProductRequest) => {
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
    };""")

# ── 12. handleConfirmRejectRequest ────────────────────────────────────────
rep('handleConfirmRejectRequest', """    const handleConfirmRejectRequest = () => {
        if (!requestToReject) return;
        if (!rejectionNote.trim()) {
            toast({ title: "Note Required", description: "Please provide a reason for rejecting the request.", variant: "destructive" });
            return;
        }
        setProductRequests(productRequests.map(r =>
            r.id === requestToReject.id ? { ...r, status: 'Rejected', rejectionNote } : r
        ));
        toast({ title: "Request Rejected" });
        setRequestToReject(null);
    };""",
"""    const handleConfirmRejectRequest = async () => {
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
    };""")

# ── 13. handleConfirmCancelFulfillment ────────────────────────────────────
rep('handleConfirmCancelFulfillment', """    const handleConfirmCancelFulfillment = () => {
        if (!fulfillmentToCancel) return;

        setProductRequests(productRequests.map(r =>
            r.id === fulfillmentToCancel.requestId ? { ...r, status: 'Completed' } : r
        ));

        setFulfillments(fulfillments.filter(f => f.id !== fulfillmentToCancel.id));

        toast({ title: "Fulfillment Cancelled", description: `The fulfillment for "${fulfillmentToCancel.productName}" has been cancelled.` });
        setFulfillmentToCancel(null);
    };""",
"""    const handleConfirmCancelFulfillment = async () => {
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
    };""")

# ── 14. handleFileImport (CSV import — Option C) ──────────────────────────
rep('handleFileImport', """    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
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
                        'lot_number', 'quantity', 'receipt_date', 'expiration_date', 'reorder_threshold', 'notes'
                    ];
                    const headers = results.meta.fields || [];
                    if (!requiredHeaders.every(h => headers.includes(h))) {
                        throw new Error(`CSV must contain the following headers: ${requiredHeaders.join(', ')}`);
                    }

                    const importedProductsMap = new Map<string, Product>();
                    for (const row of results.data) {
                        const {
                            product_id, product_name, vendor, vendor_part_number, location,
                            lot_number, quantity, receipt_date, expiration_date, reorder_threshold, notes
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
                            notes: notes || '',
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
    };""",
"""    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    };""")

# ── 15. Disable action buttons while isSaving ─────────────────────────────
rep('reject-fulfill-btns', """                                                                        {req.status === 'Pending' && (
                                                                            <div className="flex gap-2 justify-end">
                                                                                <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req)}>Reject</Button>
                                                                                <Button size="sm" onClick={() => handleFulfillRequest(req)}>Fulfill</Button>
                                                                            </div>
                                                                        )}""",
"""                                                                        {req.status === 'Pending' && (
                                                                            <div className="flex gap-2 justify-end">
                                                                                <Button size="sm" variant="outline" disabled={isSaving} onClick={() => handleRejectRequest(req)}>Reject</Button>
                                                                                <Button size="sm" disabled={isSaving} onClick={() => handleFulfillRequest(req)}>Fulfill</Button>
                                                                            </div>
                                                                        )}""")

rep('cancel-dispense-btns', """                                                                        <div className="flex gap-2 justify-end">
                                                                            <Button size="sm" variant="outline" onClick={() => handleCancelFulfillment(f)}>
                                                                                Cancel
                                                                            </Button>
                                                                            <Button size="sm" onClick={() => handleDispenseForFulfillment(f)}>
                                                                                Dispense Items
                                                                            </Button>
                                                                        </div>""",
"""                                                                        <div className="flex gap-2 justify-end">
                                                                            <Button size="sm" variant="outline" disabled={isSaving} onClick={() => handleCancelFulfillment(f)}>
                                                                                Cancel
                                                                            </Button>
                                                                            <Button size="sm" disabled={isSaving} onClick={() => handleDispenseForFulfillment(f)}>
                                                                                Dispense Items
                                                                            </Button>
                                                                        </div>""")

# ── Write result ──────────────────────────────────────────────────────────
if errors:
    print('\nFAILED replacements:')
    for e in errors:
        print(' ', e)
    sys.exit(1)
else:
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(src)
    print(f'\nAll replacements applied. File written ({len(src)} chars).')
