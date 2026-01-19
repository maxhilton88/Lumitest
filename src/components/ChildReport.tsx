import React from 'react';
import { Award, TrendingUp, Target, CheckCircle, XCircle } from 'lucide-react';

interface ReportData {
  childName: string;
  parentName: string;
  age: number;
  score: number;
  totalQuestions: number;
  completedAt: string;
  questResults: {
    quest: string;
    score: number;
    total: number;
  }[];
  agePerformance: {
    age: number;
    correct: number;
    total: number;
  }[];
}

interface ChildReportProps {
  data: ReportData;
}

export const ChildReport: React.FC<ChildReportProps> = ({ data }) => {
  const percentage = Math.round((data.score / data.totalQuestions) * 100);
  const grade = percentage >= 80 ? 'Excellent' : percentage >= 60 ? 'Good' : percentage >= 40 ? 'Fair' : 'Needs Improvement';
  const gradeColor = percentage >= 80 ? '#7cc643' : percentage >= 60 ? '#4a90e2' : percentage >= 40 ? '#f39c12' : '#e74c3c';

  return (
    <div className="w-full max-w-4xl mx-auto bg-white" id="child-report">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#7cc643] to-[#3d7c54] text-white p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">🦊 Foxy Adventure</h1>
            <p className="text-white/90">KSSR Readiness Assessment Report</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-white/80">Report Date</p>
            <p className="text-lg font-semibold">{data.completedAt}</p>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-white/70 text-sm mb-1">Child's Name</p>
              <p className="text-2xl font-bold">{data.childName}</p>
            </div>
            <div>
              <p className="text-white/70 text-sm mb-1">Parent's Name</p>
              <p className="text-xl font-semibold">{data.parentName}</p>
            </div>
            <div>
              <p className="text-white/70 text-sm mb-1">Age</p>
              <p className="text-xl font-semibold">{data.age} years old</p>
            </div>
            <div>
              <p className="text-white/70 text-sm mb-1">Test Completed</p>
              <p className="text-xl font-semibold">{data.completedAt}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Score */}
      <div className="p-8">
        <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Overall Performance</h2>
              <p className="text-gray-600">Total Score: {data.score} out of {data.totalQuestions} questions</p>
            </div>
            <div className="text-center">
              <div 
                className="w-32 h-32 rounded-full flex items-center justify-center mb-3"
                style={{ background: `conic-gradient(${gradeColor} ${percentage * 3.6}deg, #f0f0f0 0deg)` }}
              >
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-black" style={{ color: gradeColor }}>{percentage}%</div>
                    <Award className="w-6 h-6 mx-auto mt-1" style={{ color: gradeColor }} />
                  </div>
                </div>
              </div>
              <div 
                className="text-lg font-bold px-4 py-2 rounded-full"
                style={{ backgroundColor: `${gradeColor}20`, color: gradeColor }}
              >
                {grade}
              </div>
            </div>
          </div>
        </div>

        {/* Quest Performance */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Performance by Quest
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {data.questResults.map((quest, index) => {
              const questPercentage = Math.round((quest.score / quest.total) * 100);
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{quest.quest}</span>
                    <span className="text-sm font-medium text-gray-600">{quest.score}/{quest.total} ({questPercentage}%)</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${questPercentage}%`,
                        backgroundColor: questPercentage >= 70 ? '#7cc643' : questPercentage >= 50 ? '#f39c12' : '#e74c3c'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Age-Level Performance Analysis */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Age-Level Performance Analysis
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="grid grid-cols-4 gap-4 mb-4">
              {data.agePerformance.map((age) => {
                const agePercentage = Math.round((age.correct / age.total) * 100);
                return (
                  <div key={age.age} className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Age {age.age}</div>
                    <div className="text-2xl font-bold mb-1" style={{ 
                      color: agePercentage >= 70 ? '#7cc643' : agePercentage >= 40 ? '#f39c12' : '#e74c3c'
                    }}>
                      {agePercentage}%
                    </div>
                    <div className="text-xs text-gray-500">{age.correct}/{age.total}</div>
                  </div>
                );
              })}
            </div>
            
            {/* Insights */}
            <div className="bg-white rounded-lg p-4 border border-blue-300">
              <h4 className="font-bold text-gray-900 mb-2">📊 Performance Insights:</h4>
              {data.agePerformance.map((age) => {
                const agePercentage = Math.round((age.correct / age.total) * 100);
                const isCurrentAge = age.age === data.age;
                const insight = agePercentage >= 70 ? '✅ Excellent!' : agePercentage >= 40 ? '👍 Good progress' : '📚 Needs more practice';
                
                return (
                  <div key={age.age} className="flex items-start gap-2 mb-2">
                    {agePercentage >= 70 ? (
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-orange-600 mt-0.5" />
                    )}
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Age {age.age} questions:</span> {insight}
                      {isCurrentAge && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Current Age</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-gradient-to-r from-[#7cc643]/10 to-[#3d7c54]/10 border-2 border-[#7cc643] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">💡 Recommendations</h3>
          <div className="space-y-3">
            {percentage >= 80 ? (
              <>
                <p className="text-gray-700">✨ <strong>Excellent work!</strong> {data.childName} is performing above age level and shows strong KSSR readiness.</p>
                <p className="text-gray-700">🎯 Continue challenging with age {data.age + 1} level materials to maintain progress.</p>
              </>
            ) : percentage >= 60 ? (
              <>
                <p className="text-gray-700">👍 <strong>Good progress!</strong> {data.childName} is on track for KSSR readiness.</p>
                <p className="text-gray-700">📚 Focus on areas scoring below 70% to strengthen overall performance.</p>
              </>
            ) : (
              <>
                <p className="text-gray-700">📖 <strong>Keep practicing!</strong> {data.childName} would benefit from additional practice in key areas.</p>
                <p className="text-gray-700">👨‍👩‍👧 We recommend working together on foundational skills and retaking the assessment in 2-3 weeks.</p>
              </>
            )}
            <p className="text-gray-700">📞 <strong>Need guidance?</strong> Contact us for personalized learning recommendations!</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>Generated by Foxy Adventure KSSR Readiness Assessment</p>
          <p className="mt-1">For questions, contact your kindergarten administrator</p>
        </div>
      </div>
    </div>
  );
};

export const generateReportHTML = (data: ReportData): string => {
  // This would be used to generate a full HTML document for PDF conversion
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${data.childName} - Assessment Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          /* Add more styles here for PDF generation */
        </style>
      </head>
      <body>
        <!-- Report content would be rendered here -->
      </body>
    </html>
  `;
};
