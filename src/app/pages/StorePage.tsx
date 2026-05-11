/**
 * StorePage.tsx — Public Pricing & Plans Page
 *
 * Public route: /store
 * No auth required — accessible by Stripe reviewers and visitors.
 * Displays Free, Plan A, and Plan B pricing tiers.
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { Crown, Check, Sparkles, Zap, Shield, BookOpen, Video, BarChart3, Users, ArrowRight, Star } from 'lucide-react';
import { FantasyBackground, FantasyPanel, FantasyTitle, GoldOrnament, FantasyFooter } from '../components/FantasyBackground';
import questMapBg from 'figma:asset/9cb2ea9cdf18b02a3a8d26e99ab2e65f990879b0.png';
import foxyToyImage from 'figma:asset/090998e64822fcc5724f27cbd25c8d9c71bd2ea7.png';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const LEGENDARY_ORANGE = '#e8722a';
const CINZEL = "'Cinzel Decorative', serif";

export function StorePage() {
  const navigate = useNavigate();

  const handleGetStarted = () => navigate('/login');
  const handleSubscribe = () => navigate('/plan');

  return (
    <div className="min-h-screen relative">
      <FantasyBackground bgImage={questMapBg} overlayOpacity={0.8} />

      {/* Google font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-16">

        {/* ── Hero ── */}
        <div className="text-center mb-10 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: GOLD }} />
            <span className="text-xs font-bold tracking-wider uppercase" style={{ color: GOLD, fontFamily: CINZEL }}>
              Malaysia's #1 KSSR Readiness App
            </span>
          </div>

          <FantasyTitle size="lg">Foxy Adventure</FantasyTitle>

          <p className="mt-4 text-sm md:text-base max-w-2xl mx-auto leading-relaxed" style={{ color: `${PARCHMENT}90` }}>
            A gamified dark-fantasy RPG assessment for children ages 4-7.
            Discover your child's school readiness through enchanted quests — aligned to Malaysia's KSSR curriculum.
          </p>

          <GoldOrnament className="mt-6" />
        </div>

        {/* ── What's Included (all plans) ── */}
        <div className="mb-10 md:mb-14">
          <h2 className="text-center text-sm md:text-base font-bold tracking-wider uppercase mb-6"
            style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
            How It Works
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { icon: BookOpen, label: 'KSSR-Aligned Quests', desc: 'English, BM, Math, Mandarin modules' },
              { icon: BarChart3, label: 'Detailed Reports', desc: 'Per-subject mastery & recommendations' },
              { icon: Video, label: 'Video Library', desc: 'Educational content across 8 categories' },
              { icon: Users, label: 'Multi-Language', desc: 'English, Bahasa Malaysia & Chinese' },
            ].map((item, i) => (
              <FantasyPanel key={i} className="p-4 text-center">
                <item.icon className="w-6 h-6 mx-auto mb-2" style={{ color: GOLD }} />
                <p className="text-[11px] md:text-xs font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                  {item.label}
                </p>
                <p className="text-[10px] mt-1 leading-relaxed" style={{ color: `${PARCHMENT}70` }}>
                  {item.desc}
                </p>
              </FantasyPanel>
            ))}
          </div>
        </div>

        {/* ── Pricing Cards ── */}
        <h2 className="text-center text-sm md:text-base font-bold tracking-wider uppercase mb-8"
          style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
          Choose Your Plan
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-10 md:mb-14">

          {/* FREE TIER */}
          <FantasyPanel className="p-5 md:p-6 relative">
            <div
              className="absolute -top-3 left-4 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1"
              style={{ background: `${GOLD}30`, color: GOLD, border: `1px solid ${GOLD}40` }}
            >
              <Shield className="w-3 h-3" />
              FREE FOREVER
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                Free Tier
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>
                Try the adventure at no cost
              </p>
            </div>

            <div className="flex items-end gap-1 mt-4 mb-1">
              <span className="text-xs" style={{ color: `${PARCHMENT}75` }}>RM</span>
              <span className="text-3xl font-bold leading-none" style={{ fontFamily: CINZEL, color: '#fff', textShadow: `0 0 15px ${GOLD}30` }}>
                0
              </span>
              <span className="text-xs pb-1" style={{ color: `${PARCHMENT}75` }}>/forever</span>
            </div>

            <ul className="space-y-2 mt-5 mb-6">
              {[
                '1 free assessment per child',
                'Basic readiness report',
                'Spider-web mastery chart',
                'Free video content',
                'Shareable report link',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#7cc643' }} />
                  <span className="text-xs" style={{ color: `${PARCHMENT}80` }}>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleGetStarted}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                fontFamily: CINZEL,
                background: `${GOLD}20`,
                color: GOLD,
                border: `2px solid ${GOLD}40`,
              }}
            >
              Get Started Free
            </button>
          </FantasyPanel>

          {/* PLAN A — Digital */}
          <FantasyPanel className="p-5 md:p-6 relative">
            <div
              className="absolute -top-3 left-4 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1"
              style={{ background: `${GOLD}30`, color: GOLD, border: `1px solid ${GOLD}40` }}
            >
              DIGITAL
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                Plan A
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>
                Full digital access for one year
              </p>
            </div>

            <div className="flex items-end gap-1 mt-4 mb-1">
              <span className="text-xs" style={{ color: `${PARCHMENT}75` }}>RM</span>
              <span className="text-3xl font-bold leading-none" style={{ fontFamily: CINZEL, color: '#fff', textShadow: `0 0 15px ${GOLD}30` }}>
                365
              </span>
              <span className="text-xs pb-1" style={{ color: `${PARCHMENT}75` }}>/year</span>
            </div>

            <ul className="space-y-2 mt-5 mb-6">
              {[
                'Unlimited assessments',
                'Unlimited premium video library',
                'Full progress tracking',
                'Practice mode',
                'Priority support',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#7cc643' }} />
                  <span className="text-xs" style={{ color: `${PARCHMENT}80` }}>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleSubscribe}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                fontFamily: CINZEL,
                background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                color: '#2a1f0e',
                border: `2px solid ${GOLD_LIGHT}`,
                boxShadow: `0 4px 0 #a67c2e, 0 0 20px ${GOLD}30`,
                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              Subscribe Now
            </button>
          </FantasyPanel>

          {/* PLAN B — Best Value Bundle */}
          <FantasyPanel className="p-5 md:p-6 relative" gold>
            {/* Best Value badge */}
            <div
              className="absolute -top-3 left-4 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #ffd700)`, color: '#2a1f0e', border: `1px solid #ffd700` }}
            >
              <Crown className="w-3 h-3" />
              BEST VALUE
            </div>

            <div className="mt-4">
              <h3 className="text-lg font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                Plan B
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>
                Digital + FOXY-o1 AI Companion Toy
              </p>
            </div>

            {/* Price — full price, no promo */}
            <div className="mt-4 mb-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs" style={{ color: `${PARCHMENT}75` }}>RM</span>
                <span className="text-3xl font-bold leading-none" style={{
                  fontFamily: CINZEL, color: LEGENDARY_ORANGE,
                  textShadow: `0 0 15px ${LEGENDARY_ORANGE}30`,
                }}>
                  730
                </span>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{
                  background: `linear-gradient(135deg, ${GOLD}, #f0d078)`,
                  color: '#2a1f0e',
                  boxShadow: `0 0 10px ${GOLD}40`,
                }}>
                  ~ RM2/day
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: `${PARCHMENT}60` }}>
                RM365/year digital + RM365 one-time AI toy
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}50` }}>
                Renews at RM365/year (toy is yours to keep)
              </p>
            </div>

            <ul className="space-y-2 mt-5 mb-4">
              {[
                'Everything in Plan A',
                'FOXY-o1 AI Companion Toy',
                'Free shipping within Malaysia',
                'Voice-interactive learning companion',
                'Exclusive toy-holder content',
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
                  <span className="text-xs" style={{ color: `${PARCHMENT}80` }}>{f}</span>
                </li>
              ))}
            </ul>

            {/* Toy preview */}
            <div className="flex items-center gap-3 p-3 rounded-lg mb-5" style={{
              background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}12, ${LEGENDARY_ORANGE}06)`,
              border: `1px solid ${LEGENDARY_ORANGE}25`,
            }}>
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{
                background: 'linear-gradient(135deg, #fff5eb, #ffe8d5)',
                border: `1.5px solid ${LEGENDARY_ORANGE}30`,
              }}>
                <img src={foxyToyImage} alt="FOXY-o1 AI Toy" className="w-full h-full object-contain p-0.5" />
              </div>
              <div>
                <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: GOLD_LIGHT }}>
                  <Zap className="w-3 h-3" style={{ color: LEGENDARY_ORANGE }} />
                  FOXY-o1 AI Companion
                </p>
                <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: `${PARCHMENT}70` }}>
                  Physical AI toy that guides your child through learning adventures
                </p>
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                fontFamily: CINZEL,
                background: `linear-gradient(135deg, #ffd700 0%, ${GOLD} 100%)`,
                color: '#2a1f0e',
                border: `2px solid ${GOLD_LIGHT}`,
                boxShadow: `0 4px 0 #a67c2e, 0 0 20px ${GOLD}30`,
                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              Get Plan B
            </button>
          </FantasyPanel>
        </div>

        {/* ── Comparison Table ── */}
        <FantasyPanel className="p-5 md:p-6 mb-10 md:mb-14 overflow-x-auto">
          <h3 className="text-sm font-bold mb-4" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
            Feature Comparison
          </h3>
          <table className="w-full text-[11px] md:text-xs" style={{ color: `${PARCHMENT}80` }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${GOLD}20` }}>
                <th className="text-left py-2 pr-4 font-bold" style={{ color: GOLD_LIGHT }}>Feature</th>
                <th className="text-center py-2 px-3 font-bold" style={{ color: `${PARCHMENT}90` }}>Free</th>
                <th className="text-center py-2 px-3 font-bold" style={{ color: GOLD }}>Plan A</th>
                <th className="text-center py-2 px-3 font-bold" style={{ color: LEGENDARY_ORANGE }}>Plan B</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Assessments', '1 per child', 'Unlimited', 'Unlimited'],
                ['Report Detail', 'Basic summary', 'Full breakdown', 'Full breakdown'],
                ['Video Library', 'Free content only', 'All premium videos', 'All premium videos'],
                ['Practice Mode', '-', 'Included', 'Included'],
                ['Progress Tracking', '-', 'Full history', 'Full history'],
                ['Priority Support', '-', 'Included', 'Included'],
                ['FOXY-o1 AI Toy', '-', '-', 'Included'],
                ['Free Shipping (MY)', '-', '-', 'Included'],
                ['Voice Learning', '-', '-', 'Included'],
                ['Price', 'RM 0', 'RM 365/year', 'RM 730 (renews RM365/yr)'],
              ].map(([feature, free, planA, planB], i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${GOLD}10` }}>
                  <td className="py-2.5 pr-4 font-medium">{feature}</td>
                  <td className="text-center py-2.5 px-3">{free === '-' ? <span style={{ color: `${PARCHMENT}30` }}>-</span> : free}</td>
                  <td className="text-center py-2.5 px-3">{planA === '-' ? <span style={{ color: `${PARCHMENT}30` }}>-</span> : planA}</td>
                  <td className="text-center py-2.5 px-3 font-bold" style={{ color: planB !== '-' ? `${PARCHMENT}` : `${PARCHMENT}30` }}>{planB === '-' ? '-' : planB}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FantasyPanel>

        {/* ── FAQ ── */}
        <div className="mb-10 md:mb-14">
          <h2 className="text-center text-sm md:text-base font-bold tracking-wider uppercase mb-6"
            style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                q: 'What age group is Foxy Adventure for?',
                a: 'Foxy Adventure is designed for children aged 4-7 years, aligned with Malaysia\'s KSSR (Kurikulum Standard Sekolah Rendah) curriculum readiness benchmarks.',
              },
              {
                q: 'How does the assessment work?',
                a: 'Your child embarks on a gamified RPG quest, answering age-appropriate multiple-choice questions across English, Bahasa Malaysia, Mathematics, and optional Mandarin modules.',
              },
              {
                q: 'Is my child\'s data safe?',
                a: 'Absolutely. We comply with Malaysia\'s PDPA (Personal Data Protection Act 2010). All data is encrypted and stored securely. See our Privacy Policy for details.',
              },
              {
                q: 'Can I cancel my subscription?',
                a: 'Yes. You can cancel anytime through the Stripe customer portal accessible from your account. No questions asked — you\'ll retain access until the end of your billing period.',
              },
              {
                q: 'What is the FOXY-o1 toy?',
                a: 'FOXY-o1 is a physical AI companion toy that ships with Plan B. It provides voice-interactive learning sessions and exclusive content for your child.',
              },
              {
                q: 'Do you ship outside Malaysia?',
                a: 'Currently, free shipping for the FOXY-o1 toy is available within Peninsular and East Malaysia. International shipping is available at additional cost — contact us for details.',
              },
            ].map((faq, i) => (
              <FantasyPanel key={i} className="p-4">
                <p className="text-xs font-bold mb-1.5" style={{ color: GOLD_LIGHT }}>{faq.q}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: `${PARCHMENT}75` }}>{faq.a}</p>
              </FantasyPanel>
            ))}
          </div>
        </div>

        {/* ── CTA Banner ── */}
        <FantasyPanel className="p-6 md:p-8 text-center mb-10" gold>
          <Star className="w-8 h-8 mx-auto mb-3" style={{ color: GOLD }} />
          <h3 className="text-lg md:text-xl font-bold mb-2" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
            Ready to Begin the Adventure?
          </h3>
          <p className="text-xs md:text-sm mb-5 max-w-lg mx-auto" style={{ color: `${PARCHMENT}80` }}>
            Start with a free assessment and discover your child's school readiness today.
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              fontFamily: CINZEL,
              background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
              color: '#2a1f0e',
              border: `2px solid ${GOLD_LIGHT}`,
              boxShadow: `0 4px 0 #a67c2e, 0 0 20px ${GOLD}30`,
              textShadow: '0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            Start Free Assessment
            <ArrowRight className="w-4 h-4" />
          </button>
        </FantasyPanel>

        {/* ── Business Info (for Stripe) ── */}
        <div className="text-center mb-8">
          <p className="text-[11px]" style={{ color: `${PARCHMENT}50` }}>
            Foxy Adventure is a product of <strong style={{ color: `${PARCHMENT}70` }}>Project Lumi</strong>.
            Registered in Malaysia. All prices are in Malaysian Ringgit (MYR).
          </p>
          <p className="text-[10px] mt-1" style={{ color: `${PARCHMENT}40` }}>
            Payments are securely processed by <strong>Stripe</strong>. We do not store your card details.
          </p>
          <p className="text-[10px] mt-1" style={{ color: `${PARCHMENT}40` }}>
            Contact: support@projectlumi.org
          </p>
        </div>

        <FantasyFooter />
      </div>
    </div>
  );
}