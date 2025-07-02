"use server";

import { predictExpirationDates, type PredictExpirationDatesInput } from '@/ai/flows/predict-expiration-dates';

export async function getPredictedExpirationDatesAction(input: PredictExpirationDatesInput) {
  try {
    const result = await predictExpirationDates(input);
    return { success: true, data: result };
  } catch (error) {
    console.error("Error predicting expiration dates:", error);
    return { success: false, error: "An error occurred while predicting expiration dates. Please try again." };
  }
}
