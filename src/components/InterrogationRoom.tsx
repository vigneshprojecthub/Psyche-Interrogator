import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Question, ResponseData, PsychologicalProfile } from '../types';
import { INITIAL_QUESTIONS } from '../constants/questions';
import { generateNextQuestion, generateFinalProfile } from '../lib/gemini';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Send, Globe } from 'lucide-react';

type Language = 'en' | 'ta' | 'tanglish';

interface InterrogationRoomProps {
  userName: string;
  onComplete: (profile: PsychologicalProfile) => void;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Memoized sub-components to prevent unnecessary re-renders during typing
const QuestionHeader = memo(({ index, total, lang, text }: { index: number, total: number, lang: string, text: string }) => (
  <div className="space-y-3 md:space-y-4">
    <motion.span 
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.2 }}
      className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.6em] text-red-900"
    >
      Extraction Phase {index + 1} / {total}
    </motion.span>
    <h2 className="font-serif text-2xl md:text-5xl leading-tight text-stone-300">
      {text}
    </h2>
  </div>
));

const LanguageSelector = memo(({ current, onSelect }: { current: string, onSelect: (l: any) => void }) => (
  <div className="absolute top-0 right-0 p-4 flex flex-wrap justify-end gap-2 md:gap-4 z-30">
    {[
      { id: 'en', label: 'EN' },
      { id: 'ta', label: 'தமிழ்' },
      { id: 'tanglish', label: 'Tanglish' }
    ].map((l) => (
      <button
        key={l.id}
        onClick={() => onSelect(l.id)}
        className={`px-2 py-1 rounded-md text-[9px] md:text-[10px] uppercase tracking-widest transition-all border ${
          current === l.id 
            ? 'text-red-500 border-red-900/30 bg-red-950/10' 
            : 'text-stone-600 border-transparent hover:text-stone-400'
        }`}
      >
        {l.label}
      </button>
    ))}
  </div>
));

export function InterrogationRoom({ userName, onComplete }: InterrogationRoomProps) {
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [allResponses, setAllResponses] = useState<{ q: string; a: string }[]>([]);
  const [lang, setLang] = useState<Language>('en');
  
  const [error, setError] = useState<string | null>(null);
  
  // Tracking refs
  const startTimeRef = useRef<number>(Date.now());
  const firstTypeTimeRef = useRef<number | null>(null);
  const editsCountRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Initialize session
    const initSession = async () => {
      // Wait for auth to be ready
      let retryCount = 0;
      while (!auth.currentUser && retryCount < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        retryCount++;
      }

      if (!auth.currentUser) {
        setError("Authentication failed. Please refresh.");
        return;
      }

      try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          userName: userName,
          startTime: serverTimestamp(),
          status: 'active',
          uid: auth.currentUser.uid
        });
        sessionIdRef.current = sessionRef.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'sessions');
      }
    };
    initSession();
  }, [userName]);

  const handleAnswerChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (!firstTypeTimeRef.current) {
      firstTypeTimeRef.current = Date.now();
    }
    
    setAnswer(e.target.value);
    editsCountRef.current += 1;
  };

  const handleSubmit = async () => {
    if (!answer.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setIsGeneratingNext(true); // Show loading immediately
    
    const endTime = Date.now();
    const responseData: ResponseData = {
      answer,
      responseTime: endTime - startTimeRef.current,
      typingStartDelay: firstTypeTimeRef.current ? firstTypeTimeRef.current - startTimeRef.current : 0,
      answerEditsCount: editsCountRef.current,
      timestamp: new Date().toISOString()
    };

    try {
      const currentQuestion = questions[currentIndex];
      if (!currentQuestion) {
        throw new Error("Question context lost. Please restart the interrogation.");
      }
      const previousContext = allResponses.map(r => ({ q: r.q, a: r.a }));
      
      // Store in Firestore (non-blocking)
      if (sessionIdRef.current) {
        const path = `sessions/${sessionIdRef.current}/responses`;
        addDoc(collection(db, path), {
          ...responseData,
          questionId: currentQuestion.id,
          questionText: currentQuestion[lang],
          timestamp: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, path));
      }

      const updatedResponses = [...allResponses, { q: currentQuestion[lang], a: answer }];
      setAllResponses(updatedResponses);

      // If it's the last question, generate profile
      if (currentIndex >= questions.length - 1) {
        try {
          const finalProfile = await generateFinalProfile(updatedResponses);
          if (sessionIdRef.current) {
            const path = 'sessions';
            await setDoc(doc(db, path, sessionIdRef.current), {
              status: 'completed',
              endTime: serverTimestamp()
            }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `${path}/${sessionIdRef.current}`));
            
            const analysisPath = 'analysis';
            await addDoc(collection(db, analysisPath), {
              sessionId: sessionIdRef.current,
              userName: userName,
              ...finalProfile,
              timestamp: serverTimestamp()
            }).catch(err => handleFirestoreError(err, OperationType.CREATE, analysisPath));
          }
          onComplete(finalProfile);
          return;
        } catch (err) {
          console.error("Final profile generation failed", err);
          setError("The neural engine failed to finalize your profile. This usually happens if the API key is missing or invalid.");
          setIsAnalyzing(false);
          setIsGeneratingNext(false);
          return;
        }
      }

      // Generate next question if needed
      let nextQuestion: Question | null = null;
      
      // Sync every question and decide if follow-up is needed
      if (questions.length < 15) {
        try {
          // Add a timeout safety net: if AI takes more than 8 seconds, just proceed to static questions
          const aiPromise = generateNextQuestion(updatedResponses, Math.min(10, currentQuestion.intensity + 1));
          const timeoutPromise = new Promise<{ decision: 'PROCEED' }>(resolve => 
            setTimeout(() => resolve({ decision: 'PROCEED' }), 8000)
          );

          const result = await Promise.race([aiPromise, timeoutPromise]);
          
          if (result.decision === 'FOLLOW_UP' && result.question) {
            nextQuestion = result.question;
          }
        } catch (err) {
          console.error("Next question generation failed", err);
          // Fallback to proceeding normally
        }
      }

      // Transition to next question
      setAnswer('');
      startTimeRef.current = Date.now();
      firstTypeTimeRef.current = null;
      editsCountRef.current = 0;

      if (nextQuestion) {
        const newQuestions = [...questions];
        newQuestions.splice(currentIndex + 1, 0, nextQuestion);
        setQuestions(newQuestions);
        setCurrentIndex(prev => prev + 1);
      } else if (currentIndex < questions.length - 1) {
        // Move to next static question
        setCurrentIndex(prev => prev + 1);
      } else {
        // We were at the end and failed to generate next/profile
        setError("The interrogation has reached its limit. No further questions can be generated.");
        setIsAnalyzing(false);
        setIsGeneratingNext(false);
        return;
      }

      setIsAnalyzing(false);
      setIsGeneratingNext(false);
      window.dispatchEvent(new CustomEvent('psyche-question-change'));

    } catch (error: any) {
      console.error("Submission failed:", error);
      setError(error?.message || "An unexpected cognitive error occurred.");
      setIsAnalyzing(false);
      setIsGeneratingNext(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const currentQuestion = questions[currentIndex];

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <h2 className="font-serif text-3xl text-red-600 mb-6 uppercase tracking-tighter">System Malfunction</h2>
        <p className="text-stone-400 font-light text-sm leading-relaxed mb-8">
          The interrogation was interrupted by an unexpected cognitive error. 
          The neural engine has been safely throttled.
        </p>
        <div className="bg-red-950/20 border border-red-900/30 p-4 rounded mb-8 w-full">
          <p className="text-red-500 font-mono text-[10px] uppercase tracking-widest break-words">
            {error}
          </p>
        </div>
        <button 
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
          className="px-8 py-3 border border-red-900/30 text-red-500 text-[10px] uppercase tracking-[0.4em] hover:bg-red-950/10 transition-all rounded-full"
        >
          Reboot Interface
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-serif text-2xl text-red-900 mb-4">Neural Link Severed</h2>
        <p className="text-stone-500 font-mono text-xs uppercase tracking-widest">
          The interrogation has reached an unstable state.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-6 py-2 border border-red-900/30 text-red-500 text-[10px] uppercase tracking-widest hover:bg-red-950/10 transition-all"
        >
          Reboot Interface
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-start pt-20 md:pt-32 p-4 md:p-6 max-w-4xl mx-auto w-full relative">
      <LanguageSelector current={lang} onSelect={setLang} />

      {isGeneratingNext && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/40">
          <div className="relative flex flex-col items-center gap-6">
            <div className="relative w-12 h-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-t-2 border-red-900 rounded-full"
              />
            </div>
            <div className="font-mono text-[8px] uppercase tracking-[0.6em] text-red-500/60 animate-pulse">
              Syncing...
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, x: -50 }}
          className="w-full space-y-8 md:space-y-12"
        >
          <QuestionHeader 
            index={currentIndex} 
            total={questions.length} 
            lang={lang} 
            text={currentQuestion[lang]} 
          />

          <div className="relative group">
            <textarea
              value={answer}
              onChange={handleAnswerChange}
              onKeyDown={handleKeyDown}
              disabled={isAnalyzing}
              placeholder="CONFESS..."
              className="input-field min-h-[150px] md:min-h-[200px] text-lg md:text-2xl font-light resize-none text-red-900/80"
              autoFocus
            />
            
            <div className="absolute bottom-6 right-0 flex items-center gap-4">
              {isAnalyzing ? (
                <div className="flex items-center gap-2 text-red-950 font-mono text-[10px] md:text-[12px] uppercase tracking-[0.4em] animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Neural Sync
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim()}
                  className="p-4 text-stone-800 hover:text-red-900 transition-all duration-500 disabled:opacity-0 glitch-hover"
                >
                  <Send className="w-8 h-8 md:w-10 md:h-10" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* AI message display removed */}
    </div>
  );
}
