# 3D Secure Iframe Flow Documentation

## Overview

This document explains how the 3D Secure authentication flow works with iframe handling, specifically focusing on the return URL mechanism when customers complete authentication with their issuing bank.

## Flow Diagram

```
1. Payment Form → 2. Payment Request → 3. 3DS Challenge Required
     ↓                    ↓                    ↓
4. Iframe Created → 5. Bank Authentication → 6. Return to consumerAuthenticationInformation.returnUrl
     ↓                    ↓                    ↓
7. Message Handling → 8. Challenge Complete → 9. Payment Finalization
```

## Key Components

### 1. Return URL Configuration

The `consumerAuthenticationInformation.returnUrl` is set in the payment request:

```typescript
const paymentRequest = {
  // ... other fields
  returnUrl: 'http://localhost:3000/api/payment/challenge-result',
  // ... other fields
}
```

### 2. Iframe Creation

The `ChallengeIframe` component creates an iframe that submits to the bank's step-up URL:

```typescript
<iframe 
  ref={iframeRef}
  name="step-up-iframe" 
  width={width}
  height={height}
  style={{ border: 'none' }}
  title="3D Secure Authentication"
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
  <input type="hidden" name="MD" value={`session_${Date.now()}`} />
</form>
```

### 3. Bank Authentication Process

1. Customer interacts with the issuing bank within the iframe
2. Bank performs authentication (SMS, app push, etc.)
3. Bank redirects back to the `consumerAuthenticationInformation.returnUrl`

### 4. Return URL Handling

When the customer completes authentication, they are redirected back to:
`http://localhost:3000/api/payment/challenge-result`

The API route handles this return in two ways:

#### Iframe Return (Primary Flow)
```typescript
if (isIframe) {
  // Return HTML that posts message to parent window
  const html = `
    <script>
      window.parent.postMessage({
        type: 'challenge-complete',
        transactionId: '${transactionId}',
        md: '${md}',
        status: '${status || 'success'}'
      }, '*');
    </script>
  `
  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}
```

#### Direct Navigation (Fallback)
```typescript
else {
  // Redirect to challenge processing page
  const redirectUrl = `/challenge-processing?TransactionId=${transactionId}&MD=${md}`
  return NextResponse.redirect(new URL(redirectUrl, request.url))
}
```

### 5. Message Handling

The parent window listens for messages from the iframe:

```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'challenge-complete') {
      const { transactionId, md } = event.data;
      onChallengeComplete(transactionId, md);
    }
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [onChallengeComplete]);
```

### 6. URL Monitoring (Alternative)

The system also monitors iframe URL changes as a backup:

```typescript
useEffect(() => {
  const checkIframeUrl = () => {
    try {
      const iframeUrl = iframe.contentWindow?.location.href;
      if (iframeUrl && iframeUrl.includes('/api/payment/challenge-result')) {
        // Extract parameters and handle completion
        const url = new URL(iframeUrl);
        const transactionId = url.searchParams.get('TransactionId');
        const md = url.searchParams.get('MD');
        
        if (transactionId) {
          onChallengeComplete(transactionId, md || undefined);
        }
      }
    } catch (error) {
      // Cross-origin restrictions - handled by message listener
    }
  };

  const interval = setInterval(checkIframeUrl, 1000);
  return () => clearInterval(interval);
}, [onChallengeComplete]);
```

## Security Considerations

1. **Cross-Origin Restrictions**: The iframe may be on a different domain, limiting direct access to its content
2. **Message Validation**: Always validate messages received from iframe
3. **HTTPS Requirements**: Ensure return URL uses HTTPS in production
4. **Token Validation**: Validate the JWT token and MD parameter

## Error Handling

The system handles various error scenarios:

1. **Iframe Load Failures**: Fallback to direct navigation
2. **Message Communication Failures**: URL monitoring as backup
3. **Authentication Failures**: Error messages sent to parent window
4. **Network Issues**: Retry mechanisms and user feedback

## Testing

To test the iframe flow:

1. Use test cards that require 3D Secure authentication
2. Monitor browser console for message events
3. Check network tab for return URL requests
4. Verify both iframe and direct navigation scenarios

## Production Considerations

1. **Domain Configuration**: Update return URL to production domain
2. **SSL Certificate**: Ensure valid SSL certificate for return URL
3. **CORS Headers**: Configure appropriate CORS headers if needed
4. **Monitoring**: Add logging for debugging production issues

## Troubleshooting

### Common Issues

1. **Iframe not loading**: Check step-up URL and JWT token
2. **No return message**: Verify iframe can access parent window
3. **Cross-origin errors**: Ensure proper domain configuration
4. **Missing parameters**: Validate all required fields in return URL

### Debug Steps

1. Check browser console for errors
2. Monitor network requests to return URL
3. Verify iframe dimensions and visibility
4. Test with different browser security settings 