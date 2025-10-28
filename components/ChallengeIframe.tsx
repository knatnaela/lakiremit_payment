'use client'

import { useEffect, useRef } from 'react'
import { API_CONFIG } from '@/constants/api'

interface ChallengeIframeProps {
  stepUpUrl: string
  accessToken: string
  pareq: string
  onChallengeComplete: (transactionId: string, md?: string) => void
}

const CHALLENGE_WINDOW_SIZES = {
  '01': { width: 250, height: 400 },
  '02': { width: 390, height: 400 },
  '03': { width: 500, height: 600 },
  '04': { width: 600, height: 400 },
  '05': 'fullscreen'
} as const;

const ChallengeIframe: React.FC<ChallengeIframeProps> = ({
  stepUpUrl,
  accessToken,
  pareq,
  onChallengeComplete
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasSubmitted = useRef(false);
  const messageListenerRef = useRef<((event: MessageEvent) => void) | null>(null);

  // Get iframe dimensions from pareq
  const getIframeDimensions = () => {
    try {
      const parts = pareq.split('.');
      if (parts.length !== 3 && parts.length !== 1) {
        throw new Error('Invalid pareq format');
      }
      const base64 = parts.length === 3 ? parts[1] : parts[0];
      const decoded = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      const pareqData = JSON.parse(decoded);

      const windowSize = pareqData?.challengeWindowSize || '02';
      return CHALLENGE_WINDOW_SIZES[windowSize as keyof typeof CHALLENGE_WINDOW_SIZES];
    } catch (error) {
      return CHALLENGE_WINDOW_SIZES['02']; // Default to 390x400
    }
  };

  const dimensions = getIframeDimensions();
  const width = dimensions === 'fullscreen' ? '100%' : `${dimensions.width}px`;
  const height = dimensions === 'fullscreen' ? '100%' : `${dimensions.height}px`;

  // Handle messages from iframe with origin verification
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {

      // SECURITY: Verify the origin of the message
      // Use dynamic origin detection for both local and production
      const expectedOrigin = API_CONFIG.FRONTEND_BASE_URL || window.location.origin;

      if (event.origin !== expectedOrigin) {
        console.warn('⚠️ Message from unexpected origin:', event.origin, 'expected:', expectedOrigin);
        return;
      }

      // Handle challenge completion messages
      if (event.data?.type === '3ds-challenge-complete') {
        const { transactionId, md, status } = event.data;

        if (status === 'success' && transactionId) {
          onChallengeComplete(transactionId, md);
        } else if (status === 'error') {
          onChallengeComplete('', md);
        }
      }
    };

    // Store reference to remove listener later
    messageListenerRef.current = handleMessage;

    // Add event listener
    window.addEventListener('message', handleMessage);

    return () => {
      if (messageListenerRef.current) {
        window.removeEventListener('message', messageListenerRef.current);
      }
    };
  }, [onChallengeComplete]);

  // Monitor iframe URL changes as backup (optional)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return
    }

    const checkIframeUrl = () => {
      try {
        // Check if iframe has navigated to our return URL
        const iframeUrl = iframe.contentWindow?.location.href;
        if (iframeUrl && iframeUrl.includes('/api/payment/challenge-result')) {

          // Extract parameters from the URL
          const url = new URL(iframeUrl);
          const transactionId = url.searchParams.get('TransactionId');
          const md = url.searchParams.get('MD');

          if (transactionId) {
            onChallengeComplete(transactionId, md || undefined);
          }
        }
      } catch (error) {
        // Cross-origin restrictions may prevent accessing iframe URL
        // This is expected and handled by the message event listener
      }
    };

    // Check URL periodically (less frequent since we have postMessage)
    const interval = setInterval(checkIframeUrl, 2000);

    return () => clearInterval(interval);
  }, [onChallengeComplete]);

  // Submit form when component mounts
  useEffect(() => {
    // Prevent multiple submissions
    if (hasSubmitted.current) {
      return;
    }

    // Log the values being sent (for debugging)
    if (formRef.current) {
      try {
        hasSubmitted.current = true;
        formRef.current.submit();
      } catch (error) {
        hasSubmitted.current = false;
      }
    }
  }, [stepUpUrl, accessToken, dimensions]);

  return (
    <div style={{
      width: dimensions === 'fullscreen' ? '100vw' : width,
      height: dimensions === 'fullscreen' ? '100vh' : height,
      position: 'relative'
    }}>
      <iframe
        ref={iframeRef}
        name="step-up-iframe"
        width={width}
        height={height}
        style={{ border: 'none' }}
        title="3D Secure Authentication"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      <form
        ref={formRef}
        id="step-up-form"
        target="step-up-iframe"
        method="POST"
        action={stepUpUrl}
        style={{ display: 'none' }}
      >
        <input type="hidden" name="JWT" value={accessToken} />
        <input
          type="hidden"
          name="MD"
          value={`session_${Date.now()}`}
        />
      </form>
    </div>
  );
};

export default ChallengeIframe; 