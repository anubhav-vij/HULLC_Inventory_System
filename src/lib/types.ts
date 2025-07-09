import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const LotSchema = z.object({
  id: z.string().default(() => uuidv4()),
  lotNumber: z.string().min(1, "Lot number is required."),
  quantity: z.coerce.number().min(0, "Quantity must be zero or more."),
  receiptDate: z.date({ required_error: "Receipt date is required." }),
  expirationDate: z.date().nullable().default(null),
  location: z.string().min(1, "Storage location is required."),
});

// Stricter lot schema for new lots, requires quantity > 0.
export const NewLotSchema = LotSchema.extend({
    quantity: z.coerce.number().min(1, "Quantity must be greater than 0."),
});

// Base schema for product form data. Allows zero lots for editing.
export const ProductFormSchema = z.object({
  name: z.string().min(1, "Product name is required."),
  vendor: z.string().min(1, "Vendor is required."),
  vendorPartNumber: z.string().min(1, "Vendor part number is required."),
  reorderThreshold: z.coerce.number().min(0, "Reorder threshold must be zero or more.").nullable().default(null),
  lots: z.array(LotSchema),
});

// Stricter form schema for creating a new product. Requires at least one lot.
export const ProductFormCreateSchema = ProductFormSchema.extend({
    lots: z.array(NewLotSchema).min(1, "At least one lot is required."),
});

// This is the full product model, as stored in the DB/local storage.
export const ProductSchema = ProductFormSchema.extend({
  id: z.string(),
});


// Transaction Schemas
export const TransactionItemSchema = z.object({
  lotId: z.string(),
  quantityTaken: z.coerce.number().min(0).default(0),
});

// We need the original lots to validate against
export const createTransactionFormSchema = (productLots: Lot[]) => z.object({
    date: z.date({ required_error: "Transaction date is required." }),
    notes: z.string().optional(),
    items: z.array(TransactionItemSchema)
      .min(1)
      .refine(
          (items) => items.some((item) => item.quantityTaken > 0),
          { message: "You must dispense a quantity greater than zero from at least one lot." }
      )
      .refine(
          (items) => {
              for(const item of items) {
                  const lot = productLots.find(l => l.id === item.lotId);
                  if (!lot) continue; 
                  
                  if (item.quantityTaken > lot.quantity) {
                      return false;
                  }
              }
              return true; 
          },
          {
              message: "Quantity to dispense cannot exceed available quantity for that lot.",
              path: ["root"], 
          }
      ),
});


export const TransactionSchema = z.object({
    id: z.string().default(() => uuidv4()),
    productId: z.string(),
    productName: z.string(),
    date: z.date(),
    notes: z.string().optional(),
    items: z.array(z.object({
        lotId: z.string(),
        lotNumber: z.string(),
        quantity: z.number(),
    })),
    totalQuantity: z.number(),
});


export type Lot = z.infer<typeof LotSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductFormData = z.infer<typeof ProductFormSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionFormData = {
    date: Date;
    notes?: string;
    items: { lotId: string; quantityTaken: number; }[];
};

// User and Auth Types
export type UserRole = 'Admin' | 'Staff';

export type User = {
  name: string;
  role: UserRole;
};
