"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, PlusCircle, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Product, ProductSchema } from "@/lib/types";
import { getPredictedExpirationDatesAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "./ui/separator";

type ProductFormProps = {
  product?: Product | null;
  onSave: (data: z.infer<typeof ProductSchema>) => void;
  onCancel: () => void;
  isSaving: boolean;
};

export function ProductForm({ product, onSave, onCancel, isSaving }: ProductFormProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof ProductSchema>>({
    resolver: zodResolver(ProductSchema),
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
  
  const [isPredicting, setIsPredicting] = React.useState(false);

  async function handlePredictExpiration() {
    setIsPredicting(true);
    const formData = form.getValues();
    const lotsToPredict = formData.lots.map((lot, index) => ({...lot, index})).filter(lot => !lot.expirationDate);

    if (lotsToPredict.length === 0) {
      toast({ title: "No lots to predict", description: "All lots already have an expiration date." });
      setIsPredicting(false);
      return;
    }

    const input = {
      productName: formData.name,
      vendor: formData.vendor,
      vendorPartNumber: formData.vendorPartNumber,
      location: formData.location,
      lotNumbers: lotsToPredict.map(l => l.lotNumber),
      receiptDates: lotsToPredict.map(l => l.receiptDate.toISOString()),
      quantities: lotsToPredict.map(l => l.quantity),
    };

    const result = await getPredictedExpirationDatesAction(input);

    if (result.success && result.data) {
      result.data.predictedExpirationDates.forEach((dateStr, i) => {
        const originalIndex = lotsToPredict[i].index;
        form.setValue(`lots.${originalIndex}.expirationDate`, new Date(dateStr));
      });
      toast({
        title: "Prediction Successful",
        description: "Expiration dates have been predicted and filled in.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Prediction Failed",
        description: result.error || "Could not predict expiration dates.",
      });
    }
    setIsPredicting(false);
  }


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
                        <FormControl><Input type="number" placeholder="e.g., 100" {...field} /></FormControl>
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
                  <FormField
                    control={form.control}
                    name={`lots.${index}.expirationDate`}
                    render={({ field }) => (
                       <FormItem>
                        <FormLabel>Expiration Date</FormLabel>
                        <FormControl>
                            <Input value={field.value ? format(field.value, "PPP") : 'Predict to see date'} readOnly disabled className="bg-muted/50"/>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <Button type="button" variant="outline" size="sm" onClick={() => remove(index)} className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Remove Lot
                </Button>
              </div>
            ))}
            <div className="flex justify-between items-center">
                 <Button type="button" variant="secondary" onClick={() => append({ lotNumber: '', quantity: 1, receiptDate: new Date(), expirationDate: null })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Another Lot
                </Button>
                <Button type="button" onClick={handlePredictExpiration} disabled={isPredicting}>
                    {isPredicting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Predict Expiration
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
