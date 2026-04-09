import { GoogleGenAI, Type } from "@google/genai";
import { Question, ResponseData, AnalysisResult, PsychologicalProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
}
