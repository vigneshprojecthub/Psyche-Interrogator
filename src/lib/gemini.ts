import { GoogleGenAI, Type } from "@google/genai";
import { Question, PsychologicalProfile } from "../types";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is not set. Please ensure it is configured in your environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    let isRateLimit = false;
    let serverRetryDelay = 0;

    try {
      // The error message might be a JSON string from the API
      const errorBody = JSON.parse(error?.message?.replace('ApiError: ', '') || '{}');
      if (errorBody?.error?.code === 429) {
        isRateLimit = true;
        // Check for retryDelay in the error details (e.g., "51s")
        const retryInfo = errorBody?.error?.details?.find((d: any) => d.retryDelay);
        if (retryInfo?.retryDelay) {
          serverRetryDelay = parseInt(retryInfo.retryDelay) * 1000;
        }
      }
    } catch (e) {
      // Fallback to simple string check if JSON parsing fails
      isRateLimit = error?.message?.includes('429') || error?.message?.includes('high demand') || error?.message?.includes('RESOURCE_EXHAUSTED');
    }

    if (retries > 0 && isRateLimit) {
      // Use server-provided delay if available, otherwise use exponential backoff
      const waitTime = serverRetryDelay > 0 ? serverRetryDelay + 1000 : delay;
      console.warn(`Rate limit hit. Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function generateNextQuestion(
  previousResponses: { q: string; a: string }[],
  intensity: number
): Promise<Question> {
  const prompt = `
    Based on these previous psychological responses:
    ${previousResponses.map(r => `Q: ${r.q}\nA: ${r.a}`).join('\n')}

    Generate a follow-up question that:
    1. Probes deeper into a specific emotional point mentioned in the LAST answer.
    2. Has an intensity of ${intensity}/10.
    3. Feels intrusive but calm.
    4. Provide in en, ta, and tanglish.

    CRITICAL: Maintain a chilling, clinical tone.
  `;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            en: { type: Type.STRING },
            ta: { type: Type.STRING },
            tanglish: { type: Type.STRING },
            intensity: { type: Type.NUMBER },
            category: { type: Type.STRING }
          },
          required: ["id", "en", "ta", "tanglish", "intensity", "category"]
        }
      }
    });
    return JSON.parse(response.text);
  });
}

export async function generateFinalProfile(
  responses: { q: string; a: string }[]
): Promise<PsychologicalProfile> {
  const prompt = `
    Generate a comprehensive psychological profile based on these interrogation results:
    ${responses.map(r => `Q: ${r.q}\nA: ${r.a}`).join('\n\n')}

    Provide the profile in three formats:
    - en: English
    - ta: Tamil (Tamil script)
    - tanglish: Tamil written in English script (Tanglish)

    For each language, provide:
    1. Big Five personality traits (0-100) - these are numeric and same for all.
    2. Honesty Index (0-100).
    3. Emotional Stability Score (0-100).
    4. Hidden Conflict Indicators (list of strings).
    5. Social Mask vs Real Self comparison.
    6. A powerful, minimal summary.
    
    CRITICAL: Ensure all translations are grammatically perfect, formal in Tamil, and naturally conversational in Tanglish. The tone must be clinical, cold, and definitive.
  `;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personalityTraits: {
              type: Type.OBJECT,
              properties: {
                openness: { type: Type.NUMBER },
                conscientiousness: { type: Type.NUMBER },
                extraversion: { type: Type.NUMBER },
                agreeableness: { type: Type.NUMBER },
                neuroticism: { type: Type.NUMBER }
              },
              required: ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
            },
            honestyIndex: { type: Type.NUMBER },
            emotionalStability: { type: Type.NUMBER },
            hiddenConflicts: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.ARRAY, items: { type: Type.STRING } },
                ta: { type: Type.ARRAY, items: { type: Type.STRING } },
                tanglish: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["en", "ta", "tanglish"]
            },
            socialMaskVsRealSelf: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING },
                ta: { type: Type.STRING },
                tanglish: { type: Type.STRING }
              },
              required: ["en", "ta", "tanglish"]
            },
            summary: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING },
                ta: { type: Type.STRING },
                tanglish: { type: Type.STRING }
              },
              required: ["en", "ta", "tanglish"]
            }
          },
          required: ["personalityTraits", "honestyIndex", "emotionalStability", "hiddenConflicts", "socialMaskVsRealSelf", "summary"]
        }
      }
    });
    return JSON.parse(response.text);
  });
}
