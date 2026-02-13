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
 * Get a fresh admin access token (auto-refreshes if expired).
 * Returns null silently if no Supabase client session exists —
 * callers fall back to localStorage, which is the normal path for
 * sessions established before the Supabase client was wired in.
 */
export async function getFreshAdminToken(): Promise<string | null> {
  try {
    const { data, error } = await adminAuthClient.auth.getSession();
    if (error) {
      // Only log actual errors, not "no session" which is expected
      console.error('[AUTH] Admin getSession error:', error.message);
      return null;
    }
    if (!data?.session) {
      // No session on the Supabase client — silent, callers handle fallback
      return null;
    }
    // Keep localStorage in sync for backwards compat
    localStorage.setItem('access_token', data.session.access_token);
    return data.session.access_token;
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
      // Only log actual errors, not "no session" which is expected
      console.error('[AUTH] Parent getSession error:', error.message);
      return null;
    }
    if (!data?.session) {
      // No session on the Supabase client — silent, callers handle fallback
      return null;
    }
    // Keep localStorage in sync for backwards compat
    localStorage.setItem('parent_access_token', data.session.access_token);
    return data.session.access_token;
  } catch (err) {
    console.error('[AUTH] Failed to get fresh parent token:', err);
    return null;
  }
}