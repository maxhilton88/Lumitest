import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, ArrowLeft, RefreshCw, Search, UserX, TrendingUp,
  BookOpen, Play, Dumbbell, Calendar, Star, Award,
  ChevronRight, Loader2, GraduationCap,
  Activity, BarChart2, Clock, Baby, Copy, Check,
  ClipboardList, MessageCircle, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { fetchKGStudents, fetchKGStudentDetail, disconnectKGStudent } from '../../utils/api';
import { getFreshAdminToken } from '../../utils/supabase-client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { SpiderWebChart } from '../SpiderWebChart';
import {
  LineChart, Line, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

// ===== TYPES =====
interface StudentSummary {
  parentId: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  childAge: number;
  connectedAt: string;
}

interface StudentDetail {
  parentId: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  childAge: number;
  subscriptionStatus: string;
  connectedAt: string;
  totalTests: number;
  totalWatches: number;
  totalPractices: number;
  totalPracticeQuestions: number;
}

interface Assessment {
  date: string;
  timestamp: string;
  childAge: number;
  overallPct: number;
  readinessPct: number;
  totalStars: number;
  maxStars: number;
  tpLevel: number;
  totalQuestions: number;
  totalCorrect: number;
  subjectSummary: { name: string; pct: number; functionalAge: number }[];
}

interface ActivityRecord {
  date: string;
  tests: number;
  watches: number;
  practices: number;
  questions_total: number;
  questions_correct: number;
}

// ===== HELPERS =====
const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
};

const getReadinessColor = (pct: number) => {
  if (pct >= 80) return '#22c55e';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
};

const getReadinessLabel = (pct: number) => {
  if (pct >= 80) return 'Ready';
  if (pct >= 60) return 'Developing';
  return 'Needs Support';
};

// ===== TEACHER BRIEFING HELPERS =====
interface BriefingItem {
  subject: string;
  functionalAge: number;
  pct: number;
  status: 'strong' | 'onTrack' | 'needsSupport';
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  ageDelta: number;
  deltaLabel: string;
  tip: string;
}

const tipMap: Record<string, { weak: string; strong: string }> = {
  english: {
    weak: 'Read English storybooks together for 15 minutes daily. Focus on letter sounds and simple words.',
    strong: 'Great English skills! Try introducing short chapter books and encourage writing simple sentences.',
  },
  numbers: {
    weak: 'Practice counting everyday objects \u2014 toys, fruits, steps. Use fingers and blocks for addition.',
    strong: 'Strong number sense! Introduce simple word problems and pattern recognition games.',
  },
  math: {
    weak: 'Practice counting everyday objects \u2014 toys, fruits, steps. Use fingers and blocks for addition.',
    strong: 'Strong number sense! Introduce simple word problems and pattern recognition games.',
  },
  bahasa: {
    weak: 'Sing BM nursery rhymes and read Malay picture books together. Practice suku kata (syllables).',
    strong: 'Excellent BM foundation! Encourage creating simple stories and writing in Jawi.',
  },
  melayu: {
    weak: 'Sing BM nursery rhymes and read Malay picture books together. Practice suku kata (syllables).',
    strong: 'Excellent BM foundation! Encourage creating simple stories and writing in Jawi.',
  },
  mandarin: {
    weak: 'Practice Chinese character recognition with flashcards. Sing Chinese nursery rhymes daily.',
    strong: 'Great Mandarin progress! Introduce simple reading books with pinyin and stroke writing practice.',
  },
  chinese: {
    weak: 'Practice Chinese character recognition with flashcards. Sing Chinese nursery rhymes daily.',
    strong: 'Great Mandarin progress! Introduce simple reading books with pinyin and stroke writing practice.',
  },
  science: {
    weak: 'Explore nature together \u2014 observe plants, animals, weather. Ask "why" questions during walks.',
    strong: 'Wonderful curiosity! Try simple science experiments at home \u2014 mixing colours, growing seeds.',
  },
};

function getTipForSubject(subjectName: string, isStrong: boolean): string {
  const lower = subjectName.toLowerCase();
  for (const [key, tips] of Object.entries(tipMap)) {
    if (lower.includes(key)) {
      return isStrong ? tips.strong : tips.weak;
    }
  }
  return isStrong
    ? `Great performance in ${subjectName}! Keep up the excellent work with daily practice.`
    : `More practice needed in ${subjectName}. Try 10\u201315 minutes of focused activity daily.`;
}

function buildTeacherBriefing(
  subjectSummary: { name: string; pct: number; functionalAge: number }[] | undefined,
  childAge: number,
): BriefingItem[] {
  if (!subjectSummary?.length) return [];

  return subjectSummary
    .map((s) => {
      const delta = s.functionalAge - childAge;
      const isStrong = delta > 0;
      const isOnTrack = delta === 0;

      let status: BriefingItem['status'];
      let statusLabel: string;
      let statusColor: string;
      let statusBg: string;
      let deltaLabel: string;

      if (delta > 0) {
        status = 'strong';
        statusLabel = 'Strong';
        statusColor = '#16a34a';
        statusBg = '#f0fdf4';
        deltaLabel = `${delta}yr above expected`;
      } else if (delta === 0) {
        status = 'onTrack';
        statusLabel = 'On Track';
        statusColor = '#d97706';
        statusBg = '#fffbeb';
        deltaLabel = 'At expected level';
      } else {
        status = 'needsSupport';
        statusLabel = 'Needs Support';
        statusColor = '#dc2626';
        statusBg = '#fef2f2';
        deltaLabel = `${Math.abs(delta)}yr below expected`;
      }

      return {
        subject: s.name,
        functionalAge: s.functionalAge,
        pct: s.pct,
        status,
        statusLabel,
        statusColor,
        statusBg,
        ageDelta: delta,
        deltaLabel,
        tip: getTipForSubject(s.name, isStrong || isOnTrack),
      };
    })
    .sort((a, b) => a.ageDelta - b.ageDelta); // weakest first
}

function generateCopyText(
  childName: string,
  childAge: number,
  readinessPct: number,
  date: string,
  briefing: BriefingItem[],
): string {
  const lines: string[] = [];
  lines.push(`KSSR Readiness Report \u2014 ${childName} (Age ${childAge})`);
  lines.push(`Assessment Date: ${formatDate(date)}`);
  lines.push(`Overall Readiness: ${readinessPct}%`);
  lines.push('');

  briefing.forEach((b) => {
    const icon = b.status === 'strong' ? '\u2705' : b.status === 'onTrack' ? '\u26a0\ufe0f' : '\ud83d\udfe5';
    const ageInfo = `Age ${b.functionalAge} of ${childAge}`;
    lines.push(`${icon} ${b.statusLabel.toUpperCase()} \u2014 ${b.subject} (${ageInfo}, ${b.deltaLabel})`);
    lines.push(`   \u2192 ${b.tip}`);
    lines.push('');
  });

  lines.push('\u2014 Generated by Foxy Adventure');
  return lines.join('\n');
}

// ===== STAT CARD =====
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color?: string; sub?: string }> = ({ icon, label, value, color = '#6366f1', sub }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
      <div style={{ color }}>{icon}</div>
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ===== AGE COMPARISON BAR =====
const AgeBar: React.FC<{ childAge: number; functionalAge: number; color: string }> = ({ childAge, functionalAge, color }) => {
  // Scale: ages 3-8
  const min = 3;
  const max = 8;
  const range = max - min;
  const childPct = ((childAge - min) / range) * 100;
  const funcPct = ((functionalAge - min) / range) * 100;

  return (
    <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
      {/* Expected age marker */}
      <div
        className="absolute top-0 h-full w-0.5 bg-gray-400 z-10"
        style={{ left: `${childPct}%` }}
        title={`Expected: Age ${childAge}`}
      />
      {/* Functional age fill */}
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(funcPct, 5)}%`, backgroundColor: color }}
      />
    </div>
  );
};

// ===== STUDENT DETAIL VIEW =====
const StudentDetailView: React.FC<{
  studentId: string;
  onBack: () => void;
  onDisconnect: () => void;
}> = ({ studentId, onBack, onDisconnect }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<'readiness' | 'history' | 'activity'>('readiness');
  const [briefingCopied, setBriefingCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchKGStudentDetail(studentId);
        setStudent(data.student);
        setAssessments(data.assessments || []);
        setActivities(data.activities || []);
      } catch (err: any) {
        toast.error(`Failed to load student data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [studentId]);

  const handleDisconnect = async () => {
    if (!confirm('Remove this student from your class? They will need to reconnect using your school code to share data again.')) return;
    setIsDisconnecting(true);
    try {
      await disconnectKGStudent(studentId);
      toast.success('Student removed from your class.');
      onDisconnect();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!student) return null;

  const latestAssessment = assessments[assessments.length - 1];
  const firstAssessment = assessments[0];

  // Spider web data — uses functionalAge, consistent with child's page
  const spiderData = latestAssessment?.subjectSummary?.map(s => ({
    subject: s.name,
    functionalAge: s.functionalAge,
    fullMark: 7,
  })) || [];

  // Teacher briefing items
  const briefing = buildTeacherBriefing(latestAssessment?.subjectSummary, student.childAge);

  // Progress trend
  const progressTrend = assessments.map(a => ({
    date: a.date,
    readiness: a.readinessPct,
    overall: a.overallPct,
  }));

  // Activity bar data (last 14 days)
  const last14 = activities.slice(0, 14).reverse();
  const activityBarData = last14.map(a => ({
    date: a.date.slice(5),
    tests: a.tests,
    watches: a.watches,
    practices: a.practices,
  }));

  const improvementDelta = latestAssessment && firstAssessment && assessments.length > 1
    ? latestAssessment.readinessPct - firstAssessment.readinessPct
    : null;

  const totalActivity = activities.reduce((acc, a) => ({
    tests: acc.tests + a.tests,
    watches: acc.watches + a.watches,
    practices: acc.practices + a.practices,
  }), { tests: 0, watches: 0, practices: 0 });

  // Days since last activity
  const lastActiveDay = activities.find(a => a.tests + a.watches + a.practices > 0);
  const daysSinceActive = lastActiveDay
    ? Math.floor((Date.now() - new Date(lastActiveDay.date).getTime()) / 86400000)
    : null;

  const handleCopyBriefing = () => {
    if (!latestAssessment) return;
    const text = generateCopyText(
      student.childName,
      student.childAge,
      latestAssessment.readinessPct,
      latestAssessment.date,
      briefing,
    );
    navigator.clipboard.writeText(text).then(() => {
      setBriefingCopied(true);
      toast.success('Briefing copied! Paste it into WhatsApp or any messaging app.');
      setTimeout(() => setBriefingCopied(false), 3000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      setBriefingCopied(true);
      toast.success('Briefing copied!');
      setTimeout(() => setBriefingCopied(false), 3000);
    });
  };

  const tabs = [
    { key: 'readiness' as const, label: 'Readiness', icon: <Award className="w-3.5 h-3.5" /> },
    { key: 'history' as const, label: 'History', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { key: 'activity' as const, label: 'Activity', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Students
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {student.childName?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{student.childName || 'Unnamed Child'}</h2>
              <p className="text-sm text-gray-500">Parent: {student.parentName}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Baby className="w-3.5 h-3.5" /> Age {student.childAge}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" /> {formatDate(student.connectedAt)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${student.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {student.subscriptionStatus === 'active' ? 'Premium' : 'Free'}
                </span>
                {daysSinceActive !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${daysSinceActive <= 3 ? 'bg-green-100 text-green-700' : daysSinceActive <= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                    {daysSinceActive === 0 ? 'Active today' : daysSinceActive === 1 ? 'Active yesterday' : `${daysSinceActive}d inactive`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
            Remove
          </button>
        </div>
      </div>

      {/* Quick stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<BookOpen className="w-4 h-4" />} label="Total Tests" value={student.totalTests} color="#6366f1" />
        <StatCard icon={<Play className="w-4 h-4" />} label="Videos Watched" value={student.totalWatches} color="#3b82f6" />
        <StatCard icon={<Dumbbell className="w-4 h-4" />} label="Practice Sessions" value={student.totalPractices} color="#22c55e" />
        <StatCard icon={<BarChart2 className="w-4 h-4" />} label="Questions Practiced" value={student.totalPracticeQuestions} color="#f59e0b" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ READINESS TAB ═══════════════════ */}
      {activeTab === 'readiness' && (
        <div className="space-y-5">
          {latestAssessment ? (
            <>
              {/* Readiness score banner */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-500" /> KSSR Readiness
                  </h3>
                  <span className="text-xs text-gray-400">{formatDate(latestAssessment.date)}</span>
                </div>

                <div className="flex items-center gap-5 mt-3">
                  {/* Big score */}
                  <div className="relative flex-shrink-0">
                    <svg width="88" height="88" viewBox="0 0 88 88">
                      <circle cx="44" cy="44" r="36" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                      <circle
                        cx="44" cy="44" r="36" fill="none"
                        stroke={getReadinessColor(latestAssessment.readinessPct)}
                        strokeWidth="7"
                        strokeDasharray={`${2 * Math.PI * 36 * latestAssessment.readinessPct / 100} ${2 * Math.PI * 36 * (1 - latestAssessment.readinessPct / 100)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 44 44)"
                      />
                      <text x="44" y="41" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#111827">{latestAssessment.readinessPct}%</text>
                      <text x="44" y="56" textAnchor="middle" fontSize="8" fill="#9ca3af">Readiness</text>
                    </svg>
                  </div>

                  <div className="flex-1 space-y-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: `${getReadinessColor(latestAssessment.readinessPct)}15`, color: getReadinessColor(latestAssessment.readinessPct) }}>
                      <Star className="w-3 h-3" /> {getReadinessLabel(latestAssessment.readinessPct)}
                    </span>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{latestAssessment.totalCorrect}</span>/{latestAssessment.totalQuestions} correct &middot; <span className="font-semibold text-gray-900">{latestAssessment.totalStars}</span>/{latestAssessment.maxStars} stars
                    </div>
                    {improvementDelta !== null && (
                      <div className={`text-xs font-semibold flex items-center gap-1 ${improvementDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {improvementDelta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {improvementDelta >= 0 ? '+' : ''}{improvementDelta}% since first assessment
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* HERO: Spider Web Chart */}
              {spiderData.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-500" /> Subject Readiness Map
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Each axis shows the child's functional age per subject. The grey line marks Age {student.childAge} (expected level).
                  </p>
                  <SpiderWebChart
                    data={spiderData}
                    childAge={student.childAge}
                    chartHeight={300}
                    maxWidth={420}
                    theme="light"
                  />
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-6 mt-2 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-gray-400 inline-block" /> Expected Age ({student.childAge})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-gray-900 inline-block" style={{ opacity: 0.15 }} /> Child's Performance
                    </span>
                  </div>
                </div>
              )}

              {/* Parent Briefing Panel */}
              {briefing.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-indigo-500" /> Parent Briefing
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">Tell parents exactly what to focus on at home</p>
                    </div>
                    <button
                      onClick={handleCopyBriefing}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                        briefingCopied
                          ? 'bg-green-100 text-green-700'
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                      }`}
                    >
                      {briefingCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy for WhatsApp</>}
                    </button>
                  </div>

                  <div className="divide-y divide-gray-50">
                    {briefing.map((item) => (
                      <div key={item.subject} className="px-5 py-4">
                        {/* Subject header row */}
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: item.statusColor }}
                            />
                            <span className="text-sm font-bold text-gray-900">{item.subject}</span>
                          </div>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                            style={{ backgroundColor: item.statusBg, color: item.statusColor }}
                          >
                            {item.statusLabel}
                          </span>
                        </div>

                        {/* Age comparison */}
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-1">
                            <AgeBar
                              childAge={student.childAge}
                              functionalAge={item.functionalAge}
                              color={item.statusColor}
                            />
                          </div>
                          <div className="text-right flex-shrink-0 min-w-[100px]">
                            <span className="text-xs font-bold" style={{ color: item.statusColor }}>
                              Age {item.functionalAge}
                            </span>
                            <span className="text-xs text-gray-400"> of {student.childAge}</span>
                          </div>
                        </div>

                        {/* Delta label */}
                        <div className="flex items-center gap-1.5 mb-2">
                          {item.ageDelta > 0 && <ArrowUpRight className="w-3 h-3 text-green-600" />}
                          {item.ageDelta === 0 && <Minus className="w-3 h-3 text-yellow-600" />}
                          {item.ageDelta < 0 && <ArrowDownRight className="w-3 h-3 text-red-500" />}
                          <span className="text-[11px] font-medium" style={{ color: item.statusColor }}>
                            {item.deltaLabel}
                          </span>
                        </div>

                        {/* Actionable tip */}
                        <div className="bg-gray-50 rounded-lg px-3.5 py-2.5 flex items-start gap-2">
                          <ClipboardList className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-gray-600 leading-relaxed">{item.tip}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-10 text-center">
              <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">No assessments yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Results and the readiness map will appear here once the child completes their first test in the Foxy app.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ HISTORY TAB ═══════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {assessments.length > 1 ? (
            <>
              {/* Readiness trend line chart */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" /> Readiness Score Over Time
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={progressTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v.slice(5)} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(val: number, name: string) => [`${val}%`, name === 'readiness' ? 'KSSR Readiness' : 'Overall Score']}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="readiness" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} name="KSSR Readiness" />
                    <Line type="monotone" dataKey="overall" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} name="Overall Score" strokeDasharray="5 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Assessment history table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div className="px-5 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-bold text-gray-700">Assessment History</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {[...assessments].reverse().map((a) => (
                    <div key={a.timestamp} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{formatDate(a.date)}</p>
                        <p className="text-xs text-gray-400">{a.totalCorrect}/{a.totalQuestions} correct</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold" style={{ color: getReadinessColor(a.readinessPct) }}>
                          {a.readinessPct}%
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${getReadinessColor(a.readinessPct)}15`, color: getReadinessColor(a.readinessPct) }}>
                          {getReadinessLabel(a.readinessPct)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : assessments.length === 1 ? (
            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-6 text-center">
              <BarChart2 className="w-10 h-10 text-blue-300 mx-auto mb-2" />
              <p className="text-sm text-blue-700 font-semibold">1 assessment completed</p>
              <p className="text-xs text-blue-500 mt-1">Progress charts will appear after the child completes more assessments</p>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-8 text-center">
              <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No assessments yet</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ ACTIVITY TAB ═══════════════════ */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {activities.length > 0 ? (
            <>
              {/* 14-day activity bar chart */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-500" /> Last 14 Days Activity
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={activityBarData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="tests" fill="#6366f1" radius={[3, 3, 0, 0]} name="Tests" />
                    <Bar dataKey="watches" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Videos" />
                    <Bar dataKey="practices" fill="#22c55e" radius={[3, 3, 0, 0]} name="Practice" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Lifetime summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={<BookOpen className="w-4 h-4" />} label="Total Tests" value={student.totalTests} color="#6366f1" />
                <StatCard icon={<Play className="w-4 h-4" />} label="Videos" value={student.totalWatches} color="#3b82f6" />
                <StatCard icon={<Dumbbell className="w-4 h-4" />} label="Practices" value={student.totalPractices} color="#22c55e" />
                <StatCard
                  icon={<Clock className="w-4 h-4" />}
                  label="Active Days"
                  value={activities.filter(a => a.tests + a.watches + a.practices > 0).length}
                  color="#f59e0b"
                  sub="total"
                />
              </div>

              {/* Recent activity log */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div className="px-5 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-bold text-gray-700">Recent Activity Log</h3>
                </div>
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {activities.filter(a => a.tests + a.watches + a.practices > 0).slice(0, 20).map(a => (
                    <div key={a.date} className="px-5 py-3 flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">{a.date}</span>
                      <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap justify-end">
                        {a.tests > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                            <BookOpen className="w-3 h-3" /> {a.tests} test{a.tests > 1 ? 's' : ''}
                          </span>
                        )}
                        {a.watches > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                            <Play className="w-3 h-3" /> {a.watches} video{a.watches > 1 ? 's' : ''}
                          </span>
                        )}
                        {a.practices > 0 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                            <Dumbbell className="w-3 h-3" /> {a.practices} practice{a.practices > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-8 text-center">
              <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">No activity recorded yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ===== MAIN STUDENTS PAGE =====
export const StudentsPage: React.FC<{ schoolCode?: string; onCountChange?: (n: number) => void }> = ({ schoolCode: schoolCodeProp, onCountChange }) => {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // School code with server fallback
  const [schoolCode, setSchoolCode] = useState<string>(schoolCodeProp || localStorage.getItem('school_short_code') || '');
  const [isFetchingCode, setIsFetchingCode] = useState(!schoolCodeProp && !localStorage.getItem('school_short_code'));
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    const stored = schoolCodeProp || localStorage.getItem('school_short_code') || '';
    if (stored) { setSchoolCode(stored); setIsFetchingCode(false); return; }
    const fetchCode = async () => {
      try {
        const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;
        const token = await getFreshAdminToken();
        if (!token) return;
        const res = await fetch(`${API_BASE}/auth/session`, {
          headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-User-Token': `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const code = data.school?.short_code || '';
        if (code) { localStorage.setItem('school_short_code', code); setSchoolCode(code); }
      } catch (err) {
        console.warn('[STUDENTS] Could not fetch school code:', err);
      } finally {
        setIsFetchingCode(false);
      }
    };
    fetchCode();
  }, [schoolCodeProp]);

  const handleCopyCode = () => {
    if (!schoolCode) return;
    navigator.clipboard.writeText(schoolCode).then(() => {
      setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = schoolCode; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const loadStudents = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const data = await fetchKGStudents();
      setStudents(data);
      onCountChange?.(data.length);
    } catch (err: any) {
      toast.error(`Failed to load students: ${err.message}`);
      setStudents([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = students.filter(s =>
    !search.trim() ||
    s.childName?.toLowerCase().includes(search.toLowerCase()) ||
    s.parentName?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Detail view ──
  if (selectedStudentId) {
    return (
      <StudentDetailView
        studentId={selectedStudentId}
        onBack={() => setSelectedStudentId(null)}
        onDisconnect={() => { setSelectedStudentId(null); loadStudents(true); }}
      />
    );
  }

  // ── Student list ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-500" /> My Students
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {students.length} parent{students.length !== 1 ? 's' : ''} connected to your class
          </p>
        </div>
        <button
          onClick={() => loadStudents(true)}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* School code banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Your School Code</p>
          {isFetchingCode ? (
            <div className="w-20 h-6 bg-indigo-200 rounded animate-pulse" />
          ) : schoolCode ? (
            <p className="text-2xl font-black tracking-[0.22em] text-indigo-700 font-mono leading-none">{schoolCode}</p>
          ) : (
            <p className="text-sm text-indigo-300 italic">Not assigned</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {schoolCode && (
            <button
              onClick={handleCopyCode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                codeCopied ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
              }`}
            >
              {codeCopied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Code</>}
            </button>
          )}
          <p className="text-[10px] text-indigo-400 text-right max-w-[150px] leading-snug">Parents enter this in Foxy &rarr; Account &rarr; Connect to Kindergarten</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by child or parent name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-all"
        />
      </div>

      {/* Loading / Empty / List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-10 text-center">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          {students.length === 0 ? (
            <>
              <p className="text-sm font-semibold text-gray-500">No students connected yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Share your school code with parents. They can connect from their Foxy app &rarr; Account &rarr; Connect to Kindergarten.
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">No students match your search</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[2fr_1.5fr_80px_100px_40px] gap-4 px-5 py-3 border-b border-gray-50 bg-gray-50/60">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Child</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Parent</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Age</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Connected</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {filtered.map(student => (
              <button
                key={student.parentId}
                onClick={() => setSelectedStudentId(student.parentId)}
                className="w-full text-left px-5 py-4 hover:bg-indigo-50/40 transition-colors group"
              >
                {/* Mobile layout */}
                <div className="sm:hidden flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      {student.childName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{student.childName || 'Unnamed'}</p>
                      <p className="text-xs text-gray-400">{student.parentName} &middot; Age {student.childAge}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:grid grid-cols-[2fr_1.5fr_80px_100px_40px] gap-4 items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      {student.childName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{student.childName || 'Unnamed'}</span>
                  </div>
                  <span className="text-sm text-gray-500">{student.parentName}</span>
                  <span className="text-sm text-gray-600">{student.childAge} yrs</span>
                  <span className="text-xs text-gray-400">{formatDate(student.connectedAt)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors justify-self-end" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
