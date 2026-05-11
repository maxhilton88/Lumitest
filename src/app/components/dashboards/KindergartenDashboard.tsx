import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, Users, Download, Settings, LogOut, BarChart3, Menu, MessageCircle, Zap, Target, ArrowRight, Link2, Megaphone, Eye, CheckCircle2, RefreshCw, ExternalLink, Clock, Send, GraduationCap, MapPin } from 'lucide-react';
import { WhatsAppMessageModal } from '../WhatsAppMessageModal';
import { AnalyticsPage } from '../admin/AnalyticsPage';
import { SettingsPage } from '../admin/SettingsPage';
import { MarketingPage } from '../kg/MarketingPage';
import { StudentsPage } from '../kg/StudentsPage';
const KGTerritoryMap = React.lazy(() =>
  import('../kg/KGTerritoryMap').then(m => ({ default: m.KGTerritoryMap }))
);
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { loadLeads, createShareableReport, getReportStatus, fetchLiveQuests, fetchSchoolReferralSources, fetchKGStudents } from '../../utils/api';
import { createKGCheckoutSession } from '../../utils/api';
import { Pagination } from '../Pagination';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Lead {
  id: string;
  childName: string;
  parentName: string;
  whatsapp: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  status?: string;
  questResults?: { quest: string; score: number; total: number }[];
  source?: 'direct' | 'referral';
  referralCodeUsed?: string | null;
  referredByParentId?: string | null;
}

interface KindergartenDashboardProps {
  schoolName: string;
  onLogout: () => void;
  // Question Bank & Quest Manager removed — content management is Super Admin only
  brandingSettings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
    email: string;
    phone: string;
    whatsappNo: string;
    address: string;
  };
  setBrandingSettings: (settings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
    email: string;
    phone: string;
    whatsappNo: string;
    address: string;
  }) => void;
}

export const KindergartenDashboard: React.FC<KindergartenDashboardProps> = ({ 
  schoolName,
  onLogout,
  brandingSettings,
  setBrandingSettings
}) => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile sidebar state
  const [isUpgrading, setIsUpgrading] = useState(false); // Real Stripe checkout loading
  // Read subscription tier from localStorage (set by App.tsx on login/session validation)
  // 'active' and 'founder' tiers get full access; 'trial' and 'expired' are limited
  // Also check trial_expires_at — if set and still in the future, treat as active (not blurred)
  const storedTier = localStorage.getItem('school_subscription_tier') || 'trial';
  const trialExpiresAt = localStorage.getItem('school_trial_expires_at');
  const isTrialStillActive = trialExpiresAt ? new Date(trialExpiresAt) > new Date() : false;
  const [isTrialAccount, setIsTrialAccount] = useState(
    (storedTier === 'trial' || storedTier === 'expired') && !isTrialStillActive
  );
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Admin-configured quests from Quest Manager
  const [adminQuests, setAdminQuests] = useState<{ id: string; subject: string; name: { en: string; ms: string; zh: string }; icon: string; status: string }[]>([]);

  // Referral sources data
  const [referralSources, setReferralSources] = useState<{
    sources: { total: number; direct: number; referral: number };
    topReferrers: { parentId: string; parentName: string; referrals: number; signedUp: number; lastReferralAt: string }[];
  } | null>(null);

  // Student connection count for sidebar badge
  const [studentCount, setStudentCount] = useState<number | null>(null);

  // REAL LEADS from KV store via API
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PAGE_SIZE = 15;

  // Report read-receipt statuses (keyed by lead ID)
  const [reportStatuses, setReportStatuses] = useState<Record<string, {
    hasReport: boolean;
    reportId?: string;
    viewCount?: number;
    isClaimed?: boolean;
    firstViewedAt?: string;
    lastViewedAt?: string;
    expiresAt?: string;
  }>>({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);

  // Pagination: derive the visible page of leads
  const totalLeadsPages = Math.ceil(leads.length / LEADS_PAGE_SIZE);
  const paginatedLeads = leads.slice(
    (currentPage - 1) * LEADS_PAGE_SIZE,
    currentPage * LEADS_PAGE_SIZE
  );

  // Fetch report statuses for ALL leads once loaded (needed for dashboard funnel metrics)
  useEffect(() => {
    if (leads.length === 0) return;
    const fetchAllStatuses = async () => {
      setIsLoadingStatuses(true);
      try {
        // Batch in chunks of 20 to avoid overwhelming the server
        const chunkSize = 20;
        const allStatuses: typeof reportStatuses = {};
        for (let i = 0; i < leads.length; i += chunkSize) {
          const chunk = leads.slice(i, i + chunkSize);
          const results = await Promise.all(
            chunk.map(lead => getReportStatus(lead.id).catch(() => ({ hasReport: false })))
          );
          chunk.forEach((lead, idx) => {
            allStatuses[lead.id] = results[idx] as any;
          });
        }
        setReportStatuses(allStatuses);
      } catch (err) {
        console.error('[KG] Failed to fetch report statuses:', err);
      } finally {
        setIsLoadingStatuses(false);
      }
    };
    fetchAllStatuses();
  }, [leads.map(l => l.id).join(',')]);

  // Fetch real leads from API on mount
  useEffect(() => {
    const fetchLeads = async () => {
      setIsLoadingLeads(true);
      try {
        console.log('=== KINDERGARTEN DASHBOARD: Fetching leads ===');
        console.log('access_token in localStorage:', !!localStorage.getItem('access_token'));
        console.log('school_id in localStorage:', localStorage.getItem('school_id'));
        const fetchedLeads = await loadLeads();
        console.log('=== KINDERGARTEN DASHBOARD: Fetched', fetchedLeads.length, 'leads ===');
        if (fetchedLeads.length > 0) {
          console.log('First lead:', fetchedLeads[0]);
        }
        setLeads(fetchedLeads);
      } catch (error) {
        console.error('=== KINDERGARTEN DASHBOARD: FAILED to load leads ===', error);
        toast.error('Failed to load leads. Check console for details.');
        setLeads([]);
      } finally {
        setIsLoadingLeads(false);
      }
    };
    
    fetchLeads();
  }, []);

  // Fetch admin-configured quests on mount
  useEffect(() => {
    const loadQuests = async () => {
      try {
        const quests = await fetchLiveQuests();
        setAdminQuests(quests);
      } catch (error) {
        console.error('Failed to fetch admin quests for dashboard:', error);
      }
    };
    loadQuests();
  }, []);

  // Fetch referral sources on mount
  useEffect(() => {
    fetchSchoolReferralSources()
      .then(data => setReferralSources(data))
      .catch(err => console.error('[KG] Failed to fetch referral sources:', err));
  }, []);

  // Fetch student count for sidebar badge on mount
  useEffect(() => {
    fetchKGStudents()
      .then(students => setStudentCount(students.length))
      .catch(() => setStudentCount(0));
  }, []);

  // Refresh handler: re-fetch leads (triggers bulk status refetch via useEffect)
  const handleRefreshStatuses = async () => {
    setIsRefreshing(true);
    try {
      const fetchedLeads = await loadLeads();
      setLeads(fetchedLeads);
      toast.success('Refreshed!');
    } catch (err) {
      console.error('[KG] Refresh failed:', err);
      toast.error('Failed to refresh');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-poll report statuses every 30s when on leads tab
  useEffect(() => {
    if (activeMenu !== 'leads' || paginatedLeads.length === 0) return;
    const interval = setInterval(async () => {
      try {
        const results = await Promise.all(
          paginatedLeads.map(lead => getReportStatus(lead.id).catch(() => ({ hasReport: false })))
        );
        const newStatuses: typeof reportStatuses = {};
        paginatedLeads.forEach((lead, i) => {
          newStatuses[lead.id] = results[i] as any;
        });
        setReportStatuses(prev => ({ ...prev, ...newStatuses }));
      } catch (_) { /* silent poll failure */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeMenu, paginatedLeads.map(l => l.id).join(',')]);

  // Helper: open public report in new tab (creates if needed)
  const handleViewReport = async (lead: Lead) => {
    const existingStatus = reportStatuses[lead.id];
    if (existingStatus?.reportId) {
      window.open(`/report/${existingStatus.reportId}`, '_blank');
      return;
    }
    try {
      toast.loading('Creating report...', { id: 'view-report' });
      const { reportId } = await createShareableReport(lead.id);
      setReportStatuses(prev => ({
        ...prev,
        [lead.id]: { hasReport: true, reportId, viewCount: 0, isClaimed: false },
      }));
      toast.dismiss('view-report');
      window.open(`/report/${reportId}`, '_blank');
    } catch (err: any) {
      toast.dismiss('view-report');
      toast.error(err.message || 'Failed to create report');
    }
  };

  // Helper: format lastViewedAt for tooltip
  const formatLastViewed = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return `Last viewed: ${new Date(dateStr).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    } catch { return ''; }
  };

  // Helper: check if a report is stale (sent 3+ days ago, 0 views, not claimed)
  const isStaleReport = (leadId: string): boolean => {
    const status = reportStatuses[leadId];
    if (!status?.hasReport || status.isClaimed || (status.viewCount && status.viewCount > 0)) return false;
    if (!status.expiresAt) return false;
    // Report was created ~30 days before expiry
    const expiresAt = new Date(status.expiresAt).getTime();
    const createdAt = expiresAt - 30 * 24 * 60 * 60 * 1000;
    const daysSinceCreation = (Date.now() - createdAt) / (24 * 60 * 60 * 1000);
    return daysSinceCreation >= 3;
  };

  // Helper: days since report was sent (for stale label)
  const daysSinceSent = (leadId: string): number => {
    const status = reportStatuses[leadId];
    if (!status?.expiresAt) return 0;
    const expiresAt = new Date(status.expiresAt).getTime();
    const createdAt = expiresAt - 30 * 24 * 60 * 60 * 1000;
    return Math.floor((Date.now() - createdAt) / (24 * 60 * 60 * 1000));
  };

  // Report funnel stats (from loaded statuses)
  const funnelStats = useMemo(() => {
    const statusValues = Object.values(reportStatuses);
    const sent = statusValues.filter(s => s.hasReport).length;
    const viewed = statusValues.filter(s => s.hasReport && s.viewCount && s.viewCount > 0).length;
    const claimed = statusValues.filter(s => s.hasReport && s.isClaimed).length;
    const stale = Object.keys(reportStatuses).filter(id => isStaleReport(id)).length;
    return { sent, viewed, claimed, stale };
  }, [reportStatuses]);

  const exportToCSV = () => {
    const csvContent = [
      ['Child Name', 'Parent Name', 'WhatsApp', 'Score', 'Total', 'Source', 'Date'].join(','),
      ...leads.map(lead => 
        [lead.childName, lead.parentName, lead.whatsapp, lead.score, lead.totalQuestions, lead.source || 'direct', lead.completedAt].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const totalLeads = leads.length;
  const averageScore = totalLeads > 0 
    ? Math.round(leads.reduce((acc, lead) => acc + (lead.totalQuestions > 0 ? (lead.score / lead.totalQuestions * 100) : 0), 0) / leads.length)
    : 0;

  // Derived dashboard data
  const thisWeekLeads = leads.filter(l => {
    const now = new Date();
    const leadDate = new Date(l.completedAt);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return !isNaN(leadDate.getTime()) && leadDate >= weekAgo;
  }).length;

  // ===== HERO STATS: Funnel-based metrics =====
  const heroStats = useMemo(() => {
    const statusValues = Object.values(reportStatuses);
    const sent = statusValues.filter(s => s.hasReport).length;
    const viewed = statusValues.filter(s => s.hasReport && s.viewCount && s.viewCount > 0).length;
    const claimed = statusValues.filter(s => s.hasReport && s.isClaimed).length;
    const sendRate = totalLeads > 0 ? Math.round((sent / totalLeads) * 100) : 0;
    const viewRate = sent > 0 ? Math.round((viewed / sent) * 100) : 0;
    const claimRate = viewed > 0 ? Math.round((claimed / viewed) * 100) : 0;
    return { sent, viewed, claimed, sendRate, viewRate, claimRate };
  }, [reportStatuses, totalLeads]);

  // ===== ENGAGEMENT FUNNEL: Step-by-step conversion =====
  const funnelSteps = useMemo(() => {
    const statusValues = Object.values(reportStatuses);
    const completed = totalLeads;
    const sent = statusValues.filter(s => s.hasReport).length;
    const viewed = statusValues.filter(s => s.hasReport && s.viewCount && s.viewCount > 0).length;
    const claimed = statusValues.filter(s => s.hasReport && s.isClaimed).length;
    return [
      { label: 'Tests Completed', count: completed, color: '#6366f1', conversionFromPrev: 0 },
      { label: 'Reports Sent', count: sent, color: '#3b82f6', conversionFromPrev: completed > 0 ? Math.round((sent / completed) * 100) : 0 },
      { label: 'Reports Viewed', count: viewed, color: '#8b5cf6', conversionFromPrev: sent > 0 ? Math.round((viewed / sent) * 100) : 0 },
      { label: 'Parents Signed Up', count: claimed, color: '#22c55e', conversionFromPrev: viewed > 0 ? Math.round((claimed / viewed) * 100) : 0 },
    ];
  }, [reportStatuses, totalLeads]);

  // ===== SUBJECT PERFORMANCE: Avg score per admin quest =====
  const SUBJECT_COLORS: Record<string, string> = {
    english: '#22c55e',
    numbers: '#3b82f6',
    bahasamalaysia: '#a855f7',
    mandarin: '#ef4444',
    science: '#f59e0b',
  };
  const FALLBACK_COLORS = ['#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];
  const oldNameToSubject: Record<string, string> = {
    'English Forest': 'english',
    'Numbers Island': 'numbers',
    'Rimba Bahasa': 'bahasamalaysia',
    'Mandarin Mountain': 'mandarin',
    'Mystery Jungle': 'science',
  };

  const subjectPerformance = useMemo(() => {
    if (adminQuests.length === 0) return [];

    const questById: Record<string, typeof adminQuests[0]> = {};
    const questBySubject: Record<string, typeof adminQuests[0]> = {};
    adminQuests.forEach(q => {
      questById[q.id] = q;
      questBySubject[q.subject] = q;
    });

    const accum: Record<string, { totalScore: number; totalPossible: number; leadCount: number }> = {};
    adminQuests.forEach(q => { accum[q.id] = { totalScore: 0, totalPossible: 0, leadCount: 0 }; });

    leads.forEach(lead => {
      if (!lead.questResults || lead.questResults.length === 0) return;
      const counted = new Set<string>();
      lead.questResults.forEach(qr => {
        let matchedId: string | null = null;
        if (questById[qr.quest]) matchedId = qr.quest;
        else if (questBySubject[qr.quest]) matchedId = questBySubject[qr.quest].id;
        else {
          const subject = oldNameToSubject[qr.quest];
          if (subject && questBySubject[subject]) matchedId = questBySubject[subject].id;
        }
        if (matchedId && !counted.has(matchedId)) {
          counted.add(matchedId);
          accum[matchedId].totalScore += qr.score;
          accum[matchedId].totalPossible += qr.total;
          accum[matchedId].leadCount += 1;
        }
      });
    });

    let fallbackIdx = 0;
    return adminQuests.map(q => {
      const a = accum[q.id];
      const avgPct = a.totalPossible > 0 ? Math.round((a.totalScore / a.totalPossible) * 100) : 0;
      return {
        id: q.id,
        name: q.name?.en || q.subject,
        icon: q.icon,
        subject: q.subject,
        avgScore: avgPct,
        leadCount: a.leadCount,
        color: SUBJECT_COLORS[q.subject] || FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length],
      };
    }).sort((a, b) => b.avgScore - a.avgScore);
  }, [leads, adminQuests]);

  // ===== ACTION CENTER: Computed to-do items =====
  const actionItems = useMemo(() => {
    const items: { id: string; severity: 'red' | 'orange' | 'yellow'; label: string; count: number; action: string; leadIds: string[] }[] = [];

    const statusKeys = new Set(Object.keys(reportStatuses));
    const noReportLeads = leads.filter(l => !statusKeys.has(l.id) || !reportStatuses[l.id]?.hasReport);
    if (noReportLeads.length > 0) {
      items.push({
        id: 'no-report',
        severity: 'red',
        label: `${noReportLeads.length} lead${noReportLeads.length > 1 ? 's' : ''} — no report sent yet`,
        count: noReportLeads.length,
        action: 'Send Reports',
        leadIds: noReportLeads.map(l => l.id),
      });
    }

    const staleLeadIds = Object.keys(reportStatuses).filter(id => isStaleReport(id));
    if (staleLeadIds.length > 0) {
      items.push({
        id: 'stale',
        severity: 'orange',
        label: `${staleLeadIds.length} report${staleLeadIds.length > 1 ? 's' : ''} sent but not viewed (3+ days)`,
        count: staleLeadIds.length,
        action: 'Resend',
        leadIds: staleLeadIds,
      });
    }

    const viewedNotClaimed = Object.entries(reportStatuses).filter(
      ([_, s]) => s.hasReport && s.viewCount && s.viewCount > 0 && !s.isClaimed
    );
    if (viewedNotClaimed.length > 0) {
      items.push({
        id: 'viewed-not-claimed',
        severity: 'yellow',
        label: `${viewedNotClaimed.length} parent${viewedNotClaimed.length > 1 ? 's' : ''} viewed report but haven't signed up`,
        count: viewedNotClaimed.length,
        action: 'Follow Up',
        leadIds: viewedNotClaimed.map(([id]) => id),
      });
    }

    return items;
  }, [leads, reportStatuses]);

  // Recent 5 leads
  const recentLeads = leads.slice(0, 5);

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'leads', icon: Users, label: 'Leads' },
    { id: 'students', icon: GraduationCap, label: 'Students' },
    { id: 'marketing', icon: Megaphone, label: 'Marketing' },
    // Question Bank & Quest Manager removed — content management is Super Admin only
    { id: 'territory', icon: MapPin, label: 'Territory' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  // ===== REAL STRIPE KG PRO CHECKOUT (RM1,850/year) =====
  const handleUpgradeClick = async () => {
    const schoolId = localStorage.getItem('school_id');
    const email = localStorage.getItem('user_email') || '';
    if (!schoolId) {
      toast.error('School ID not found. Please log in again.');
      return;
    }
    if (!email) {
      toast.error('Email not found. Please log in again.');
      return;
    }
    setIsUpgrading(true);
    try {
      const { url } = await createKGCheckoutSession(schoolId, email);
      if (url) {
        window.location.href = url; // Redirect to Stripe hosted checkout
      } else {
        toast.error('Failed to create checkout session — no URL returned.');
      }
    } catch (error: any) {
      console.error('[KG] Upgrade checkout error:', error);
      toast.error(`Checkout failed: ${error.message}`);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Handle checkout success/cancelled from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      toast.success('KG Pro subscription activated! Welcome aboard.');
      setIsTrialAccount(false);
      localStorage.setItem('school_subscription_tier', 'active');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('checkout') === 'cancelled') {
      toast.info('Checkout cancelled. You can upgrade anytime.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <div className="flex h-screen bg-white">
      {/* WhatsApp Message Modal */}
      {showWhatsAppModal && selectedLead && (
        <WhatsAppMessageModal
          lead={selectedLead}
          schoolName={schoolName}
          onClose={() => {
            setShowWhatsAppModal(false);
            setSelectedLead(null);
          }}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown as overlay when mobileMenuOpen */}
      <aside className={`
        fixed md:relative z-50 md:z-auto h-full
        border-r border-gray-100 flex flex-col bg-white
        transition-all duration-300
        ${mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'}
        md:translate-x-0
        ${!mobileMenuOpen && (isCollapsed ? 'md:w-16' : 'md:w-64')}
      `}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100 justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">L</span>
            </div>
            {(mobileMenuOpen || !isCollapsed) && (
              <span className="font-semibold text-gray-900">Project Lumi</span>
            )}
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* School Name */}
        {(mobileMenuOpen || !isCollapsed) && (
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Organization</div>
            <div className="text-sm font-medium text-gray-900 truncate">{schoolName}</div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            const isStudents = item.id === 'students';
            const showCount = isStudents && studentCount !== null && studentCount > 0;
            const isExpanded = mobileMenuOpen || !isCollapsed;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-1 relative
                  ${isActive 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  ${!mobileMenuOpen && isCollapsed ? 'md:justify-center' : ''}
                `}
                title={!mobileMenuOpen && isCollapsed ? `${item.label}${showCount ? ` (${studentCount})` : ''}` : ''}
              >
                {/* Icon + collapsed badge dot */}
                <span className="relative flex-shrink-0">
                  <Icon className="w-4 h-4" />
                  {/* Show a dot badge when collapsed */}
                  {showCount && !isExpanded && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {studentCount! > 99 ? '99+' : studentCount}
                    </span>
                  )}
                </span>
                {/* Label + count chip when expanded */}
                {isExpanded && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {showCount && (
                      <span className={`
                        min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0
                        ${isActive ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-600'}
                      `}>
                        {studentCount! > 99 ? '99+' : studentCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse Toggle (desktop only) & Logout */}
        <div className="p-2 border-t border-gray-100 space-y-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {(mobileMenuOpen || !isCollapsed) && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto w-full">
        {/* Header */}
        <header className="h-14 md:h-16 border-b border-gray-100 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-base md:text-lg font-semibold text-gray-900">
              {menuItems.find(m => m.id === activeMenu)?.label || 'Dashboard'}
            </h1>
          </div>
          <button
            onClick={handleUpgradeClick}
            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-black text-white rounded-lg text-xs md:text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">Upgrade</span>
          </button>
        </header>

        {/* Content */}
        <div className="p-4 md:p-8">
          {activeMenu === 'dashboard' && (
            <div className="space-y-6">
              {/* ===== ROW 1: Hero Stat Cards (funnel metrics) ===== */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {/* Total Leads */}
                <div className="border border-gray-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                      <Users className="w-4.5 h-4.5 text-indigo-600" />
                    </div>
                    {thisWeekLeads > 0 && (
                      <span className="text-[10px] md:text-xs font-medium text-green-600 bg-green-50 px-1.5 md:px-2 py-0.5 rounded-full">+{thisWeekLeads} this wk</span>
                    )}
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-gray-900">{totalLeads}</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">Total Leads</div>
                </div>

                {/* Report Send Rate */}
                <div className="border border-gray-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Send className="w-4.5 h-4.5 text-blue-600" />
                    </div>
                    <span className="text-[10px] md:text-xs font-medium text-gray-500">{heroStats.sent}/{totalLeads}</span>
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-gray-900">{heroStats.sendRate}%</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">Report Send Rate</div>
                </div>

                {/* View Rate */}
                <div className="border border-gray-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                      <Eye className="w-4.5 h-4.5 text-purple-600" />
                    </div>
                    <span className="text-[10px] md:text-xs font-medium text-gray-500">{heroStats.viewed}/{heroStats.sent}</span>
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-gray-900">{heroStats.viewRate}%</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">View Rate</div>
                </div>

                {/* Claim Rate */}
                <div className="border border-gray-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                    </div>
                    <span className="text-[10px] md:text-xs font-medium text-gray-500">{heroStats.claimed}/{heroStats.viewed}</span>
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-gray-900">{heroStats.claimRate}%</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">Sign-up Rate</div>
                </div>
              </div>

              {/* ===== ROW 2: Subject Performance + Action Center ===== */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Leads Over Time Chart */}
                <div className="border border-gray-100 rounded-xl p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Leads Over Time</h3>
                    {leads.length > 0 && (
                      <span className="text-[10px] text-gray-400">captured vs converted by month</span>
                    )}
                  </div>
                  {(() => {
                    // Build monthly data from leads + reportStatuses
                    const monthMap: Record<string, { captured: number; converted: number }> = {};
                    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                    leads.forEach((lead) => {
                      // Parse completedAt "05 Jan 2026" format
                      const parsed = new Date(lead.completedAt);
                      if (isNaN(parsed.getTime())) return;
                      const key = `${MONTH_NAMES[parsed.getMonth()]} ${parsed.getFullYear()}`;
                      if (!monthMap[key]) monthMap[key] = { captured: 0, converted: 0 };
                      monthMap[key].captured++;
                      // Check if this lead was claimed (converted)
                      const status = reportStatuses[lead.id];
                      if (status?.isClaimed) {
                        monthMap[key].converted++;
                      }
                    });

                    // Sort by date and take last 6 months
                    const sortedKeys = Object.keys(monthMap).sort((a, b) => {
                      return new Date(a).getTime() - new Date(b).getTime();
                    });
                    const chartData = sortedKeys.slice(-6).map((key) => ({
                      month: key.split(' ')[0], // Just "Jan", "Feb" etc
                      fullMonth: key,
                      captured: monthMap[key].captured,
                      converted: monthMap[key].converted,
                    }));

                    if (chartData.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <BarChart3 className="w-8 h-8 text-gray-200 mb-2" />
                          <p className="text-sm text-gray-400">No lead data yet</p>
                          <p className="text-xs text-gray-300 mt-1">Monthly trends will appear once leads arrive</p>
                        </div>
                      );
                    }

                    const maxVal = Math.max(...chartData.map(d => Math.max(d.captured, d.converted)), 1);
                    const totalCaptured = chartData.reduce((s, d) => s + d.captured, 0);
                    const totalConverted = chartData.reduce((s, d) => s + d.converted, 0);
                    const convRate = totalCaptured > 0 ? Math.round((totalConverted / totalCaptured) * 100) : 0;

                    return (
                      <div>
                        {/* Summary stats */}
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            <span className="text-xs text-gray-600">Captured <span className="font-semibold text-gray-900">{totalCaptured}</span></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                            <span className="text-xs text-gray-600">Converted <span className="font-semibold text-gray-900">{totalConverted}</span></span>
                          </div>
                          <span className="text-[10px] text-gray-400 ml-auto">{convRate}% rate</span>
                        </div>

                        {/* Line chart */}
                        <div style={{ width: '100%', height: 160 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                              <XAxis
                                dataKey="fullMonth"
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val: string) => val.split(' ')[0]}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  fontSize: 11,
                                  borderRadius: 8,
                                  border: '1px solid #e5e7eb',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                  padding: '8px 12px',
                                }}
                                labelFormatter={(label: string) => label}
                              />
                              <Area
                                id="area-captured"
                                type="monotone"
                                dataKey="captured"
                                name="Captured"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fill="#3b82f6"
                                fillOpacity={0.08}
                                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                                activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                              />
                              <Area
                                id="area-converted"
                                type="monotone"
                                dataKey="converted"
                                name="Converted"
                                stroke="#22c55e"
                                strokeWidth={2}
                                fill="#22c55e"
                                fillOpacity={0.08}
                                dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
                                activeDot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Insight */}
                        {chartData.length >= 2 && (() => {
                          const latest = chartData[chartData.length - 1];
                          const prev = chartData[chartData.length - 2];
                          const delta = latest.captured - prev.captured;
                          if (delta === 0) return null;
                          return (
                            <div className="mt-3 pt-3 border-t border-gray-50">
                              <p className="text-xs text-gray-500 leading-relaxed">
                                <span className="font-medium text-gray-700">Trend:</span>{' '}
                                {delta > 0
                                  ? <>{latest.month} saw <span className="text-green-600 font-medium">+{delta}</span> more leads than {prev.month}</>
                                  : <>{latest.month} saw <span className="text-red-500 font-medium">{delta}</span> fewer leads than {prev.month}</>
                                }
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>

                {/* Action Center */}
                <div className="border border-gray-100 rounded-xl p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Action Center</h3>
                    {actionItems.length === 0 && totalLeads > 0 && (
                      <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">All clear</span>
                    )}
                  </div>
                  {isLoadingLeads ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300" />
                    </div>
                  ) : actionItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">You're all caught up!</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {totalLeads === 0 ? 'Leads will appear once parents complete the assessment.' : 'All reports sent and parents are engaging.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {actionItems.map((item) => {
                        const severityStyles = {
                          red: { bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500', text: 'text-red-700', btn: 'bg-red-600 hover:bg-red-700 text-white' },
                          orange: { bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-500', text: 'text-amber-700', btn: 'bg-amber-600 hover:bg-amber-700 text-white' },
                          yellow: { bg: 'bg-yellow-50', border: 'border-yellow-100', dot: 'bg-yellow-500', text: 'text-yellow-700', btn: 'bg-yellow-600 hover:bg-yellow-700 text-white' },
                        };
                        const s = severityStyles[item.severity];
                        return (
                          <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${s.bg} ${s.border}`}>
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                            <span className={`text-sm flex-1 ${s.text}`}>{item.label}</span>
                            <button
                              onClick={() => setActiveMenu('leads')}
                              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex-shrink-0 ${s.btn}`}
                            >
                              {item.action}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Quick avg score */}
                  {totalLeads > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500">Overall Avg Score</span>
                      <span className={`text-sm font-semibold ${
                        averageScore >= 80 ? 'text-green-600' : averageScore >= 60 ? 'text-blue-600' : 'text-amber-600'
                      }`}>{averageScore}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== ROW 3: Parent Engagement Funnel ===== */}
              {totalLeads > 0 && (
                <div className="border border-gray-100 rounded-xl p-4 md:p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-5">Parent Engagement Funnel</h3>
                  <div className="flex flex-col md:flex-row items-stretch gap-0">
                    {funnelSteps.map((step, i) => {
                      const maxCount = Math.max(...funnelSteps.map(s => s.count), 1);
                      const barPercent = Math.max((step.count / maxCount) * 100, 8);
                      return (
                        <div key={step.label} className="flex-1 flex flex-col items-center relative">
                          {/* Conversion arrow (not on first) */}
                          {i > 0 && (
                            <div className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 items-center z-10">
                              <div className="flex flex-col items-center">
                                <ArrowRight className="w-4 h-4 text-gray-300" />
                                <span className="text-[10px] font-medium text-gray-400 mt-0.5">{step.conversionFromPrev}%</span>
                              </div>
                            </div>
                          )}
                          {/* Mobile conversion arrow */}
                          {i > 0 && (
                            <div className="md:hidden flex items-center gap-1.5 py-1 text-gray-400">
                              <svg className="w-3 h-3 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                              <span className="text-[10px] font-medium">{step.conversionFromPrev}%</span>
                            </div>
                          )}
                          {/* Funnel bar */}
                          <div className="w-full px-2 md:px-3">
                            <div className="h-16 md:h-20 bg-gray-50 rounded-lg relative overflow-hidden flex items-end">
                              <div
                                className="w-full rounded-lg transition-all duration-700 ease-out"
                                style={{ height: `${barPercent}%`, backgroundColor: step.color, opacity: 0.85 }}
                              />
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-lg md:text-xl font-bold text-gray-900">{step.count}</span>
                              </div>
                            </div>
                            <p className="text-[10px] md:text-xs text-gray-500 text-center mt-2 leading-tight">{step.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===== ROW 3.5: Referral Sources ===== */}
              {totalLeads > 0 && (() => {
                const rs = referralSources;
                const sources = rs?.sources || { total: 0, direct: 0, referral: 0 };
                const topRefs = rs?.topReferrers || [];
                const { direct, referral, total } = sources;
                const directPct = total > 0 ? Math.round((direct / total) * 100) : 0;
                const referralPct = total > 0 ? Math.round((referral / total) * 100) : 0;
                const isLoading = !rs;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {/* Source Breakdown */}
                    <div className="border border-gray-100 rounded-xl p-4 md:p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Lead Sources</h3>
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="h-6 rounded-full overflow-hidden flex bg-gray-100">
                            {directPct > 0 && (
                              <div className="h-full transition-all duration-700" style={{ width: `${directPct}%`, backgroundColor: '#6366f1' }} title={`Direct: ${direct}`} />
                            )}
                            {referralPct > 0 && (
                              <div className="h-full transition-all duration-700" style={{ width: `${referralPct}%`, backgroundColor: '#22c55e' }} title={`Referral: ${referral}`} />
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#6366f1' }} />
                              <span className="text-xs text-gray-600">Direct / Unknown</span>
                              <span className="text-xs font-semibold text-gray-900">{direct} ({directPct}%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                              <span className="text-xs text-gray-600">Referral</span>
                              <span className="text-xs font-semibold text-gray-900">{referral} ({referralPct}%)</span>
                            </div>
                          </div>
                          {referral > 0 && (
                            <div className="pt-3 border-t border-gray-50">
                              <p className="text-xs text-gray-500 leading-relaxed">
                                <span className="font-medium text-gray-700">Insight:</span>{' '}
                                {referralPct >= 20
                                  ? `Referrals are driving ${referralPct}% of your leads — your parent community is actively sharing!`
                                  : `${referral} lead${referral > 1 ? 's' : ''} came via parent referrals. Encourage parents to share their referral links.`}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Top Referrers Leaderboard */}
                    <div className="border border-gray-100 rounded-xl p-4 md:p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-900">Top Referrers</h3>
                        {topRefs.length > 0 && (
                          <span className="text-[10px] text-gray-400">parent leaderboard</span>
                        )}
                      </div>
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300" />
                        </div>
                      ) : topRefs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Users className="w-8 h-8 text-gray-200 mb-2" />
                          <p className="text-sm text-gray-400">No referrers yet</p>
                          <p className="text-xs text-gray-300 mt-1">Parents who share referral links will appear here</p>
                        </div>
                      ) : (
                        <div className="space-y-0 divide-y divide-gray-50">
                          {topRefs.slice(0, 5).map((ref, i) => (
                            <div key={ref.parentId} className="flex items-center gap-3 py-2.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{ref.parentName}</p>
                                {ref.lastReferralAt && (
                                  <p className="text-[10px] text-gray-400">Last: {new Date(ref.lastReferralAt).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-semibold text-gray-900">{ref.referrals}</p>
                                <p className="text-[10px] text-gray-400">referral{ref.referrals !== 1 ? 's' : ''}</p>
                              </div>
                              <div className="text-right flex-shrink-0 w-14">
                                <p className={`text-sm font-semibold ${ref.signedUp > 0 ? 'text-green-600' : 'text-gray-300'}`}>{ref.signedUp}</p>
                                <p className="text-[10px] text-gray-400">signed up</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ===== ROW 4: Recent Leads ===== */}
              <div className="border border-gray-100 rounded-xl">
                <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Recent Leads</h3>
                  <div className="flex items-center gap-2 md:gap-3">
                    <button
                      onClick={exportToCSV}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </button>
                    <button
                      onClick={() => setActiveMenu('leads')}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      View all
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {isLoadingLeads ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300" />
                    </div>
                  ) : recentLeads.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Users className="w-8 h-8 text-gray-200 mb-2" />
                      <p className="text-sm text-gray-400">No leads yet</p>
                    </div>
                  ) : recentLeads.map((lead) => {
                    const pct = lead.totalQuestions > 0 ? Math.round((lead.score / lead.totalQuestions) * 100) : 0;
                    return (
                      <div key={lead.id} className="flex items-center px-4 md:px-6 py-3 md:py-3.5 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{lead.childName}</div>
                          <div className="text-xs text-gray-500 truncate">{lead.parentName}</div>
                        </div>
                        <div className="text-right mr-3 md:mr-6">
                          <div className="text-sm font-medium text-gray-900">{lead.score}/{lead.totalQuestions}</div>
                          <div className={`text-xs font-medium ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                            {pct}%
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center mr-4">
                          {lead.source === 'referral' ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              <Users className="w-2.5 h-2.5" /> Ref
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                              Direct
                            </span>
                          )}
                        </div>
                        <div className="hidden sm:block text-xs text-gray-400 w-24 text-right mr-4">{lead.completedAt}</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewReport(lead)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Report"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setSelectedLead(lead); setShowWhatsAppModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ===== ROW 5: Quick Actions ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Download className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Export Leads</div>
                    <div className="text-xs text-gray-500">Download CSV file</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMenu('marketing')}
                  className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Megaphone className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Marketing Kit</div>
                    <div className="text-xs text-gray-500">Share links & promo art</div>
                  </div>
                </button>
                <button
                  onClick={() => setActiveMenu('analytics')}
                  className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">View Analytics</div>
                    <div className="text-xs text-gray-500">Detailed reports</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {activeMenu === 'leads' && (
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">All Leads</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefreshStatuses}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    title="Refresh leads & report statuses"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                </div>
              </div>

              {/* Report Funnel Stats */}
              {funnelStats.sent > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center border border-gray-100">
                      <Send className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{funnelStats.sent}</div>
                      <div className="text-[10px] text-gray-500 leading-tight">Reports Sent</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-blue-50/60 rounded-lg border border-blue-100">
                    <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center border border-blue-100">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-blue-900">{funnelStats.viewed}</div>
                      <div className="text-[10px] text-blue-600 leading-tight">Viewed</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-green-50/60 rounded-lg border border-green-100">
                    <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center border border-green-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-green-900">{funnelStats.claimed}</div>
                      <div className="text-[10px] text-green-600 leading-tight">Claimed</div>
                    </div>
                  </div>
                  {funnelStats.stale > 0 && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-50/60 rounded-lg border border-amber-100">
                      <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center border border-amber-100">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-amber-900">{funnelStats.stale}</div>
                        <div className="text-[10px] text-amber-600 leading-tight">Need Follow-up</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3">
                {isLoadingLeads ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="text-gray-500">Loading leads...</p>
                  </div>
                ) : leads.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 border border-gray-100 rounded-lg">
                    <Users className="w-12 h-12 text-gray-300" />
                    <p className="text-lg font-medium text-gray-900">No leads yet</p>
                    <p className="text-sm text-gray-500">Leads will appear here when parents complete the test</p>
                  </div>
                ) : (
                  paginatedLeads.map((lead, index) => {
                    const percentage = lead.totalQuestions > 0 ? Math.round((lead.score / lead.totalQuestions) * 100) : 0;
                    const absoluteIndex = (currentPage - 1) * LEADS_PAGE_SIZE + index;
                    const isBlurred = isTrialAccount && absoluteIndex >= 15;
                    return (
                      <div key={lead.id} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className={isBlurred ? 'filter blur-sm select-none' : ''}>
                            <div className="text-sm font-medium text-gray-900">{lead.childName}</div>
                            <div className="text-xs text-gray-500">{lead.parentName}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-gray-900">{lead.score}/{lead.totalQuestions}</div>
                            <div className={`text-xs font-medium ${percentage >= 80 ? 'text-green-600' : percentage >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                              {percentage}%
                            </div>
                          </div>
                        </div>
                        {/* Mobile source + report status badges */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {lead.source === 'referral' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                              <Users className="w-2.5 h-2.5" /> Referral
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                              Direct
                            </span>
                          )}
                        </div>
                        {(() => {
                          const status = reportStatuses[lead.id];
                          if (!status || !status.hasReport) return null;
                          return (
                            <div className="mb-2">
                              {status.isClaimed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Claimed
                                </span>
                              ) : status.viewCount && status.viewCount > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full cursor-default"
                                  title={formatLastViewed(status.lastViewedAt)}
                                >
                                  <Eye className="w-3 h-3" />
                                  {status.viewCount} {status.viewCount === 1 ? 'view' : 'views'}
                                </span>
                              ) : (
                                isStaleReport(lead.id) ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full" title={`Sent ${daysSinceSent(lead.id)}d ago, no opens`}>
                                  <Clock className="w-2.5 h-2.5" /> No opens · {daysSinceSent(lead.id)}d
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-full">
                                  <Link2 className="w-2.5 h-2.5" /> Sent
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between mt-3">
                          <div className={`text-xs text-gray-500 ${isBlurred ? 'filter blur-sm select-none' : ''}`}>
                            {lead.whatsapp} · {lead.completedAt}
                          </div>
                          {isBlurred ? (
                            <button
                              onClick={handleUpgradeClick}
                              disabled={isUpgrading}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-black text-white rounded text-xs font-medium"
                            >
                              <Zap className="w-3 h-3" />
                              {isUpgrading ? 'Loading...' : 'Upgrade'}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleViewReport(lead)}
                                className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"
                                title="Open report"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              {isStaleReport(lead.id) ? (
                                <button
                                  onClick={() => { setSelectedLead(lead); setShowWhatsAppModal(true); }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-amber-700 bg-amber-50 rounded-lg text-[10px] font-medium animate-pulse"
                                  title={`No opens in ${daysSinceSent(lead.id)}d — resend`}
                                >
                                  <Send className="w-3 h-3" />
                                  Resend
                                </button>
                              ) : (
                                <button
                                  onClick={() => { setSelectedLead(lead); setShowWhatsAppModal(true); }}
                                  className="p-1.5 text-green-600 bg-green-50 rounded-lg"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalLeadsPages}
                  totalItems={leads.length}
                  pageSize={LEADS_PAGE_SIZE}
                  onPageChange={setCurrentPage}
                  itemLabel="leads"
                  compact
                />
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block border border-gray-100 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Child</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Parent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Score</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Source</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Report Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {isLoadingLeads ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                              <p>Loading leads...</p>
                            </div>
                          </td>
                        </tr>
                      ) : leads.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Users className="w-12 h-12 text-gray-300" />
                              <p className="text-lg font-medium text-gray-900">No leads yet</p>
                              <p className="text-sm">Leads will appear here when parents complete the test</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedLeads.map((lead, index) => {
                          const percentage = lead.totalQuestions > 0 ? Math.round((lead.score / lead.totalQuestions) * 100) : 0;
                          const absoluteIndex = (currentPage - 1) * LEADS_PAGE_SIZE + index;
                          const isBlurred = isTrialAccount && absoluteIndex >= 15; // Blur 16th lead onwards
                          
                          return (
                            <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                              <td className={`px-6 py-4 text-sm text-gray-900 ${isBlurred ? 'filter blur-sm select-none' : ''}`}>
                                {lead.childName}
                              </td>
                              <td className={`px-6 py-4 text-sm text-gray-600 ${isBlurred ? 'filter blur-sm select-none' : ''}`}>
                                {lead.parentName}
                              </td>
                              <td className={`px-6 py-4 text-sm text-gray-600 ${isBlurred ? 'filter blur-sm select-none' : ''}`}>
                                {lead.whatsapp}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span className="text-gray-900 font-medium">{lead.score}/{lead.totalQuestions}</span>
                                <span className="text-gray-400 ml-2">({percentage}%)</span>
                              </td>
                              <td className="px-4 py-4 text-sm">
                                {lead.source === 'referral' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                    <Users className="w-3 h-3" /> Referral
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                    Direct
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">{lead.completedAt}</td>
                              {/* Report Status Column */}
                              <td className="px-4 py-4 text-sm">
                                {(() => {
                                  const status = reportStatuses[lead.id];
                                  if (!status || !status.hasReport) {
                                    return <span className="text-xs text-gray-400">—</span>;
                                  }
                                  if (status.isClaimed) {
                                    return (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Claimed
                                      </span>
                                    );
                                  }
                                  if (status.viewCount && status.viewCount > 0) {
                                    return (
                                      <span
                                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded-full cursor-default"
                                        title={formatLastViewed(status.lastViewedAt)}
                                      >
                                        <Eye className="w-3 h-3" />
                                        {status.viewCount} {status.viewCount === 1 ? 'view' : 'views'}
                                      </span>
                                    );
                                  }
                                  if (isStaleReport(lead.id)) {
                                    const days = daysSinceSent(lead.id);
                                    return (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full" title={`Sent ${days}d ago, no opens yet`}>
                                        <Clock className="w-3 h-3" />
                                        No opens · {days}d
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                                      <Link2 className="w-3 h-3" />
                                      Sent
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                {isBlurred ? (
                                  <button
                                    onClick={handleUpgradeClick}
                                    disabled={isUpgrading}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                                  >
                                    <Zap className="w-3.5 h-3.5" />
                                    {isUpgrading ? 'Loading...' : 'Upgrade to Contact'}
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={async () => {
                                        try {
                                          const { reportId } = await createShareableReport(lead.id);
                                          const url = `${window.location.origin}/report/${reportId}`;
                                          await navigator.clipboard.writeText(url);
                                          toast.success('Report link copied!');
                                          setReportStatuses(prev => ({
                                            ...prev,
                                            [lead.id]: {
                                              hasReport: true,
                                              reportId,
                                              viewCount: prev[lead.id]?.viewCount || 0,
                                              isClaimed: prev[lead.id]?.isClaimed || false,
                                            },
                                          }));
                                        } catch (err: any) {
                                          toast.error(err.message || 'Failed to create report link');
                                        }
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                      title="Copy shareable report link"
                                    >
                                      <Link2 className="w-3.5 h-3.5" />
                                      Link
                                    </button>
                                    <button
                                      onClick={() => handleViewReport(lead)}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                      title="Open report in new tab"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Report
                                    </button>
                                    {isStaleReport(lead.id) ? (
                                      <button
                                        onClick={() => {
                                          setSelectedLead(lead);
                                          setShowWhatsAppModal(true);
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors animate-pulse"
                                        title={`No opens in ${daysSinceSent(lead.id)} days — resend via WhatsApp`}
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                        Resend
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setSelectedLead(lead);
                                          setShowWhatsAppModal(true);
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        WhatsApp
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalLeadsPages}
                  totalItems={leads.length}
                  pageSize={LEADS_PAGE_SIZE}
                  onPageChange={setCurrentPage}
                  itemLabel="leads"
                />
              </div>
            </div>
          )}

          {/* Question Bank & Quest Manager removed — Super Admin only */}

          {activeMenu === 'students' && (
            <StudentsPage
              schoolCode={localStorage.getItem('school_short_code') || undefined}
              onCountChange={setStudentCount}
            />
          )}

          {activeMenu === 'marketing' && (
            <MarketingPage />
          )}

          {activeMenu === 'territory' && (
            <React.Suspense fallback={<div className="flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100" style={{ minHeight: 600 }}><span className="text-sm text-gray-400">Loading territory map...</span></div>}>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden" style={{ minHeight: 600 }}>
              <KGTerritoryMap
                mode="dashboard"
                highlightKgId={localStorage.getItem('school_linked_pg_kg_id') || undefined}
                onLockTerritory={async (kgId) => {
                  const token = localStorage.getItem('access_token');
                  if (!token) return;
                  try {
                    const res = await fetch(
                      `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc/kg-db/lock-territory`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${publicAnonKey}`,
                          'X-User-Token': `Bearer ${token}`,
                        },
                        body: JSON.stringify({ kindergarten_id: kgId, radius_km: 3 }),
                      }
                    );
                    const data = await res.json();
                    if (data.requires_upgrade) {
                      toast.error('Territory lock requires an active subscription (RM 1,800/month).');
                    } else if (data.success) {
                      toast.success(data.message || 'Territory locked!');
                    } else {
                      toast.error(data.error || 'Failed to lock territory');
                    }
                  } catch (err: any) {
                    toast.error(err.message);
                  }
                }}
                className="h-full"
              />
            </div>
            </React.Suspense>
          )}

          {activeMenu === 'analytics' && (
            <div>
              <AnalyticsPage />
            </div>
          )}

          {activeMenu === 'settings' && (
            <div>
              <SettingsPage 
                brandingSettings={brandingSettings}
                setBrandingSettings={setBrandingSettings}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};