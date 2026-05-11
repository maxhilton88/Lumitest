/**
 * KGMapPage.tsx — KinderPartner Landing Page
 *
 * Route: /kinderpartner
 *
 * A premium, minimalist landing page that entices kindergarten owners to:
 *   1. Search the map for their KG and claim it
 *   2. Enter a claim code
 *   3. Register a new kindergarten
 *
 * Fully public — no login gate required.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { KGTerritoryMap } from '../components/kg/KGTerritoryMap';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import {
  LogOut, MapPin, Building2, ArrowRight, Search, Shield,
  Star, Users, BarChart3, Zap, ChevronDown, Lock, Globe,
  CheckCircle2, Sparkles, ArrowUpRight, X, KeyRound, Plus, Map as MapIcon,
  Smartphone, Clock, BrainCircuit, ShieldCheck,
} from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { motion } from 'motion/react';
import { FounderQA } from '../components/site/FounderQA';
import { ImageSkeleton } from '../components/ui/ImageSkeleton';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

interface AuthState {
  isAuthenticated: boolean;
  userId: string;
  email: string;
  schoolName: string;
  schoolId: string;
  linkedPgKgId: string;
  accessToken: string;
}

export function KGMapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);

  // ── R2 site images (uploaded via RPG Asset Manager) ──
  const [heroImg, setHeroImg] = useState<string | null>(null);
  const [kinder2Img, setKinder2Img] = useState<string | null>(null);

  useEffect(() => {
    // Direct raw fetch — bypass all caching layers to debug image loading
    const url = `${API}/rpg-assets`;
    console.log('[KGMapPage] Fetching RPG assets directly from:', url);
    fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    })
      .then(res => {
        console.log('[KGMapPage] Response status:', res.status, res.statusText);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log('[KGMapPage] Raw API response:', JSON.stringify(data).slice(0, 500));
        const assets: any[] = data?.assets || [];
        console.log('[KGMapPage] Total assets:', assets.length);

        // Build case-insensitive slug map for resilience
        const lookup = new Map<string, string>();
        for (const a of assets) {
          if (a.slug && a.publicUrl) {
            lookup.set(a.slug, a.publicUrl);
            lookup.set(a.slug.toLowerCase(), a.publicUrl); // also lowercase
          }
        }
        console.log('[KGMapPage] All slugs:', [...new Set(assets.map((a: any) => a.slug))]);

        // Try exact match first, then lowercase
        const heroUrl = lookup.get('kindergarten_heading') || lookup.get('kindergarten');
        const kinder2Url = lookup.get('kinder2') || lookup.get('Kinder2');
        console.log('[KGMapPage] kindergarten_heading →', heroUrl || 'NOT FOUND');
        console.log('[KGMapPage] kinder2 →', kinder2Url || 'NOT FOUND');

        if (heroUrl) {
          console.log('[KGMapPage] ✅ Setting heroImg to:', heroUrl);
          setHeroImg(heroUrl);
        } else {
          console.warn('[KGMapPage] ⚠️ kindergarten_heading slug not found in assets!');
        }
        if (kinder2Url) {
          console.log('[KGMapPage] ✅ Setting kinder2Img to:', kinder2Url);
          setKinder2Img(kinder2Url);
        } else {
          console.warn('[KGMapPage] ⚠️ kinder2 slug not found in assets!');
        }
      })
      .catch(err => {
        console.error('[KGMapPage] ❌ RPG assets fetch FAILED:', err);
      });
  }, []);

  const [auth, setAuth] = useState<AuthState>(() => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (token && (role === 'kindergarten' || role === 'superadmin')) {
      return {
        isAuthenticated: true,
        userId: localStorage.getItem('user_id') || '',
        email: localStorage.getItem('user_email') || '',
        schoolName: localStorage.getItem('school_name') || '',
        schoolId: localStorage.getItem('school_id') || '',
        linkedPgKgId: localStorage.getItem('school_linked_pg_kg_id') || '',
        accessToken: token,
      };
    }
    return {
      isAuthenticated: false, userId: '', email: '', schoolName: '',
      schoolId: '', linkedPgKgId: '', accessToken: '',
    };
  });

  const [lockLoading, setLockLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleLogout = () => {
    setAuth({
      isAuthenticated: false, userId: '', email: '', schoolName: '',
      schoolId: '', linkedPgKgId: '', accessToken: '',
    });
  };

  const handleLockTerritory = useCallback(async (kgId: string) => {
    if (!auth.accessToken) {
      toast.error('Please log in to lock territory.');
      return;
    }
    setLockLoading(true);
    try {
      const res = await fetch(`${API}/kg-db/lock-territory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${auth.accessToken}`,
        },
        body: JSON.stringify({ kindergarten_id: kgId, radius_km: 3 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.requires_upgrade) {
          toast.error('Territory lock requires an active subscription. Please upgrade from your dashboard.');
        } else {
          throw new Error(data.error || 'Lock failed');
        }
        return;
      }
      toast.success(data.message || 'Territory locked!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLockLoading(false);
    }
  }, [auth.accessToken]);

  const scrollToMap = () => {
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const FEATURES = [
    {
      icon: BarChart3,
      title: 'KSSR-Aligned Assessments',
      desc: 'Comprehensive readiness tests mapped to Malaysia\'s national curriculum standards.',
    },
    {
      icon: Globe,
      title: 'Trilingual Support',
      desc: 'Bahasa Melayu, English, and Mandarin — every child assessed in their language.',
    },
    {
      icon: Shield,
      title: 'Territory Protection',
      desc: 'Lock a 3km radius around your kindergarten. Exclusive visibility for parents nearby.',
    },
    {
      icon: Zap,
      title: 'Gamified Learning',
      desc: 'Dark-fantasy RPG quests that keep children engaged while measuring real competencies.',
    },
    {
      icon: Users,
      title: 'Parent Dashboard',
      desc: 'Parents get real-time progress reports with actionable insights and skill mastery tracking.',
    },
    {
      icon: Star,
      title: 'Free to Start',
      desc: 'Claim your listing at no cost. Upgrade anytime to unlock territory lock and premium features.',
    },
  ];

  const STEPS = [
    {
      num: '01',
      title: 'Find Your Kindergarten',
      desc: 'Search the interactive map below to locate your kindergarten listing.',
      action: 'Explore Map',
      onClick: scrollToMap,
    },
    {
      num: '02',
      title: 'Enter Claim Code',
      desc: 'Already have a code? Verify and claim your listing instantly.',
      action: 'Enter Code',
      onClick: () => navigate('/kg-signup'),
    },
    {
      num: '03',
      title: 'Register New KG',
      desc: 'Not listed? Register your kindergarten and we\'ll set you up.',
      action: 'Register Now',
      onClick: () => navigate('/kg-register'),
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/80 to-white pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: copy */}
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
                Your kindergarten,<br />
                <span className="text-gray-400">powered by data.</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-md mb-8">
                Claim your listing on KinderPartner and unlock gamified KSSR assessments, 
                trilingual support, and real-time parent reporting — all for free.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/kg-find')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
                >
                  <MapPin className="w-4 h-4" />
                  Find My Kindergarten
                </button>
                <button
                  onClick={() => navigate('/kg-signup')}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
                >
                  <Search className="w-4 h-4" />
                  I Have a Claim Code
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

            {/* Right: hero image */}
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
                    alt="Children learning in kindergarten"
                    className="w-full h-[420px] object-cover"
                  />
                ) : (
                  <ImageSkeleton className="w-full h-[420px]" />
                )}
              </div>
            </motion.div>
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
              Three ways to get started
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Whether you're already listed or brand new — we've made it effortless.
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
                    onClick={step.onClick}
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

      {/* ─── SOCIAL PROOF / IMAGES ─── */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="rounded-2xl overflow-hidden shadow-lg">
                {kinder2Img ? (
                  <ImageWithFallback
                    src={kinder2Img}
                    alt="Built for Malaysian kindergartens"
                    className="w-full h-[340px] object-cover"
                  />
                ) : (
                  <ImageSkeleton className="w-full h-[340px]" />
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
                Built for Malaysian<br />kindergartens
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-sm">
                Foxy Adventure is purpose-built for the Malaysian KSSR curriculum.
                Our gamified assessments cover all six tunjang — from language and literacy
                to socio-emotional development — in all three national languages.
              </p>
              <div className="space-y-3">
                {[
                  'Covers all 6 KSSR tunjang development areas',
                  'Available in BM, English & Mandarin',
                  'Automatic parent progress reports',
                  'Territory protection for partner kindergartens',
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

      {/* ─── INTERACTIVE MAP ─── */}
      <section ref={mapRef} className="border-t border-gray-100 scroll-mt-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6"
          >
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-2">
                Explore the map
              </h2>
              <p className="text-sm text-gray-400">
                Find your kindergarten, click it, and claim your listing.
              </p>
            </div>
            <button
              onClick={() => navigate('/kg-register')}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:border-gray-400 hover:text-gray-900 transition-all shrink-0"
            >
              <Building2 className="w-3.5 h-3.5" />
              Not listed? Register here
            </button>
          </motion.div>
        </div>

        {/* Full-bleed map */}
        <div className="border-t border-b border-gray-200" style={{ height: 560 }}>
          <KGTerritoryMap
            mode={auth.isAuthenticated ? 'dashboard' : 'embed'}
            highlightKgId={auth.linkedPgKgId}
            onLockTerritory={auth.isAuthenticated ? handleLockTerritory : undefined}
            className="h-full"
          />
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
              Why kindergartens love KinderPartner
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Everything you need to run world-class early childhood assessments.
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

      {/* ─── SCREEN TIME REIMAGINED ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full mb-4">
              <Smartphone className="w-3 h-3" />
              <span className="text-[11px] font-medium uppercase tracking-wider">
                After-Class Learning
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
              Not for the classroom.<br />
              <span className="text-gray-400">For after school.</span>
            </h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
              Foxy Adventure isn't designed to replace classroom teaching — it's built for <strong className="text-gray-950">after-school screen time</strong>.
              If parents are already giving their kids a phone, why not turn that screen time into something that actually builds real skills?
            </p>
          </motion.div>

          {/* The reality callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-3xl mx-auto mb-12"
          >
            <div className="relative bg-gray-950 rounded-2xl p-6 sm:p-8 text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <p className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest mb-3">
                  The Reality
                </p>
                <p className="text-base sm:text-lg font-medium leading-relaxed mb-4">
                  "Children are already spending 2–4 hours daily on screens after school. 
                  The question isn't <em>whether</em> they'll use devices — it's <em>what</em> they'll do on them."
                </p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Instead of mindless scrolling, short-form video loops, and addictive mobile games that offer zero educational value, 
                  Foxy Adventure channels that screen time into KSSR-aligned learning — disguised as a game they actually <em>want</em> to play.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Before vs After */}
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto mb-12">
            {/* Before */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="bg-red-50/60 border border-red-100 rounded-2xl p-6"
            >
              <div className="text-[10px] font-mono font-bold text-red-300 uppercase tracking-widest mb-4">
                Without Foxy
              </div>
              <div className="space-y-3">
                {[
                  'Endless YouTube & TikTok loops',
                  'Addictive mobile games with zero learning',
                  'No parental insight into screen habits',
                  'Wasted hours → "brain rot"',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-700/80">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* After */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-6"
            >
              <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest mb-4">
                With Foxy Adventure
              </div>
              <div className="space-y-3">
                {[
                  'KSSR-aligned quests in BM, EN & ZH',
                  'Gamified RPG that builds real skills',
                  'Parents see mastery reports in real-time',
                  'Productive screen time → school readiness',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-emerald-800/80">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Key points for KG owners */}
          <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                icon: Clock,
                title: 'After-School Only',
                desc: 'Designed as extra-curricular homework — not a replacement for classroom teaching.',
              },
              {
                icon: ShieldCheck,
                title: 'Prevent Brain Rot',
                desc: 'Transforms passive screen time into active, curriculum-aligned learning adventures.',
              },
              {
                icon: BrainCircuit,
                title: 'Extend Your Impact',
                desc: 'Your curriculum continues at home. Parents see your KG as the one that truly cares about readiness.',
              },
            ].map((point, i) => {
              const Icon = point.icon;
              return (
                <motion.div
                  key={point.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="text-center p-5"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-gray-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-950 mb-1.5">{point.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{point.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── FOUNDER Q&A ─── */}
      <FounderQA />

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
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full mb-6">
              <Sparkles className="w-3 h-3" />
              <span className="text-[11px] font-medium uppercase tracking-wider">100% Free to claim</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight mb-4">
              Ready to partner with us?
            </h2>
            <p className="text-base text-gray-400 max-w-md mx-auto mb-8">
              Join thousands of Malaysian kindergartens already using
              Foxy Adventure to track child readiness.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={scrollToMap}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
              >
                <MapPin className="w-4 h-4" />
                Find My Kindergarten
              </button>
              <button
                onClick={() => navigate('/kg-register')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
              >
                Register New KG
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── GET STARTED MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-[90%] max-w-md bg-white rounded-2xl shadow-2xl shadow-gray-950/10 p-6"
          >
            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-950 tracking-tight">How would you like to get started?</h2>
              <p className="text-xs text-gray-400 mt-1">Choose the option that best describes you.</p>
            </div>

            <div className="space-y-2.5">
              {/* Option 1: Find my listing */}
              <button
                onClick={() => { setShowModal(false); navigate('/kg-find'); }}
                className="w-full text-left group p-4 border border-gray-200 rounded-xl hover:border-gray-950 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gray-950 transition-colors">
                    <MapIcon className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-950">Find My Listing</p>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-950 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Search by name, postcode, or address on the map.
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 2: I have a code */}
              <button
                onClick={() => { setShowModal(false); navigate('/kg-signup'); }}
                className="w-full text-left group p-4 border border-gray-200 rounded-xl hover:border-gray-950 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gray-950 transition-colors">
                    <KeyRound className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-950">I Have a Claim Code</p>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-950 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Enter your code to verify and claim your existing listing.
                    </p>
                  </div>
                </div>
              </button>

              {/* Option 3: Register new */}
              <button
                onClick={() => { setShowModal(false); navigate('/kg-register'); }}
                className="w-full text-left group p-4 border border-gray-200 rounded-xl hover:border-gray-950 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-gray-950 transition-colors">
                    <Plus className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-950">Register New Kindergarten</p>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-950 transition-colors" />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Can't find your listing and don't have a code? Sign up here.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-[11px] text-gray-300">
                Already have an account?{' '}
                <button onClick={() => { setShowModal(false); navigate('/kg'); }} className="text-gray-500 hover:text-gray-950 underline underline-offset-2 transition-colors">
                  Sign in
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default KGMapPage;