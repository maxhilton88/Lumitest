import React, { useState, useEffect } from 'react';
import { Crown, Check, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  FantasyPanel,
  FantasyTitle,
  GoldOrnament,
} from '../FantasyBackground';
import { createCheckoutSession, verifyCheckoutSession, createPortalSession, parentValidateSession } from '../../utils/parent-api';
import { playMenuSelect } from '../../hooks/useSoundEffects';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

interface PlanBillingProps {
  parentData: any;
  referralCredits: number;
  onRefreshParent?: () => void;
}

export const PlanBilling: React.FC<PlanBillingProps> = ({
  parentData,
  referralCredits,
  onRefreshParent,
}) => {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'success' | 'cancelled' | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const isPaid = parentData?.subscription_status === 'active';
  const currentPlan = parentData?.subscription_plan || 'free';

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
    setIsCheckingOut(true);
    try {
      const result = await createCheckoutSession(plan, parentData.email);
      if (result.url) {
        window.open(result.url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Failed to create checkout. Please try again.');
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

  const plans = [
    {
      id: 'A' as const,
      name: 'Plan A',
      badge: 'DIGITAL',
      badgeColor: GOLD,
      subtitle: 'Foxy Adventure Game',
      price: '365',
      period: '/year',
      note: null,
      features: [
        'Unlimited daily tests',
        'Unlimited video access',
        'Full progress tracking',
        'All practice modes',
        'Priority support',
      ],
      isBestValue: false,
    },
    {
      id: 'B' as const,
      name: 'Plan B',
      badge: 'BEST VALUE',
      badgeColor: '#ffd700',
      subtitle: 'Game + Foxy AI Toy',
      price: '730',
      period: '/first year',
      note: 'then RM365/year renewal',
      features: [
        'Everything in Plan A',
        'Foxy AI Companion Toy',
        'Physical toy shipped to you',
        'Interactive voice learning',
        'Exclusive toy-only content',
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
            Verifying your payment with Stripe...
          </p>
        </FantasyPanel>
      )}
      {verifyResult === 'success' && !isVerifying && (
        <FantasyPanel className="px-5 py-4 flex items-center gap-3" gold>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#7cc643' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#7cc643' }}>
              Payment Successful!
            </p>
            <p className="text-xs mt-0.5" style={{ color: `${PARCHMENT}80` }}>
              Your subscription is now active. Enjoy unlimited access!
            </p>
          </div>
        </FantasyPanel>
      )}
      {verifyResult === 'cancelled' && !isVerifying && (
        <FantasyPanel className="px-5 py-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#f87171' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: '#f87171' }}>
              Checkout Cancelled
            </p>
            <p className="text-xs mt-0.5" style={{ color: `${PARCHMENT}80` }}>
              No charge was made. You can try again anytime.
            </p>
          </div>
        </FantasyPanel>
      )}

      {/* Header */}
      <div className="text-center">
        <FantasyTitle size="md">Plan & Billing</FantasyTitle>
        <p className="mt-2 text-sm" style={{ color: `${PARCHMENT}80` }}>
          Subscription & Payments
        </p>
        <GoldOrnament className="mt-3" />
      </div>

      {/* Current Plan Badge */}
      <FantasyPanel className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Placeholder icon */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ border: `2px dashed ${GOLD}44`, background: `${GOLD}08` }}
          >
            <span className="text-lg">📜</span>
          </div>
          <div>
            <p className="text-xs" style={{ color: `${PARCHMENT}80` }}>Current Plan</p>
            <p
              className="text-sm font-bold"
              style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
            >
              {isPaid ? `Plan ${currentPlan.toUpperCase()}` : 'Free Tier'}
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
            <span className="text-[11px] font-bold text-green-400">Active</span>
          </div>
        )}
      </FantasyPanel>

      {/* Referral credits notice */}
      {referralCredits > 0 && (
        <FantasyPanel className="px-4 py-3 flex items-center gap-3">
          <span className="text-lg">💰</span>
          <p className="text-xs" style={{ color: `${PARCHMENT}70` }}>
            You have <strong style={{ color: '#7cc643' }}>RM{referralCredits.toFixed(2)}</strong> in
            referral credits to offset your subscription.
          </p>
        </FantasyPanel>
      )}

      {/* Plan Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((plan) => {
          const isCurrentPlan = isPaid && currentPlan.toUpperCase() === plan.id;

          return (
            <FantasyPanel
              key={plan.id}
              className="p-5 md:p-6 relative"
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
                  CURRENT
                </div>
              )}

              <div className="mt-3">
                <h3
                  className="text-lg font-bold"
                  style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
                >
                  {plan.name}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}75` }}>
                  {plan.subtitle}
                </p>
              </div>

              {/* Price */}
              <div className="flex items-end gap-1 mt-4 mb-1">
                <span className="text-xs" style={{ color: `${PARCHMENT}75` }}>RM</span>
                <span
                  className="text-3xl font-bold leading-none"
                  style={{
                    fontFamily: "'Cinzel Decorative', serif",
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

              {/* CTA button */}
              {isCurrentPlan ? (
                <div
                  className="w-full py-2.5 rounded-xl text-center text-xs font-bold tracking-wider"
                  style={{
                    background: `${GOLD}10`,
                    border: `2px solid ${GOLD}25`,
                    color: `${PARCHMENT}60`,
                    fontFamily: "'Cinzel Decorative', serif",
                  }}
                >
                  Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isCheckingOut}
                  className="w-full py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: "'Cinzel Decorative', serif",
                    background: plan.isBestValue
                      ? `linear-gradient(135deg, #ffd700 0%, ${GOLD} 100%)`
                      : `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                    color: '#2a1f0e',
                    border: `2px solid ${GOLD_LIGHT}`,
                    boxShadow: `0 3px 0 #a67c2e, 0 0 15px ${GOLD}20`,
                    textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  {isCheckingOut ? 'Opening Stripe...' : isPaid ? 'Switch Plan' : 'Subscribe Now'}
                </button>
              )}
            </FantasyPanel>
          );
        })}
      </div>

      {/* Billing History Placeholder */}
      <FantasyPanel className="p-5">
        <h3
          className="text-sm font-bold mb-3"
          style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
        >
          Billing History
        </h3>
        <div className="text-center py-6">
          <p className="text-xs" style={{ color: `${PARCHMENT}70` }}>
            No billing history yet.
          </p>
          <p className="text-[10px] mt-1" style={{ color: `${PARCHMENT}60` }}>
            Your payment records will appear here after subscribing.
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
              fontFamily: "'Cinzel Decorative', serif",
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
            {isOpeningPortal ? 'Opening...' : 'Manage Subscription'}
          </button>
          <p className="text-[10px]" style={{ color: `${PARCHMENT}50` }}>
            Update payment method, view invoices, or cancel
          </p>
        </div>
      )}
    </div>
  );
};