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

export interface PaginatedQuestionResult {
  questions: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function fetchQuestionBank(filters?: {
  subject?: string;
  age_target?: number;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<any[]> {
  const params = new URLSearchParams();
  if (filters?.subject) params.set('subject', filters.subject);
  if (filters?.age_target) params.set('age_target', String(filters.age_target));
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.search) params.set('search', filters.search);

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
  console.log(`[API] Question bank: ${data.questions?.length} returned, page ${data.page}/${data.totalPages}, total ${data.total}`);
  return data.questions || [];
}

// Paginated version that returns full pagination metadata (for admin panel)
export async function fetchQuestionBankPaginated(filters?: {
  subject?: string;
  age_target?: number;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedQuestionResult> {
  const params = new URLSearchParams();
  if (filters?.subject) params.set('subject', filters.subject);
  if (filters?.age_target) params.set('age_target', String(filters.age_target));
  if (filters?.page) params.set('page', String(filters.page || 1));
  if (filters?.limit) params.set('limit', String(filters.limit || 50));
  if (filters?.search) params.set('search', filters.search);

  const url = `${API_BASE}/question-bank?${params.toString()}`;
  console.log(`[API] Fetching question bank (paginated): ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Fetch question bank paginated error:', error);
    throw new Error(error.error || 'Failed to fetch question bank');
  }

  const data = await response.json();
  console.log(`[API] Question bank paginated: ${data.questions?.length} returned, page ${data.page}/${data.totalPages}, total ${data.total}`);
  return {
    questions: data.questions || [],
    total: data.total || 0,
    page: data.page || 1,
    limit: data.limit || 50,
    totalPages: data.totalPages || 1,
  };
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

// Upload a question image to R2 (stored under mcq-header/ prefix)
export async function uploadQuestionImage(file: File): Promise<{ image_path: string; public_url: string }> {
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

// Upload an answer option image to R2 (stored under mcq-img/ prefix)
export async function uploadAnswerOptionImage(
  file: File,
  questionId: string,
  optionId: string
): Promise<{ image_path: string; public_url: string }> {
  console.log(`[API] Uploading answer option image: ${file.name} (${(file.size / 1024).toFixed(1)} KB) for ${questionId}/${optionId}`);

  const arrayBuffer = await file.arrayBuffer();
  const binary = new Uint8Array(arrayBuffer);
  let binaryStr = '';
  for (let i = 0; i < binary.length; i++) {
    binaryStr += String.fromCharCode(binary[i]);
  }
  const base64 = btoa(binaryStr);

  const response = await fetch(`${API_BASE}/answer-option-image`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      data: base64,
      filename: file.name,
      contentType: file.type,
      questionId,
      optionId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Upload answer option image error:', error);
    throw new Error(error.error || 'Failed to upload answer option image');
  }

  const data = await response.json();
  console.log(`[API] Answer option image uploaded: ${data.image_path}`);
  return data;
}

// Upload TTS audio file to R2 (stored under mcq-tts/{qId}/{lang} prefix)
export async function uploadQuestionTTS(
  file: File,
  questionId: string,
  lang: 'en' | 'ms' | 'zh'
): Promise<{ image_path: string; public_url: string }> {
  console.log(`[API] Uploading TTS audio: ${file.name} (${(file.size / 1024).toFixed(1)} KB) for ${questionId}/${lang}`);

  const headers = await getAuthHeaders();
  // FormData upload — remove Content-Type so browser sets multipart boundary
  delete (headers as any)['Content-Type'];

  const formData = new FormData();
  formData.append('file', file);
  formData.append('q_id', questionId);
  formData.append('lang', lang);

  const response = await fetch(`${API_BASE}/question-tts`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Upload TTS error:', error);
    throw new Error(error.error || 'Failed to upload TTS audio');
  }

  const data = await response.json();
  console.log(`[API] TTS audio uploaded: ${data.image_path} -> ${data.public_url}`);
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

export async function adminAddCurrency(targetUserId: string, amounts: { gold?: number; xp?: number; diamond?: number }, reason?: string) {
  console.log(`[API] Admin adding currency to ${targetUserId}:`, amounts);
  const response = await fetch(`${API_BASE}/admin/add-currency`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ targetUserId, ...amounts, reason: reason || 'admin_grant' }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Admin add currency error:', error);
    throw new Error(error.error || 'Failed to add currency');
  }

  const data = await response.json();
  console.log(`[API] Currency added. New balance:`, data.newBalance);
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

// ===== ADMIN: VIDEO CATEGORIES =====

export async function fetchVideoCategories() {
  const response = await fetch(`${API_BASE}/video-categories`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.categories || [];
}

export async function saveVideoCategory(catData: { id?: string; label: string; order?: number }) {
  console.log('[API] Saving video category:', catData.label);
  const response = await fetch(`${API_BASE}/admin/video-categories`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(catData),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save video category');
  }
  return await response.json();
}

export async function deleteVideoCategory(catId: string) {
  console.log('[API] Deleting video category:', catId);
  const response = await fetch(`${API_BASE}/admin/video-categories/${catId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete video category');
  }
  return await response.json();
}

// ===== ADMIN: SERIES MANAGEMENT =====

export async function fetchSeries() {
  const response = await fetch(`${API_BASE}/series`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.series || [];
}

export async function saveSeries(seriesData: {
  id?: string;
  title: string;
  description?: string;
  thumbnail?: string;
  category?: string;
  order?: number;
}) {
  console.log('[API] Saving series:', seriesData.title);
  const response = await fetch(`${API_BASE}/admin/series`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(seriesData),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save series');
  }
  return await response.json();
}

export async function deleteSeries(seriesId: string) {
  console.log('[API] Deleting series:', seriesId);
  const response = await fetch(`${API_BASE}/admin/series/${seriesId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete series');
  }
  return await response.json();
}

// ===== ADMIN: DYNTUBE =====

export async function uploadDyntubeVideo(file: File, title: string) {
  console.log('[API] Uploading video to DynTube:', title, `size=${file.size}`);
  const authHeaders = await getAuthHeaders();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);

  // Send FormData — don't set Content-Type, browser will set it with boundary
  const response = await fetch(`${API_BASE}/admin/dyntube/upload`, {
    method: 'POST',
    headers: {
      'X-User-Token': authHeaders['X-User-Token'] || '',
      'Authorization': authHeaders['Authorization'] || '',
    },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'DynTube upload failed');
  }
  return await response.json();
}

export async function getDyntubeVideoInfo(key: string) {
  const response = await fetch(`${API_BASE}/admin/dyntube/${key}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'DynTube fetch failed');
  }
  return await response.json();
}

// ===== ADMIN: KV → PG DATA MIGRATION =====
export async function triggerKvToPgMigration(): Promise<any> {
  console.log('[API] Triggering KV→PG data migration');
  const response = await fetch(`${API_BASE}/admin/migrate-kv-to-pg`, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] Migration error:', error);
    throw new Error(error.error || 'Migration failed');
  }

  const data = await response.json();
  console.log('[API] Migration results:', data);
  return data;
}

export async function scanKvKeys(): Promise<any> {
  console.log('[API] Scanning KV keys');
  const response = await fetch(`${API_BASE}/admin/kv-scan`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'KV scan failed');
  }
  return await response.json();
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
  dyntube_key?: string;
  thumbnail_url?: string;
  category: string;
  language?: string;
  duration?: string;
  episode?: number | null;
  series_id?: string | null;
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

export async function uploadVideoThumbnail(file: File): Promise<{ image_path: string; public_url: string; signed_url: string }> {
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

// ===== KG STUDENT MANAGEMENT =====

export async function fetchKGStudents(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/kg/students`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch students');
  }
  const data = await response.json();
  return data.students || [];
}

export async function fetchKGStudentDetail(parentId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/kg/student/${parentId}`, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch student detail');
  }
  return await response.json();
}

export async function disconnectKGStudent(parentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/kg/student/${parentId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to disconnect student');
  }
}

// ===== FLASHCARD SYSTEM =====

export async function fetchFlashcardCategories() {
  const response = await fetch(`${API_BASE}/flashcards/categories`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch flashcard categories');
  }
  const data = await response.json();
  return data.categories || [];
}

export async function saveFlashcardCategory(catData: {
  id?: string;
  name_en: string;
  name_bm?: string;
  name_zh?: string;
  emoji?: string;
  color?: string;
  order?: number;
  image_key?: string | null;
}) {
  const response = await fetch(`${API_BASE}/flashcards/categories`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(catData),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save category');
  }
  const data = await response.json();
  return data.category;
}

export async function deleteFlashcardCategory(catId: string) {
  const response = await fetch(`${API_BASE}/flashcards/categories/${catId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete category');
  }
  return await response.json();
}

export async function fetchFlashcards(categoryId?: string) {
  const params = categoryId ? `?category=${categoryId}` : '';
  const response = await fetch(`${API_BASE}/flashcards/cards${params}`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to fetch flashcards');
  }
  const data = await response.json();
  return data.cards || [];
}

export async function saveFlashcard(cardData: {
  id?: string;
  category_id: string;
  word_en: string;
  word_bm?: string;
  word_zh?: string;
  image_key?: string | null;
  video_key?: string | null;
  audio_en_key?: string | null;
  audio_bm_key?: string | null;
  audio_zh_key?: string | null;
  order?: number;
}) {
  const response = await fetch(`${API_BASE}/flashcards/cards`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(cardData),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to save flashcard');
  }
  const data = await response.json();
  return data.card;
}

export async function deleteFlashcard(cardId: string) {
  const response = await fetch(`${API_BASE}/flashcards/cards/${cardId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to delete flashcard');
  }
  return await response.json();
}

export async function uploadFlashcardCSV(csvText: string) {
  const response = await fetch(`${API_BASE}/flashcards/csv-upload`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ csv: csvText }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'CSV upload failed');
  }
  return await response.json();
}

export async function uploadFlashcardAsset(file: File, subfolder: string): Promise<{ key: string; publicUrl: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const response = await fetch(`${API_BASE}/flashcards/upload-asset`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ data: base64, filename: file.name, contentType: file.type, subfolder }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to upload asset');
  }
  return await response.json();
}

// ===== RPG ASSET MANAGER =====

export interface RPGAsset {
  slug: string;
  category: string;
  filename: string;
  r2Key: string;
  publicUrl: string;
  contentType: string;
  sizeKB: number;
  createdAt: string;
  updatedAt: string;
}

// ── In-memory cache for fetchRPGAssets (avoids re-fetching on every page navigation) ──
const RPG_CACHE_TTL_MS = 60_000; // 60s — short enough for dev, long enough for seamless nav
let _rpgCacheAll: { assets: RPGAsset[]; categories: string[]; total: number } | null = null;
let _rpgCacheAllTime = 0;
const _rpgCategoryCache = new Map<string, { data: { assets: RPGAsset[]; categories: string[]; total: number }; time: number }>();

/** Invalidate the RPG assets cache (call after admin uploads/deletes) */
export function invalidateRPGAssetsCache() {
  _rpgCacheAll = null;
  _rpgCacheAllTime = 0;
  _rpgCategoryCache.clear();
  console.log('[API] RPG assets cache invalidated');
}

/** Preload images into browser cache so they render instantly on navigation */
export function preloadImages(urls: (string | undefined | null)[]) {
  for (const url of urls) {
    if (url) {
      const img = new Image();
      img.src = url;
    }
  }
}

export async function fetchRPGAssets(category?: string): Promise<{ assets: RPGAsset[]; categories: string[]; total: number }> {
  // Cache disabled — always fetch fresh from server
  const params = category && category !== 'all' ? `?category=${category}` : '';
  const response = await fetch(`${API_BASE}/rpg-assets${params}`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch RPG assets');
  }
  const result = await response.json();
  console.log('[API] RPG assets fetched fresh:', result.assets?.map((a: any) => a.slug).join(', '));
  return result;
}

export async function uploadRPGAsset(file: File, slug: string, category: string): Promise<{ asset: RPGAsset }> {
  const headers = await getAuthHeaders();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const response = await fetch(`${API_BASE}/rpg-assets/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: base64, filename: file.name, contentType: file.type, slug, category }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to upload RPG asset');
  }
  return await response.json();
}

export async function deleteRPGAsset(slug: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/rpg-assets/${slug}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to delete RPG asset');
  }
}

// ===== RPG GAME ENTITY API =====
// Game-aware entity CRUD + Supabase Storage file management

export type RPGEntityType = 'zone' | 'spirit' | 'power' | 'character' | 'map';

export interface RPGGameEntity {
  id: string;
  type: RPGEntityType;
  name?: string;
  assets?: Record<string, string>; // key → storage path
  [key: string]: any;
}

// Upload file to Supabase Storage (returns signed URL)
export async function rpgGameUpload(
  file: File,
  storagePath: string,
): Promise<{ path: string; signedUrl: string | null; sizeKB: number }> {
  const headers = await getAuthHeaders();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const response = await fetch(`${API_BASE}/rpg-game/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: base64,
      filename: file.name,
      contentType: file.type,
      path: storagePath,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to upload RPG game file');
  }
  const result = await response.json();
  return result;
}

// Delete file from Supabase Storage
export async function rpgGameDeleteFile(storagePath: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/rpg-game/file`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ path: storagePath }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to delete file');
  }
}

// Get signed URL for a storage file
export async function rpgGameSignedUrl(storagePath: string): Promise<string | null> {
  const response = await fetch(`${API_BASE}/rpg-game/signed-url`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify({ path: storagePath }),
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result.signedUrl || null;
}

// Batch signed URLs
export async function rpgGameSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const response = await fetch(`${API_BASE}/rpg-game/signed-urls`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify({ paths }),
  });
  if (!response.ok) return {};
  const result = await response.json();
  return result.urls || {};
}

// List files in a storage folder
export async function rpgGameListFiles(folder: string): Promise<any[]> {
  const response = await fetch(`${API_BASE}/rpg-game/files?folder=${encodeURIComponent(folder)}`, {
    headers: getPublicHeaders(),
  });
  if (!response.ok) return [];
  const result = await response.json();
  return result.files || [];
}

// Save entity (create or update)
export async function rpgGameSaveEntity(
  type: RPGEntityType,
  id: string,
  data: Record<string, any>,
): Promise<RPGGameEntity> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/rpg-game/entity`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type, id, data }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to save ${type}`);
  }
  const result = await response.json();
  return result.entity;
}

// List entities by type
export async function rpgGameListEntities(type: RPGEntityType): Promise<RPGGameEntity[]> {
  const response = await fetch(`${API_BASE}/rpg-game/entities/${type}`, {
    headers: getPublicHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to list ${type}s`);
  }
  const result = await response.json();
  return result.entities || [];
}

// Get single entity
export async function rpgGameGetEntity(type: RPGEntityType, id: string): Promise<RPGGameEntity | null> {
  const response = await fetch(`${API_BASE}/rpg-game/entity/${type}/${id}`, {
    headers: getPublicHeaders(),
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result.entity || null;
}

// Delete entity
export async function rpgGameDeleteEntity(type: RPGEntityType, id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/rpg-game/entity/${type}/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to delete ${type}`);
  }
}

// ===== SHOP ITEM API =====

export interface ShopItemEffect {
  type: 'xp' | 'energy' | 'hp' | 'level' | 'gold' | 'shield' | 'time_extend' | 'attack' | 'defense' | 'speed' | 'max_hp' | 'xp_percent' | 'hatch_accelerator' | 'daily_refresh' | 'treasure_map';
  value: number;
  isPercent: boolean;
}

export type EquipSlot = 'weapon' | 'armor' | 'boots' | 'accessory';

export interface ShopItemDef {
  id: string;
  name: string;
  description: string;
  imageSlug: string;
  price: number;
  currency: 'gold' | 'diamond';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'consumable' | 'battle' | 'treasure';
  effects: ShopItemEffect[];
  battleLimit?: number;
  /** Equipment slot — only used when category = 'treasure' */
  equipSlot?: EquipSlot;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: string;
}

/** Equipment bonuses computed from all equipped items */
export interface EquipmentBonuses {
  attack: number;
  defense: number;
  speed: number;
  max_hp: number;
  /** XP multiplier bonus (e.g. 10 = +10% → 1.1× XP). Bible v5: Focus Necklace = 10 */
  xp_percent: number;
}

const EQUIP_STORAGE_KEY = 'foxy_equipped_v1';
const EQUIP_BONUSES_KEY = 'foxy_equip_bonuses_v1';

/** Read equipped items map: slot → itemId */
export function loadEquipped(): Partial<Record<EquipSlot, string>> {
  try {
    const raw = localStorage.getItem(EQUIP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Save equipped items map */
export function saveEquipped(map: Partial<Record<EquipSlot, string>>) {
  localStorage.setItem(EQUIP_STORAGE_KEY, JSON.stringify(map));
}

/** Read cached equipment bonuses */
export function loadEquipmentBonuses(): EquipmentBonuses {
  try {
    const raw = localStorage.getItem(EQUIP_BONUSES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { attack: 0, defense: 0, speed: 0, max_hp: 0, xp_percent: 0 };
}

/** Recompute and cache equipment bonuses from equipped items + shop item definitions */
export function recomputeEquipmentBonuses(
  equipped: Partial<Record<EquipSlot, string>>,
  allItems: ShopItemDef[],
): EquipmentBonuses {
  const bonuses: EquipmentBonuses = { attack: 0, defense: 0, speed: 0, max_hp: 0, xp_percent: 0 };
  const itemMap = new Map(allItems.map(i => [i.id, i]));

  for (const itemId of Object.values(equipped)) {
    if (!itemId) continue;
    const item = itemMap.get(itemId);
    if (!item?.effects) continue;
    for (const eff of item.effects) {
      if (eff.type === 'attack') bonuses.attack += eff.value;
      if (eff.type === 'defense') bonuses.defense += eff.value;
      if (eff.type === 'speed') bonuses.speed += eff.value;
      if (eff.type === 'max_hp') bonuses.max_hp += eff.value;
      if (eff.type === 'xp_percent') bonuses.xp_percent += eff.value;
    }
  }

  localStorage.setItem(EQUIP_BONUSES_KEY, JSON.stringify(bonuses));
  return bonuses;
}

export async function fetchShopItems(): Promise<{ items: ShopItemDef[] }> {
  const response = await fetch(`${API_BASE}/shop/items`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch shop items');
  }
  return await response.json();
}

export async function saveShopItem(item: Partial<ShopItemDef>): Promise<{ item: ShopItemDef }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/shop/items`, {
    method: 'POST',
    headers,
    body: JSON.stringify(item),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save shop item');
  }
  return await response.json();
}

export async function deleteShopItem(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/shop/items/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to delete shop item');
  }
}

// ===== SHOP REALM AVAILABILITY =====

/** Fetch realm store availability map (itemId → boolean). Items NOT in the map default to true (available). */
export async function fetchRealmStoreAvailability(): Promise<Record<string, boolean>> {
  const response = await fetch(`${API_BASE}/shop/realm-availability`, { headers: getPublicHeaders() });
  if (!response.ok) {
    console.warn('[API] Failed to fetch realm store availability');
    return {};
  }
  const data = await response.json();
  return data.availability || {};
}

/** Save realm store availability map (admin only) */
export async function saveRealmStoreAvailability(availability: Record<string, boolean>): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/shop/realm-availability`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ availability }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save realm store availability');
  }
}

export async function fetchPlayerInventory(userId: string): Promise<{ inventory: { slots: { itemId: string; quantity: number }[]; lastUpdated: string | null } }> {
  const response = await fetch(`${API_BASE}/shop/inventory/${userId}`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch inventory');
  }
  return await response.json();
}

export async function buyShopItem(userId: string, itemId: string, quantity?: number): Promise<any> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/shop/inventory/${userId}/buy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemId, quantity: quantity || 1 }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to buy item');
  }
  return await response.json();
}

/**
 * Grant an item to a player's inventory without payment (for evolution rewards).
 * Optionally upserts the item definition to the shop_item KV so BagPage can render it.
 */
export async function grantItemToInventory(
  userId: string,
  itemId: string,
  itemDef?: {
    name: string;
    description: string;
    rarity: string;
    equipSlot?: string;
    effects: { type: string; value: number; isPercent?: boolean }[];
    imageSlug?: string;
  },
): Promise<any> {
  const response = await fetch(`${API_BASE}/shop/inventory/${userId}/grant`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify({ itemId, itemDef }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[API] grantItemToInventory failed:', err);
    throw new Error(err.error || 'Failed to grant item');
  }
  return await response.json();
}

// ===== BATTLE SKILL API =====

export interface BattleSkillDef {
  id: string;
  name: string;
  nameMs: string;
  nameZh: string;
  description: string;
  descriptionMs: string;
  descriptionZh: string;
  subject: string;     // 'mandarin' | 'english' | 'math' | 'science' | 'bm'
  element: string;     // Aeluris 7-element: 'fire' | 'water' | 'wood' | 'thunder' | 'earth' | 'shadow' | 'gold'
  baseDamage: number;
  accuracy?: number;   // 0-100 (default 95)
  powerType?: string;  // 'attack' | 'defense' | 'heal' | 'buff' | 'debuff' | 'special'
  iconSlug: string;    // RPG Asset slug
  color: string;       // hex
  glowColor: string;   // hex
  ageMin: number;
  ageMax: number;
  sortOrder: number;
  isActive: boolean;
  updatedAt?: string;
}

export async function fetchBattleSkills(): Promise<{ skills: BattleSkillDef[] }> {
  const response = await fetch(`${API_BASE}/battle/skills`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch battle skills');
  }
  return await response.json();
}

export async function saveBattleSkill(skill: Partial<BattleSkillDef>): Promise<{ skill: BattleSkillDef }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/battle/skills`, {
    method: 'POST',
    headers,
    body: JSON.stringify(skill),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save battle skill');
  }
  return await response.json();
}

export async function deleteBattleSkill(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/battle/skills/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to delete battle skill');
  }
}

// ===== REALM REWARD CONFIG (Gold Economy) =====

export async function fetchRewardConfig(): Promise<any> {
  const response = await fetch(`${API_BASE}/realm/reward-config`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch reward config');
  }
  const result = await response.json();
  return result.config || null;
}

export async function saveRewardConfig(config: any): Promise<any> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/realm/reward-config`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ config }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save reward config');
  }
  return await response.json();
}

export async function fetchEconomyAnalytics(): Promise<any> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/realm/economy-analytics`, { headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch economy analytics');
  }
  const result = await response.json();
  return result.analytics || null;
}

// ===== PRACTICE GATE CONFIG =====

export async function fetchPracticeGateConfig(): Promise<any> {
  const response = await fetch(`${API_BASE}/realm/practice-gate-config`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch practice gate config');
  }
  const result = await response.json();
  return result.config || null;
}

export async function savePracticeGateConfig(config: any): Promise<any> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/realm/practice-gate-config`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ config }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save practice gate config');
  }
  return await response.json();
}

// ===== DAILY LIMIT TRACKING =====

export async function fetchDailyLog(userId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/realm/daily-log/${userId}`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch daily log');
  }
  return await response.json();
}

export async function recordDailyActivity(userId: string, activityType: string, scoreData?: {
  questionsTotal: number;
  questionsCorrect: number;
}): Promise<{
  success?: boolean;
  goldAwarded: number;
  xpAwarded: number;
  isLimited: boolean;
  dailyGoldCapped: boolean;
  activityCount: number;
  maxPerDay: number;
  isPaid: boolean;
  accessBlocked: boolean;
}> {
  const response = await fetch(`${API_BASE}/realm/daily-log/${userId}`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify({ activityType, ...(scoreData || {}) }),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    // If access blocked (403 with accessBlocked flag), return structured data instead of throwing
    if (data.accessBlocked) {
      return {
        goldAwarded: 0,
        xpAwarded: 0,
        isLimited: true,
        dailyGoldCapped: true,
        activityCount: data.currentCount || 0,
        maxPerDay: data.maxPerDay || 0,
        isPaid: data.isPaid || false,
        accessBlocked: true,
      };
    }
    throw new Error(data.error || 'Failed to record daily activity');
  }
  return data;
}

// ===== REALM STATS & QUEST PERSISTENCE =====

export async function fetchRealmStats(userId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/realm/stats/${userId}`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch realm stats');
  }
  const result = await response.json();
  return result.stats;
}

export async function saveRealmStats(userId: string, stats: any): Promise<void> {
  const response = await fetch(`${API_BASE}/realm/stats/${userId}`, {
    method: 'PUT',
    headers: getPublicHeaders(),
    body: JSON.stringify({ stats }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save realm stats');
  }
}

// ── Diamond Inbox: check + claim pending diamond grants (Bible v5: referral rewards) ──
export async function fetchDiamondInbox(userId: string): Promise<{ total: number; grants: Array<{ amount: number; reason: string; grantedAt: string }> }> {
  const response = await fetch(`${API_BASE}/realm/diamond-inbox/${userId}`, { headers: getPublicHeaders() });
  if (!response.ok) {
    console.warn('[API] Diamond inbox fetch failed');
    return { total: 0, grants: [] };
  }
  const result = await response.json();
  return result.inbox || { total: 0, grants: [] };
}

export async function claimDiamondInbox(userId: string): Promise<{ claimed: number; grants: Array<{ amount: number; reason: string; grantedAt: string }> }> {
  const response = await fetch(`${API_BASE}/realm/diamond-inbox/${userId}`, {
    method: 'DELETE',
    headers: getPublicHeaders(),
  });
  if (!response.ok) {
    console.warn('[API] Diamond inbox claim failed');
    return { claimed: 0, grants: [] };
  }
  const result = await response.json();
  return { claimed: result.claimed || 0, grants: result.grants || [] };
}

// ── Special Shop Item: Daily Quest Refresh (reset daily activity counters) ──
export async function triggerDailyRefresh(userId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/realm/daily-refresh/${userId}`, {
    method: 'POST',
    headers: getPublicHeaders(),
  });
  if (!response.ok) {
    console.warn('[API] Daily refresh failed');
    return { success: false };
  }
  return await response.json();
}

export async function fetchRealmQuests(userId: string): Promise<{
  completedQuests: string[];
  moduleResults: Record<string, { score: number; total: number }>;
  questStars: Record<string, number>;
}> {
  const response = await fetch(`${API_BASE}/realm/quests/${userId}`, { headers: getPublicHeaders() });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch realm quests');
  }
  const result = await response.json();
  return result.data;
}

export async function saveRealmQuests(userId: string, data: {
  completedQuests: string[];
  moduleResults: Record<string, { score: number; total: number }>;
  questStars: Record<string, number>;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/realm/quests/${userId}`, {
    method: 'PUT',
    headers: getPublicHeaders(),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to save realm quests');
  }
}

// ===== KINDERGARTEN DATABASE (Postgres) =====

export async function uploadKGCSV(csvText: string, columnMapping?: Record<string, string>): Promise<{
  success: boolean;
  total_rows: number;
  inserted: number;
  skipped: number;
  errors: string[];
  detected_headers: string[];
  column_mapping: Record<string, number>;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/csv-upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ csvText, columnMapping }),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] KG CSV upload error:', data);
    throw new Error(data.error || 'Failed to upload CSV');
  }
  return data;
}

export async function fetchKGList(params: {
  search?: string;
  status?: string;
  state?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  kindergartens: any[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}> {
  const headers = await getAuthHeaders();
  const qp = new URLSearchParams();
  if (params.search) qp.set('search', params.search);
  if (params.status) qp.set('status', params.status);
  if (params.state) qp.set('state', params.state);
  if (params.page) qp.set('page', String(params.page));
  if (params.limit) qp.set('limit', String(params.limit));

  const response = await fetch(`${API_BASE}/kg-db/list?${qp.toString()}`, { headers });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] KG list error:', data);
    throw new Error(data.error || 'Failed to fetch kindergartens');
  }
  return data;
}

export async function fetchKGStats(): Promise<{
  total: number;
  unclaimed: number;
  claimed: number;
  active: number;
  pending_requests: number;
  by_state: Record<string, number>;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/stats`, { headers });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Failed to fetch KG stats');
  return data.stats;
}

export async function searchKindergartens(params: { q?: string; postcode?: string }): Promise<{
  results: { id: string; name: string; address: string; postcode: string; state: string; city: string; status: string }[];
}> {
  const qp = new URLSearchParams();
  if (params.q) qp.set('q', params.q);
  if (params.postcode) qp.set('postcode', params.postcode);

  const response = await fetch(`${API_BASE}/kg-db/search?${qp.toString()}`, { headers: getPublicHeaders() });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Search failed');
  return data;
}

export async function claimKindergarten(claimCode: string): Promise<{ success: boolean; kindergarten: any; message: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ claim_code: claimCode }),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Claim failed');
  return data;
}

export async function submitKGRequest(params: {
  kg_name: string;
  kg_location?: string;
  kg_postcode?: string;
  principal_name?: string;
  principal_phone?: string;
  principal_email?: string;
  parent_message?: string;
  parent_id?: string;
}): Promise<{ success: boolean; request_id: string; message: string }> {
  const response = await fetch(`${API_BASE}/kg-db/requests`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function fetchKGRequests(status?: string): Promise<{ requests: any[] }> {
  const headers = await getAuthHeaders();
  const qp = status ? `?status=${status}` : '';
  const response = await fetch(`${API_BASE}/kg-db/requests${qp}`, { headers });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Failed to fetch requests');
  return data;
}

export async function updateKGRequest(id: string, status: string, adminNotes?: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/requests/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status, admin_notes: adminNotes }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(data.error || 'Failed to update request');
  }
}

export async function setKGTrialDuration(kgId: string, months: number, planTier?: string): Promise<{
  success: boolean;
  kindergarten_id: string;
  plan_tier: string;
  trial_start: string;
  trial_expires_at: string;
  months: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/${kgId}/trial`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ months, plan_tier: planTier }),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Set KG trial error:', data);
    throw new Error(data.error || 'Failed to set trial duration');
  }
  return data;
}

export async function bulkSetKGTrial(months: number, statusFilter?: string, planTier?: string): Promise<{
  success: boolean;
  affected: number;
  plan_tier: string;
  trial_expires_at: string;
  months: number;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/bulk-trial`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ months, status_filter: statusFilter, plan_tier: planTier }),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Bulk set KG trial error:', data);
    throw new Error(data.error || 'Failed to bulk set trial');
  }
  return data;
}

export async function updateKG(kgId: string, fields: Record<string, any>): Promise<{ success: boolean; kindergarten: any }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/${kgId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(fields),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Update KG error:', data);
    throw new Error(data.error || 'Failed to update kindergarten');
  }
  return data;
}

export async function createKG(fields: Record<string, any>): Promise<{ success: boolean; kindergarten: any }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(fields),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Create KG error:', data);
    throw new Error(data.error || 'Failed to create kindergarten');
  }
  return data;
}

export async function deleteKG(kgId: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/${kgId}`, {
    method: 'DELETE',
    headers,
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Delete KG error:', data);
    throw new Error(data.error || 'Failed to delete kindergarten');
  }
  return data;
}

// ===== KG CLAIM FLOW =====

export async function validateClaimCode(code: string): Promise<{ valid: boolean; kindergarten?: any; error?: string }> {
  const response = await fetch(`${API_BASE}/kg-db/validate-claim-code?code=${encodeURIComponent(code)}`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok && response.status !== 404 && response.status !== 409) {
    console.error('[API] Validate claim code error:', data);
    throw new Error(data.error || 'Validation failed');
  }
  return data;
}

export async function submitClaimSignup(params: {
  claim_code: string;
  name: string;
  email: string;
  password: string;
  whatsapp?: string;
  phone?: string;
}): Promise<{ success: boolean; message: string; claim?: any }> {
  const response = await fetch(`${API_BASE}/kg-db/claim-signup`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Claim signup error:', data);
    throw new Error(data.error || 'Claim signup failed');
  }
  return data;
}

export async function fetchPendingClaims(): Promise<{ claims: any[]; pending_count: number; total: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/pending-claims`, {
    method: 'GET',
    headers,
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Pending claims error:', data);
    throw new Error(data.error || 'Failed to fetch pending claims');
  }
  return data;
}

export async function approveClaim(claimCode: string, adminNotes?: string): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/claim-approve`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ claim_code: claimCode, admin_notes: adminNotes }),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Approve claim error:', data);
    throw new Error(data.error || 'Failed to approve claim');
  }
  return data;
}

export async function rejectClaim(claimCode: string, adminNotes?: string): Promise<{ success: boolean; message: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/kg-db/claim-reject`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ claim_code: claimCode, admin_notes: adminNotes }),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] Reject claim error:', data);
    throw new Error(data.error || 'Failed to reject claim');
  }
  return data;
}

// ===== NEW KG SIGNUP (no claim code) =====

export async function submitNewKGSignup(params: {
  kg_name: string;
  kg_address?: string;
  kg_city?: string;
  kg_state?: string;
  kg_postcode?: string;
  name: string;
  email: string;
  password: string;
  whatsapp?: string;
  phone?: string;
}): Promise<{ success: boolean; message: string; user_id?: string; school_id?: string; request_id?: string }> {
  const response = await fetch(`${API_BASE}/kg-db/new-kg-signup`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] New KG signup error:', data);
    throw new Error(data.error || 'Registration failed');
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════════════
// FMCG QR COLLABORATION SYSTEM (Prompt 2)
// ═══════════════════════════════════════════════════════════════════════

export interface FMCGRewardConfig {
  type: 'gold' | 'diamonds' | 'bagSlot' | 'existingItem' | 'customItem' | 'premiumDays';
  amount?: number;
  itemId?: string;
  quantity?: number;  // how many codes get this specific reward (loot table mode)
  label?: string;     // human-readable label for CSV e.g. "Gold_x100"
}

export interface FMCGCampaign {
  id: string;
  name: string;
  brandName: string;
  brandLogoUrl: string;
  brandColour: string;
  batchSize: number;
  startDate: string;
  expiryDate: string;
  status: 'draft' | 'active' | 'expired';
  rewardConfig: FMCGRewardConfig[];
  customItemId?: string | null;
  partnerEmail?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _claimedCount?: number;
  // Enriched fields (from list endpoint)
  liveStatus?: 'draft' | 'upcoming' | 'active' | 'expired';
  totalCodes?: number;
  claimedCount?: number;
  // CSV/generation fields
  csvUrl?: string;
  csvR2Key?: string;
  generatedTotal?: number;
  kvTracked?: number;
}

export interface FMCGCustomItem {
  name: string;
  emoji?: string;
  equipSlot?: string;
  statType?: string;
  statValue?: number;
  flavourText?: string;
}

export interface FMCGQRCode {
  code: string;
  campaignId: string;
  claimedBy: string | null;
  claimedAt: string | null;
}

export interface FMCGClaimResult {
  success: boolean;
  status: 'claimed' | 'already_claimed' | 'expired' | 'upcoming' | 'invalid' | 'unauthorized' | 'error';
  brandName?: string;
  brandLogoUrl?: string;
  brandColour?: string;
  campaignName?: string;
  rewards?: Array<{ type: string; amount: number; label: string; emoji?: string; fallback?: boolean }>;
  error?: string;
  expiryDate?: string;
  startDate?: string;
  claimedAt?: string;
}

// ── Logo Upload ──

export async function uploadFMCGLogo(file: File): Promise<{ publicUrl: string; key: string }> {
  const headers = await getAuthHeaders();
  // Remove Content-Type — browser will set multipart/form-data with boundary automatically
  delete headers['Content-Type'];
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/fmcg/upload-logo`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] FMCG logo upload error:', data);
    throw new Error(data.error || 'Failed to upload logo');
  }
  return data;
}

// ── Campaign CRUD (SuperAdmin) ──

export async function fetchFMCGCampaigns(): Promise<{ campaigns: FMCGCampaign[] }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/campaigns`, { headers });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] FMCG campaigns list error:', data);
    throw new Error(data.error || 'Failed to fetch campaigns');
  }
  return data;
}

export async function fetchFMCGCampaign(id: string): Promise<{ campaign: FMCGCampaign }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/campaigns/${id}`, { headers });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Failed to fetch campaign');
  return data;
}

export async function createFMCGCampaign(campaign: {
  name: string;
  brandName: string;
  brandLogoUrl?: string;
  brandColour?: string;
  batchSize: number;
  startDate: string;
  expiryDate: string;
  rewardConfig: FMCGRewardConfig[];
  customItem?: FMCGCustomItem;
  partnerEmail?: string;
}): Promise<{ campaign: FMCGCampaign }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/campaigns`, {
    method: 'POST',
    headers,
    body: JSON.stringify(campaign),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] FMCG create campaign error:', data);
    throw new Error(data.error || 'Failed to create campaign');
  }
  return data;
}

export async function updateFMCGCampaign(id: string, updates: Partial<FMCGCampaign>): Promise<{ campaign: FMCGCampaign }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/campaigns/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Failed to update campaign');
  return data;
}

export async function deleteFMCGCampaign(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/campaigns/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(data.error || 'Failed to delete campaign');
  }
}

// ── QR Batch Generation ──

export async function generateFMCGCodes(campaignId: string): Promise<{ generated: number; kvTracked?: number; csvUrl?: string; status: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/campaigns/${campaignId}/generate-codes`, {
    method: 'POST',
    headers,
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    console.error('[API] FMCG generate codes error:', data);
    throw new Error(data.error || 'Failed to generate codes');
  }
  return data;
}

export async function fetchFMCGCodes(campaignId: string, params?: {
  status?: 'claimed' | 'unclaimed';
  page?: number;
  limit?: number;
}): Promise<{ codes: FMCGQRCode[]; total: number; page: number; pages: number }> {
  const headers = await getAuthHeaders();
  const qp = new URLSearchParams();
  if (params?.status) qp.set('status', params.status);
  if (params?.page) qp.set('page', String(params.page));
  if (params?.limit) qp.set('limit', String(params.limit));

  const response = await fetch(`${API_BASE}/fmcg/campaigns/${campaignId}/codes?${qp.toString()}`, { headers });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Failed to fetch codes');
  return data;
}

export function getFMCGCodesCSVUrl(campaignId: string): string {
  return `${API_BASE}/fmcg/campaigns/${campaignId}/codes/csv`;
}

// ── QR Scan & Claim (Part A) ──

export async function resolveQRCode(code: string): Promise<{
  success: boolean;
  code: string;
  campaignId: string;
  brandName: string;
  brandLogoUrl: string;
  brandColour: string;
  campaignName: string;
  campaignStatus: string;
  isClaimed: boolean;
  claimedAt?: string;
  rewardConfig: FMCGRewardConfig[];
  startDate: string;
  expiryDate: string;
  status?: string;
  error?: string;
}> {
  const response = await fetch(`${API_BASE}/fmcg/qr/${encodeURIComponent(code)}`, {
    headers: getPublicHeaders(),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error', status: 'invalid' }));
  if (!response.ok && response.status === 404) {
    return { ...data, success: false };
  }
  return data;
}

export async function claimQRCode(code: string): Promise<FMCGClaimResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error', status: 'error' }));
  return data;
}

// ── Partner Portal (Part C) ──

export async function fetchPartnerCampaigns(): Promise<{ campaigns: any[] }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/partner/campaigns`, { headers });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Failed to fetch partner campaigns');
  return data;
}

export async function fetchPartnerCampaignStats(campaignId: string): Promise<{
  campaign: any;
  stats: {
    totalCodes: number;
    totalClaimed: number;
    redemptionRate: string;
    newUserSignups: number;
    claimsByDay: Array<{ date: string; count: number }>;
    claimsByHour: Array<{ hour: string; count: number }>;
    claimsByRegion: Array<{ region: string; count: number }>;
    ageGroupBreakdown: Array<{ group: string; count: number }>;
  };
}> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}/fmcg/partner/campaigns/${campaignId}/stats`, { headers });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) throw new Error(data.error || 'Failed to fetch partner stats');
  return data;
}