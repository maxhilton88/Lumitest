import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Crown, MessageCircle, Facebook, Instagram, Share2, Image, ExternalLink, Users, ArrowRight } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  FantasyPanel,
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import { fetchReferralInfo } from '../../utils/parent-api';
import { fetchReferralNetwork } from '../../utils/parent-api';
import { fetchMarketingArtwork } from '../../utils/api';
import { copyToClipboard } from '../../utils/clipboard';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { useLanguage } from '../LanguageContext';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const CHERRY = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";

interface EarningsHubProps {
  parentData: any;
  scrollToShare?: boolean;
  onScrollToShareDone?: () => void;
}

type SharePlatform = 'all' | 'whatsapp' | 'facebook' | 'instagram';

interface ArtworkVariant {
  platform: string;
  width: number;
  height: number;
  image_path: string;
  signed_url?: string | null;
}

interface Artwork {
  id: string;
  title: string;
  description: string;
  variants: ArtworkVariant[];
  status: string;
  order: number;
  created_at: string;
}

const PLATFORM_META: Record<string, { label: string; icon: React.ElementType; color: string; glow: string }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: '#25D366', glow: 'rgba(37,211,102,0.25)' },
  facebook: { label: 'Facebook', icon: Facebook, color: '#1877F2', glow: 'rgba(24,119,242,0.25)' },
  instagram: { label: 'Instagram', icon: Instagram, color: '#E1306C', glow: 'rgba(225,48,108,0.25)' },
};

export const EarningsHub: React.FC<EarningsHubProps> = ({ parentData, scrollToShare, onScrollToShareDone }) => {
  const { t } = useLanguage();
  const shareSectionRef = useRef<HTMLDivElement>(null);
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Graphic sharing state
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [artworksLoading, setArtworksLoading] = useState(true);
  const [sharePlatform, setSharePlatform] = useState<SharePlatform>('all');

  // Referral network state (detailed referral tracking)
  const [referralNetwork, setReferralNetwork] = useState<{
    referredBy: { name: string; kindergarten: string | null } | null;
    referralCode: string;
    myReferrals: { leadId: string; childName: string; parentName: string; status: string; date: string }[];
    stats: { totalReferred: number; signedUpCount: number };
  } | null>(null);

  useEffect(() => {
    fetchReferralInfo()
      .then(setReferralInfo)
      .catch((err) => console.error('Failed to load referral info:', err));

    fetchReferralNetwork()
      .then(setReferralNetwork)
      .catch((err) => console.error('[EARNINGS] Failed to load referral network:', err));

    // Load marketing artwork for graphic sharing
    fetchMarketingArtwork()
      .then((data: Artwork[]) => {
        setArtworks(data);
        console.log(`[EARNINGS] Loaded ${data.length} marketing artworks`);
      })
      .catch((err) => console.error('[EARNINGS] Failed to load artwork:', err))
      .finally(() => setArtworksLoading(false));
  }, []);

  // Auto-scroll to share section when navigated from Plan & Billing
  useEffect(() => {
    if (!scrollToShare) return;
    // Small delay to allow the referral network data to load and render
    const timer = setTimeout(() => {
      const el = shareSectionRef.current || document.getElementById('share-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Brief highlight pulse
        el.style.transition = 'box-shadow 0.3s ease';
        el.style.boxShadow = `0 0 20px ${GOLD}40`;
        setTimeout(() => { el.style.boxShadow = ''; }, 2000);
      }
      onScrollToShareDone?.();
    }, 600);
    return () => clearTimeout(timer);
  }, [scrollToShare]);

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
    const message = `🦊 Hey! I've been using this KSSR readiness test for my kids and they absolutely love it — it's like a game but they're actually learning! Give it a try, it's free!\n\nUse my code: ${referralCode}\n\n${referralLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Graphic share handler — shares artwork with parent's referral link
  const handleGraphicShare = async (artwork: Artwork, variant: ArtworkVariant) => {
    playMenuSelect();
    const platform = variant.platform;
    const shareText = `🦊 ${t('earnings.graphicShareText')}\n\n${referralLink}`;

    if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank');
    } else if (platform === 'instagram') {
      // Instagram has no share URL — open the image + copy link
      if (variant.signed_url) {
        window.open(variant.signed_url, '_blank');
        const ok = await copyToClipboard(referralLink);
        if (ok) {
          toast.success(t('earnings.igCopied'));
        } else {
          toast.info(t('earnings.igManual'));
        }
      } else {
        toast.error(t('earnings.imgUnavailable'));
      }
    }
  };

  // Filter artworks by selected platform
  const filteredArtworks = artworks.filter((art) => {
    if (sharePlatform === 'all') return true;
    return art.variants.some((v) => v.platform === sharePlatform);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <FantasyTitle size="md">{t('earnings.title')}</FantasyTitle>
        <p className="mt-2 text-sm" style={{ color: `${PARCHMENT}80` }}>
          {t('earnings.subtitle')}
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
          {t('earnings.balance')}
        </p>
        <p
          className="text-3xl md:text-4xl font-bold"
          style={{
            fontFamily: CHERRY,
            color: GOLD_LIGHT,
            textShadow: `0 0 20px ${GOLD}40`,
          }}
        >
          RM{credits.toFixed(2)}
        </p>
        <p className="text-[11px] mt-2" style={{ color: `${PARCHMENT}75` }}>
          {t('earnings.creditsOffset')}
        </p>
      </FantasyPanel>

      {/* How It Works */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold text-center mb-4"
          style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
        >
          {t('earnings.howItWorks')}
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { step: '1', icon: '📨', title: t('earnings.step1'), desc: t('earnings.step1Desc') },
            { step: '2', icon: '👥', title: t('earnings.step2'), desc: t('earnings.step2Desc') },
            { step: '3', icon: '💰', title: t('earnings.step3'), desc: t('earnings.step3Desc') },
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
          <span className="text-[10px]" style={{ color: `${PARCHMENT}55` }}>{t('earnings.oneLevel')}</span>
          <div className="flex-1 h-px" style={{ background: `${GOLD}20` }} />
        </div>
      </FantasyPanel>

      {/* Referral Link Generator */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold mb-4"
          style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
        >
          {t('earnings.yourLink')}
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
            {referralLink || t('earnings.generating')}
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
            {referralCode || t('earnings.loading')}
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
          {t('earnings.shareWhatsApp')}
        </button>
      </FantasyPanel>

      {/* ═══ Graphic Sharing Section ═══ */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold mb-1"
          style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
        >
          {t('earnings.graphicsTitle')}
        </h3>
        <p className="text-[11px] mb-4" style={{ color: `${PARCHMENT}70` }}>
          {t('earnings.graphicsSubtitle')}
        </p>

        {/* Platform filter pills */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {(['all', 'whatsapp', 'facebook', 'instagram'] as SharePlatform[]).map((p) => {
            const isActive = sharePlatform === p;
            const meta = p !== 'all' ? PLATFORM_META[p] : null;
            const Icon = meta?.icon;
            return (
              <button
                key={p}
                onClick={() => { playMenuSelect(); setSharePlatform(p); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all"
                style={{
                  background: isActive
                    ? (meta ? `${meta.color}25` : `${GOLD}20`)
                    : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${isActive ? (meta?.color || GOLD) + '50' : `${GOLD}15`}`,
                  color: isActive ? (meta?.color || GOLD_LIGHT) : `${PARCHMENT}70`,
                }}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {p === 'all' ? t('earnings.filterAll') : meta?.label}
              </button>
            );
          })}
        </div>

        {/* Artwork grid */}
        {artworksLoading ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <div
              className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: `${GOLD}40`, borderTopColor: 'transparent' }}
            />
            <p className="text-[11px]" style={{ color: `${PARCHMENT}60` }}>
              {t('earnings.loadingArtwork')}
            </p>
          </div>
        ) : filteredArtworks.length === 0 ? (
          <div className="text-center py-8">
            <div
              className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
              style={{ background: `${GOLD}08`, border: `1.5px dashed ${GOLD}25` }}
            >
              <Image className="w-5 h-5" style={{ color: `${PARCHMENT}50` }} />
            </div>
            <p className="text-xs font-bold" style={{ color: `${PARCHMENT}70` }}>
              {artworks.length === 0 ? t('earnings.noArtwork') : t('earnings.noArtworkPlatform')}
            </p>
            <p className="text-[10px] mt-1" style={{ color: `${PARCHMENT}55` }}>
              {artworks.length === 0 ? t('earnings.noArtworkDesc') : t('earnings.noArtworkPlatformDesc')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredArtworks.map((artwork) => {
              const visibleVariants = sharePlatform === 'all'
                ? artwork.variants
                : artwork.variants.filter((v) => v.platform === sharePlatform);

              return visibleVariants.map((variant, idx) => {
                const meta = PLATFORM_META[variant.platform];
                if (!meta) return null;
                const PlatformIcon = meta.icon;

                return (
                  <div
                    key={`${artwork.id}-${variant.platform}-${idx}`}
                    className="rounded-xl overflow-hidden group transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${GOLD}15`,
                    }}
                  >
                    {/* Image preview */}
                    <div className="relative aspect-video overflow-hidden" style={{ background: `${GOLD}06` }}>
                      {variant.signed_url ? (
                        <img
                          src={variant.signed_url}
                          alt={artwork.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-8 h-8" style={{ color: `${PARCHMENT}30` }} />
                        </div>
                      )}
                      {/* Platform badge */}
                      <div
                        className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold backdrop-blur-sm"
                        style={{
                          background: `${meta.color}30`,
                          border: `1px solid ${meta.color}50`,
                          color: meta.color,
                        }}
                      >
                        <PlatformIcon className="w-2.5 h-2.5" />
                        {meta.label}
                      </div>
                      {/* Dimensions badge */}
                      <div
                        className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-mono backdrop-blur-sm"
                        style={{ background: 'rgba(0,0,0,0.5)', color: `${PARCHMENT}90` }}
                      >
                        {variant.width}x{variant.height}
                      </div>
                    </div>

                    {/* Card info */}
                    <div className="p-3">
                      <p className="text-xs font-bold truncate" style={{ color: GOLD_LIGHT }}>
                        {artwork.title}
                      </p>
                      {artwork.description && (
                        <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: `${PARCHMENT}65` }}>
                          {artwork.description}
                        </p>
                      )}

                      {/* Share CTA */}
                      <button
                        onClick={() => handleGraphicShare(artwork, variant)}
                        className="mt-2.5 w-full py-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: `linear-gradient(135deg, ${meta.color}30, ${meta.color}15)`,
                          border: `1.5px solid ${meta.color}40`,
                          color: meta.color,
                          boxShadow: `0 2px 10px ${meta.glow}`,
                        }}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        {t('earnings.shareWithLink')}
                      </button>

                      {/* View full image link */}
                      {variant.signed_url && (
                        <a
                          href={variant.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 w-full flex items-center justify-center gap-1 text-[10px] py-1 transition-colors"
                          style={{ color: `${PARCHMENT}55` }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = GOLD)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = `${PARCHMENT}55`)}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {t('earnings.viewImage')}
                        </a>
                      )}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        )}
      </FantasyPanel>

      {/* ═══ My Referral Network ═══ */}
      {referralNetwork && (
        <div id="share-section" ref={shareSectionRef}>
        <FantasyPanel className="p-5">
          <h3
            className="text-sm font-bold mb-4"
            style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
          >
            My Referrals
          </h3>

          {/* Referred by */}
          {referralNetwork.referredBy && (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-4"
              style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}15` }}
            >
              <span className="text-base">🤝</span>
              <div>
                <p className="text-[11px]" style={{ color: `${PARCHMENT}80` }}>
                  You were referred by{' '}
                  <span className="font-bold" style={{ color: GOLD_LIGHT }}>
                    {referralNetwork.referredBy.name}
                  </span>
                  {referralNetwork.referredBy.kindergarten && (
                    <span style={{ color: `${PARCHMENT}60` }}> from {referralNetwork.referredBy.kindergarten}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div
              className="px-4 py-3 rounded-xl text-center"
              style={{ background: `${GOLD}08`, border: `1.5px solid ${GOLD}15` }}
            >
              <p className="text-xl font-bold" style={{ color: GOLD_LIGHT, fontFamily: CINZEL }}>
                {referralNetwork.stats.totalReferred}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}70` }}>Families Referred</p>
            </div>
            <div
              className="px-4 py-3 rounded-xl text-center"
              style={{ background: `${GOLD}08`, border: `1.5px solid ${GOLD}15` }}
            >
              <p className="text-xl font-bold" style={{ color: '#7cc643', fontFamily: CINZEL }}>
                {referralNetwork.stats.signedUpCount}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}70` }}>Signed Up</p>
            </div>
          </div>

          {/* Referral list with status progression */}
          {referralNetwork.myReferrals.length > 0 ? (
            <div className="space-y-2">
              {referralNetwork.myReferrals.map((ref) => {
                const statusConfig: Record<string, { label: string; color: string; bg: string; step: number }> = {
                  test_started: { label: 'Test Started', color: `${PARCHMENT}70`, bg: `${GOLD}08`, step: 1 },
                  test_completed: { label: 'Test Done', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', step: 2 },
                  report_sent: { label: 'Report Sent', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', step: 3 },
                  report_viewed: { label: 'Report Viewed', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', step: 4 },
                  signed_up: { label: 'Signed Up!', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', step: 5 },
                };
                const s = statusConfig[ref.status] || statusConfig.test_started;
                const progressPct = (s.step / 5) * 100;

                return (
                  <div
                    key={ref.leadId}
                    className="px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${GOLD}12` }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25`, color: GOLD }}
                        >
                          {(ref.parentName || ref.childName || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>
                            {ref.childName || ref.parentName || 'Unknown'}
                          </p>
                          {ref.date && (
                            <p className="text-[9px]" style={{ color: `${PARCHMENT}55` }}>
                              {new Date(ref.date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}30` }}
                      >
                        {s.label}
                      </span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: `${GOLD}10` }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%`, backgroundColor: s.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs" style={{ color: `${PARCHMENT}60` }}>
                No referrals yet. Share your link to get started!
              </p>
            </div>
          )}
        </FantasyPanel>
        </div>
      )}

      {/* Successful Referrals List */}
      <FantasyPanel className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-sm font-bold"
            style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
          >
            {t('earnings.recruited')}
          </h3>
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25`, color: GOLD }}
          >
            {referralCount} {t('earnings.total')}
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
                      {ref.name || t('earnings.adventurer')}
                    </p>
                    <p className="text-[10px]" style={{ color: `${PARCHMENT}70` }}>
                      {ref.date || t('earnings.recentlyJoined')}
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
                  {ref.status === 'paid' ? `✓ ${t('earnings.credited')}` : t('earnings.pending')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs" style={{ color: `${PARCHMENT}70` }}>
              {t('earnings.emptyTitle')}
            </p>
            <p className="text-[10px] mt-1" style={{ color: `${PARCHMENT}60` }}>
              {t('earnings.emptyDesc')}
            </p>
          </div>
        )}
      </FantasyPanel>
    </div>
  );
};