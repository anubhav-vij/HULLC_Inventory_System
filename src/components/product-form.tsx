
"use client";

import React, { useEffect, useState } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { v4 as uuidv4 } from 'uuid';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, PlusCircle, Trash2, FileUp, X, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { type Product, ProductFormSchema, type ProductFormData, ProductFormCreateSchema } from "@/lib/types";
import { Separator } from "./ui/separator";
import { deleteFile, storeFile } from '@/lib/file-store';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';

interface VendorOption { id: string; name: string; isActive: boolean; }
interface LocationOption { id: string; name: string; isActive: boolean; }

type ProductFormProps = {
  product?: Product | null;
  onSave: (data: ProductFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
};

const VALID_FILE_TYPES = "application/pdf,image/jpeg,image/tiff";

export function ProductForm({ product, onSave, onCancel, isSaving }: ProductFormProps) {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  useEffect(() => {
    fetch('/api/vendors')
      .then(res => res.ok ? res.json() : [])
      .then(data => setVendors(data.filter((v: VendorOption) => v.isActive)))
      .catch(() => {});
    fetch('/api/storage-locations')
      .then(res => res.ok ? res.json() : [])
      .then(data => setLocations(data.filter((l: LocationOption) => l.isActive)))
      .catch(() => {});
  }, []);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(product ? ProductFormSchema : ProductFormCreateSchema),
    defaultValues: product ? {
      ...product,
      lots: product.lots.map(lot => ({
        ...lot,
        id: lot.id,
        receiptDate: lot.receiptDate ? new Date(lot.receiptDate) : new Date(),
        expirationDate: lot.expirationDate ? new Date(lot.expirationDate) : null,
        file: lot.file,
        notes: lot.notes || '',
      }))
    } : {
      name: "",
      vendor: "",
      vendorPartNumber: "",
      uom: "",
      reorderThreshold: null,
      lots: [{ lotNumber: "", quantity: 1, receiptDate: new Date(), expirationDate: null, location: "", file: null, notes: "" }],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "lots",
  });
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const fileId = uuidv4();
      try {
        await storeFile(fileId, file);
        const currentLot = fields[index];
        
        // If there was an old file, delete it
        if (currentLot.file?.id) {
          await deleteFile(currentLot.file.id);
        }

        update(index, {
          ...currentLot,
          file: {
            id: fileId,
            name: file.name,
            type: file.type,
          }
        });
        toast({ title: "File Uploaded", description: `${file.name} has been saved.` });
      } catch (error) {
        toast({ title: "Upload Failed", description: "Could not save the file.", variant: "destructive" });
      }
    }
  };

  const removeFile = async (index: number) => {
    const currentLot = fields[index];
    if (currentLot.file?.id) {
        try {
            await deleteFile(currentLot.file.id);
            update(index, { ...currentLot, file: null });
            toast({ title: "File Removed" });
        } catch (error) {
            toast({ title: "Error", description: "Could not remove the file.", variant: "destructive" });
        }
    }
  };

  const handleRemoveLot = async (index: number) => {
    const lotToRemove = fields[index];
    if (lotToRemove.file?.id) {
        await deleteFile(lotToRemove.file.id);
    }
    remove(index);
  }


  const onSubmit = (data: ProductFormData) => {
    onSave(data);
  };

  return (
    <Form {...form}>
      <form id="product-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto pr-6 -mr-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Acetaminophen 500mg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor/Manufacturer</FormLabel>
                  {vendors.length > 0 ? (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vendor..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map(v => (
                          <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl><Input placeholder="e.g., Genentech" {...field} /></FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vendorPartNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor Part #</FormLabel>
                  <FormControl><Input placeholder="e.g., ABC-12345" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="uom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of Measure</FormLabel>
                  <FormControl><Input placeholder="e.g., mL, tablets, vials" {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reorderThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g., 10"
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => {
                          const value = e.target.value;
                          field.onChange(value === '' ? null : parseInt(value, 10));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-medium mb-2">Lots</h3>
            {form.formState.errors.lots?.message && (
              <p className="text-sm font-medium text-destructive mb-2">
                {form.formState.errors.lots.message as string}
              </p>
            )}
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {fields.map((field, index) => (
                <div key={field.id} className="p-4 border rounded-lg bg-background space-y-4">
                  <input type="hidden" {...form.register(`lots.${index}.id`)} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <FormField
                      control={form.control}
                      name={`lots.${index}.lotNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lot #</FormLabel>
                          <FormControl><Input placeholder="e.g., Lot 123" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lots.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lots.${index}.location`}
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Storage Location</FormLabel>
                              {locations.length > 0 ? (
                                <Select value={field.value || ''} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select location..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {locations.map(l => (
                                      <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <FormControl><Input placeholder="e.g., Room 101, Shelf A" {...field} /></FormControl>
                              )}
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lots.${index}.receiptDate`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Receipt Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                  {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value && isValid(field.value) ? field.value : undefined} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lots.${index}.expirationDate`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Expiration Date (Optional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                  {field.value && isValid(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value && isValid(field.value) ? field.value : undefined}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                        control={form.control}
                        name={`lots.${index}.file`}
                        render={({ field }) => (
                          <FormItem>
                              <FormLabel>Lot File (Optional)</FormLabel>
                              {field.value ? (
                                  <div className="flex items-center justify-between p-2 border rounded-md">
                                      <div className="flex items-center gap-2 truncate">
                                        <Paperclip className="h-4 w-4" />
                                        <span className="text-sm truncate">{field.value.name}</span>
                                      </div>
                                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(index)}>
                                          <X className="h-4 w-4" />
                                      </Button>
                                  </div>
                              ) : (
                                <FormControl>
                                    <div className="relative">
                                        <Button type="button" variant="outline" className="w-full" onClick={() => document.getElementById(`file-input-${index}`)?.click()}>
                                            <FileUp className="mr-2 h-4 w-4" /> Upload File
                                        </Button>
                                        <Input
                                            id={`file-input-${index}`}
                                            type="file"
                                            className="hidden"
                                            accept={VALID_FILE_TYPES}
                                            onChange={(e) => handleFileChange(e, index)}
                                        />
                                    </div>
                                </FormControl>
                              )}
                              <FormMessage />
                          </FormItem>
                        )}
                      />
                  </div>
                   <FormField
                      control={form.control}
                      name={`lots.${index}.notes`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl><Textarea placeholder="e.g., QC passed on..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveLot(index)}
                      className="text-destructive hover:text-destructive"
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Remove Lot
                    </Button>
                </div>
              ))}
              <div className="flex justify-start">
                  <Button type="button" variant="secondary" onClick={() => append({ id: uuidv4(), lotNumber: '', quantity: 1, receiptDate: new Date(), expirationDate: null, location: '', file: null, notes: '' })}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Another Lot
                  </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Saving...' : 'Save Product'}
            </Button>
        </div>
      </form>
    </Form>
  );
}

    

    