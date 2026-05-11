import React, { useRef, useState } from 'react';
import { useLanguage } from '../LanguageContext';
import { SpiderWebChart } from '../SpiderWebChart';
import { FoxyToySection } from '../FoxyToySection';
import { GlossyButton } from '../GlossyButton';
import {
  FantasyBackground,
  FantasyPanel,
  FantasyTitle,
  FantasyFooter,
  GoldOrnament,
} from '../FantasyBackground';
import {
  calculateTP,
  calculateSubjectBreakdowns,
  buildRadarData,
  calculateReadiness,
  calculateTotalStars,
  generateRecommendations,
  type DetailedAnswer,
  type SubjectAgeBreakdown,
} from '../../utils/report-calculations';
import {
  Download,
  Share2,
  Award,
  BookOpen,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Radar,
  Star,
  Target,
  MessageCircle,
  Facebook,
  Instagram,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import forestBackground from 'figma:asset/a581931d108e11fed5631f15572c62563a4ab3d4.png';

interface FullReportScreenProps {
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
  onShare: () => void;
}

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';

// Short subject labels for radar chart (keeps chart clean)
const SUBJECT_SHORT_LABELS: Record<string, { en: string; ms: string; zh: string }> = {
  english: { en: 'English', ms: 'B. Inggeris', zh: '英语' },
  numbers: { en: 'Math', ms: 'Matematik', zh: '数学' },
  mathematics: { en: 'Math', ms: 'Matematik', zh: '数学' },
  math: { en: 'Math', ms: 'Matematik', zh: '数学' },
  bahasa: { en: 'BM', ms: 'BM', zh: '马来语' },
  'bahasa melayu': { en: 'BM', ms: 'BM', zh: '马来语' },
  mandarin: { en: 'Mandarin', ms: 'Mandarin', zh: '华语' },
  chinese: { en: 'Mandarin', ms: 'Mandarin', zh: '华语' },
  science: { en: 'Science', ms: 'Sains', zh: '科学' },
  moral: { en: 'Moral', ms: 'Moral', zh: '道德' },
  art: { en: 'Art', ms: 'Seni', zh: '美术' },
  music: { en: 'Music', ms: 'Muzik', zh: '音乐' },
};

export const FullReportScreen: React.FC<FullReportScreenProps> = ({
  childName,
  childAge,
  allAnswers,
  moduleResults,
  liveQuests,
  brandingSettings,
  onShare,
}) => {
  const { language } = useLanguage();
  const lang = language as 'en' | 'ms' | 'zh';
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Compute all report data ──
  const readiness = calculateReadiness(allAnswers);
  const tp = calculateTP(allAnswers);
  const stars = calculateTotalStars(moduleResults);

  // Build quest name/icon map from liveQuests (full names for breakdown section)
  const questNameMap: Record<string, { name: string; icon: string }> = {};
  liveQuests.forEach((q) => {
    questNameMap[q.id] = { name: q.name[lang] || q.name.en || q.subject, icon: q.icon };
  });
  // Fallback map for hardcoded quest IDs
  const fallbackNames: Record<string, { name: string; icon: string }> = {
    english: { name: lang === 'ms' ? 'Hutan Bahasa Inggeris' : lang === 'zh' ? '英语森林' : 'English Forest', icon: '🌳' },
    numbers: { name: lang === 'ms' ? 'Pulau Nombor' : lang === 'zh' ? '数字岛' : 'Numbers Island', icon: '🔢' },
    bahasa: { name: 'Rimba Bahasa', icon: '🇲🇾' },
    mandarin: { name: lang === 'ms' ? 'Gunung Mandarin' : lang === 'zh' ? '华语山' : 'Mandarin Mountain', icon: '🏔️' },
    science: { name: lang === 'ms' ? 'Hutan Misteri' : lang === 'zh' ? '神秘丛林' : 'Mystery Jungle', icon: '🔬' },
  };
  const allQuestIds = new Set(allAnswers.map((a) => a.quest));
  allQuestIds.forEach((id) => {
    if (!questNameMap[id] && fallbackNames[id]) {
      questNameMap[id] = fallbackNames[id];
    } else if (!questNameMap[id]) {
      questNameMap[id] = { name: id, icon: '' };
    }
  });

  // Build SHORT subject label map for radar chart
  const radarLabelMap: Record<string, { name: string; icon: string }> = {};
  liveQuests.forEach((q) => {
    const shortLabel = SUBJECT_SHORT_LABELS[q.subject.toLowerCase()];
    radarLabelMap[q.id] = {
      name: shortLabel ? shortLabel[lang] : q.subject,
      icon: q.icon,
    };
  });
  // Fallback for hardcoded quest IDs
  allQuestIds.forEach((id) => {
    if (!radarLabelMap[id]) {
      const shortLabel = SUBJECT_SHORT_LABELS[id.toLowerCase()];
      radarLabelMap[id] = {
        name: shortLabel ? shortLabel[lang] : (questNameMap[id]?.name || id),
        icon: questNameMap[id]?.icon || '',
      };
    }
  });

  const breakdowns = calculateSubjectBreakdowns(allAnswers, questNameMap);

  // Build radar data using SHORT subject labels
  const radarBreakdowns = calculateSubjectBreakdowns(allAnswers, radarLabelMap);
  const radarData = buildRadarData(radarBreakdowns);

  const recommendations = generateRecommendations(breakdowns, childName);
  const weakSubjects = breakdowns
    .filter((b) => b.overallPercentage < 60)
    .map((b) => b.questName);

  const today = new Date().toLocaleDateString(
    lang === 'ms' ? 'ms-MY' : lang === 'zh' ? 'zh-CN' : 'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );

  // TP color
  const tpColor =
    tp.level >= 5 ? '#7cc643' : tp.level >= 4 ? GOLD : tp.level >= 3 ? '#4dabf7' : '#e74c3c';

  // Strength color helper
  const strengthColor = (pct: number) =>
    pct >= 80 ? '#7cc643' : pct >= 60 ? GOLD : pct >= 40 ? '#4dabf7' : '#e74c3c';

  // ── Share text builder ──
  const getShareText = () => {
    const assessmentUrl = brandingSettings.kindergartenUrl
      ? `https://projectlumi.org/${brandingSettings.kindergartenUrl}`
      : 'https://projectlumi.org';
    return `${childName} scored ${readiness.percentage}% on the KSSR readiness assessment at ${brandingSettings.schoolName}!\n\nTry the free assessment for your child: ${assessmentUrl}`;
  };

  // ── Share handlers ──
  const handleWhatsAppShare = () => {
    const text = getShareText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    setShowSharePanel(false);
  };

  const handleFacebookShare = () => {
    const assessmentUrl = brandingSettings.kindergartenUrl
      ? `https://projectlumi.org/${brandingSettings.kindergartenUrl}`
      : 'https://projectlumi.org';
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(assessmentUrl)}&quote=${encodeURIComponent(getShareText())}`, '_blank');
    setShowSharePanel(false);
  };

  const handleInstagramShare = () => {
    // Instagram doesn't support direct sharing via URL — copy text instead
    navigator.clipboard.writeText(getShareText()).then(() => {
      toast.success(
        lang === 'en' ? 'Copied! Paste it in your Instagram story or post.'
        : lang === 'ms' ? 'Disalin! Tampal di Instagram story atau post anda.'
        : '已复制！粘贴到您的Instagram故事或帖子中。'
      );
    }).catch(() => {
      toast.error('Failed to copy');
    });
    setShowSharePanel(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  // ── PDF download ──
  const handleDownloadPDF = async () => {
    if (!reportRef.current || isGeneratingPDF) return;
    setIsGeneratingPDF(true);

    try {
      // Inject print-specific styles temporarily
      const printStyle = document.createElement('style');
      printStyle.id = 'report-print-styles';
      printStyle.textContent = `
        @media print {
          body * { visibility: hidden !important; }
          #report-print-area, #report-print-area * { visibility: visible !important; }
          #report-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #0a0a12 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { margin: 10mm; size: A4; }
        }
      `;
      document.head.appendChild(printStyle);

      // Mark the report area for print isolation
      reportRef.current.id = 'report-print-area';

      // Small delay for styles to apply
      await new Promise(r => setTimeout(r, 100));

      window.print();

      toast.success(
        lang === 'en' ? 'Print dialog opened! Select "Save as PDF" to download.'
        : lang === 'ms' ? 'Dialog cetak dibuka! Pilih "Save as PDF" untuk muat turun.'
        : '打印对话框已打开！选择"另存为PDF"下载。'
      );
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error(
        lang === 'en' ? 'PDF generation failed. Please try again.'
        : lang === 'ms' ? 'Penjanaan PDF gagal. Sila cuba lagi.'
        : 'PDF生成失败，请重试。'
      );
    } finally {
      // Clean up print styles
      const printStyle = document.getElementById('report-print-styles');
      if (printStyle) printStyle.remove();
      if (reportRef.current) reportRef.current.id = '';
      setIsGeneratingPDF(false);
    }
  };

  // ── Labels (emoji-free) ──
  const labels = {
    reportTitle: {
      en: `${childName}'s KSSR Readiness Report`,
      ms: `Laporan Kesediaan KSSR ${childName}`,
      zh: `${childName}的KSSR准备报告`,
    },
    overallScore: { en: 'Overall Score', ms: 'Skor Keseluruhan', zh: '总分' },
    tpLevel: { en: 'TP Level', ms: 'Tahap Penguasaan', zh: '掌握水平' },
    questsDone: { en: 'Quests Done', ms: 'Misi Selesai', zh: '已完成任务' },
    starsEarned: { en: 'Stars Earned', ms: 'Bintang Diperoleh', zh: '获得星星' },
    radarTitle: { en: 'Readiness Overview', ms: 'Gambaran Kesediaan', zh: '准备概览' },
    radarCaption: {
      en: `The shaded area shows ${childName}'s current functional level per subject. The outer ring represents Age 7 (Standard 1 readiness).`,
      ms: `Kawasan berlorek menunjukkan tahap fungsi semasa ${childName} bagi setiap subjek. Gelang luar mewakili Umur 7 (kesediaan Tahun 1).`,
      zh: `阴影区域显示${childName}每个科目的当前功能水平。外环代表7岁（一年级准备程度）。`,
    },
    subjectTitle: { en: 'Subject Breakdown', ms: 'Pecahan Subjek', zh: '科目分析' },
    tpTitle: { en: 'What This Means', ms: 'Apa Maksudnya', zh: '这意味着什么' },
    tpNote: {
      en: 'TP (Tahap Penguasaan) is calculated from Year 1-level (Age 7) questions only.',
      ms: 'TP (Tahap Penguasaan) dikira daripada soalan tahap Tahun 1 (Umur 7) sahaja.',
      zh: 'TP（掌握水平）仅根据一年级水平（7岁）的问题计算。',
    },
    recTitle: { en: 'Recommendations', ms: 'Cadangan', zh: '建议' },
    downloadPDF: { en: 'Download Report (PDF)', ms: 'Muat Turun Laporan (PDF)', zh: '下载报告 (PDF)' },
    shareResults: { en: 'Share Results', ms: 'Kongsi Keputusan', zh: '分享成绩' },
    disclaimer: {
      en: 'This is a screening tool, not a clinical assessment.',
      ms: 'Ini adalah alat saringan, bukan penilaian klinikal.',
      zh: '这是筛查工具，不是临床评估。',
    },
  };

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col">
      {/* Fantasy background */}
      <FantasyBackground bgImage={forestBackground} overlayOpacity={0.75} />

      {/* Scrollable report content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div ref={reportRef} className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
          {/* ═══════════════════════════════
              SECTION 1: Header + Summary
             ═══════════════════════════════ */}
          <div className="text-center mb-2">
            {brandingSettings.logoUrl && (
              <img
                src={brandingSettings.logoUrl}
                alt={brandingSettings.schoolName}
                className="w-12 h-12 mx-auto mb-2 rounded-lg object-contain"
              />
            )}
            <p className="text-xs font-medium" style={{ color: 'rgba(200,184,138,0.5)' }}>
              {brandingSettings.schoolName}
            </p>
          </div>

          <FantasyPanel gold className="p-5 md:p-6">
            <GoldOrnament className="mb-3" />

            <FantasyTitle size="sm" className="text-center">
              {labels.reportTitle[lang]}
            </FantasyTitle>

            <p className="text-center text-xs mt-1 mb-4" style={{ color: 'rgba(200,184,138,0.5)' }}>
              {today}
            </p>

            {/* Quick stats grid — no emojis, clean data */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label={labels.overallScore[lang]}
                value={`${readiness.percentage}%`}
                sublabel={`${readiness.score}/${readiness.total}`}
                color={strengthColor(readiness.percentage)}
              />
              <StatCard
                label={labels.tpLevel[lang]}
                value={`TP${tp.level}`}
                sublabel={lang === 'ms' ? tp.labelBM : lang === 'zh' ? tp.labelZH : tp.labelEN}
                color={tpColor}
              />
              <StatCard
                label={labels.questsDone[lang]}
                value={`${Object.keys(moduleResults).length}`}
                sublabel={`${lang === 'en' ? 'completed' : lang === 'ms' ? 'selesai' : '已完成'}`}
                color={GOLD}
                icon={<Target className="w-4 h-4" style={{ color: GOLD }} />}
              />
              <StatCard
                label={labels.starsEarned[lang]}
                value={`${stars.earned}`}
                sublabel={`/ ${stars.possible}`}
                color={GOLD}
                icon={<Star className="w-4 h-4" fill={GOLD} style={{ color: GOLD }} />}
              />
            </div>

            <GoldOrnament className="mt-4" />
          </FantasyPanel>

          {/* ═══════════════════════════════
              SECTION 2: Spider Web Radar Chart
             ═══════════════════════════════ */}
          <FantasyPanel className="p-5 md:p-6">
            <h2
              className="text-lg md:text-xl font-bold text-center mb-1 flex items-center justify-center gap-2"
              style={{ color: GOLD_LIGHT, fontFamily: "'Cinzel Decorative', serif" }}
            >
              <Radar className="w-5 h-5" style={{ color: GOLD }} />
              {labels.radarTitle[lang]}
            </h2>

            {radarData.length >= 3 ? (
              <>
                <SpiderWebChart data={radarData} childAge={childAge} />
                <p className="text-xs text-center mt-2 leading-relaxed px-4" style={{ color: 'rgba(200,184,138,0.5)' }}>
                  {labels.radarCaption[lang]}
                </p>
              </>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: 'rgba(200,184,138,0.5)' }}>
                  {lang === 'en'
                    ? 'Complete at least 3 quests to see the readiness overview chart.'
                    : lang === 'ms'
                    ? 'Selesaikan sekurang-kurangnya 3 misi untuk melihat carta gambaran keseluruhan.'
                    : '完成至少3个任务才能查看准备概览图表。'}
                </p>
              </div>
            )}
          </FantasyPanel>

          {/* ═══════════════════════════════
              SECTION 3: Per-Subject Breakdown
             ═══════════════════════════════ */}
          <FantasyPanel className="p-5 md:p-6">
            <h2
              className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2"
              style={{ color: GOLD_LIGHT, fontFamily: "'Cinzel Decorative', serif" }}
            >
              <BookOpen className="w-5 h-5" style={{ color: GOLD }} />
              {labels.subjectTitle[lang]}
            </h2>

            <div className="space-y-5">
              {breakdowns.map((b) => (
                <SubjectRow key={b.questId} breakdown={b} childAge={childAge} lang={lang} />
              ))}
            </div>
          </FantasyPanel>

          {/* ═══════════════════════════════
              SECTION 4: TP Explanation + Recs
             ═══════════════════════════════ */}
          <FantasyPanel className="p-5 md:p-6">
            <h2
              className="text-lg md:text-xl font-bold mb-3 flex items-center gap-2"
              style={{ color: GOLD_LIGHT, fontFamily: "'Cinzel Decorative', serif" }}
            >
              <Award className="w-5 h-5" style={{ color: GOLD }} />
              {labels.tpTitle[lang]}
            </h2>

            {/* TP badge */}
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${tpColor}33 0%, ${tpColor}11 100%)`,
                  border: `3px solid ${tpColor}`,
                  boxShadow: `0 0 15px ${tpColor}33`,
                }}
              >
                <span className="text-xl font-black" style={{ color: tpColor }}>
                  TP{tp.level}
                </span>
              </div>
              <div>
                <p className="font-bold text-base" style={{ color: GOLD_LIGHT }}>
                  {lang === 'ms' ? tp.labelBM : lang === 'zh' ? tp.labelZH : tp.labelEN}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(200,184,138,0.5)' }}>
                  {labels.tpNote[lang]}
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed mb-5" style={{ color: '#c8b88a' }}>
              {childName} {tp.description[lang]}
            </p>

            <GoldOrnament className="mb-5" />

            {/* Recommendations — Lucide icon, no emoji */}
            <h3
              className="text-base font-bold mb-3 flex items-center gap-2"
              style={{ color: GOLD_LIGHT }}
            >
              <Lightbulb className="w-4 h-4" style={{ color: GOLD }} />
              {labels.recTitle[lang]}
            </h3>

            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{
                    background: 'rgba(212,164,74,0.06)',
                    border: '1px solid rgba(212,164,74,0.15)',
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: `${strengthColor(breakdowns.find(b => b.questName === rec.subject)?.overallPercentage || 0)}22`,
                      border: `1.5px solid ${strengthColor(breakdowns.find(b => b.questName === rec.subject)?.overallPercentage || 0)}44`,
                    }}
                  >
                    <BookOpen className="w-3.5 h-3.5" style={{ color: strengthColor(breakdowns.find(b => b.questName === rec.subject)?.overallPercentage || 0) }} />
                  </div>
                  <div>
                    <span className="font-bold text-sm" style={{ color: GOLD_LIGHT }}>
                      {rec.subject}
                    </span>
                    <p className="text-sm mt-0.5" style={{ color: 'rgba(200,184,138,0.7)' }}>
                      {rec.tip[lang]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FantasyPanel>

          {/* ═══════════════════════════════
              SECTION 5: Foxy Toy + Referral
             ═══════════════════════════════ */}
          <FoxyToySection
            childName={childName}
            weakSubjects={weakSubjects}
            questionsAnswered={allAnswers.length}
            id="foxy-toy-section"
          />

          {/* ═══════════════════════════════
              CTA Buttons: Download + Share
             ═══════════════════════════════ */}
          <div className="space-y-3 pb-4">
            <GlossyButton
              onClick={handleDownloadPDF}
              color="gold"
              size="lg"
              className="w-full"
              disabled={isGeneratingPDF}
              icon={<Download className="w-5 h-5" />}
            >
              {isGeneratingPDF
                ? (lang === 'en' ? 'Generating...' : lang === 'ms' ? 'Menjana...' : '生成中...')
                : labels.downloadPDF[lang]}
            </GlossyButton>

            <GlossyButton
              onClick={() => setShowSharePanel(true)}
              color="green"
              size="md"
              className="w-full"
              icon={<Share2 className="w-5 h-5" />}
            >
              {labels.shareResults[lang]}
            </GlossyButton>

            <p
              className="text-center text-[10px] pt-2"
              style={{ color: 'rgba(200,184,138,0.3)' }}
            >
              {labels.disclaimer[lang]}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex-shrink-0">
          <FantasyFooter />
        </div>
      </div>

      {/* ═══════════════════════════════
          Share Panel — Slide-up modal
         ═══════════════════════════════ */}
      {showSharePanel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSharePanel(false)}
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-lg rounded-t-2xl p-5 pb-8"
            style={{
              background: 'linear-gradient(135deg, rgba(30,22,12,0.98) 0%, rgba(20,16,10,0.99) 100%)',
              border: '1px solid rgba(212,164,74,0.3)',
              borderBottom: 'none',
              animation: 'share-slide-up 0.3s ease-out',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowSharePanel(false)}
              className="absolute top-3 right-3 p-2 rounded-full transition-colors"
              style={{ color: 'rgba(200,184,138,0.5)' }}
            >
              <X className="w-5 h-5" />
            </button>

            <h3
              className="text-lg font-bold mb-4"
              style={{ color: GOLD_LIGHT, fontFamily: "'Cinzel Decorative', serif" }}
            >
              {labels.shareResults[lang]}
            </h3>

            {/* Share buttons grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <ShareButton
                icon={<MessageCircle className="w-6 h-6" />}
                label="WhatsApp"
                color="#25D366"
                onClick={handleWhatsAppShare}
              />
              <ShareButton
                icon={<Facebook className="w-6 h-6" />}
                label="Facebook"
                color="#1877F2"
                onClick={handleFacebookShare}
              />
              <ShareButton
                icon={<Instagram className="w-6 h-6" />}
                label="Instagram"
                color="#E4405F"
                onClick={handleInstagramShare}
              />
            </div>

            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-200"
              style={{
                background: 'rgba(212,164,74,0.1)',
                border: '1.5px solid rgba(212,164,74,0.3)',
                color: GOLD_LIGHT,
              }}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" style={{ color: '#7cc643' }} />
                  {lang === 'en' ? 'Copied!' : lang === 'ms' ? 'Disalin!' : '已复制！'}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  {lang === 'en' ? 'Copy to clipboard' : lang === 'ms' ? 'Salin ke papan keratan' : '复制到剪贴板'}
                </>
              )}
            </button>
          </div>

          {/* Animation */}
          <style>{`
            @keyframes share-slide-up {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

// ── Stat Card (emoji-free) ──
function StatCard({
  label,
  value,
  sublabel,
  color,
  icon,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-3 text-center"
      style={{
        background: 'rgba(30,22,12,0.7)',
        border: `1.5px solid ${color}44`,
        boxShadow: `0 0 12px ${color}15`,
      }}
    >
      {icon && <div className="flex justify-center mb-0.5">{icon}</div>}
      <div className="text-2xl md:text-3xl font-black" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] font-bold" style={{ color: 'rgba(200,184,138,0.5)' }}>
        {sublabel}
      </div>
      <div className="text-xs font-bold mt-0.5" style={{ color: '#c8b88a' }}>
        {label}
      </div>
    </div>
  );
}

// ── Share Button ──
function ShareButton({
  icon,
  label,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-200 active:scale-95 hover:scale-105"
      style={{
        background: `${color}15`,
        border: `1.5px solid ${color}44`,
      }}
    >
      <div style={{ color }}>{icon}</div>
      <span className="text-xs font-bold" style={{ color: 'rgba(200,184,138,0.8)' }}>
        {label}
      </span>
    </button>
  );
}

// ── Subject Row (no emoji icons) ──
function SubjectRow({
  breakdown,
  childAge,
  lang,
}: {
  breakdown: SubjectAgeBreakdown;
  childAge: number;
  lang: 'en' | 'ms' | 'zh';
}) {
  const pct = breakdown.overallPercentage;
  const barColor =
    pct >= 80 ? '#7cc643' : pct >= 60 ? GOLD : pct >= 40 ? '#4dabf7' : '#e74c3c';

  const ageLevelLabel = {
    en: `Age ${breakdown.functionalAge} Level`,
    ms: `Tahap Umur ${breakdown.functionalAge}`,
    zh: `${breakdown.functionalAge}岁水平`,
  };

  return (
    <div>
      {/* Subject header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{
              background: `${barColor}22`,
              border: `1.5px solid ${barColor}44`,
            }}
          >
            <BookOpen className="w-3.5 h-3.5" style={{ color: barColor }} />
          </div>
          <span className="font-bold text-sm" style={{ color: GOLD_LIGHT }}>
            {breakdown.questName}
          </span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background: `${barColor}22`,
            color: barColor,
            border: `1px solid ${barColor}44`,
          }}
        >
          {ageLevelLabel[lang]}
        </span>
      </div>

      {/* Score bar */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="flex-1 h-2.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(212,164,74,0.1)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${barColor} 0%, ${barColor}cc 100%)`,
              boxShadow: `0 0 8px ${barColor}44`,
            }}
          />
        </div>
        <span className="text-xs font-bold flex-shrink-0" style={{ color: barColor }}>
          {pct}%
        </span>
      </div>

      {/* Age ladder */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {breakdown.ageLevels
          .filter((a) => a.total > 0)
          .map((a) => (
            <div key={a.age} className="flex items-center gap-1">
              <span
                className="text-[10px] font-bold"
                style={{ color: 'rgba(200,184,138,0.5)' }}
              >
                {a.age}:
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: a.total }, (_, i) => (
                  <span key={i} className="text-xs">
                    {i < a.correct ? (
                      <CheckCircle2
                        className="w-3.5 h-3.5 inline"
                        style={{ color: '#7cc643' }}
                      />
                    ) : (
                      <XCircle
                        className="w-3.5 h-3.5 inline"
                        style={{ color: '#e74c3c66' }}
                      />
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}