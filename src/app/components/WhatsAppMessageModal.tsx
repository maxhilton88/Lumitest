import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Link2, Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { getFreshAdminToken } from '../utils/supabase-client';
import { toast } from 'sonner@2.0.3';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

interface Lead {
  id: string;
  childName: string;
  parentName: string;
  whatsapp: string;
  score: number;
  totalQuestions: number;
}

interface WhatsAppMessageModalProps {
  lead: Lead;
  schoolName?: string;
  onClose: () => void;
}

export const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({ lead, schoolName, onClose }) => {
  const percentage = Math.round((lead.score / lead.totalQuestions) * 100);

  const [reportId, setReportId] = useState<string | null>(null);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const reportUrl = reportId ? `${window.location.origin}/report/${reportId}` : null;

  // ── Create shareable report on mount ──
  useEffect(() => {
    createShareableReport();
  }, []);

  const createShareableReport = async () => {
    setIsCreatingReport(true);
    try {
      const token = await getFreshAdminToken();
      const res = await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': `Bearer ${token}`,
        },
        body: JSON.stringify({ leadId: lead.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportId(data.reportId);
        console.log(`[WHATSAPP] Report created/found: ${data.reportId} (existing: ${data.isExisting})`);
      } else {
        console.error('[WHATSAPP] Failed to create report:', data.error);
        toast.error('Could not generate report link. You can still send a text message.');
      }
    } catch (err) {
      console.error('[WHATSAPP] Report creation error:', err);
      toast.error('Network error creating report link.');
    } finally {
      setIsCreatingReport(false);
    }
  };

  // ── AI-generated message ──
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

    const schoolLine = schoolName ? ` at ${schoolName}` : '';
    const reportLine = reportUrl
      ? `\n\nView the full report here:\n${reportUrl}\n\nYou can also download it as PDF from the link above.\nThis link is active for 30 days — sign up free to save it permanently and track ${lead.childName}'s progress over time.`
      : '';

    return `Hi ${lead.parentName}! 👋

${lead.childName} has completed the KSSR readiness assessment${schoolLine} and scored ${lead.score}/${lead.totalQuestions} (${percentage}%).

${performanceAnalysis}${reportLine}

${recommendation}

Would you be available for a quick 15-minute call this week? I'd be happy to share detailed insights and answer any questions you might have.

Looking forward to hearing from you! 🌟`;
  };

  const [message, setMessage] = useState('');

  // Regenerate message whenever reportUrl becomes available
  useEffect(() => {
    setMessage(generateMessage());
  }, [reportUrl]);

  const handleSendWhatsApp = () => {
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${lead.whatsapp.replace(/\+/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const handleRegenerate = () => {
    setMessage(generateMessage());
  };

  const handleCopyLink = async () => {
    if (!reportUrl) return;
    try {
      await navigator.clipboard.writeText(reportUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast.success('Report link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
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

          {/* Report Link Section */}
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Link2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-900">Shareable Report Link</h4>
                  {isCreatingReport ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating...
                    </span>
                  ) : reportUrl ? (
                    <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">
                      Included in message
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">
                      Unavailable
                    </span>
                  )}
                </div>
                {reportUrl ? (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-white border border-emerald-200 rounded-lg px-3 py-2 text-xs text-gray-600 truncate font-mono">
                      {reportUrl}
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors flex-shrink-0"
                    >
                      {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {linkCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                ) : !isCreatingReport ? (
                  <p className="text-xs text-amber-700 mt-1">
                    Could not generate report link. The parent will still receive score summary in the text message.
                  </p>
                ) : null}
                {reportUrl && (
                  <p className="text-xs text-emerald-700 mt-2">
                    Parent can view the full report online and download as PDF. Link active for 30 days.
                  </p>
                )}
              </div>
            </div>
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
              Tip: Personalize the message to make it more engaging
            </p>
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Regenerate
            </button>
            {reportUrl && (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Preview Report
              </a>
            )}
          </div>
          
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
