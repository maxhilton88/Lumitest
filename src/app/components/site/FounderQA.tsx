/**
 * FounderQA.tsx — Founder Q&A Section with YouTube Video + Timestamps
 *
 * Reusable component used on /parents and /kindergarten pages.
 * Video and timestamp list are equal height.
 */
import React, { useState, useRef } from 'react';
import { Play, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

const YOUTUBE_VIDEO_ID = 'LHJWRS6xffY';

const QA_ITEMS = [
  { time: '0:00', seconds: 0, title: 'What is Project Lumi?' },
  { time: '1:24', seconds: 84, title: 'Why KSSR readiness matters' },
  { time: '3:10', seconds: 190, title: 'How the gamified assessment works' },
  { time: '5:30', seconds: 330, title: 'What parents get from the reports' },
  { time: '7:15', seconds: 435, title: 'The FOXY-o1 AI Companion Toy' },
  { time: '9:00', seconds: 540, title: 'How kindergartens can partner with us' },
  { time: '11:20', seconds: 680, title: 'Pricing and getting started' },
  { time: '13:00', seconds: 780, title: 'Our vision for Malaysian education' },
];

export function FounderQA() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeQA, setActiveQA] = useState<number | null>(null);

  const handleQAClick = (index: number, seconds: number) => {
    setActiveQA(index);
    if (iframeRef.current) {
      iframeRef.current.src = `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?start=${seconds}&autoplay=1&rel=0`;
    }
  };

  return (
    <section className="border-t border-gray-100 bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-4">
            <Play className="w-3 h-3 text-gray-500" />
            <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">
              Founder Q&A
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
            Hear it from the founder
          </h2>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            Everything you need to know about Project Lumi, answered in one video.
          </p>
        </motion.div>

        {/* Equal-height grid: video left, timestamps right */}
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8 items-stretch">
          {/* Video (3 cols) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-3 flex flex-col"
          >
            <div className="relative rounded-2xl overflow-hidden bg-gray-950 shadow-2xl shadow-gray-200/60 flex-1 min-h-[280px]">
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0`}
                title="Founder Q&A — Project Lumi"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </motion.div>

          {/* Timestamp list (2 cols) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-2 flex flex-col"
          >
            <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden flex flex-col flex-1">
              <div className="px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
                <h3 className="text-xs font-semibold text-gray-950 uppercase tracking-wider">
                  Topics
                </h3>
              </div>
              <div className="divide-y divide-gray-50 overflow-y-auto flex-1">
                {QA_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleQAClick(i, item.seconds)}
                    className={`w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors group ${
                      activeQA === i ? 'bg-gray-50' : ''
                    }`}
                  >
                    <span
                      className={`text-[11px] font-mono font-bold shrink-0 w-10 ${
                        activeQA === i ? 'text-gray-950' : 'text-gray-300'
                      }`}
                    >
                      {item.time}
                    </span>
                    <span
                      className={`text-xs font-medium flex-1 ${
                        activeQA === i ? 'text-gray-950' : 'text-gray-500'
                      }`}
                    >
                      {item.title}
                    </span>
                    <ChevronRight
                      className={`w-3 h-3 shrink-0 transition-colors ${
                        activeQA === i
                          ? 'text-gray-950'
                          : 'text-gray-200 group-hover:text-gray-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
