/**
 * ParentsPage.tsx — Parent-focused landing page
 *
 * Route: /parents
 * CTA: Take readiness test or Sign up (no pricing page link)
 * Minimalist black & white design.
 * R2 images loaded via RPG Asset pipeline: kid_study, parents-2
 * NO fallback images — only R2.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { ImageSkeleton } from '../components/ui/ImageSkeleton';
import {
  ArrowRight, Sparkles, CheckCircle2, Play, Shield, Gamepad2,
  BookOpen, Brain, Globe, Clock, TrendingUp, Heart,
} from 'lucide-react';
import { motion } from 'motion/react';
import { FounderQA } from '../components/site/FounderQA';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

const STEPS = [
  {
    num: '01',
    title: 'Take the Free Test',
    desc: 'Your child goes on a 10-minute RPG quest. No account needed — just play and discover their readiness level instantly.',
    action: 'Start Free Assessment',
    href: '/t/demo',
  },
  {
    num: '02',
    title: 'See the Mastery Report',
    desc: 'Get a detailed spider-web chart showing strengths and gaps across all 6 KSSR tunjang — in your preferred language.',
    action: 'See Sample Report',
    href: '/login',
  },
  {
    num: '03',
    title: 'Learn While They Play',
    desc: 'Sign up for only RM1/day and unlock daily quests, practice drills, and real-time mastery tracking. Cancel anytime.',
    action: 'Sign Up Now',
    href: '/login',
  },
];

const VALUE_PROPS = [
  {
    icon: Clock,
    title: 'Only RM1 Per Day',
    desc: 'Quality KSSR-aligned education for the price of a packet of nasi lemak. No hidden fees, cancel anytime.',
  },
  {
    icon: Shield,
    title: 'Prevent Brainrot',
    desc: 'Replace mindless screen time with purposeful learning. Every minute on Foxy Adventure builds real skills — not zombie-scrolling habits.',
  },
  {
    icon: BookOpen,
    title: 'Malaysia KSSR Connected',
    desc: 'Mapped to the national KSSR curriculum across all 6 tunjang development areas. Your child learns exactly what MOE expects.',
  },
  {
    icon: Gamepad2,
    title: 'Learn While You Play',
    desc: 'Dark-fantasy RPG quests that kids BEG to play. They think it\'s a game — you know it\'s a comprehensive assessment and learning tool.',
  },
  {
    icon: Globe,
    title: 'Trilingual: BM, EN & 中文',
    desc: 'Full support for Bahasa Melayu, English, and Mandarin. Every child can be assessed and learn in their strongest language.',
  },
  {
    icon: TrendingUp,
    title: 'Real-Time Progress',
    desc: 'Spider-web mastery charts updated after every quest. See exactly where your child excels and where they need help — no guessing.',
  },
];

const BRAINROT_STATS = [
  { stat: '6+ hrs', label: 'Average daily screen time for Malaysian children aged 4-12' },
  { stat: '78%', label: 'Of parents worry about unproductive screen time' },
  { stat: '15 min', label: 'Is all it takes per day on Foxy Adventure to see results' },
];

export function ParentsPage() {
  const navigate = useNavigate();

  /* ── R2 images only — no fallback ── */
  const [heroImg, setHeroImg] = useState<string | null>(null);
  const [secondImg, setSecondImg] = useState<string | null>(null);

  useEffect(() => {
    const url = `${API}/rpg-assets`;
    console.log('[ParentsPage] Fetching RPG assets from:', url);
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
        console.log('[ParentsPage] Total assets:', assets.length);

        const lookup = new globalThis.Map<string, string>();
        for (const a of assets) {
          if (a.slug && a.publicUrl) {
            lookup.set(a.slug, a.publicUrl);
            lookup.set(a.slug.toLowerCase(), a.publicUrl);
          }
        }
        console.log('[ParentsPage] All slugs:', assets.map((a: any) => a.slug));

        const hero = lookup.get('kid_study') || lookup.get('kid-study');
        const second = lookup.get('parents-2') || lookup.get('parents_2');
        console.log('[ParentsPage] kid_study →', hero || 'NOT FOUND');
        console.log('[ParentsPage] parents-2 →', second || 'NOT FOUND');

        if (hero) setHeroImg(hero);
        if (second) setSecondImg(second);
      })
      .catch(err => {
        console.error('[ParentsPage] ❌ RPG assets fetch failed:', err);
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
                  For Parents
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-gray-950 tracking-tight leading-[1.15] mb-5">
                Replace brainrot<br />
                <span className="text-gray-400">with real learning.</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-md mb-4">
                Foxy Adventure turns screen time into KSSR-aligned learning through
                gamified RPG quests your child will actually beg to play.
              </p>

              <div className="flex items-center gap-3 mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg">
                  <span className="text-sm font-bold text-emerald-700">Only RM1/day</span>
                </div>
                <span className="text-sm text-gray-400">Free test · No credit card · Cancel anytime</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/t/demo')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
                >
                  <Play className="w-4 h-4" />
                  Take Free Readiness Test
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
                >
                  Sign Up Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Trust line */}
              <div className="flex items-center gap-6 mt-10">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-950">KSSR</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Aligned</div>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-950">3</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Languages</div>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-950">RM1</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Per Day</div>
                </div>
              </div>
            </motion.div>

            {/* Hero image — kid_study from R2 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-gray-200/60">
                {heroImg ? (
                  <ImageWithFallback
                    src={heroImg}
                    alt="Child studying with Foxy Adventure"
                    className="w-full h-[420px] object-cover"
                  />
                ) : (
                  <ImageSkeleton className="w-full h-[420px] rounded-2xl" />
                )}
                {heroImg && <div className="absolute inset-0 bg-gradient-to-t from-gray-950/20 to-transparent" />}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── BRAINROT PROBLEM SECTION ─── */}
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
              Screen time doesn't have to be wasted time
            </h2>
            <p className="text-sm text-gray-400 max-w-lg mx-auto">
              Most kids spend hours on content that adds nothing. Foxy Adventure gives that
              time back — every minute builds real skills mapped to Malaysia's KSSR curriculum.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {BRAINROT_STATS.map((item, i) => (
              <motion.div
                key={item.stat}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl sm:text-4xl font-bold text-white mb-2">{item.stat}</div>
                <p className="text-xs text-gray-500 leading-relaxed max-w-[200px] mx-auto">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
              How it works
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              From free test to daily learning — in three simple steps.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="group bg-white rounded-2xl border border-gray-200/80 p-6 hover:border-gray-300 hover:shadow-lg hover:shadow-gray-100/50 transition-all h-full flex flex-col">
                  <div className="text-[10px] font-mono font-bold text-gray-300 uppercase tracking-widest mb-4">
                    {step.num}
                  </div>
                  <h3 className="text-base font-semibold text-gray-950 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed flex-1 mb-5">{step.desc}</p>
                  <button
                    onClick={() => navigate(step.href)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-950 group-hover:gap-2.5 transition-all"
                  >
                    {step.action}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── VALUE PROPS (6 cards) ─── */}
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
              Why parents choose Foxy Adventure
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Purpose-built for Malaysian families who want more from screen time.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUE_PROPS.map((item, i) => {
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

      {/* ─── LEARN WHILE YOU PLAY IMAGE SECTION — parents-2 ─── */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-xl">
                {secondImg ? (
                  <ImageWithFallback
                    src={secondImg}
                    alt="Parents reviewing child's progress"
                    className="w-full h-[380px] object-cover"
                  />
                ) : (
                  <ImageSkeleton className="w-full h-[380px] rounded-2xl" />
                )}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-4">
                They think it's a game.<br />
                <span className="text-gray-400">You know it's education.</span>
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-sm">
                Foxy Adventure disguises rigorous KSSR assessments as dark-fantasy RPG quests.
                Children battle monsters, earn loot, and level up — while you get detailed
                mastery reports showing exactly which skills they've conquered and where they need help.
              </p>
              <div className="space-y-3">
                {[
                  'Covers all 6 KSSR tunjang development areas',
                  'Adaptive difficulty — meets your child where they are',
                  'BM, English & Mandarin language support',
                  'Spider-web mastery charts updated in real-time',
                  'Daily quests keep kids coming back (for the right reasons)',
                  'Only RM1 per day — cheaper than tuition',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── RM1/DAY CALLOUT ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-gray-50 rounded-2xl border border-gray-200/80 p-8 sm:p-10 text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full mb-4">
              <Heart className="w-3 h-3" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Affordable education</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
              Only <span className="text-emerald-600">RM1</span> per day
            </h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto mb-2">
              That's the price of a pack of Milo. Less than one hour of tuition.
              Less than the petrol to drive to enrichment class.
            </p>
            <p className="text-sm text-gray-400 max-w-lg mx-auto mb-6">
              Your child gets daily KSSR-aligned quests, trilingual assessments,
              real-time mastery tracking, and an RPG world that makes them WANT to learn.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Free readiness test</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> No contract</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Cancel anytime</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Works on phone & tablet</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FOUNDER Q&A ─── */}
      <FounderQA />

      {/* ─── FINAL CTA — Take a test or sign up ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full mb-6">
              <Sparkles className="w-3 h-3" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Free to try</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight mb-4">
              Start your child's adventure today
            </h2>
            <p className="text-base text-gray-400 max-w-md mx-auto mb-8">
              The free readiness test takes just 10 minutes. No account needed.
              See exactly where your child stands — then decide if you want to continue.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/t/demo')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
              >
                <Play className="w-4 h-4" />
                Take Free Readiness Test
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
              >
                Sign Up Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
