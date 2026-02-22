// Parent ecosystem API functions
import { projectId, publicAnonKey } from './supabase/info';
import { parentAuthClient, getFreshParentToken, isJwtExpired } from './supabase-client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

function getPublicHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
  };
}

// Now async — uses Supabase client's auto-refresh to get a fresh token
async function getParentAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
  };
  // Try Supabase client first (auto-refreshes expired tokens)
  const freshToken = await getFreshParentToken();
  if (freshToken) {
    headers['X-User-Token'] = `Bearer ${freshToken}`;
  } else {
    // Fallback to raw localStorage for backwards compat — but reject expired tokens
    const token = localStorage.getItem('parent_access_token');
    if (token && !isJwtExpired(token)) {
      headers['X-User-Token'] = `Bearer ${token}`;
    } else if (token) {
      // Token is expired and refresh failed — clean up stale state
      console.warn('[PARENT-API] localStorage token is expired, clearing stale session');
      localStorage.removeItem('parent_access_token');
      localStorage.removeItem('parent_id');
      localStorage.removeItem('parent_data');
    }
  }
  return headers;
}

// ===== PARENT AUTH =====

export async function parentSignup(data: {
  email: string;
  password: string;
  name: string;
  originTag?: string;
  referredBy?: string;
}) {
  console.log('[PARENT-API] Signup:', data.email);
  const response = await fetch(`${API_BASE}/parent/signup`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify(data),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Signup failed');
  }

  // Store session
  if (result.session?.access_token) {
    localStorage.setItem('parent_access_token', result.session.access_token);
    localStorage.setItem('parent_id', result.user.id);
    localStorage.setItem('parent_data', JSON.stringify(result.parent));

    // Establish session on the Supabase client so auto-refresh works
    await parentAuthClient.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    console.log('[PARENT-API] Session set on parentAuthClient after signup');
  }

  return result;
}

export async function parentLogin(email: string, password: string) {
  console.log('[PARENT-API] Login:', email);
  const response = await fetch(`${API_BASE}/parent/login`, {
    method: 'POST',
    headers: getPublicHeaders(),
    body: JSON.stringify({ email, password }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Login failed');
  }

  // Store session
  if (result.session?.access_token) {
    localStorage.setItem('parent_access_token', result.session.access_token);
    localStorage.setItem('parent_id', result.user.id);
    localStorage.setItem('parent_data', JSON.stringify(result.parent));

    // Establish session on the Supabase client so auto-refresh works
    await parentAuthClient.auth.setSession({
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
    });
    console.log('[PARENT-API] Session set on parentAuthClient after login');
  }

  return result;
}

export async function parentValidateSession() {
  // Quick gate: if there's no token anywhere, skip the network call
  const hasLocalToken = !!localStorage.getItem('parent_access_token');
  // Also check the Supabase client's own storage (foxy-parent-auth key)
  const hasClientSession = !!localStorage.getItem('foxy-parent-auth');
  if (!hasLocalToken && !hasClientSession) return null;

  // getParentAuthHeaders() already calls getFreshParentToken() internally,
  // which auto-refreshes via the Supabase client and falls back to localStorage
  const response = await fetch(`${API_BASE}/parent/session`, {
    method: 'GET',
    headers: await getParentAuthHeaders(),
  });

  if (!response.ok) {
    localStorage.removeItem('parent_access_token');
    localStorage.removeItem('parent_id');
    localStorage.removeItem('parent_data');
    // Also clear the Supabase client session
    parentAuthClient.auth.signOut().catch(() => {});
    return null;
  }

  const result = await response.json();
  if (result.valid && result.parent) {
    localStorage.setItem('parent_data', JSON.stringify(result.parent));
  }
  return result;
}

export function parentLogout() {
  localStorage.removeItem('parent_access_token');
  localStorage.removeItem('parent_id');
  localStorage.removeItem('parent_data');
  localStorage.removeItem('include_mandarin_test');
  // Clear the Supabase client session too
  parentAuthClient.auth.signOut().catch(() => {});
}

export function getStoredParentData() {
  try {
    const data = localStorage.getItem('parent_data');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// ===== OAUTH COMPLETION =====

/**
 * After a Google/Facebook OAuth redirect, call this to ensure a parent KV record
 * exists on the server. Creates one for first-time OAuth users, returns existing
 * for returning users. Stores session data in localStorage.
 * @param referredBy - Optional referral code read from the 365-day cookie
 * @param originTag - Optional origin kindergarten ID (from the /t/:code route)
 * @param leadInfo - Optional lead info from pre-signup test (phone, child name, etc.)
 */
export async function parentOAuthComplete(
  accessToken: string,
  referredBy?: string,
  originTag?: string,
  leadInfo?: { phone?: string; childName?: string; childAge?: number },
) {
  console.log('[PARENT-API] OAuth complete — ensuring parent record exists', {
    referredBy: referredBy || '(none)',
    originTag: originTag || '(none)',
    hasLeadInfo: !!leadInfo,
  });
  const response = await fetch(`${API_BASE}/parent/oauth-complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`,
      'X-User-Token': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      referredBy: referredBy || undefined,
      originTag: originTag || undefined,
      phone: leadInfo?.phone || undefined,
      child_name: leadInfo?.childName || undefined,
      child_age: leadInfo?.childAge || undefined,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'OAuth completion failed');
  }

  // Store session data (mirrors parentLogin behavior)
  if (result.parent) {
    localStorage.setItem('parent_access_token', accessToken);
    localStorage.setItem('parent_id', result.parent.id);
    localStorage.setItem('parent_data', JSON.stringify(result.parent));
    console.log(`[PARENT-API] OAuth parent record ready: ${result.parent.name} (isNew: ${result.isNew})`);
  }

  return result;
}

// ===== PROFILE UPDATE =====

export async function updateParentProfile(updates: {
  phone?: string;
  child_name?: string;
  child_age?: number;
  name?: string;
  include_mandarin_test?: boolean;
  language?: string;
}) {
  console.log('[PARENT-API] Updating profile:', updates);
  const response = await fetch(`${API_BASE}/parent/profile`, {
    method: 'PUT',
    headers: await getParentAuthHeaders(),
    body: JSON.stringify(updates),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Profile update failed');
  }

  // Refresh local storage with updated parent data
  if (result.parent) {
    localStorage.setItem('parent_data', JSON.stringify(result.parent));
  }

  return result;
}

// ===== USAGE LIMITS =====

export async function recordUsage(type: 'test' | 'watch' | 'practice', questionsAnswered?: number, questionsCorrect?: number) {
  const body: any = { type };
  if (questionsAnswered && questionsAnswered > 0) {
    body.questions_answered = questionsAnswered;
  }
  if (questionsCorrect !== undefined && questionsCorrect >= 0) {
    body.questions_correct = questionsCorrect;
  }
  const response = await fetch(`${API_BASE}/parent/use`, {
    method: 'POST',
    headers: await getParentAuthHeaders(),
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!response.ok) {
    if (result.limit) {
      return { allowed: false, limit: true, error: result.error };
    }
    throw new Error(result.error || 'Failed to record usage');
  }

  return { allowed: true, count: result.count };
}

// ===== REFERRALS =====

export async function fetchReferralInfo() {
  const response = await fetch(`${API_BASE}/parent/referrals`, {
    method: 'GET',
    headers: await getParentAuthHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(err.error || 'Failed to fetch referrals');
  }

  return await response.json();
}

export async function fetchReferralNetwork() {
  const response = await fetch(`${API_BASE}/parent/referral-network`, {
    method: 'GET',
    headers: await getParentAuthHeaders(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(err.error || 'Failed to fetch referral network');
  }

  return await response.json();
}

// ===== STRIPE CHECKOUT =====

export async function createCheckoutSession(plan: 'A' | 'B', email: string) {
  const parentId = localStorage.getItem('parent_id');
  const parentData = getStoredParentData();

  if (!parentId) throw new Error('Not logged in');

  const response = await fetch(`${API_BASE}/stripe/checkout`, {
    method: 'POST',
    headers: await getParentAuthHeaders(),
    body: JSON.stringify({
      plan,
      parentId,
      email,
      referralCode: parentData?.referred_by || undefined,
      successUrl: `${window.location.origin}/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/plan?checkout=cancelled`,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Checkout failed');
  }

  return result;
}

export async function verifyCheckoutSession(sessionId: string) {
  const response = await fetch(`${API_BASE}/stripe/verify/${sessionId}`, {
    method: 'GET',
    headers: await getParentAuthHeaders(),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Verification failed');
  }

  // Refresh parent data
  await parentValidateSession();

  return result;
}

export async function getSubscriptionStatus() {
  const parentId = localStorage.getItem('parent_id');
  if (!parentId) return { plan: 'free', status: 'free' };

  const response = await fetch(`${API_BASE}/stripe/status/${parentId}`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) return { plan: 'free', status: 'free' };

  const result = await response.json();
  return result.subscription || { plan: 'free', status: 'free' };
}

// ===== STRIPE CUSTOMER PORTAL =====

export async function createPortalSession() {
  const parentId = localStorage.getItem('parent_id');
  if (!parentId) throw new Error('Not logged in');

  const response = await fetch(`${API_BASE}/stripe/portal`, {
    method: 'POST',
    headers: await getParentAuthHeaders(),
    body: JSON.stringify({
      parentId,
      returnUrl: `${window.location.origin}/plan`,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Portal session failed');
  }

  return result;
}

// ===== VIDEOS =====

export async function fetchVideos() {
  const response = await fetch(`${API_BASE}/videos`, {
    method: 'GET',
    headers: getPublicHeaders(),
  });

  if (!response.ok) return [];
  const result = await response.json();
  return result.videos || [];
}

// ===== ASSESSMENT HISTORY =====

export async function saveAssessmentSnapshot(data: {
  childAge: number;
  overallPct: number;
  totalStars: number;
  maxStars: number;
  tpLevel: number;
  readinessPct: number;
  totalQuestions: number;
  totalCorrect: number;
  subjectSummary: { name: string; pct: number; functionalAge: number }[];
}) {
  const response = await fetch(`${API_BASE}/parent/save-assessment`, {
    method: 'POST',
    headers: await getParentAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown' }));
    console.error('[PARENT-API] Save assessment failed:', err);
    return null;
  }

  return await response.json();
}

export async function fetchAssessmentHistory() {
  const response = await fetch(`${API_BASE}/parent/history`, {
    method: 'GET',
    headers: await getParentAuthHeaders(),
  });

  if (!response.ok) return [];
  const result = await response.json();
  return result.assessments || [];
}

// ===== ACTIVITY TIMELINE =====

export async function fetchActivityTimeline() {
  const response = await fetch(`${API_BASE}/parent/activity`, {
    method: 'GET',
    headers: await getParentAuthHeaders(),
  });

  if (!response.ok) return [];
  const result = await response.json();
  return result.activities || [];
}

// ===== DELETE ACCOUNT =====

export async function deleteParentAccount(): Promise<{ success: boolean }> {
  console.log('[PARENT-API] Deleting parent account...');
  const response = await fetch(`${API_BASE}/parent/account`, {
    method: 'DELETE',
    headers: await getParentAuthHeaders(),
  });

  const result = await response.json();
  if (!response.ok) {
    console.error('[PARENT-API] Account deletion failed:', result);
    throw new Error(result.error || 'Account deletion failed');
  }

  // Clear all local state
  parentLogout();
  localStorage.removeItem('current_user_type');
  localStorage.removeItem('userType');

  console.log(`[PARENT-API] Account deleted successfully. ${result.deletedKeys} keys removed.`);
  return result;
}