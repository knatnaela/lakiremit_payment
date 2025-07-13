'use client'

import toast from 'react-hot-toast'
import { PaymentProvider, PaymentData, PaymentResult, ChallengeData, ChallengeResult, DeviceData } from './PaymentProvider'

declare global {
  interface Window {
    PaymentSession: any
  }
}

export class MastercardProvider implements PaymentProvider {
  private sessionId: string | null = null
  private merchantId: string | null = null
  private isInitializedState = false
  private cardNumberElement: HTMLDivElement | null = null
  private cvvElement: HTMLDivElement | null = null
  private deviceDataCollected = false
  private deviceSessionId: string | null = null

  // Method to set card number element
  setCardNumberElement(element: HTMLDivElement | null) {
    this.cardNumberElement = element
  }

  // Method to set CVV element
  setCvvElement(element: HTMLDivElement | null) {
    this.cvvElement = element
  }

  async initialize(): Promise<void> {
    try {
      
      // Get session from backend
      const response = await fetch('http://localhost:8080/api/v1/payment/checkout-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'transactionId': 'I4pyyshLem',
          'provider': 'mastercard'
        })
      })
      
      const data = await response.json()
      
      if (data.result !== 'SUCCESS') {
        throw new Error(`Backend API returned error: ${data.result}`)
      }
      
      if (!data.sessionId || !data.merchantId) {
        throw new Error('No session ID or merchant ID received from backend API')
      }
      
      this.sessionId = data.sessionId
      this.merchantId = data.merchantId
      
      // Load Mastercard script
      if (this.merchantId) {
        await this.loadMastercardScript(this.merchantId)
      }
      
      // Create field elements
      this.createFieldElements()
      
      // Configure PaymentSession
      this.configurePaymentSession()
      
      this.isInitializedState = true
      
    } catch (error) {
      throw error
    }
  }

  async tokenizeCard(): Promise<string> {
    if (!this.sessionId) {
      throw new Error('Mastercard provider not initialized')
    }

    return new Promise<string>((resolve) => {
      // Update session with form data
      if (window.PaymentSession) {
        window.PaymentSession.updateSessionFromForm('card')
      }
      
      // The session ID becomes our "token"
      resolve(this.sessionId!)
    })
  }

  async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
    try {
      const deviceInfo = await this.collectDeviceData()
      
      const paymentRequest = {
        sessionId: paymentData.token, // This is the session ID for Mastercard
        cardHolder: `${paymentData.firstName} ${paymentData.lastName}`,
        currency: paymentData.currency,
        totalAmount: paymentData.amount,
        returnUrl: 'http://localhost:3000/api/payment/challenge-result',
        merchantReference: 'order-' + Date.now(),
        ecommerceIndicatorAuth: 'internet',
        isSaveCard: false,
        firstName: paymentData.firstName,
        lastName: paymentData.lastName,
        email: paymentData.email,
        ...paymentData.billing,
        deviceSessionId: deviceInfo.sessionId, // Use different property name
        deviceIpAddress: deviceInfo.ipAddress,
        deviceUserAgent: deviceInfo.userAgent
      }

      const response = await fetch('http://localhost:8080/api/v1/payment/combined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentRequest)
      })

      const responseData = await response.json()

      if (responseData.result === 'SUCCESS') {
        const paymentResponse = responseData.paymentResponse
        
        if (paymentResponse.status === 'PENDING_AUTHENTICATION') {
          // Handle 3DS challenge
          const stepUpUrl = paymentResponse.consumerAuthenticationInformation?.stepUpUrl
          const pareq = paymentResponse.consumerAuthenticationInformation?.pareq
          const accessToken = paymentResponse.consumerAuthenticationInformation?.accessToken
          const authTransactionId = paymentResponse.consumerAuthenticationInformation?.authenticationTransactionId
          
          if (stepUpUrl && pareq && accessToken) {
            return {
              success: true,
              requires3DS: true,
              challengeData: {
                stepUpUrl,
                accessToken,
                pareq,
                transactionId: authTransactionId
              }
            }
          }
        }
        
        return {
          success: true,
          transactionId: paymentResponse?.id || paymentResponse?.transactionId
        }
      } else {
        throw new Error(responseData.error || 'Payment failed')
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      }
    }
  }

  async handle3DSChallenge(challengeData: ChallengeData): Promise<ChallengeResult> {
    try {
      // Get stored payment data from localStorage
      const storedChallengeData = localStorage.getItem('challengeData')
      if (!storedChallengeData) {
        throw new Error('Payment data not found')
      }

      const challengeDataFromStorage = JSON.parse(storedChallengeData)

      const response = await fetch('http://localhost:8080/api/v1/payment/combined-after-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...challengeDataFromStorage,
          transactionId: challengeData.transactionId,
          md: challengeData.pareq
        })
      })

      const responseData = await response.json()

      if (responseData.result === 'SUCCESS') {
        localStorage.removeItem('challengeData')
        return {
          success: true,
          transactionId: responseData.paymentResponse?.id || challengeData.transactionId
        }
      } else {
        throw new Error(responseData.error || 'Payment completion failed')
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Challenge completion failed'
      }
    }
  }

  async collectDeviceData(): Promise<DeviceData> {
    // For Mastercard, we'll generate a simple device fingerprint
    const deviceSessionId = `mastercard-session-${Date.now()}`
    this.deviceSessionId = deviceSessionId
    this.deviceDataCollected = true
    
    return {
      sessionId: deviceSessionId,
      ipAddress: '127.0.0.1', // This should come from your IP detection logic
      userAgent: navigator.userAgent
    }
  }

  isInitialized(): boolean {
    return this.isInitializedState
  }

  cleanup(): void {
    this.isInitializedState = false
    this.sessionId = null
    this.merchantId = null
  }

  // Helper methods
  private loadMastercardScript(merchantId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src*="ap-gateway.mastercard.com"]`)
      if (existingScript) {
        if (typeof window.PaymentSession === 'object') {
          resolve()
        } else {
          existingScript.addEventListener('load', () => resolve())
          existingScript.addEventListener('error', () => reject(new Error('Script failed to load')))
        }
        return
      }

      const script = document.createElement('script')
      script.src = `https://ap-gateway.mastercard.com/form/version/100/merchant/${merchantId}/session.js`
      script.onload = () => {
        let attempts = 0
        const maxAttempts = 100
        
        const waitForPaymentSession = () => {
          if (window.PaymentSession && typeof window.PaymentSession.configure === 'function') {
            resolve()
          } else {
            attempts++
            if (attempts >= maxAttempts) {
              reject(new Error('PaymentSession library failed to initialize after script load'))
              return
            }
            setTimeout(waitForPaymentSession, 50)
          }
        }
        waitForPaymentSession()
      }
      script.onerror = () => {
        reject(new Error('Failed to load Mastercard script'))
      }
      
      document.head.appendChild(script)
    })
  }

  private createFieldElements() {
    // Create card number field
    const cardNumberField = document.createElement('input')
    cardNumberField.id = 'card-number'
    cardNumberField.className = 'input-field'
    cardNumberField.title = 'card number'
    cardNumberField.setAttribute('aria-label', 'enter your card number')
    cardNumberField.readOnly = true
    cardNumberField.tabIndex = 1
    
    // Create CVV field
    const cvvField = document.createElement('input')
    cvvField.id = 'security-code'
    cvvField.className = 'input-field'
    cvvField.title = 'security code'
    cvvField.setAttribute('aria-label', 'three digit CCV security code')
    cvvField.readOnly = true
    cvvField.tabIndex = 4
    
    // Create expiry fields
    const expiryMonthField = document.createElement('input')
    expiryMonthField.id = 'expiry-month'
    expiryMonthField.className = 'input-field'
    expiryMonthField.title = 'expiry month'
    expiryMonthField.setAttribute('aria-label', 'two digit expiry month')
    expiryMonthField.readOnly = true
    expiryMonthField.tabIndex = 2
    
    const expiryYearField = document.createElement('input')
    expiryYearField.id = 'expiry-year'
    expiryYearField.className = 'input-field'
    expiryYearField.title = 'expiry year'
    expiryYearField.setAttribute('aria-label', 'two digit expiry year')
    expiryYearField.readOnly = true
    expiryYearField.tabIndex = 3
    
    // Create cardholder name field
    const cardholderNameField = document.createElement('input')
    cardholderNameField.id = 'cardholder-name'
    cardholderNameField.className = 'input-field'
    cardholderNameField.title = 'cardholder name'
    cardholderNameField.setAttribute('aria-label', 'enter name on card')
    cardholderNameField.readOnly = true
    cardholderNameField.tabIndex = 5
    
    // Load fields into containers
    if (this.cardNumberElement) {
      this.cardNumberElement.appendChild(cardNumberField)
    }
    if (this.cvvElement) {
      this.cvvElement.appendChild(cvvField)
    }
    
    // Store expiry fields for later use
    this.expiryMonthField = expiryMonthField
    this.expiryYearField = expiryYearField
    this.cardholderNameField = cardholderNameField
  }

  private configurePaymentSession() {
    if (!this.sessionId || !window.PaymentSession) {
      throw new Error('PaymentSession not available')
    }

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
        initialized: () => {
          // if (response.status === "ok") {
          // }
        },
        formSessionUpdate: (response: { status: string, errors: { cardNumber: string, securityCode: string, expiryMonth: string, expiryYear: string } } ) => {
          if (response.status === "ok") {
            // Handle successful form update
          } else if (response.status === "fields_in_error") {
            // Handle field errors
            if (response.errors.cardNumber) {
              toast.error('Card number invalid or missing')
            }
            if (response.errors.securityCode) {
              toast.error('Security code invalid')
            }
            if (response.errors.expiryMonth || response.errors.expiryYear) {
              toast.error('Expiry date invalid')
            }
          } else if (response.status === "request_timeout") {
            toast.error('Request timeout')
          } else if (response.status === "system_error") {
            toast.error('System error')
          }
        }
      },
      interaction: {
        displayControl: {
          formatCard: "EMBOSSED",
          invalidFieldCharacters: "REJECT"
        }
      }
    })
  }

  // Getter methods for refs
  getCardNumberRef() {
    return this.cardNumberElement
  }

  getCvvRef() {
    return this.cvvElement
  }

  // Private properties for field references
  private expiryMonthField: HTMLInputElement | null = null
  private expiryYearField: HTMLInputElement | null = null
  private cardholderNameField: HTMLInputElement | null = null
} 