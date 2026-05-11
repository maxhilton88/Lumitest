import React, { useState, useEffect, useCallback } from 'react';
import { MasterQuestionBank } from './MasterQuestionBank';
import { QuestManager } from '../admin/QuestManager';
import { MarketingManager } from '../admin/MarketingManager';
import { MediaManager } from '../admin/MediaManager';
import { FlashcardManager } from '../admin/FlashcardManager';
import { RPGAssetManager } from '../admin/RPGAssetManager';
import { ShopManager } from '../admin/ShopManager';
import { SkillManager } from '../admin/SkillManager';
import { GoldEconomyManager } from '../admin/GoldEconomyManager';
import { GoldEconomyDashboard } from '../admin/GoldEconomyDashboard';
import { KGDatabaseManager } from '../admin/KGDatabaseManager';
import { PracticeGateManager } from '../admin/PracticeGateManager';
import { FMCGManager } from '../admin/FMCGManager';
import { TaxonomyManager } from '../admin/TaxonomyManager';
import { Question } from '../screens/QuestionScreen';
import { fetchPlatformStats } from '../../utils/api';
import { fetchAllUsers, updateUserAdmin, fetchAdminVideos, createAdminVideo, updateAdminVideo, deleteAdminVideo, uploadVideoThumbnail, deleteUserAdmin, adminAddCurrency, fetchStripeOrders, fetchSeries, saveSeries, deleteSeries, uploadDyntubeVideo, getDyntubeVideoInfo, fetchVideoCategories, saveVideoCategory, deleteVideoCategory, triggerKvToPgMigration, scanKvKeys } from '../../utils/api';
import { toast } from 'sonner@2.0.3';
import { 
  LayoutDashboard, 
  School, 
  BookOpen,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  Map,
  Users,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Download,
  Eye,
  EyeOff,
  Crown,
  UserCircle,
  Copy,
  Shield,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
  Check,
  Play,
  Plus,
  Star,
  Trash2,
  Image,
  ShoppingCart,
  MapPin,
  Package,
  Music,
  Tv,
  Film,
  Upload,
  Info,
  Layers,
  Gamepad2,
  Coins,
  Database,
  Swords,
  Briefcase,
  QrCode,
  FileSpreadsheet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie
} from 'recharts';
import { Pagination } from '../Pagination';

// Types matching server response
interface PlatformOverview {
  total_schools: number;
  total_leads: number;
  completed_assessments: number;
  in_progress: number;
  total_quests: number;
  live_quests: number;
  draft_quests: number;
  total_questions: number;
  leads_by_status: Record<string, number>;
  questions_by_subject: Record<string, number>;
}

interface PlatformSchool {
  id: string;
  school_name: string;
  email: string;
  kindergarten_url: string;
  subscription_tier: string;
  trial_expires_at: string | null;
  created_at: string;
  lead_count: number;
  completed_count: number;
}

interface PlatformLead {
  id: string;
  child_name: string;
  parent_name: string;
  whatsapp: string;
  child_age: number;
  school_id: string;
  status: string;
  score: number;
  total_questions: number;
  quest_results: any[];
  created_at: string;
  updated_at: string;
}

interface SuperAdminDashboardProps {
  onLogout: () => void;
  questionBank: Question[];
  setQuestionBank: (questions: Question[]) => void;
  questConfigs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }>;
  setQuestConfigs: (configs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh', numberOfQuestions: number, skillFilters: string[] }>) => void;
}

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active' },
    founder: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Founder' },
    trial: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Trial' },
    expired: { bg: 'bg-red-50', text: 'text-red-700', label: 'Expired' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
    in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'In Progress' },
    unknown: { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Unknown' },
  };
  const c = config[status] || config.unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ 
  onLogout,
  questionBank,
  setQuestionBank,
  questConfigs,
  setQuestConfigs
}) => {
  const [activeMenu, setActiveMenu] = useState('overview');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['dashboard', 'users', 'content', 'game', 'business', 'system']));
  
  // Real data state
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [recentLeads, setRecentLeads] = useState<PlatformLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Search/filter state
  const [schoolSearch, setSchoolSearch] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all');

  // Leads pagination
  const [leadsPage, setLeadsPage] = useState(1);
  const LEADS_PAGE_SIZE = 25;

  // Users tab state
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersSummary, setUsersSummary] = useState<any>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Add currency state
  const [currencyUserId, setCurrencyUserId] = useState<string | null>(null);
  const [currencyForm, setCurrencyForm] = useState<{ gold: string; xp: string; diamond: string; reason: string }>({ gold: '', xp: '', diamond: '', reason: '' });
  const [isSendingCurrency, setIsSendingCurrency] = useState(false);

  // Videos tab state
  const VIDEO_LANGUAGES = [
    { id: 'en', label: 'English' },
    { id: 'ms', label: 'Bahasa Melayu' },
    { id: 'zh', label: '中文' },
  ];
  const [videoCategories, setVideoCategories] = useState<any[]>([]);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [adminVideos, setAdminVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoForm, setVideoForm] = useState({
    title: '',
    subtitle: '',
    dyntube_key: '',
    thumbnail_url: '',
    category: '',
    language: '',
    duration: '',
    episode: '',
    series_id: '',
    is_premium: false,
    is_featured: false,
    order: 0,
  });
  // Series state
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [showSeriesForm, setShowSeriesForm] = useState(false);
  const [seriesForm, setSeriesForm] = useState({ title: '', description: '', thumbnail: '', category: '', order: 0 });
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [isSavingSeries, setIsSavingSeries] = useState(false);
  const [creatingNewSeries, setCreatingNewSeries] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [videoCategoryFilter, setVideoCategoryFilter] = useState<string>('all');
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const thumbInputRef = React.useRef<HTMLInputElement>(null);
  // DynTube upload state
  const [isUploadingDyntube, setIsUploadingDyntube] = useState(false);
  const [dyntubeUploadProgress, setDyntubeUploadProgress] = useState(0);
  const [dyntubeUploadStatus, setDyntubeUploadStatus] = useState<string>('');
  const dyntubeFileRef = React.useRef<HTMLInputElement>(null);

  // Orders tab state
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [ordersCursor, setOrdersCursor] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async (cursor?: string) => {
    setOrdersLoading(true);
    try {
      const data = await fetchStripeOrders(cursor);
      if (cursor) {
        setOrders(prev => [...prev, ...(data.orders || [])]);
      } else {
        setOrders(data.orders || []);
      }
      setOrdersHasMore(data.has_more);
      setOrdersCursor(data.next_cursor);
    } catch (error) {
      console.error('[SUPER-ADMIN] Failed to load orders:', error);
      toast.error('Failed to load orders.');
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const data = await fetchAdminVideos();
      setAdminVideos(data.videos || []);
    } catch (error) {
      console.error('[SUPER-ADMIN] Failed to load videos:', error);
      toast.error('Failed to load videos.');
    } finally {
      setVideosLoading(false);
    }
  }, []);

  const resetVideoForm = () => {
    setVideoForm({ title: '', subtitle: '', dyntube_key: '', thumbnail_url: '', category: videoCategories[0]?.id || '', language: '', duration: '', episode: '', series_id: '', is_premium: false, is_featured: false, order: 0 });
    setEditingVideoId(null);
    setShowVideoForm(false);
    setThumbPreview(null);
    setCreatingNewSeries(false);
    setNewSeriesTitle('');
    setDyntubeUploadStatus('');
    setDyntubeUploadProgress(0);
    if (thumbInputRef.current) thumbInputRef.current.value = '';
    if (dyntubeFileRef.current) dyntubeFileRef.current.value = '';
  };

  // DynTube upload: send file through our server proxy → DynTube processes it
  const handleDyntubeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file (MP4, MOV, WebM, etc.).');
      return;
    }
    // Edge function body limit ~50MB — warn for large files
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video must be under 50 MB for proxy upload. For larger files, upload via DynTube dashboard and paste the key.');
      return;
    }

    const title = videoForm.title || file.name.replace(/\.[^.]+$/, '');
    setIsUploadingDyntube(true);
    setDyntubeUploadProgress(0);
    setDyntubeUploadStatus('Uploading to DynTube via server...');

    try {
      // Single-step: send file as FormData through our server → DynTube
      setDyntubeUploadStatus('Uploading to DynTube (this may take a moment)...');
      setDyntubeUploadProgress(10);
      const result = await uploadDyntubeVideo(file, title);

      if (!result.success || !result.dyntube_key) {
        throw new Error(result.message || 'DynTube did not return a video key');
      }

      setVideoForm(prev => ({ ...prev, dyntube_key: result.dyntube_key }));
      setDyntubeUploadProgress(100);
      setDyntubeUploadStatus('Upload complete! Video is processing on DynTube.');
      toast.success(`Video uploaded to DynTube! Key: ${result.dyntube_key}`);

      if (result.raw) {
        console.log('[DYNTUBE] Full response:', result.raw);
      }
    } catch (err: any) {
      console.error('[DYNTUBE] Upload failed:', err);
      toast.error(err.message || 'DynTube upload failed.');
      setDyntubeUploadStatus('');
    } finally {
      setIsUploadingDyntube(false);
      if (dyntubeFileRef.current) dyntubeFileRef.current.value = '';
    }
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type & size
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB.');
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setThumbPreview(localUrl);

    setIsUploadingThumb(true);
    try {
      const result = await uploadVideoThumbnail(file);
      // Store the r2: prefixed key (resolved to permanent public URL by server on GET)
      setVideoForm(prev => ({ ...prev, thumbnail_url: result.image_path }));
      // Update preview with permanent R2 public URL
      setThumbPreview(result.public_url || result.signed_url);
      toast.success('Thumbnail uploaded!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload thumbnail.');
      setThumbPreview(null);
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const startEditVideo = (v: any) => {
    setEditingVideoId(v.id);
    setVideoForm({
      title: v.title || '',
      subtitle: v.subtitle || '',
      dyntube_key: v.dyntube_key || '',
      thumbnail_url: v.thumbnail_url || '',
      category: v.category || '',
      language: v.language || '',
      duration: v.duration || '',
      episode: v.episode ? String(v.episode) : '',
      series_id: v.series_id || '',
      is_premium: v.is_premium || false,
      is_featured: v.is_featured || false,
      order: v.order || 0,
    });
    setThumbPreview(v.thumbnail_url || null);
    setCreatingNewSeries(false);
    setNewSeriesTitle('');
    setDyntubeUploadStatus('');
    setDyntubeUploadProgress(0);
    setShowVideoForm(true);
  };

  // Load video categories
  const loadVideoCategories = useCallback(async () => {
    try {
      const data = await fetchVideoCategories();
      setVideoCategories(data || []);
    } catch (err) {
      console.error('[SUPER-ADMIN] Failed to load video categories:', err);
    }
  }, []);

  // Load series
  const loadSeries = useCallback(async () => {
    try {
      const data = await fetchSeries();
      setSeriesList(data || []);
    } catch (err) {
      console.error('[SUPER-ADMIN] Failed to load series:', err);
    }
  }, []);

  const handleSaveSeries = async () => {
    if (!seriesForm.title.trim()) { toast.error('Series title is required.'); return; }
    setIsSavingSeries(true);
    try {
      await saveSeries({
        ...(editingSeriesId ? { id: editingSeriesId } : {}),
        ...seriesForm,
      });
      toast.success(editingSeriesId ? 'Series updated!' : 'Series created!');
      setShowSeriesForm(false);
      setEditingSeriesId(null);
      setSeriesForm({ title: '', description: '', thumbnail: '', category: 'english', order: 0 });
      await loadSeries();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save series.');
    } finally {
      setIsSavingSeries(false);
    }
  };

  const handleDeleteSeries = async (id: string) => {
    if (!confirm('Delete this series? Videos in it will become standalone.')) return;
    try {
      await deleteSeries(id);
      toast.success('Series deleted.');
      await loadSeries();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete series.');
    }
  };

  const handleSaveVideo = async () => {
    if (!videoForm.title || !videoForm.category) {
      toast.error('Title and Category are required.');
      return;
    }
    setIsSavingVideo(true);
    try {
      // If creating a new series inline, create it first
      let seriesId = videoForm.series_id || null;
      if (creatingNewSeries && newSeriesTitle.trim()) {
        const result = await saveSeries({ title: newSeriesTitle.trim(), category: videoForm.category });
        seriesId = result.series?.id || null;
        await loadSeries();
      }
      const payload = {
        ...videoForm,
        series_id: seriesId,
        episode: videoForm.episode ? parseInt(videoForm.episode) : null,
        order: Number(videoForm.order) || 0,
      };
      if (editingVideoId) {
        await updateAdminVideo(editingVideoId, payload);
        toast.success('Video updated!');
      } else {
        await createAdminVideo(payload);
        toast.success('Video created!');
      }
      resetVideoForm();
      await loadVideos();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save video.');
    } finally {
      setIsSavingVideo(false);
    }
  };

  // Video category handlers
  const handleAddVideoCategory = async () => {
    if (!newCatLabel.trim()) return;
    setIsSavingCat(true);
    try {
      await saveVideoCategory({ label: newCatLabel.trim(), order: videoCategories.length });
      toast.success(`Category "${newCatLabel.trim()}" created!`);
      setNewCatLabel('');
      await loadVideoCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category.');
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleDeleteVideoCategory = async (catId: string) => {
    if (!confirm('Delete this category? Videos using it will keep their category value.')) return;
    try {
      await deleteVideoCategory(catId);
      toast.success('Category deleted.');
      await loadVideoCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category.');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Delete this video?')) return;
    try {
      await deleteAdminVideo(videoId);
      toast.success('Video deleted.');
      await loadVideos();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete video.');
    }
  };

  // Load users data
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await fetchAllUsers();
      setAllUsers(data.users || []);
      setUsersSummary(data.summary || null);
    } catch (error) {
      console.error('[SUPER-ADMIN] Failed to load users:', error);
      toast.error('Failed to load users data.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Start editing a user — populate form with current values
  const startEditUser = (u: any) => {
    setEditingUserId(u.id);
    setExpandedUserId(u.id);
    if (u.role === 'parent') {
      setEditForm({
        name: u.name || '',
        child_name: u.child_name || '',
        child_age: u.child_age || '',
        subscription_plan: u.subscription_plan || 'free',
        subscription_status: u.subscription_status || 'free',
        referral_credits: u.referral_credits || 0,
        referral_count: u.referral_count || 0,
        origin_tag: u.origin_tag || '',
        referred_by: u.referred_by || '',
        test_count_today: u.test_count_today || 0,
        watch_count_today: u.watch_count_today || 0,
      });
    } else if (u.role === 'kindergarten') {
      setEditForm({
        school_name: u.school_name || u.name || '',
        kindergarten_url: u.kindergarten_url || '',
        subscription_tier: u.school_tier || 'trial',
      });
    }
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setEditForm({});
  };

  const saveEditUser = async (u: any) => {
    setIsSavingUser(true);
    try {
      // Sanitize: convert empty strings to null for non-text Postgres columns
      // (Postgres rejects "" for uuid, integer, date, jsonb types)
      const sanitized = { ...editForm };
      const nullifyIfEmpty = ['referred_by', 'child_age', 'child_birthdate', 'excluded_subjects',
        'referral_credits', 'referral_count', 'test_count_today', 'watch_count_today',
        'origin_tag',  // UUID column — FK to school_accounts.id
      ];
      for (const field of nullifyIfEmpty) {
        if (field in sanitized && (sanitized[field] === '' || sanitized[field] === undefined)) {
          sanitized[field] = null;
        }
      }
      console.log('[SUPER-ADMIN] Sanitized update payload:', JSON.stringify(sanitized));
      await updateUserAdmin(u.id, u.role, sanitized);
      toast.success(`User ${u.name || u.email} updated successfully!`);
      setEditingUserId(null);
      setEditForm({});
      // Reload users and platform data to reflect changes in both tabs
      await Promise.all([loadUsers(), loadPlatformData()]);
    } catch (error) {
      console.error('[SUPER-ADMIN] Failed to update user:', error);
      toast.error(`Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingUser(false);
    }
  };

  // Delete user handler
  const handleDeleteUser = async (u: any) => {
    setIsDeletingUser(true);
    try {
      await deleteUserAdmin(u.id);
      toast.success(`User ${u.name || u.email} deleted successfully`);
      setDeletingUserId(null);
      setExpandedUserId(null);
      await Promise.all([loadUsers(), loadPlatformData()]);
    } catch (error) {
      console.error('[SUPER-ADMIN] Failed to delete user:', error);
      toast.error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Load platform data
  const loadPlatformData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPlatformStats();
      setOverview(data.overview);
      setSchools(data.schools || []);
      setRecentLeads(data.recent_leads || []);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('[SUPER-ADMIN] Failed to load platform stats:', error);
      toast.error('Failed to load platform data. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatformData();
    loadUsers();
    loadVideos();
    loadOrders();
    loadSeries();
    loadVideoCategories();
  }, [loadPlatformData, loadUsers, loadVideos, loadOrders, loadSeries, loadVideoCategories]);

  // Derived data
  const schoolNameMap = schools.reduce((acc, s) => {
    acc[s.id] = s.school_name;
    return acc;
  }, {} as Record<string, string>);

  const filteredSchools = schools.filter(s =>
    s.school_name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  const filteredLeads = recentLeads.filter(l => {
    const matchesSearch = !leadSearch || 
      l.child_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      l.parent_name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      l.whatsapp.includes(leadSearch);
    const matchesStatus = leadStatusFilter === 'all' || l.status === leadStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Paginate filtered leads
  const totalLeadsPages = Math.ceil(filteredLeads.length / LEADS_PAGE_SIZE);
  const paginatedLeads = filteredLeads.slice(
    (leadsPage - 1) * LEADS_PAGE_SIZE,
    leadsPage * LEADS_PAGE_SIZE
  );

  // Reset to page 1 when search/filter changes
  React.useEffect(() => {
    setLeadsPage(1);
  }, [leadSearch, leadStatusFilter]);

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = !userSearch || 
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Chart data
  const subjectChartData = overview ? Object.entries(overview.questions_by_subject).map(([name, count]) => ({
    name: name.length > 10 ? name.substring(0, 10) + '...' : name,
    fullName: name,
    count,
  })) : [];

  const statusChartData = overview ? Object.entries(overview.leads_by_status).map(([status, count]) => ({
    name: status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  })) : [];

  const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
  };

  // CSV export for leads
  const exportLeadsCSV = () => {
    const headers = ['Child Name', 'Parent Name', 'WhatsApp', 'Age', 'School', 'Status', 'Score', 'Total Questions', 'Date'];
    const rows = filteredLeads.map(l => [
      l.child_name, l.parent_name, l.whatsapp, l.child_age,
      schoolNameMap[l.school_id] || l.school_id,
      l.status, l.score, l.total_questions,
      formatDate(l.updated_at || l.created_at)
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foxy-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredLeads.length} leads`);
  };

  // Grouped sidebar menu
  const menuGroups = [
    {
      group: 'dashboard', groupLabel: 'Dashboard', groupIcon: LayoutDashboard,
      items: [
        { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
      ],
    },
    {
      group: 'users', groupLabel: 'User Management', groupIcon: Users,
      items: [
        { id: 'schools', icon: School, label: 'Schools' },
        { id: 'kg-database', icon: Database, label: 'KG Database' },
        { id: 'parents', icon: UserCircle, label: 'Parents' },
      ],
    },
    {
      group: 'content', groupLabel: 'Content & Curriculum', groupIcon: BookOpen,
      items: [
        { id: 'children', icon: Users, label: 'Assessments' },
        { id: 'islands', icon: Map, label: 'Quest Manager' },
        { id: 'questions', icon: BookOpen, label: 'Question Bank' },
        { id: 'videos', icon: Play, label: 'Video Manager' },
        { id: 'media', icon: Music, label: 'Media Manager' },
        { id: 'flashcards', icon: Layers, label: 'Flashcards' },
        { id: 'taxonomy', icon: FileSpreadsheet, label: 'Skill Taxonomy' },
      ],
    },
    {
      group: 'game', groupLabel: 'Game & Economy', groupIcon: Gamepad2,
      items: [
        { id: 'gold-economy', icon: Coins, label: 'Gold Economy' },
        { id: 'gold-analytics', icon: TrendingUp, label: 'Economy Analytics' },
        { id: 'rpg-assets', icon: Gamepad2, label: 'RPG Assets' },
        { id: 'shop', icon: Package, label: 'Shop Items' },
        { id: 'battle-skills', icon: Swords, label: 'Battle Skills' },
        { id: 'practice-gates', icon: Clock, label: 'Practice Gates' },
      ],
    },
    {
      group: 'business', groupLabel: 'Business', groupIcon: Briefcase,
      items: [
        { id: 'fmcg', icon: QrCode, label: 'FMCG Campaigns' },
        { id: 'marketing', icon: Image, label: 'Marketing' },
        { id: 'orders', icon: ShoppingCart, label: 'Orders' },
        { id: 'billing', icon: CreditCard, label: 'Billing' },
      ],
    },
    {
      group: 'system', groupLabel: 'System', groupIcon: Settings,
      items: [
        { id: 'settings', icon: Settings, label: 'Settings' },
      ],
    },
  ];

  // Flat list for header label lookup
  const allMenuItems = menuGroups.flatMap(g => g.items);

  // Toggle a group open/closed
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // Auto-expand the group containing the active menu item
  useEffect(() => {
    const parentGroup = menuGroups.find(g => g.items.some(i => i.id === activeMenu));
    if (parentGroup && !expandedGroups.has(parentGroup.group)) {
      setExpandedGroups(prev => new Set(prev).add(parentGroup.group));
    }
  }, [activeMenu]);

  return (
    <div className="flex h-screen bg-gray-50/50">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200/80 flex flex-col transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-60'}`}>
        <div className="h-14 flex items-center px-4 border-b border-gray-200/80 justify-between">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">FA</span>
              </div>
              <span className="font-semibold text-gray-900 text-sm">Foxy Adventure</span>
            </div>
          ) : (
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-xs">FA</span>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="px-4 py-3 border-b border-gray-200/80">
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Role</div>
            <div className="text-xs font-semibold text-gray-900">Super Administrator</div>
          </div>
        )}

        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {menuGroups.map((group) => {
            const GroupIcon = group.groupIcon;
            const isExpanded = expandedGroups.has(group.group);
            const hasActiveChild = group.items.some(i => i.id === activeMenu);

            return (
              <div key={group.group}>
                {/* Group header */}
                {isCollapsed ? (
                  /* Collapsed: show a thin divider between groups (skip first) */
                  group.group !== 'dashboard' ? (
                    <div className="mx-2 my-2 border-t border-gray-200/80" />
                  ) : null
                ) : (
                  <button
                    onClick={() => toggleGroup(group.group)}
                    className={`
                      w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all
                      ${hasActiveChild && !isExpanded
                        ? 'text-gray-900 bg-gray-100/70'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <GroupIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{group.groupLabel}</span>
                    </div>
                    <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                )}

                {/* Group items */}
                {(isCollapsed || isExpanded) && (
                  <div className={`${!isCollapsed ? 'mt-0.5 mb-1.5 space-y-0.5' : 'space-y-0.5'}`}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeMenu === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveMenu(item.id)}
                          className={`
                            w-full flex items-center gap-2.5 py-2 rounded-lg text-[13px] font-medium transition-all
                            ${isActive
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                            ${isCollapsed ? 'justify-center px-2.5' : 'pl-7 pr-2.5'}
                          `}
                          title={isCollapsed ? item.label : ''}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          {!isCollapsed && <span>{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-2 border-t border-gray-200/80 space-y-0.5">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <Menu className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Collapse</span>}
          </button>
          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="h-14 bg-white border-b border-gray-200/80 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-semibold text-gray-900">
              {allMenuItems.find(m => m.id === activeMenu)?.label}
            </h1>
            {lastRefreshed && !isLoading && (
              <span className="text-[11px] text-gray-400">
                Updated {formatRelativeTime(lastRefreshed.toISOString())}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPlatformData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {/* ===== OVERVIEW TAB ===== */}
          {activeMenu === 'overview' && (
            <div className="space-y-6">
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Registered Schools', value: overview?.total_schools ?? '—', sub: `${schools.filter(s => s.subscription_tier === 'active').length} active`, icon: School, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Total Leads', value: overview?.total_leads ?? '—', sub: `${overview?.completed_assessments ?? 0} completed`, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Live Quests', value: overview?.live_quests ?? '—', sub: `${overview?.draft_quests ?? 0} drafts`, icon: Map, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Question Bank', value: overview?.total_questions ?? '—', sub: `${subjectChartData.length} subjects`, icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-white rounded-xl border border-gray-200/80 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center`}>
                          <Icon className={`w-4.5 h-4.5 ${stat.color}`} />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">{isLoading ? '...' : stat.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                      <div className="text-[11px] text-gray-400 mt-1">{stat.sub}</div>
                    </div>
                  );
                })}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Questions by Subject */}
                {subjectChartData.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200/80 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Questions by Subject</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={subjectChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                          formatter={(value: number, _name: string, props: any) => [value, props.payload.fullName]}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {subjectChartData.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Lead Status Pie */}
                {statusChartData.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200/80 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Assessment Status</h3>
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie
                            data={statusChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {statusChartData.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {statusChartData.map((item, idx) => (
                          <div key={item.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                              <span className="text-gray-600">{item.name}</span>
                            </div>
                            <span className="font-semibold text-gray-900">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-200/80">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Recent Assessments</h3>
                  <button 
                    onClick={() => setActiveMenu('children')}
                    className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {isLoading ? (
                    <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
                  ) : recentLeads.length === 0 ? (
                    <div className="p-8 text-center">
                      <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No assessments yet</p>
                      <p className="text-xs text-gray-400 mt-1">Leads will appear here when children start taking quests</p>
                    </div>
                  ) : (
                    recentLeads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">{lead.child_name}</span>
                              <span className="text-[11px] text-gray-400">Age {lead.child_age}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500 truncate">
                                {schoolNameMap[lead.school_id] || 'Unknown School'}
                              </span>
                              <span className="text-gray-300">|</span>
                              <span className="text-xs text-gray-400">
                                {lead.parent_name}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            {lead.total_questions > 0 && (
                              <span className="text-xs font-medium text-gray-700">
                                {lead.score}/{lead.total_questions}
                              </span>
                            )}
                            <StatusBadge status={lead.status} />
                            <span className="text-[11px] text-gray-400 w-16 text-right">
                              {formatRelativeTime(lead.updated_at || lead.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Schools */}
              <div className="bg-white rounded-xl border border-gray-200/80">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Registered Schools</h3>
                  <button 
                    onClick={() => setActiveMenu('schools')}
                    className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {isLoading ? (
                    <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
                  ) : schools.length === 0 ? (
                    <div className="p-8 text-center">
                      <School className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No schools registered yet</p>
                    </div>
                  ) : (
                    schools.slice(0, 5).map((school) => (
                      <div key={school.id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{school.school_name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{school.email}</div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">{school.lead_count} leads</div>
                              <div className="text-[11px] text-gray-400">{school.completed_count} completed</div>
                            </div>
                            <StatusBadge status={school.subscription_tier} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== KG DATABASE TAB ===== */}
          {activeMenu === 'kg-database' && (
            <KGDatabaseManager />
          )}

          {/* ===== SCHOOLS TAB ===== */}
          {activeMenu === 'schools' && (() => {
            // Helper: find matching KG auth user for a school
            const findKgUser = (school: PlatformSchool) => allUsers.find(u => u.role === 'kindergarten' && u.school_id === school.id);
            const tierCounts = {
              total: schools.length,
              active: schools.filter(s => s.subscription_tier === 'active').length,
              founder: schools.filter(s => s.subscription_tier === 'founder').length,
              trial: schools.filter(s => s.subscription_tier === 'trial').length,
              expired: schools.filter(s => s.subscription_tier === 'expired').length,
            };
            return (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total Schools', value: tierCounts.total, icon: School, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Active (Paid)', value: tierCounts.active, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Founder', value: tierCounts.founder, icon: Crown, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Trial', value: tierCounts.trial, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Expired', value: tierCounts.expired, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-white rounded-xl border border-gray-200/80 px-4 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <div>
                        <div className="text-lg font-bold text-gray-900">{isLoading ? '...' : stat.value}</div>
                        <div className="text-[11px] text-gray-500">{stat.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Search & Reload */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search schools..."
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 bg-white"
                  />
                </div>
                <button
                  onClick={() => { loadPlatformData(); loadUsers(); }}
                  disabled={isLoading || usersLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 ml-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading || usersLoading ? 'animate-spin' : ''}`} />
                  Reload
                </button>
                <div className="text-xs text-gray-400">{filteredSchools.length} school{filteredSchools.length !== 1 ? 's' : ''}</div>
              </div>

              {/* Table */}
              <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200/80">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">School</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">URL Slug</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tier</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Completed</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-400">Loading...</td></tr>
                    ) : filteredSchools.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-400">{schoolSearch ? 'No matching schools' : 'No schools registered yet'}</td></tr>
                    ) : (
                      filteredSchools.map((school) => {
                        const kgUser = findKgUser(school);
                        const isExpanded = expandedUserId === `school_${school.id}`;
                        const isEditing = editingUserId === `school_${school.id}`;
                        return (
                          <React.Fragment key={school.id}>
                            <tr
                              className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                              onClick={() => setExpandedUserId(isExpanded ? null : `school_${school.id}`)}
                            >
                              <td className="px-4 py-3 text-center">
                                {isExpanded
                                  ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 inline" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-gray-400 inline" />}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-100">
                                    <School className="w-4 h-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{school.school_name}</div>
                                    <div className="text-xs text-gray-500">{school.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                {school.kindergarten_url ? (
                                  <code className="text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{school.kindergarten_url}</code>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3.5">
                                <StatusBadge status={school.subscription_tier} />
                              </td>
                              <td className="px-5 py-3.5 text-right text-sm font-medium text-gray-900">
                                {school.lead_count}
                              </td>
                              <td className="px-5 py-3.5 text-right text-sm text-gray-600">
                                {school.completed_count}
                              </td>
                              <td className="px-5 py-3.5 text-xs text-gray-500">
                                {formatDate(school.created_at)}
                              </td>
                            </tr>

                            {/* Expanded detail row */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={7} className="px-4 py-0">
                                  <div className={`rounded-lg p-4 my-2 border ${isEditing ? 'bg-blue-50/60 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                                    {/* Header row with edit/save controls */}
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <code className="text-gray-400 font-mono text-[10px]">School ID: {school.id}</code>
                                        {kgUser && (
                                          <span className={`text-[10px] font-medium ${kgUser.email_confirmed ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {kgUser.email_confirmed ? 'Email Confirmed' : 'Email Not Confirmed'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {isEditing ? (
                                          <>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); cancelEditUser(); }}
                                              disabled={isSavingUser}
                                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                            >
                                              <X className="w-3 h-3" />
                                              Cancel
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (kgUser) saveEditUser(kgUser);
                                                else toast.error('No matching auth user found for this school. Cannot save.');
                                              }}
                                              disabled={isSavingUser || !kgUser}
                                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                            >
                                              {isSavingUser ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                              {isSavingUser ? 'Saving...' : 'Save Changes'}
                                            </button>
                                          </>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (kgUser) {
                                                  setEditingUserId(`school_${school.id}`);
                                                  setEditForm({
                                                    school_name: school.school_name || '',
                                                    kindergarten_url: school.kindergarten_url || '',
                                                    subscription_tier: school.subscription_tier || 'trial',
                                                    trial_expires_at: (school as any).trial_expires_at || '',
                                                  });
                                                } else {
                                                  toast.error('No matching auth user found. This school may need to be re-synced.');
                                                }
                                              }}
                                              disabled={!kgUser}
                                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
                                            >
                                              <Pencil className="w-3 h-3" />
                                              Edit School
                                            </button>
                                            {kgUser && (
                                              deletingUserId === `school_${school.id}` ? (
                                                <div className="flex items-center gap-1.5">
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setDeletingUserId(null); }}
                                                    disabled={isDeletingUser}
                                                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                                  >
                                                    Cancel
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteUser(kgUser); }}
                                                    disabled={isDeletingUser}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                                                  >
                                                    {isDeletingUser ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                    {isDeletingUser ? 'Deleting...' : 'Confirm Delete'}
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); setDeletingUserId(`school_${school.id}`); }}
                                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                  Delete
                                                </button>
                                              )
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* EDIT MODE */}
                                    {isEditing ? (
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <div>
                                          <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">School Name</label>
                                          <input
                                            type="text"
                                            value={editForm.school_name || ''}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, school_name: e.target.value }))}
                                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">URL Slug</label>
                                          <input
                                            type="text"
                                            value={editForm.kindergarten_url || ''}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, kindergarten_url: e.target.value }))}
                                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">
                                            Subscription Tier
                                            <Crown className="w-3 h-3 text-amber-500 inline ml-1" />
                                          </label>
                                          <select
                                            value={editForm.subscription_tier || 'trial'}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, subscription_tier: e.target.value }))}
                                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white appearance-none cursor-pointer"
                                          >
                                            <option value="trial">Trial</option>
                                            <option value="active">Active (Paid)</option>
                                            <option value="founder">Founder Club (Free Unlimited)</option>
                                            <option value="expired">Expired</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">
                                            Trial Expires At
                                          </label>
                                          <input
                                            type="date"
                                            value={editForm.trial_expires_at ? editForm.trial_expires_at.split('T')[0] : ''}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setEditForm(prev => ({
                                                ...prev,
                                                trial_expires_at: val ? new Date(val + 'T23:59:59Z').toISOString() : '',
                                              }));
                                            }}
                                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                          />
                                          <div className="flex gap-1 mt-1">
                                            {[1, 3, 6, 12].map(m => (
                                              <button
                                                key={m}
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const d = new Date();
                                                  d.setMonth(d.getMonth() + m);
                                                  setEditForm(prev => ({ ...prev, trial_expires_at: d.toISOString() }));
                                                }}
                                                className="px-1.5 py-0.5 text-[9px] bg-purple-50 text-purple-600 rounded hover:bg-purple-100"
                                              >
                                                +{m}mo
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        <div>
                                          <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">School ID</label>
                                          <code className="block px-2.5 py-1.5 text-[11px] text-gray-500 bg-gray-100 rounded-lg font-mono break-all">{school.id}</code>
                                        </div>
                                      </div>
                                    ) : (
                                      /* VIEW MODE */
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                        <div>
                                          <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">School ID</div>
                                          <code className="text-gray-600 font-mono text-[11px] break-all">{school.id}</code>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Auth User ID</div>
                                          <code className="text-gray-600 font-mono text-[11px] break-all">{kgUser?.id || '—'}</code>
                                        </div>
                                        <div>
                                          <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Subscription Tier</div>
                                          <StatusBadge status={school.subscription_tier} />
                                          {school.trial_expires_at && (
                                            <div className={`text-[10px] mt-1 ${new Date(school.trial_expires_at) > new Date() ? 'text-emerald-600' : 'text-red-500'}`}>
                                              Trial {new Date(school.trial_expires_at) > new Date() ? 'expires' : 'expired'} {new Date(school.trial_expires_at).toLocaleDateString()}
                                            </div>
                                          )}
                                        </div>
                                        <div>
                                          <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Last Sign-In</div>
                                          <span className="text-gray-700 font-medium">{kgUser?.last_sign_in_at ? formatRelativeTime(kgUser.last_sign_in_at) : 'Never'}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
            );
          })()}

          {/* ===== ASSESSMENTS / CHILDREN TAB ===== */}
          {activeMenu === 'children' && (
            <div className="space-y-4">
              {/* Filters bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search child, parent, or phone..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 bg-white"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {['all', 'completed', 'in_progress'].map(status => (
                    <button
                      key={status}
                      onClick={() => setLeadStatusFilter(status)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        leadStatusFilter === status
                          ? 'bg-gray-900 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : 'Completed'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={exportLeadsCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ml-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>

                <div className="text-xs text-gray-400">{filteredLeads.length} record{filteredLeads.length !== 1 ? 's' : ''}</div>
              </div>

              {/* Stats summary */}
              {overview && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200/80 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">{overview.completed_assessments}</div>
                      <div className="text-[11px] text-gray-500">Completed</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200/80 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">{overview.in_progress}</div>
                      <div className="text-[11px] text-gray-500">In Progress</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200/80 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        {overview.total_leads > 0 ? Math.round((overview.completed_assessments / overview.total_leads) * 100) : 0}%
                      </div>
                      <div className="text-[11px] text-gray-500">Completion Rate</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200/80">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Child</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Parent / Phone</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">School</th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Age</th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Quests</th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Last Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td colSpan={8} className="p-8 text-center text-sm text-gray-400">Loading...</td></tr>
                    ) : filteredLeads.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-sm text-gray-400">{leadSearch ? 'No matching assessments' : 'No assessments yet'}</td></tr>
                    ) : (
                      paginatedLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="text-sm font-medium text-gray-900">{lead.child_name}</div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="text-sm text-gray-700">{lead.parent_name}</div>
                            <div className="text-xs text-gray-400">{lead.whatsapp}</div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-xs text-gray-600">{schoolNameMap[lead.school_id] || lead.school_id.substring(0, 8) + '...'}</span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="text-sm text-gray-900">{lead.child_age}</span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            {lead.total_questions > 0 ? (
                              <span className="text-sm font-medium text-gray-900">
                                {lead.score}/{lead.total_questions}
                                <span className="text-xs text-gray-400 ml-1">
                                  ({Math.round((lead.score / lead.total_questions) * 100)}%)
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="text-xs text-gray-600">{lead.quest_results?.length || 0}</span>
                          </td>
                          <td className="px-5 py-3 text-center">
                            <StatusBadge status={lead.status} />
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-xs text-gray-500">{formatRelativeTime(lead.updated_at || lead.created_at)}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-2">
                <Pagination
                  currentPage={leadsPage}
                  totalPages={totalLeadsPages}
                  totalItems={filteredLeads.length}
                  pageSize={LEADS_PAGE_SIZE}
                  onPageChange={setLeadsPage}
                  itemLabel="assessments"
                />
              </div>
            </div>
          )}

          {/* ===== QUESTION BANK TAB ===== */}
          {activeMenu === 'questions' && (
            <MasterQuestionBank />
          )}

          {/* ===== QUEST MANAGER TAB ===== */}
          {activeMenu === 'islands' && (
            <div className="-m-6">
              <QuestManager
                questConfigs={questConfigs}
                setQuestConfigs={setQuestConfigs}
              />
            </div>
          )}

          {/* ===== VIDEO MANAGER TAB ===== */}
          {activeMenu === 'videos' && (
            <div className="space-y-4">
              {/* Header bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Video Manager</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {adminVideos.length} videos &middot; {seriesList.length} series &middot; {videoCategories.length} categories
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { loadVideos(); loadSeries(); loadVideoCategories(); }}
                    disabled={videosLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${videosLoading ? 'animate-spin' : ''}`} />
                    Reload
                  </button>
                  <button
                    onClick={() => { resetVideoForm(); setShowVideoForm(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Video
                  </button>
                </div>
              </div>

              {/* Category Management + Filter */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-900">Categories ({videoCategories.length})</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      placeholder="New category name..."
                      className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 w-40"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddVideoCategory()}
                    />
                    <button
                      onClick={handleAddVideoCategory}
                      disabled={!newCatLabel.trim() || isSavingCat}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                </div>
                {videoCategories.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setVideoCategoryFilter('all')}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${videoCategoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      All ({adminVideos.length})
                    </button>
                    {videoCategories.map(cat => {
                      const count = adminVideos.filter(v => v.category === cat.id).length;
                      return (
                        <div key={cat.id} className="flex items-center gap-0.5">
                          <button
                            onClick={() => setVideoCategoryFilter(cat.id)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${videoCategoryFilter === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {cat.label} ({count})
                          </button>
                          <button
                            onClick={() => handleDeleteVideoCategory(cat.id)}
                            className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                            title="Delete category"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400">No categories yet. Add one above to get started.</p>
                )}
              </div>

              {/* Series quick reference */}
              {seriesList.length > 0 && (
                <div className="bg-white border border-gray-200/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Tv className="w-4 h-4 text-purple-600" />
                      <h4 className="text-xs font-semibold text-gray-900">Series ({seriesList.length})</h4>
                    </div>
                    <button
                      onClick={() => {
                        setShowSeriesForm(!showSeriesForm);
                        setEditingSeriesId(null);
                        setSeriesForm({ title: '', description: '', thumbnail: '', category: '', order: 0 });
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Manage
                    </button>
                  </div>
                  {showSeriesForm && (
                    <div className="mb-3 p-3 bg-purple-50/50 border border-purple-200 rounded-lg space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input type="text" value={seriesForm.title} onChange={(e) => setSeriesForm({ ...seriesForm, title: e.target.value })} placeholder="Series title *" className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-200" />
                        <input type="text" value={seriesForm.description} onChange={(e) => setSeriesForm({ ...seriesForm, description: e.target.value })} placeholder="Short description" className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-200" />
                        <select value={seriesForm.category} onChange={(e) => setSeriesForm({ ...seriesForm, category: e.target.value })} className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-purple-200">
                          <option value="">— Category —</option>
                          {videoCategories.map(cat => (<option key={cat.id} value={cat.id}>{cat.label}</option>))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="text" value={seriesForm.thumbnail} onChange={(e) => setSeriesForm({ ...seriesForm, thumbnail: e.target.value })} placeholder="Poster art URL (optional)" className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-200" />
                        <button onClick={handleSaveSeries} disabled={isSavingSeries || !seriesForm.title.trim()} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors">
                          {isSavingSeries ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          {editingSeriesId ? 'Update' : 'Create'}
                        </button>
                        <button onClick={() => { setShowSeriesForm(false); setEditingSeriesId(null); }} className="p-1.5 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {seriesList.map((s: any) => {
                      const epCount = adminVideos.filter((v: any) => v.series_id === s.id).length;
                      return (
                        <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
                          {s.thumbnail && <img src={s.thumbnail} alt="" className="w-6 h-6 rounded object-cover" />}
                          <span className="text-xs font-medium text-purple-900">{s.title}</span>
                          <span className="text-[10px] text-purple-600">{epCount} ep</span>
                          <button onClick={() => { setEditingSeriesId(s.id); setSeriesForm({ title: s.title, description: s.description || '', thumbnail: s.thumbnail || '', category: s.category || '', order: s.order || 0 }); setShowSeriesForm(true); }} className="p-0.5 text-purple-400 hover:text-purple-700"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => handleDeleteSeries(s.id)} className="p-0.5 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Video form (add/edit) */}
              {showVideoForm && (
                <div className="bg-white border border-gray-200/80 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {editingVideoId ? 'Edit Video' : 'Add New Video'}
                    </h3>
                    <button onClick={resetVideoForm} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                      <input
                        type="text"
                        value={videoForm.title}
                        onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                        placeholder="e.g. The Magic Alphabet"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Subtitle</label>
                      <input
                        type="text"
                        value={videoForm.subtitle}
                        onChange={(e) => setVideoForm({ ...videoForm, subtitle: e.target.value })}
                        placeholder="e.g. Learn the ABCs with Foxy"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Category *</label>
                      <select
                        value={videoForm.category}
                        onChange={(e) => setVideoForm({ ...videoForm, category: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
                      >
                        <option value="">— Select category —</option>
                        {videoCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
                      <select
                        value={videoForm.language}
                        onChange={(e) => setVideoForm({ ...videoForm, language: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
                      >
                        <option value="">— Any / Not set —</option>
                        {VIDEO_LANGUAGES.map(lang => (
                          <option key={lang.id} value={lang.id}>{lang.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Series</label>
                      <select
                        value={creatingNewSeries ? '__new__' : videoForm.series_id}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setCreatingNewSeries(true);
                            setVideoForm({ ...videoForm, series_id: '' });
                          } else {
                            setCreatingNewSeries(false);
                            setNewSeriesTitle('');
                            setVideoForm({ ...videoForm, series_id: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
                      >
                        <option value="">— Standalone (no series) —</option>
                        {seriesList.map(s => (
                          <option key={s.id} value={s.id}>{s.title}</option>
                        ))}
                        <option value="__new__">+ Create new series...</option>
                      </select>
                      {creatingNewSeries && (
                        <input
                          type="text"
                          value={newSeriesTitle}
                          onChange={(e) => setNewSeriesTitle(e.target.value)}
                          placeholder="New series title..."
                          className="w-full mt-1.5 px-3 py-1.5 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 bg-purple-50/30"
                          autoFocus
                        />
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">Link to a series for episodic content. Standalone = appears in Films or category rows.</p>
                    </div>

                    {/* Video Source — DynTube only */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-2">Video Source — DynTube HLS</label>

                      <div className={`p-4 rounded-xl border-2 transition-colors ${videoForm.dyntube_key ? 'border-indigo-400 bg-indigo-50/60' : 'border-gray-200 bg-gray-50/30'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                              <Film className="w-4 h-4 text-indigo-600" />
                            </div>
                            <span className="text-xs font-bold text-gray-900">DynTube — HLS Streaming</span>
                          </div>
                          {videoForm.dyntube_key && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                              <CheckCircle2 className="w-3 h-3" /> Connected
                            </span>
                          )}
                        </div>

                        <input ref={dyntubeFileRef} type="file" accept="video/*" onChange={handleDyntubeUpload} className="hidden" id="dyntube-file-upload" />

                        {!videoForm.dyntube_key && !isUploadingDyntube && (
                          <label htmlFor="dyntube-file-upload" className="flex items-center justify-center gap-2 w-full px-4 py-4 border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors mb-3">
                            <Upload className="w-5 h-5 text-indigo-500" />
                            <span className="text-sm font-medium text-indigo-700">Click to upload video file</span>
                            <span className="text-[10px] text-gray-400 ml-1">(MP4, MOV, WebM — max 5 GB)</span>
                          </label>
                        )}

                        {isUploadingDyntube && (
                          <div className="mb-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                              <span className="text-xs text-indigo-700 font-medium">{dyntubeUploadStatus}</span>
                            </div>
                            <div className="w-full bg-indigo-100 rounded-full h-2">
                              <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300" style={{ width: `${dyntubeUploadProgress}%` }} />
                            </div>
                          </div>
                        )}

                        {!isUploadingDyntube && dyntubeUploadStatus && (
                          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                            <span className="text-[11px] text-green-700">{dyntubeUploadStatus}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <input type="text" value={videoForm.dyntube_key} onChange={(e) => setVideoForm({ ...videoForm, dyntube_key: e.target.value })} placeholder="DynTube video key (auto-filled after upload, or paste manually)" className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono" />
                          </div>
                          {videoForm.dyntube_key && (
                            <button type="button" onClick={() => { setVideoForm(prev => ({ ...prev, dyntube_key: '' })); setDyntubeUploadStatus(''); setDyntubeUploadProgress(0); }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Clear DynTube key">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {videoForm.dyntube_key && (
                          <p className="text-[10px] text-indigo-500 mt-1 flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            HLS stream: https://...dyntube.com/{videoForm.dyntube_key}/playlist.m3u8
                          </p>
                        )}
                        {!videoForm.dyntube_key && (
                          <p className="text-[10px] text-gray-400 mt-1">Upload a video file above, or paste a DynTube key if you uploaded via the DynTube dashboard.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Thumbnail</label>
                      <div className="flex items-start gap-3">
                        {/* Upload area */}
                        <div className="flex-1">
                          <input
                            ref={thumbInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleThumbUpload}
                            className="hidden"
                            id="thumb-upload"
                          />
                          <label
                            htmlFor="thumb-upload"
                            className={`flex items-center justify-center gap-2 w-full px-3 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                              isUploadingThumb ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            {isUploadingThumb ? (
                              <span className="text-xs text-blue-600 flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Uploading...
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                📁 Click to upload image (max 5 MB)
                              </span>
                            )}
                          </label>
                          <p className="text-[10px] text-gray-400 mt-1">Or paste a thumbnail URL below.</p>
                          <input
                            type="text"
                            value={(videoForm.thumbnail_url.startsWith('video-thumbnails/') || videoForm.thumbnail_url.startsWith('r2:')) ? '' : videoForm.thumbnail_url}
                            onChange={(e) => {
                              setVideoForm({ ...videoForm, thumbnail_url: e.target.value });
                              setThumbPreview(e.target.value || null);
                            }}
                            placeholder="https://example.com/thumbnail.jpg"
                            className="w-full mt-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          />
                        </div>
                        {/* Preview */}
                        {thumbPreview && (
                          <div className="relative flex-shrink-0">
                            <img
                              src={thumbPreview}
                              alt="Preview"
                              className="w-24 h-16 rounded-lg object-cover border border-gray-200 bg-gray-50"
                            />
                            <button
                              onClick={() => {
                                setThumbPreview(null);
                                setVideoForm(prev => ({ ...prev, thumbnail_url: '' }));
                                if (thumbInputRef.current) thumbInputRef.current.value = '';
                              }}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm hover:bg-red-600"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                      <input
                        type="text"
                        value={videoForm.duration}
                        onChange={(e) => setVideoForm({ ...videoForm, duration: e.target.value })}
                        placeholder="e.g. 4:32"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                      <p className="text-[10px] text-gray-400 mt-0.5">Enter duration manually (e.g. 4:32 or 1:05:00).</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Episode #</label>
                      <input
                        type="number"
                        value={videoForm.episode}
                        onChange={(e) => setVideoForm({ ...videoForm, episode: e.target.value })}
                        placeholder="e.g. 1"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Sort Order</label>
                      <input
                        type="number"
                        value={videoForm.order}
                        onChange={(e) => setVideoForm({ ...videoForm, order: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <div className="flex items-center gap-4 pt-5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_premium"
                          checked={videoForm.is_premium}
                          onChange={(e) => setVideoForm({ ...videoForm, is_premium: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <label htmlFor="is_premium" className="text-xs font-medium text-gray-700 flex items-center gap-1">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          Premium Only
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_featured"
                          checked={videoForm.is_featured}
                          onChange={(e) => setVideoForm({ ...videoForm, is_featured: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <label htmlFor="is_featured" className="text-xs font-medium text-gray-700 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-500" />
                          Featured (Hero Banner)
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button onClick={resetVideoForm} className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveVideo}
                      disabled={isSavingVideo}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {isSavingVideo ? 'Saving...' : editingVideoId ? 'Update Video' : 'Create Video'}
                    </button>
                  </div>
                </div>
              )}

              {/* Video table */}
              <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
                {videosLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">Loading videos...</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200/60">
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">#</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Title</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Source</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Category</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Lang</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Series / Ep</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Duration</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Tier</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(videoCategoryFilter === 'all' ? adminVideos : adminVideos.filter(v => v.category === videoCategoryFilter)).length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-gray-400 text-xs">
                            No videos found. Click "Add Video" to create one.
                          </td>
                        </tr>
                      ) : (
                        (videoCategoryFilter === 'all' ? adminVideos : adminVideos.filter(v => v.category === videoCategoryFilter)).map((v, idx) => {
                          const catLabel = videoCategories.find(c => c.id === v.category)?.label || v.category || '—';
                          const seriesName = v.series_id ? seriesList.find((s: any) => s.id === v.series_id)?.title : null;
                          const hasDyntube = !!v.dyntube_key;
                          const langLabel = VIDEO_LANGUAGES.find(l => l.id === v.language)?.label || '';
                          return (
                            <tr key={v.id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-xs text-gray-400">{v.order || idx + 1}</td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  {v.thumbnail_url && (
                                    <img src={v.thumbnail_url} alt="" className="w-10 h-6 rounded object-cover bg-gray-100" />
                                  )}
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-medium text-gray-900 truncate max-w-[180px]">{v.title}</p>
                                      {v.is_featured && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-yellow-100 text-yellow-700 whitespace-nowrap">
                                          <Star className="w-2.5 h-2.5" /> Featured
                                        </span>
                                      )}
                                    </div>
                                    {v.subtitle && <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{v.subtitle}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {hasDyntube ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">
                                    <Film className="w-3 h-3" /> DynTube
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">None</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                                  {catLabel}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                {langLabel ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                                    {langLabel}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {seriesName ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700">
                                      <Tv className="w-3 h-3" /> {seriesName}
                                    </span>
                                    {v.episode && <span className="text-[10px] text-gray-500 ml-1">Ep {v.episode}</span>}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-gray-400">{v.episode ? `Ep ${v.episode}` : 'Standalone'}</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">{v.duration || '—'}</td>
                              <td className="px-4 py-2.5">
                                {v.is_premium ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                                    <Crown className="w-3 h-3" /> Premium
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400">Free</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => startEditVideo(v)}
                                    className="p-1 rounded hover:bg-gray-100 transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteVideo(v.id)}
                                    className="p-1 rounded hover:bg-red-50 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ===== MEDIA MANAGER TAB (Audio + Categories) ===== */}
          {activeMenu === 'media' && (
            <MediaManager />
          )}

          {/* ===== FLASHCARD MANAGER TAB ===== */}
          {activeMenu === 'flashcards' && (
            <FlashcardManager />
          )}

          {/* ===== SKILL TAXONOMY TAB ===== */}
          {activeMenu === 'taxonomy' && (
            <TaxonomyManager />
          )}

          {/* ===== GOLD ECONOMY TAB ===== */}
          {activeMenu === 'gold-economy' && (
            <GoldEconomyManager />
          )}

          {/* ===== ECONOMY ANALYTICS TAB ===== */}
          {activeMenu === 'gold-analytics' && (
            <GoldEconomyDashboard />
          )}

          {/* ===== RPG ASSET MANAGER TAB ===== */}
          {activeMenu === 'rpg-assets' && (
            <RPGAssetManager />
          )}

          {/* ===== SHOP ITEM MANAGER TAB ===== */}
          {activeMenu === 'shop' && (
            <ShopManager />
          )}

          {/* ===== BATTLE SKILLS TAB ===== */}
          {activeMenu === 'battle-skills' && (
            <SkillManager />
          )}

          {/* ===== PRACTICE GATES TAB ===== */}
          {activeMenu === 'practice-gates' && (
            <PracticeGateManager />
          )}

          {/* ===== FMCG CAMPAIGNS TAB ===== */}
          {activeMenu === 'fmcg' && (
            <FMCGManager />
          )}

          {/* ===== MARKETING TAB ===== */}
          {activeMenu === 'marketing' && (
            <MarketingManager />
          )}

          {/* ===== ORDERS TAB ===== */}
          {activeMenu === 'orders' && (
            <div className="space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Stripe Orders</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    All completed checkout sessions with billing & shipping addresses
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search name, email..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </div>
                  <button
                    onClick={() => loadOrders()}
                    disabled={ordersLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => {
                      const headers = ['Date', 'Email', 'Name', 'Plan', 'Amount', 'Billing Address', 'Shipping Address'];
                      const filteredOrders = orders.filter(o => {
                        if (!orderSearch) return true;
                        const q = orderSearch.toLowerCase();
                        return (o.email?.toLowerCase().includes(q) || o.name?.toLowerCase().includes(q) || o.plan?.toLowerCase().includes(q));
                      });
                      const rows = filteredOrders.map((o: any) => [
                        formatDate(o.created_at),
                        o.email,
                        o.name,
                        o.plan,
                        `${o.currency} ${o.amount_total.toFixed(2)}`,
                        o.billing_address || '—',
                        o.shipping_address || '—',
                      ]);
                      const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `foxy-orders-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`Exported ${filteredOrders.length} orders`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200/80 p-4">
                  <div className="text-xs text-gray-500 mb-1">Total Orders</div>
                  <div className="text-xl font-bold text-gray-900">{orders.length}{ordersHasMore ? '+' : ''}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 p-4">
                  <div className="text-xs text-gray-500 mb-1">Plan A</div>
                  <div className="text-xl font-bold text-blue-600">{orders.filter(o => o.plan === 'A').length}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 p-4">
                  <div className="text-xs text-gray-500 mb-1">Plan B</div>
                  <div className="text-xl font-bold text-purple-600">{orders.filter(o => o.plan === 'B').length}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 p-4">
                  <div className="text-xs text-gray-500 mb-1">KG Pro</div>
                  <div className="text-xl font-bold text-emerald-600">{orders.filter(o => o.plan === 'kg_pro').length}</div>
                </div>
              </div>

              {/* Orders table */}
              <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
                {ordersLoading && orders.length === 0 ? (
                  <div className="p-12 text-center">
                    <RefreshCw className="w-6 h-6 text-gray-300 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Loading orders from Stripe...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="p-12 text-center">
                    <ShoppingCart className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No paid orders yet</p>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-200/80">
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Billing Address</th>
                          <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Shipping</th>
                          <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {orders
                          .filter(o => {
                            if (!orderSearch) return true;
                            const q = orderSearch.toLowerCase();
                            return (o.email?.toLowerCase().includes(q) || o.name?.toLowerCase().includes(q) || o.plan?.toLowerCase().includes(q));
                          })
                          .map((order: any) => {
                            const isExpanded = expandedOrderId === order.id;
                            const planLabel = order.plan === 'A' ? 'Plan A' : order.plan === 'B' ? 'Plan B' : order.plan === 'kg_pro' ? 'KG Pro' : order.plan;
                            const planColor = order.plan === 'A' ? 'bg-blue-50 text-blue-700' : order.plan === 'B' ? 'bg-purple-50 text-purple-700' : order.plan === 'kg_pro' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600';
                            return (
                              <React.Fragment key={order.id}>
                                <tr
                                  className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                >
                                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(order.created_at)}</td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{order.name}</div>
                                    <div className="text-xs text-gray-400 truncate max-w-[180px]">{order.email}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${planColor}`}>
                                      {planLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
                                    {order.currency} {order.amount_total.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {order.billing_address ? (
                                      <div className="flex items-start gap-1.5 max-w-[220px]">
                                        <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                                        <span className="text-xs text-gray-600 line-clamp-2">{order.billing_address}</span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {order.shipping_address ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                                        <Package className="w-3 h-3" />
                                        Yes
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} className="bg-gray-50/80 px-6 py-4 border-b border-gray-200/60">
                                      <div className="grid grid-cols-2 gap-6">
                                        {/* Billing details */}
                                        <div>
                                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Billing Address</h4>
                                          {order.billing_raw ? (
                                            <div className="text-xs text-gray-700 space-y-0.5">
                                              <div>{order.name}</div>
                                              {order.billing_raw.line1 && <div>{order.billing_raw.line1}</div>}
                                              {order.billing_raw.line2 && <div>{order.billing_raw.line2}</div>}
                                              <div>{[order.billing_raw.city, order.billing_raw.state, order.billing_raw.postal_code].filter(Boolean).join(', ')}</div>
                                              <div>{order.billing_raw.country}</div>
                                            </div>
                                          ) : (
                                            <p className="text-xs text-gray-400 italic">No billing address collected</p>
                                          )}
                                          {order.phone && order.phone !== '—' && (
                                            <div className="mt-2 text-xs text-gray-500">Phone: {order.phone}</div>
                                          )}
                                        </div>

                                        {/* Shipping details */}
                                        <div>
                                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Shipping Address</h4>
                                          {order.shipping_raw ? (
                                            <div className="text-xs text-gray-700 space-y-0.5">
                                              {order.shipping_name && <div className="font-medium">{order.shipping_name}</div>}
                                              {order.shipping_raw.line1 && <div>{order.shipping_raw.line1}</div>}
                                              {order.shipping_raw.line2 && <div>{order.shipping_raw.line2}</div>}
                                              <div>{[order.shipping_raw.city, order.shipping_raw.state, order.shipping_raw.postal_code].filter(Boolean).join(', ')}</div>
                                              <div>{order.shipping_raw.country}</div>
                                            </div>
                                          ) : (
                                            <p className="text-xs text-gray-400 italic">No shipping address (Plan A — digital only)</p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Line items */}
                                      {order.items && order.items.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-gray-200/60">
                                          <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Line Items</h4>
                                          <div className="space-y-1">
                                            {order.items.map((item: any, idx: number) => (
                                              <div key={idx} className="flex items-center justify-between text-xs">
                                                <span className="text-gray-700">{item.description} × {item.quantity}</span>
                                                <span className="text-gray-900 font-medium">{item.currency} {item.amount.toFixed(2)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Stripe ID */}
                                      <div className="mt-3 pt-2 border-t border-gray-200/60 flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400 font-mono">{order.id}</span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(order.id); toast.success('Session ID copied'); }}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          <Copy className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>

                    {/* Load more */}
                    {ordersHasMore && (
                      <div className="px-5 py-3 border-t border-gray-100 text-center">
                        <button
                          onClick={() => ordersCursor && loadOrders(ordersCursor)}
                          disabled={ordersLoading}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          {ordersLoading ? 'Loading...' : 'Load more orders'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ===== BILLING TAB ===== */}
          {activeMenu === 'billing' && (
            <div className="space-y-6">
              {/* Revenue Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200/80 p-5">
                  <div className="text-xs text-gray-500 mb-1">Active Subscriptions</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {schools.filter(s => s.subscription_tier === 'active').length}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">of {schools.length} schools</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 p-5">
                  <div className="text-xs text-gray-500 mb-1">Trial Accounts</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {schools.filter(s => s.subscription_tier === 'trial').length}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">awaiting conversion</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200/80 p-5">
                  <div className="text-xs text-gray-500 mb-1">Est. Annual Revenue</div>
                  <div className="text-2xl font-bold text-gray-900">
                    RM{(schools.filter(s => s.subscription_tier === 'active').length * 356).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">at RM356/school/year</div>
                </div>
              </div>

              {/* Pricing Config */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Pricing Configuration</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Annual Price</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">RM</span>
                      <input type="number" defaultValue={356} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Trial Days</label>
                    <input type="number" defaultValue={14} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                  </div>
                </div>
                <button className="mt-4 px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                  Save Changes
                </button>
              </div>

              {/* School Subscription Table */}
              <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">School Subscriptions</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200/80">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">School</th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tier</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {schools.length === 0 ? (
                      <tr><td colSpan={4} className="p-6 text-center text-sm text-gray-400">No schools yet</td></tr>
                    ) : (
                      schools.map(school => (
                        <tr key={school.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3">
                            <div className="text-sm font-medium text-gray-900">{school.school_name}</div>
                            <div className="text-xs text-gray-400">{school.email}</div>
                          </td>
                          <td className="px-5 py-3"><StatusBadge status={school.subscription_tier} /></td>
                          <td className="px-5 py-3 text-right text-sm text-gray-700">{school.lead_count}</td>
                          <td className="px-5 py-3 text-xs text-gray-500">{formatDate(school.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== SETTINGS TAB ===== */}
          {activeMenu === 'settings' && (
            <div className="max-w-2xl">
              <div className="bg-white border border-gray-200/80 rounded-xl p-5 space-y-5">
                <h3 className="text-sm font-semibold text-gray-900">Platform Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Platform Name</label>
                    <input type="text" defaultValue="Foxy Adventure" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Support Email</label>
                    <input type="email" defaultValue="support@foxyadventure.com" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Age Range</label>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue={4} className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                      <span className="text-sm text-gray-400">to</span>
                      <input type="number" defaultValue={7} className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                      <span className="text-xs text-gray-400">years old</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button className="px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
                    Save Settings
                  </button>
                </div>
              </div>

              {/* KV → PG Data Migration */}
              <div className="bg-white border border-blue-200 rounded-xl p-5 mt-6">
                <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  KV → Postgres Migration
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Migrate orphaned data from the old KV store into new Postgres tables (quest_configs, videos, shop_items, school_accounts). Safe to run multiple times — uses upsert.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      try {
                        toast.loading('Running KV→PG migration...', { id: 'kv-migrate' });
                        const result = await triggerKvToPgMigration();
                        const r = result.results || {};
                        const summary = Object.entries(r).map(([table, info]: any) => 
                          `${table}: ${info.error ? `ERROR: ${info.error}` : `${info.migrated}/${info.found} migrated`}`
                        ).join('\n');
                        toast.success(`Migration complete!\n${summary}`, { id: 'kv-migrate', duration: 10000 });
                        console.log('[MIGRATE] Results:', result);
                      } catch (err: any) {
                        toast.error(`Migration failed: ${err.message}`, { id: 'kv-migrate' });
                      }
                    }}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Run KV → PG Migration
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        toast.loading('Scanning KV keys...', { id: 'kv-scan' });
                        const result = await scanKvKeys();
                        const groupSummary = Object.entries(result.groups || {})
                          .sort(([,a]: any, [,b]: any) => b - a)
                          .map(([prefix, count]) => `  ${prefix} → ${count}`)
                          .join('\n');
                        toast.success(`KV Store: ${result.total_keys} keys\n${groupSummary}`, { id: 'kv-scan', duration: 15000 });
                        console.log('[KV-SCAN] Groups:', result.groups);
                        console.log('[KV-SCAN] All keys:', result.all_keys);
                      } catch (err: any) {
                        toast.error(`KV scan failed: ${err.message}`, { id: 'kv-scan' });
                      }
                    }}
                    className="px-4 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Scan KV Keys
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white border border-red-200 rounded-xl p-5 mt-6">
                <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Danger Zone
                </h3>
                <p className="text-xs text-gray-500 mb-4">These actions are irreversible. Proceed with caution.</p>
                <div className="flex items-center gap-3">
                  <button className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    Reset All Question Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== PARENTS TAB ===== */}
          {activeMenu === 'parents' && (() => {
            const parentUsers = filteredUsers.filter(u => u.role === 'parent');
            return (
            <div className="space-y-4">
              {/* Info banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <Shield className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-amber-800 font-medium">Passwords are hashed by Supabase Auth and cannot be retrieved.</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">Login credentials shown below are email-based. Use Supabase dashboard to reset passwords if needed.</p>
                </div>
              </div>

              {/* Filters bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 bg-white"
                  />
                </div>

                <button
                  onClick={loadUsers}
                  disabled={usersLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 ml-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                  Reload
                </button>

                <div className="text-xs text-gray-400">{parentUsers.length} parent{parentUsers.length !== 1 ? 's' : ''}</div>
              </div>

              {/* Summary cards */}
              {usersSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Parents', value: usersSummary.parents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Paid Parents', value: usersSummary.paid_parents, icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Free Parents', value: usersSummary.free_parents, icon: UserCircle, color: 'text-gray-500', bg: 'bg-gray-50' },
                    { label: 'Total Users', value: usersSummary.total, icon: UserCircle, color: 'text-gray-400', bg: 'bg-gray-50' },
                  ].map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                      <div key={idx} className="bg-white rounded-xl border border-gray-200/80 px-4 py-3 flex items-center gap-3">
                        <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-900">{usersLoading ? '...' : stat.value}</div>
                          <div className="text-[11px] text-gray-500">{stat.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Users Table */}
              <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200/80">
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-8"></th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Parent</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Login Email</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Referral</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Last Sign-In</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usersLoading ? (
                        <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-400">Loading parents...</td></tr>
                      ) : parentUsers.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-sm text-gray-400">{userSearch ? 'No matching parents' : 'No parent accounts yet'}</td></tr>
                      ) : (
                        parentUsers.map((u) => {
                          const isExpanded = expandedUserId === u.id;
                          const planBadge = u.subscription_plan === 'plan_a'
                            ? { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Plan A' }
                            : u.subscription_plan === 'plan_b'
                            ? { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Plan B' }
                            : u.subscription_plan === 'free' || !u.subscription_plan
                            ? { bg: 'bg-gray-50', text: 'text-gray-500', label: 'Free' }
                            : { bg: 'bg-blue-50', text: 'text-blue-700', label: u.subscription_plan };

                          return (
                            <React.Fragment key={u.id}>
                              <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpandedUserId(isExpanded ? null : u.id)}>
                                <td className="px-4 py-3 text-center">
                                  {isExpanded
                                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 inline" />
                                    : <ChevronDown className="w-3.5 h-3.5 text-gray-400 inline" />}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100">
                                      <UserCircle className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                      {u.child_name && <div className="text-[11px] text-gray-400">Child: {u.child_name}{u.child_age ? `, Age ${u.child_age}` : ''}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <code className="text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{u.email}</code>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(u.email);
                                        toast.success('Email copied!');
                                      }}
                                      className="text-gray-400 hover:text-gray-600 transition-colors"
                                      title="Copy email"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    Password: <span className="font-mono tracking-wider">{'*'.repeat(8)}</span>
                                    <span className="text-gray-300">(hashed)</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${planBadge.bg} ${planBadge.text}`}>
                                    {(u.subscription_plan === 'plan_a' || u.subscription_plan === 'plan_b') && <Crown className="w-3 h-3" />}
                                    {planBadge.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {u.referral_code ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <code className="text-[10px] text-gray-600 bg-gray-100 px-1 py-0.5 rounded font-mono">{u.referral_code}</code>
                                      <span className="text-[10px] text-gray-400">({u.referral_count || 0})</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-gray-500">
                                    {u.last_sign_in_at ? formatRelativeTime(u.last_sign_in_at) : 'Never'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-gray-500">{formatDate(u.created_at)}</span>
                                </td>
                              </tr>

                              {/* Expanded detail row */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={7} className="px-4 py-0">
                                    <div className={`rounded-lg p-4 my-2 border ${editingUserId === u.id ? 'bg-blue-50/60 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                                      {/* Header row with edit/save controls */}
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <code className="text-gray-400 font-mono text-[10px]">{u.id}</code>
                                          <span className={`text-[10px] font-medium ${u.email_confirmed ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {u.email_confirmed ? 'Email Confirmed' : 'Email Not Confirmed'}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {editingUserId === u.id ? (
                                            <>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); cancelEditUser(); }}
                                                disabled={isSavingUser}
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                              >
                                                <X className="w-3 h-3" />
                                                Cancel
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); saveEditUser(u); }}
                                                disabled={isSavingUser}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                                              >
                                                {isSavingUser ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                {isSavingUser ? 'Saving...' : 'Save Changes'}
                                              </button>
                                            </>
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={(e) => { e.stopPropagation(); startEditUser(u); }}
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                              >
                                                <Pencil className="w-3 h-3" />
                                                Edit User
                                              </button>
                                              {deletingUserId === u.id ? (
                                                <div className="flex items-center gap-1.5">
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); setDeletingUserId(null); }}
                                                    disabled={isDeletingUser}
                                                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                                  >
                                                    Cancel
                                                  </button>
                                                  <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }}
                                                    disabled={isDeletingUser}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
                                                  >
                                                    {isDeletingUser ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                    {isDeletingUser ? 'Deleting...' : 'Confirm Delete'}
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); setDeletingUserId(u.id); }}
                                                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                  Delete
                                                </button>
                                              )}
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setCurrencyUserId(currencyUserId === u.id ? null : u.id);
                                                  setCurrencyForm({ gold: '', xp: '', diamond: '', reason: '' });
                                                }}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                  currencyUserId === u.id
                                                    ? 'text-amber-700 bg-amber-50 border border-amber-300'
                                                    : 'text-amber-600 bg-white border border-amber-200 hover:bg-amber-50 hover:border-amber-300'
                                                }`}
                                              >
                                                <Coins className="w-3 h-3" />
                                                Add Currency
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* ── ADD CURRENCY FORM ── */}
                                      {currencyUserId === u.id && (
                                        <div className="mb-3 p-3 bg-amber-50/60 border border-amber-200 rounded-lg" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Coins className="w-4 h-4 text-amber-600" />
                                            <span className="text-xs font-semibold text-amber-800">Add Currency to {u.name || u.email}</span>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            <div>
                                              <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Gold</label>
                                              <input
                                                type="number"
                                                value={currencyForm.gold}
                                                onChange={(e) => setCurrencyForm(prev => ({ ...prev, gold: e.target.value }))}
                                                placeholder="e.g. 500"
                                                className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 bg-white"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">XP</label>
                                              <input
                                                type="number"
                                                value={currencyForm.xp}
                                                onChange={(e) => setCurrencyForm(prev => ({ ...prev, xp: e.target.value }))}
                                                placeholder="e.g. 200"
                                                className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 bg-white"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Diamonds</label>
                                              <input
                                                type="number"
                                                value={currencyForm.diamond}
                                                onChange={(e) => setCurrencyForm(prev => ({ ...prev, diamond: e.target.value }))}
                                                placeholder="e.g. 5"
                                                className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 bg-white"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Reason</label>
                                              <input
                                                type="text"
                                                value={currencyForm.reason}
                                                onChange={(e) => setCurrencyForm(prev => ({ ...prev, reason: e.target.value }))}
                                                placeholder="e.g. testing"
                                                className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 bg-white"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 mt-2">
                                            <button
                                              onClick={async () => {
                                                const g = parseInt(currencyForm.gold) || 0;
                                                const x = parseInt(currencyForm.xp) || 0;
                                                const d = parseInt(currencyForm.diamond) || 0;
                                                if (g === 0 && x === 0 && d === 0) { toast.error('Enter at least one amount'); return; }
                                                setIsSendingCurrency(true);
                                                try {
                                                  const result = await adminAddCurrency(u.id, { gold: g, xp: x, diamond: d }, currencyForm.reason || 'admin_grant');
                                                  toast.success(`Currency added! New balance: ${result.newBalance.gold}g, ${result.newBalance.xp}xp, ${result.newBalance.diamond}💎`);
                                                  setCurrencyUserId(null);
                                                  setCurrencyForm({ gold: '', xp: '', diamond: '', reason: '' });
                                                } catch (err: any) {
                                                  toast.error(err.message || 'Failed to add currency');
                                                } finally {
                                                  setIsSendingCurrency(false);
                                                }
                                              }}
                                              disabled={isSendingCurrency}
                                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50"
                                            >
                                              {isSendingCurrency ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Coins className="w-3 h-3" />}
                                              {isSendingCurrency ? 'Sending...' : 'Send Currency'}
                                            </button>
                                            <button
                                              onClick={() => { setCurrencyUserId(null); setCurrencyForm({ gold: '', xp: '', diamond: '', reason: '' }); }}
                                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                              Cancel
                                            </button>
                                            <span className="text-[10px] text-amber-600/70 ml-auto">Negative values deduct currency. User must reload their game to see changes.</span>
                                          </div>
                                        </div>
                                      )}

                                      {/* ── EDIT MODE ── */}
                                      {editingUserId === u.id ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Parent Name</label>
                                            <input
                                              type="text"
                                              value={editForm.name || ''}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Child Name</label>
                                            <input
                                              type="text"
                                              value={editForm.child_name || ''}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, child_name: e.target.value }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Child Age</label>
                                            <input
                                              type="number"
                                              min={4}
                                              max={7}
                                              value={editForm.child_age || ''}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, child_age: parseInt(e.target.value) || '' }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">
                                              Subscription Plan
                                              <Crown className="w-3 h-3 text-amber-500 inline ml-1" />
                                            </label>
                                            <select
                                              value={editForm.subscription_plan || 'free'}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, subscription_plan: e.target.value }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white appearance-none cursor-pointer"
                                            >
                                              <option value="free">Free</option>
                                              <option value="plan_a">Plan A (RM365/yr)</option>
                                              <option value="plan_b">Plan B (RM730/yr)</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Sub Status</label>
                                            <select
                                              value={editForm.subscription_status || 'free'}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, subscription_status: e.target.value }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white appearance-none cursor-pointer"
                                            >
                                              <option value="free">Free</option>
                                              <option value="active">Active</option>
                                              <option value="cancelled">Cancelled</option>
                                              <option value="past_due">Past Due</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Referral Credits (RM)</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              min={0}
                                              value={editForm.referral_credits ?? 0}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, referral_credits: parseFloat(e.target.value) || 0 }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Referral Count</label>
                                            <input
                                              type="number"
                                              min={0}
                                              value={editForm.referral_count ?? 0}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, referral_count: parseInt(e.target.value) || 0 }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Origin Tag</label>
                                            <input
                                              type="text"
                                              value={editForm.origin_tag || ''}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, origin_tag: e.target.value }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                              placeholder="e.g. facebook_ad"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Referred By</label>
                                            <input
                                              type="text"
                                              value={editForm.referred_by || ''}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, referred_by: e.target.value }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                              placeholder="referral code"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Tests Today</label>
                                            <input
                                              type="number"
                                              min={0}
                                              value={editForm.test_count_today ?? 0}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, test_count_today: parseInt(e.target.value) || 0 }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">Watches Today</label>
                                            <input
                                              type="number"
                                              min={0}
                                              value={editForm.watch_count_today ?? 0}
                                              onClick={(e) => e.stopPropagation()}
                                              onChange={(e) => setEditForm(prev => ({ ...prev, watch_count_today: parseInt(e.target.value) || 0 }))}
                                              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 bg-white"
                                            />
                                          </div>
                                        </div>
                                      ) : (
                                        /* ── VIEW MODE ── */
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                          <div>
                                            <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">User ID</div>
                                            <code className="text-gray-600 font-mono text-[11px] break-all">{u.id}</code>
                                          </div>
                                          <div>
                                            <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Email Confirmed</div>
                                            <span className={u.email_confirmed ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                                              {u.email_confirmed ? 'Yes' : 'No'}
                                            </span>
                                          </div>
                                          <div>
                                            <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Subscription Status</div>
                                            <span className="text-gray-700 font-medium">{u.subscription_status || 'free'}</span>
                                          </div>
                                          <div>
                                            <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Referral Credits</div>
                                            <span className="text-gray-700 font-medium">RM {(u.referral_credits || 0).toFixed(2)}</span>
                                          </div>
                                          <div>
                                            <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Tests Today</div>
                                            <span className="text-gray-700 font-medium">{u.test_count_today || 0}</span>
                                          </div>
                                          <div>
                                            <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Watches Today</div>
                                            <span className="text-gray-700 font-medium">{u.watch_count_today || 0}</span>
                                          </div>
                                          <div>
                                            <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Referred By</div>
                                            <span className="text-gray-600 font-mono text-[11px]">{u.referred_by || '—'}</span>
                                          </div>
                                          <div>
                                            <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">Origin Tag</div>
                                            <span className="text-gray-600 font-mono text-[11px]">{u.origin_tag || '—'}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
};