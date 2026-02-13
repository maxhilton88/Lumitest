import React, { useState, useEffect, useRef } from 'react';
import { Link2, Copy, Check, Share2, MessageCircle, Facebook, Instagram, ExternalLink, Image, Sparkles, ChevronDown, Info } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { fetchMarketingArtwork } from '../../utils/api';
import { copyToClipboard } from '../../utils/clipboard';

type Platform = 'all' | 'whatsapp' | 'facebook' | 'instagram';

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

const PLATFORM_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; dimensions: string; sharePrefix: string }> = {
  whatsapp: {
    label: 'WhatsApp',
    icon: MessageCircle,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    dimensions: '1200 x 630',
    sharePrefix: 'https://wa.me/?text=',
  },
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    dimensions: '1200 x 630',
    sharePrefix: 'https://www.facebook.com/sharer/sharer.php?u=',
  },
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bg: 'bg-pink-50 border-pink-200',
    dimensions: '1080 x 1080',
    sharePrefix: '',
  },
};

export const MarketingPage: React.FC = () => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('all');
  const [copied, setCopied] = useState(false);
  const [showManualCopy, setShowManualCopy] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const shortCode = localStorage.getItem('school_short_code') || '';
  const kgUrl = localStorage.getItem('school_kindergarten_url') || '';
  const schoolName = localStorage.getItem('school_name') || 'Your School';
  // Prefer short_code (e.g. TGJ01), fall back to kindergarten_url slug
  const brandedCode = shortCode || kgUrl;
  const testLink = brandedCode
    ? `https://foxy.projectlumi.org/t/${brandedCode}`
    : 'https://foxy.projectlumi.org';

  useEffect(() => {
    loadArtwork();
  }, []);

  const loadArtwork = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMarketingArtwork();
      setArtworks(data);
    } catch (error) {
      console.error('[MARKETING] Failed to load artwork:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(testLink);
    if (success) {
      setCopied(true);
      toast.success('Test link copied!');
      setTimeout(() => setCopied(false), 2000);
    } else {
      // Clipboard blocked — show the input and select it
      setShowManualCopy(true);
      toast.info('Select the link above and copy manually (Ctrl+C / Cmd+C)');
      setTimeout(() => {
        linkInputRef.current?.focus();
        linkInputRef.current?.select();
      }, 100);
    }
  };

  const handleShareWithLink = async (artwork: Artwork, variant: ArtworkVariant) => {
    const platform = variant.platform;
    const config = PLATFORM_CONFIG[platform];
    if (!config) return;

    const shareText = `Check out Foxy Adventure - a fun KSSR readiness assessment for your child! Try it now: ${testLink}`;

    if (platform === 'whatsapp') {
      window.open(`${config.sharePrefix}${encodeURIComponent(shareText)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`${config.sharePrefix}${encodeURIComponent(testLink)}`, '_blank');
    } else if (platform === 'instagram') {
      // Instagram doesn't have a share URL — download the image + copy link
      if (variant.signed_url) {
        window.open(variant.signed_url, '_blank');
        const success = await copyToClipboard(testLink);
        if (success) {
          toast.success('Link copied! Save the image and share on Instagram with the link in your caption.');
        } else {
          setShowManualCopy(true);
          toast.info('Save the image and paste this link in your Instagram caption.');
        }
      } else {
        toast.error('Image not available. Please try again later.');
      }
    }
  };

  // Filter artworks based on selected platform
  const filteredArtworks = artworks.filter(art => {
    if (selectedPlatform === 'all') return true;
    return art.variants.some(v => v.platform === selectedPlatform);
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Marketing Kit</h2>
        <p className="text-sm text-gray-500 mt-1">
          Share your branded test link and promotional materials with parents.
        </p>
      </div>

      {/* ── Referral Link Card ── */}
      <div className="border border-gray-200 rounded-xl p-5 bg-gradient-to-br from-gray-50 to-white">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Your Branded Test Link</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Parents visit this link to take the KSSR readiness assessment branded with {schoolName}.
            </p>
          </div>
        </div>

        {/* Link display + copy */}
        <div className="flex items-stretch gap-2">
          <div className="flex-1 relative">
            <input
              ref={linkInputRef}
              type="text"
              readOnly
              value={testLink}
              onFocus={(e) => e.target.select()}
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 font-mono select-all focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            {!brandedCode && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  No code
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleCopyLink}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-black text-white hover:bg-gray-800'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        </div>

        {showManualCopy && (
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Click the link above to select it, then press Ctrl+C (or Cmd+C) to copy.
          </div>
        )}

        {/* Quick share row */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className="text-xs text-gray-500 mr-1">Quick share:</span>
          <button
            onClick={() => {
              const text = `Check out Foxy Adventure - a fun KSSR readiness assessment for your child!\n\nTry it now: ${testLink}`;
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </button>
          <button
            onClick={() => {
              window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(testLink)}`, '_blank');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            <Facebook className="w-3.5 h-3.5" />
            Facebook
          </button>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 border border-pink-200 text-pink-700 rounded-lg text-xs font-medium hover:bg-pink-100 transition-colors"
          >
            <Instagram className="w-3.5 h-3.5" />
            Instagram
          </button>
        </div>
      </div>

      {/* ── Platform Filter ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filter by platform:</span>
        <div className="flex items-center gap-1.5">
          {(['all', 'whatsapp', 'facebook', 'instagram'] as Platform[]).map((p) => {
            const isActive = selectedPlatform === p;
            const config = p !== 'all' ? PLATFORM_CONFIG[p] : null;
            const Icon = config?.icon;
            return (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isActive
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {p === 'all' ? 'All' : config?.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Promotional Artwork Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Promotional Artwork</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Share these ready-made designs with your branded link embedded.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Sparkles className="w-3.5 h-3.5" />
            {artworks.length} design{artworks.length !== 1 ? 's' : ''} available
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
            <p className="text-sm text-gray-500">Loading artwork...</p>
          </div>
        ) : filteredArtworks.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl p-12 text-center">
            <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900 mb-1">
              {artworks.length === 0 ? 'No artwork available yet' : 'No artwork for this platform'}
            </p>
            <p className="text-xs text-gray-500">
              {artworks.length === 0
                ? 'Your super admin will upload promotional designs here soon.'
                : 'Try selecting a different platform or "All".'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredArtworks.map((artwork) => {
              // Show variants matching the selected platform (or all)
              const visibleVariants = selectedPlatform === 'all'
                ? artwork.variants
                : artwork.variants.filter(v => v.platform === selectedPlatform);

              return visibleVariants.map((variant, idx) => {
                const config = PLATFORM_CONFIG[variant.platform];
                if (!config) return null;
                const PlatformIcon = config.icon;

                return (
                  <div
                    key={`${artwork.id}-${variant.platform}-${idx}`}
                    className="border border-gray-200 rounded-xl overflow-hidden group hover:shadow-md transition-shadow bg-white"
                  >
                    {/* Image Preview */}
                    <div className="relative bg-gray-100 aspect-video overflow-hidden">
                      {variant.signed_url ? (
                        <img
                          src={variant.signed_url}
                          alt={artwork.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-10 h-10 text-gray-300" />
                        </div>
                      )}
                      {/* Platform badge */}
                      <div className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border ${config.bg} ${config.color}`}>
                        <PlatformIcon className="w-3 h-3" />
                        {config.label}
                      </div>
                      {/* Dimensions badge */}
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-mono rounded-md">
                        {variant.width} x {variant.height}
                      </div>
                    </div>

                    {/* Card Info */}
                    <div className="p-4">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{artwork.title}</h4>
                      {artwork.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{artwork.description}</p>
                      )}

                      {/* Share with my Link CTA */}
                      <button
                        onClick={() => handleShareWithLink(artwork, variant)}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                        Share with my Link
                      </button>

                      {/* Download image link */}
                      {variant.signed_url && (
                        <a
                          href={variant.signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-4 py-2 text-gray-600 hover:text-gray-900 text-xs font-medium transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View full image
                        </a>
                      )}
                    </div>
                  </div>
                );
              });
            })}
          </div>
        )}
      </div>

      {/* ── How It Works ── */}
      <div className="border border-gray-100 rounded-xl p-5 bg-gray-50/50">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">How Dynamic OG Links Work</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-600">1</div>
            <div>
              <p className="text-xs font-medium text-gray-900">Choose a design</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Pick artwork sized for your target platform.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-600">2</div>
            <div>
              <p className="text-xs font-medium text-gray-900">Click "Share with my Link"</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Your branded link ({brandedCode || 'code'}) is embedded automatically.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-600">3</div>
            <div>
              <p className="text-xs font-medium text-gray-900">Parents see your brand</p>
              <p className="text-[11px] text-gray-500 mt-0.5">When parents click the link, they enter your branded assessment flow.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};