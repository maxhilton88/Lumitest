/**
 * HomePage.tsx — Main SaaS Landing Page
 * 
 * Route: /
 * Two audience paths: Parents + Kindergartens
 * Minimalist black & white aesthetic matching KGMapPage design DNA.
 * Includes sliding game mode video cards (instead of Founder Q&A).
 */
import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import {
  ArrowRight, Sparkles, BookOpen, BarChart3, Globe, Zap,
  Users, Shield, CheckCircle2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { VideoModeCarousel } from '../components/site/VideoModeCarousel';
import { useAppContext } from '../contexts/AppContext';
import { fetchRPGAssets, type RPGAsset } from '../utils/api';
import { ImageSkeleton } from '../components/ui/ImageSkeleton';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

const FEATURES = [
  {
    icon: BookOpen,
    title: 'KSSR-Aligned',
    desc: 'Assessments mapped to Malaysia\'s national curriculum standards across all tunjang.',
  },
  {
    icon: Globe,
    title: 'Trilingual',
    desc: 'Full support for Bahasa Melayu, English, and Mandarin.',
  },
  {
    icon: Zap,
    title: 'Gamified RPG',
    desc: 'Dark-fantasy quests that keep children engaged while measuring real competencies.',
  },
  {
    icon: BarChart3,
    title: 'Mastery Tracking',
    desc: 'Spider charts, skill breakdowns, and actionable recommendations for parents.',
  },
  {
    icon: Shield,
    title: 'PDPA Compliant',
    desc: 'Children\'s data encrypted and protected under Malaysian privacy law.',
  },
  {
    icon: Users,
    title: 'Ages 4-12',
    desc: 'From prasekolah readiness through primary school mastery.',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const { isParentAuthenticated } = useAppContext();

  // ── R2 site images (uploaded via RPG Asset Manager) ──
  const [heroImg, setHeroImg] = useState<string | null>(null);
  const [heroBgImg, setHeroBgImg] = useState<string | null>(null);
  const [heroCharImg, setHeroCharImg] = useState<string | null>(null);
  const [parentImg, setParentImg] = useState<string | null>(null);
  const [kgImg, setKgImg] = useState<string | null>(null);

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
        if (lookup.get('homepage_banner')) setHeroImg(lookup.get('homepage_banner')!);
        if (lookup.get('homepagebg')) setHeroBgImg(lookup.get('homepagebg')!);
        if (lookup.get('homepage-banne_object')) setHeroCharImg(lookup.get('homepage-banne_object')!);
        if (lookup.get('for_parents')) setParentImg(lookup.get('for_parents')!);
        if (lookup.get('for_kindergarten')) setKgImg(lookup.get('for_kindergarten')!);
      })
      .catch(err => {
        console.error('[HomePage] RPG assets fetch failed:', err);
      });
  }, []);

  // Auto-redirect signed-in parents straight to the realm
  if (isParentAuthenticated) {
    return <Navigate to="/realm" replace />;
  }

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
                  Malaysia's #1 KSSR Readiness Platform
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-gray-950 tracking-tight leading-[1.15] mb-5">
                Every child deserves<br />
                <span className="text-gray-400">to be school-ready.</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-md mb-8">
                Gamified KSSR assessments, trilingual support, and real-time mastery tracking
                — for parents and kindergartens across Malaysia.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/parents')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
                >
                  I'm a Parent
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate('/kindergarten')}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
                >
                  I'm a Kindergarten
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-6 mt-10">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-950">10,000+</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">KGs Listed</div>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-950">3</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">Languages</div>
                </div>
                <div className="w-px h-8 bg-gray-200" />
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-950">Free</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">To Start</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="relative"
            >
              {/* ── 2-Layer Parallax Hero ── */}
              <div className="relative w-full h-[280px] sm:h-[340px] lg:h-[420px]">
                {/* Background layer — shorter so character pops above it */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-[180px] sm:h-[220px] lg:h-[280px] rounded-2xl overflow-hidden shadow-2xl shadow-gray-200/60"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  {heroBgImg ? (
                    <ImageWithFallback
                      src={heroBgImg}
                      alt="Foxy Adventure background"
                      className="w-full h-full object-cover"
                    />
                  ) : heroImg ? (
                    <ImageWithFallback
                      src={heroImg}
                      alt="Parent and child learning together"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageSkeleton className="w-full h-full" />
                  )}
                </motion.div>

                {/* Character layer — floats above background */}
                {heroCharImg && (
                  <motion.div
                    className="absolute inset-0 flex items-end justify-center pointer-events-none z-10"
                    initial={{ opacity: 0, y: 40, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.5, type: 'spring', stiffness: 80, damping: 14 }}
                  >
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative -mb-2"
                      style={{ filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.3))' }}
                    >
                      <ImageWithFallback
                        src={heroCharImg}
                        alt="Foxy adventure character"
                        className="h-[240px] sm:h-[300px] lg:h-[380px] w-auto object-contain"
                      />
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── TWO AUDIENCE PATHS ─── */}
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
              Who is Project Lumi for?
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Two paths, one mission: ensuring every Malaysian child is school-ready.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Parents */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="group"
            >
              <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden hover:border-gray-300 hover:shadow-xl hover:shadow-gray-100/50 transition-all">
                <div className="h-48 overflow-hidden">
                  {parentImg ? (
                    <ImageWithFallback
                      src={parentImg}
                      alt="Child learning with educational games"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <ImageSkeleton className="w-full h-full" />
                  )}
                </div>
                <div className="p-6">
                  <div className="text-[10px] font-mono font-bold text-gray-300 uppercase tracking-widest mb-3">
                    FOR PARENTS
                  </div>
                  <h3 className="text-lg font-semibold text-gray-950 mb-2">
                    Track your child's readiness
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">
                    Take a free KSSR readiness assessment, get detailed mastery reports,
                    and watch your child grow through gamified learning adventures.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate('/parents')}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-950 text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors"
                    >
                      Take Free Test
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => navigate('/login')}
                      className="flex items-center gap-1.5 px-5 py-2.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-xl hover:border-gray-400 transition-colors"
                    >
                      Sign Up
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Kindergartens */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="group"
            >
              <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden hover:border-gray-300 hover:shadow-xl hover:shadow-gray-100/50 transition-all">
                <div className="h-48 overflow-hidden">
                  {kgImg ? (
                    <ImageWithFallback
                      src={kgImg}
                      alt="Kindergarten children in classroom"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <ImageSkeleton className="w-full h-full" />
                  )}
                </div>
                <div className="p-6">
                  <div className="text-[10px] font-mono font-bold text-gray-300 uppercase tracking-widest mb-3">
                    FOR KINDERGARTENS
                  </div>
                  <h3 className="text-lg font-semibold text-gray-950 mb-2">
                    Power your KG with data
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">
                    Claim your listing, offer branded KSSR assessments to parents,
                    lock your territory, and access real-time student readiness data.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate('/kindergarten')}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-950 text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors"
                    >
                      Become a Partner
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => navigate('/kg')}
                      className="flex items-center gap-1.5 px-5 py-2.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-xl hover:border-gray-400 transition-colors"
                    >
                      KG Login
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
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
              Why Project Lumi?
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Purpose-built for the Malaysian education system.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={feat.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="p-5 rounded-2xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all group"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gray-950 transition-colors">
                    <Icon className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-950 mb-1.5">{feat.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{feat.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── GAME MODE CAROUSEL ─── */}
      <VideoModeCarousel />

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
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight mb-4">
              Ready to start?
            </h2>
            <p className="text-base text-gray-400 max-w-md mx-auto mb-8">
              Take a free KSSR readiness assessment today — no account required.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
              >
                Parents Sign Up
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/kg-signup')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
              >
                Kindergarten Sign-up
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}