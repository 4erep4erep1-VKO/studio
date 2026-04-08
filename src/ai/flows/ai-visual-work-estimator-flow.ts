'use server';
/**
 * @fileOverview An AI agent for estimating work based on visual input and description.
 *
 * - estimateWork - A function that handles the AI visual work estimation process.
 * - AIVisualWorkEstimatorInput - The input type for the estimateWork function.
 * - AIVisualWorkEstimatorOutput - The return type for the estimateWork function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AIVisualWorkEstimatorInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo related to the work, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  description: z.string().describe('A detailed description of the work to be done.'),
});
export type AIVisualWorkEstimatorInput = z.infer<typeof AIVisualWorkEstimatorInputSchema>;

const AIVisualWorkEstimatorOutputSchema = z.object({
  complexities: z
    .array(z.string())
    .describe('A list of potential complexities or challenges identified in the work.'),
  requiredTools: z
    .array(z.string())
    .describe('A list of tools or equipment likely needed for the work.'),
  estimatedDuration: z
    .string()
    .describe(
      'An estimated duration for the work, e.g., "4-6 hours", "1 day", "2 weeks".'
    ),
});
export type AIVisualWorkEstimatorOutput = z.infer<typeof AIVisualWorkEstimatorOutputSchema>;

export async function estimateWork(
  input: AIVisualWorkEstimatorInput
): Promise<AIVisualWorkEstimatorOutput> {
  return aiVisualWorkEstimatorFlow(input);
}

const aiVisualWorkEstimatorPrompt = ai.definePrompt({
  name: 'aiVisualWorkEstimatorPrompt',
  input: {schema: AIVisualWorkEstimatorInputSchema},
  output: {schema: AIVisualWorkEstimatorOutputSchema},
  prompt: `You are an expert work estimator for an advertising agency. Your task is to analyze work details and a corresponding photo to provide estimates for potential complexities, required tools, and estimated work duration.

Analyze the following information:

Work Description: {{{description}}}
Photo: {{media url=photoDataUri}}

Based on the provided description and visual context, identify:
- Any potential complexities or challenges that might arise during the work.
- A list of tools or equipment that will likely be required.
- An estimated duration for completing the work. Be specific with units (e.g., hours, days, weeks).

Provide your response in JSON format according to the output schema.`,
});

const aiVisualWorkEstimatorFlow = ai.defineFlow(
  {
    name: 'aiVisualWorkEstimatorFlow',
    inputSchema: AIVisualWorkEstimatorInputSchema,
    outputSchema: AIVisualWorkEstimatorOutputSchema,
  },
  async input => {
    const {output} = await aiVisualWorkEstimatorPrompt(input);
    if (!output) {
      throw new Error('AI visual work estimator did not return any output.');
    }
    return output;
  }
);
