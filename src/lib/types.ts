

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const LotFileSchema = z.object({
  id: z.string(), // used as the key in IndexedDB
  name: z.string(),
  type: z.string(),
});

export const LotSchema = z.object({
  id: z.string().default(() => uuidv4()),
  lotNumber: z.string().min(1, "Lot number is required."),
  quantity: z.coerce.number().min(0, "Quantity must be zero or more."),
  receiptDate: z.date({ required_error: "Receipt date is required." }),
  expirationDate: z.date().nullable().default(null),
  location: z.string().min(1, "Storage location is required."),
  file: LotFileSchema.nullable().default(null),
  notes: z.string().optional(),
});

export const NewLotSchema = LotSchema.extend({
    quantity: z.coerce.number().min(1, "Quantity must be greater than 0."),
});

export const ProductFormSchema = z.object({
  name: z.string().min(1, "Product name is required."),
  vendor: z.string().min(1, "Vendor is required."),
  vendorPartNumber: z.string().min(1, "Vendor part number is required."),
  reorderThreshold: z.coerce.number().min(0, "Reorder threshold must be zero or more.").nullable().default(null),
  lots: z.array(LotSchema),
});

export const ProductFormCreateSchema = ProductFormSchema.extend({
    lots: z.array(NewLotSchema).min(1, "At least one lot is required."),
});

export const ProductSchema = ProductFormSchema.extend({
  id: z.string(),
});


export const TransactionItemSchema = z.object({
  lotId: z.string(),
  quantityTaken: z.coerce.number().min(0).default(0),
});

export const createTransactionFormSchema = (productLots: Lot[]) => z.object({
    date: z.date({ required_error: "Transaction date is required." }),
    notes: z.string().min(1, "Notes are required for each transaction."),
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
    notes: z.string(),
    items: z.array(z.object({
        lotId: z.string(),
        lotNumber: z.string(),
        quantity: z.number(),
    })),
    totalQuantity: z.number(),
    requestorName: z.string().optional(),
    department: z.string().optional(),
    fulfillmentId: z.string().optional(),
});

export const DEPARTMENTS = ["HULLC", "Cardiology", "Neurology", "Oncology", "Pediatrics", "Research & Development"] as const;
export const PROJECTS = ["Project Alpha", "Project Beta", "Clinical Trial Gamma", "Pre-clinical Study Delta"] as const;

export const ProductRequestFormSchema = z.object({
  requestorName: z.string().min(1, "Your name is required."),
  requestorEmail: z.string().email("Please enter a valid NIH email address."),
  department: z.enum(DEPARTMENTS, { required_error: "Please select a department." }),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  project: z.enum(PROJECTS, { required_error: "Please select a project." }),
  justification: z.string().min(1, "Justification is required."),
  sopRead: z.boolean().refine(val => val === true, {
    message: "You must confirm you have read the SOP.",
  }),
});

export const ProductRequestStatusSchema = z.enum(['Pending', 'In Progress', 'Completed', 'Rejected']);

export const ProductRequestSchema = ProductRequestFormSchema.extend({
    id: z.string(),
    productId: z.string(),
    productName: z.string(),
    date: z.date(),
    status: ProductRequestStatusSchema,
    rejectionNote: z.string().optional(),
});

export const FulfillmentSchema = z.object({
    id: z.string(),
    requestId: z.string(),
    productId: z.string(),
    productName: z.string(),
    department: z.string(),
    totalQuantityRequested: z.number(),
    dispensedItems: z.array(TransactionSchema),
});


export type Lot = z.infer<typeof LotSchema>;
export type LotFile = z.infer<typeof LotFileSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductFormData = z.infer<typeof ProductFormSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionFormData = {
    date: Date;
    notes: string;
    items: { lotId: string; quantityTaken: number; }[];
};
export type ProductRequestFormData = z.infer<typeof ProductRequestFormSchema>;
export type ProductRequest = z.infer<typeof ProductRequestSchema>;
export type ProductRequestStatus = z.infer<typeof ProductRequestStatusSchema>;
export type Fulfillment = z.infer<typeof FulfillmentSchema>;


export type UserRole = 'Admin' | 'Staff' | 'Director' | 'ProjectManager' | 'Chief';

export const USER_ROLES: UserRole[] = ['Admin', 'Staff', 'Director', 'ProjectManager', 'Chief'];

export type FunctionalGroup = {
  id: string;
  name: string;
  isActive: boolean;
};

export type SystemUser = {
  id: string;
  role: UserRole;
  department: string;
  fullName: string;
  email: string;
  functionalGroupId?: string;
  functionalGroupName?: string;
  isActive: boolean;
};

export type User = {
  id?: string;
  role: UserRole;
  department: (typeof DEPARTMENTS)[number] | 'core';
  fullName?: string;
  email?: string;
  functionalGroupId?: string;
  functionalGroupName?: string;
  isActive?: boolean;
};

export type DepartmentalProduct = {
    id: string;
    name: string;
    vendor: string;
    vendorPartNumber: string;
    quantity: number;
};

export type DepartmentalTransaction = {
    id: string;
    productId: string;
    productName: string;
    date: Date;
    notes: string;
    quantity: number;
    consumedBy: string;
    type: 'Consumption' | 'Adjustment';
    adjustmentType?: 'add' | 'remove';
}
