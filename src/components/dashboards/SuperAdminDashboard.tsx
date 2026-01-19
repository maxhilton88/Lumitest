import React, { useState } from 'react';
import { MasterQuestionBank } from './MasterQuestionBank';
import { QuestManager } from '../admin/QuestManager';
import { Question } from '../screens/QuestionScreen';
import { 
  LayoutDashboard, 
  School, 
  BookOpen,
  CreditCard,
  Settings,
  LogOut,
  Plus,
  ChevronRight,
  Menu,
  Map
} from 'lucide-react';

interface School {
  id: string;
  name: string;
  email: string;
  leadsGenerated: number;
  subscriptionStatus: 'active' | 'trial' | 'expired';
  expiryDate: string;
  revenue: number;
}

interface SuperAdminDashboardProps {
  onLogout: () => void;
  questionBank: Question[];
  setQuestionBank: (questions: Question[]) => void;
  questConfigs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }>;
  setQuestConfigs: (configs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }>) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ 
  onLogout,
  questionBank,
  setQuestionBank,
  questConfigs,
  setQuestConfigs
}) => {
  const [activeMenu, setActiveMenu] = useState('overview');
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed
  
  const [schools] = useState<School[]>([
    {
      id: '1',
      name: 'Little Stars Kindergarten',
      email: 'admin@littlestars.com',
      leadsGenerated: 45,
      subscriptionStatus: 'active',
      expiryDate: '2027-01-16',
      revenue: 356
    },
    {
      id: '2',
      name: 'Rainbow Kids Preschool',
      email: 'info@rainbowkids.com',
      leadsGenerated: 28,
      subscriptionStatus: 'active',
      expiryDate: '2026-12-20',
      revenue: 356
    },
    {
      id: '3',
      name: 'Sunshine Academy',
      email: 'hello@sunshine.edu.my',
      leadsGenerated: 12,
      subscriptionStatus: 'trial',
      expiryDate: '2026-01-30',
      revenue: 0
    }
  ]);

  const totalSchools = schools.length;
  const totalLeads = schools.reduce((acc, school) => acc + school.leadsGenerated, 0);
  const totalRevenue = schools.reduce((acc, school) => acc + school.revenue, 0);
  const activeSchools = schools.filter(s => s.subscriptionStatus === 'active').length;

  const menuItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'schools', icon: School, label: 'Schools' },
    { id: 'islands', icon: Map, label: 'Islands' },
    { id: 'questions', icon: BookOpen, label: 'Question Bank' },
    { id: 'billing', icon: CreditCard, label: 'Billing' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-white">
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

        {/* Admin Badge - Only shown when expanded */}
        {!isCollapsed && (
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Role</div>
            <div className="text-sm font-medium text-gray-900">Super Administrator</div>
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
            <h1 className="text-lg font-semibold text-gray-900">
              {menuItems.find(m => m.id === activeMenu)?.label}
            </h1>
          </div>
          {activeMenu === 'schools' && (
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors">
              <Plus className="w-4 h-4" />
              Add School
            </button>
          )}
        </header>

        {/* Content */}
        <div className="p-8">
          {activeMenu === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Total Schools</div>
                  <div className="text-3xl font-semibold text-gray-900">{totalSchools}</div>
                  <div className="text-xs text-gray-400 mt-1">{activeSchools} active</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Total Leads</div>
                  <div className="text-3xl font-semibold text-gray-900">{totalLeads}</div>
                  <div className="text-xs text-gray-400 mt-1">All schools</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">Revenue</div>
                  <div className="text-3xl font-semibold text-gray-900">RM{totalRevenue.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">Annual</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500 mb-1">MRR</div>
                  <div className="text-3xl font-semibold text-gray-900">RM{Math.round(totalRevenue / 12)}</div>
                  <div className="text-xs text-gray-400 mt-1">Monthly recurring</div>
                </div>
              </div>

              {/* Recent Schools */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
                  <button 
                    onClick={() => setActiveMenu('schools')}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    View all
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
                  {schools.slice(0, 3).map((school) => (
                    <div key={school.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{school.name}</div>
                          <div className="text-xs text-gray-500 mt-1">{school.email}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">{school.leadsGenerated} leads</div>
                          <div className={`text-xs mt-1 ${
                            school.subscriptionStatus === 'active' ? 'text-green-600' :
                            school.subscriptionStatus === 'trial' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {school.subscriptionStatus}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'schools' && (
            <div>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">School</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Leads</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Expiry</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Revenue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schools.map((school) => (
                      <tr key={school.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">{school.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{school.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{school.leadsGenerated}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`
                            ${school.subscriptionStatus === 'active' ? 'text-green-600' :
                              school.subscriptionStatus === 'trial' ? 'text-yellow-600' :
                              'text-red-600'}
                          `}>
                            {school.subscriptionStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{school.expiryDate}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">RM{school.revenue}</td>
                        <td className="px-6 py-4 text-sm">
                          <button className="text-gray-900 hover:text-gray-700">View →</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeMenu === 'questions' && (
            <div className="-m-8">
              <MasterQuestionBank />
            </div>
          )}

          {activeMenu === 'islands' && (
            <div className="-m-8">
              <QuestManager 
                questConfigs={questConfigs}
                setQuestConfigs={setQuestConfigs}
              />
            </div>
          )}

          {activeMenu === 'billing' && (
            <div className="space-y-6">
              <div className="border border-gray-100 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Pricing Configuration</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Annual Price</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">RM</span>
                      <input
                        type="number"
                        defaultValue={356}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Trial Days</label>
                    <input
                      type="number"
                      defaultValue={14}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-900"
                    />
                  </div>
                </div>
                <button className="mt-4 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors">
                  Save Changes
                </button>
              </div>

              <div className="border border-gray-100 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Transactions</h3>
                <div className="divide-y divide-gray-100">
                  {[
                    { school: 'Little Stars Kindergarten', amount: 356, date: '2026-01-16', status: 'success' },
                    { school: 'Rainbow Kids Preschool', amount: 356, date: '2025-12-20', status: 'success' },
                    { school: 'Sunshine Academy', amount: 0, date: '2026-01-16', status: 'trial' }
                  ].map((txn, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-900">{txn.school}</div>
                        <div className="text-xs text-gray-500">{txn.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">RM{txn.amount}</div>
                        <div className={`text-xs ${txn.status === 'success' ? 'text-green-600' : 'text-yellow-600'}`}>
                          {txn.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'settings' && (
            <div>
              <div className="text-sm text-gray-500">Settings coming soon...</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};