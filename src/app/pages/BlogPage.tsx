/**
 * BlogPage.tsx — Blog listing page
 * 
 * Route: /blog
 * Dummy content based on Project Lumi topics.
 */
import React from 'react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Sparkles, ArrowRight, Calendar, Clock } from 'lucide-react';
import { motion } from 'motion/react';

const HERO_IMG = 'https://images.unsplash.com/photo-1602856580608-15599264e9f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraW5kZXJnYXJ0ZW4lMjBjaGlsZHJlbiUyMGdyb3VwJTIwYWN0aXZpdHklMjBhc2lhfGVufDF8fHx8MTc3MzE1Nzk0M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral';
const PARENT_IMG = 'https://images.unsplash.com/photo-1758525860435-502240649c59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXJlbnQlMjBjaGlsZCUyMGxlYXJuaW5nJTIwdGFibGV0JTIwZWR1Y2F0aW9ufGVufDF8fHx8MTc3MzE1NzkzN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral';
const PLAY_IMG = 'https://images.unsplash.com/photo-1758687126227-48c2fa04b653?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGlsZCUyMHBsYXlpbmclMjBlZHVjYXRpb25hbCUyMGdhbWUlMjBjb2xvcmZ1bHxlbnwxfHx8fDE3NzMxNTc5NDB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral';
const OFFICE_IMG = 'https://images.unsplash.com/photo-1761727946471-baa5785efdd8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBtaW5pbWFsaXN0JTIwb2ZmaWNlJTIwd29ya3NwYWNlJTIwa3VhbGElMjBsdW1wdXJ8ZW58MXx8fHwxNzczMTU3OTQwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral';

const POSTS = [
  {
    id: '1',
    title: 'What is KSSR and Why Does School Readiness Matter?',
    excerpt: 'Understanding Malaysia\'s Kurikulum Standard Sekolah Rendah and how it shapes your child\'s educational journey from prasekolah to Standard 1.',
    image: HERO_IMG,
    date: 'March 5, 2026',
    readTime: '5 min read',
    category: 'Education',
  },
  {
    id: '2',
    title: 'How Gamified Learning Improves Assessment Accuracy',
    excerpt: 'Research shows that children perform more authentically in game-like environments. Here\'s how Foxy Adventure uses dark-fantasy RPG mechanics to measure real competencies.',
    image: PLAY_IMG,
    date: 'February 28, 2026',
    readTime: '4 min read',
    category: 'Research',
  },
  {
    id: '3',
    title: 'A Parent\'s Guide to Reading Your Child\'s Mastery Report',
    excerpt: 'Spider charts, skill breakdowns, and tunjang scores — here\'s how to decode your child\'s KSSR readiness report and turn insights into action.',
    image: PARENT_IMG,
    date: 'February 20, 2026',
    readTime: '6 min read',
    category: 'Parents',
  },
  {
    id: '4',
    title: 'Introducing FOXY-o1: Why We Built a Physical AI Toy',
    excerpt: 'Kids ask 300 questions a day. We built a talking AI fox that never gets tired of answering — in BM, English, and Mandarin.',
    image: OFFICE_IMG,
    date: 'February 10, 2026',
    readTime: '3 min read',
    category: 'Product',
  },
  {
    id: '5',
    title: 'Trilingual Education in Malaysia: BM, English, and Mandarin',
    excerpt: 'Why assessment in a child\'s preferred language matters, and how Project Lumi supports all three national languages.',
    image: HERO_IMG,
    date: 'January 30, 2026',
    readTime: '4 min read',
    category: 'Education',
  },
  {
    id: '6',
    title: 'How Kindergartens Can Use Data to Stand Out',
    excerpt: 'The KinderPartner program gives kindergartens real-time readiness data, territory protection, and branded assessment links.',
    image: PLAY_IMG,
    date: 'January 22, 2026',
    readTime: '5 min read',
    category: 'Kindergartens',
  },
];

export function BlogPage() {
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
                Blog
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-950 tracking-tight leading-[1.15] mb-5">
              Insights for parents<br />
              <span className="text-gray-400">and educators.</span>
            </h1>

            <p className="text-base text-gray-500 leading-relaxed">
              Tips on school readiness, KSSR curriculum, gamified learning, and Malaysian education.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── POSTS GRID ─── */}
      <section className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {POSTS.map((post, i) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="group cursor-pointer"
              >
                <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden hover:border-gray-300 hover:shadow-lg hover:shadow-gray-100/50 transition-all h-full flex flex-col">
                  <div className="h-44 overflow-hidden">
                    <ImageWithFallback
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-semibold text-gray-950 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded-full">
                        {post.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-950 mb-2 leading-snug group-hover:text-gray-700 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed flex-1 mb-4">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-gray-300">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {post.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.readTime}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
