/**
 * useCheckoutCallback — Extracted from App.tsx (Stage 5)
 *
 * Detects returning users from Stripe checkout redirects.
 * Handles ?checkout=success&session_id=... and ?checkout=cancelled.
 */
import { useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import { getStoredParentData } from '../utils/parent-api';

interface UseCheckoutCallbackParams {
  navigate: (path: string, options?: { replace?: boolean }) => void;
  locationPathname: string;
  setParentData: (v: any) => void;
}

export function useCheckoutCallback({
  navigate,
  locationPathname,
  setParentData,
}: UseCheckoutCallbackParams) {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutStatus = urlParams.get('checkout');
    const sessionId = urlParams.get('session_id');

    if (checkoutStatus === 'success' && sessionId) {
      import('../utils/parent-api').then(({ verifyCheckoutSession }) => {
        verifyCheckoutSession(sessionId)
          .then((result) => {
            toast.success(`Subscription activated! Welcome to Plan ${result.plan}!`);
            setParentData(getStoredParentData());
            navigate(locationPathname, { replace: true });
          })
          .catch((err) => {
            console.error('Checkout verification failed:', err);
            toast.error('Could not verify payment. Please contact support.');
          });
      });
    } else if (checkoutStatus === 'cancelled') {
      toast.info('Checkout cancelled.');
      navigate(locationPathname, { replace: true });
    }
  }, []);
}
