'use server';

/**
 * @fileOverview AI-powered profile verification flow.
 *
 * - aiProfileVerification - A function that handles the profile verification process.
 * - AIProfileVerificationInput - The input type for the aiProfileVerification function.
 * - AIProfileVerificationOutput - The return type for the aiProfileVerification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AIProfileVerificationInputSchema = z.object({
  profilePhotoDataUri: z
    .string()
    .describe(
      "A photo from the user's profile, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  profileDescription: z.string().describe('The description of the user profile.'),
});
export type AIProfileVerificationInput = z.infer<typeof AIProfileVerificationInputSchema>;

const AIProfileVerificationOutputSchema = z.object({
  isGenuine: z.boolean().describe('Whether or not the profile is likely to be genuine.'),
  isAppropriate: z
    .boolean()
    .describe('Whether or not the profile photo and description are appropriate.'),
  reason: z.string().describe('The reason for the verification result.'),
});
export type AIProfileVerificationOutput = z.infer<typeof AIProfileVerificationOutputSchema>;

export async function aiProfileVerification(input: AIProfileVerificationInput): Promise<AIProfileVerificationOutput> {
  return aiProfileVerificationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiProfileVerificationPrompt',
  input: {schema: AIProfileVerificationInputSchema},
  output: {schema: AIProfileVerificationOutputSchema},
  prompt: `You are an AI agent specializing in verifying user profiles on a dating app.

  Given the user profile photo and description, determine if the profile is genuine and appropriate.

  Consider the following:
  - Does the profile photo look like a real person?
  - Is the profile description coherent and relevant to the photo?
  - Does the profile contain any inappropriate content?

  Based on your analysis, set the isGenuine and isAppropriate output fields accordingly.
  Provide a brief reason for your determination.

  Description: {{{profileDescription}}}
  Photo: {{media url=profilePhotoDataUri}}
  `,
});

const aiProfileVerificationFlow = ai.defineFlow(
  {
    name: 'aiProfileVerificationFlow',
    inputSchema: AIProfileVerificationInputSchema,
    outputSchema: AIProfileVerificationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
