import React, { useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { SpiderWebChart } from '../SpiderWebChart';
import {
  FantasyBackground,
  FantasyPanel,
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import {
  calculateTP,
  calculateSubjectBreakdowns,
  buildRadarData,
  calculateReadiness,
  calculateTotalStars,
  type DetailedAnswer,
} from '../../utils/report-calculations';
import { ParentAuthForm } from '../auth/ParentAuthForm';
import { getReferralCookie } from '../../utils/referral-cookie';
import { Lock, Star, Award, Eye, Sparkles, Swords, ShieldCheck, Play, Zap } from 'lucide-react';
import forestBackground from 'figma:asset/a581931d108e11fed5631f15572c62563a4ab3d4.png';
import foxyToyImage from 'figma:asset/090998e64822fcc5724f27cbd25c8d9c71bd2ea7.png';

interface GatedReportScreenProps {
  childName: string;
  childAge: number;
  allAnswers: DetailedAnswer[];
  moduleResults: Record<string, { score: number; total: number }>;
  liveQuests: {
    id: string;
    subject: string;
    name: { en: string; ms: string; zh: string };
    icon: string;
    is_mandarin: boolean;
  }[];
  brandingSettings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
  };
  onParentAuthSuccess: (parentData: any) => void;
  onSkip: () => void; // For "Skip for now" — in dev/testing
}

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const LEGENDARY_ORANGE = '#e8722a';

// Short subject labels for radar chart
const SUBJECT_SHORT_LABELS: Record<string, { en: string; ms: string; zh: string }> = {
  english: { en: 'English', ms: 'B. Inggeris', zh: '英语' },
  numbers: { en: 'Math', ms: 'Matematik', zh: '数学' },
  mathematics: { en: 'Math', ms: 'Matematik', zh: '数学' },
  bahasa: { en: 'BM', ms: 'BM', zh: '马来语' },
  'bahasa melayu': { en: 'BM', ms: 'BM', zh: '马来语' },
  mandarin: { en: 'Mandarin', ms: 'Mandarin', zh: '华语' },
  science: { en: 'Science', ms: 'Sains', zh: '科学' },
};

export const GatedReportScreen: React.FC<GatedReportScreenProps> = ({
  childName,
  childAge,
  allAnswers,
  moduleResults,
  liveQuests,
  brandingSettings,
  onParentAuthSuccess,
  onSkip,
}) => {
  const { language } = useLanguage();
  const lang = language as 'en' | 'ms' | 'zh';
  const [showAuthForm, setShowAuthForm] = useState(false);

  // ── Compute teaser data (visible) ──
  const readiness = calculateReadiness(allAnswers);
  const tp = calculateTP(allAnswers);
  const stars = calculateTotalStars(moduleResults);

  // Build radar data for the blurred chart preview
  const radarLabelMap: Record<string, { name: string; icon: string }> = {};
  liveQuests.forEach((q) => {
    const shortLabel = SUBJECT_SHORT_LABELS[q.subject.toLowerCase()];
    radarLabelMap[q.id] = {
      name: shortLabel ? shortLabel[lang] : q.subject,
      icon: q.icon,
    };
  });
  const allQuestIds = new Set(allAnswers.map((a) => a.quest));
  allQuestIds.forEach((id) => {
    if (!radarLabelMap[id]) {
      const shortLabel = SUBJECT_SHORT_LABELS[id.toLowerCase()];
      radarLabelMap[id] = {
        name: shortLabel ? shortLabel[lang] : id,
        icon: '',
      };
    }
  });
  const breakdowns = calculateSubjectBreakdowns(allAnswers, radarLabelMap);
  const radarData = buildRadarData(breakdowns);

  // Multilingual labels
  const labels = {
    adventureComplete: {
      en: 'Adventure Complete!',
      ms: 'Pengembaraan Selesai!',
      zh: '冒险完成！',
    },
    overallScore: { en: 'Overall Score', ms: 'Skor Keseluruhan', zh: '总分' },
    starsEarned: { en: 'Stars Earned', ms: 'Bintang Diperoleh', zh: '获得星星' },
    questsDone: { en: 'Quests Done', ms: 'Misi Selesai', zh: '已完成任务' },
    unlockTitle: {
      en: 'Unlock the Full Report',
      ms: 'Buka Laporan Penuh',
      zh: '解锁完整报告',
    },
    unlockDesc: {
      en: `See ${childName}'s detailed strengths, TP level, subject analysis, and personalized recommendations.`,
      ms: `Lihat kekuatan terperinci ${childName}, tahap TP, analisis subjek, dan cadangan peribadi.`,
      zh: `查看${childName}的详细优势、TP水平、科目分析和个性化建议。`,
    },
    freeAccount: {
      en: `Unlock ${childName}'s Report — Free!`,
      ms: `Buka Laporan ${childName} — Percuma!`,
      zh: `解锁${childName}的报告 — 免费！`,
    },
    whatsIncluded: {
      en: "What's Included",
      ms: 'Apa Yang Termasuk',
      zh: '包含内容',
    },
    skipForNow: {
      en: 'Skip for now',
      ms: 'Langkau buat masa ini',
      zh: '暂时跳过',
    },
    loginInstead: {
      en: 'Already have an account? Sign in',
      ms: 'Sudah ada akaun? Log masuk',
      zh: '已有账号？登录',
    },
  };

  const includesList = {
    en: [
      'TP Proficiency Level (1-6)',
      'Spider Web readiness chart',
      'Subject-by-subject analysis',
      'Functional age per subject',
      'Personalized recommendations',
      'Downloadable PDF report',
    ],
    ms: [
      'Tahap Penguasaan TP (1-6)',
      'Carta laba-laba kesediaan',
      'Analisis subjek demi subjek',
      'Umur fungsi setiap subjek',
      'Cadangan peribadi',
      'Laporan PDF boleh dimuat turun',
    ],
    zh: [
      'TP掌握水平（1-6）',
      '蛛网准备图表',
      '逐科分析',
      '每科功能年龄',
      '个性化建议',
      '可下载PDF报告',
    ],
  };

  // Platform feature cards data
  const platformFeatures = [
    {
      icon: <Swords className="w-6 h-6" style={{ color: '#e74c3c' }} />,
      title: { en: 'Quest Mode', ms: 'Mod Misi', zh: '任务模式' },
      desc: { en: 'Unlimited KSSR tests', ms: 'Ujian KSSR tanpa had', zh: '无限KSSR测试' },
      bg: '#e74c3c',
    },
    {
      icon: <ShieldCheck className="w-6 h-6" style={{ color: '#4dabf7' }} />,
      title: { en: 'Training Mode', ms: 'Mod Latihan', zh: '训练模式' },
      desc: { en: 'Thousands of questions', ms: 'Ribuan soalan latihan', zh: '数千道练习题' },
      bg: '#4dabf7',
    },
    {
      icon: <Play className="w-6 h-6" style={{ color: '#7cc643' }} />,
      title: { en: 'Video Mode', ms: 'Mod Video', zh: '视频模式' },
      desc: { en: 'Foxy learning videos', ms: 'Video pembelajaran Foxy', zh: 'Foxy学习视频' },
      bg: '#7cc643',
    },
  ];

  // FOXY-o1 promo labels
  const foxyPromo = {
    title: { en: 'Bring Home FOXY-o1', ms: 'Bawa Pulang FOXY-o1', zh: '把FOXY-o1带回家' },
    subtitle: {
      en: `${childName}'s 24/7 AI Teacher`,
      ms: `Guru AI 24/7 ${childName}`,
      zh: `${childName}的24/7 AI老师`,
    },
    desc: {
      en: 'A pocket-sized AI companion that explains concepts, answers questions, and adapts to your child\'s learning level — anytime, anywhere.',
      ms: 'Teman AI bersaiz poket yang menerangkan konsep, menjawab soalan, dan menyesuaikan diri dengan tahap pembelajaran anak anda — bila-bila masa, di mana sahaja.',
      zh: '口袋大小的AI伙伴，解释概念、回答问题，并适应您孩子的学习水平 — 随时随地。',
    },
    bundle: {
      en: '1 Year Foxy Adventure + FOXY-o1 Toy',
      ms: '1 Tahun Foxy Adventure + Mainan FOXY-o1',
      zh: '1年Foxy Adventure + FOXY-o1玩具',
    },
    superPromo: { en: 'Limited Intro Offer', ms: 'Tawaran Intro Terhad', zh: '限时首发优惠' },
    learnMore: { en: 'Learn More', ms: 'Ketahui Lagi', zh: '了解更多' },
    earlyAdopter: {
      en: 'For early adopters only — reverts to full price after first batch.',
      ms: 'Untuk pengguna awal sahaja — kembali ke harga penuh selepas kumpulan pertama.',
      zh: '仅限首批尝鲜用户 — 名额满后恢复原价。',
    },
    perDay: { en: 'Only RM1/day', ms: 'Hanya RM1/hari', zh: '每天仅RM1' },
  };

  // If showing full auth form overlay
  if (showAuthForm) {
    // Pass captured referral code: check cookie first (set by ChildFlowPage), then sessionStorage (set by useTestSession)
    const capturedRef = getReferralCookie() || (() => {
      try { return sessionStorage.getItem('foxy_ref_code') || undefined; } catch { return undefined; }
    })() || undefined;
    return (
      <ParentAuthForm
        onSuccess={onParentAuthSuccess}
        onBack={() => setShowAuthForm(false)}
        defaultReferralCode={capturedRef}
      />
    );
  }

  const tpColor =
    tp.level >= 5 ? '#7cc643' : tp.level >= 4 ? GOLD : tp.level >= 3 ? '#4dabf7' : '#e74c3c';

  return (
    <div className="min-h-[100dvh] relative overflow-auto">
      <FantasyBackground bgImage={forestBackground} overlayOpacity={0.65} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* ── Header ── */}
        <div className="text-center space-y-2">
          <FantasyTitle size="lg">{labels.adventureComplete[lang]}</FantasyTitle>
          <p
            className="text-base md:text-lg"
            style={{
              color: '#c8b88a',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}
          >
            {childName}
          </p>
        </div>

        <GoldOrnament />

        {/* ── Visible Stats Row ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Overall Score */}
          <FantasyPanel className="p-4 text-center" gold>
            <div
              className="text-3xl md:text-4xl font-black"
              style={{
                color: readiness.percentage >= 70 ? '#7cc643' : readiness.percentage >= 50 ? GOLD : '#e74c3c',
                fontFamily: "'Cinzel Decorative', serif",
                textShadow: '0 0 12px rgba(0,0,0,0.5)',
              }}
            >
              {readiness.percentage}%
            </div>
            <div className="text-xs mt-1" style={{ color: '#c8b88a' }}>
              {labels.overallScore[lang]}
            </div>
          </FantasyPanel>

          {/* Stars */}
          <FantasyPanel className="p-4 text-center" gold>
            <div className="flex items-center justify-center gap-1">
              <Star className="w-5 h-5" style={{ color: GOLD, fill: GOLD }} />
              <span
                className="text-3xl md:text-4xl font-black"
                style={{
                  color: GOLD_LIGHT,
                  fontFamily: "'Cinzel Decorative', serif",
                  textShadow: '0 0 12px rgba(0,0,0,0.5)',
                }}
              >
                {stars.earned}
              </span>
            </div>
            <div className="text-xs mt-1" style={{ color: '#c8b88a' }}>
              {labels.starsEarned[lang]}
            </div>
          </FantasyPanel>

          {/* Quests */}
          <FantasyPanel className="p-4 text-center" gold>
            <div
              className="text-3xl md:text-4xl font-black"
              style={{
                color: GOLD_LIGHT,
                fontFamily: "'Cinzel Decorative', serif",
                textShadow: '0 0 12px rgba(0,0,0,0.5)',
              }}
            >
              {Object.keys(moduleResults).length}
            </div>
            <div className="text-xs mt-1" style={{ color: '#c8b88a' }}>
              {labels.questsDone[lang]}
            </div>
          </FantasyPanel>
        </div>

        {/* ── Blurred Spider Web Preview ── */}
        <FantasyPanel className="p-5 relative overflow-hidden">
          {/* Actual chart rendered but with heavy blur overlay */}
          <div className="relative">
            <div style={{ filter: 'blur(8px)', opacity: 0.6, pointerEvents: 'none' }}>
              <SpiderWebChart data={radarData} childAge={childAge} />
            </div>

            {/* Lock overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}40, ${GOLD}20)`,
                  border: `2px solid ${GOLD}60`,
                  boxShadow: `0 0 30px ${GOLD}30`,
                }}
              >
                <Lock className="w-7 h-7" style={{ color: GOLD }} />
              </div>
              <p
                className="text-sm font-bold tracking-wide"
                style={{ color: GOLD_LIGHT, textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
              >
                {lang === 'en' ? 'Readiness Chart Locked' : lang === 'ms' ? 'Carta Kesediaan Dikunci' : '准备图表已锁定'}
              </p>
            </div>
          </div>
        </FantasyPanel>

        {/* ── Blurred TP Level Preview ── */}
        <FantasyPanel className="p-5 relative overflow-hidden">
          <div style={{ filter: 'blur(8px)', opacity: 0.5, pointerEvents: 'none' }}>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black"
                style={{
                  background: `linear-gradient(135deg, ${tpColor}30, ${tpColor}10)`,
                  border: `2px solid ${tpColor}50`,
                  color: tpColor,
                  fontFamily: "'Cinzel Decorative', serif",
                }}
              >
                TP{tp.level}
              </div>
              <div>
                <p className="font-bold text-base" style={{ color: GOLD_LIGHT }}>
                  {lang === 'en' ? tp.labelEN : lang === 'ms' ? tp.labelBM : tp.labelZH}
                </p>
                <p className="text-sm" style={{ color: '#c8b88a' }}>
                  {tp.description[lang].substring(0, 60)}...
                </p>
              </div>
            </div>
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" style={{ color: GOLD }} />
              <p
                className="text-sm font-bold tracking-wide"
                style={{ color: GOLD_LIGHT, textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
              >
                {lang === 'en' ? 'TP Level Locked' : lang === 'ms' ? 'Tahap TP Dikunci' : 'TP水平已锁定'}
              </p>
            </div>
          </div>
        </FantasyPanel>

        {/* ── Blurred Subject Breakdown Preview ── */}
        <FantasyPanel className="p-5 relative overflow-hidden">
          <div style={{ filter: 'blur(8px)', opacity: 0.5, pointerEvents: 'none' }}>
            <div className="space-y-3">
              {breakdowns.slice(0, 3).map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}
                  >
                    {b.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-bold" style={{ color: GOLD_LIGHT }}>{b.questName}</span>
                      <span className="text-sm" style={{ color: '#c8b88a' }}>{b.overallPercentage}%</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${b.overallPercentage}%`, background: GOLD }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" style={{ color: GOLD }} />
              <p
                className="text-sm font-bold tracking-wide"
                style={{ color: GOLD_LIGHT, textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
              >
                {lang === 'en' ? 'Subject Details Locked' : lang === 'ms' ? 'Butiran Subjek Dikunci' : '科目详情已锁定'}
              </p>
            </div>
          </div>
        </FantasyPanel>

        <GoldOrnament />

        {/* ── FOXY-o1 Toy Promo — Legendary Card ── */}
        <FantasyPanel className="p-0 overflow-hidden relative">
          {/* Legendary glow border effect */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              border: `2px solid ${LEGENDARY_ORANGE}50`,
              boxShadow: `0 0 25px ${LEGENDARY_ORANGE}20, inset 0 0 25px ${LEGENDARY_ORANGE}08`,
            }}
          />

          {/* Super Promo ribbon */}
          <div
            className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
            style={{
              background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}, #ff6b35)`,
              color: '#fff',
              boxShadow: `0 2px 10px ${LEGENDARY_ORANGE}60`,
              fontFamily: "'Cinzel Decorative', serif",
            }}
          >
            {foxyPromo.superPromo[lang]}
          </div>

          <div className="p-5 md:p-6">
            <div className="flex items-start gap-4">
              {/* Toy image */}
              <div className="flex-shrink-0">
                <div
                  className="w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, #fff5eb, #ffe8d5)`,
                    border: `2px solid ${LEGENDARY_ORANGE}30`,
                    boxShadow: `0 4px 16px rgba(0,0,0,0.2)`,
                  }}
                >
                  <img
                    src={foxyToyImage}
                    alt="FOXY-o1 AI Toy"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4" style={{ color: LEGENDARY_ORANGE }} />
                  <h3
                    className="text-sm md:text-base font-black tracking-wide"
                    style={{
                      fontFamily: "'Cinzel Decorative', serif",
                      color: GOLD_LIGHT,
                      textShadow: `0 0 10px ${LEGENDARY_ORANGE}30`,
                    }}
                  >
                    {foxyPromo.title[lang]}
                  </h3>
                </div>
                <p
                  className="text-xs font-bold mb-1.5"
                  style={{ color: LEGENDARY_ORANGE }}
                >
                  {foxyPromo.subtitle[lang]}
                </p>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: `${PARCHMENT}bb` }}
                >
                  {foxyPromo.desc[lang]}
                </p>
              </div>
            </div>

            {/* Bundle pricing */}
            <div
              className="mt-4 p-3 rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}12, ${LEGENDARY_ORANGE}06)`,
                border: `1px solid ${LEGENDARY_ORANGE}25`,
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${PARCHMENT}90` }}>
                  {foxyPromo.bundle[lang]}
                </p>
                <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                  <span
                    className="text-xl md:text-2xl font-black"
                    style={{
                      color: LEGENDARY_ORANGE,
                      fontFamily: "'Cinzel Decorative', serif",
                      textShadow: `0 0 12px ${LEGENDARY_ORANGE}30`,
                    }}
                  >
                    RM365
                  </span>
                  <span
                    className="text-sm line-through"
                    style={{ color: `${PARCHMENT}60` }}
                  >
                    RM730
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `${LEGENDARY_ORANGE}20`,
                      color: LEGENDARY_ORANGE,
                    }}
                  >
                    -50%
                  </span>
                  {/* RM1/day highlight */}
                  <span
                    className="text-[11px] font-black px-2 py-0.5 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, #f0d078)`,
                      color: '#2a1f0e',
                      boxShadow: `0 0 10px ${GOLD}40`,
                    }}
                  >
                    {foxyPromo.perDay[lang]}
                  </span>
                </div>
              </div>
              {/* Early adopter scarcity text */}
              <p
                className="text-[10px] mt-2 leading-relaxed"
                style={{ color: `${PARCHMENT}80` }}
              >
                {foxyPromo.earlyAdopter[lang]}
              </p>
            </div>
          </div>
        </FantasyPanel>

        {/* ── Unlock CTA Card ── */}
        <FantasyPanel className="p-6 md:p-8" gold>
          <div className="text-center space-y-4">
            {/* Sparkle icon */}
            <div className="flex justify-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}50, ${GOLD}20)`,
                  border: `2px solid ${GOLD}`,
                  boxShadow: `0 0 25px ${GOLD}40, inset 0 0 15px ${GOLD}20`,
                }}
              >
                <Sparkles className="w-7 h-7" style={{ color: GOLD_LIGHT }} />
              </div>
            </div>

            <div>
              <h2
                className="text-lg md:text-xl font-black tracking-wide"
                style={{
                  fontFamily: "'Cinzel Decorative', serif",
                  color: GOLD_LIGHT,
                  textShadow: `0 0 12px ${GOLD}40`,
                }}
              >
                {labels.unlockTitle[lang]}
              </h2>
              <p className="text-sm mt-2" style={{ color: PARCHMENT, lineHeight: 1.6 }}>
                {labels.unlockDesc[lang]}
              </p>
            </div>

            {/* What's included — Report features */}
            <div className="text-left space-y-2 py-3">
              <p
                className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: GOLD_LIGHT }}
              >
                {labels.whatsIncluded[lang]}
              </p>
              {includesList[lang].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${GOLD}30` }}
                  >
                    <Eye className="w-2.5 h-2.5" style={{ color: GOLD }} />
                  </div>
                  <span className="text-sm" style={{ color: PARCHMENT }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>

            {/* Platform feature cards — Quest / Training / Video */}
            <div className="pt-2 pb-1">
              <p
                className="text-xs font-bold uppercase tracking-widest mb-3 text-left"
                style={{ color: GOLD_LIGHT }}
              >
                {lang === 'en' ? 'Also Included — Free Forever' : lang === 'ms' ? 'Juga Termasuk — Percuma Selamanya' : '同样包含 — 永久免费'}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {platformFeatures.map((feat, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 text-center space-y-1.5"
                    style={{
                      background: `${feat.bg}10`,
                      border: `1px solid ${feat.bg}30`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto"
                      style={{
                        background: `${feat.bg}20`,
                        border: `1px solid ${feat.bg}40`,
                      }}
                    >
                      {feat.icon}
                    </div>
                    <p className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>
                      {feat.title[lang]}
                    </p>
                    <p className="text-[10px] leading-tight" style={{ color: `${PARCHMENT}bb` }}>
                      {feat.desc[lang]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setShowAuthForm(true)}
              className="w-full py-4 px-6 rounded-xl font-black text-sm md:text-base tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98] active:translate-y-[2px]"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                color: '#2a1f0e',
                border: `3px solid ${GOLD_LIGHT}`,
                boxShadow: `0 4px 0 #a67c2e, 0 0 30px ${GOLD}40`,
                fontFamily: "'Cinzel Decorative', serif",
                textShadow: '0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              {labels.freeAccount[lang]}
            </button>

            <p className="text-xs font-medium" style={{ color: GOLD_LIGHT, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {lang === 'en' ? 'Free \u2022 No credit card required \u2022 Takes 30 seconds'
                : lang === 'ms' ? 'Percuma \u2022 Tiada kad kredit diperlukan \u2022 Ambil 30 saat'
                : '免费 \u2022 无需信用卡 \u2022 只需30秒'}
            </p>
          </div>
        </FantasyPanel>

        {/* Skip link (for dev/testing — can be removed in production) */}
        <div className="text-center pb-8">
          <button
            onClick={onSkip}
            className="text-xs underline transition-colors"
            style={{ color: `${GOLD}55` }}
          >
            {labels.skipForNow[lang]}
          </button>
        </div>
      </div>
    </div>
  );
};