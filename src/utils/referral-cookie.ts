/**
 * Referral Cookie Utility
 *
 * Persists the referral code (`?ref=FOXYFAN123`) in a 365-day cookie
 * so that it survives page reloads, browser closes, and OAuth redirects.
 *
 * Write on:  first landing with ?ref= in URL
 * Read on:   parent signup (email), OAuth-complete call
 * Clear on:  successful signup (so it doesn't re-apply)
 */

const COOKIE_NAME = 'foxy_ref';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 365 days

/** Store a referral code in a 365-day cookie */
export function setReferralCookie(code: string): void {
  if (!code) return;
  // SameSite=Lax allows the cookie to persist across normal navigations
  // and OAuth redirects (top-level GET). Secure only on HTTPS.
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  console.log(`[REFERRAL-COOKIE] Set: ${code} (365-day expiry)`);
}

/** Read the referral code from cookie, or return null */
export function getReferralCookie(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split('=')[1]);
  return value || null;
}

/** Clear the referral cookie (e.g. after successful signup) */
export function clearReferralCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  console.log('[REFERRAL-COOKIE] Cleared');
}
