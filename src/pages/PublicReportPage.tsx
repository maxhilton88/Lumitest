/**
 * PublicReportPage.tsx — Premium minimalist shareable report page.
 *
 * Public route: /report/:reportId
 * No auth required to view (conversion funnel for parents).
 * Features:
 *  - Real TP/functional-age calculations from report-calculations.ts
 *  - Progressive urgency banner (30-day expiry)
 *  - Expired state with sign-up CTA
 *  - FOXY-o1 promo card
 *  - Parent sign-up CTA
 *  - PDF download via browser print
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { getFreshParentToken } from '../utils/supabase-client';
import {
  calculateTP,
  calculateSubjectBreakdowns,
  buildRadarData,
  calculateReadiness,
  calculateTotalStars,
  generateRecommendations,
  type DetailedAnswer,
} from '../utils/report-calculations';
import { SpiderWebChart } from '../components/SpiderWebChart';
import {
  Download,
  Clock,
  AlertTriangle,
  Shield,
  BookOpen,
  Target,
  Lightbulb,
  UserPlus,
  ChevronRight,
  Star,
  Languages,
  Calculator,
  FlaskConical,
  Palette,
  Music,
  Heart,
  GraduationCap,
  CheckCircle2,
  Swords,
  ShieldCheck,
  Play,
  Sparkles,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
} from 'lucide-react';

// ── Asset imports ──
import foxyToyImage from 'figma:asset/b61978b8324fd7cbb0fe6f55a1541b1f1e24ee8a.png';
import defaultLogoImage from 'figma:asset/2e0c783ac190a60b73980e37d91395b048cdd5f9.png';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

// ── Color palette (premium minimalist) ──
const GOLD = '#b8953e';
const GOLD_LIGHT = '#f5ecd7';
const TEXT_PRIMARY = '#1a1a1a';
const TEXT_SECONDARY = '#6b7280';
const BG_WARM = '#faf9f6';

// Short subject labels for radar chart
const SUBJECT_SHORT: Record<string, string> = {
  english: 'English',
  numbers: 'Math',
  mathematics: 'Math',
  math: 'Math',
  bahasa: 'BM',
  'bahasa melayu': 'BM',
  mandarin: 'Mandarin',
  chinese: 'Mandarin',
  science: 'Science',
  moral: 'Moral',
  art: 'Art',
  music: 'Music',
};

function strengthColor(pct: number) {
  if (pct >= 80) return '#16a34a';
  if (pct >= 60) return GOLD;
  if (pct >= 40) return '#2563eb';
  return '#dc2626';
}

function strengthLabel(pct: number) {
  if (pct >= 80) return 'Excellent';
  if (pct >= 60) return 'Good';
  if (pct >= 40) return 'Developing';
  return 'Needs Practice';
}

// Subject → lucide line icon (replaces emoji icons for cleaner look)
function getSubjectIcon(name: string): React.ReactNode {
  const lower = name.toLowerCase();
  if (lower.includes('english')) return <Languages className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
  if (lower.includes('math') || lower.includes('number')) return <Calculator className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
  if (lower.includes('bahasa') || lower.includes('bm')) return <Languages className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
  if (lower.includes('mandarin') || lower.includes('chinese')) return <Languages className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
  if (lower.includes('science') || lower.includes('sains')) return <FlaskConical className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
  if (lower.includes('moral')) return <Heart className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
  if (lower.includes('art') || lower.includes('seni')) return <Palette className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
  if (lower.includes('music') || lower.includes('muzik')) return <Music className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
  return <GraduationCap className="w-4 h-4" style={{ color: TEXT_SECONDARY }} />;
}

export function PublicReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [expired, setExpired] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isClaimed, setIsClaimed] = useState(false);

  useEffect(() => {
    if (!reportId) return;
    const fetchReport = async () => {
      try {
        const res = await fetch(`${API_BASE}/reports/${reportId}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Report not found');
          return;
        }
        if (data.expired) {
          setExpired(true);
          setReportData(data.report);
        } else {
          setReportData(data.report);
          setDaysRemaining(data.daysRemaining);
          setIsClaimed(data.isClaimed);
        }
      } catch (err: any) {
        console.error('[PUBLIC-REPORT] Fetch error:', err);
        setError('Failed to load report. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId]);

  // ── Auto-claim: if a logged-in parent visits, claim this report ──
  useEffect(() => {
    if (!reportId || !reportData || isClaimed || expired) return;
    const tryClaim = async () => {
      try {
        const parentToken = await getFreshParentToken();
        if (!parentToken) return; // Not logged in as parent — skip

        console.log('[PUBLIC-REPORT] Parent is logged in, attempting auto-claim...');
        const res = await fetch(`${API_BASE}/reports/${reportId}/claim`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${parentToken}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsClaimed(true);
          console.log('[PUBLIC-REPORT] Report auto-claimed successfully');
        } else {
          console.warn('[PUBLIC-REPORT] Auto-claim failed:', data.error);
        }
      } catch (err) {
        console.warn('[PUBLIC-REPORT] Auto-claim error (non-fatal):', err);
      }
    };
    tryClaim();
  }, [reportId, reportData, isClaimed, expired]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG_WARM }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: `${GOLD} transparent ${GOLD} ${GOLD}` }} />
          <p className="text-sm" style={{ color: TEXT_SECONDARY }}>Loading report...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG_WARM }}>
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: TEXT_PRIMARY }}>Report Not Found</h1>
          <p className="text-sm" style={{ color: TEXT_SECONDARY }}>
            This report link may be invalid or has been removed. Please contact the kindergarten for assistance.
          </p>
        </div>
      </div>
    );
  }

  // ── Expired state ──
  if (expired && reportData) {
    return <ExpiredReportPage report={reportData} />;
  }

  if (!reportData) return null;

  return <LiveReport report={reportData} daysRemaining={daysRemaining} isClaimed={isClaimed} />;
}

// ═══════════════════════════════════════════════════════════
// EXPIRED REPORT PAGE
// ═══════════════════════════════════════════════════════════

function ExpiredReportPage({ report }: { report: any }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: BG_WARM }}>
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: GOLD_LIGHT }}>
          <Clock className="w-10 h-10" style={{ color: GOLD }} />
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: TEXT_PRIMARY }}>
          This Report Has Expired
        </h1>
        <p className="mb-6 leading-relaxed" style={{ color: TEXT_SECONDARY }}>
          <strong>{report.childName}</strong>'s KSSR readiness report was available for 30 days.
          To access detailed assessment reports permanently, create your free parent account.
        </p>
        <a
          href="/?signup=1"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-base transition-all hover:opacity-90"
          style={{ background: TEXT_PRIMARY }}
        >
          <UserPlus className="w-5 h-5" />
          Sign Up Free — See All Reports
        </a>
        {report.schoolName && (
          <p className="mt-8 text-xs" style={{ color: TEXT_SECONDARY }}>
            Questions? Contact <strong>{report.schoolName}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// LIVE REPORT
// ═══════════════════════════════════════════════════════════

function LiveReport({
  report,
  daysRemaining,
  isClaimed,
}: {
  report: any;
  daysRemaining: number | null;
  isClaimed: boolean;
}) {
  // ── Parse answers ──
  const answers: DetailedAnswer[] = (report.answers || []).map((a: any) => ({
    questionId: a.questionId || a.question_id || '',
    answerId: a.answerId || a.answer_id || '',
    correctAnswer: a.correctAnswer || a.correct_answer || '',
    isCorrect: a.isCorrect ?? a.is_correct ?? false,
    quest: a.quest || '',
    ageDifficulty: a.ageDifficulty ?? a.age_difficulty ?? 5,
  }));

  const hasAnswers = answers.length > 0;

  // ── Calculations (only if we have detailed answers) ──
  const readiness = hasAnswers ? calculateReadiness(answers) : {
    score: report.score || 0,
    total: report.totalQuestions || 0,
    percentage: report.totalQuestions > 0 ? Math.round(((report.score || 0) / report.totalQuestions) * 100) : 0,
  };

  const tp = hasAnswers ? calculateTP(answers) : null;

  // Build quest name map from questInfo
  const questNameMap: Record<string, { name: string; icon: string }> = {};
  (report.questInfo || []).forEach((q: any) => {
    const name = typeof q.name === 'object' ? (q.name.en || q.subject) : (q.name || q.subject);
    questNameMap[q.id] = { name, icon: q.icon || '' };
  });
  // Also try to populate from answers quest IDs
  const allQuestIds = new Set(answers.map((a) => a.quest));
  allQuestIds.forEach((id) => {
    if (!questNameMap[id]) {
      questNameMap[id] = { name: id, icon: '' };
    }
  });

  const breakdowns = hasAnswers ? calculateSubjectBreakdowns(answers, questNameMap) : [];

  // Radar data with short labels
  const radarLabelMap: Record<string, { name: string; icon: string }> = {};
  (report.questInfo || []).forEach((q: any) => {
    const shortLabel = SUBJECT_SHORT[q.subject?.toLowerCase()] || q.subject;
    radarLabelMap[q.id] = { name: shortLabel, icon: q.icon || '' };
  });
  allQuestIds.forEach((id) => {
    if (!radarLabelMap[id]) {
      radarLabelMap[id] = { name: SUBJECT_SHORT[id.toLowerCase()] || id, icon: '' };
    }
  });
  const radarBreakdowns = hasAnswers ? calculateSubjectBreakdowns(answers, radarLabelMap) : [];
  const radarData = buildRadarData(radarBreakdowns);

  const recommendations = hasAnswers ? generateRecommendations(breakdowns, report.childName) : [];
  const moduleResults: Record<string, { score: number; total: number }> = {};
  breakdowns.forEach((b) => {
    moduleResults[b.questId] = { score: b.overallScore, total: b.overallTotal };
  });
  const stars = calculateTotalStars(moduleResults);

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const reportDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : today;

  const tpColor = tp
    ? tp.level >= 5 ? '#16a34a' : tp.level >= 4 ? GOLD : tp.level >= 3 ? '#2563eb' : '#dc2626'
    : GOLD;

  const handlePrint = () => window.print();

  // Urgency banner
  const showUrgency = !isClaimed && daysRemaining !== null;
  const urgencyLevel = daysRemaining !== null
    ? daysRemaining <= 2 ? 'critical' : daysRemaining <= 7 ? 'warning' : 'info'
    : 'info';

  return (
    <div className="min-h-screen" style={{ background: BG_WARM }}>
      {/* ── Urgency Banner ── */}
      {showUrgency && daysRemaining !== null && (
        <div
          className="print:hidden sticky top-0 z-50 px-4 py-2.5 text-center text-sm font-medium"
          style={{
            background: urgencyLevel === 'critical' ? '#fef2f2' : urgencyLevel === 'warning' ? '#fffbeb' : '#f0fdf4',
            color: urgencyLevel === 'critical' ? '#991b1b' : urgencyLevel === 'warning' ? '#92400e' : '#166534',
            borderBottom: `1px solid ${urgencyLevel === 'critical' ? '#fecaca' : urgencyLevel === 'warning' ? '#fde68a' : '#bbf7d0'}`,
          }}
        >
          {urgencyLevel === 'critical' ? (
            <span className="flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              This report expires {daysRemaining === 0 ? 'today' : daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`}.
              <a href="/?signup=1" className="underline font-bold ml-1">Sign up now to keep it.</a>
            </span>
          ) : urgencyLevel === 'warning' ? (
            <span className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              This report expires in {daysRemaining} days.
              <a href="/?signup=1" className="underline font-semibold ml-1">Sign up to save it permanently.</a>
            </span>
          ) : (
            <span style={{ color: TEXT_SECONDARY }}>
              Report available until {report.expiresAt ? new Date(report.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </span>
          )}
        </div>
      )}

      {/* ── Report Content ── */}
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-12" id="public-report">
        {/* ── Branded School Header ── */}
        <header className="rounded-xl overflow-hidden mb-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          {/* Top: Logo + PDF button */}
          <div className="p-6 pb-0 flex items-start justify-between">
            <img
              src={report.schoolLogoUrl || defaultLogoImage}
              alt={`${report.schoolName || 'School'} logo`}
              className="h-10 sm:h-12 w-auto object-contain"
            />
            <button
              onClick={handlePrint}
              className="print:hidden flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-gray-50 flex-shrink-0"
              style={{ borderColor: '#e5e7eb', color: TEXT_SECONDARY }}
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>

          {/* Report title */}
          <div className="px-6 pt-3 pb-1">
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: TEXT_SECONDARY }}>
              KSSR Readiness Report
            </p>
          </div>

          {/* School name + contact info */}
          <div className="px-6 pb-5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight mb-1.5" style={{ color: TEXT_PRIMARY }}>
              {report.schoolName || 'Kindergarten'}
            </h1>
            {(report.schoolAddress || report.schoolEmail || report.schoolPhone || report.schoolWhatsApp) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1" style={{ color: TEXT_SECONDARY }}>
                {report.schoolAddress && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[240px]">{report.schoolAddress}</span>
                  </span>
                )}
                {report.schoolPhone && (
                  <a href={`tel:${report.schoolPhone}`} className="flex items-center gap-1.5 text-xs hover:underline">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    {report.schoolPhone}
                  </a>
                )}
                {report.schoolWhatsApp && (
                  <a
                    href={`https://wa.me/${report.schoolWhatsApp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs hover:underline"
                  >
                    <MessageCircle className="w-3 h-3 flex-shrink-0" />
                    {report.schoolWhatsApp}
                  </a>
                )}
                {report.schoolEmail && (
                  <a href={`mailto:${report.schoolEmail}`} className="flex items-center gap-1.5 text-xs hover:underline">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    {report.schoolEmail}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #e5e7eb' }} />

          {/* Child info row */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: TEXT_SECONDARY }}>Child</p>
              <p className="font-semibold" style={{ color: TEXT_PRIMARY }}>{report.childName}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: TEXT_SECONDARY }}>Age</p>
              <p className="font-semibold" style={{ color: TEXT_PRIMARY }}>{report.childAge} years</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: TEXT_SECONDARY }}>School</p>
              <p className="font-semibold" style={{ color: TEXT_PRIMARY }}>{report.schoolName}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: TEXT_SECONDARY }}>Date</p>
              <p className="font-semibold" style={{ color: TEXT_PRIMARY }}>{reportDate}</p>
            </div>
          </div>
        </header>

        {/* Overall Score + TP */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Score Card */}
          <div className="rounded-xl p-6 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: TEXT_SECONDARY }}>Overall Score</p>
            <div className="relative w-28 h-28 mx-auto mb-3">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={TEXT_PRIMARY}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${readiness.percentage * 2.64} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black" style={{ color: TEXT_PRIMARY }}>
                  {readiness.percentage}%
                </span>
              </div>
            </div>
            <p className="text-sm font-medium" style={{ color: TEXT_SECONDARY }}>
              {readiness.score}/{readiness.total} correct
            </p>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[...Array(3)].map((_, i) => (
                <Star key={i} className="w-4 h-4" fill={i < Math.min(3, Math.ceil(readiness.percentage / 33)) ? '#f59e0b' : 'none'} stroke={i < Math.min(3, Math.ceil(readiness.percentage / 33)) ? '#f59e0b' : '#d1d5db'} />
              ))}
            </div>
          </div>

          {/* TP Card */}
          {tp && (
            <div className="rounded-xl p-6 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: TEXT_SECONDARY }}>
                Tahap Penguasaan (TP)
              </p>
              <div className="flex items-center justify-center gap-1 mb-3">
                {[1, 2, 3, 4, 5, 6].map((level) => (
                  <div
                    key={level}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: level <= tp.level ? TEXT_PRIMARY : '#f3f4f6',
                      color: level <= tp.level ? '#fff' : '#9ca3af',
                    }}
                  >
                    {level}
                  </div>
                ))}
              </div>
              <p className="text-lg font-bold mb-1" style={{ color: TEXT_PRIMARY }}>
                TP{tp.level}: {tp.labelEN}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                {report.childName} {tp.description.en}
              </p>
            </div>
          )}
        </section>

        {/* Radar Chart */}
        {radarData.length >= 3 && (
          <section className="rounded-xl p-6 mb-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
              <Target className="w-4 h-4" style={{ color: GOLD }} />
              Functional Age by Subject
            </h2>
            <div className="flex justify-center">
              <SpiderWebChart data={radarData} childAge={report.childAge} chartHeight={280} maxWidth={340} theme="light" />
            </div>
            <p className="text-xs text-center mt-3" style={{ color: TEXT_SECONDARY }}>
              Each axis shows the highest age level where your child scored 50%+
            </p>
          </section>
        )}

        {/* Subject Breakdown */}
        {breakdowns.length > 0 && (
          <section className="rounded-xl p-6 mb-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
              <BookOpen className="w-4 h-4" style={{ color: GOLD }} />
              Subject Performance
            </h2>
            <div className="space-y-4">
              {breakdowns.map((b) => (
                <div key={b.questId}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
                      {getSubjectIcon(b.questName)} {b.questName}
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: '#f3f4f6',
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {strengthLabel(b.overallPercentage)}
                      </span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: TEXT_PRIMARY }}>
                        {b.overallPercentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${b.overallPercentage}%`, background: TEXT_PRIMARY }}
                    />
                  </div>
                  {/* Age-level dots */}
                  <div className="flex items-center gap-4 mt-2">
                    {b.ageLevels.filter(a => a.total > 0).map((a) => (
                      <div key={a.age} className="flex items-center gap-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: a.passed ? '#16a34a' : '#dc2626' }}
                        />
                        <span className="text-xs" style={{ color: TEXT_SECONDARY }}>
                          Age {a.age}: {a.correct}/{a.total}
                        </span>
                      </div>
                    ))}
                    <span className="text-xs font-medium ml-auto" style={{ color: GOLD }}>
                      Functional Age: {b.functionalAge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <section className="rounded-xl p-6 mb-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <h2 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: TEXT_PRIMARY }}>
              <Lightbulb className="w-4 h-4" style={{ color: GOLD }} />
              Personalised Recommendations
            </h2>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: BG_WARM }}>
                  <div className="flex-shrink-0 mt-0.5">{getSubjectIcon(rec.subject)}</div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: TEXT_PRIMARY }}>{rec.subject}</p>
                    <p className="text-sm leading-relaxed" style={{ color: TEXT_SECONDARY }}>{rec.tip.en}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══ FOXY-o1 Promo Card ═══ */}
        <section className="rounded-xl overflow-hidden mb-8 print:hidden" style={{ border: `2px solid ${GOLD}` }}>
          <div className="p-6 sm:p-8" style={{ background: `linear-gradient(135deg, #fffdf5, ${GOLD_LIGHT})` }}>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Text side */}
              <div className="flex-1 text-center sm:text-left">
                <div
                  className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3"
                  style={{ background: GOLD, color: '#fff' }}
                >
                  Limited Intro Offer
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color: TEXT_PRIMARY }}>
                  FOXY-o1 AI Companion
                </h3>
                <p className="text-sm mb-4 leading-relaxed" style={{ color: TEXT_SECONDARY }}>
                  Your child's personal AI tutor — practices weak subjects daily with voice interaction, tracks progress, and makes learning feel like play.
                </p>
                <div className="flex items-center gap-3 justify-center sm:justify-start mb-4">
                  <span className="text-sm line-through" style={{ color: TEXT_SECONDARY }}>RM730</span>
                  <span className="text-2xl font-black" style={{ color: GOLD }}>RM365</span>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: '#dc2626', color: '#fff' }}
                  >
                    -50%
                  </span>
                </div>
                <p className="text-xs mb-4" style={{ color: TEXT_SECONDARY }}>
                  Only RM1/day. Includes FOXY-o1 AI toy + Foxy Adventure app (1 year).
                </p>
                <a
                  href="/?plan=planB"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: TEXT_PRIMARY, color: '#fff' }}
                >
                  Get FOXY-o1
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
              {/* Image placeholder */}
              <div
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden flex-shrink-0"
                style={{ background: 'rgba(184,149,62,0.08)' }}
              >
                <img
                  src={foxyToyImage}
                  alt="FOXY-o1 AI Companion Toy"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══ Sign-up CTA (always visible — conversion content for all visitors) ═══ */}
        <section className="rounded-xl overflow-hidden mb-8 print:hidden" style={{ border: '1px solid #e5e7eb' }}>
          {/* Header */}
          <div className="p-6 sm:p-8 text-center" style={{ background: TEXT_PRIMARY }}>
            <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: GOLD }} />
            <h3 className="text-xl font-bold text-white mb-2">
              Unlock More Power for Your Kids
            </h3>
            <p className="text-sm max-w-md mx-auto" style={{ color: '#9ca3af' }}>
              Sign up for free to save {report.childName}'s report permanently and access the full Foxy Adventure platform.
            </p>
          </div>

          {/* What's Included */}
          <div className="p-6 sm:px-8" style={{ background: '#fff' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: TEXT_SECONDARY }}>
              What's Included
            </p>
            <div className="space-y-2.5">
              {[
                'TP Proficiency Level (1-6)',
                'Spider Web readiness chart',
                'Subject-by-subject analysis',
                'Functional age per subject',
                'Personalized recommendations',
                'Downloadable PDF report',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                  <span className="text-sm" style={{ color: TEXT_PRIMARY }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Also Included — Free Forever */}
          <div className="px-6 sm:px-8 pb-6" style={{ background: '#fff' }}>
            <div className="border-t pt-5 mt-1" style={{ borderColor: '#e5e7eb' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: TEXT_SECONDARY }}>
                Also Included — Free Forever
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: <Swords className="w-5 h-5" />, title: 'Quest Mode', desc: 'Unlimited KSSR tests' },
                  { icon: <ShieldCheck className="w-5 h-5" />, title: 'Training Mode', desc: 'Thousands of questions' },
                  { icon: <Play className="w-5 h-5" />, title: 'Video Mode', desc: 'Foxy learning videos' },
                ].map((feat, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-3 text-center"
                    style={{ background: BG_WARM, border: '1px solid #e5e7eb' }}
                  >
                    <div className="flex justify-center mb-1.5" style={{ color: TEXT_SECONDARY }}>{feat.icon}</div>
                    <p className="text-xs font-bold mb-0.5" style={{ color: TEXT_PRIMARY }}>{feat.title}</p>
                    <p className="text-[10px] leading-tight" style={{ color: TEXT_SECONDARY }}>{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Button + reassurance */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 text-center" style={{ background: '#fff' }}>
            <a
              href="/?signup=1"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-10 py-4 rounded-xl text-base font-bold transition-all hover:opacity-90"
              style={{ background: TEXT_PRIMARY, color: '#fff' }}
            >
              <UserPlus className="w-5 h-5" />
              Unlock {report.childName}'s Report — Free!
            </a>
            <p className="text-xs mt-3 font-medium" style={{ color: TEXT_SECONDARY }}>
              Free &bull; No credit card required &bull; Takes 30 seconds
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center pt-6 pb-8 border-t" style={{ borderColor: '#e5e7eb' }}>
          <p className="text-xs" style={{ color: TEXT_SECONDARY }}>
            Powered by <strong>Foxy Adventure</strong> — KSSR Readiness Assessment
          </p>
          {report.schoolName && (
            <p className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>
              Assessment conducted at <strong>{report.schoolName}</strong>
            </p>
          )}
        </footer>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          #public-report {
            max-width: 100%;
            padding: 0 20px;
          }
          section {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}