import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';

const DynTubeTestPage: React.FC = () => {
  const navigate = useNavigate();
  const [videoKey, setVideoKey] = useState('sNwOT9edCEVH7aaOyvng');
  const [isLoading, setIsLoading] = useState(false);
  const [playerStatus, setPlayerStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const testVideo = () => {
    if (!containerRef.current || !videoKey.trim()) return;

    setIsLoading(true);
    setPlayerStatus('loading');
    setErrorMessage('');

    const container = containerRef.current;
    container.innerHTML = '';

    // Create player div
    const playerDiv = document.createElement('div');
    playerDiv.setAttribute('data-dyntube-key', videoKey);
    playerDiv.style.width = '100%';
    playerDiv.style.height = '100%';
    container.appendChild(playerDiv);

    console.log('[DynTube Test] Mounting player with key:', videoKey);
    console.log('[DynTube Test] Current domain:', window.location.hostname);

    const w = window as any;
    const initSdk = () => {
      if (w.dyntube && typeof w.dyntube.init === 'function') {
        w.dyntube.init();
        console.log('[DynTube Test] SDK init() called');
      }

      // Check for iframe creation
      let checkCount = 0;
      const checkInterval = setInterval(() => {
        checkCount++;
        const iframe = container.querySelector('iframe');
        if (iframe) {
          console.log('[DynTube Test] ✅ Player iframe created successfully!');
          setIsLoading(false);
          setPlayerStatus('success');
          clearInterval(checkInterval);
        } else if (checkCount > 20) { // 10 seconds
          console.error('[DynTube Test] ❌ Player iframe not created after 10s');
          setIsLoading(false);
          setPlayerStatus('error');
          setErrorMessage(`Domain "${window.location.hostname}" may not be whitelisted in DynTube Dashboard → Settings → Security. Or the video may not be published.`);
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
      script.onload = () => {
        console.log('[DynTube Test] SDK loaded successfully');
        setTimeout(initSdk, 500);
      };
      script.onerror = () => {
        console.error('[DynTube Test] Failed to load SDK');
        setIsLoading(false);
        setPlayerStatus('error');
        setErrorMessage('Failed to load DynTube SDK from https://embed.dyntube.com/v1.0/dyntube.js');
      };
      document.head.appendChild(script);
    }
  };

  const resetTest = () => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    setPlayerStatus('idle');
    setErrorMessage('');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-amber-300 hover:text-amber-200 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-semibold">Back</span>
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent mb-2">
            DynTube Integration Test
          </h1>
          <p className="text-gray-400 text-sm">
            Test your DynTube video playback with domain whitelisting verification
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Configuration Status
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Current Domain:</span>
              <span className="font-mono text-amber-300">{window.location.hostname}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">DynTube SDK:</span>
              <span className="text-green-400">https://embed.dyntube.com/v1.0/dyntube.js</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Video Key:</span>
              <span className="font-mono text-purple-300">{videoKey || 'Not set'}</span>
            </div>
          </div>
        </div>

        {/* Input Form */}
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/50 mb-6">
          <h2 className="text-lg font-semibold mb-4">Video Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                DynTube Video Key
              </label>
              <input
                type="text"
                value={videoKey}
                onChange={(e) => setVideoKey(e.target.value)}
                placeholder="Enter DynTube video key"
                className="w-full px-4 py-2.5 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={testVideo}
                disabled={!videoKey.trim() || isLoading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform active:scale-95 disabled:transform-none shadow-lg"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing...
                  </span>
                ) : (
                  'Test Video'
                )}
              </button>
              <button
                onClick={resetTest}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Player Status */}
        {playerStatus !== 'idle' && (
          <div className={`bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 border mb-6 ${
            playerStatus === 'success' ? 'border-green-500/50' :
            playerStatus === 'error' ? 'border-red-500/50' :
            'border-gray-700/50'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              {playerStatus === 'success' && (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-green-400">Video loaded successfully!</span>
                </>
              )}
              {playerStatus === 'error' && (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span className="font-semibold text-red-400">Failed to load video</span>
                </>
              )}
              {playerStatus === 'loading' && (
                <>
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  <span className="font-semibold text-amber-400">Loading player...</span>
                </>
              )}
            </div>
            {errorMessage && (
              <div className="text-sm text-red-300 bg-red-900/20 p-4 rounded-lg">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Video Player */}
        <div className="bg-black rounded-2xl overflow-hidden border border-gray-700/50 aspect-video relative">
          {playerStatus === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-sm">Enter a video key and click "Test Video" to begin</p>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* Troubleshooting Guide */}
        <div className="mt-8 bg-gray-800/30 backdrop-blur-lg rounded-2xl p-6 border border-gray-700/30">
          <h2 className="text-lg font-semibold mb-4 text-amber-300">Troubleshooting Checklist</h2>
          <ul className="space-y-3 text-sm text-gray-300">
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
              <div>
                <strong className="text-white">Domain Whitelist:</strong> Go to DynTube Dashboard → Settings → Security → Domain Restrictions and add{' '}
                <code className="px-2 py-1 bg-gray-900 rounded text-amber-300 font-mono text-xs">
                  {window.location.hostname}
                </code>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
              <div>
                <strong className="text-white">Video Published:</strong> Ensure the video is published (not in draft) in your DynTube dashboard
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
              <div>
                <strong className="text-white">Correct Video Key:</strong> Double-check that the video key matches exactly (case-sensitive)
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
              <div>
                <strong className="text-white">Browser Console:</strong> Open browser DevTools (F12) → Console tab to see detailed DynTube logs
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DynTubeTestPage;
