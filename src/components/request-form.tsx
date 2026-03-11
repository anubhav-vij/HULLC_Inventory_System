"use client";

import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { type Product, ProductRequestFormSchema, type ProductRequestFormData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type RequestFormProps = {
  product: Product;
  onSave: (data: ProductRequestFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
};

export function RequestForm({ product, onSave, onCancel, isSaving }: RequestFormProps) {
  const form = useForm<ProductRequestFormData>({
    resolver: zodResolver(ProductRequestFormSchema),
    defaultValues: {
      requestorName: "",
      requestorEmail: "",
      department: "",
      project: undefined,
      justification: "",
      sopRead: false,
      lineItems: [{ requestedDate: "", quantity: 1 }],
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-shrink-0">
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">Requesting Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <p className="font-medium">Product Name:</p>
              <p>{product.name}</p>
              <p className="font-medium">Product ID:</p>
              <p>{product.id}</p>
              <p className="font-medium">Vendor:</p>
              <p>{product.vendor}</p>
              <p className="font-medium">Vendor Part #:</p>
              <p>{product.vendorPartNumber}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-4 flex-1 overflow-y-auto pr-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="requestorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requestor Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Jane Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requestorEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requestor Email Address</FormLabel>
                  <FormControl><Input type="email" placeholder="e.g., jane.doe@nih.gov" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department / Functional Group</FormLabel>
                  <FormControl><Input placeholder="e.g., HULLC" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="project"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project (optional)</FormLabel>
                  <FormControl><Input placeholder="e.g., Project Alpha" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

            <FormField
              control={form.control}
              name="justification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justification and Comments</FormLabel>
                  <FormControl><Textarea placeholder="Provide a brief justification for this request." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="sopRead"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Read and Understood SOP
                    </FormLabel>
                    <FormDescription>
                      Please indicate that you have read and understood SOP-30037.01.
                    </FormDescription>
                     <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          <div className="flex-shrink-0 flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSaving ? 'Submitting...' : 'Submit Request'}
              </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
