// Singleton Supabase clients for frontend session management (auto-refresh)
// Two separate clients with different storage keys to avoid session conflicts
// between admin (kindergarten/superadmin) and parent auth flows.
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;

// ──────────────────────────────────────────────────────────────────────────────
// EARLY DIAGNOSTIC: Capture the raw URL + hash BEFORE any Supabase client
// initializes (they may strip the hash via replaceState during init).
// This runs at module-import time — the earliest possible moment.
// ──────────────────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  const rawHref = window.location.href;
  const rawHash = window.location.hash;
  const rawSearch = window.location.search;
  console.log('[SUPABASE-CLIENT] Module init — raw URL snapshot:', {
    href: rawHref,
    search: rawSearch,
    hash: rawHash || '(empty)',
    hasCode: rawSearch.includes('code='),
    hasAccessToken: rawHash.includes('access_token'),
    hasError: rawHash.includes('error') || rawSearch.includes('error'),
  });

  // If the hash contains an error from Supabase OAuth, surface it immediately
  if (rawHash.includes('error')) {
    const hashParams = new URLSearchParams(rawHash.replace('#', ''));
    const errorType = hashParams.get('error');
    const errorDesc = hashParams.get('error_description');
    const errorCode = hashParams.get('error_code');
    console.error('[SUPABASE-CLIENT] OAuth ERROR found in URL hash:', {
      error: errorType,
      error_description: errorDesc,
      error_code: errorCode,
    });
  }
  if (rawSearch.includes('error')) {
    const searchParams = new URLSearchParams(rawSearch);
    const errorType = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');
    const errorCode = searchParams.get('error_code');
    console.error('[SUPABASE-CLIENT] OAuth ERROR found in URL search:', {
      error: errorType,
      error_description: errorDesc,
      error_code: errorCode,
    });
  }
}

// Admin auth client (kindergarten dashboard / superadmin)
// detectSessionInUrl MUST be false — otherwise this client (created first)
// will consume the ?code= PKCE parameter from the URL before the parent
// client can exchange it, breaking parent social-login entirely.
export const adminAuthClient = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    storageKey: 'foxy-admin-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Parent auth client (parent ecosystem)
// flowType 'pkce' ensures OAuth returns a ?code= in the URL (not a hash
// fragment), which is more robust, debuggable, and the Supabase-recommended
// approach. detectSessionInUrl auto-exchanges the code using the stored
// code_verifier on redirect return.
export const parentAuthClient = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    storageKey: 'foxy-parent-auth',
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/**
 * Quick check if a raw JWT string is expired.
 * Used by fallback paths that read tokens from localStorage.
 * Returns true if the token is expired or unparseable.
 */
export function isJwtExpired(token: string, bufferSeconds = 60): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    // Base64url decode the payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const exp = payload.exp;
    if (typeof exp !== 'number') return true;
    const now = Math.floor(Date.now() / 1000);
    return exp - now < bufferSeconds;
  } catch {
    return true; // If we can't parse it, treat as expired
  }
}

/**
 * Check if a session's access token is expired or about to expire.
 * Buffer of 60 seconds ensures we refresh before the server rejects it.
 */
function isSessionExpiredOrNearExpiry(session: { expires_at?: number }): boolean {
  const expiresAt = session.expires_at ?? 0;
  const now = Math.floor(Date.now() / 1000);
  const BUFFER_SECONDS = 60;
  return expiresAt - now < BUFFER_SECONDS;
}

/**
 * Get a fresh admin access token (auto-refreshes if expired).
 * Returns null silently if no Supabase client session exists —
 * callers fall back to localStorage, which is the normal path for
 * sessions established before the Supabase client was wired in.
 */
export async function getFreshAdminToken(): Promise<string | null> {
  try {
    const { data, error } = await adminAuthClient.auth.getSession();
    if (error) {
      console.error('[AUTH] Admin getSession error:', error.message);
      return null;
    }
    if (!data?.session) {
      return null;
    }

    let session = data.session;

    // Proactively refresh if token is expired or about to expire
    if (isSessionExpiredOrNearExpiry(session)) {
      console.log('[AUTH] Admin token expired/near-expiry, refreshing...');
      const { data: refreshData, error: refreshError } = await adminAuthClient.auth.refreshSession();
      if (refreshError || !refreshData?.session) {
        console.error('[AUTH] Admin token refresh failed:', refreshError?.message || 'No session returned');
        // Clear stale localStorage so callers don't fall back to an expired token
        localStorage.removeItem('access_token');
        return null;
      }
      session = refreshData.session;
      console.log('[AUTH] Admin token refreshed successfully, new expiry:', session.expires_at);
    }

    // Keep localStorage in sync for backwards compat
    localStorage.setItem('access_token', session.access_token);
    return session.access_token;
  } catch (err) {
    console.error('[AUTH] Failed to get fresh admin token:', err);
    return null;
  }
}

/**
 * Get a fresh parent access token (auto-refreshes if expired).
 * Returns null silently if no Supabase client session exists —
 * callers fall back to localStorage, which is the normal path for
 * sessions established before the Supabase client was wired in.
 */
export async function getFreshParentToken(): Promise<string | null> {
  try {
    const { data, error } = await parentAuthClient.auth.getSession();
    if (error) {
      console.error('[AUTH] Parent getSession error:', error.message);
      return null;
    }
    if (!data?.session) {
      return null;
    }

    let session = data.session;

    // Proactively refresh if token is expired or about to expire
    if (isSessionExpiredOrNearExpiry(session)) {
      console.log('[AUTH] Parent token expired/near-expiry, refreshing...');
      const { data: refreshData, error: refreshError } = await parentAuthClient.auth.refreshSession();
      if (refreshError || !refreshData?.session) {
        console.error('[AUTH] Parent token refresh failed:', refreshError?.message || 'No session returned');
        // Clear stale localStorage so callers don't fall back to an expired token
        localStorage.removeItem('parent_access_token');
        return null;
      }
      session = refreshData.session;
      console.log('[AUTH] Parent token refreshed successfully, new expiry:', session.expires_at);
    }

    // Keep localStorage in sync for backwards compat
    localStorage.setItem('parent_access_token', session.access_token);
    return session.access_token;
  } catch (err) {
    console.error('[AUTH] Failed to get fresh parent token:', err);
    return null;
  }
}