import React, { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { FantasyPanel, FantasyTitle, GoldOrnament } from './FantasyBackground';
import { updateParentProfile } from '../utils/parent-api';
import { playMenuSelect } from '../hooks/useSoundEffects';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

interface WhatsAppPromptModalProps {
  parentName: string;
  onComplete: (phone: string) => void;
  onSkip: () => void;
}

export const WhatsAppPromptModal: React.FC<WhatsAppPromptModalProps> = ({
  parentName,
  onComplete,
  onSkip,
}) => {
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Basic Malaysian phone validation: +60 followed by 9-10 digits, or 01x format
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/[\s\-()]/g, '');
    // If starts with 0, convert to +60
    if (digits.startsWith('0')) return '+6' + digits;
    // If starts with 60, add +
    if (digits.startsWith('60')) return '+' + digits;
    // If already has +60
    if (digits.startsWith('+60')) return digits;
    return digits;
  };

  const isValidPhone = (raw: string): boolean => {
    const normalized = normalizePhone(raw);
    // Malaysian mobile: +60 1x xxxx xxxx (10-11 digits after +60)
    return /^\+60\d{9,11}$/.test(normalized);
  };

  const handleSubmit = async () => {
    if (!phone.trim()) {
      setError('Please enter your WhatsApp number');
      return;
    }
    if (!isValidPhone(phone)) {
      setError('Please enter a valid Malaysian phone number (e.g. 012-345 6789)');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const normalized = normalizePhone(phone);
      await updateParentProfile({ phone: normalized });
      toast.success('WhatsApp number saved!');
      onComplete(normalized);
    } catch (err: any) {
      console.error('[WhatsApp Prompt] Save failed:', err);
      setError('Failed to save — you can try again or skip for now');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(15,10,5,0.85) 0%, rgba(5,3,1,0.95) 100%)',
          backdropFilter: 'blur(6px)',
        }}
        onClick={onSkip}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        <FantasyPanel className="p-6 md:p-8">
          {/* Icon */}
          <div className="text-center mb-4">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3"
              style={{
                background: `linear-gradient(135deg, ${GOLD}15 0%, ${GOLD}08 100%)`,
                border: `2px solid ${GOLD}30`,
                boxShadow: `0 0 20px ${GOLD}10`,
              }}
            >
              <span className="text-3xl">📱</span>
            </div>
            <FantasyTitle size="sm">One Quick Step</FantasyTitle>
            <GoldOrnament className="mt-2" />
          </div>

          {/* Description */}
          <p
            className="text-center text-sm leading-relaxed mb-6"
            style={{ color: `${PARCHMENT}90` }}
          >
            Hey <span style={{ color: GOLD_LIGHT, fontWeight: 600 }}>{parentName || 'there'}</span>!
            We need your WhatsApp number to link your child's assessment results.
            This helps us send progress updates too.
          </p>

          {/* Phone Input */}
          <div className="mb-4">
            <label
              className="block text-xs font-bold mb-2 tracking-wider"
              style={{ color: `${PARCHMENT}80`, fontFamily: "'Cinzel Decorative', serif" }}
            >
              WhatsApp Number
            </label>
            <div
              className="flex items-center rounded-xl overflow-hidden"
              style={{
                border: `2px solid ${error ? 'rgba(231,76,60,0.5)' : `${GOLD}25`}`,
                background: 'rgba(0,0,0,0.3)',
                transition: 'border-color 0.2s ease',
              }}
            >
              {/* Country prefix */}
              <div
                className="flex items-center gap-1.5 px-3 py-3 flex-shrink-0"
                style={{
                  borderRight: `1px solid ${GOLD}15`,
                  background: `${GOLD}06`,
                }}
              >
                <span className="text-sm">🇲🇾</span>
                <span className="text-xs font-bold" style={{ color: `${PARCHMENT}70` }}>+60</span>
              </div>

              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="12-345 6789"
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                style={{ color: PARCHMENT }}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs mt-2" style={{ color: 'rgba(231,76,60,0.8)' }}>
                {error}
              </p>
            )}

            <p className="text-[10px] mt-2" style={{ color: `${PARCHMENT}50` }}>
              Malaysian mobile number only. We'll never spam you.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => { playMenuSelect(); handleSubmit(); }}
              disabled={saving}
              className="w-full py-3.5 rounded-xl text-sm font-bold tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              style={{
                fontFamily: "'Cinzel Decorative', serif",
                background: `linear-gradient(135deg, ${GOLD} 0%, #c4943a 100%)`,
                color: '#1a0f00',
                border: `2px solid ${GOLD_LIGHT}`,
                boxShadow: `0 4px 15px ${GOLD}30, inset 0 1px 0 rgba(255,255,255,0.2)`,
              }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save & Start Quest'
              )}
            </button>

            <button
              onClick={() => { playMenuSelect(); onSkip(); }}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-xs tracking-wider transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                fontFamily: "'Cinzel Decorative', serif",
                color: `${PARCHMENT}60`,
                border: `1px solid ${GOLD}10`,
                background: 'transparent',
              }}
            >
              Skip for now
            </button>
          </div>
        </FantasyPanel>
      </div>
    </div>
  );
};