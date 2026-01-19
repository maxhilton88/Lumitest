import React, { useState } from 'react';
import { LayoutDashboard, Users, Download, Settings, LogOut, BarChart3, Menu, MessageCircle, Zap, BookOpen, FileText } from 'lucide-react';
import { UpgradePage } from '../billing/UpgradePage';
import { StripeCheckout } from '../billing/StripeCheckout';
import { WhatsAppMessageModal } from '../WhatsAppMessageModal';
import { QuestionBank } from '../admin/QuestionBank';
import { QuestManager } from '../admin/QuestManager';
import { AnalyticsPage } from '../admin/AnalyticsPage';
import { SettingsPage } from '../admin/SettingsPage';
import { ChildReport } from '../ChildReport';
import { ReportModal } from '../ReportModal';
import { Question } from '../screens/QuestionScreen';
import { toast } from 'sonner';

interface Lead {
  id: string;
  childName: string;
  parentName: string;
  whatsapp: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
}

interface KindergartenDashboardProps {
  schoolName: string;
  onLogout: () => void;
  questionBank: Question[];
  setQuestionBank: (questions: Question[]) => void;
  questConfigs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }>;
  setQuestConfigs: (configs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }>) => void;
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
  questionBank,
  setQuestionBank,
  questConfigs,
  setQuestConfigs,
  brandingSettings,
  setBrandingSettings
}) => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ id: string; name: string; amount: number; cycle: 'monthly' | 'annual' } | null>(null);
  const [isTrialAccount, setIsTrialAccount] = useState(true); // Set to true for trial accounts
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLead, setReportLead] = useState<Lead | null>(null);
  const [leads] = useState<Lead[]>([
    {
      id: '1',
      childName: 'Emma Wong',
      parentName: 'Sarah Wong',
      whatsapp: '+60123456789',
      score: 8,
      totalQuestions: 10,
      completedAt: '2026-01-16 10:30 AM'
    },
    {
      id: '2',
      childName: 'Ahmad Razak',
      parentName: 'Fatimah Razak',
      whatsapp: '+60129876543',
      score: 9,
      totalQuestions: 10,
      completedAt: '2026-01-15 2:45 PM'
    },
    {
      id: '3',
      childName: 'Li Wei',
      parentName: 'Chen Li',
      whatsapp: '+60187654321',
      score: 7,
      totalQuestions: 10,
      completedAt: '2026-01-15 11:20 AM'
    },
    // Add more leads to demonstrate the 15-lead limit
    ...Array.from({ length: 15 }, (_, i) => ({
      id: String(i + 4),
      childName: `Child ${i + 4}`,
      parentName: `Parent ${i + 4}`,
      whatsapp: `+6012345${String(i + 4).padStart(4, '0')}`,
      score: Math.floor(Math.random() * 10) + 1,
      totalQuestions: 10,
      completedAt: '2026-01-14 9:00 AM'
    }))
  ]);

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
  const averageScore = Math.round(leads.reduce((acc, lead) => acc + (lead.score / lead.totalQuestions * 100), 0) / leads.length);

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'leads', icon: Users, label: 'Leads' },
    { id: 'questions', icon: BookOpen, label: 'Question Bank' },
    { id: 'quests', icon: FileText, label: 'Quest Manager' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const handleSelectPlan = (planId: string) => {
    const plans: any = {
      pro: { name: 'Professional', monthly: 49, annual: 356 },
      enterprise: { name: 'Enterprise', monthly: 149, annual: 1428 }
    };
    
    if (planId === 'enterprise') {
      toast.info('Please contact sales@projectlumi.org for Enterprise plans');
      return;
    }
    
    if (plans[planId]) {
      setSelectedPlan({
        id: planId,
        name: plans[planId].name,
        amount: plans[planId].annual,
        cycle: 'annual'
      });
      setShowUpgrade(false);
      setShowCheckout(true);
    }
  };

  const handlePaymentSuccess = () => {
    setShowCheckout(false);
    setSelectedPlan(null);
    toast.success('Payment successful! Your subscription has been activated.');
  };

  if (showUpgrade) {
    return (
      <UpgradePage
        onClose={() => setShowUpgrade(false)}
        onSelectPlan={handleSelectPlan}
      />
    );
  }

  if (showCheckout && selectedPlan) {
    return (
      <StripeCheckout
        planId={selectedPlan.id}
        planName={selectedPlan.name}
        amount={selectedPlan.amount}
        billingCycle={selectedPlan.cycle}
        onBack={() => {
          setShowCheckout(false);
          setShowUpgrade(true);
        }}
        onSuccess={handlePaymentSuccess}
      />
    );
  }

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

      {/* Sidebar */}
      <aside className={`border-r border-gray-100 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-100 justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <span className="font-semibold text-gray-900">Project Lumi</span>
            </div>
          )}
          {isCollapsed && (
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-sm">L</span>
            </div>
          )}
        </div>

        {/* School Name - Only shown when expanded */}
        {!isCollapsed && (
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Organization</div>
            <div className="text-sm font-medium text-gray-900 truncate">{schoolName}</div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-1
                  ${isActive 
                    ? 'bg-gray-100 text-gray-900' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : ''}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Collapse Toggle & Logout */}
        <div className="p-2 border-t border-gray-100 space-y-1">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="h-16 border-b border-gray-100 flex items-center justify-between px-8">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          </div>
          <button
            onClick={() => setShowUpgrade(true)}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Upgrade
          </button>
        </header>

        {/* Content */}
        <div className="p-8">
          {activeMenu === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Total Leads</div>
                  <div className="text-3xl font-semibold text-gray-900">{totalLeads}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Average Score</div>
                  <div className="text-3xl font-semibold text-gray-900">{averageScore}%</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">This Month</div>
                  <div className="text-3xl font-semibold text-gray-900">{totalLeads}</div>
                </div>
              </div>

              {/* Leads Table */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Recent Leads</h2>
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>

                <div className="border border-gray-100 rounded-lg overflow-hidden">
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
                      {leads.map((lead, index) => {
                        const percentage = Math.round((lead.score / lead.totalQuestions) * 100);
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
                                  onClick={() => setShowUpgrade(true)}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                  Upgrade to Contact
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
                      })}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'leads' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">All Leads</h2>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="border border-gray-100 rounded-lg overflow-hidden">
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
                    {leads.map((lead, index) => {
                      const percentage = Math.round((lead.score / lead.totalQuestions) * 100);
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
                                onClick={() => setShowUpgrade(true)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                Upgrade to Contact
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeMenu === 'questions' && (
            <div>
              <QuestionBank 
                questionBank={questionBank}
                setQuestionBank={setQuestionBank}
              />
            </div>
          )}

          {activeMenu === 'quests' && (
            <div>
              <QuestManager 
                questConfigs={questConfigs}
                setQuestConfigs={setQuestConfigs}
              />
            </div>
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