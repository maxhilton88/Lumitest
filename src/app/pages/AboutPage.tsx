/**
 * AboutPage.tsx — About Project Lumi
 * 
 * Route: /about
 * Mission, YouTube video embed, Malaysian-built story.
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import {
  ArrowRight, Sparkles, Heart, Globe, BookOpen, Zap,
  MapPin, CheckCircle2,
} from 'lucide-react';
import { motion } from 'motion/react';

const TEAM_IMG = 'https://images.unsplash.com/photo-1758873269317-51888e824b28?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaXZlcnNlJTIwc3RhcnR1cCUyMHRlYW0lMjBvZmZpY2UlMjBtZWV0aW5nfGVufDF8fHx8MTc3MzE1Nzk0MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral';

const VALUES = [
  {
    icon: Heart,
    title: 'Children First',
    desc: 'Every decision we make starts with what\'s best for the child.',
  },
  {
    icon: Globe,
    title: 'Malaysian Made',
    desc: 'Built in KL for the Malaysian curriculum, by Malaysians.',
  },
  {
    icon: BookOpen,
    title: 'KSSR Aligned',
    desc: 'Every assessment maps to the national curriculum standards.',
  },
  {
    icon: Zap,
    title: 'Learning Through Play',
    desc: 'Gamification isn\'t a gimmick — it\'s how children learn best.',
  },
];

export function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/80 to-white pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-16 sm:pt-24 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full mb-6">
              <Sparkles className="w-3 h-3 text-gray-500" />
              <span className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                About Us
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-gray-950 tracking-tight leading-[1.15] mb-5">
              Making school readiness<br />
              <span className="text-gray-400">accessible to every Malaysian child.</span>
            </h1>

            <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-4">
              Project Lumi is an education technology company based in Kuala Lumpur.
              We build tools that help parents and kindergartens measure and improve
              children's readiness for primary school — aligned to Malaysia's KSSR curriculum.
            </p>

            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <MapPin className="w-3 h-3" />
              88, Jalan Raja Chulan, Bukit Bintang, 50200 Kuala Lumpur
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── VIDEO ─── */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-3">
              Our story
            </h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              Watch the founder explain why we built Project Lumi.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-2xl overflow-hidden bg-gray-950 shadow-2xl shadow-gray-200/60 aspect-video"
          >
            <iframe
              src="https://www.youtube.com/embed/LHJWRS6xffY?rel=0"
              title="About Project Lumi"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </motion.div>
        </div>
      </section>

      {/* ─── VALUES ─── */}
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
              What we believe
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALUES.map((val, i) => {
              const Icon = val.icon;
              return (
                <motion.div
                  key={val.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="p-5 rounded-2xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all group text-center"
                >
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:bg-gray-950 transition-colors">
                    <Icon className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-950 mb-1.5">{val.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{val.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── TEAM IMAGE ─── */}
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
                <ImageWithFallback
                  src={TEAM_IMG}
                  alt="Project Lumi team"
                  className="w-full h-[320px] object-cover"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-950 tracking-tight mb-4">
                Built in Kuala Lumpur
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-sm">
                We're a small team of educators, engineers, and parents who believe
                that every Malaysian child deserves access to quality school-readiness tools.
                Our office is in the heart of KL, and our product is purpose-built for
                the Malaysian curriculum.
              </p>
              <div className="space-y-3">
                {[
                  'KSSR curriculum experts on the team',
                  'Educators from prasekolah and primary schools',
                  'AI and game design specialists',
                  'Parents who use the product with their own kids',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-gray-500" />
                    </div>
                    <span className="text-sm text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
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
              Want to work with us?
            </h2>
            <p className="text-base text-gray-400 max-w-md mx-auto mb-8">
              Whether you're a parent, kindergarten, or potential partner — we'd love to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/contact')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-gray-950 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-950/10"
              >
                Contact Us
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/kindergarten')}
                className="flex items-center justify-center gap-2 px-8 py-3.5 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:border-gray-400 hover:text-gray-950 transition-all"
              >
                KinderPartner Program
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
