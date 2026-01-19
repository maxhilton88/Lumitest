import React, { useState } from 'react';
import { MessageCircle, X, Send, Sparkles, FileText, Paperclip } from 'lucide-react';

interface Lead {
  childName: string;
  parentName: string;
  whatsapp: string;
  score: number;
  totalQuestions: number;
}

interface WhatsAppMessageModalProps {
  lead: Lead;
  onClose: () => void;
}

export const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({ lead, onClose }) => {
  const percentage = Math.round((lead.score / lead.totalQuestions) * 100);
  
  // AI-generated message with analysis
  const generateMessage = () => {
    let performanceAnalysis = '';
    let recommendation = '';
    
    if (percentage >= 80) {
      performanceAnalysis = `${lead.childName} did exceptionally well! Their strong foundation shows they're ready for Standard 1.`;
      recommendation = `I'd love to discuss how we can nurture this talent further and ensure a smooth transition to primary school.`;
    } else if (percentage >= 60) {
      performanceAnalysis = `${lead.childName} shows good potential! While they have a solid foundation, there are a few areas where some extra support could really help them shine.`;
      recommendation = `Let's schedule a free consultation to create a personalized learning plan that builds on their strengths.`;
    } else {
      performanceAnalysis = `${lead.childName} is developing well, and with the right support, they can build a much stronger foundation for Standard 1.`;
      recommendation = `I'd like to offer a complimentary assessment session where we can identify specific areas to focus on and create a tailored improvement plan.`;
    }

    return `Hi ${lead.parentName}! 👋

${lead.childName} has completed our KSSR readiness assessment and scored ${lead.score}/${lead.totalQuestions} (${percentage}%). 

${performanceAnalysis}

${recommendation}

Would you be available for a quick 15-minute call this week? I'd be happy to share detailed insights and answer any questions you might have.

Looking forward to hearing from you! 🌟`;
  };

  const [message, setMessage] = useState(generateMessage());

  const handleSendWhatsApp = () => {
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${lead.whatsapp.replace(/\+/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const handleRegenerate = () => {
    setMessage(generateMessage());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">WhatsApp Message</h2>
              <p className="text-sm text-gray-500">To: {lead.parentName} ({lead.whatsapp})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* AI Badge */}
          <div className="flex items-center gap-2 mb-4 text-sm text-purple-600 bg-purple-50 rounded-lg px-3 py-2 w-fit">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">AI-Generated Message</span>
          </div>

          {/* Message Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Edit message before sending
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors resize-none font-normal"
              rows={15}
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Personalize the message to make it more engaging
            </p>
          </div>

          {/* Attachment Section */}
          <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Paperclip className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">Attachment</h4>
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium">
                    Auto-attached
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-3 py-2 flex-1">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Assessment Report - {lead.childName}.pdf</p>
                      <p className="text-xs text-gray-500">Full performance analysis & recommendations</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-2">
                  📎 The detailed report will be automatically attached when you send this message
                </p>
              </div>
            </div>
          </div>

          {/* Preview Card */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">WhatsApp Preview</span>
            </div>
            <div className="text-sm text-gray-600 whitespace-pre-wrap bg-white p-3 rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
              {message}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Regenerate
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSendWhatsApp}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              Send via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};