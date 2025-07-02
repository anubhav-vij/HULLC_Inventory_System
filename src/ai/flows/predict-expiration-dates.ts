'use server';

/**
 * @fileOverview A Genkit flow to predict expiration dates of products.
 *
 * - predictExpirationDates - A function that predicts the expiration dates of a product.
 * - PredictExpirationDatesInput - The input type for the predictExpirationDates function.
 * - PredictExpirationDatesOutput - The return type for the predictExpirationDates function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictExpirationDatesInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  vendor: z.string().describe('The vendor or manufacturer of the product.'),
  vendorPartNumber: z.string().describe('The vendor part number of the product.'),
  location: z.string().describe('The location where the product is stored.'),
  lotNumbers: z
    .array(z.string())
    .describe('An array of lot numbers associated with the product.'),
  receiptDates: z
    .array(z.string())
    .describe(
      'An array of receipt dates (ISO 8601 format) corresponding to each lot number.'
    ),
  quantities: z
    .array(z.number())
    .describe('An array of quantities corresponding to each lot number.'),
});
export type PredictExpirationDatesInput = z.infer<
  typeof PredictExpirationDatesInputSchema
>;

const PredictExpirationDatesOutputSchema = z.object({
  predictedExpirationDates: z
    .array(z.string())
    .describe(
      'An array of predicted expiration dates (ISO 8601 format) for each lot number.'
    ),
  reasoning: z
    .string()
    .describe(
      'The reasoning behind the predicted expiration dates, including any external data sources used.'
    ),
});

export type PredictExpirationDatesOutput = z.infer<
  typeof PredictExpirationDatesOutputSchema
>;

export async function predictExpirationDates(
  input: PredictExpirationDatesInput
): Promise<PredictExpirationDatesOutput> {
  return predictExpirationDatesFlow(input);
}

const predictExpirationDatesPrompt = ai.definePrompt({
  name: 'predictExpirationDatesPrompt',
  input: {schema: PredictExpirationDatesInputSchema},
  output: {schema: PredictExpirationDatesOutputSchema},
  prompt: `You are an expert in predicting expiration dates for products in inventory.

  Given the following information about a product and its lots, predict the expiration date for each lot.
  Consider factors such as the product type, vendor, storage location, and receipt date.
  Use external data sources, such as industry standards and typical shelf lives, to inform your predictions.

  Product Name: {{{productName}}}
  Vendor: {{{vendor}}}
  Vendor Part Number: {{{vendorPartNumber}}}
  Location: {{{location}}}

  {{#each lotNumbers}}
  Lot Number: {{{this}}}
  Receipt Date: {{{../receiptDates.[@index]}}}
  Quantity: {{{../quantities.[@index]}}}
  {{/each}}

  Provide the predicted expiration dates and a detailed explanation of your reasoning.
  Ensure predictedExpirationDates are in ISO 8601 format.
  `,
});

const predictExpirationDatesFlow = ai.defineFlow(
  {
    name: 'predictExpirationDatesFlow',
    inputSchema: PredictExpirationDatesInputSchema,
    outputSchema: PredictExpirationDatesOutputSchema,
  },
  async input => {
    const {output} = await predictExpirationDatesPrompt(input);
    return output!;
  }
);
