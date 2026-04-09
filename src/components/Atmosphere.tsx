import { motion, useMotionValue, useSpring, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

export function Atmosphere() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [showWatcher, setShowWatcher] = useState(false);
  const [subliminal, setSubliminal] = useState<string | null>(null);

  const MESSAGES = [
    "THEY ARE WATCHING",
    "DO NOT LIE",
    "WE KNOW",
    "IT IS ALREADY OVER",
    "LOOK BEHIND YOU",
    "THE VOID HUNGERS",
    "YOU ARE NOT ALONE"
  ];

  const springConfig = { damping: 25, stiffness: 150 };
  const ghostX = useSpring(mouseX, springConfig);
  const ghostY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Randomly show "The Watcher"
    const watcherInterval = setInterval(() => {
      if (Math.random() > 0.9) {
        setShowWatcher(true);
        setTimeout(() => setShowWatcher(false), 800);
      }
    }, 15000);

    // Randomly show subliminal messages
    const subliminalInterval = setInterval(() => {
      if (Math.random() > 0.95) {
        setSubliminal(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
        setTimeout(() => setSubliminal(null), 150);
      }
    }, 10000);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearInterval(watcherInterval);
      clearInterval(subliminalInterval);
    };
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#050302]">
      {/* Subliminal Messages */}
      <AnimatePresence>
        {subliminal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-40"
          >
            <span className="font-mono text-6xl md:text-9xl font-bold tracking-[1em] text-red-900 select-none">
              {subliminal}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ghost Cursor Trap */}
      <motion.div
        style={{ x: ghostX, y: ghostY }}
        className="fixed top-0 left-0 w-4 h-4 rounded-full bg-red-900/10 blur-sm pointer-events-none z-50"
      />

      {/* The Watcher Trap */}
      {showWatcher && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.2, 0] }}
          className="absolute top-1/4 left-1/2 -translate-x-1/2 flex gap-12 pointer-events-none"
        >
          <div className="w-2 h-1 bg-red-900/40 rounded-full blur-[2px]" />
          <div className="w-2 h-1 bg-red-900/40 rounded-full blur-[2px]" />
        </motion.div>
      )}

      {/* Heartbeat Pulse Effect */}
      <motion.div
        animate={{
          opacity: [0, 0.05, 0],
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 bg-red-900/5 pointer-events-none"
      />

      {/* Layered radial gradients for depth */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.3, 0.1],
          x: [0, 10, -10, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-[20%] -left-[10%] h-[80%] w-[80%] rounded-full bg-radial from-[#1a0505] to-transparent blur-[120px]"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.05, 0.2, 0.05],
          y: [0, -20, 20, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="absolute -bottom-[10%] -right-[10%] h-[70%] w-[70%] rounded-full bg-radial from-[#4a040422] to-transparent blur-[150px]"
      />
      
      {/* Flickering Light Effect - Very Subtle */}
      <motion.div 
        animate={{
          opacity: [0, 0.02, 0, 0.04, 0],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          times: [0, 0.2, 0.5, 0.8, 1],
        }}
        className="absolute inset-0 bg-red-950/5 pointer-events-none"
      />

      {/* Grainy Overlay */}
      <div className="grain" />
    </div>
  );
}
