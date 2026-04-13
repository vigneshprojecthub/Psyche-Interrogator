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

let isThrottled = false;
let throttleTimer: NodeJS.Timeout | null = null;

export async function generateNextQuestion(
  previousResponses: { q: string; a: string }[],
  intensity: number
): Promise<{ decision: 'FOLLOW_UP' | 'PROCEED'; question?: Question }> {
  if (isThrottled) {
    return { decision: 'PROCEED' };
  }

  const lastResponse = previousResponses[previousResponses.length - 1];
  
  const prompt = `
    Analyze this response (it may be in English, Tamil, or Tanglish):
    Q: ${lastResponse.q}
    A: ${lastResponse.a}

    Decision:
    - If the answer is vague, suspiciously short (< 5 words), or evasive, return FOLLOW_UP.
    - If the answer is detailed or satisfactory, return PROCEED.
    - IMPORTANT: Analyze the subtext of Tamil/Tanglish responses for hidden lies.

    Follow-up Question Requirements:
    - Must be "Strongest": Directly confront the subject's hesitation, call out a specific contradiction, or use a "cold reading" technique to unsettle them.
    - Do not be polite. Be clinical, cold, and intellectually superior.
    - Intensity: ${intensity}/10.
    - Provide in en, ta, tanglish.
  `;

  try {
    return await withRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              decision: { type: Type.STRING, enum: ["FOLLOW_UP", "PROCEED"] },
              question: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  en: { type: Type.STRING },
                  ta: { type: Type.STRING },
                  tanglish: { type: Type.STRING },
                  intensity: { type: Type.NUMBER },
                  category: { type: Type.STRING }
                }
              }
            },
            required: ["decision"]
          }
        }
      });
      return JSON.parse(response.text);
    });
  } catch (error) {
    // If we hit rate limits repeatedly, throttle for 2 minutes
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'))) {
      isThrottled = true;
      if (throttleTimer) clearTimeout(throttleTimer);
      throttleTimer = setTimeout(() => { isThrottled = false; }, 120000);
    }
    return { decision: 'PROCEED' };
  }
}

export async function generateFinalProfile(
  responses: { q: string; a: string }[]
): Promise<PsychologicalProfile> {
  const prompt = `
    Generate an IN-DEPTH psychological profile based on these interrogation results:
    ${responses.map(r => `Q: ${r.q}\nA: ${r.a}`).join('\n\n')}

    The subject may have answered in English, Tamil, or Tanglish. Analyze the subtext and emotional patterns across all languages.

    Provide the profile in three formats:
    - en: English
    - ta: Tamil (Tamil script)
    - tanglish: Tamil written in English script (Tanglish)

    For each language, provide:
    1. Big Five personality traits (0-100).
    2. Honesty Index (0-100) - analyze consistency across answers.
    3. Emotional Stability Score (0-100).
    4. Hidden Conflict Indicators (list of strings) - deep psychological tensions.
    5. Social Mask vs Real Self comparison - how they present vs who they are.
    6. A powerful, minimal summary - the "Core Truth" discovered.
    7. A Psychological Archetype (e.g., "The Wounded Healer", "The Machiavellian Architect", "The Fragile Perfectionist").
    8. Dark Triad Traits (Narcissism, Machiavellianism, Psychopathy) from 0-100.
    
    CRITICAL: The analysis must be clinical, cold, and piercing. Do not be polite. Uncover the darkness.
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
            },
            archetype: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING },
                ta: { type: Type.STRING },
                tanglish: { type: Type.STRING }
              },
              required: ["en", "ta", "tanglish"]
            },
            darkTriad: {
              type: Type.OBJECT,
              properties: {
                narcissism: { type: Type.NUMBER },
                machiavellianism: { type: Type.NUMBER },
                psychopathy: { type: Type.NUMBER }
              },
              required: ["narcissism", "machiavellianism", "psychopathy"]
            }
          },
          required: ["personalityTraits", "honestyIndex", "emotionalStability", "hiddenConflicts", "socialMaskVsRealSelf", "summary", "archetype", "darkTriad"]
        }
      }
    });
    return JSON.parse(response.text);
  });
}
