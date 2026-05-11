/**
 * FMCGPage.tsx — FMCG Brand Partnership Landing Page
 *
 * Route: /fmcg (public marketing page inside SiteLayout)
 *
 * Explains the QR-on-packaging collaboration model to potential FMCG partners.
 * CTA: "Partner Login" → /partner-portal, "Get Started" → contact
 */
import React from 'react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  QrCode, BarChart3, Users, Gift, ArrowRight, Sparkles,
  ShieldCheck, TrendingUp, Package, Globe, Zap,
  Building2, Baby, Target, Megaphone, PieChart, LogIn,
} from 'lucide-react';
import { fetchRPGAssets, type RPGAsset } from '../utils/api';
import { ImageSkeleton } from '../components/ui/ImageSkeleton';

/* ── Hero stats ── */
const HERO_STATS = [
  { value: '50K+', label: 'Active families', icon: Users },
  { value: '97%', label: 'Scan-to-claim rate', icon: TrendingUp },
  { value: '3 languages', label: 'EN · BM · ZH', icon: Globe },
];

/* ── How it works steps ── */
const STEPS = [
  {
    step: '01',
    title: 'Print QR on Packaging',
    desc: 'We generate unique QR codes for your product batch. Each code is single-use and traceable.',
    icon: QrCode,
    color: '#2563eb',
  },
  {
    step: '02',
    title: 'Customer Scans & Claims',
    desc: 'Parents scan after purchase. They log in to Foxy Adventure and instantly receive in-game rewards.',
    icon: Gift,
    color: '#16a34a',
  },
  {
    step: '03',
    title: 'Brand Gets Analytics',
    desc: 'Real-time dashboard: daily claims, regional heatmaps, age demographics, redemption rates.',
    icon: BarChart3,
    color: '#d97706',
  },
];

/* ── Benefits for brands ── */
const BENEFITS = [
  {
    icon: Target,
    title: 'Reach Young Families',
    desc: 'Direct access to parents of 4–12 year olds — the hardest demographic to reach digitally.',
  },
  {
    icon: Baby,
    title: 'Positive Brand Association',
    desc: 'Your brand becomes part of a child\'s learning journey. Education + rewards = lasting loyalty.',
  },
  {
    icon: PieChart,
    title: 'First-Party Data',
    desc: 'Understand your buyers: age groups, regions, scan times, repeat engagement — all privacy-compliant.',
  },
  {
    icon: Megaphone,
    title: 'Zero Waste Marketing',
    desc: 'Every QR is on a product already purchased. No ad spend wasted on non-buyers.',
  },
  {
    icon: ShieldCheck,
    title: 'Anti-Counterfeit',
    desc: 'Single-use codes double as product authenticity verification. Scanned = genuine.',
  },
  {
    icon: Zap,
    title: 'Launch in 48 Hours',
    desc: 'From brief to live campaign in 2 days. We handle code generation, reward logic, and analytics.',
  },
];

/* ── RPG asset slugs for reward icons ── */
const REWARD_SLUGS = {
  gold: 'game-coin',
  diamond: 'game-diamond',
  bag: 'realm_bag',
  equipment: 'realm_shield',
  potion: 'realm-potion',
  premium: 'realm-premium',
} as const;

/* ── Reward types brands can offer ── */
const REWARD_TYPES = [
  { slug: REWARD_SLUGS.gold, label: 'Gold Coins', desc: 'In-game currency', fallbackEmoji: '🪙' },
  { slug: REWARD_SLUGS.diamond, label: 'Diamonds', desc: 'Premium currency', fallbackEmoji: '💎' },
  { slug: REWARD_SLUGS.bag, label: 'Bag Slots', desc: 'Inventory expansion', fallbackEmoji: '🎒' },
  { slug: REWARD_SLUGS.equipment, label: 'Branded Equipment', desc: 'Exclusive FMCG items', fallbackEmoji: '⚔️' },
  { slug: REWARD_SLUGS.potion, label: 'Potions', desc: 'XP & energy boosts', fallbackEmoji: '🧪' },
  { slug: REWARD_SLUGS.premium, label: 'Premium Days', desc: 'Unlock full access', fallbackEmoji: '👑' },
];

export function FMCGPage() {
  const navigate = useNavigate();
  const [assetMap, setAssetMap] = useState<Record<string, string>>({});
  const [assetsLoading, setAssetsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchRPGAssets();
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const a of result.assets || []) {
          map[a.slug] = a.publicUrl;
        }
        console.log('[FMCG] Asset map loaded:', Object.keys(map).join(', '));
        console.log('[FMCG] Reward slugs needed:', Object.values(REWARD_SLUGS).join(', '));
        setAssetMap(map);
      } catch (err) {
        console.error('[FMCG] Failed to load RPG assets:', err);
      } finally {
        if (!cancelled) setAssetsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800" />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur rounded-full mb-6">
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium text-white/80">FMCG Brand Partnerships</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
              Turn Every Product Into a<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                Family Engagement Touchpoint
              </span>
            </h1>

            <p className="text-base sm:text-lg text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Print unique QR codes on your FMCG packaging. Parents scan, kids get in-game rewards,
              and your brand gets real-time first-party analytics. Everybody wins.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/contact"
                className="flex items-center gap-2 px-6 py-3 bg-white text-gray-950 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors shadow-lg"
              >
                <Building2 className="w-4 h-4" />
                Become a Partner
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/partner-portal"
                className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur text-white rounded-xl text-sm font-medium hover:bg-white/20 transition-colors border border-white/10"
              >
                <LogIn className="w-4 h-4" />
                Partner Login
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex justify-center gap-6 sm:gap-12 mt-16"
          >
            {HERO_STATS.map((s) => (
              <div key={s.label} className="text-center">
                <s.icon className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl sm:text-3xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 mb-3">How It Works</h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              Three simple steps from packaging to actionable consumer insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${step.color}12` }}>
                    <step.icon className="w-5 h-5" style={{ color: step.color }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-300 tracking-widest">STEP {step.step}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>

                {/* Connector arrow on desktop */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-5 h-5 text-gray-200" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ REWARD TYPES ═══════════ */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-950 mb-2">What Your Customers Get</h2>
            <p className="text-sm text-gray-500">Configure any combination of in-game rewards per campaign.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {REWARD_TYPES.map((r) => (
              <div key={r.label}
                className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="flex items-center justify-center mb-2 h-12">
                  {assetsLoading ? (
                    <ImageSkeleton className="w-10 h-10 rounded-lg" />
                  ) : assetMap[r.slug] ? (
                    <img
                      src={assetMap[r.slug]}
                      alt={r.label}
                      className="w-10 h-10 object-contain drop-shadow-sm"
                      onError={(e) => {
                        // If R2 image fails, swap to emoji fallback
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = document.createElement('span');
                        fallback.className = 'text-3xl';
                        fallback.textContent = r.fallbackEmoji;
                        target.parentElement?.appendChild(fallback);
                      }}
                    />
                  ) : (
                    <span className="text-3xl">{r.fallbackEmoji}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ BENEFITS ═══════════ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 mb-3">Why Brands Choose Foxy Adventure</h2>
            <p className="text-sm text-gray-500 max-w-lg mx-auto">
              The only platform that turns FMCG packaging into a measurable family engagement channel.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl p-5 border border-gray-100"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-950 flex items-center justify-center mb-3">
                  <b.icon className="w-4.5 h-4.5 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{b.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PARTNER DASHBOARD PREVIEW ═══════════ */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="bg-gray-950 rounded-2xl p-8 sm:p-12 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mb-4">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-white/70">Partner Portal</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
              Real-Time Campaign Analytics
            </h2>
            <p className="text-sm text-gray-400 mb-6 max-w-lg mx-auto">
              Track daily redemptions, hourly patterns, regional breakdown, and age demographics —
              all in a clean, read-only dashboard. No setup required.
            </p>

            {/* Mock dashboard preview */}
            <div className="bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10 max-w-lg mx-auto mb-8">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Total Scans', value: '12,847' },
                  { label: 'Redemption', value: '94.2%' },
                  { label: 'New Signups', value: '3,291' },
                ].map((m) => (
                  <div key={m.label} className="bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 mb-0.5">{m.label}</p>
                    <p className="text-lg font-bold text-white">{m.value}</p>
                  </div>
                ))}
              </div>
              {/* Mini bar chart mockup */}
              <div className="flex items-end gap-1 h-16 justify-center">
                {[40, 65, 55, 80, 70, 90, 85, 75, 95, 60, 50, 88].map((h, i) => (
                  <div
                    key={i}
                    className="w-4 rounded-t-sm bg-gradient-to-t from-amber-500 to-amber-400 opacity-80"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <p className="text-[10px] text-gray-600 mt-2">Daily claims — last 12 days</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/partner-portal"
                className="flex items-center gap-2 px-6 py-3 bg-white text-gray-950 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Partner Login
              </Link>
              <Link
                to="/contact"
                className="flex items-center gap-2 px-5 py-3 text-white/80 text-sm font-medium hover:text-white transition-colors"
              >
                Request a Demo
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ BRANDS / USE CASES ═══════════ */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-lg font-bold text-gray-950 mb-2">Perfect For</h2>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {[
              'Milk & Dairy', 'Snacks & Biscuits', 'Beverages', 'Cereal & Breakfast',
              'Baby Food', 'Stationery', 'Children\'s Vitamins', 'Packaged Rice',
            ].map((cat) => (
              <span key={cat}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 font-medium">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Sparkles className="w-8 h-8 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 mb-3">
            Ready to Engage 50,000+ Families?
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Launch your first QR campaign in 48 hours. No app download required for parents — it's all web-based.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/contact"
              className="flex items-center gap-2 px-6 py-3 bg-gray-950 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors"
            >
              <Building2 className="w-4 h-4" />
              Contact Our Team
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/partner-portal"
              className="flex items-center gap-2 px-5 py-3 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Existing Partner? Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}