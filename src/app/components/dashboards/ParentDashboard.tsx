import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, ClipboardCheck, Play, LogOut, Crown, Gift, 
  Copy, Check, Star, Lock, ChevronRight, Sparkles, Share2,
  Trash2, AlertTriangle, Settings
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { getStoredParentData, parentLogout, fetchReferralInfo, fetchVideos, recordUsage, createCheckoutSession, deleteParentAccount } from '../../utils/parent-api';
import { fetchRewardConfig } from '../../utils/api';
import { DEFAULT_REWARD_CONFIG } from '../../types/reward-config';
import type { RealmRewardConfig } from '../../types/reward-config';

// DynTube JS SDK embed component — uses official embed script
const DynTubePlayer: React.FC<{ dyntubeKey: string }> = ({ dyntubeKey }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    setLoading(true);
    setError('');

    // Clear previous player
    container.innerHTML = '';

    // Create the DynTube player div
    const playerDiv = document.createElement('div');
    playerDiv.setAttribute('data-dyntube-key', dyntubeKey);
    playerDiv.style.width = '100%';
    playerDiv.style.height = '100%';
    container.appendChild(playerDiv);

    console.log('[DynTube ParentDash] Mounting with key:', dyntubeKey, 'domain:', window.location.hostname);

    const w = window as any;
    const initSdk = () => {
      if (w.dyntube && typeof w.dyntube.init === 'function') {
        w.dyntube.init();
      }
      let checkCount = 0;
      const checkInterval = setInterval(() => {
        checkCount++;
        const iframe = container.querySelector('iframe');
        if (iframe) {
          setLoading(false);
          clearInterval(checkInterval);
        } else if (checkCount > 20) {
          setError(`Domain "${window.location.hostname}" may not be whitelisted in DynTube.`);
          setLoading(false);
          clearInterval(checkInterval);
        }
      }, 500);
    };

    if (w.dyntube) {
      initSdk();
    } else {
      const existingScript = document.getElementById('dyntube-sdk-script');
      if (existingScript) existingScript.remove();

      const script = document.createElement('script');
      script.id = 'dyntube-sdk-script';
      script.src = 'https://embed.dyntube.com/v1.0/dyntube.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => { setTimeout(initSdk, 500); };
      script.onerror = () => { setError('Failed to load DynTube SDK.'); setLoading(false); };
      document.head.appendChild(script);
    }

    return () => { container.innerHTML = ''; };
  }, [dyntubeKey]);

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black text-amber-300/60 text-sm text-center px-4">
        {error}
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </>
  );
};

interface ParentDashboardProps {
  parentData: any;
  onLogout: () => void;
  onStartTest: () => void;
  onRefreshParent: () => void;
}

type Tab = 'practice' | 'test' | 'watch';

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  parentData,
  onLogout,
  onStartTest,
  onRefreshParent,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('test');
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [rewardConfig, setRewardConfig] = useState<RealmRewardConfig>(DEFAULT_REWARD_CONFIG);

  const isPaid = parentData?.subscription_status === 'active';
  const plan = parentData?.subscription_plan || 'free';
  const todayTestCount = parentData?.test_count_today || 0;
  const todayWatchCount = parentData?.watch_count_today || 0;
  const freeTestLimit = rewardConfig.activities.test.freeMaxPerDay;
  const freeWatchLimit = rewardConfig.activities.video.freeMaxPerDay;
  const canTest = isPaid || freeTestLimit === -1 || todayTestCount < freeTestLimit;
  const canWatch = isPaid || freeWatchLimit === -1 || todayWatchCount < freeWatchLimit;

  useEffect(() => {
    loadReferralInfo();
    loadVideos();
    loadRewardConfig();
  }, []);

  const loadRewardConfig = async () => {
    try {
      const config = await fetchRewardConfig();
      if (config) setRewardConfig(config);
    } catch (err) {
      console.error('Failed to load reward config:', err);
    }
  };

  const loadReferralInfo = async () => {
    try {
      const info = await fetchReferralInfo();
      setReferralInfo(info);
    } catch (err) {
      console.error('Failed to load referral info:', err);
    }
  };

  const loadVideos = async () => {
    try {
      const result = await fetchVideos();
      setVideos(result.videos || []);
    } catch (err) {
      console.error('Failed to load videos:', err);
    }
  };

  const handleCopyReferral = () => {
    const code = parentData?.referral_code || '';
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleStartTest = async () => {
    if (!canTest) {
      setShowUpgrade(true);
      return;
    }
    try {
      const result = await recordUsage('test');
      if (!result.allowed) {
        setShowUpgrade(true);
        return;
      }
      onStartTest();
    } catch (err) {
      console.error('Test usage error:', err);
      toast.error('Failed to start test. Please try again.');
    }
  };

  const handleWatchVideo = async (dyntubeKey: string) => {
    if (!canWatch) {
      setShowUpgrade(true);
      return;
    }
    try {
      const result = await recordUsage('watch');
      if (!result.allowed) {
        setShowUpgrade(true);
        return;
      }
      setActiveVideo(dyntubeKey);
      onRefreshParent();
    } catch (err) {
      console.error('Watch usage error:', err);
      toast.error('Failed to play video.');
    }
  };

  const handleCheckout = async (selectedPlan: 'A' | 'B') => {
    setIsCheckingOut(true);
    try {
      const result = await createCheckoutSession(selectedPlan, parentData.email);
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

  const tabs = [
    { id: 'practice' as Tab, label: 'Practice', icon: Gamepad2, color: 'from-green-500 to-emerald-600' },
    { id: 'test' as Tab, label: 'Test', icon: ClipboardCheck, color: 'from-blue-500 to-indigo-600' },
    { id: 'watch' as Tab, label: 'Watch', icon: Play, color: 'from-purple-500 to-violet-600' },
  ];

  // Upgrade Modal
  if (showUpgrade) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0e2e] via-[#2d1b4e] to-[#1a0e2e] p-4 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <button
            onClick={() => setShowUpgrade(false)}
            className="text-amber-300/60 hover:text-amber-300 text-sm mb-4 flex items-center gap-1"
          >
            ← Back to Dashboard
          </button>
          
          <h2 className="text-2xl font-bold text-amber-100 text-center mb-2">Unlock Unlimited Access</h2>
          <p className="text-amber-300/60 text-center text-sm mb-8">Choose the perfect plan for your family</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan A */}
            <div className="bg-[#2a1a3e]/90 rounded-2xl border border-amber-500/20 p-6 relative">
              <div className="absolute -top-3 left-4">
                <span className="px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded-full">DIGITAL</span>
              </div>
              <h3 className="text-lg font-bold text-amber-100 mt-2">Plan A</h3>
              <p className="text-amber-300/50 text-xs mb-4">Foxy Adventure Game</p>
              
              <div className="flex items-end gap-1 mb-4">
                <span className="text-amber-300/50 text-sm">RM</span>
                <span className="text-4xl font-bold text-white">365</span>
                <span className="text-amber-300/50 text-sm">/year</span>
              </div>
              
              <ul className="space-y-2 mb-6 text-sm">
                {['Unlimited daily tests', 'Unlimited video access', 'Full progress tracking', 'All practice modes', 'Priority support'].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-amber-100/80">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => handleCheckout('A')}
                disabled={isCheckingOut}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50"
              >
                {isCheckingOut ? 'Opening Stripe...' : 'Subscribe Now'}
              </button>
            </div>

            {/* Plan B */}
            <div className="bg-[#2a1a3e]/90 rounded-2xl border-2 border-amber-400/40 p-6 relative shadow-[0_0_30px_rgba(212,164,74,0.2)]">
              <div className="absolute -top-3 left-4">
                <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-300 text-black text-xs font-bold rounded-full flex items-center gap-1">
                  <Crown className="w-3 h-3" /> BEST VALUE
                </span>
              </div>
              <h3 className="text-lg font-bold text-amber-100 mt-2">Plan B</h3>
              <p className="text-amber-300/50 text-xs mb-4">Game + Foxy AI Toy</p>
              
              <div className="flex items-end gap-1 mb-1">
                <span className="text-amber-300/50 text-sm">RM</span>
                <span className="text-4xl font-bold text-white">730</span>
                <span className="text-amber-300/50 text-sm">/first year</span>
              </div>
              <p className="text-amber-300/40 text-xs mb-4">then RM365/year renewal</p>
              
              <ul className="space-y-2 mb-6 text-sm">
                {[
                  'Everything in Plan A',
                  'Foxy AI Companion Toy',
                  'Physical toy shipped to you',
                  'Interactive voice learning',
                  'Exclusive toy-only content'
                ].map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-amber-100/80">
                    <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => handleCheckout('B')}
                disabled={isCheckingOut}
                className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:to-amber-400 transition-all disabled:opacity-50"
              >
                {isCheckingOut ? 'Opening Stripe...' : 'Get Game + Toy'}
              </button>
            </div>
          </div>

          {/* Referral credit notice */}
          {(referralInfo?.referral_credits || 0) > 0 && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
              <p className="text-green-300 text-sm">
                You have <strong>RM{referralInfo.referral_credits.toFixed(2)}</strong> in referral credits!
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0e2e] via-[#2d1b4e] to-[#1a0e2e]">
      {/* Header */}
      <div className="bg-[#2a1a3e]/80 backdrop-blur-xl border-b border-amber-500/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🦊</div>
            <div>
              <h1 className="text-lg font-bold text-amber-100">Foxy Adventure</h1>
              <p className="text-xs text-amber-300/50">
                Hi, {parentData?.name || 'Parent'}!
                {isPaid && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-bold">
                    <Crown className="w-3 h-3 inline mr-0.5" />
                    Plan {plan}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isPaid && (
              <button
                onClick={() => setShowUpgrade(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all flex items-center gap-1"
              >
                <Crown className="w-3 h-3" /> Upgrade
              </button>
            )}
            <button
              onClick={() => { parentLogout(); onLogout(); }}
              className="p-2 text-amber-300/40 hover:text-amber-300 transition-colors rounded-lg hover:bg-white/5"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex gap-2 bg-[#2a1a3e]/50 rounded-2xl p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                  : 'text-amber-300/50 hover:text-amber-300/80 hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 pb-8">
        {/* ===== PRACTICE TAB ===== */}
        {activeTab === 'practice' && (
          <div className="space-y-4">
            <div className="bg-[#2a1a3e]/60 rounded-2xl border border-amber-500/10 p-6 text-center">
              <Gamepad2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-amber-100 mb-2">Practice Mode</h2>
              <p className="text-amber-300/50 text-sm mb-6 max-w-md mx-auto">
                Endless practice with reshuffled questions. No scoring, no pressure — just learning!
                Your child can practice as much as they want.
              </p>
              <button
                onClick={onStartTest}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-2xl text-lg hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25 active:scale-[0.98]"
              >
                <Sparkles className="w-5 h-5 inline mr-2" />
                Start Practice
              </button>
              <p className="text-amber-300/30 text-xs mt-4">
                Unlimited access for all users
              </p>
            </div>

            {/* Practice tips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { emoji: '🎯', title: 'No Pressure', desc: 'Questions are reshuffled — no scoring!' },
                { emoji: '🔄', title: 'Endless Loop', desc: 'Questions repeat in random order' },
                { emoji: '📈', title: 'Build Confidence', desc: 'Practice makes perfect!' },
              ].map((tip, i) => (
                <div key={i} className="bg-[#2a1a3e]/40 rounded-xl border border-amber-500/10 p-4 text-center">
                  <div className="text-2xl mb-2">{tip.emoji}</div>
                  <h3 className="text-sm font-bold text-amber-100">{tip.title}</h3>
                  <p className="text-amber-300/40 text-xs mt-1">{tip.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== TEST TAB ===== */}
        {activeTab === 'test' && (
          <div className="space-y-4">
            <div className="bg-[#2a1a3e]/60 rounded-2xl border border-amber-500/10 p-6 text-center">
              <ClipboardCheck className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-amber-100 mb-2">KSSR Assessment Test</h2>
              <p className="text-amber-300/50 text-sm mb-4 max-w-md mx-auto">
                Official adaptive assessment aligned with Malaysia's KSSR curriculum.
                Get a detailed report with your child's functional age per subject.
              </p>
              
              {/* Usage indicator */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full mb-6">
                {isPaid ? (
                  <>
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-200 text-sm font-medium">Unlimited Tests</span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-300/60 text-sm">
                      Today: {todayTestCount}/{freeTestLimit === -1 ? '∞' : freeTestLimit} used
                    </span>
                    {!canTest && <Lock className="w-3 h-3 text-red-400" />}
                  </>
                )}
              </div>
              
              <div>
                <button
                  onClick={handleStartTest}
                  disabled={!canTest && !isPaid}
                  className={`px-8 py-4 font-bold rounded-2xl text-lg transition-all shadow-lg active:scale-[0.98] ${
                    canTest
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-400 hover:to-indigo-500 shadow-blue-500/25'
                      : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {canTest ? (
                    <>
                      <ClipboardCheck className="w-5 h-5 inline mr-2" />
                      Start Assessment
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 inline mr-2" />
                      Upgrade to Continue
                    </>
                  )}
                </button>
                {!canTest && (
                  <button
                    onClick={() => setShowUpgrade(true)}
                    className="block mx-auto mt-3 text-amber-400 text-sm hover:text-amber-300 transition-colors"
                  >
                    Unlock unlimited tests →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== WATCH TAB ===== */}
        {activeTab === 'watch' && (
          <div className="space-y-4">
            {/* Active DynTube video player */}
            {activeVideo && (
              <div className="bg-black rounded-2xl overflow-hidden mb-4">
                <div className="aspect-video relative">
                  <DynTubePlayer dyntubeKey={activeVideo} />
                </div>
                <button
                  onClick={() => setActiveVideo(null)}
                  className="w-full py-2 text-amber-300/60 text-sm hover:text-amber-300 transition-colors"
                >
                  Close Player
                </button>
              </div>
            )}

            {/* Usage indicator */}
            <div className="bg-[#2a1a3e]/60 rounded-2xl border border-amber-500/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Play className="w-5 h-5 text-purple-400" />
                <div>
                  <h2 className="text-base font-bold text-amber-100">Foxy Adventures Series</h2>
                  <p className="text-amber-300/50 text-xs">Educational videos featuring Foxy</p>
                </div>
              </div>
              <div className="text-right">
                {isPaid ? (
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold">
                    <Crown className="w-3 h-3 inline mr-1" />Unlimited
                  </span>
                ) : (
                  <span className="text-amber-300/50 text-xs">{todayWatchCount}/{freeWatchLimit === -1 ? '∞' : freeWatchLimit} today</span>
                )}
              </div>
            </div>

            {/* Video grid */}
            {videos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {videos.map((video) => {
                  const thumbnail = video.thumbnail_url || '';
                  const hasDyntube = !!video.dyntube_key;
                  
                  return (
                    <button
                      key={video.id}
                      onClick={() => hasDyntube ? handleWatchVideo(video.dyntube_key) : null}
                      disabled={!hasDyntube}
                      className="bg-[#2a1a3e]/40 rounded-xl border border-amber-500/10 overflow-hidden hover:border-amber-500/30 transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="aspect-video bg-black/50 relative overflow-hidden">
                        {thumbnail && (
                          <img src={thumbnail} alt={video.title} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                            <Play className="w-5 h-5 text-black ml-0.5" />
                          </div>
                        </div>
                        {!canWatch && !isPaid && (
                          <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded-lg flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-400" />
                            <span className="text-amber-300 text-[10px] font-bold">PRO</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-bold text-amber-100 group-hover:text-amber-50 transition-colors line-clamp-1">
                          {video.title}
                        </h3>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#2a1a3e]/40 rounded-2xl border border-amber-500/10 p-8 text-center">
                <Play className="w-10 h-10 text-purple-400/40 mx-auto mb-3" />
                <p className="text-amber-300/40 text-sm">No videos available yet.</p>
                <p className="text-amber-300/30 text-xs mt-1">Videos will be added by the admin.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== REFERRAL CARD (always visible below tabs) ===== */}
        <div className="mt-6 bg-gradient-to-r from-[#2a1a3e]/80 to-[#3d2a5e]/80 rounded-2xl border border-amber-500/15 p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-amber-100">Refer & Earn</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-amber-300/40">Your credits</p>
              <p className="text-lg font-bold text-green-400">
                RM{(referralInfo?.referral_credits || parentData?.referral_credits || 0).toFixed(2)}
              </p>
            </div>
          </div>
          
          <p className="text-amber-300/50 text-xs mb-3">
            Earn <strong className="text-amber-200">RM36.50</strong> for every friend who subscribes. Credits can be used toward your own subscription!
          </p>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/5 border border-amber-500/20 rounded-xl px-4 py-2.5 font-mono text-amber-200 text-sm tracking-wider">
              {parentData?.referral_code || 'Loading...'}
            </div>
            <button
              onClick={handleCopyReferral}
              className="px-4 py-2.5 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-300 hover:bg-amber-500/30 transition-all"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          {(referralInfo?.referral_count || 0) > 0 && (
            <p className="text-amber-300/40 text-xs mt-2">
              {referralInfo.referral_count} referral{referralInfo.referral_count > 1 ? 's' : ''} so far
            </p>
          )}
        </div>

        {/* ===== ACCOUNT / DANGER ZONE ===== */}
        <div className="mt-6 bg-[#2a1a3e]/40 rounded-2xl border border-red-500/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-amber-300/40" />
            <h3 className="text-sm font-bold text-amber-300/60">Account</h3>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100/80 text-sm">{parentData?.email || 'No email'}</p>
              <p className="text-amber-300/30 text-xs">
                Joined {parentData?.created_at ? new Date(parentData.created_at).toLocaleDateString() : 'recently'}
              </p>
            </div>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 text-red-400/60 text-xs hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Delete Account
              </button>
            ) : (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-red-300 text-xs">This cannot be undone!</span>
                </div>
                <div className="flex flex-col gap-1.5 w-full max-w-[260px]">
                  <p className="text-amber-300/50 text-[11px]">
                    Type <strong className="text-red-300">DELETE</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full px-3 py-2 bg-black/30 border border-red-500/20 rounded-lg text-red-200 text-sm placeholder:text-red-400/30 focus:outline-none focus:border-red-500/50"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      className="flex-1 py-2 text-amber-300/60 text-xs hover:text-amber-300 bg-white/5 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (deleteConfirmText !== 'DELETE') {
                          toast.error('Please type DELETE to confirm');
                          return;
                        }
                        setIsDeleting(true);
                        try {
                          await deleteParentAccount();
                          toast.success('Account deleted. Goodbye!');
                          onLogout();
                        } catch (err) {
                          console.error('Delete account error:', err);
                          toast.error(err instanceof Error ? err.message : 'Failed to delete account');
                        } finally {
                          setIsDeleting(false);
                        }
                      }}
                      disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                        deleteConfirmText === 'DELETE' && !isDeleting
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-red-600/20 text-red-400/40 cursor-not-allowed'
                      }`}
                    >
                      {isDeleting ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3 h-3" />
                          Delete Forever
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};