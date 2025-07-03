"use client";

import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, PlusCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { type Product, ProductFormSchema, type ProductFormData, ProductFormCreateSchema } from "@/lib/types";
import { Separator } from "./ui/separator";

type ProductFormProps = {
  product?: Product | null;
  onSave: (data: ProductFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
};

export function ProductForm({ product, onSave, onCancel, isSaving }: ProductFormProps) {
  const form = useForm<ProductFormData>({
    resolver: zodResolver(product ? ProductFormSchema : ProductFormCreateSchema),
    defaultValues: product || {
      name: "",
      vendor: "",
      vendorPartNumber: "",
      location: "",
      lots: [{ lotNumber: "", quantity: 1, receiptDate: new Date(), expirationDate: null }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lots",
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
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
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Storage Location</FormLabel>
                <FormControl><Input placeholder="e.g., Room 101, Shelf A" {...field} /></FormControl>
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
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg bg-background space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
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
                 <Button type="button" variant="secondary" onClick={() => append({ lotNumber: '', quantity: 1, receiptDate: new Date(), expirationDate: null })}>
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
