import React, { useState, useEffect, useCallback } from 'react';
import { MasterQuestionBank } from './MasterQuestionBank';
import { QuestManager } from '../admin/QuestManager';
import { MarketingManager } from '../admin/MarketingManager';
import { MediaManager } from '../admin/MediaManager';
import { Question } from '../screens/QuestionScreen';
import { fetchPlatformStats } from '../../utils/api';
import { fetchAllUsers, updateUserAdmin, fetchAdminVideos, createAdminVideo, updateAdminVideo, deleteAdminVideo, uploadVideoThumbnail, deleteUserAdmin, fetchStripeOrders } from '../../utils/api';
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
  const [isCollapsed, setIsCollapsed] = useState(true);
  
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

  // Videos tab state
  const VIDEO_CATEGORIES = [
    { id: 'english', label: 'English Knight' },
    { id: 'numbers', label: 'Numbers Sorcerer' },
    { id: 'bahasa', label: 'Malay Fighter' },
    { id: 'mandarin', label: 'Chinese General' },
    { id: 'science', label: 'Science Ranger' },
    { id: 'music', label: 'Music Bard' },
    { id: 'sleep', label: 'Dream Guardian' },
    { id: 'movie', label: 'Epic Cinema' },
  ];
  const [adminVideos, setAdminVideos] = useState<any[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoForm, setVideoForm] = useState({
    title: '',
    subtitle: '',
    youtube_url: '',
    dyntube_key: '',
    thumbnail_url: '',
    category: 'english',
    duration: '',
    episode: '',
    is_premium: false,
    is_featured: false,
    order: 0,
  });
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [videoCategoryFilter, setVideoCategoryFilter] = useState<string>('all');
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const thumbInputRef = React.useRef<HTMLInputElement>(null);

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
    setVideoForm({ title: '', subtitle: '', youtube_url: '', dyntube_key: '', thumbnail_url: '', category: 'english', duration: '', episode: '', is_premium: false, is_featured: false, order: 0 });
    setEditingVideoId(null);
    setShowVideoForm(false);
    setThumbPreview(null);
    setIsDetectingDuration(false);
    if (thumbInputRef.current) thumbInputRef.current.value = '';
  };

  // Auto-detect YouTube video duration using IFrame Player API
  const detectYouTubeDuration = async (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (!match) {
      toast.error('Could not extract YouTube video ID from URL.');
      return;
    }
    const videoId = match[1];
    setIsDetectingDuration(true);

    try {
      // Load YouTube IFrame API if not already loaded
      if (!(window as any).YT?.Player) {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).YT?.Player) { resolve(); return; }
          const existing = document.getElementById('yt-iframe-api');
          if (!existing) {
            const tag = document.createElement('script');
            tag.id = 'yt-iframe-api';
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
          }
          const prev = (window as any).onYouTubeIframeAPIReady;
          (window as any).onYouTubeIframeAPIReady = () => {
            if (prev) prev();
            resolve();
          };
          // Timeout after 8s
          setTimeout(() => reject(new Error('YouTube API load timeout')), 8000);
        });
      }

      // Create hidden container
      let container = document.getElementById('yt-duration-detect');
      if (!container) {
        container = document.createElement('div');
        container.id = 'yt-duration-detect';
        container.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;top:-9999px;left:-9999px;';
        document.body.appendChild(container);
      }
      container.innerHTML = '<div id="yt-hidden-player"></div>';

      const duration = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Player load timeout')), 10000);
        new (window as any).YT.Player('yt-hidden-player', {
          videoId,
          playerVars: { autoplay: 0, controls: 0 },
          events: {
            onReady: (event: any) => {
              clearTimeout(timeout);
              const secs = event.target.getDuration();
              event.target.destroy();
              resolve(secs);
            },
            onError: () => {
              clearTimeout(timeout);
              reject(new Error('YouTube player error — check the URL'));
            },
          },
        });
      });

      // Format: if >= 1 hour -> H:MM:SS, else M:SS
      const hrs = Math.floor(duration / 3600);
      const mins = Math.floor((duration % 3600) / 60);
      const secs = Math.floor(duration % 60);
      const formatted = hrs > 0
        ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        : `${mins}:${String(secs).padStart(2, '0')}`;

      setVideoForm(prev => ({ ...prev, duration: formatted }));
      toast.success(`Duration detected: ${formatted}`);
    } catch (err: any) {
      console.error('[VIDEO] Duration detection failed:', err);
      toast.error(err.message || 'Failed to detect duration. Enter manually.');
    } finally {
      setIsDetectingDuration(false);
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
      // Store the storage path (will be resolved to signed URL by server on GET)
      setVideoForm(prev => ({ ...prev, thumbnail_url: result.image_path }));
      // Update preview with actual signed URL
      if (result.signed_url) setThumbPreview(result.signed_url);
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
      youtube_url: v.youtube_url || '',
      dyntube_key: v.dyntube_key || '',
      thumbnail_url: v.thumbnail_url || '',
      category: v.category || 'english',
      duration: v.duration || '',
      episode: v.episode ? String(v.episode) : '',
      is_premium: v.is_premium || false,
      is_featured: v.is_featured || false,
      order: v.order || 0,
    });
    // Set preview to existing thumbnail (could be signed URL or external URL)
    setThumbPreview(v.thumbnail_url || null);
    setShowVideoForm(true);
  };

  const handleSaveVideo = async () => {
    if (!videoForm.title || (!videoForm.youtube_url && !videoForm.dyntube_key) || !videoForm.category) {
      toast.error('Title, Category, and either YouTube URL or DynTube Key are required.');
      return;
    }
    setIsSavingVideo(true);
    try {
      const payload = {
        ...videoForm,
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
      await updateUserAdmin(u.id, u.role, editForm);
      toast.success(`User ${u.name || u.email} updated successfully!`);
      setEditingUserId(null);
      setEditForm({});
      // Reload users to reflect changes
      await loadUsers();
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
      await loadUsers();
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
  }, [loadPlatformData, loadUsers, loadVideos, loadOrders]);

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

  const menuItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'users', icon: UserCircle, label: 'Users & Subs' },
    { id: 'schools', icon: School, label: 'Schools' },
    { id: 'children', icon: Users, label: 'Assessments' },
    { id: 'islands', icon: Map, label: 'Quest Manager' },
    { id: 'questions', icon: BookOpen, label: 'Question Bank' },
    { id: 'videos', icon: Play, label: 'Video Manager' },
    { id: 'media', icon: Music, label: 'Media Manager' },
    { id: 'marketing', icon: Image, label: 'Marketing' },
    { id: 'orders', icon: ShoppingCart, label: 'Orders' },
    { id: 'billing', icon: CreditCard, label: 'Billing' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

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

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`
                  w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all
                  ${isActive 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                  ${isCollapsed ? 'justify-center' : ''}
                `}
                title={isCollapsed ? item.label : ''}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
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
              {menuItems.find(m => m.id === activeMenu)?.label}
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

          {/* ===== SCHOOLS TAB ===== */}
          {activeMenu === 'schools' && (
            <div className="space-y-4">
              {/* Search */}
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
                <div className="text-xs text-gray-400">{filteredSchools.length} school{filteredSchools.length !== 1 ? 's' : ''}</div>
              </div>

              {/* Table */}
              <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-200/80">
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
                      <tr><td colSpan={6} className="p-8 text-center text-sm text-gray-400">Loading...</td></tr>
                    ) : filteredSchools.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-sm text-gray-400">{schoolSearch ? 'No matching schools' : 'No schools registered yet'}</td></tr>
                    ) : (
                      filteredSchools.map((school) => (
                        <tr key={school.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="text-sm font-medium text-gray-900">{school.school_name}</div>
                            <div className="text-xs text-gray-500">{school.email}</div>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                    {adminVideos.length} videos across {VIDEO_CATEGORIES.length} categories
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadVideos}
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

              {/* Category filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setVideoCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${videoCategoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  All ({adminVideos.length})
                </button>
                {VIDEO_CATEGORIES.map(cat => {
                  const count = adminVideos.filter(v => v.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setVideoCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${videoCategoryFilter === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {cat.label} ({count})
                    </button>
                  );
                })}
              </div>

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
                        {VIDEO_CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">YouTube URL</label>
                      <input
                        type="text"
                        value={videoForm.youtube_url}
                        onChange={(e) => setVideoForm({ ...videoForm, youtube_url: e.target.value })}
                        placeholder="https://youtube.com/watch?v=..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">DynTube Key <span className="text-gray-400 font-normal">(HLS)</span></label>
                      <input
                        type="text"
                        value={videoForm.dyntube_key}
                        onChange={(e) => setVideoForm({ ...videoForm, dyntube_key: e.target.value })}
                        placeholder="e.g. abc123def456"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">If set, custom HLS player is used instead of YouTube.</p>
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
                          <p className="text-[10px] text-gray-400 mt-1">Or paste a URL below. Leave both blank to auto-extract from YouTube.</p>
                          <input
                            type="text"
                            value={videoForm.thumbnail_url.startsWith('video-thumbnails/') ? '' : videoForm.thumbnail_url}
                            onChange={(e) => {
                              setVideoForm({ ...videoForm, thumbnail_url: e.target.value });
                              setThumbPreview(e.target.value || null);
                            }}
                            placeholder="https://img.youtube.com/vi/.../maxresdefault.jpg"
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
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={videoForm.duration}
                          onChange={(e) => setVideoForm({ ...videoForm, duration: e.target.value })}
                          placeholder="e.g. 4:32"
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        />
                        <button
                          type="button"
                          onClick={() => detectYouTubeDuration(videoForm.youtube_url)}
                          disabled={!videoForm.youtube_url || isDetectingDuration}
                          className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                          title="Auto-detect duration from YouTube video"
                        >
                          {isDetectingDuration ? (
                            <><RefreshCw className="w-3 h-3 animate-spin" /> Detecting...</>
                          ) : (
                            <><Clock className="w-3 h-3" /> Detect</>
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">Click Detect to auto-fetch from YouTube, or enter manually.</p>
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
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Category</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Ep</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Duration</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Tier</th>
                        <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(videoCategoryFilter === 'all' ? adminVideos : adminVideos.filter(v => v.category === videoCategoryFilter)).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-400 text-xs">
                            No videos found. Click "Add Video" to create one.
                          </td>
                        </tr>
                      ) : (
                        (videoCategoryFilter === 'all' ? adminVideos : adminVideos.filter(v => v.category === videoCategoryFilter)).map((v, idx) => {
                          const catLabel = VIDEO_CATEGORIES.find(c => c.id === v.category)?.label || v.category;
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
                                    <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{v.subtitle || v.youtube_url}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                                  {catLabel}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-gray-600">{v.episode || '—'}</td>
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

          {/* ===== USERS & SUBSCRIPTIONS TAB ===== */}
          {activeMenu === 'users' && (
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

                <div className="flex items-center gap-1.5">
                  {['all', 'parent', 'kindergarten'].map(role => (
                    <button
                      key={role}
                      onClick={() => setUserRoleFilter(role)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        userRoleFilter === role
                          ? 'bg-gray-900 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {role === 'all' ? 'All' : role === 'parent' ? 'Parents' : 'Kindergartens'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={loadUsers}
                  disabled={usersLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 ml-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                  Reload
                </button>

                <div className="text-xs text-gray-400">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</div>
              </div>

              {/* Summary cards */}
              {usersSummary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Total Users', value: usersSummary.total, icon: Users, color: 'text-gray-600', bg: 'bg-gray-50' },
                    { label: 'Parents', value: usersSummary.parents, icon: UserCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Kindergartens', value: usersSummary.kindergartens, icon: School, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Paid Parents', value: usersSummary.paid_parents, icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Free Parents', value: usersSummary.free_parents, icon: UserCircle, color: 'text-gray-500', bg: 'bg-gray-50' },
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
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Login Email</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Referral</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Last Sign-In</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usersLoading ? (
                        <tr><td colSpan={8} className="p-8 text-center text-sm text-gray-400">Loading users...</td></tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan={8} className="p-8 text-center text-sm text-gray-400">{userSearch ? 'No matching users' : 'No users registered yet'}</td></tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isExpanded = expandedUserId === u.id;
                          const roleBadge = u.role === 'parent'
                            ? { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Parent' }
                            : u.role === 'kindergarten'
                            ? { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Kindergarten' }
                            : { bg: 'bg-gray-50', text: 'text-gray-500', label: u.role };
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
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${u.role === 'parent' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                                      {u.role === 'parent'
                                        ? <UserCircle className="w-4 h-4 text-blue-600" />
                                        : <School className="w-4 h-4 text-purple-600" />}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                      {u.child_name && <div className="text-[11px] text-gray-400">Child: {u.child_name}{u.child_age ? `, Age ${u.child_age}` : ''}</div>}
                                      {u.kindergarten_url && <div className="text-[11px] text-gray-400">/{u.kindergarten_url}</div>}
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
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${roleBadge.bg} ${roleBadge.text}`}>
                                    {roleBadge.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {u.role === 'parent' ? (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${planBadge.bg} ${planBadge.text}`}>
                                      {(u.subscription_plan === 'plan_a' || u.subscription_plan === 'plan_b') && <Crown className="w-3 h-3" />}
                                      {planBadge.label}
                                    </span>
                                  ) : u.role === 'kindergarten' ? (
                                    <StatusBadge status={u.school_tier || 'trial'} />
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
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
                                  <td colSpan={8} className="px-4 py-0">
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
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* ── EDIT MODE ── */}
                                      {editingUserId === u.id ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                                          {u.role === 'parent' && (
                                            <>
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
                                            </>
                                          )}
                                          {u.role === 'kindergarten' && (
                                            <>
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
                                                  <option value="active">Active</option>
                                                  <option value="expired">Expired</option>
                                                </select>
                                              </div>
                                              <div>
                                                <label className="block text-gray-500 text-[10px] uppercase tracking-wider mb-1">School ID</label>
                                                <code className="block px-2.5 py-1.5 text-[11px] text-gray-500 bg-gray-100 rounded-lg font-mono break-all">{u.school_id || '—'}</code>
                                              </div>
                                            </>
                                          )}
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
                                          {u.role === 'parent' && (
                                            <>
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
                                            </>
                                          )}
                                          {u.role === 'kindergarten' && (
                                            <>
                                              <div>
                                                <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">School ID</div>
                                                <code className="text-gray-600 font-mono text-[11px] break-all">{u.school_id || '—'}</code>
                                              </div>
                                              <div>
                                                <div className="text-gray-400 uppercase tracking-wider text-[10px] mb-1">School Tier</div>
                                                <span className="text-gray-700 font-medium">{u.school_tier || 'trial'}</span>
                                              </div>
                                            </>
                                          )}
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
          )}
        </div>
      </main>
    </div>
  );
};