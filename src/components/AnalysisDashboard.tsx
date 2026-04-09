import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { PsychologicalProfile } from '../types';
import { 
  Activity, 
  ShieldAlert, 
  Heart, 
  Eye, 
  Brain,
  TrendingUp,
  Download,
  RefreshCcw,
  Languages
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AnalysisDashboardProps {
  profile: PsychologicalProfile;
  userName: string;
}

type Language = 'en' | 'ta' | 'tanglish';

export function AnalysisDashboard({ profile, userName }: AnalysisDashboardProps) {
  const [lang, setLang] = useState<Language>('en');
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const traits = [
    { name: 'Openness', value: profile.personalityTraits.openness, icon: Eye },
    { name: 'Conscientiousness', value: profile.personalityTraits.conscientiousness, icon: ShieldAlert },
    { name: 'Extraversion', value: profile.personalityTraits.extraversion, icon: Activity },
    { name: 'Agreeableness', value: profile.personalityTraits.agreeableness, icon: Heart },
    { name: 'Neuroticism', value: profile.personalityTraits.neuroticism, icon: Brain },
  ];

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#050302',
        logging: false,
        useCORS: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Psyche_Analysis_${userName}_${lang}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-12 overflow-y-auto custom-scrollbar">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8 md:space-y-16 py-8 md:py-12"
      >
        {/* Controls Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sticky top-0 z-20 bg-[#050302]/80 backdrop-blur-md p-4 rounded-2xl border border-red-950/10">
          <div className="flex items-center gap-4">
            <Languages className="w-4 h-4 text-stone-500" />
            <div className="flex gap-2">
              {[
                { id: 'en', label: 'English' },
                { id: 'ta', label: 'தமிழ்' },
                { id: 'tanglish', label: 'Tanglish' }
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLang(l.id as Language)}
                  className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest transition-all ${
                    lang === l.id 
                      ? 'bg-red-900/20 text-red-500 border border-red-900/30' 
                      : 'text-stone-500 hover:text-stone-300 border border-transparent'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2 rounded-full bg-stone-900 hover:bg-stone-800 text-stone-300 text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <RefreshCcw className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            {isExporting ? 'Generating PDF...' : 'Download Report'}
          </button>
        </div>

        {/* Report Content */}
        <div 
          ref={reportRef} 
          className="space-y-12 md:space-y-16 p-6 md:p-12 rounded-3xl border"
          style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <header className="space-y-4 border-b pb-8" style={{ borderColor: 'rgba(69,10,10,0.2)' }}>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.5em]" style={{ color: 'rgba(127,29,29,0.6)' }}>
                  Extraction Complete // Protocol 04-9
                </span>
                <h1 className="font-serif text-4xl md:text-7xl tracking-tighter" style={{ color: '#e7e5e4' }}>
                  The <span className="italic" style={{ color: '#7f1d1d' }}>Post-Mortem</span> Profile
                </h1>
              </div>
              <div className="text-right font-mono text-[10px] uppercase tracking-widest" style={{ color: '#57534e' }}>
                Subject ID: {userName.substring(0, 8)}<br/>
                Status: <span style={{ color: '#7f1d1d' }}>EXTRACTED</span>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
            {/* Main Summary */}
            <div className="lg:col-span-2 space-y-8 md:space-y-12">
              <section className="space-y-6">
                <h3 className="font-mono text-[10px] uppercase tracking-widest border-l-2 pl-4" style={{ color: 'rgba(127,29,29,0.4)', borderColor: '#7f1d1d' }}>Neural Autopsy</h3>
                <p className="text-xl md:text-3xl font-light leading-relaxed italic" style={{ color: '#a8a29e' }}>
                  {profile.summary[lang]}
                </p>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                <section className="space-y-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2" style={{ color: 'rgba(127,29,29,0.4)' }}>
                    <ShieldAlert className="w-3 h-3" /> Deception Level
                  </h3>
                  <div className="flex items-end gap-4">
                    <span className="text-4xl md:text-6xl font-serif italic" style={{ color: '#7f1d1d' }}>{profile.honestyIndex}%</span>
                    <div className="flex-1 h-1 rounded-full mb-3 md:mb-4 overflow-hidden" style={{ backgroundColor: 'rgba(69,10,10,0.1)' }}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${profile.honestyIndex}%` }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="h-full" 
                        style={{ backgroundColor: '#7f1d1d' }}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2" style={{ color: 'rgba(127,29,29,0.4)' }}>
                    <TrendingUp className="w-3 h-3" /> Fragility
                  </h3>
                  <div className="flex items-end gap-4">
                    <span className="text-4xl md:text-6xl font-serif italic" style={{ color: '#57534e' }}>{100 - profile.emotionalStability}%</span>
                    <div className="flex-1 h-1 rounded-full mb-3 md:mb-4 overflow-hidden" style={{ backgroundColor: 'rgba(28,25,23,0.1)' }}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${100 - profile.emotionalStability}%` }}
                        transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                        className="h-full" 
                        style={{ backgroundColor: '#292524' }}
                      />
                    </div>
                  </div>
                </section>
              </div>

              <section className="space-y-6">
                <h3 className="font-mono text-[10px] uppercase tracking-widest border-l-2 pl-4" style={{ color: 'rgba(127,29,29,0.4)', borderColor: '#7f1d1d' }}>The Rot Beneath</h3>
                <p className="text-base md:text-xl font-light leading-relaxed italic" style={{ color: '#78716c' }}>
                  "{profile.socialMaskVsRealSelf[lang]}"
                </p>
              </section>
            </div>

            {/* Sidebar: Traits & Conflicts */}
            <div className="space-y-8 md:space-y-12">
              <section className="space-y-8">
                <h3 className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'rgba(127,29,29,0.4)' }}>Defect Matrix</h3>
                <div className="space-y-6">
                  {traits.map((trait) => (
                    <div key={trait.name} className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest">
                        <span className="flex items-center gap-2" style={{ color: '#57534e' }}>
                          <trait.icon className="w-3 h-3" /> {trait.name}
                        </span>
                        <span style={{ color: 'rgba(127,29,29,0.6)' }}>{trait.value}%</span>
                      </div>
                      <div className="h-[1px] w-full overflow-hidden" style={{ backgroundColor: 'rgba(69,10,10,0.1)' }}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${trait.value}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="h-full" 
                          style={{ backgroundColor: 'rgba(127,29,29,0.4)' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'rgba(127,29,29,0.4)' }}>Suppressed Trauma</h3>
                <ul className="space-y-4">
                  {profile.hiddenConflicts[lang].map((conflict, i) => (
                    <motion.li 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.2 }}
                      className="text-sm font-light border-l pl-4 py-1"
                      style={{ color: '#57534e', borderColor: 'rgba(69,10,10,0.2)' }}
                    >
                      {conflict}
                    </motion.li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 pt-12 pb-24">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-stone-600 hover:text-red-500 transition-colors"
          >
            <RefreshCcw className="w-3 h-3" />
            Terminate Session & Purge Data
          </button>
        </div>
      </motion.div>
    </div>
  );
}
