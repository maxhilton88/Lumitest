import React, { useState } from 'react';
import { TrendingUp, Users, Award, Target, Calendar, BarChart3 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState('7days');

  // Sample data
  const completionTrends = [
    { date: 'Jan 11', tests: 12 },
    { date: 'Jan 12', tests: 19 },
    { date: 'Jan 13', tests: 15 },
    { date: 'Jan 14', tests: 25 },
    { date: 'Jan 15', tests: 22 },
    { date: 'Jan 16', tests: 30 },
    { date: 'Jan 17', tests: 28 }
  ];

  const questPerformance = [
    { quest: 'English Forest', avgScore: 75, completions: 45 },
    { quest: 'Numbers Island', avgScore: 82, completions: 52 },
    { quest: 'Rimba Bahasa', avgScore: 68, completions: 38 },
    { quest: 'Mandarin Mountain', avgScore: 71, completions: 25 },
    { quest: 'Mystery Jungle', avgScore: 79, completions: 40 }
  ];

  const ageDistribution = [
    { age: '4 years', count: 15, color: '#7cc643' },
    { age: '5 years', count: 42, color: '#4a90e2' },
    { age: '6 years', count: 38, color: '#f39c12' },
    { age: '7 years', count: 25, color: '#e74c3c' }
  ];

  const scoreDistribution = [
    { range: '0-20%', count: 5 },
    { range: '21-40%', count: 12 },
    { range: '41-60%', count: 28 },
    { range: '61-80%', count: 45 },
    { range: '81-100%', count: 30 }
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Track performance and engagement metrics</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900"
        >
          <option value="7days">Last 7 days</option>
          <option value="30days">Last 30 days</option>
          <option value="90days">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs text-green-600 font-medium">+12%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">120</div>
          <div className="text-sm text-gray-500">Total Tests Taken</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs text-green-600 font-medium">+5%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">76%</div>
          <div className="text-sm text-gray-500">Average Score</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-xs text-green-600 font-medium">+8%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">89%</div>
          <div className="text-sm text-gray-500">Completion Rate</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs text-green-600 font-medium">+15%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">28</div>
          <div className="text-sm text-gray-500">This Week</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Test Completion Trends */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Test Completion Trends
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={completionTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#999" style={{ fontSize: '12px' }} />
              <YAxis stroke="#999" style={{ fontSize: '12px' }} />
              <Tooltip />
              <Line type="monotone" dataKey="tests" stroke="#7cc643" strokeWidth={2} dot={{ fill: '#7cc643' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Age Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Age Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={ageDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ age, count }) => `${age}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {ageDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Quest Performance */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Quest Performance
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={questPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="quest" stroke="#999" style={{ fontSize: '11px' }} angle={-15} textAnchor="end" height={80} />
              <YAxis stroke="#999" style={{ fontSize: '12px' }} />
              <Tooltip />
              <Bar dataKey="avgScore" fill="#4a90e2" name="Avg Score %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4" />
            Score Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" stroke="#999" style={{ fontSize: '12px' }} />
              <YAxis stroke="#999" style={{ fontSize: '12px' }} />
              <Tooltip />
              <Bar dataKey="count" fill="#7cc643" name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Performing Quests Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Quest Performance Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {questPerformance.map((quest, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{quest.quest}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{quest.completions}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      quest.avgScore >= 80 ? 'bg-green-100 text-green-700' :
                      quest.avgScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {quest.avgScore}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-green-600 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      +{Math.floor(Math.random() * 10)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
