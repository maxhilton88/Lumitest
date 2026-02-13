import React, { useState, useEffect } from 'react';
import { Copy, Check, Crown } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  FantasyPanel,
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import { fetchReferralInfo } from '../../utils/parent-api';
import { playMenuSelect } from '../../hooks/useSoundEffects';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

interface EarningsHubProps {
  parentData: any;
}

export const EarningsHub: React.FC<EarningsHubProps> = ({ parentData }) => {
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    fetchReferralInfo()
      .then(setReferralInfo)
      .catch((err) => console.error('Failed to load referral info:', err));
  }, []);

  const referralCode = parentData?.referral_code || '';
  const referralLink = referralCode
    ? `${window.location.origin}/?ref=${referralCode}`
    : '';
  const credits = referralInfo?.referral_credits || parentData?.referral_credits || 0;
  const referralCount = referralInfo?.referral_count || 0;
  const referrals = referralInfo?.referrals || [];

  const handleCopyLink = () => {
    playMenuSelect();
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    playMenuSelect();
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleWhatsAppShare = () => {
    playMenuSelect();
    const message = `🦊 Hey! My child loves Foxy Adventure — a fun KSSR readiness game for kids aged 4-7. Try it free!\n\nUse my referral code: ${referralCode}\n\n${referralLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <FantasyTitle size="md">Earnings Hub</FantasyTitle>
        <p className="mt-2 text-sm" style={{ color: `${PARCHMENT}80` }}>
          Referrals & Credits
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* Cash Balance Card */}
      <FantasyPanel className="p-6 text-center" gold>
        {/* Placeholder icon */}
        <div
          className="w-16 h-16 mx-auto mb-3 rounded-xl flex items-center justify-center"
          style={{ border: `2px dashed ${GOLD}44`, background: `${GOLD}08` }}
        >
          <span className="text-3xl">💰</span>
        </div>
        <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: `${PARCHMENT}85` }}>
          Your Treasure Balance
        </p>
        <p
          className="text-3xl md:text-4xl font-bold"
          style={{
            fontFamily: "'Cinzel Decorative', serif",
            color: GOLD_LIGHT,
            textShadow: `0 0 20px ${GOLD}40`,
          }}
        >
          RM{credits.toFixed(2)}
        </p>
        <p className="text-[11px] mt-2" style={{ color: `${PARCHMENT}75` }}>
          Credits offset your subscription cost
        </p>
      </FantasyPanel>

      {/* How It Works */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold text-center mb-4"
          style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
        >
          How It Works
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { step: '1', icon: '📨', title: 'Share', desc: 'Send your link to friends' },
            { step: '2', icon: '👥', title: 'They Subscribe', desc: 'Friend signs up for a plan' },
            { step: '3', icon: '💰', title: 'You Earn', desc: 'RM36.50 per paid referral' },
          ].map((s) => (
            <div key={s.step}>
              <div
                className="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}25, ${GOLD}10)`,
                  border: `1.5px solid ${GOLD}30`,
                }}
              >
                <span className="text-base">{s.icon}</span>
              </div>
              <p className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>{s.title}</p>
              <p className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>{s.desc}</p>
            </div>
          ))}
        </div>
        {/* Arrow connectors */}
        <div className="flex items-center justify-center gap-2 mt-1">
          <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
          <span className="text-[10px]" style={{ color: `${PARCHMENT}55` }}>1 level deep</span>
          <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
        </div>
      </FantasyPanel>

      {/* Referral Link Generator */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold mb-4"
          style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
        >
          Your Referral Link
        </h3>

        {/* Link */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono truncate"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${GOLD}20`,
              color: `${PARCHMENT}90`,
            }}
          >
            {referralLink || 'Generating...'}
          </div>
          <button
            onClick={handleCopyLink}
            className="px-3 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{
              background: `${GOLD}15`,
              border: `1.5px solid ${GOLD}30`,
              color: GOLD,
            }}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Referral code */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex-1 px-3 py-2.5 rounded-xl text-xs font-mono text-center tracking-[0.2em] uppercase"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${GOLD}20`,
              color: GOLD_LIGHT,
            }}
          >
            {referralCode || 'Loading...'}
          </div>
          <button
            onClick={handleCopyCode}
            className="px-3 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
            style={{
              background: `${GOLD}15`,
              border: `1.5px solid ${GOLD}30`,
              color: GOLD,
            }}
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* WhatsApp share button */}
        <button
          onClick={handleWhatsAppShare}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            color: '#fff',
            boxShadow: '0 4px 15px rgba(37,211,102,0.3)',
          }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Share via WhatsApp
        </button>
      </FantasyPanel>

      {/* Successful Referrals List */}
      <FantasyPanel className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-sm font-bold"
            style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
          >
            Recruited Adventurers
          </h3>
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25`, color: GOLD }}
          >
            {referralCount} total
          </span>
        </div>

        {referrals.length > 0 ? (
          <div className="space-y-2">
            {referrals.map((ref: any, i: number) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${GOLD}12`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: `${GOLD}15`,
                      border: `1px solid ${GOLD}25`,
                      color: GOLD,
                    }}
                  >
                    {(ref.name || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>
                      {ref.name || 'Adventurer'}
                    </p>
                    <p className="text-[10px]" style={{ color: `${PARCHMENT}70` }}>
                      {ref.date || 'Recently joined'}
                    </p>
                  </div>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: ref.status === 'paid' ? 'rgba(124,198,67,0.15)' : `${GOLD}10`,
                    color: ref.status === 'paid' ? '#7cc643' : `${PARCHMENT}75`,
                    border: `1px solid ${ref.status === 'paid' ? 'rgba(124,198,67,0.25)' : `${GOLD}15`}`,
                  }}
                >
                  {ref.status === 'paid' ? '✓ Credited' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs" style={{ color: `${PARCHMENT}70` }}>
              Your treasure hall awaits its first gold coin.
            </p>
            <p className="text-[10px] mt-1" style={{ color: `${PARCHMENT}60` }}>
              Share your link above to start earning!
            </p>
          </div>
        )}
      </FantasyPanel>
    </div>
  );
};