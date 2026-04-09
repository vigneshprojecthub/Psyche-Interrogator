/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Atmosphere } from './components/Atmosphere';
import { InterrogationRoom } from './components/InterrogationRoom';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PsychologicalProfile } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { db } from './lib/firebase';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';

export default function App() {
  const [step, setStep] = useState<'intro' | 'interrogation' | 'analysis'>('intro');
  const [profile, setProfile] = useState<PsychologicalProfile | null>(null);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Test connection to Firestore
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firestore is offline. Check configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const handleBegin = () => {
    if (userName.trim().length >= 2) {
      setStep('interrogation');
      window.dispatchEvent(new CustomEvent('psyche-question-change'));
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-full flex flex-col relative">
        <Atmosphere />
        
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10"
            >
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-serif text-6xl md:text-9xl mb-6 tracking-tighter text-red-900/80 cursor-none"
              >
                Psyche <span className="italic text-red-950">Interrogator</span>
              </motion.h1>
              <p className="max-w-md text-stone-600 text-sm mb-12 font-mono tracking-widest uppercase opacity-60">
                [ Observation Protocol 04-9 ]<br/>
                Your consciousness is being harvested. Do not resist the extraction.
              </p>
              
              <div className="w-full max-w-xs space-y-8">
                <div className="relative">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="IDENTIFY YOURSELF"
                    className="input-field text-center uppercase tracking-[0.3em]"
                    autoFocus
                  />
                </div>

                <button
                  onClick={handleBegin}
                  disabled={userName.trim().length < 2}
                  className="group relative px-12 py-5 overflow-hidden border border-red-950/20 hover:border-red-600 transition-all duration-700 disabled:opacity-10 disabled:cursor-not-allowed"
                >
                  <span className="relative z-10 text-[10px] uppercase tracking-[0.5em] text-stone-500 group-hover:text-red-500 transition-colors">
                    Enter the Void
                  </span>
                  <div className="absolute inset-0 bg-red-950/5 translate-y-full group-hover:translate-y-0 transition-transform duration-1000" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'interrogation' && (
            <InterrogationRoom 
              userName={userName}
              onComplete={(finalProfile) => {
                setProfile(finalProfile);
                setStep('analysis');
              }} 
            />
          )}

          {step === 'analysis' && profile && (
            <AnalysisDashboard profile={profile} userName={userName} />
          )}
        </AnimatePresence>

        <footer className="fixed bottom-6 left-6 right-6 flex justify-between items-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-widest text-stone-600 font-mono">
            System Status: <span className="text-green-900">Observing</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-stone-600 font-mono">
            {userName ? (
              <motion.span
                animate={{
                  opacity: [1, 0.5, 1],
                  x: [0, 1, -1, 0],
                }}
                transition={{ duration: 0.1, repeat: Infinity, repeatDelay: 5 }}
              >
                Subject: {userName} // {Math.random().toString(36).substring(7).toUpperCase()}
              </motion.span>
            ) : 'v1.0.5 // Neural Engine Active'}
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}




