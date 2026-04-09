export interface Question {
  id: string;
  en: string;
  ta: string;
  tanglish: string;
  intensity: number; // 1-10
  category: 'memory' | 'identity' | 'moral' | 'relationship' | 'emotion' | 'follow-up';
}

export interface ResponseData {
  answer: string;
  responseTime: number;
  typingStartDelay: number;
  answerEditsCount: number;
  timestamp: string;
}

export interface PsychologicalProfile {
  personalityTraits: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  honestyIndex: number;
  emotionalStability: number;
  hiddenConflicts: {
    en: string[];
    ta: string[];
    tanglish: string[];
  };
  socialMaskVsRealSelf: {
    en: string;
    ta: string;
    tanglish: string;
  };
  summary: {
    en: string;
    ta: string;
    tanglish: string;
  };
}
