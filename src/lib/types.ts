

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/tiff',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

export const LotFileSchema = z.object({
  id: z.string(), // used as the key in IndexedDB
  name: z.string(),
  type: z.string().refine(
    (t) => (ALLOWED_FILE_TYPES as readonly string[]).includes(t),
    { message: 'Unsupported file type. Allowed: PDF, JPEG, PNG, TIFF, DOCX, XLSX.' }
  ),
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
  manufacturer: z.string().min(1, "Manufacturer is required."),
  manufacturerPartNumber: z.string().min(1, "Manufacturer part number is required."),
  vwrPartNumber: z.string().optional(),
  uom: z.string().optional(),
  somApprovalRequired: z.boolean().default(false),
  costPerUnit: z.coerce.number().min(0).nullable().default(null),
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

export const LineItemFormSchema = z.object({
  requestedDate: z.string().min(1, "Date is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
});

export const ProductRequestFormSchema = z.object({
  requestorName: z.string().min(1, "Your name is required."),
  requestorEmail: z.string().email("Please enter a valid NIH email address."),
  department: z.string().min(1, "Department is required."),
  project: z.string().optional(),
  justification: z.string().min(1, "Justification is required."),
  sopRead: z.boolean().refine(val => val === true, {
    message: "You must confirm you have read the SOP.",
  }),
  lineItems: z.array(LineItemFormSchema).min(1, "At least one line item is required."),
});

export const ProductRequestStatusSchema = z.enum(['Pending Approval', 'Approved', 'Pending SciOps Approval', 'In Progress', 'Completed', 'Rejected']);

export const RequestLineItemSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  requestedDate: z.union([z.string(), z.date()]).transform(v => v instanceof Date ? v.toISOString().split('T')[0] : v),
  quantity: z.number(),
  status: z.string(),
  fulfilledQuantity: z.number(),
  fulfillmentId: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]).transform(v => v instanceof Date ? v.toISOString() : v),
});

export const ProductRequestSchema = z.object({
  id: z.string(),
  requestId: z.string().optional(),
  requestNumber: z.number().optional(),
  productId: z.string(),
  productName: z.string(),
  requestorName: z.string(),
  requestorEmail: z.string(),
  department: z.string(),
  project: z.string().nullable().optional(),
  justification: z.string(),
  sopRead: z.boolean(),
  status: ProductRequestStatusSchema,
  rejectionNote: z.string().optional(),
  directorId: z.string().nullable().optional(),
  directorApprovedAt: z.string().nullable().optional(),
  directorRejectionNote: z.string().nullable().optional(),
  rejectedBy: z.string().nullable().optional(),
  rejectionStage: z.string().nullable().optional(),
  somApprovalStatus: z.string().nullable().optional(),
  sciopsDirectorApprovedAt: z.string().nullable().optional(),
  sciopsDirectorApprovedBy: z.string().nullable().optional(),
  somApprovalRequired: z.boolean().optional(),
  date: z.union([z.string(), z.date()]).transform(v => v instanceof Date ? v.toISOString() : v),
  lineItems: z.array(RequestLineItemSchema).default([]),
});

export const FulfillmentSchema = z.object({
    id: z.string(),
    requestId: z.string().nullable(),
    productId: z.string(),
    productName: z.string(),
    department: z.string(),
    totalQuantityRequested: z.number(),
    requestLineItemId: z.string().nullable().optional(),
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
export type LineItemFormData = z.infer<typeof LineItemFormSchema>;
export type RequestLineItem = z.infer<typeof RequestLineItemSchema>;
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
    manufacturer: string;
    manufacturerPartNumber: string;
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
