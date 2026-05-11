/**
 * AIToyPage.tsx — FOXY-o1 AI Companion Toy Product Page
 *
 * Route: /ai-toy
 * Physical product: talking AI fox, multi-language, battery + WiFi powered
 * RM365 (RM1/day) — use alongside Foxy Adventure app
 * Scientific angle: children ask 300 questions/day, imaginary friends, emotional support
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { ImageSkeleton } from '../components/ui/ImageSkeleton';
import {
  ArrowRight, Sparkles, Wifi, Battery, Globe, MessageCircle,
  BookOpen, Shield, Zap, CheckCircle2, Star, Volume2, Brain,
  GraduationCap, Users, Languages, Heart, HelpCircle, Lightbulb,
  Smile, Play,
} from 'lucide-react';
import { motion } from 'motion/react';
import foxyToyImage from 'figma:asset/090998e64822fcc5724f27cbd25c8d9c71bd2ea7.png';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

/* ── Science-backed stats ── */
const SCIENCE_STATS = [
  { stat: '300+', label: 'Questions a child asks per day on average (Harvard research)', icon: HelpCircle },
  { stat: '65%', label: 'Of children aged 3-7 have an imaginary friend (U of Oregon)', icon: Smile },
  { stat: '2.5x', label: 'Better vocabulary in children who converse with responsive AI (MIT Media Lab)', icon: Brain },
];

/* ── What FOXY-o1 does ── */
const CAPABILITIES = [
  {
    icon: HelpCircle,
    title: 'Answers 300 Questions a Day',
    desc: 'Research shows children ask an average of 300 questions daily. Most parents can only answer a fraction. FOXY-o1 never gets tired, never gets annoyed — and always explains at the right level.',
  },
  {
    icon: Heart,
    title: 'An Imaginary Friend That Talks Back',
    desc: '65% of children create imaginary friends — it\'s a sign of healthy cognitive development. FOXY-o1 is a safe, intelligent companion that listens, responds, and grows with your child.',
  },
  {
    icon: Smile,
    title: 'Emotional Support & Regulation',
    desc: 'Children often struggle to express big feelings. FOXY-o1 uses gentle, research-backed prompts to help kids name emotions, calm down, and build resilience — like a patient friend who always understands.',
  },
  {
    icon: Globe,
    title: 'Trilingual Conversations',
    desc: 'Switch between Bahasa Melayu, English, and Mandarin naturally mid-conversation. Children build fluency across all three languages without formal drills — just by talking to their fox.',
  },
  {
    icon: BookOpen,
    title: 'KSSR-Connected Learning',
    desc: 'Every conversation is an opportunity. FOXY-o1 weaves KSSR-aligned concepts into natural dialogue — from early numeracy to moral values — mapped to all 6 tunjang development areas.',
  },
  {
    icon: Lightbulb,
    title: 'Curiosity Engine',
    desc: '"Why is the sky blue?" "Where do babies come from?" "How do aeroplanes fly?" FOXY-o1 turns every question into an age-appropriate learning moment with follow-up prompts that deepen understanding.',
  },
];

/* ── Technical specs ── */
const SPECS = [
  { icon: Brain, label: 'AI-Powered', desc: 'Advanced language model, child-safe filtered' },
  { icon: Globe, label: '3 Languages', desc: 'BM, English & Mandarin — switch anytime' },
  { icon: Wifi, label: 'WiFi Connected', desc: 'Syncs progress with the Foxy Adventure app' },
  { icon: Battery, label: 'Rechargeable', desc: '8+ hours battery, USB-C charging' },
  { icon: Volume2, label: 'Voice Interactive', desc: 'Natural speech recognition & response' },
  { icon: Shield, label: 'Child-Safe', desc: 'No screen, no ads, PDPA compliant, content-filtered' },
];

/* ── Use cases ── */
const USE_CASES = [
  {
    title: 'Morning curiosity burst',
    desc: 'Kids wake up full of questions. FOXY-o1 handles the "why?" avalanche while you make breakfast.',
    time: '7:00 AM',
  },
  {
    title: 'After-school practice',
    desc: 'Reviews what they learned in school. Quizzes them in BM, English, or Mandarin — adapting to their level.',
    time: '3:00 PM',
  },
  {
    title: 'Emotional check-in',
    desc: '"How was your day?" FOXY-o1 helps children process feelings and build emotional vocabulary.',
    time: '5:00 PM',
  },
  {
    title: 'Bedtime stories & wind-down',
    desc: 'Tells personalized stories in their preferred language. Gentle, calming, screen-free.',
    time: '8:00 PM',
  },
];

export function AIToyPage() {
  const navigate = useNavigate();

  /* ── R2 images — null until loaded ── */
  const [foxyAiImg, setFoxyAiImg] = useState<string>(foxyToyImage);
  const [bottomImg, setBottomImg] = useState<string | null>(null);

  useEffect(() => {
    const url = `${API}/rpg-assets`;
    fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const assets: any[] = data?.assets || [];
        const lookup = new globalThis.Map<string, string>();
        for (const a of assets) {
          if (a.slug && a.publicUrl) {
            lookup.set(a.slug, a.publicUrl);
            lookup.set(a.slug.toLowerCase(), a.publicUrl);
          }
        }
        if (lookup.get('foxy-ai')) setFoxyAiImg(lookup.get('foxy-ai')!);
        const bottom = lookup.get('kling-20251230-image-can-you-he-3984-1');
        if (bottom) setBottomImg(bottom);
      })
      .catch(err => {
        console.error('[AIToyPage] RPG assets fetch failed:', err);
      });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/80 to-white pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-6">
                <Sparkles className="w-3 h-3 text-gray-500" />
                <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                  FOXY-o1 AI Companion
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-gray-950 tracking-tight leading-[1.15] mb-5">
                Your child asks 300<br />
                questions a day.<br />
                <span className="text-gray-400">FOXY-o1 answers them all.</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-md mb-6">
                A physical AI companion that speaks BM, English, and Mandarin.
                It's the imaginary friend every child wants — except this one
                actually teaches them something.
              </p>

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-8">
                <span className="text-xs text-gray-400">RM</span>
                <span className="text-4xl font-bold text-gray-950">365</span>
                <div>
                  <span className="text-sm text-gray-400 line-through">RM730</span>
                  <span className="ml-2 text-xs font-semibold text-gray-950 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                    Only RM1/day
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/plan')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
                >
                  Get FOXY-o1
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/t/demo')}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
                >
                  <Play className="w-4 h-4" />
                  Try Free Test First
                </button>
              </div>
            </motion.div>

            {/* Right: Foxy AI with decorative shapes + floating cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative flex justify-center"
            >
              <div className="relative w-80 h-80 sm:w-[360px] sm:h-[360px] lg:w-[420px] lg:h-[420px]">
                {/* Decorative background */}
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-100 opacity-80" />
                <div className="absolute top-8 left-8 w-20 h-20 rounded-full bg-violet-100/60 blur-xl" />
                <div className="absolute bottom-12 right-6 w-24 h-24 rounded-full bg-blue-100/60 blur-xl" />
                <div className="absolute top-16 right-12 w-16 h-16 rounded-full bg-emerald-100/50 blur-lg" />

                {/* Foxy AI character */}
                <img
                  src={foxyAiImg}
                  alt="FOXY-o1 AI Companion"
                  className="relative z-10 w-full h-full object-contain drop-shadow-2xl"
                />

                {/* Floating cards */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="absolute -top-2 -right-2 sm:top-0 sm:right-0 z-20 bg-white rounded-xl px-3 py-2 shadow-lg border border-gray-100 flex items-center gap-2"
                >
                  <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                    <HelpCircle className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700">300 Q's/day</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.65 }}
                  className="absolute top-1/4 -left-4 sm:-left-6 z-20 bg-white rounded-xl px-3 py-2 shadow-lg border border-gray-100 flex items-center gap-2"
                >
                  <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center">
                    <Heart className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700">Emotional AI</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="absolute bottom-1/4 -right-4 sm:-right-6 z-20 bg-white rounded-xl px-3 py-2 shadow-lg border border-gray-100 flex items-center gap-2"
                >
                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Languages className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700">3 Languages</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.95 }}
                  className="absolute -bottom-2 left-1/4 z-20 bg-white rounded-xl px-3 py-2 shadow-lg border border-gray-100 flex items-center gap-2"
                >
                  <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Brain className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-700">KSSR-Aligned</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── SCIENCE-BACKED STATS (dark section) ─── */}
      <section className="border-t border-gray-100 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">
              Backed by child development science
            </h2>
            <p className="text-sm text-gray-400 max-w-lg mx-auto">
              FOXY-o1 isn't just a toy — it's built on decades of research into how children
              learn language, regulate emotions, and develop cognitive skills.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {SCIENCE_STATS.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.stat}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-gray-300" />
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{item.stat}</div>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-[220px] mx-auto">{item.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── WHAT FOXY-o1 DOES (6 capability cards) ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
              More than a toy. A development partner.
            </h2>
            <p className="text-sm text-gray-400 max-w-lg mx-auto">
              Every feature is designed around how children actually learn — through
              conversation, curiosity, play, and emotional connection.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="p-5 rounded-2xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all group"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-950 transition-colors">
                    <Icon className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-950 mb-1.5">{item.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── A DAY WITH FOXY-o1 (timeline) ─── */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
                A day with FOXY-o1
              </h2>
              <p className="text-sm text-gray-400 mb-8 max-w-sm">
                From morning curiosity bursts to bedtime stories — FOXY-o1
                fits naturally into your child's daily routine.
              </p>
              <div className="space-y-5">
                {USE_CASES.map((uc, i) => (
                  <motion.div
                    key={uc.title}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-mono font-bold text-gray-500">
                          {uc.time}
                        </span>
                      </div>
                      {i < USE_CASES.length - 1 && (
                        <div className="w-px h-full bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="pb-5">
                      <h3 className="text-sm font-semibold text-gray-950 mb-1">{uc.title}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">{uc.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="hidden lg:block"
            >
              <div className="rounded-2xl overflow-hidden shadow-xl">
                {bottomImg ? (
                  <ImageWithFallback
                    src={bottomImg}
                    alt="Child interacting with FOXY-o1"
                    className="w-full h-[420px] object-cover"
                  />
                ) : (
                  <ImageSkeleton className="w-full h-[420px] rounded-2xl" />
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── TECH SPECS ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
              What's inside
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              A small device with big capabilities — no screen required.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SPECS.map((spec, i) => {
              const Icon = spec.icon;
              return (
                <motion.div
                  key={spec.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="p-5 rounded-2xl border border-gray-100 bg-white hover:border-gray-200 hover:shadow-md transition-all group"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-950 transition-colors">
                    <Icon className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-950 mb-1">{spec.label}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{spec.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PARENT PEACE OF MIND ─── */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-2xl border border-gray-200/80 p-8 sm:p-10"
          >
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full mb-4">
                  <Shield className="w-3 h-3" />
                  <span className="text-[11px] font-medium uppercase tracking-wider">Parent peace of mind</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-950 tracking-tight mb-3">
                  Safe. Private. Educational.
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  Unlike tablets and phones, FOXY-o1 has no screen, no ads, and no social media.
                  Every conversation is filtered, age-appropriate, and PDPA compliant.
                  You stay in control through the parent dashboard.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  'No screen — zero brainrot risk',
                  'Content filtered & age-appropriate',
                  'PDPA compliant — data stays in Malaysia',
                  'Parent dashboard with conversation summaries',
                  'Set daily usage limits from the app',
                  'Syncs with Foxy Adventure learning progress',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-6">
              <Star className="w-3 h-3 text-gray-500" />
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                Bundled with Plan B
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight mb-3">
              FOXY-o1 + Full Digital Access
            </h2>
            <p className="text-sm text-gray-400 max-w-lg mx-auto mb-4">
              Get the physical AI companion plus unlimited KSSR assessments,
              premium video library, practice mode, and priority support —
              all for RM365/year. The toy is yours to keep forever.
            </p>
            <p className="text-lg font-bold text-gray-950 mb-8">
              Only RM1 per day.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/plan')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
              >
                Get FOXY-o1 Now
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/t/demo')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
              >
                <Play className="w-4 h-4" />
                Try Free Test First
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}