import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Download, Settings, LogOut, BarChart3, Menu, MessageCircle, Zap, TrendingUp, Target, CalendarDays, ArrowRight, Link2, Trophy, Star, AlertTriangle, FileText, Megaphone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { WhatsAppMessageModal } from '../WhatsAppMessageModal';
import { AnalyticsPage } from '../admin/AnalyticsPage';
import { SettingsPage } from '../admin/SettingsPage';
import { MarketingPage } from '../kg/MarketingPage';
import { ChildReport } from '../ChildReport';
import { ReportModal } from '../ReportModal';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { loadLeads } from '../../utils/api';
import { createKGCheckoutSession } from '../../utils/api';
import { Pagination } from '../Pagination';

interface Lead {
  id: string;
  childName: string;
  parentName: string;
  whatsapp: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  status?: string;
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
  };
  setBrandingSettings: (settings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
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
  const [isTrialAccount, setIsTrialAccount] = useState(true); // Set to true for trial accounts
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLead, setReportLead] = useState<Lead | null>(null);
  
  // REAL LEADS from KV store via API
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PAGE_SIZE = 15;

  // Pagination: derive the visible page of leads
  const totalLeadsPages = Math.ceil(leads.length / LEADS_PAGE_SIZE);
  const paginatedLeads = leads.slice(
    (currentPage - 1) * LEADS_PAGE_SIZE,
    currentPage * LEADS_PAGE_SIZE
  );

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

  const exportToCSV = () => {
    const csvContent = [
      ['Child Name', 'Parent Name', 'WhatsApp', 'Score', 'Total', 'Date'].join(','),
      ...leads.map(lead => 
        [lead.childName, lead.parentName, lead.whatsapp, lead.score, lead.totalQuestions, lead.completedAt].join(',')
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
  const thisMonthLeads = leads.filter(l => {
    // Match current month dynamically
    const now = new Date();
    const leadDate = new Date(l.completedAt);
    return !isNaN(leadDate.getTime()) && leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
  }).length;
  const highScorers = leads.filter(l => l.totalQuestions > 0 && (l.score / l.totalQuestions) >= 0.8).length;
  const completionRate = totalLeads > 0 ? Math.round((highScorers / totalLeads) * 100) : 0;

  // Score distribution for chart
  const excellent = leads.filter(l => l.totalQuestions > 0 && (l.score / l.totalQuestions) * 100 >= 80).length;
  const good = leads.filter(l => { if (l.totalQuestions === 0) return false; const p = (l.score / l.totalQuestions) * 100; return p >= 60 && p < 80; }).length;
  const needsWork = leads.filter(l => l.totalQuestions > 0 && (l.score / l.totalQuestions) * 100 < 60).length;
  const scoreDistribution = [
    { name: 'Excellent', range: '80-100%', count: excellent, color: '#22c55e' },
    { name: 'Good', range: '60-79%', count: good, color: '#3b82f6' },
    { name: 'Needs Work', range: '<60%', count: needsWork, color: '#f59e0b' },
  ];

  // Quest popularity (simulated from lead data spread)
  const questData = [
    { name: 'English Forest', leads: 8, color: '#22c55e' },
    { name: 'Numbers Island', leads: 5, color: '#3b82f6' },
    { name: 'Rimba Bahasa', leads: 4, color: '#a855f7' },
    { name: 'Mandarin Mountain', leads: 2, color: '#ef4444' },
    { name: 'Mystery Jungle', leads: 1, color: '#f59e0b' },
  ];

  // Recent 5 leads
  const recentLeads = leads.slice(0, 5);

  // Top scorers
  const topScorers = [...leads]
    .filter(l => l.totalQuestions > 0)
    .sort((a, b) => (b.score / b.totalQuestions) - (a.score / a.totalQuestions))
    .slice(0, 3);

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'leads', icon: Users, label: 'Leads' },
    { id: 'marketing', icon: Megaphone, label: 'Marketing' },
    // Question Bank & Quest Manager removed — content management is Super Admin only
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
          onClose={() => {
            setShowWhatsAppModal(false);
            setSelectedLead(null);
          }}
        />
      )}

      {/* Report Modal */}
      {showReportModal && reportLead && (
        <ReportModal
          lead={reportLead}
          onClose={() => {
            setShowReportModal(false);
            setReportLead(null);
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
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-1
                  ${isActive 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  ${!mobileMenuOpen && isCollapsed ? 'md:justify-center' : ''}
                `}
                title={!mobileMenuOpen && isCollapsed ? item.label : ''}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {(mobileMenuOpen || !isCollapsed) && <span>{item.label}</span>}
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
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="border border-gray-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Users className="w-4.5 h-4.5 text-blue-600" />
                    </div>
                    <span className="text-[10px] md:text-xs font-medium text-green-600 bg-green-50 px-1.5 md:px-2 py-0.5 rounded-full">+{thisMonthLeads} this mo</span>
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-gray-900">{totalLeads}</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">Total Leads</div>
                </div>

                <div className="border border-gray-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Target className="w-4.5 h-4.5 text-emerald-600" />
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-gray-900">{averageScore}%</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">Average Score</div>
                </div>

                <div className="border border-gray-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Trophy className="w-4.5 h-4.5 text-amber-600" />
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-gray-900">{highScorers}</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">High Scorers (80%+)</div>
                </div>

                <div className="border border-gray-100 rounded-xl p-4 md:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
                      <CalendarDays className="w-4.5 h-4.5 text-purple-600" />
                    </div>
                  </div>
                  <div className="text-xl md:text-2xl font-semibold text-gray-900">{thisMonthLeads}</div>
                  <div className="text-xs md:text-sm text-gray-500 mt-0.5">This Month</div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Score Distribution */}
                <div className="border border-gray-100 rounded-xl p-4 md:p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Score Distribution</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart data={scoreDistribution} barSize={40}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
                        <Tooltip
                          cursor={{ fill: '#f9fafb' }}
                          contentStyle={{ border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' }}
                          formatter={(value: number, name: string) => [`${value} children`, '']}
                          labelFormatter={(label: string) => {
                            const item = scoreDistribution.find(d => d.name === label);
                            return `${label} (${item?.range})`;
                          }}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {scoreDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-3 pt-3 border-t border-gray-50">
                    {scoreDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-gray-500">{item.name} ({item.count})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quest Popularity */}
                <div className="border border-gray-100 rounded-xl p-4 md:p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Leads by Quest</h3>
                  <div className="space-y-3">
                    {questData.map((quest) => {
                      const maxLeads = Math.max(...questData.map(q => q.leads));
                      const widthPercent = maxLeads > 0 ? (quest.leads / maxLeads) * 100 : 0;
                      return (
                        <div key={quest.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-gray-700">{quest.name}</span>
                            <span className="text-sm font-medium text-gray-900">{quest.leads}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${widthPercent}%`, backgroundColor: quest.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Top Scorers */}
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Top Scorers</h4>
                    <div className="space-y-2">
                      {topScorers.map((lead, i) => {
                        const pct = Math.round((lead.score / lead.totalQuestions) * 100);
                        return (
                          <div key={lead.id} className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-50 text-orange-600'
                            }`}>
                              {i + 1}
                            </div>
                            <span className="text-sm text-gray-900 flex-1">{lead.childName}</span>
                            <span className="text-sm font-medium text-gray-900">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Leads (compact - last 5 only) */}
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
                  {recentLeads.map((lead) => {
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
                        <div className="hidden sm:block text-xs text-gray-400 w-24 text-right mr-4">{lead.completedAt}</div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setReportLead(lead); setShowReportModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Report"
                          >
                            <FileText className="w-3.5 h-3.5" />
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

              {/* Quick Actions */}
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
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              </div>

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
                                onClick={() => { setReportLead(lead); setShowReportModal(true); }}
                                className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setSelectedLead(lead); setShowWhatsAppModal(true); }}
                                className="p-1.5 text-green-600 bg-green-50 rounded-lg"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {isLoadingLeads ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                              <p>Loading leads...</p>
                            </div>
                          </td>
                        </tr>
                      ) : leads.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                          const isBlurred = isTrialAccount && index >= 15; // Blur 16th lead onwards (index 15+)
                          
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
                              <td className="px-6 py-4 text-sm text-gray-600">{lead.completedAt}</td>
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
                                      onClick={() => {
                                        setReportLead(lead);
                                        setShowReportModal(true);
                                      }}
                                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      Report
                                    </button>
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

          {activeMenu === 'marketing' && (
            <MarketingPage />
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