"use client";

import React, { useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, PlusCircle, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { type Product, ProductFormSchema, type ProductFormData, ProductFormCreateSchema } from "@/lib/types";
import { Separator } from "./ui/separator";
import Image from 'next/image';
import { useToast } from './ui/use-toast';

type ProductFormProps = {
  product?: Product | null;
  onSave: (data: ProductFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
};

export function ProductForm({ product, onSave, onCancel, isSaving }: ProductFormProps) {
  const { toast } = useToast();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(product ? ProductFormSchema : ProductFormCreateSchema),
    defaultValues: product ? {
      ...product,
      lots: product.lots.map(lot => ({
        ...lot,
        image: lot.image ?? null,
        receiptDate: lot.receiptDate ? new Date(lot.receiptDate) : new Date(),
        expirationDate: lot.expirationDate ? new Date(lot.expirationDate) : null,
      }))
    } : {
      name: "",
      vendor: "",
      vendorPartNumber: "",
      reorderThreshold: null,
      lots: [{ lotNumber: "", quantity: 1, receiptDate: new Date(), expirationDate: null, location: "", image: null }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lots",
  });

  const onSubmit = (data: ProductFormData) => {
    onSave(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Please upload an image smaller than 2MB.",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const currentLots = form.getValues('lots');
        const updatedLots = [...currentLots];
        updatedLots[index].image = reader.result as string;
        form.setValue('lots', updatedLots, { shouldValidate: true, shouldDirty: true });
      };
      reader.onerror = () => {
         toast({
          variant: "destructive",
          title: "Error reading file",
          description: "Could not read the selected image file.",
        });
      }
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (index: number) => {
    const currentLots = form.getValues('lots');
    const updatedLots = [...currentLots];
    updatedLots[index].image = null;
    form.setValue('lots', updatedLots, { shouldValidate: true, shouldDirty: true });
  };
  
  const triggerFileInput = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                <FormControl><Input placeholder="e.g., Genentech" {...field} /></FormControl>
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
          <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg bg-background space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
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
                            <FormControl><Input placeholder="e.g., Room 101, Shelf A" {...field} /></FormControl>
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
                        <FormLabel>Expiration Date</FormLabel>
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
                  <div className="flex flex-col gap-2">
                     <FormLabel>Lot Image</FormLabel>
                      {form.watch(`lots.${index}.image`) ? (
                        <div className="relative h-20 w-20 rounded-md overflow-hidden">
                           <Image src={form.watch(`lots.${index}.image`)!} alt="Lot image preview" layout="fill" objectFit="cover" />
                           <Button 
                             type="button" 
                             variant="destructive" 
                             size="icon" 
                             className="absolute top-1 right-1 h-6 w-6"
                             onClick={() => handleRemoveImage(index)}
                           >
                             <X className="h-4 w-4" />
                           </Button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            ref={el => fileInputRefs.current[index] = el}
                            onChange={(e) => handleFileChange(e, index)}
                            className="hidden"
                            accept="image/png, image/jpeg, image/gif"
                          />
                          <Button type="button" variant="outline" onClick={() => triggerFileInput(index)}>
                            <Upload className="mr-2 h-4 w-4"/>
                            Upload Image
                          </Button>
                        </>
                      )}
                  </div>
                </div>
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(index)}
                    className="text-destructive hover:text-destructive"
                    disabled={fields.length <= 1}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Remove Lot
                  </Button>
              </div>
            ))}
            <div className="flex justify-start">
                 <Button type="button" variant="secondary" onClick={() => append({ lotNumber: '', quantity: 1, receiptDate: new Date(), expirationDate: null, location: '', image: null })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Another Lot
                </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
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
