// API helper functions for Foxy Adventure
import { projectId, publicAnonKey } from './supabase/info';
import { getFreshAdminToken, isJwtExpired } from './supabase-client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

// Build headers for authenticated requests — now async for auto-refresh
// IMPORTANT: Authorization must ALWAYS be the anon key (Supabase Edge Function gateway only accepts anon/service keys)
// The user's access token is sent via X-User-Token for server-side verification
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`, // Always anon key for gateway
  };
  
  // Try Supabase client first (auto-refreshes expired tokens)
  const freshToken = await getFreshAdminToken();
  if (freshToken) {
    headers['X-User-Token'] = `Bearer ${freshToken}`;
  } else {
    // Fallback to raw localStorage for backwards compat — but reject expired tokens
    const token = localStorage.getItem('access_token');
    if (token && !isJwtExpired(token)) {
      headers['X-User-Token'] = `Bearer ${token}`;
    } else if (token) {
      console.warn('[API] localStorage token is expired, clearing stale session');
      localStorage.removeItem('access_token');
    }
  }
  
  return headers;
}

// Public headers (no user token needed)
function getPublicHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
  };
}

// ===== SCHOOL RESOLVE (Public - for child flow) =====

// Dev mode: resolve school by email
// Production: resolve school by URL slug
export async function resolveSchool(params: { email?: string; url?: string }) {
  const queryParams = new URLSearchParams();
  if (params.email) queryParams.set('email', params.email);
  if (params.url) queryParams.set('url', params.url);

  console.log('Resolving school with params:', params);

  const response = await fetch(`${API_BASE}/schools/resolve?${queryParams.toString()}`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Resolve school error:', error);
    throw new Error(error.error || 'Failed to resolve school');
  }

  const data = await response.json();
  console.log('School resolved:', data.school);
  return data.school;
}

// Resolve school by shortCode or slug (for /t/:code branded test links)
export async function resolveSchoolByCode(code: string) {
  console.log(`[SCHOOL] Resolving by code: ${code}`);

  const response = await fetch(`${API_BASE}/schools/resolve/${encodeURIComponent(code)}`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[SCHOOL] Resolve by code error:', error);
    throw new Error(error.error || 'School not found');
  }

  const data = await response.json();
  console.log('[SCHOOL] Resolved:', data.school);
  return data.school;
}

// Lead Lookup API (for session resume)
export async function lookupLead(phone: string, schoolId: string) {
  console.log('[API] Looking up existing lead:', { phone, schoolId });
  const params = new URLSearchParams({ phone, schoolId });
  const response = await fetch(`${API_BASE}/leads/lookup?${params.toString()}`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Lead lookup error:', error);
    throw new Error(error.error || 'Failed to lookup lead');
  }

  const data = await response.json();
  console.log('[API] Lead lookup result:', { found: data.found, resumable: data.resumable, leadId: data.lead?.id });
  return data;
}

// Leads API
export async function submitLead(leadData: {
  schoolId: string;
  childName: string;
  parentName: string;
  whatsapp: string;
  childAge: number;
  includeMandarin: boolean;
  score?: number;
  totalQuestions?: number;
  answers?: any[];
  questResults?: any[];
  agePerformance?: any[];
  status?: string;
  referralCode?: string;
}) {
  console.log('Submitting lead:', { schoolId: leadData.schoolId, childName: leadData.childName, phone: leadData.whatsapp, status: leadData.status });

  const response = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify(leadData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Submit lead error:', error);
    throw new Error(error.error || 'Failed to submit lead');
  }

  const data = await response.json();
  console.log('Lead submit result:', data.leadId, data.isUpdate ? '(updated existing)' : '(new lead)');
  return data;
}

// Update an existing lead with partial data (e.g., module-by-module progress)
export async function updateLead(leadId: string, updateData: {
  score?: number;
  total_questions?: number;
  answers?: any[];
  quest_results?: any[];
  age_performance?: any[];
  status?: string;
  completed_modules?: string[];
}) {
  console.log('Updating lead:', leadId, 'with:', Object.keys(updateData));

  const response = await fetch(`${API_BASE}/leads/${leadId}`, {
    method: 'PUT',
    headers: getPublicHeaders(),
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Update lead error:', error);
    throw new Error(error.error || 'Failed to update lead');
  }

  const data = await response.json();
  console.log('Lead updated:', data.leadId);
  return data;
}

export async function loadLeads() {
  const response = await fetch(`${API_BASE}/leads`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('Load leads error:', {
      status: response.status,
      statusText: response.statusText,
      error: error
    });
    throw new Error(error.error || `Failed to load leads (${response.status})`);
  }

  const data = await response.json();
  console.log('Leads loaded successfully:', data.leads?.length, 'leads');
  console.log('Leads API debug info:', data._debug);
  if (data.leads?.length > 0) {
    console.log('First lead sample:', { id: data.leads[0].id, child_name: data.leads[0].child_name, status: data.leads[0].status, school_id: data.leads[0].school_id });
  }
  
  // Transform database format to frontend format
  const transformedLeads = (data.leads || []).map((lead: any) => ({
    id: lead.id,
    childName: lead.child_name,
    parentName: lead.parent_name,
    whatsapp: lead.whatsapp,
    childAge: lead.child_age || 5,
    score: lead.score || 0,
    totalQuestions: lead.total_questions || 0,
    questResults: lead.quest_results || [],
    agePerformance: lead.age_performance || [],
    answers: lead.answers || [],
    status: lead.status || 'completed',
    source: lead.source || 'direct',
    referralCodeUsed: lead.referral_code_used || null,
    referredByParentId: lead.referred_by_parent_id || null,
    completedAt: new Date(lead.updated_at || lead.created_at).toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }));
  
  return transformedLeads;
}

export async function deleteLead(leadId: string) {
  const response = await fetch(`${API_BASE}/leads/${leadId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete lead');
  }

  return true;
}

// ===== SHAREABLE REPORTS API =====

export async function createShareableReport(leadId: string): Promise<{ reportId: string; isExisting: boolean }> {
  console.log(`[API] Creating shareable report for lead: ${leadId}`);
  const response = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ leadId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Create report error:', error);
    throw new Error(error.error || 'Failed to create report');
  }

  const data = await response.json();
  console.log(`[API] Report ${data.isExisting ? 'found' : 'created'}: ${data.reportId}`);
  return { reportId: data.reportId, isExisting: data.isExisting };
}

export async function getReportStatus(leadId: string): Promise<{
  hasReport: boolean;
  reportId?: string;
  viewCount?: number;
  isClaimed?: boolean;
  firstViewedAt?: string;
  lastViewedAt?: string;
  expiresAt?: string;
}> {
  const response = await fetch(`${API_BASE}/reports/status/${leadId}`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });

  if (!response.ok) {
    return { hasReport: false };
  }

  const data = await response.json();
  return data;
}

// ===== KG STRIPE CHECKOUT API =====

export async function createKGCheckoutSession(schoolId: string, email: string) {
  console.log(`[API] Creating KG Pro checkout session: school=${schoolId}, email=${email}`);
  const response = await fetch(`${API_BASE}/stripe/kg-checkout`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      schoolId,
      email,
      successUrl: `${window.location.origin}/kg?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/kg?checkout=cancelled`,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] KG checkout error:', error);
    throw new Error(error.error || 'Failed to create checkout session');
  }

  const data = await response.json();
  console.log(`[API] KG checkout session created: ${data.sessionId}`);
  return data;
}

// ===== GLOBAL QUESTION BANK API (Static CSV Approach) =====

export async function uploadQuestionBank(questions: any[]) {
  console.log(`[API] Uploading ${questions.length} questions to global bank`);
  const response = await fetch(`${API_BASE}/question-bank/upload`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ questions }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Upload question bank error:', error);
    throw new Error(error.error || 'Failed to upload questions');
  }

  const data = await response.json();
  console.log('[API] Upload result:', data.message);
  return data;
}

export async function uploadMCQImageQuestions(questions: any[]) {
  console.log(`[API] Uploading ${questions.length} MCQ-image questions to global bank`);
  const response = await fetch(`${API_BASE}/question-bank/upload-mcq-image`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ questions }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Upload MCQ-image error:', error);
    throw new Error(error.error || 'Failed to upload MCQ-image questions');
  }

  const data = await response.json();
  console.log('[API] MCQ-image upload result:', data.message);
  return data;
}

export async function fetchQuestionBank(filters?: { subject?: string; age_target?: number }) {
  const params = new URLSearchParams();
  if (filters?.subject) params.set('subject', filters.subject);
  if (filters?.age_target) params.set('age_target', String(filters.age_target));

  const url = `${API_BASE}/question-bank${params.toString() ? '?' + params.toString() : ''}`;
  console.log(`[API] Fetching question bank: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch question bank error:', error);
    throw new Error(error.error || 'Failed to fetch question bank');
  }

  const data = await response.json();
  console.log(`[API] Question bank: ${data.total} questions returned`);
  return data.questions || [];
}

export async function fetchQuestionBankStats() {
  const response = await fetch(`${API_BASE}/question-bank/stats`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch stats error:', error);
    throw new Error(error.error || 'Failed to fetch stats');
  }

  const data = await response.json();
  console.log(`[API] Stats: ${data.totalQuestions} total questions across ${data.subjects?.length} subjects`);
  return data;
}

export async function deleteGlobalQuestion(qId: string) {
  console.log(`[API] Deleting global question: ${qId}`);
  const response = await fetch(`${API_BASE}/question-bank/${encodeURIComponent(qId)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Delete global question error:', error);
    throw new Error(error.error || 'Failed to delete question');
  }

  return await response.json();
}

export async function clearQuestionBank() {
  console.log('[API] Clearing entire question bank');
  const response = await fetch(`${API_BASE}/question-bank/clear-all`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Clear question bank error:', error);
    throw new Error(error.error || 'Failed to clear question bank');
  }

  const data = await response.json();
  console.log(`[API] Cleared ${data.deleted} questions`);
  return data;
}

// Update a single question in the global question bank
export async function updateGlobalQuestion(qId: string, updates: Record<string, any>) {
  console.log(`[API] Updating question ${qId}:`, Object.keys(updates));
  const response = await fetch(`${API_BASE}/question-bank/${encodeURIComponent(qId)}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Update question error:', error);
    throw new Error(error.error || 'Failed to update question');
  }

  const data = await response.json();
  console.log(`[API] Question ${qId} updated successfully`);
  return data.question;
}

// Upload a question image to Supabase Storage (stored under questions/ prefix)
export async function uploadQuestionImage(file: File): Promise<{ image_path: string; signed_url: string }> {
  console.log(`[API] Uploading question image: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

  const reader = new FileReader();
  const arrayBuffer = await file.arrayBuffer();
  const binary = new Uint8Array(arrayBuffer);
  let binaryStr = '';
  for (let i = 0; i < binary.length; i++) {
    binaryStr += String.fromCharCode(binary[i]);
  }
  const base64 = btoa(binaryStr);

  const response = await fetch(`${API_BASE}/question-image`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      data: base64,
      filename: file.name,
      contentType: file.type,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Upload question image error:', error);
    throw new Error(error.error || 'Failed to upload image');
  }

  const data = await response.json();
  console.log(`[API] Question image uploaded: ${data.image_path}`);
  return data;
}

// ===== QUEST MANAGEMENT API =====

export async function createQuest(questData: {
  subject: string;
  name: { en: string; ms: string; zh: string };
  status?: 'live' | 'draft';
  question_count?: number;
  icon?: string;
  is_mandarin?: boolean;
  image_path?: string | null;
}) {
  console.log(`[API] Creating quest: ${questData.subject}`);
  const response = await fetch(`${API_BASE}/quests`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(questData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Create quest error:', error);
    throw new Error(error.error || 'Failed to create quest');
  }

  const data = await response.json();
  console.log(`[API] Quest created: ${data.quest?.id}`);
  return data;
}

export async function fetchQuests() {
  console.log('[API] Fetching all quests (admin)');
  const response = await fetch(`${API_BASE}/quests`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch quests error:', error);
    throw new Error(error.error || 'Failed to fetch quests');
  }

  const data = await response.json();
  console.log(`[API] Fetched ${data.quests?.length} quests`);
  return data.quests || [];
}

export async function fetchLiveQuests() {
  console.log('[API] Fetching live quests (public)');
  const response = await fetch(`${API_BASE}/quests/live`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch live quests error:', error);
    throw new Error(error.error || 'Failed to fetch live quests');
  }

  const data = await response.json();
  console.log(`[API] ${data.quests?.length} live quests`);
  return data.quests || [];
}

export async function updateQuest(questId: string, updates: Partial<{
  subject: string;
  name: { en: string; ms: string; zh: string };
  status: 'live' | 'draft';
  question_count: number;
  icon: string;
  is_mandarin: boolean;
  image_path: string | null;
}>) {
  console.log(`[API] Updating quest ${questId}:`, Object.keys(updates));
  const response = await fetch(`${API_BASE}/quests/${questId}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Update quest error:', error);
    throw new Error(error.error || 'Failed to update quest');
  }

  const data = await response.json();
  console.log(`[API] Quest updated: ${data.quest?.id}, status=${data.quest?.status}`);
  return data;
}

export async function deleteQuest(questId: string) {
  console.log(`[API] Deleting quest: ${questId}`);
  const response = await fetch(`${API_BASE}/quests/${questId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Delete quest error:', error);
    throw new Error(error.error || 'Failed to delete quest');
  }

  return await response.json();
}

// ===== QUEST IMAGE API =====

export async function uploadQuestImage(file: File): Promise<{ image_path: string; signed_url: string }> {
  console.log(`[API] Uploading quest image: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

  // Convert file to base64
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const response = await fetch(`${API_BASE}/quest-image`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      data: base64,
      filename: file.name,
      contentType: file.type,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Upload quest image error:', error);
    throw new Error(error.error || 'Failed to upload image');
  }

  const data = await response.json();
  console.log(`[API] Quest image uploaded: ${data.image_path}`);
  return data;
}

export async function getQuestImageUrl(imagePath: string): Promise<string> {
  const response = await fetch(`${API_BASE}/quest-image/${encodeURIComponent(imagePath)}`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    console.error('[API] Get quest image URL failed');
    return '';
  }

  const data = await response.json();
  return data.signed_url || '';
}

export async function deleteQuestImage(imagePath: string) {
  console.log(`[API] Deleting quest image: ${imagePath}`);
  const response = await fetch(`${API_BASE}/quest-image/${encodeURIComponent(imagePath)}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Delete quest image error:', error);
    throw new Error(error.error || 'Failed to delete image');
  }

  return await response.json();
}

// ===== SUPER ADMIN API =====

export async function fetchPlatformStats() {
  console.log('[API] Fetching platform stats (super admin)');
  const response = await fetch(`${API_BASE}/admin/platform-stats`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch platform stats error:', error);
    throw new Error(error.error || 'Failed to fetch platform stats');
  }

  const data = await response.json();
  console.log(`[API] Platform stats loaded: ${data.overview?.total_schools} schools, ${data.overview?.total_leads} leads`);
  return data;
}

export async function fetchAllUsers() {
  console.log('[API] Fetching all users (super admin)');
  const response = await fetch(`${API_BASE}/admin/all-users`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch all users error:', error);
    throw new Error(error.error || 'Failed to fetch all users');
  }

  const data = await response.json();
  console.log(`[API] All users loaded: ${data.summary?.total} total (${data.summary?.parents} parents, ${data.summary?.kindergartens} kindergartens)`);
  return data;
}

export async function updateUserAdmin(userId: string, role: string, updates: Record<string, any>) {
  console.log(`[API] Updating user ${userId} (${role}):`, updates);
  const response = await fetch(`${API_BASE}/admin/update-user`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ userId, role, updates }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Update user error:', error);
    throw new Error(error.error || 'Failed to update user');
  }

  const data = await response.json();
  console.log(`[API] User ${userId} updated successfully`);
  return data;
}

export async function deleteUserAdmin(userId: string): Promise<{ success: boolean; deletedKeys: number; authDeleted: boolean }> {
  console.log(`[API] Deleting user ${userId}`);
  const response = await fetch(`${API_BASE}/admin/delete-user/${userId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Delete user error:', error);
    throw new Error(error.error || 'Failed to delete user');
  }

  const data = await response.json();
  console.log(`[API] User ${userId} deleted. Keys: ${data.deletedKeys}, Auth: ${data.authDeleted}`);
  return data;
}

// ===== ADMIN: VIDEO MANAGEMENT =====

export async function fetchAdminVideos() {
  console.log('[API] Fetching admin videos');
  const response = await fetch(`${API_BASE}/admin/videos`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch admin videos error:', error);
    throw new Error(error.error || 'Failed to fetch videos');
  }

  const data = await response.json();
  console.log(`[API] Admin videos loaded: ${data.videos?.length} videos`);
  return data;
}

export async function createAdminVideo(videoData: {
  title: string;
  youtube_url: string;
  dyntube_key?: string;
  thumbnail_url?: string;
  category: string;
  duration?: string;
  episode?: number | null;
  is_premium?: boolean;
  is_featured?: boolean;
  order?: number;
}) {
  console.log('[API] Creating admin video:', videoData.title);
  const response = await fetch(`${API_BASE}/admin/videos`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(videoData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Create video error:', error);
    throw new Error(error.error || 'Failed to create video');
  }

  const data = await response.json();
  console.log(`[API] Video created: ${data.video?.id}`);
  return data;
}

export async function updateAdminVideo(videoId: string, updates: Record<string, any>) {
  console.log('[API] Updating admin video:', videoId);
  const response = await fetch(`${API_BASE}/admin/videos/${videoId}`, {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Update video error:', error);
    throw new Error(error.error || 'Failed to update video');
  }

  const data = await response.json();
  console.log(`[API] Video updated: ${videoId}`);
  return data;
}

export async function deleteAdminVideo(videoId: string) {
  console.log('[API] Deleting admin video:', videoId);
  const response = await fetch(`${API_BASE}/admin/videos/${videoId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Delete video error:', error);
    throw new Error(error.error || 'Failed to delete video');
  }

  const data = await response.json();
  console.log(`[API] Video deleted: ${videoId}`);
  return data;
}

export async function uploadVideoThumbnail(file: File): Promise<{ image_path: string; signed_url: string }> {
  console.log('[API] Uploading video thumbnail:', file.name);

  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const response = await fetch(`${API_BASE}/admin/videos/upload-thumbnail`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      data: base64,
      filename: file.name,
      contentType: file.type,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Upload video thumbnail error:', error);
    throw new Error(error.error || 'Failed to upload thumbnail');
  }

  const data = await response.json();
  console.log(`[API] Thumbnail uploaded: ${data.image_path}`);
  return data;
}

// ===== MARKETING ARTWORK API =====

export async function fetchMarketingArtwork() {
  console.log('[API] Fetching marketing artwork');
  const response = await fetch(`${API_BASE}/marketing/artwork`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch marketing artwork error:', error);
    throw new Error(error.error || 'Failed to fetch artwork');
  }

  const data = await response.json();
  console.log(`[API] Marketing artwork loaded: ${data.artworks?.length} items`);
  return data.artworks || [];
}

export async function uploadMarketingArtwork(artworkData: {
  title: string;
  description?: string;
  platform: 'whatsapp' | 'facebook' | 'instagram';
  width?: number;
  height?: number;
  file: File;
}) {
  console.log(`[API] Uploading marketing artwork: ${artworkData.title} (${artworkData.platform})`);

  const buffer = await artworkData.file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const response = await fetch(`${API_BASE}/admin/marketing/artwork`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      title: artworkData.title,
      description: artworkData.description || '',
      platform: artworkData.platform,
      width: artworkData.width,
      height: artworkData.height,
      data: base64,
      filename: artworkData.file.name,
      contentType: artworkData.file.type,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Upload marketing artwork error:', error);
    throw new Error(error.error || 'Failed to upload artwork');
  }

  const data = await response.json();
  console.log(`[API] Marketing artwork uploaded: ${data.artwork?.id}`);
  return data;
}

export async function deleteMarketingArtwork(artworkId: string) {
  console.log(`[API] Deleting marketing artwork: ${artworkId}`);
  const response = await fetch(`${API_BASE}/admin/marketing/artwork/${artworkId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Delete marketing artwork error:', error);
    throw new Error(error.error || 'Failed to delete artwork');
  }

  return await response.json();
}

export async function deleteMarketingArtworkVariant(artworkId: string, platform: string) {
  console.log(`[API] Deleting marketing artwork variant: ${artworkId}/${platform}`);
  const response = await fetch(`${API_BASE}/admin/marketing/artwork/${artworkId}/variant/${platform}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Delete artwork variant error:', error);
    throw new Error(error.error || 'Failed to delete variant');
  }

  return await response.json();
}

// ===== REFERRAL NETWORK API =====

// ===== ADMIN: STRIPE ORDERS =====

export async function fetchStripeOrders(cursor?: string): Promise<{
  orders: any[];
  has_more: boolean;
  next_cursor: string | null;
}> {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (cursor) params.set('starting_after', cursor);

  console.log(`[API] Fetching Stripe orders (cursor=${cursor || 'none'})`);
  const response = await fetch(`${API_BASE}/stripe/orders?${params.toString()}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch Stripe orders error:', error);
    throw new Error(error.error || 'Failed to fetch orders');
  }

  const data = await response.json();
  console.log(`[API] Stripe orders loaded: ${data.orders?.length} orders, has_more=${data.has_more}`);
  return data;
}

export async function fetchSchoolReferralSources() {
  console.log('[API] Fetching school referral sources');
  const response = await fetch(`${API_BASE}/referrals/school-sources`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch referral sources error:', error);
    throw new Error(error.error || 'Failed to fetch referral sources');
  }

  const data = await response.json();
  console.log(`[API] Referral sources: ${data.sources?.total} total, ${data.topReferrers?.length} referrers`);
  return data;
}

// ===== MEDIA MANAGER: CATEGORIES & AUDIO TRACKS =====

export async function fetchMediaCategories(): Promise<any[]> {
  console.log('[API] Fetching media categories');
  const response = await fetch(`${API_BASE}/media/categories`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch media categories error:', error);
    throw new Error(error.error || 'Failed to fetch categories');
  }
  const data = await response.json();
  return data.categories || [];
}

export async function saveMediaCategory(categoryData: {
  id?: string;
  name: string;
  type: 'video' | 'audio';
  icon?: string;
  color?: string;
  order?: number;
}) {
  console.log('[API] Saving media category:', categoryData.name);
  const response = await fetch(`${API_BASE}/media/categories`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(categoryData),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save category');
  }
  return await response.json();
}

export async function deleteMediaCategory(categoryId: string) {
  console.log('[API] Deleting media category:', categoryId);
  const response = await fetch(`${API_BASE}/media/categories/${categoryId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete category');
  }
  return await response.json();
}

export async function fetchAdminAudioTracks(): Promise<any[]> {
  console.log('[API] Fetching admin audio tracks');
  const response = await fetch(`${API_BASE}/media/audio`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch audio tracks');
  }
  const data = await response.json();
  return data.tracks || [];
}

export async function fetchPublicAudioTracks(): Promise<{ tracks: any[]; categories: any[] }> {
  console.log('[API] Fetching public audio tracks');
  const response = await fetch(`${API_BASE}/media/audio/public`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch audio');
  }
  return await response.json();
}

export async function saveAdminAudioTrack(trackData: {
  id?: string;
  title: string;
  artist?: string;
  album_art?: string;
  audio_url?: string;
  duration?: string;
  duration_sec?: number;
  category?: string;
  is_premium?: boolean;
  is_featured?: boolean;
  order?: number;
  status?: string;
}) {
  console.log('[API] Saving audio track:', trackData.title);
  const response = await fetch(`${API_BASE}/media/audio`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(trackData),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save audio track');
  }
  return await response.json();
}

export async function deleteAdminAudioTrack(trackId: string) {
  console.log('[API] Deleting audio track:', trackId);
  const response = await fetch(`${API_BASE}/media/audio/${trackId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete audio track');
  }
  return await response.json();
}

// ── Upload audio file (FormData — no base64 overhead) ──
export async function uploadAudioFile(file: File): Promise<{ audio_path: string; signed_url: string }> {
  console.log('[API] Uploading audio file:', file.name, `(${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  const formData = new FormData();
  formData.append('file', file);

  // Auth headers WITHOUT Content-Type — browser sets multipart boundary automatically
  const headers = await getAuthHeaders();
  delete headers['Content-Type'];

  const response = await fetch(`${API_BASE}/media/audio/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to upload audio file');
  }
  return await response.json();
}

// ── Upload album art (FormData — no base64 overhead) ──
export async function uploadAlbumArt(file: File): Promise<{ image_path: string; signed_url: string }> {
  console.log('[API] Uploading album art:', file.name, `(${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  const formData = new FormData();
  formData.append('file', file);

  // Auth headers WITHOUT Content-Type — browser sets multipart boundary automatically
  const headers = await getAuthHeaders();
  delete headers['Content-Type'];

  const response = await fetch(`${API_BASE}/media/audio/upload-art`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to upload album art');
  }
  return await response.json();
}

// ── Get signed playback URL for a track ──
export async function getAudioPlaybackUrl(trackId: string): Promise<{ audio_url: string; album_art: string }> {
  const response = await fetch(`${API_BASE}/media/audio-url/${trackId}`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to get audio URL');
  }
  return await response.json();
}

// (fileToBase64 removed — uploads now use FormData instead of base64 JSON)