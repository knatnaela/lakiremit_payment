'use client'

import toast from 'react-hot-toast'
import { PaymentProvider, CardData, PaymentData, PaymentResult, ChallengeData, ChallengeResult, DeviceData } from './PaymentProvider'
import { CardinalCommerceListener } from '../../CardinalCommerceListener'
import { CHALLENGE_URLS, API_CONFIG } from '@/constants/api'

interface MicroformInstance {
  createToken: (data: any, callback: (err: any, token: string) => void) => void
  createField: (type: "number" | "securityCode", options?: { placeholder?: string }) => any
}



export class CybersourceProvider implements PaymentProvider {
  private microformInstance: MicroformInstance | null = null
  private isInitializedState = false
  private checkoutToken: string | null = null
  private cardNumberElement: HTMLDivElement | null = null
  private cvvElement: HTMLDivElement | null = null
  private deviceDataCollected = false
  private cardinalSessionId: string | null = null

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

      // Get microform token from backend
      const response = await fetch('http://localhost:8080/api/v1/payment/checkout-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'transactionId': 'I4pyyshLem',
          'provider': 'cybersource'
        })
      })

      const data = await response.json()

      if (data.result !== 'SUCCESS') {
        throw new Error(`Backend API returned error: ${data.result}`)
      }

      if (!data.token) {
        throw new Error('No token received from backend API')
      }

      this.checkoutToken = data.token

      // Decode JWT to get script URL and integrity
      const decodedJWT = this.decodeJWT(data.token)
      const clientLibrary = decodedJWT.ctx?.[0]?.data?.clientLibrary
      const clientLibraryIntegrity = decodedJWT.ctx?.[0]?.data?.clientLibraryIntegrity

      if (!clientLibrary || !clientLibraryIntegrity) {
        throw new Error('Missing clientLibrary or clientLibraryIntegrity in JWT')
      }

      // Load the Cybersource script
      await this.loadCybersourceScript(clientLibrary, clientLibraryIntegrity)

      // Initialize Flex SDK
      if (!window.Flex) {
        throw new Error('Cybersource Flex library is not available')
      }

      const flex = new window.Flex(data.token)
      this.microformInstance = flex.microform({
        styles: {
          'input': {
            'font-size': '16px',
            'color': '#374151'
          }
        }
      })

      // Create and load microform fields
      const numberField = this.microformInstance.createField('number', {
        placeholder: 'Card Number'
      })

      const securityCodeField = this.microformInstance.createField('securityCode', {
        placeholder: 'CVV'
      })

      // Load fields into containers
      if (this.cardNumberElement) {
        numberField.load(this.cardNumberElement)

        numberField.on('change', () => {
          // Handle card number validation silently
        })

        numberField.on('error', () => {
          toast.error('Card number field error')
        })
      }

      if (this.cvvElement) {
        securityCodeField.load(this.cvvElement)

        securityCodeField.on('change', () => {
          // Handle security code validation silently
        })

        securityCodeField.on('error', () => {
          toast.error('Security code field error')
        })
      }

      // Set up Cardinal Commerce message listener
      const cardinalListener = CardinalCommerceListener.getInstance()
      cardinalListener.startListening((messageData: any) => {
        if (messageData.MessageType === "profile.completed" && messageData.Status === true) {
          this.deviceDataCollected = true
          this.cardinalSessionId = messageData.SessionId
        }
      })

      this.isInitializedState = true

    } catch (error) {
      throw error
    }
  }

  async tokenizeCard(cardData: CardData): Promise<string> {
    if (!this.microformInstance) {
      throw new Error('Cybersource provider not initialized')
    }

    return new Promise<string>((resolve, reject) => {
      this.microformInstance!.createToken({
        expirationMonth: cardData.expirationMonth,
        expirationYear: cardData.expirationYear,
      }, (err: any, token: string) => {
        if (err) {
          reject(new Error(err.message || 'Tokenization failed'))
          return
        }
        resolve(token)
      })
    })
  }

  async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
    try {
      const deviceInfo = this.collectDeviceInformation()

      const paymentRequest = {
        transientToken: paymentData.token,
        cardHolder: `${paymentData.firstName} ${paymentData.lastName}`,
        currency: paymentData.currency,
        totalAmount: paymentData.amount,
        returnUrl: CHALLENGE_URLS.RESULT_CALLBACK,
        merchantReference: 'order-' + Date.now(),
        ecommerceIndicatorAuth: 'internet',
        isSaveCard: false,
        firstName: paymentData.firstName,
        lastName: paymentData.lastName,
        email: paymentData.email,
        ...paymentData.billing,
        ...deviceInfo
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
          md: challengeData.pareq // Using pareq as md for Cybersource
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
    // Wait for device data collection to complete
    return new Promise<DeviceData>((resolve) => {
      const checkComplete = () => {
        if (this.deviceDataCollected && this.cardinalSessionId) {
          resolve({
            sessionId: this.cardinalSessionId,
            ipAddress: '127.0.0.1', // This should come from your IP detection logic
            userAgent: navigator.userAgent
          })
        } else {
          setTimeout(checkComplete, 500)
        }
      }
      checkComplete()
    })
  }

  isInitialized(): boolean {
    return this.isInitializedState
  }

  cleanup(): void {
    const cardinalListener = CardinalCommerceListener.getInstance()
    cardinalListener.stopListening()
    this.isInitializedState = false
    this.microformInstance = null
  }

  // Helper methods
  private decodeJWT(token: string) {
    try {
      const payload = token.split('.')[1]
      const decoded = JSON.parse(atob(payload))
      return decoded
    } catch (error) {
      throw new Error('Failed to decode JWT token')
    }
  }

  private loadCybersourceScript(scriptUrl: string, integrity: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${scriptUrl}"]`)
      if (existingScript) {
        if (typeof window.Flex === 'function') {
          resolve()
        } else {
          existingScript.addEventListener('load', () => resolve())
          existingScript.addEventListener('error', () => reject(new Error('Script failed to load')))
        }
        return
      }

      const script = document.createElement('script')
      script.src = scriptUrl
      script.integrity = integrity
      script.crossOrigin = API_CONFIG.FRONTEND_BASE_URL
      script.onload = () => {
        let attempts = 0
        const maxAttempts = 100

        const waitForFLEX = () => {
          if (window.Flex && typeof window.Flex === 'function') {
            resolve()
          } else {
            attempts++
            if (attempts >= maxAttempts) {
              reject(new Error('Flex library failed to initialize after script load'))
              return
            }
            setTimeout(waitForFLEX, 50)
          }
        }
        waitForFLEX()
      }
      script.onerror = () => {
        reject(new Error('Failed to load Cybersource script'))
      }

      document.head.appendChild(script)
    })
  }

  private collectDeviceInformation() {
    return {
      ipAddress: '127.0.0.1',
      fingerprintSessionId: this.cardinalSessionId || `mock-session-${Date.now()}`,
      httpAcceptBrowserValue: navigator.userAgent.includes('Chrome') ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      httpAcceptContent: navigator.userAgent.includes('Chrome') ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      httpBrowserLanguage: navigator.language || 'en-US',
      httpBrowserJavaEnabled: false,
      httpBrowserJavaScriptEnabled: true,
      httpBrowserColorDepth: screen.colorDepth?.toString() || '24',
      httpBrowserScreenHeight: screen.height?.toString() || '1280',
      httpBrowserScreenWidth: screen.width?.toString() || '1280',
      httpBrowserTimeDifference: new Date().getTimezoneOffset().toString(),
      userAgentBrowserValue: navigator.userAgent
    }
  }

  // Getter methods for refs
  getCardNumberRef() {
    return this.cardNumberElement
  }

  getCvvRef() {
    return this.cvvElement
  }
} 