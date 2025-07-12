# Enhanced PostMessage Implementation for 3D Secure

## Overview

This document explains the enhanced implementation of Option A: Page within Iframe uses `window.postMessage` for secure cross-origin communication in the 3D Secure authentication flow.

## Security Features

### 1. Origin Verification
```typescript
// SECURITY: Verify the origin of the message
const expectedOrigin = 'http://localhost:3000'; // In production, use your actual domain
if (event.origin !== expectedOrigin) {
  console.warn('⚠️ Message from unexpected origin:', event.origin);
  return;
}
```

### 2. Specific Target Origin
```typescript
// Security: Use specific target origin instead of '*'
const targetOrigin = 'http://localhost:3000';
window.parent.postMessage(messageData, targetOrigin);
```

### 3. Iframe Security Headers
```typescript
headers: { 
  'Content-Type': 'text/html',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'"
}
```

### 4. Iframe Sandbox Attributes
```html
<iframe 
  sandbox="allow-scripts allow-same-origin allow-forms"
  title="3D Secure Authentication"
/>
```

## Implementation Flow

### 1. Challenge Result API Route (`/api/payment/challenge-result`)

The API route detects if the request is coming from an iframe and returns an HTML page with postMessage functionality:

```typescript
// Check if this is coming from an iframe
const referer = request.headers.get('referer')
const isIframe = referer && !referer.includes(request.nextUrl.origin)

if (isIframe) {
  // Return HTML page that uses window.postMessage
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>3D Secure Authentication Complete</title>
      <!-- Styling and meta tags -->
    </head>
    <body>
      <div class="container">
        <div class="success-icon">✅</div>
        <h1>Authentication Complete</h1>
        <p>Your payment is being processed...</p>
        <div class="loading"></div>
      </div>
      
      <script>
        (function() {
          // Security: Verify we're in an iframe
          if (window === window.top) {
            console.error('❌ This page should only be loaded in an iframe');
            return;
          }

          // Prepare the message data
          const messageData = {
            type: '3ds-challenge-complete',
            transactionId: '${transactionId}',
            md: '${md}',
            status: '${status || 'success'}',
            response: '${response}',
            timestamp: new Date().toISOString()
          };

          // Security: Use specific target origin
          const targetOrigin = 'http://localhost:3000';
          
          // Send message to parent window
          try {
            window.parent.postMessage(messageData, targetOrigin);
            console.log('✅ Challenge completion message sent to parent:', messageData);
          } catch (error) {
            console.error('❌ Error sending message to parent:', error);
            // Fallback: Try with '*' if specific origin fails
            window.parent.postMessage(messageData, '*');
          }
        })();
      </script>
    </body>
    </html>
  `
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self'"
    }
  })
}
```

### 2. ChallengeIframe Component

The iframe component listens for postMessage events with origin verification:

```typescript
// Handle messages from iframe with origin verification
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    console.log('📡 Message received from iframe:', event.data);
    
    // SECURITY: Verify the origin of the message
    const expectedOrigin = 'http://localhost:3000';
    if (event.origin !== expectedOrigin) {
      console.warn('⚠️ Message from unexpected origin:', event.origin);
      return;
    }
    
    // Handle challenge completion messages
    if (event.data?.type === '3ds-challenge-complete') {
      const { transactionId, md, status, error } = event.data;
      
      if (status === 'success' && transactionId) {
        console.log('🎉 3DS Challenge completed successfully:', { transactionId, md });
        onChallengeComplete(transactionId, md);
      } else if (status === 'error') {
        console.error('❌ 3DS Challenge failed:', error);
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
```

### 3. PaymentForm Component

The main payment form handles the postMessage events:

```typescript
// Handle 3DS challenge callback messages
const handle3DSCallback = (event: MessageEvent) => {
  // SECURITY: Verify the origin of the message
  const expectedOrigin = 'http://localhost:3000';
  if (event.origin !== expectedOrigin) {
    console.warn('⚠️ Message from unexpected origin:', event.origin);
    return;
  }
  
  if (event.data?.type === '3ds-challenge-complete') {
    const { transactionId, status, md, error } = event.data;
    
    if (status === 'success' && transactionId) {
      console.log('🎉 3DS Challenge completed via postMessage:', { transactionId, md });
      handleChallengeComplete(transactionId, md);
    } else if (status === 'error') {
      console.error('❌ 3DS Challenge failed via postMessage:', error);
      toast.error('3D Secure verification failed');
      setStep('form');
    }
  }
};
```

## Message Format

### Success Message
```typescript
{
  type: '3ds-challenge-complete',
  transactionId: 'si4K1HD2C0KpW5KPb710',
  md: 'session_1752316549751',
  status: 'success',
  response: '',
  timestamp: '2024-01-12T10:30:45.123Z'
}
```

### Error Message
```typescript
{
  type: '3ds-challenge-complete',
  status: 'error',
  error: 'Authentication failed',
  timestamp: '2024-01-12T10:30:45.123Z'
}
```

## Security Best Practices

### 1. Origin Verification
- Always verify `event.origin` matches your expected domain
- Reject messages from unexpected origins
- Log warnings for security monitoring

### 2. Specific Target Origin
- Use specific target origin instead of `'*'`
- Fallback to `'*'` only if specific origin fails
- Document the expected origin clearly

### 3. Message Validation
- Validate message structure and required fields
- Check for expected message types
- Sanitize any user-provided data

### 4. Iframe Security
- Use sandbox attributes to restrict iframe capabilities
- Set appropriate security headers
- Prevent clickjacking with X-Frame-Options

### 5. Error Handling
- Provide fallback mechanisms
- Log errors for debugging
- Graceful degradation for security failures

## Production Configuration

### Environment Variables
```bash
# Production environment
NEXT_PUBLIC_BASE_URL=https://your-domain.com
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

### Domain Configuration
```typescript
// Update these values for production
const expectedOrigin = 'https://your-domain.com';
const targetOrigin = 'https://your-domain.com';
```

### SSL Requirements
- Ensure all communication uses HTTPS
- Valid SSL certificates for all domains
- Secure cookie settings

## Testing

### Test Scenarios
1. **Successful Authentication**: Complete 3DS flow and verify message received
2. **Failed Authentication**: Test error handling and message format
3. **Cross-Origin Security**: Verify origin validation works
4. **Fallback Mechanisms**: Test when specific origin fails
5. **Network Issues**: Test timeout and retry scenarios

### Debug Tools
- Browser Developer Tools Console
- Network tab for request/response monitoring
- Application tab for localStorage inspection

## Troubleshooting

### Common Issues
1. **Origin Mismatch**: Check domain configuration
2. **Message Not Received**: Verify event listener setup
3. **Security Headers**: Check iframe loading restrictions
4. **Cross-Origin Errors**: Verify CORS configuration

### Debug Steps
1. Check browser console for errors
2. Verify message format and structure
3. Test origin verification logic
4. Monitor network requests
5. Validate iframe security settings

## Benefits of This Implementation

1. **Security**: Origin verification prevents malicious messages
2. **Reliability**: Fallback mechanisms ensure communication
3. **User Experience**: Beautiful loading states and error handling
4. **Maintainability**: Clear separation of concerns
5. **Compliance**: Follows 3D Secure best practices 