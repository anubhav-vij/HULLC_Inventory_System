
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
import { deleteFile, storeFile } from '@/lib/file-store';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from './ui/textarea';

interface ManufacturerOption { id: string; name: string; isActive: boolean; }
interface LocationOption { id: string; name: string; isActive: boolean; }

type ProductFormProps = {
  product?: Product | null;
  onSave: (data: ProductFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
  isAdmin?: boolean;
};

const VALID_FILE_TYPES = "application/pdf,image/jpeg,image/tiff";

export function ProductForm({ product, onSave, onCancel, isSaving, isAdmin = true }: ProductFormProps) {
  const { toast } = useToast();
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  useEffect(() => {
    fetch('/api/manufacturers')
      .then(res => res.ok ? res.json() : [])
      .then(data => setManufacturers(data.filter((v: ManufacturerOption) => v.isActive)))
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
      manufacturer: "",
      manufacturerPartNumber: "",
      vwrPartNumber: "",
      uom: "",
      somApprovalRequired: false,
      costPerUnit: null,
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
        if (currentLot.file?.id) {
          await deleteFile(currentLot.file.id);
        }
        update(index, {
          ...currentLot,
          file: { id: fileId, name: file.name, type: file.type }
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

  const labelStyle = { color: '#475569', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600 };
  const cardStyle = { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' };
  const cardHeaderStyle = { backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0', padding: '14px 16px' };
  const inputStyle = { backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' };
  const reqMark = <span style={{ color: '#ef4444' }}> *</span>;

  return (
    <Form {...form}>
      <form id="product-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto pr-6 -mr-6 space-y-6">
          {/* Product Information Card */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <h3 style={{ color: '#0f172a', fontSize: '15px', fontWeight: 700, margin: 0 }}>Product Information</h3>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: '0 0 12px 12px' }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>Product Name{reqMark}</FormLabel>
                    <FormControl><Input placeholder="e.g., Acetaminophen 500mg" {...field} style={inputStyle} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>Manufacturer{reqMark}</FormLabel>
                    {manufacturers.length > 0 ? (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger style={inputStyle}>
                            <SelectValue placeholder="Select a manufacturer..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {manufacturers.map(m => (
                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl><Input placeholder="e.g., Genentech" {...field} style={inputStyle} /></FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturerPartNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>Manufacturer Part #</FormLabel>
                    <FormControl><Input placeholder="e.g., ABC-12345" {...field} style={inputStyle} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vwrPartNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>VWR Part #</FormLabel>
                    <FormControl><Input placeholder="e.g., VWR-67890" {...field} value={field.value ?? ''} style={inputStyle} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="uom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>Unit of Measure</FormLabel>
                    <FormControl><Input placeholder="e.g., mL, tablets, vials" {...field} value={field.value ?? ''} style={inputStyle} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="somApprovalRequired"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>SOM Approval Required{reqMark}</FormLabel>
                    <Select value={field.value ? 'yes' : 'no'} onValueChange={v => field.onChange(v === 'yes')}>
                      <FormControl>
                        <SelectTrigger style={inputStyle}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isAdmin && (
                <FormField
                  control={form.control}
                  name="costPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={labelStyle}>Cost per Each Item</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 12.50"
                          {...field}
                          value={field.value ?? ''}
                          onChange={e => {
                            const value = e.target.value;
                            field.onChange(value === '' ? null : parseFloat(value));
                          }}
                          style={inputStyle}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="reorderThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={labelStyle}>Reorder Threshold</FormLabel>
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
                        style={inputStyle}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Lots Card */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle} className="flex items-center justify-between">
              <h3 style={{ color: '#0f172a', fontSize: '15px', fontWeight: 700, margin: 0 }}>Lots</h3>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: 20, borderRadius: '0 0 12px 12px' }}>
              {form.formState.errors.lots?.message && (
                <p className="text-sm font-medium text-destructive mb-3">
                  {form.formState.errors.lots.message as string}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field, index) => (
                  <div key={field.id} style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px' }} className="p-4 space-y-3 relative">
                    <input type="hidden" {...form.register(`lots.${index}.id`)} />
                    <div className="flex items-center justify-between mb-1">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: '#e0f2f1', color: '#1e40af' }}>
                        Lot {index + 1}
                      </span>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLot(index)}
                          className="p-1 rounded hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
                        </button>
                      )}
                    </div>
                    <FormField
                      control={form.control}
                      name={`lots.${index}.lotNumber`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={labelStyle}>Lot #</FormLabel>
                          <FormControl><Input placeholder="e.g., Lot 123" {...field} style={inputStyle} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lots.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={labelStyle}>Quantity</FormLabel>
                          <FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} style={inputStyle} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lots.${index}.receiptDate`}
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel style={labelStyle}>Receipt Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} style={inputStyle}>
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
                          <FormLabel style={labelStyle}>Expiration Date (Optional)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} style={inputStyle}>
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
                      name={`lots.${index}.location`}
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel style={labelStyle}>Storage Location</FormLabel>
                              {locations.length > 0 ? (
                                <Select value={field.value || ''} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger style={inputStyle}>
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
                                <FormControl><Input placeholder="e.g., Room 101, Shelf A" {...field} style={inputStyle} /></FormControl>
                              )}
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                    <FormField
                        control={form.control}
                        name={`lots.${index}.file`}
                        render={({ field }) => (
                          <FormItem>
                              <FormLabel style={labelStyle}>Lot File (Optional)</FormLabel>
                              {field.value ? (
                                  <div className="flex items-center justify-between p-2 rounded-md" style={{ ...inputStyle }}>
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
                                        <Button type="button" variant="outline" className="w-full" style={inputStyle} onClick={() => document.getElementById(`file-input-${index}`)?.click()}>
                                            <FileUp className="mr-2 h-4 w-4" /> Upload File
                                        </Button>
                                        <Input id={`file-input-${index}`} type="file" className="hidden" accept={VALID_FILE_TYPES} onChange={(e) => handleFileChange(e, index)} />
                                    </div>
                                </FormControl>
                              )}
                              <FormMessage />
                          </FormItem>
                        )}
                      />
                    <FormField
                      control={form.control}
                      name={`lots.${index}.notes`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={labelStyle}>Notes (Optional)</FormLabel>
                          <FormControl><Textarea placeholder="e.g., QC passed on..." {...field} style={inputStyle} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
                {/* Add Lot dashed card */}
                <button
                  type="button"
                  onClick={() => append({ id: uuidv4(), lotNumber: '', quantity: 1, receiptDate: new Date(), expirationDate: null, location: '', file: null, notes: '' })}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-[10px] transition-colors hover:bg-white"
                  style={{ border: '2px dashed #cbd5e1', minHeight: '200px', color: '#64748b' }}
                >
                  <PlusCircle className="h-6 w-6" />
                  <span className="text-sm font-medium">+ Add Lot</span>
                </button>
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
