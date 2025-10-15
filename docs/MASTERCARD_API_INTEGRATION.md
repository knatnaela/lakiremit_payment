# Mastercard API Integration Guide

## Overview

This document explains the integration of Mastercard's Session SDK into our payment processing system. The Mastercard API provides hosted payment fields that help reduce PCI compliance costs while maintaining control over the payment page layout and styling.

## Key Concepts

### Session SDK
- **Purpose**: Collects sensitive payment details in fields hosted by Mastercard's gateway
- **Benefits**: 
  - Reduces PCI compliance costs
  - Maintains control over page layout and styling
  - Secure card data collection
- **Process**: Gateway collects payment details and stores them in a payment session

### Integration Flow
1. **Initialize Session** - Get session ID from backend
2. **Load Script** - Load Mastercard's hosted session script
3. **Configure Fields** - Set up hosted payment fields
4. **Collect Data** - User enters card details in hosted fields
5. **Tokenize** - Update session with form data
6. **Process Payment** - Use session ID for payment processing

## API Endpoints

### Script URL
```
https://ap-gateway.mastercard.com/form/version/100/merchant/<MERCHANTID>/session.js
```

### Backend Endpoints
- `POST /api/v1/payment/checkout-token` - Get session ID and merchant ID
- `POST /api/v1/payment/combined` - Process payment with session
- `POST /api/v1/payment/combined-after-challenge` - Complete 3DS challenge

## Implementation Details

### 1. Provider Initialization

```typescript
async initialize(): Promise<void> {
  // Get session from backend
  const response = await fetch('/api/v1/payment/checkout-token', {
    method: 'POST',
    body: JSON.stringify({
      transactionId: 'I4pyyshLem',
      provider: 'mastercard'
    })
  })
  
  // Load Mastercard script
  await this.loadMastercardScript(merchantId)
  
  // Configure PaymentSession
  this.configurePaymentSession()
}
```

### 2. Script Loading

```typescript
private loadMastercardScript(merchantId: string): Promise<void> {
  const script = document.createElement('script')
  script.src = `https://ap-gateway.mastercard.com/form/version/100/merchant/${merchantId}/session.js`
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      // Wait for PaymentSession to be available
      const waitForPaymentSession = () => {
        if (window.PaymentSession && typeof window.PaymentSession.configure === 'function') {
          resolve()
        } else {
          setTimeout(waitForPaymentSession, 50)
        }
      }
      waitForPaymentSession()
    }
    script.onerror = () => reject(new Error('Failed to load Mastercard script'))
    document.head.appendChild(script)
  })
}
```

### 3. Field Configuration

```typescript
private configurePaymentSession() {
  window.PaymentSession.configure({
    session: this.sessionId,
    fields: {
      card: {
        number: "#card-number",
        securityCode: "#security-code",
        expiryMonth: "#expiry-month",
        expiryYear: "#expiry-year",
        nameOnCard: "#cardholder-name"
      }
    },
    frameEmbeddingMitigation: ["javascript"],
    callbacks: {
      initialized: (response) => {
        // Handle initialization
      },
      formSessionUpdate: (response) => {
        // Handle session updates
      }
    }
  })
}
```

### 4. Card Tokenization

```typescript
async tokenizeCard(cardData: CardData): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // Update session with form data
    window.PaymentSession.updateSessionFromForm('card')
    
    // Handle response in formSessionUpdate callback
    this.sessionUpdatePromise.then(resolve).catch(reject)
  })
}
```

## Callback Functions

### Core Callbacks

#### `initialized`
Called when the PaymentSession is initialized.
```typescript
initialized: (response: any) => {
  if (response.status === "ok") {
    console.log('PaymentSession ready')
  }
}
```

#### `formSessionUpdate`
Called when session is updated with form data.
```typescript
formSessionUpdate: (response: any) => {
  if (response.status === "ok") {
    // Session updated successfully
    console.log("Session ID:", response.session?.id)
  } else if (response.status === "fields_in_error") {
    // Handle field validation errors
  }
}
```

### Event Callbacks

#### `onCardTypeChange`
Called when card type is detected or changes.
```typescript
onCardTypeChange: (response: any) => {
  console.log('Card type:', response.cardType)
}
```

#### `onValidityChange`
Called when field validation status changes.
```typescript
onValidityChange: (response: any) => {
  console.log('Field validity:', response.valid)
}
```

#### `onFocus` / `onBlur`
Called when fields gain or lose focus.
```typescript
onFocus: (response: any) => {
  console.log('Field focused:', response.fieldId)
}
```

## Error Handling

### Common Error Scenarios

#### Field Validation Errors
```typescript
if (response.status === "fields_in_error") {
  if (response.errors?.cardNumber) {
    toast.error('Card number invalid or missing')
  }
  if (response.errors?.securityCode) {
    toast.error('Security code invalid')
  }
  if (response.errors?.expiryMonth || response.errors?.expiryYear) {
    toast.error('Expiry date invalid')
  }
}
```

#### System Errors
```typescript
if (response.status === "system_error") {
  console.error("System error:", response.errors?.message)
  toast.error('System error')
}
```

#### Timeout Errors
```typescript
if (response.status === "request_timeout") {
  console.error("Request timeout:", response.errors?.message)
  toast.error('Request timeout')
}
```

## Security Features

### Frame Embedding Mitigation
```typescript
frameEmbeddingMitigation: ["javascript"]
```
Prevents click-jacking attacks by ensuring the page is not embedded in an iframe.

### Anti-Clickjack Styling
```css
body { display: none !important; }
```
Hides page content until frame embedding check passes.

### Field Protection
- All payment fields are `readonly` to prevent direct manipulation
- Data is collected through Mastercard's hosted fields
- No sensitive data touches your server

## 3D Secure Integration

### Challenge Flow
1. **Payment Request** - Send payment with session ID
2. **3DS Required** - Backend returns challenge data
3. **Challenge Display** - Show 3DS challenge to user
4. **Challenge Completion** - User completes authentication
5. **Payment Completion** - Finalize payment with challenge result

### Challenge Data Structure
```typescript
interface ChallengeData {
  stepUpUrl: string
  accessToken: string
  pareq: string
  transactionId: string
}
```

## Testing

### Test Cards
Use Mastercard's test card numbers for development:
- **Test Card**: 5204730000002514
- **Expiry**: Any future date
- **CVV**: Any 3 digits

### Test Scenarios
1. **Successful Payment** - Valid card details
2. **3DS Challenge** - Cards requiring authentication
3. **Validation Errors** - Invalid card details
4. **System Errors** - Network timeouts, server errors

## Best Practices

### 1. Error Handling
- Always handle all callback responses
- Provide user-friendly error messages
- Log errors for debugging

### 2. Security
- Never store sensitive card data
- Use HTTPS in production
- Implement proper CORS policies

### 3. User Experience
- Show loading states during operations
- Provide clear validation feedback
- Handle timeouts gracefully

### 4. Performance
- Load script asynchronously
- Implement proper cleanup
- Monitor script loading times

## Troubleshooting

### Common Issues

#### Script Loading Failures
- Check merchant ID is correct
- Verify network connectivity
- Check browser console for errors

#### Session Update Failures
- Ensure session ID is valid
- Check field configuration
- Verify callback setup

#### 3DS Challenge Issues
- Validate challenge data structure
- Check return URL configuration
- Ensure proper challenge completion handling

### Debug Logging
The implementation includes comprehensive logging:
```typescript
console.log('🔄 Initializing Mastercard provider...')
console.log('✅ Session and merchant ID received')
console.log('🔄 Tokenizing card with Mastercard...')
console.log('✅ Payment processed successfully')
```

## API Reference

### PaymentSession Methods

#### `configure(config)`
Configures the hosted session interaction.

#### `updateSessionFromForm(paymentType, localCardBrand?)`
Stores input from hosted fields into the session.

#### `setFocus(fieldId)`
Sets focus on the specified hosted field.

#### `validate(paymentType)`
Validates all hosted fields for specified payment type.

#### `setLocale(locale)`
Sets language in hosted session.

### Configuration Options

#### `session`
The session ID received from the backend.

#### `fields`
Object mapping field types to CSS selectors.

#### `frameEmbeddingMitigation`
Array of mitigation strategies (e.g., ["javascript"]).

#### `callbacks`
Object containing callback functions for various events.

#### `interaction`
Object containing display control settings.

## Version Information

- **API Version**: 100 (latest)
- **Script Version**: 100
- **Supported Protocols**: REST-JSON, NVP
- **Browser Support**: Modern browsers with JavaScript enabled

## Related Documentation

- [Mastercard API Documentation](https://ap-gateway.mastercard.com/api/documentation/apiDocumentation/session/version/latest/api.html?locale=en_US)
- [Integration Guidelines](https://ap-gateway.mastercard.com/api/documentation/integrationGuidelines/hostedSession/integrationModelHostedSession.html?locale=en_US)
- [Multiple Hosted Sessions](https://ap-gateway.mastercard.com/api/documentation/integrationGuidelines/hostedSession/acceptingMultipleCards.html?locale=en_US) 