/**
 * QRClaimPage.tsx — FMCG QR Scan & Reward Claim (Prompt 2, Part A)
 *
 * Route: /qr?code=XXXX
 *
 * 6 States:
 * 1. Loading       — resolving QR code
 * 2. Invalid       — code doesn't exist
 * 3. Expired       — campaign ended
 * 4. Already Claimed — code was used before
 * 5. Login Required — valid code but user not logged in (stores pending code)
 * 6. Celebration   — reward claimed! Brand-themed popup
 */
import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useAppContext } from '../contexts/AppContext';
import { resolveQRCode, claimQRCode, type FMCGClaimResult } from '../utils/api';
import { CelebrationPopup } from '../components/fmcg/CelebrationPopup';
import { useLanguage } from '../components/LanguageContext';
import {
  QrCode, AlertTriangle, Clock, CheckCircle2, LogIn, X,
  ShieldAlert, Sparkles, UserPlus,
} from 'lucide-react';

export function QRClaimPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ctx = useAppContext();
  const { t } = useLanguage();
  const code = searchParams.get('code') || '';

  const [state, setState] = useState<
    'loading' | 'invalid' | 'expired' | 'upcoming' | 'already_claimed' | 'login_required' | 'claiming' | 'celebration' | 'error'
  >('loading');
  const [brandInfo, setBrandInfo] = useState<{
    brandName: string; brandColour: string; brandLogoUrl: string; campaignName: string;
    expiryDate?: string; startDate?: string; claimedAt?: string;
  } | null>(null);
  const [claimResult, setClaimResult] = useState<FMCGClaimResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const hasClaimed = useRef(false);

  // Step 1: Resolve QR code on mount
  useEffect(() => {
    if (!code) {
      setState('invalid');
      setErrorMsg('No QR code provided.');
      return;
    }

    (async () => {
      try {
        const data = await resolveQRCode(code);

        if (!data.success) {
          setState('invalid');
          setErrorMsg(data.error || 'Invalid QR code');
          return;
        }

        setBrandInfo({
          brandName: data.brandName,
          brandColour: data.brandColour,
          brandLogoUrl: data.brandLogoUrl,
          campaignName: data.campaignName,
          expiryDate: data.expiryDate,
          startDate: data.startDate,
          claimedAt: data.claimedAt,
        });

        if (data.isClaimed) {
          setState('already_claimed');
        } else if (data.campaignStatus === 'expired') {
          setState('expired');
        } else if (data.campaignStatus === 'upcoming') {
          setState('upcoming');
        } else if (!ctx.isAuthenticated) {
          // Store pending code for post-login auto-claim
          localStorage.setItem('fmcg_pending_code', code);
          setState('login_required');
        } else {
          // Ready to claim
          setState('claiming');
        }
      } catch (err: any) {
        console.error('[QR] Resolve error:', err);
        setState('error');
        setErrorMsg(err.message || 'Failed to resolve QR code');
      }
    })();
  }, [code, ctx.isAuthenticated]);

  // Step 2: Auto-claim if authenticated and state is 'claiming'
  useEffect(() => {
    if (state !== 'claiming' || hasClaimed.current) return;
    hasClaimed.current = true;

    (async () => {
      try {
        const result = await claimQRCode(code);
        setClaimResult(result);

        if (result.success && result.status === 'claimed') {
          setBrandInfo(prev => ({
            ...prev!,
            brandName: result.brandName || prev?.brandName || '',
            brandColour: result.brandColour || prev?.brandColour || '#7cc643',
            brandLogoUrl: result.brandLogoUrl || prev?.brandLogoUrl || '',
            campaignName: result.campaignName || prev?.campaignName || '',
          }));
          localStorage.removeItem('fmcg_pending_code');
          setState('celebration');
        } else if (result.status === 'already_claimed') {
          setState('already_claimed');
        } else if (result.status === 'expired') {
          setState('expired');
        } else if (result.status === 'unauthorized') {
          localStorage.setItem('fmcg_pending_code', code);
          setState('login_required');
        } else {
          setState('error');
          setErrorMsg(result.error || 'Claim failed');
        }
      } catch (err: any) {
        console.error('[QR] Claim error:', err);
        setState('error');
        setErrorMsg(err.message || 'Failed to claim reward');
      }
    })();
  }, [state, code]);

  const brandColour = brandInfo?.brandColour || '#7cc643';
  const brandName = brandInfo?.brandName || 'FMCG';

  // ── Celebration popup ──
  if (state === 'celebration' && claimResult) {
    return (
      <CelebrationPopup
        brandName={brandInfo?.brandName || ''}
        brandColour={brandColour}
        brandLogoUrl={brandInfo?.brandLogoUrl || ''}
        campaignName={brandInfo?.campaignName || ''}
        rewards={claimResult.rewards || []}
        onContinue={() => navigate('/realm/bag')}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: `linear-gradient(135deg, ${brandColour}15 0%, #f9fafb 50%, ${brandColour}10 100%)` }}>
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-6">
          {brandInfo?.brandLogoUrl ? (
            <img src={brandInfo.brandLogoUrl} alt={brandName}
              className="h-12 mx-auto mb-2 object-contain" />
          ) : (
            <div className="w-14 h-14 rounded-2xl mx-auto mb-2 flex items-center justify-center text-white text-xl font-bold"
              style={{ background: brandColour }}>
              {brandName.charAt(0)}
            </div>
          )}
          {brandInfo?.campaignName && (
            <p className="text-xs text-gray-400">{brandInfo.campaignName}</p>
          )}
        </div>

        {/* State cards */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* ── Loading ── */}
          {state === 'loading' && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 border-3 rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: `${brandColour}20`, borderTopColor: brandColour }} />
              <p className="text-sm text-gray-500">{t('qr.verifying')}</p>
              <p className="text-[10px] text-gray-300 mt-1 font-mono">{code}</p>
            </div>
          )}

          {/* ── Invalid ── */}
          {state === 'invalid' && (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{t('qr.invalidCode')}</h2>
              <p className="text-sm text-gray-500 mb-4">{errorMsg || t('qr.invalidDesc')}</p>
              <button onClick={() => navigate('/')}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                {t('qr.goHome')}
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {state === 'error' && (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-7 h-7 text-orange-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{t('qr.somethingWrong')}</h2>
              <p className="text-sm text-gray-500 mb-4">{errorMsg}</p>
              <button onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                {t('qr.tryAgain')}
              </button>
            </div>
          )}

          {/* ── Expired ── */}
          {state === 'expired' && (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-7 h-7 text-gray-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{t('qr.campaignExpired')}</h2>
              <p className="text-sm text-gray-500 mb-1">
                {t('qr.promotionEnded').replace('.', '')} ({brandName}).
              </p>
              {brandInfo?.expiryDate && (
                <p className="text-xs text-gray-400 mb-4">
                  {t('qr.expiredOn')} {new Date(brandInfo.expiryDate).toLocaleDateString()}
                </p>
              )}
              <button onClick={() => navigate('/')}
                className="px-4 py-2 text-sm text-white rounded-lg"
                style={{ background: brandColour }}>
                {t('qr.explore')}
              </button>
            </div>
          )}

          {/* ── Upcoming ── */}
          {state === 'upcoming' && (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{t('qr.comingSoon')}</h2>
              <p className="text-sm text-gray-500 mb-1">
                {t('qr.notStarted').replace('.', '')} ({brandName}).
              </p>
              {brandInfo?.startDate && (
                <p className="text-xs text-gray-400 mb-4">
                  {t('qr.startsOn')} {new Date(brandInfo.startDate).toLocaleDateString()}
                </p>
              )}
              <button onClick={() => navigate('/')}
                className="px-4 py-2 text-sm text-white rounded-lg"
                style={{ background: brandColour }}>
                {t('qr.explore')}
              </button>
            </div>
          )}

          {/* ── Already Claimed ── */}
          {state === 'already_claimed' && (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{t('qr.alreadyRedeemed')}</h2>
              <p className="text-sm text-gray-500 mb-1">
                {t('qr.codeUsed')}
              </p>
              {brandInfo?.claimedAt && (
                <p className="text-xs text-gray-400 mb-4">
                  {t('qr.claimedOn')} {new Date(brandInfo.claimedAt).toLocaleDateString()}
                </p>
              )}
              <button onClick={() => navigate('/realm/bag')}
                className="px-4 py-2 text-sm text-white rounded-lg"
                style={{ background: brandColour }}>
                {t('qr.viewMyBag')}
              </button>
            </div>
          )}

          {/* ── Login Required ── */}
          {state === 'login_required' && (
            <div className="p-8 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: `${brandColour}15` }}>
                <Sparkles className="w-7 h-7" style={{ color: brandColour }} />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {t('qr.foundReward').replace('!', '')} ({brandName})!
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {t('qr.loginToClaim')}
              </p>
              <div className="space-y-2">
                <button onClick={() => navigate('/login')}
                  className="w-full px-4 py-2.5 text-sm text-white rounded-lg font-medium flex items-center justify-center gap-2"
                  style={{ background: brandColour }}>
                  <LogIn size={16} /> {t('qr.loginClaim')}
                </button>
                <button onClick={() => navigate('/login?mode=signup')}
                  className="w-full px-4 py-2.5 text-sm rounded-lg font-medium flex items-center justify-center gap-2"
                  style={{ background: `${brandColour}15`, color: brandColour, border: `1.5px solid ${brandColour}30` }}>
                  <UserPlus size={16} /> {t('qr.signupClaim')}
                </button>
                <button onClick={() => navigate('/')}
                  className="w-full px-4 py-2 text-xs text-gray-500 hover:text-gray-700">
                  {t('qr.maybeLater')}
                </button>
              </div>
            </div>
          )}

          {/* ── Claiming (brief spinner) ── */}
          {state === 'claiming' && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 border-3 rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: `${brandColour}20`, borderTopColor: brandColour }} />
              <p className="text-sm text-gray-500">{t('qr.claiming')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-300 mt-4">
          {t('qr.poweredBy')} &times; {brandName}
        </p>
      </div>
    </div>
  );
}