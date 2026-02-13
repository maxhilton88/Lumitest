import React from 'react';
import { X, Download, Printer } from 'lucide-react';
import { ChildReport } from './ChildReport';

interface ReportModalProps {
  lead: {
    id: string;
    childName: string;
    parentName: string;
    whatsapp: string;
    score: number;
    totalQuestions: number;
    completedAt: string;
  };
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ lead, onClose }) => {
  // Generate realistic report data from lead
  // NOTE: In backend integration, this data would come from stored test results
  const generateReportData = () => {
    const totalQuestions = lead.totalQuestions;
    const totalScore = lead.score;
    
    // Distribute score across ~4 quests (assuming 4-module test)
    const questsCompleted = Math.min(4, Math.ceil(totalQuestions / 5));
    const questResults = [];
    let remainingScore = totalScore;
    let remainingTotal = totalQuestions;
    
    const questNames = ['English Forest', 'Numbers Island', 'Rimba Bahasa', 'Mystery Jungle'];
    
    for (let i = 0; i < questsCompleted; i++) {
      const questTotal = Math.floor(remainingTotal / (questsCompleted - i));
      const maxPossible = Math.min(questTotal, remainingScore);
      const questScore = Math.max(0, Math.floor(maxPossible * (0.7 + Math.random() * 0.3)));
      
      questResults.push({
        quest: questNames[i],
        score: questScore,
        total: questTotal
      });
      
      remainingScore -= questScore;
      remainingTotal -= questTotal;
    }
    
    // Distribute performance across age levels (4, 5, 6, 7)
    const ageLevels = [4, 5, 6, 7];
    const agePerformance = [];
    let ageRemainingScore = totalScore;
    let ageRemainingTotal = totalQuestions;
    
    for (let i = 0; i < ageLevels.length; i++) {
      const ageTotal = Math.floor(ageRemainingTotal / (ageLevels.length - i));
      if (ageTotal > 0) {
        const maxPossible = Math.min(ageTotal, ageRemainingScore);
        const ageCorrect = Math.max(0, Math.floor(maxPossible * (0.6 + Math.random() * 0.4)));
        
        agePerformance.push({
          age: ageLevels[i],
          correct: ageCorrect,
          total: ageTotal
        });
        
        ageRemainingScore -= ageCorrect;
        ageRemainingTotal -= ageTotal;
      }
    }
    
    return {
      childName: lead.childName,
      parentName: lead.parentName,
      age: 5, // Default age - would come from actual test data
      score: totalScore,
      totalQuestions: totalQuestions,
      completedAt: lead.completedAt,
      questResults,
      agePerformance: agePerformance.filter(perf => perf.total > 0)
    };
  };
  
  const reportData = generateReportData();

  const handleDownloadPDF = () => {
    // In a real implementation, this would generate a PDF
    // For now, we'll use the browser's print dialog
    window.print();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assessment Report</h2>
            <p className="text-sm text-gray-500 mt-1">{lead.childName} - {lead.completedAt}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable Report */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <ChildReport data={reportData} />
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #child-report, #child-report * {
            visibility: visible;
          }
          #child-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};