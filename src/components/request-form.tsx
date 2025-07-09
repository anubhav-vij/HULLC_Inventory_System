"use client";

import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { type Product, ProductRequestFormSchema, type ProductRequestFormData, DEPARTMENTS, PROJECTS } from "@/lib/types";
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
      requesterName: "",
      requesterEmail: "",
      department: undefined,
      quantity: 1,
      project: undefined,
      justification: "",
      sopRead: false,
    },
  });

  return (
    <div className="space-y-6">
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-4 max-h-[50vh] overflow-y-auto pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="requesterName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Jane Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requesterEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIH Email Address</FormLabel>
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
                  <FormLabel>Select your Department</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a department" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DEPARTMENTS.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity of Request</FormLabel>
                  <FormControl><Input type="number" min="1" placeholder="1" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

           <FormField
              control={form.control}
              name="project"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Which project is this needed to support?</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROJECTS.map(proj => <SelectItem key={proj} value={proj}>{proj}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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

          <div className="flex justify-end gap-2 pt-4">
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
