
'use server';

/**
 * @fileOverview AIによるプロフィール認証フロー。
 *
 * - aiProfileVerification - プロフィール認証プロセスを処理する関数。
 * - AIProfileVerificationInput - aiProfileVerification関数の入力型。
 * - AIProfileVerificationOutput - aiProfileVerification関数の戻り型。
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AIProfileVerificationInputSchema = z.object({
  profilePhotoDataUri: z
    .string()
    .describe(
      "ユーザーのプロフィール写真。MIMEタイプを含み、Base64エンコーディングを使用したデータURI形式である必要があります。期待される形式: 'data:<mimetype>;base64,<encoded_data>'。"
    ),
  profileDescription: z.string().describe('ユーザープロフィールの説明文。'),
});
export type AIProfileVerificationInput = z.infer<typeof AIProfileVerificationInputSchema>;

const AIProfileVerificationOutputSchema = z.object({
  isGenuine: z.boolean().describe('プロフィールが本物である可能性が高いかどうか。'),
  isAppropriate: z
    .boolean()
    .describe('プロフィール写真と説明文が適切かどうか。'),
  reason: z.string().describe('認証結果の理由。'),
});
export type AIProfileVerificationOutput = z.infer<typeof AIProfileVerificationOutputSchema>;

export async function aiProfileVerification(input: AIProfileVerificationInput): Promise<AIProfileVerificationOutput> {
  return aiProfileVerificationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiProfileVerificationPrompt',
  input: {schema: AIProfileVerificationInputSchema},
  output: {schema: AIProfileVerificationOutputSchema},
  prompt: `あなたはデーティングアプリのユーザープロフィール認証を専門とするAIエージェントです。

  提供されたユーザーのプロフィール写真と説明文から、プロフィールが本物であり、適切であるかを判断してください。

  以下の点を考慮してください：
  - プロフィール写真は実在の人物のように見えますか？
  - プロフィール説明文は写真と一貫性があり、関連性がありますか？
  - プロフィールに不適切なコンテンツは含まれていませんか？

  あなたの分析に基づき、isGenuineとisAppropriateの出力フィールドを適宜設定してください。
  判断の簡単な理由を添えてください。

  説明文: {{{profileDescription}}}
  写真: {{media url=profilePhotoDataUri}}
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
