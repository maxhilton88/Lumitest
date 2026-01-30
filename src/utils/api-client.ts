import { projectId, publicAnonKey } from './supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

// Storage for auth token
let authToken: string | null = null;

// Initialize token from localStorage
if (typeof window !== 'undefined') {
  authToken = localStorage.getItem('foxy_auth_token');
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('foxy_auth_token', token);
    } else {
      localStorage.removeItem('foxy_auth_token');
    }
  }
}

export function getAuthToken() {
  return authToken;
}

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken || publicAnonKey}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

// ============================================
// AUTH API
// ============================================

export interface SignupData {
  name: string;
  email: string;
  password: string;
  schoolName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export async function signup(data: SignupData) {
  const response = await apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  if (response.access_token) {
    setAuthToken(response.access_token);
  }
  
  return response;
}

export async function login(data: LoginData) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  if (response.access_token) {
    setAuthToken(response.access_token);
  }
  
  return response;
}

export async function checkSession() {
  try {
    const response = await apiRequest('/auth/session');
    return response;
  } catch (error) {
    setAuthToken(null);
    throw error;
  }
}

export function logout() {
  setAuthToken(null);
}

// ============================================
// QUESTIONS API
// ============================================

export interface Question {
  id?: string;
  type: 'mcq' | 'dragdrop' | 'hotspot' | 'sequence';
  question: { en: string; ms: string; zh: string };
  options?: Array<{
    id: string;
    text?: { en: string; ms: string; zh: string };
    image?: string;
    position?: { x: number; y: number; width: number; height: number };
  }>;
  correctAnswer: string;
  foxyMessage?: { en: string; ms: string; zh: string };
  hotspotImage?: string;
  language: 'global' | 'en' | 'ms' | 'zh';
  ageDifficulty: 4 | 5 | 6 | 7;
  quest: string;
  skills: string[];
  tags: string[];
  isLumiOfficial?: boolean;
  createdAt?: string;
}

export async function getQuestions(filters?: {
  quest?: string;
  age?: number;
  language?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.quest) params.append('quest', filters.quest);
  if (filters?.age) params.append('age', filters.age.toString());
  if (filters?.language) params.append('language', filters.language);
  
  const queryString = params.toString();
  const endpoint = `/questions${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiRequest(endpoint);
  return response.questions as Question[];
}

export async function createQuestion(question: Question) {
  const response = await apiRequest('/questions', {
    method: 'POST',
    body: JSON.stringify(question),
  });
  return response.question as Question;
}

export async function updateQuestion(id: string, question: Question) {
  const response = await apiRequest(`/questions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(question),
  });
  return response.question as Question;
}

export async function deleteQuestion(id: string) {
  await apiRequest(`/questions/${id}`, {
    method: 'DELETE',
  });
}

export async function bulkUploadQuestions(questions: Question[]) {
  const response = await apiRequest('/questions/bulk', {
    method: 'POST',
    body: JSON.stringify({ questions }),
  });
  return response.questions as Question[];
}

// ============================================
// QUEST CONFIGS API
// ============================================

export interface QuestConfig {
  language: 'global' | 'en' | 'ms' | 'zh';
  numberOfQuestions: number;
  skillFilters: string[];
}

export type QuestConfigs = Record<string, QuestConfig>;

export async function getQuestConfigs() {
  const response = await apiRequest('/quests');
  return response.configs as QuestConfigs;
}

export async function updateQuestConfig(questId: string, config: QuestConfig) {
  const response = await apiRequest(`/quests/${questId}`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
  return response.config as QuestConfig;
}

// ============================================
// LEADS API
// ============================================

export interface Lead {
  id?: string;
  childName: string;
  parentName: string;
  whatsapp: string;
  age: number;
  score: number;
  totalQuestions: number;
  detailedAnswers?: any[];
  questResults?: any[];
  agePerformance?: any[];
  completedAt?: string;
}

export async function submitTestResult(schoolId: string, lead: Lead) {
  const response = await apiRequest('/leads', {
    method: 'POST',
    body: JSON.stringify({
      schoolId,
      ...lead,
    }),
  });
  return response.result;
}

export async function getLeads(limit = 100, offset = 0) {
  const response = await apiRequest(`/leads?limit=${limit}&offset=${offset}`);
  return response.leads as Lead[];
}

// ============================================
// SETTINGS API
// ============================================

export interface Settings {
  schoolName: string;
  logoUrl: string;
  primaryColor: string;
  kindergartenUrl: string;
  testPageBgColor: string;
  mapBackgroundImage: string;
  testBackgroundImage: string;
  subscriptionStatus?: string;
}

export async function getSettings() {
  const response = await apiRequest('/settings');
  return response.settings as Settings;
}

export async function updateSettings(settings: Settings) {
  const response = await apiRequest('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
  return response.settings as Settings;
}
