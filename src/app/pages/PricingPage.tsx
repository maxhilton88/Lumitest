/**
 * PricingPage.tsx — Public Pricing & Plans (Black & White Design)
 * 
 * Route: /pricing
 * Minimalist design matching the site aesthetic.
 * Data pulled from existing StorePage tiers.
 */
import React from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight, Check, Sparkles, Shield, Crown, Zap, Star,
} from 'lucide-react';
import { motion } from 'motion/react';
import foxyToyImage from 'figma:asset/090998e64822fcc5724f27cbd25c8d9c71bd2ea7.png';

const FAQ = [
  {
    q: 'What age group is Foxy Adventure for?',
    a: 'Designed for children aged 4-12, aligned with Malaysia\'s KSSR curriculum readiness benchmarks.',
  },
  {
    q: 'How does the assessment work?',
    a: 'Your child embarks on a gamified RPG quest, answering age-appropriate questions across English, BM, Math, and optional Mandarin.',
  },
  {
    q: 'Is my child\'s data safe?',
    a: 'We comply with Malaysia\'s PDPA. All data is encrypted and stored securely. See our Privacy Policy for details.',
  },
  {
    q: 'Can I cancel my subscription?',
    a: 'Yes, anytime through the Stripe customer portal. You retain access until the end of your billing period.',
  },
  {
    q: 'What is the FOXY-o1 toy?',
    a: 'A physical AI companion that provides voice-interactive learning in BM, English, and Mandarin. Ships free within Malaysia with Plan B.',
  },
  {
    q: 'Do you ship outside Malaysia?',
    a: 'Free shipping within Malaysia. International shipping is available at additional cost — contact us for details.',
  },
];

const COMPARISON = [
  ['Assessments', '1 per child', 'Unlimited', 'Unlimited'],
  ['Report Detail', 'Basic summary', 'Full breakdown', 'Full breakdown'],
  ['Video Library', 'Free content only', 'All premium', 'All premium'],
  ['Practice Mode', '-', 'Included', 'Included'],
  ['Progress Tracking', '-', 'Full history', 'Full history'],
  ['Priority Support', '-', 'Included', 'Included'],
  ['FOXY-o1 AI Toy', '-', '-', 'Included'],
  ['Free Shipping (MY)', '-', '-', 'Included'],
  ['Voice Learning', '-', '-', 'Included'],
  ['Price', 'RM 0', 'RM 365/year', 'RM 730 1st year'],
];

export function PricingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/80 to-white pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 sm:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-6">
              <Sparkles className="w-3 h-3 text-gray-500" />
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                Pricing
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight leading-[1.15] mb-5">
              Simple, transparent<br />
              <span className="text-gray-400">pricing.</span>
            </h1>

            <p className="text-base text-gray-500 leading-relaxed">
              Start free. Upgrade when you're ready.
              All prices in Malaysian Ringgit (MYR).
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── PRICING CARDS ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid md:grid-cols-3 gap-5">

            {/* FREE */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-gray-200/80 p-6 hover:border-gray-300 hover:shadow-lg transition-all relative"
            >
              <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                FREE FOREVER
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-gray-950">Free</h3>
                <p className="text-xs text-gray-400 mt-0.5">Try the adventure at no cost</p>
              </div>

              <div className="flex items-end gap-1 mt-5 mb-1">
                <span className="text-xs text-gray-400">RM</span>
                <span className="text-4xl font-bold text-gray-950 leading-none">0</span>
                <span className="text-xs text-gray-400 pb-1">/forever</span>
              </div>

              <ul className="space-y-2.5 mt-6 mb-6">
                {[
                  '1 free assessment per child',
                  'Basic readiness report',
                  'Spider-web mastery chart',
                  'Free video content',
                  'Shareable report link',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                    <span className="text-xs text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:border-gray-400 hover:text-gray-950 transition-all"
              >
                Get Started Free
              </button>
            </motion.div>

            {/* PLAN A */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-2xl border border-gray-200/80 p-6 hover:border-gray-300 hover:shadow-lg transition-all relative"
            >
              <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                DIGITAL
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-gray-950">Plan A</h3>
                <p className="text-xs text-gray-400 mt-0.5">Full digital access for one year</p>
              </div>

              <div className="flex items-end gap-1 mt-5 mb-1">
                <span className="text-xs text-gray-400">RM</span>
                <span className="text-4xl font-bold text-gray-950 leading-none">365</span>
                <span className="text-xs text-gray-400 pb-1">/year</span>
              </div>

              <ul className="space-y-2.5 mt-6 mb-6">
                {[
                  'Unlimited assessments',
                  'Unlimited premium video library',
                  'Full progress tracking',
                  'Practice mode',
                  'Priority support',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-950" />
                    <span className="text-xs text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/plan')}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-950 text-white hover:bg-gray-800 transition-all"
              >
                Subscribe Now
              </button>
            </motion.div>

            {/* PLAN B — Best Value */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-2xl border-2 border-gray-950 p-6 hover:shadow-xl transition-all relative"
            >
              <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-950 text-white flex items-center gap-1">
                <Crown className="w-3 h-3" />
                BEST VALUE
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-bold text-gray-950">Plan B</h3>
                <p className="text-xs text-gray-400 mt-0.5">Digital + FOXY-o1 AI Companion</p>
              </div>

              <div className="mt-5 mb-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">RM</span>
                  <span className="text-4xl font-bold text-gray-950 leading-none">730</span>
                  <span className="text-[10px] font-bold text-gray-950 bg-gray-100 px-2 py-0.5 rounded-full">
                    ~RM2/day
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  RM365/year digital + RM365 one-time AI toy (yours to keep). Renews at RM365/year.
                </p>
              </div>

              <ul className="space-y-2.5 mt-6 mb-4">
                {[
                  'Everything in Plan A',
                  'FOXY-o1 AI Companion Toy',
                  'Free shipping within Malaysia',
                  'Voice-interactive learning',
                  'Exclusive toy-holder content',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-950" />
                    <span className="text-xs text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>

              {/* Toy preview */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 mb-5">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-gray-100 flex-shrink-0 flex items-center justify-center">
                  <img src={foxyToyImage} alt="FOXY-o1" className="w-full h-full object-contain p-0.5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-gray-950 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-gray-400" />
                    FOXY-o1 AI Companion
                  </p>
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Physical AI toy that learns alongside your child
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate('/plan')}
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-950 text-white hover:bg-gray-800 transition-all"
              >
                Get Plan B
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── COMPARISON TABLE ─── */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-xl font-bold text-gray-950 tracking-tight mb-6">
              Feature comparison
            </h2>

            <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 font-semibold text-gray-950">Feature</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-400">Free</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-600">Plan A</th>
                      <th className="text-center py-3 px-3 font-bold text-gray-950">Plan B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map(([feature, free, planA, planB], i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-3 px-4 text-gray-600 font-medium">{feature}</td>
                        <td className="text-center py-3 px-3 text-gray-400">
                          {free === '-' ? <span className="text-gray-200">—</span> : free}
                        </td>
                        <td className="text-center py-3 px-3 text-gray-600">{planA === '-' ? <span className="text-gray-200">—</span> : planA}</td>
                        <td className="text-center py-3 px-3 text-gray-950 font-medium">{planB === '-' ? <span className="text-gray-200">—</span> : planB}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl font-bold text-gray-950 tracking-tight mb-3">
              Frequently asked questions
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            {FAQ.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="p-5 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all"
              >
                <p className="text-sm font-semibold text-gray-950 mb-2">{faq.q}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold text-gray-950 tracking-tight mb-4">
              Ready to begin?
            </h2>
            <p className="text-base text-gray-400 max-w-md mx-auto mb-8">
              Start with a free assessment — no credit card required.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
            >
              Start Free Assessment
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── BUSINESS INFO ─── */}
      <div className="border-t border-gray-100 py-6 text-center">
        <p className="text-[11px] text-gray-300">
          Project Lumi &middot; Registered in Malaysia &middot; All prices in MYR
        </p>
        <p className="text-[10px] text-gray-200 mt-1">
          Payments securely processed by Stripe. We do not store your card details.
        </p>
      </div>
    </div>
  );
}