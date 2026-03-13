
"use client";

import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { type Product, createTransactionFormSchema, type TransactionFormData, type Transaction } from "@/lib/types";
import { Separator } from "./ui/separator";

type TransactionFormProps = {
  product: Product;
  onSave: (data: TransactionFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
};

export function TransactionForm({ product, onSave, onCancel, isSaving }: TransactionFormProps) {
  const transactionFormSchema = createTransactionFormSchema(product.lots);

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      date: new Date(),
      notes: "",
      items: product.lots.map(lot => ({
        lotId: lot.id,
        quantityTaken: 0,
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  const totalDispensed = form.watch('items').reduce((acc, item) => acc + (Number(item.quantityTaken) || 0), 0);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Transaction Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
            />
             <div className="space-y-2">
                <FormLabel>Total Quantity Dispensed</FormLabel>
                <Input readOnly value={totalDispensed} className="font-bold bg-muted" />
            </div>
        </div>

         <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="e.g., Dispensed for Study XYZ" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        <Separator />

        <div>
          <h3 className="text-lg font-medium mb-2">Dispense from Lots</h3>
          {(product.reservedQuantity ?? 0) > 0 && (
            <div className="mb-3 px-3 py-2 rounded-md text-xs" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
              <strong>{product.reservedQuantity}</strong> unit{product.reservedQuantity === 1 ? '' : 's'} reserved for approved requests.
              Available: <strong>{product.lots.reduce((s, l) => s + l.quantity, 0) - (product.reservedQuantity ?? 0)}</strong>
            </div>
          )}
           <FormMessage>{form.formState.errors.items?.root?.message}</FormMessage>
          <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
            {fields.map((field, index) => {
                const productLot = product.lots[index];
                return (
                    <div key={field.id} className="grid grid-cols-3 gap-4 items-center p-3 border rounded-lg bg-background">
                        <div className="space-y-1">
                            <p className="font-medium">{productLot.lotNumber}</p>
                            <p className="text-sm text-muted-foreground">Loc: {productLot.location}</p>
                            <p className="text-sm text-muted-foreground">Expires: {productLot.expirationDate ? format(productLot.expirationDate, 'PPP') : 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                             <p className="font-medium text-center">{productLot.quantity}</p>
                             <p className="text-sm text-muted-foreground text-center">Available</p>
                        </div>
                         <FormField
                            control={form.control}
                            name={`items.${index}.quantityTaken`}
                            render={({ field: formField }) => (
                            <FormItem>
                                <FormLabel className="sr-only">Quantity to Dispense</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        placeholder="0"
                                        min="0"
                                        max={productLot.quantity}
                                        {...formField} 
                                        onChange={e => formField.onChange(parseInt(e.target.value, 10) || 0)} 
                                        className="text-center"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                )}
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving || totalDispensed === 0}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Completing...' : 'Complete Transaction'}
            </Button>
        </div>
      </form>
    </Form>
  );
}


    