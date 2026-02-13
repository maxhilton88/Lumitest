import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image, Upload, Trash2, Plus, X, MessageCircle, Facebook, Instagram,
  RefreshCw, AlertCircle, Info, ChevronDown, ChevronUp, Monitor, Smartphone,
  FileImage, Check, Loader2, GripVertical, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { fetchMarketingArtwork, uploadMarketingArtwork, deleteMarketingArtwork, deleteMarketingArtworkVariant } from '../../utils/api';

// ===== PLATFORM SPECS =====
type PlatformKey = 'whatsapp' | 'facebook' | 'instagram';

interface PlatformSpec {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  presets: { label: string; width: number; height: number; ratio: string; note: string }[];
}

const PLATFORM_SPECS: Record<PlatformKey, PlatformSpec> = {
  whatsapp: {
    label: 'WhatsApp',
    icon: MessageCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    presets: [
      { label: 'Link Preview', width: 1200, height: 630, ratio: '1.91:1', note: 'Best for shared links in chats' },
      { label: 'Status / Story', width: 1080, height: 1920, ratio: '9:16', note: 'Full-screen vertical for WhatsApp Status' },
      { label: 'Chat Image', width: 800, height: 800, ratio: '1:1', note: 'Square format for direct messages' },
    ],
  },
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    presets: [
      { label: 'Link Share / Post', width: 1200, height: 630, ratio: '1.91:1', note: 'Standard post & link preview' },
      { label: 'Story / Reel Cover', width: 1080, height: 1920, ratio: '9:16', note: 'Vertical stories & reel covers' },
      { label: 'Square Post', width: 1080, height: 1080, ratio: '1:1', note: 'Square post for feed' },
      { label: 'Event / Cover', width: 1200, height: 628, ratio: '1.91:1', note: 'Event cover photo' },
    ],
  },
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    presets: [
      { label: 'Feed Post (Square)', width: 1080, height: 1080, ratio: '1:1', note: 'Standard square post' },
      { label: 'Feed Post (Portrait)', width: 1080, height: 1350, ratio: '4:5', note: 'Takes up more feed space — recommended' },
      { label: 'Story / Reel', width: 1080, height: 1920, ratio: '9:16', note: 'Full-screen vertical' },
      { label: 'Landscape Post', width: 1080, height: 566, ratio: '1.91:1', note: 'Widescreen, less common' },
    ],
  },
};

// ===== TYPES =====
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
  updated_at?: string;
}

// ===== COMPONENT =====
export const MarketingManager: React.FC = () => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<{ artworkId: string; platform: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadArtworks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchMarketingArtwork();
      setArtworks(data);
    } catch (error) {
      console.error('[MARKETING-ADMIN] Failed to load artwork:', error);
      toast.error('Failed to load marketing artwork');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArtworks();
  }, [loadArtworks]);

  const handleDeleteArtwork = async (id: string) => {
    if (!confirm('Delete this artwork and ALL its platform variants? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteMarketingArtwork(id);
      toast.success('Artwork deleted');
      setArtworks(prev => prev.filter(a => a.id !== id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete artwork');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteVariant = async (artworkId: string, platform: string) => {
    if (!confirm(`Remove the ${platform} variant from this artwork?`)) return;
    setDeletingVariant({ artworkId, platform });
    try {
      await deleteMarketingArtworkVariant(artworkId, platform);
      toast.success(`${platform} variant removed`);
      setArtworks(prev => prev.map(a => {
        if (a.id !== artworkId) return a;
        const remaining = a.variants.filter(v => v.platform !== platform);
        return { ...a, variants: remaining };
      }).filter(a => a.variants.length > 0));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete variant');
    } finally {
      setDeletingVariant(null);
    }
  };

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    loadArtworks();
  };

  const platformBadge = (platform: string) => {
    const spec = PLATFORM_SPECS[platform as PlatformKey];
    if (!spec) return <span className="text-xs text-gray-400">{platform}</span>;
    const Icon = spec.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${spec.bg} ${spec.color} border ${spec.border}`}>
        <Icon className="w-3 h-3" />
        {spec.label}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload promotional artwork for KG partners. Same-title uploads auto-group as platform variants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadArtworks}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload Artwork
          </button>
        </div>
      </div>

      {/* Platform dimension guide */}
      <DimensionGuide />

      {/* Artwork list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading artwork...</span>
        </div>
      ) : artworks.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200/80">
          <Image className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">No marketing artwork uploaded yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Upload Artwork" to add your first promotional image</p>
        </div>
      ) : (
        <div className="space-y-3">
          {artworks.map((artwork) => {
            const isExpanded = expandedId === artwork.id;
            return (
              <div key={artwork.id} className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
                {/* Artwork header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : artwork.id)}
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-100">
                    {artwork.variants[0]?.signed_url ? (
                      <img
                        src={artwork.variants[0].signed_url}
                        alt={artwork.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileImage className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{artwork.title}</h3>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">#{artwork.order}</span>
                    </div>
                    {artwork.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{artwork.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      {artwork.variants.map((v, i) => (
                        <React.Fragment key={`${artwork.id}-badge-${i}`}>
                          {platformBadge(v.platform)}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">
                      {artwork.variants.length} variant{artwork.variants.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteArtwork(artwork.id); }}
                      disabled={deletingId === artwork.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete all variants"
                    >
                      {deletingId === artwork.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded variant details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {artwork.variants.map((variant, idx) => {
                        const spec = PLATFORM_SPECS[variant.platform as PlatformKey];
                        const Icon = spec?.icon || Image;
                        const isDeletingThis = deletingVariant?.artworkId === artwork.id && deletingVariant?.platform === variant.platform;
                        return (
                          <div key={`${artwork.id}-var-${idx}`} className={`bg-white rounded-lg border ${spec?.border || 'border-gray-200'} overflow-hidden`}>
                            {/* Variant image */}
                            <div className="relative aspect-video bg-gray-100 border-b border-gray-100">
                              {variant.signed_url ? (
                                <img
                                  src={variant.signed_url}
                                  alt={`${artwork.title} - ${variant.platform}`}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileImage className="w-8 h-8 text-gray-300" />
                                </div>
                              )}
                              {/* Open in new tab */}
                              {variant.signed_url && (
                                <a
                                  href={variant.signed_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-md hover:bg-white shadow-sm transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                                </a>
                              )}
                            </div>

                            {/* Variant info */}
                            <div className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Icon className={`w-3.5 h-3.5 ${spec?.color || 'text-gray-500'}`} />
                                  <span className="text-xs font-semibold text-gray-800">
                                    {spec?.label || variant.platform}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteVariant(artwork.id, variant.platform); }}
                                  disabled={isDeletingThis}
                                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                  title={`Remove ${variant.platform} variant`}
                                >
                                  {isDeletingThis ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                                <Monitor className="w-3 h-3" />
                                {variant.width} x {variant.height}px
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add variant card */}
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="bg-white rounded-lg border-2 border-dashed border-gray-200 hover:border-gray-300 flex flex-col items-center justify-center min-h-[160px] transition-colors group"
                      >
                        <Plus className="w-6 h-6 text-gray-300 group-hover:text-gray-400 transition-colors" />
                        <span className="text-xs text-gray-400 group-hover:text-gray-500 mt-1.5 font-medium">
                          Add variant
                        </span>
                        <span className="text-[10px] text-gray-300 mt-0.5">
                          Use same title to auto-group
                        </span>
                      </button>
                    </div>

                    <div className="mt-3 text-[11px] text-gray-400 flex items-center gap-4">
                      <span>Created: {new Date(artwork.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {artwork.updated_at && (
                        <span>Updated: {new Date(artwork.updated_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onComplete={handleUploadComplete}
          existingTitles={artworks.map(a => a.title)}
        />
      )}
    </div>
  );
};

// ===== DIMENSION GUIDE (collapsible) =====
const DimensionGuide: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-semibold text-gray-700">Recommended Image Sizes by Platform</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.entries(PLATFORM_SPECS) as [PlatformKey, PlatformSpec][]).map(([key, spec]) => {
              const Icon = spec.icon;
              return (
                <div key={key} className={`rounded-lg border ${spec.border} ${spec.bg} p-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${spec.color}`} />
                    <span className={`text-sm font-semibold ${spec.color}`}>{spec.label}</span>
                  </div>
                  <div className="space-y-2.5">
                    {spec.presets.map((preset, i) => (
                      <div key={i} className="bg-white/70 rounded-md px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-800">{preset.label}</span>
                          <span className="text-[11px] font-mono text-gray-500">{preset.ratio}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[11px] font-mono text-gray-600 font-semibold">{preset.width} x {preset.height}px</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{preset.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-amber-800 font-medium">Pro tips for artwork</p>
                <ul className="text-[11px] text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
                  <li>Upload same title for each platform to auto-group as variants</li>
                  <li>Use PNG for graphics with text, JPG for photos</li>
                  <li>Keep file size under 5MB for fast loading</li>
                  <li>Include your branding but leave space for KG's custom test link overlay</li>
                  <li>Always use <strong>RGB color mode</strong> (not CMYK)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== UPLOAD MODAL =====
interface UploadModalProps {
  onClose: () => void;
  onComplete: () => void;
  existingTitles: string[];
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onComplete, existingTitles }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<PlatformKey>('whatsapp');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [customWidth, setCustomWidth] = useState<number>(0);
  const [customHeight, setCustomHeight] = useState<number>(0);
  const [useCustomDimensions, setUseCustomDimensions] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [detectedWidth, setDetectedWidth] = useState<number>(0);
  const [detectedHeight, setDetectedHeight] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPresets = PLATFORM_SPECS[platform].presets;
  const currentPreset = currentPresets[selectedPreset] || currentPresets[0];

  const finalWidth = useCustomDimensions ? customWidth : (detectedWidth || currentPreset.width);
  const finalHeight = useCustomDimensions ? customHeight : (detectedHeight || currentPreset.height);

  // Title match hint
  const matchingTitle = existingTitles.find(t => t.toLowerCase() === title.toLowerCase());

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP)');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }

    setFile(selectedFile);

    // Generate preview and detect dimensions
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);

      const img = new window.Image();
      img.onload = () => {
        setDetectedWidth(img.naturalWidth);
        setDetectedHeight(img.naturalHeight);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error('Please provide a title and select an image');
      return;
    }

    setIsUploading(true);
    try {
      await uploadMarketingArtwork({
        title: title.trim(),
        description: description.trim(),
        platform,
        width: finalWidth,
        height: finalHeight,
        file,
      });
      toast.success(`Artwork uploaded for ${PLATFORM_SPECS[platform].label}!`);
      onComplete();
    } catch (error: any) {
      console.error('[MARKETING-ADMIN] Upload failed:', error);
      toast.error(error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Dimension match check
  const dimensionMatch = detectedWidth > 0 && detectedHeight > 0
    ? (detectedWidth === currentPreset.width && detectedHeight === currentPreset.height)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Upload Marketing Artwork</h2>
            <p className="text-xs text-gray-500 mt-0.5">Add a new image for KG partners to share</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Artwork Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Foxy Open Day Promo"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
            />
            {matchingTitle && (
              <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Matches existing artwork "{matchingTitle}" — this upload will be added as a new platform variant
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief note about this artwork"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
            />
          </div>

          {/* Platform selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Target Platform <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(PLATFORM_SPECS) as [PlatformKey, PlatformSpec][]).map(([key, spec]) => {
                const Icon = spec.icon;
                const isActive = platform === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setPlatform(key); setSelectedPreset(0); }}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                      isActive
                        ? `${spec.bg} ${spec.border} ${spec.color}`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {spec.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recommended preset */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Recommended Size
            </label>
            <div className="space-y-1.5">
              {currentPresets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => { setSelectedPreset(idx); setUseCustomDimensions(false); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left transition-all ${
                    !useCustomDimensions && selectedPreset === idx
                      ? `${PLATFORM_SPECS[platform].bg} ${PLATFORM_SPECS[platform].border}`
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {!useCustomDimensions && selectedPreset === idx ? (
                      <div className={`w-4 h-4 rounded-full ${PLATFORM_SPECS[platform].bg} border-2 ${PLATFORM_SPECS[platform].border} flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${PLATFORM_SPECS[platform].color === 'text-green-600' ? 'bg-green-600' : PLATFORM_SPECS[platform].color === 'text-blue-600' ? 'bg-blue-600' : 'bg-pink-600'}`} />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                    )}
                    <div>
                      <span className="text-xs font-medium text-gray-800">{preset.label}</span>
                      <span className="text-[10px] text-gray-400 ml-2">{preset.note}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {preset.width} x {preset.height}
                    </span>
                    <span className="text-[10px] text-gray-400">{preset.ratio}</span>
                  </div>
                </button>
              ))}

              {/* Custom dimensions toggle */}
              <button
                onClick={() => {
                  setUseCustomDimensions(!useCustomDimensions);
                  if (!useCustomDimensions && detectedWidth > 0) {
                    setCustomWidth(detectedWidth);
                    setCustomHeight(detectedHeight);
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left transition-all ${
                  useCustomDimensions ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {useCustomDimensions ? (
                    <div className="w-4 h-4 rounded-full bg-gray-200 border-2 border-gray-400 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-gray-600" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className="text-xs font-medium text-gray-600">Custom dimensions</span>
                </div>
              </button>

              {useCustomDimensions && (
                <div className="flex items-center gap-2 pl-7 mt-1">
                  <input
                    type="number"
                    value={customWidth || ''}
                    onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                    placeholder="Width"
                    className="w-24 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                  <span className="text-xs text-gray-400">x</span>
                  <input
                    type="number"
                    value={customHeight || ''}
                    onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                    placeholder="Height"
                    className="w-24 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                  <span className="text-[11px] text-gray-400">px</span>
                </div>
              )}
            </div>
          </div>

          {/* File upload area */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Image File <span className="text-red-400">*</span>
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-400 bg-blue-50/50'
                  : file
                    ? 'border-green-300 bg-green-50/30'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />

              {preview ? (
                <div className="space-y-3">
                  <div className="mx-auto max-w-[280px] max-h-[200px] rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
                    <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-700">{file?.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {(file!.size / 1024).toFixed(0)} KB
                      {detectedWidth > 0 && ` · Detected: ${detectedWidth} x ${detectedHeight}px`}
                    </p>
                    {/* Dimension match indicator */}
                    {!useCustomDimensions && dimensionMatch !== null && (
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        dimensionMatch
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {dimensionMatch ? (
                          <>
                            <Check className="w-3 h-3" />
                            Perfect match for {currentPreset.label}
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" />
                            Size differs from recommended {currentPreset.width}x{currentPreset.height} — image will still work
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview(null);
                      setDetectedWidth(0);
                      setDetectedHeight(0);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-[11px] text-red-500 hover:text-red-600 underline"
                  >
                    Remove & pick another
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-gray-300 mx-auto" />
                  <div>
                    <p className="text-sm text-gray-600 font-medium">
                      Drop an image here or <span className="text-blue-600">browse</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      PNG, JPG or WebP · Max 10MB · Recommended: {currentPreset.width} x {currentPreset.height}px
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-2xl">
          <div className="text-[11px] text-gray-400">
            Uploading for <strong className={PLATFORM_SPECS[platform].color}>{PLATFORM_SPECS[platform].label}</strong>
            {' · '}{finalWidth} x {finalHeight}px
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || !title.trim() || isUploading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Upload Artwork
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
