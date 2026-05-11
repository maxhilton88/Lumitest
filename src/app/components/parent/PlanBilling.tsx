import React, { useState, useEffect } from 'react';
import { Crown, Check, ExternalLink, Loader2, CheckCircle2, XCircle, Gift, ArrowRight, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  FantasyPanel,
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import { createCheckoutSession, createToyCheckoutSession, verifyCheckoutSession, createPortalSession, parentValidateSession } from '../../utils/parent-api';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { useLanguage } from '../LanguageContext';
import foxyToyImage from 'figma:asset/090998e64822fcc5724f27cbd25c8d9c71bd2ea7.png';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const LEGENDARY_ORANGE = '#e8722a';
const CHERRY = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";

interface PlanBillingProps {
  parentData: any;
  referralCredits: number;
  onRefreshParent?: () => void;
  onNavigateToEarnings?: () => void;
}

export const PlanBilling: React.FC<PlanBillingProps> = ({
  parentData,
  referralCredits,
  onRefreshParent,
  onNavigateToEarnings,
}) => {
  const { t } = useLanguage();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'success' | 'cancelled' | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isToyCheckingOut, setIsToyCheckingOut] = useState(false);

  const isPaid = parentData?.subscription_status === 'active';
  const isPremiumViaFMCG = parentData?.premium_expires_at && new Date(parentData.premium_expires_at) > new Date();
  const currentPlan = parentData?.subscription_plan || 'free';
  const isPlanA = isPaid && currentPlan.toUpperCase() === 'A';
  const hasToy = parentData?.toy_purchased || currentPlan.toUpperCase() === 'B';

  // Premium grants from FMCG brand partners
  const premiumGrants: Array<{ brandName: string; days: number; grantedAt: string; campaignId?: string; expiresAt?: string }> =
    parentData?.premium_grants || [];
  const totalGrantedDays = premiumGrants.reduce((sum: number, g: any) => sum + (g.days || 0), 0);

  // ── Checkout callback detection ──
  // When Stripe redirects back to /plan?checkout=success&session_id=...
  // or /plan?checkout=cancelled, handle it here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const sessionId = params.get('session_id');

    if (!checkoutStatus) return;

    // Clean the URL immediately (remove query params without reload)
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (checkoutStatus === 'success' && sessionId) {
      // Verify the checkout session with the server
      setIsVerifying(true);
      verifyCheckoutSession(sessionId)
        .then((result) => {
          console.log('[PLAN-BILLING] Checkout verified:', result);
          setVerifyResult('success');
          toast.success(`Welcome to Plan ${result.plan}! Your subscription is now active.`);
          // Refresh parent data so the UI reflects the new plan
          if (onRefreshParent) onRefreshParent();
        })
        .catch((err) => {
          console.error('[PLAN-BILLING] Checkout verification failed:', err);
          toast.error(`Verification failed: ${err.message}. Your payment may still have succeeded — please refresh.`);
        })
        .finally(() => {
          setIsVerifying(false);
          // Auto-dismiss the result banner after 8 seconds
          setTimeout(() => setVerifyResult(null), 8000);
        });
    } else if (checkoutStatus === 'cancelled') {
      setVerifyResult('cancelled');
      toast.info('Checkout was cancelled. No charge was made.');
      setTimeout(() => setVerifyResult(null), 6000);
    }
  }, []);

  const handleCheckout = async (plan: 'A' | 'B') => {
    playMenuSelect();

    // Frontend guard: prevent double-charge
    if (isPaid) {
      toast.error('You already have an active subscription. Use "Manage Subscription" to make changes.');
      return;
    }

    setIsCheckingOut(true);
    try {
      const result = await createCheckoutSession(plan, parentData.email);
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      if (err.message?.includes('already have an active subscription') || err.message?.includes('alreadySubscribed')) {
        toast.error('You already have an active subscription. Use "Manage Subscription" to make changes.');
        if (onRefreshParent) onRefreshParent();
      } else {
        toast.error('Failed to create checkout. Please try again.');
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleManageSubscription = async () => {
    playMenuSelect();
    setIsOpeningPortal(true);
    try {
      const result = await createPortalSession();
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (err: any) {
      console.error('Portal error:', err);
      toast.error(err.message || 'Failed to open subscription portal.');
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleToyCheckout = async () => {
    playMenuSelect();

    if (hasToy) {
      toast.error("You've already purchased the Foxy AI Toy!");
      return;
    }

    setIsToyCheckingOut(true);
    try {
      const result = await createToyCheckoutSession(parentData.email);
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (err: any) {
      console.error('Toy checkout error:', err);
      toast.error(err.message || 'Failed to create toy checkout. Please try again.');
    } finally {
      setIsToyCheckingOut(false);
    }
  };

  const plans = [
    {
      id: 'A' as const,
      name: t('plan.planA'),
      badge: t('plan.digital'),
      badgeColor: GOLD,
      subtitle: t('plan.planASubtitle'),
      price: '365',
      period: t('plan.perYear'),
      note: null,
      features: [
        t('plan.featureUnlimitedTests'),
        t('plan.featureUnlimitedVideo'),
        t('plan.featureTracking'),
        t('plan.featurePractice'),
        t('plan.featureSupport'),
      ],
      isBestValue: false,
    },
    {
      id: 'B' as const,
      name: t('plan.planB'),
      badge: t('plan.bestValue'),
      badgeColor: '#ffd700',
      subtitle: t('plan.planBSubtitle'),
      price: '730',
      period: t('plan.perFirstYear'),
      note: t('plan.thenRenewal'),
      features: [
        t('plan.featureEverything'),
        t('plan.featureToy'),
        t('plan.featureShipped'),
        t('plan.featureVoice'),
        t('plan.featureExclusive'),
      ],
      isBestValue: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Checkout result banner */}
      {isVerifying && (
        <FantasyPanel className="px-5 py-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: GOLD }} />
          <p className="text-sm" style={{ color: PARCHMENT }}>
            {t('plan.verifying')}
          </p>
        </FantasyPanel>
      )}
      {verifyResult === 'success' && !isVerifying && (
        <FantasyPanel className="px-5 py-4 flex items-center gap-3" gold>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#7cc643' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#7cc643' }}>
              {t('plan.paymentSuccess')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: `${PARCHMENT}80` }}>
              {t('plan.subscriptionActive')}
            </p>
          </div>
        </FantasyPanel>
      )}
      {verifyResult === 'cancelled' && !isVerifying && (
        <FantasyPanel className="px-5 py-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#f87171' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#f87171' }}>
              {t('plan.checkoutCancelled')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: `${PARCHMENT}80` }}>
              {t('plan.noCharge')}
            </p>
          </div>
        </FantasyPanel>
      )}

      {/* Header */}
      <div className="text-center">
        <FantasyTitle size="md">{t('plan.title')}</FantasyTitle>
        <p className="mt-2 text-sm" style={{ color: `${PARCHMENT}80` }}>
          {t('plan.subtitle')}
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* Current Plan Badge */}
      <FantasyPanel className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ border: `2px dashed ${GOLD}44`, background: `${GOLD}08` }}
          >
            <span className="text-lg">📜</span>
          </div>
          <div>
            <p className="text-xs" style={{ color: `${PARCHMENT}80` }}>{t('plan.currentPlan')}</p>
            <p
              className="text-sm font-bold"
              style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
            >
              {isPaid ? `Plan ${currentPlan.toUpperCase()}` : t('plan.freeTier')}
            </p>
          </div>
        </div>
        {isPaid && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(124,198,67,0.15)',
              border: '1px solid rgba(124,198,67,0.25)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] font-bold text-green-400">{t('plan.active')}</span>
          </div>
        )}
      </FantasyPanel>

      {/* ═══ Premium Grants from FMCG Brand Partners ═══ */}
      {premiumGrants.length > 0 && (
        <FantasyPanel className="p-5" gold={isPremiumViaFMCG}>
          <div className="flex items-start gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: isPremiumViaFMCG
                  ? 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(217,119,6,0.08))'
                  : `linear-gradient(135deg, ${GOLD}15, ${GOLD}06)`,
                border: `1.5px solid ${isPremiumViaFMCG ? 'rgba(217,119,6,0.3)' : `${GOLD}25`}`,
              }}
            >
              <Crown className="w-5 h-5" style={{ color: isPremiumViaFMCG ? '#d97706' : GOLD }} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold"
                style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
              >
                {t('plan.premiumGrants')}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}70` }}>
                {t('plan.premiumGrantsDesc')}
              </p>
            </div>
            {isPremiumViaFMCG && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0"
                style={{
                  background: 'rgba(217,119,6,0.15)',
                  border: '1px solid rgba(217,119,6,0.25)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#d97706' }} />
                <span className="text-[10px] font-bold" style={{ color: '#d97706' }}>{t('plan.active')}</span>
              </div>
            )}
          </div>

          {/* Active premium expiry */}
          {isPremiumViaFMCG && parentData?.premium_expires_at && (
            <div
              className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2"
              style={{
                background: 'rgba(217,119,6,0.08)',
                border: '1px solid rgba(217,119,6,0.15)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: '#d97706' }} />
              <span className="text-[11px] font-bold" style={{ color: '#d97706' }}>
                {t('plan.premiumGrantsActive')} {new Date(parentData.premium_expires_at).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Brand grant list */}
          <div className="space-y-2">
            {premiumGrants.map((grant: any, i: number) => {
              const grantDate = grant.grantedAt ? new Date(grant.grantedAt) : null;
              const isExpired = grant.expiresAt && new Date(grant.expiresAt) < new Date();
              return (
                <div
                  key={`${grant.campaignId || grant.brandName}-${i}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{
                    background: isExpired ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isExpired ? 'rgba(255,255,255,0.05)' : 'rgba(217,119,6,0.15)'}`,
                    opacity: isExpired ? 0.6 : 1,
                  }}
                >
                  {/* Brand initial badge */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{
                      background: isExpired
                        ? `${GOLD}10`
                        : 'linear-gradient(135deg, rgba(217,119,6,0.2), rgba(217,119,6,0.1))',
                      border: `1px solid ${isExpired ? `${GOLD}15` : 'rgba(217,119,6,0.25)'}`,
                      color: isExpired ? `${PARCHMENT}50` : '#d97706',
                      fontFamily: CHERRY,
                    }}
                  >
                    {grant.brandName?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Grant details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-xs font-bold"
                        style={{
                          fontFamily: CHERRY,
                          color: isExpired ? `${PARCHMENT}50` : '#d97706',
                        }}
                      >
                        {grant.days} {t('plan.premiumGrantsDays')}
                      </span>
                      <span
                        className="text-xs font-bold truncate"
                        style={{ color: isExpired ? `${PARCHMENT}50` : GOLD_LIGHT }}
                      >
                        {grant.brandName}
                      </span>
                    </div>
                    {grantDate && (
                      <p className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}50` }}>
                        {grantDate.toLocaleDateString()}
                        {isExpired && (
                          <span className="ml-1.5" style={{ color: '#f87171' }}>
                            • {t('plan.premiumGrantsExpired')}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Days pill */}
                  <div
                    className="px-2 py-1 rounded-full text-[10px] font-bold shrink-0"
                    style={{
                      background: isExpired ? `${GOLD}08` : 'rgba(217,119,6,0.12)',
                      border: `1px solid ${isExpired ? `${GOLD}15` : 'rgba(217,119,6,0.2)'}`,
                      color: isExpired ? `${PARCHMENT}40` : '#d97706',
                      fontFamily: CHERRY,
                    }}
                  >
                    +{grant.days}d
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total summary */}
          <div
            className="mt-3 pt-3 flex items-center justify-between"
            style={{ borderTop: `1px solid ${GOLD}15` }}
          >
            <span className="text-[11px]" style={{ color: `${PARCHMENT}60` }}>
              {t('plan.premiumGrantsTotal')}
            </span>
            <span
              className="text-sm font-bold"
              style={{ fontFamily: CHERRY, color: isPremiumViaFMCG ? '#d97706' : GOLD }}
            >
              {totalGrantedDays} {t('plan.premiumGrantsDays').split(' ')[0]}
            </span>
          </div>
        </FantasyPanel>
      )}

      {/* ── FOXY-o1 Toy Promo — Legendary Card ── */}
      <FantasyPanel className="p-0 overflow-hidden relative">
        {/* Legendary glow border effect */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: `2px solid ${LEGENDARY_ORANGE}50`,
            boxShadow: `0 0 25px ${LEGENDARY_ORANGE}20, inset 0 0 25px ${LEGENDARY_ORANGE}08`,
          }}
        />

        {/* Limited Intro Offer ribbon */}
        <div
          className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
          style={{
            background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}, #ff6b35)`,
            color: '#fff',
            boxShadow: `0 2px 10px ${LEGENDARY_ORANGE}60`,
            fontFamily: CHERRY,
          }}
        >
          {t('plan.limitedIntro')}
        </div>

        <div className="p-5 md:p-6">
          <div className="flex items-start gap-4">
            {/* Toy image */}
            <div className="flex-shrink-0">
              <div
                className="w-24 h-24 md:w-28 md:h-28 rounded-xl overflow-hidden flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, #fff5eb, #ffe8d5)`,
                  border: `2px solid ${LEGENDARY_ORANGE}30`,
                  boxShadow: `0 4px 16px rgba(0,0,0,0.2)`,
                }}
              >
                <img
                  src={foxyToyImage}
                  alt="FOXY-o1 AI Toy"
                  className="w-full h-full object-contain p-1"
                />
              </div>
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4" style={{ color: LEGENDARY_ORANGE }} />
                <h3
                  className="text-sm md:text-base font-black tracking-wide"
                  style={{
                    fontFamily: CHERRY,
                    color: GOLD_LIGHT,
                    textShadow: `0 0 10px ${LEGENDARY_ORANGE}30`,
                  }}
                >
                  {t('plan.foxyTitle')}
                </h3>
              </div>
              <p
                className="text-xs font-bold mb-1.5"
                style={{ color: LEGENDARY_ORANGE }}
              >
                {t('plan.foxySubtitle')}
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: `${PARCHMENT}bb` }}
              >
                {t('plan.foxyDesc')}
              </p>
            </div>
          </div>

          {/* Bundle pricing */}
          <div
            className="mt-4 p-3 rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}12, ${LEGENDARY_ORANGE}06)`,
              border: `1px solid ${LEGENDARY_ORANGE}25`,
            }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${PARCHMENT}90` }}>
                {t('plan.foxyBundle')}
              </p>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span
                  className="text-xl md:text-2xl font-black"
                  style={{
                    color: LEGENDARY_ORANGE,
                    fontFamily: CHERRY,
                    textShadow: `0 0 12px ${LEGENDARY_ORANGE}30`,
                  }}
                >
                  RM730
                </span>
                <span
                  className="text-[11px] font-black px-2 py-0.5 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}, #f0d078)`,
                    color: '#2a1f0e',
                    boxShadow: `0 0 10px ${GOLD}40`,
                  }}
                >
                  {t('plan.perDay')}
                </span>
              </div>
            </div>
            {/* Early adopter scarcity text */}
            <p
              className="text-[10px] mt-2 leading-relaxed"
              style={{ color: `${PARCHMENT}80` }}
            >
              {t('plan.earlyAdopter')}
            </p>
          </div>
        </div>
      </FantasyPanel>

      {/* Plan Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => {
          const isCurrentPlan = isPaid && currentPlan.toUpperCase() === plan.id;
          const isDimmed = plan.id === 'A' && !isCurrentPlan;

          return (
            <FantasyPanel
              key={plan.id}
              className={`p-5 md:p-6 relative ${isDimmed ? 'opacity-50' : ''}`}
              gold={plan.isBestValue}
            >
              {/* Badge */}
              <div
                className="absolute -top-3 left-4 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1"
                style={{
                  background: plan.isBestValue
                    ? `linear-gradient(135deg, ${GOLD}, #ffd700)`
                    : `${GOLD}30`,
                  color: plan.isBestValue ? '#2a1f0e' : GOLD,
                  border: `1px solid ${plan.isBestValue ? '#ffd700' : `${GOLD}40`}`,
                }}
              >
                {plan.isBestValue && <Crown className="w-3 h-3" />}
                {plan.badge}
              </div>

              {/* Limited Intro Offer ribbon for Plan B */}
              {plan.isBestValue && !isCurrentPlan && (
                <div
                  className="absolute -top-3 right-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{
                    background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}, #ff6b35)`,
                    color: '#fff',
                    boxShadow: `0 2px 10px ${LEGENDARY_ORANGE}60`,
                    fontFamily: CHERRY,
                  }}
                >
                  {t('plan.limitedIntro')}
                </div>
              )}

              {/* Current plan indicator */}
              {isCurrentPlan && (
                <div
                  className="absolute -top-3 right-4 px-3 py-1 rounded-full text-[10px] font-bold"
                  style={{
                    background: 'rgba(124,198,67,0.2)',
                    color: '#7cc643',
                    border: '1px solid rgba(124,198,67,0.3)',
                  }}
                >
                  {t('plan.current')}
                </div>
              )}

              <div className="mt-3">
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
                >
                  {plan.name}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>
                  {plan.subtitle}
                </p>
              </div>

              {/* Price — Plan B gets full pricing */}
              {plan.isBestValue ? (
                <div className="mt-4 mb-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: `${PARCHMENT}75` }}>RM</span>
                    <span
                      className="text-3xl font-bold leading-none"
                      style={{
                        fontFamily: CHERRY,
                        color: LEGENDARY_ORANGE,
                        textShadow: `0 0 15px ${LEGENDARY_ORANGE}30`,
                      }}
                    >
                      730
                    </span>
                    <span
                      className="text-[11px] font-black px-2 py-0.5 rounded-full"
                      style={{
                        background: `linear-gradient(135deg, ${GOLD}, #f0d078)`,
                        color: '#2a1f0e',
                        boxShadow: `0 0 10px ${GOLD}40`,
                      }}
                    >
                      {t('plan.perDay')}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: `${PARCHMENT}60` }}>
                    {plan.period}
                  </p>
                  {plan.note && (
                    <p className="text-[10px] mt-0.5" style={{ color: `${PARCHMENT}50` }}>{plan.note}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-end gap-1 mt-4 mb-1">
                    <span className="text-xs" style={{ color: `${PARCHMENT}75` }}>RM</span>
                    <span
                      className="text-3xl font-bold leading-none"
                      style={{
                        fontFamily: CHERRY,
                        color: '#fff',
                        textShadow: `0 0 15px ${GOLD}30`,
                      }}
                    >
                      {plan.price}
                    </span>
                    <span className="text-xs pb-1" style={{ color: `${PARCHMENT}75` }}>
                      {plan.period}
                    </span>
                  </div>
                  {plan.note && (
                    <p className="text-[10px]" style={{ color: `${PARCHMENT}60` }}>{plan.note}</p>
                  )}
                </>
              )}

              {/* Features */}
              <ul className="space-y-2 mt-5 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check
                      className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                      style={{ color: plan.isBestValue ? GOLD : '#7cc643' }}
                    />
                    <span className="text-xs" style={{ color: `${PARCHMENT}80` }}>{f}</span>
                  </li>
                ))}
              </ul>

              {/* Early adopter text for Plan B */}
              {plan.isBestValue && !isCurrentPlan && (
                <p
                  className="text-[10px] mb-4 leading-relaxed"
                  style={{ color: `${PARCHMENT}70` }}
                >
                  {t('plan.earlyAdopter')}
                </p>
              )}

              {/* CTA button */}
              {isCurrentPlan ? (
                <div
                  className="w-full py-2.5 rounded-xl text-center text-xs font-bold tracking-wider"
                  style={{
                    background: `${GOLD}10`,
                    border: `2px solid ${GOLD}25`,
                    color: `${PARCHMENT}60`,
                    fontFamily: CHERRY,
                  }}
                >
                  {t('plan.currentPlanBtn')}
                </div>
              ) : isDimmed ? (
                <div
                  className="w-full py-2.5 rounded-xl text-center text-xs font-bold tracking-wider"
                  style={{
                    background: `${GOLD}08`,
                    border: `2px dashed ${GOLD}20`,
                    color: `${PARCHMENT}40`,
                    fontFamily: CHERRY,
                  }}
                >
                  {t('plan.comingSoon')}
                </div>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isCheckingOut}
                  className="w-full py-3 rounded-xl font-bold text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: CHERRY,
                    background: plan.isBestValue
                      ? `linear-gradient(135deg, #ffd700 0%, ${GOLD} 100%)`
                      : `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                    color: '#2a1f0e',
                    border: `2px solid ${GOLD_LIGHT}`,
                    boxShadow: `0 4px 0 #a67c2e, 0 0 20px ${GOLD}30`,
                    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  {isCheckingOut ? t('plan.openingStripe') : isPaid ? t('plan.switchPlan') : t('plan.subscribeNow')}
                </button>
              )}
            </FantasyPanel>
          );
        })}
      </div>

      {/* ═══ Standalone Foxy Toy — Plan A users only ═══ */}
      {isPlanA && !hasToy && (
        <FantasyPanel className="p-5 relative overflow-hidden" gold>
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              border: `2px solid ${LEGENDARY_ORANGE}40`,
              boxShadow: `0 0 20px ${LEGENDARY_ORANGE}15`,
            }}
          />
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div
                className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #fff5eb, #ffe8d5)',
                  border: `2px solid ${LEGENDARY_ORANGE}30`,
                }}
              >
                <img src={foxyToyImage} alt="FOXY-o1 AI Toy" className="w-full h-full object-contain p-1" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5" style={{ color: LEGENDARY_ORANGE }} />
                <h3
                  className="text-sm font-bold"
                  style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
                >
                  Add Foxy Toy
                </h3>
              </div>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: `${PARCHMENT}90` }}>
                Already on Plan A? Add the AI-powered Foxy Toy for a one-time RM365 — shipped free to Malaysia & Singapore.
              </p>
              <div className="flex items-center gap-3">
                <span
                  className="text-lg font-black"
                  style={{ fontFamily: CHERRY, color: LEGENDARY_ORANGE }}
                >
                  RM365
                </span>
                <span className="text-[10px]" style={{ color: `${PARCHMENT}60` }}>One-time</span>
              </div>
              <button
                onClick={handleToyCheckout}
                disabled={isToyCheckingOut}
                className="mt-3 w-full py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  fontFamily: CHERRY,
                  background: `linear-gradient(135deg, ${LEGENDARY_ORANGE}, #ff6b35)`,
                  color: '#fff',
                  border: `2px solid ${LEGENDARY_ORANGE}80`,
                  boxShadow: `0 3px 0 #b55a1e, 0 0 15px ${LEGENDARY_ORANGE}25`,
                }}
              >
                {isToyCheckingOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                {isToyCheckingOut ? 'Opening Stripe...' : 'Buy Foxy Toy'}
              </button>
            </div>
          </div>
        </FantasyPanel>
      )}

      {/* ═══ Referral Credits & CTA ═══ */}
      <FantasyPanel className="p-5" gold={referralCredits > 0}>
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: referralCredits > 0
                ? 'linear-gradient(135deg, rgba(124,198,67,0.2), rgba(124,198,67,0.08))'
                : `linear-gradient(135deg, ${GOLD}20, ${GOLD}08)`,
              border: `1.5px solid ${referralCredits > 0 ? 'rgba(124,198,67,0.3)' : `${GOLD}30`}`,
            }}
          >
            {referralCredits > 0 ? (
              <Sparkles className="w-5 h-5" style={{ color: '#7cc643' }} />
            ) : (
              <Gift className="w-5 h-5" style={{ color: GOLD }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {referralCredits > 0 ? (
              <>
                <p className="text-xs font-bold" style={{ color: GOLD_LIGHT }}>
                  {t('plan.creditsAvailable')}
                </p>
                <p
                  className="text-xl font-bold mt-1"
                  style={{
                    fontFamily: CHERRY,
                    color: '#7cc643',
                    textShadow: '0 0 12px rgba(124,198,67,0.3)',
                  }}
                >
                  RM{referralCredits.toFixed(2)}
                </p>
                <p className="text-[11px] mt-1" style={{ color: `${PARCHMENT}70` }}>
                  {t('plan.creditsCanOffset')}
                </p>
              </>
            ) : (
              <>
                <p
                  className="text-sm font-bold"
                  style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
                >
                  {t('plan.getFreeTitle')}
                </p>
                <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: `${PARCHMENT}70` }}>
                  {t('plan.getFreeDesc')}
                </p>
              </>
            )}

            {/* CTA to Earnings Hub */}
            <button
              onClick={() => {
                playMenuSelect();
                onNavigateToEarnings?.();
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: referralCredits > 0
                  ? 'rgba(124,198,67,0.15)'
                  : `${GOLD}15`,
                border: `1.5px solid ${referralCredits > 0 ? 'rgba(124,198,67,0.3)' : `${GOLD}30`}`,
                color: referralCredits > 0 ? '#7cc643' : GOLD,
              }}
            >
              {referralCredits > 0 ? t('plan.referMore') : t('plan.startReferring')}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </FantasyPanel>

      {/* Billing History Placeholder */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold mb-3"
          style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
        >
          {t('plan.billingHistory')}
        </h3>
        <div className="text-center py-6">
          <p className="text-xs" style={{ color: `${PARCHMENT}70` }}>
            {t('plan.noBilling')}
          </p>
          <p className="text-[10px] mt-1" style={{ color: `${PARCHMENT}60` }}>
            {t('plan.billingNote')}
          </p>
        </div>
      </FantasyPanel>

      {/* Cancel plan — subtle */}
      {isPaid && (
        <div className="text-center space-y-2">
          <button
            onClick={handleManageSubscription}
            disabled={isOpeningPortal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{
              fontFamily: CHERRY,
              background: `${GOLD}15`,
              border: `1px solid ${GOLD}30`,
              color: GOLD,
            }}
          >
            {isOpeningPortal ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            {isOpeningPortal ? t('plan.opening') : t('plan.manage')}
          </button>
          <p className="text-[10px]" style={{ color: `${PARCHMENT}50` }}>
            {t('plan.manageDesc')}
          </p>
        </div>
      )}
    </div>
  );
};