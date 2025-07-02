import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const LotSchema = z.object({
  id: z.string().default(() => uuidv4()),
  lotNumber: z.string().min(1, "Lot number is required."),
  quantity: z.coerce.number().min(0, "Quantity must be zero or more."),
  receiptDate: z.date({ required_error: "Receipt date is required." }),
  expirationDate: z.date().nullable().default(null),
});

// Stricter lot schema for new lots, requires quantity > 0
export const NewLotSchema = LotSchema.extend({
    quantity: z.coerce.number().min(1, "Quantity must be greater than 0."),
});

// Schema for the form when editing an existing product
export const ProductFormSchema = z.object({
  name: z.string().min(1, "Product name is required."),
  vendor: z.string().min(1, "Vendor is required."),
  vendorPartNumber: z.string().min(1, "Vendor part number is required."),
  location: z.string().min(1, "Location is required."),
  lots: z.array(LotSchema).min(1, "At least one lot is required."),
});

// Stricter form schema for creating a new product
export const ProductFormCreateSchema = ProductFormSchema.extend({
    lots: z.array(NewLotSchema).min(1, "At least one lot is required."),
});

export const ProductSchema = ProductFormSchema.extend({
  id: z.string(),
});


export type Lot = z.infer<typeof LotSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type ProductFormData = z.infer<typeof ProductFormSchema>;
