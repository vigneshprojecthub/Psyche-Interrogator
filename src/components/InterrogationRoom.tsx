import { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Question, ResponseData, PsychologicalProfile } from '../types';
import { INITIAL_QUESTIONS } from '../constants/questions';
import { generateNextQuestion, generateFinalProfile } from '../lib/gemini';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Send, Globe } from 'lucide-react';

type Language = 'en' | 'ta' | 'tanglish';

interface InterrogationRoomProps {
  userName: string;
  onComplete: (profile: PsychologicalProfile) => void;
}

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
      const sessionRef = await addDoc(collection(db, 'sessions'), {
        userName: userName,
        startTime: serverTimestamp(),
        status: 'active'
      });
      sessionIdRef.current = sessionRef.id;
    };
    initSession();
  }, [userName]);

  const handleAnswerChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (!firstTypeTimeRef.current) {
      firstTypeTimeRef.current = Date.now();
    }
    
    let value = e.target.value;
    
    // Psychological Trap: Neural Glitch
    // Occasionally double a character or skip one to simulate mental strain
    if (value.length > answer.length && Math.random() > 0.98) {
      const lastChar = value.slice(-1);
      if (Math.random() > 0.5) {
        value += lastChar; // Double character
      } else {
        value = value.slice(0, -1); // Skip character
      }
    }

    setAnswer(value);
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
      const previousContext = allResponses.map(r => ({ q: r.q, a: r.a }));
      
      // Store in Firestore (non-blocking)
      if (sessionIdRef.current) {
        addDoc(collection(db, `sessions/${sessionIdRef.current}/responses`), {
          ...responseData,
          questionId: currentQuestion.id,
          questionText: currentQuestion[lang],
          timestamp: serverTimestamp()
        }).catch(() => {});
      }

      const updatedResponses = [...allResponses, { q: currentQuestion[lang], a: answer }];
      setAllResponses(updatedResponses);

      // If it's the last question, generate profile
      if (currentIndex >= questions.length - 1) {
        try {
          const finalProfile = await generateFinalProfile(updatedResponses);
          if (sessionIdRef.current) {
            await setDoc(doc(db, 'sessions', sessionIdRef.current), {
              status: 'completed',
              endTime: serverTimestamp()
            }, { merge: true });
            
            await addDoc(collection(db, 'analysis'), {
              sessionId: sessionIdRef.current,
              userName: userName,
              ...finalProfile,
              timestamp: serverTimestamp()
            });
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
      if (questions.length < 15) {
        try {
          // Increase probability of follow-up or just always do it if we want more questions
          if (Math.random() > 0.3) {
            nextQuestion = await generateNextQuestion(updatedResponses, Math.min(10, currentQuestion.intensity + 1));
          }
        } catch (err) {
          console.error("Next question generation failed", err);
          // Don't set error here, just continue with static questions if generation fails
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
        // Only increment if we actually have another question in the static list
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
      {/* Language Selector */}
      <div className="absolute top-0 right-0 p-4 flex flex-wrap justify-end gap-2 md:gap-4 z-30">
        {[
          { id: 'en', label: 'EN' },
          { id: 'ta', label: 'தமிழ்' },
          { id: 'tanglish', label: 'Tanglish' }
        ].map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id as Language)}
            className={`px-2 py-1 rounded-md text-[9px] md:text-[10px] uppercase tracking-widest transition-all border ${
              lang === l.id 
                ? 'text-red-500 border-red-900/30 bg-red-950/10' 
                : 'text-stone-600 border-transparent hover:text-stone-400'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

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
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: -50, filter: 'blur(5px)' }}
          className="w-full space-y-8 md:space-y-12"
        >
          <div className="space-y-3 md:space-y-4">
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.6em] text-red-900"
            >
              Extraction Phase {currentIndex + 1} / {questions.length}
            </motion.span>
            <h2 className="font-serif text-2xl md:text-5xl leading-tight text-stone-300">
              {currentQuestion[lang]}
            </h2>
          </div>

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
            
            <div className="absolute bottom-4 right-0 flex items-center gap-4">
              {isAnalyzing ? (
                <div className="flex items-center gap-2 text-red-950 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.4em] animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Neural Sync
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim()}
                  className="p-2 text-stone-800 hover:text-red-900 transition-all duration-500 disabled:opacity-0 glitch-hover"
                >
                  <Send className="w-6 h-6" />
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
