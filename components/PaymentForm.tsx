'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { CreditCard, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { 
  PaymentFormData, 
  MicroformInstance, 
  CybersourceToken, 
  PaymentResponse,
  AuthenticationSetupRequest,
  AuthenticationSetupResponse,
  CardinalCommerceMessage,
  EnrollmentCheckRequest,
  EnrollmentCheckResponse,
  ChallengeRequest
} from '@/types/payment'
import ChallengeModal from './ChallengeModal'
import { CardinalCommerceListener } from './CardinalCommerceListener'

const CARD_TYPES = {
  visa: '💳',
  mastercard: '💳', 
  amex: '💳',
  discover: '💳',
  unknown: '💳'
}

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'PH', name: 'Philippines' },
  { code: 'IN', name: 'India' },
  { code: 'MX', name: 'Mexico' },
]

export default function PaymentForm() {
  const [microformInstance, setMicroformInstance] = useState<MicroformInstance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [paymentToken, setPaymentToken] = useState<string | null>(null)
  const [cardType, setCardType] = useState<string>('unknown')
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form')
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [deviceDataCollected, setDeviceDataCollected] = useState(false)
  const [cardinalSessionId, setCardinalSessionId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [clientIpAddress, setClientIpAddress] = useState<string>('')
  
  // 3D Secure Authentication States
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authenticationSetup, setAuthenticationSetup] = useState<AuthenticationSetupResponse | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [ddcUrl, setDdcUrl] = useState<string | null>(null)
  const [ddcReference, setDdcReference] = useState<string | null>(null)
  const [merchantReference, setMerchantReference] = useState<string | null>(null)
  const [authenticationReferenceId, setAuthenticationReferenceId] = useState<string | null>(null)

  // Challenge Flow States
  const [showChallenge, setShowChallenge] = useState(false)
  const [challengeStepUpUrl, setChallengeStepUpUrl] = useState<string | null>(null)
  const [challengeTransactionId, setChallengeTransactionId] = useState<string | null>(null)

  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [challengeAccessToken, setChallengeAccessToken] = useState<string | null>(null);
  const [challengeReferenceId, setChallengeReferenceId] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const autoPaymentTriggeredRef = useRef(false);

  const cardNumberRef = useRef<HTMLDivElement>(null)
  const cvvRef = useRef<HTMLDivElement>(null)
  const currentTokenRef = useRef<string | null>(null)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Get client IP address
  useEffect(() => {
    const getClientIp = async () => {
      console.log('🌐 Attempting to get client IP address...')
      try {
        console.log('📡 Fetching IP from api.ipify.org...')
        const response = await fetch('https://api.ipify.org?format=json')
        console.log('📡 IP API response status:', response.status)
        
        if (!response.ok) {
          throw new Error(`IP API returned status: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('🌐 IP address received:', data.ip)
        setClientIpAddress(data.ip)
      } catch (error) {
        console.error('❌ Failed to get IP address from api.ipify.org:', error)
        
        // Fallback: Try alternative IP service
        try {
          console.log('🔄 Trying fallback IP service...')
          const fallbackResponse = await fetch('https://api64.ipify.org?format=json')
          const fallbackData = await fallbackResponse.json()
          console.log('🌐 Fallback IP address received:', fallbackData.ip)
          setClientIpAddress(fallbackData.ip)
        } catch (fallbackError) {
          console.error('❌ Fallback IP service also failed:', fallbackError)
          console.log('⚠️ Setting IP address to localhost as fallback')
          setClientIpAddress('127.0.0.1')
        }
      }
    }
    
    if (mounted) {
      getClientIp()
    }
  }, [mounted])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<PaymentFormData>({
    defaultValues: {
      currency: 'USD',
      country: 'US'
    }
  })

  const amount = watch('amount')
  const currency = watch('currency')

  // Initialize Cybersource Microform
  useEffect(() => {
    console.log('🔄 useEffect triggered - starting initialization')
    
    const decodeJWT = (token: string) => {
      try {
        const payload = token.split('.')[1]
        const decoded = JSON.parse(atob(payload))
        return decoded
      } catch (error) {
        throw new Error('Failed to decode JWT token')
      }
    }
    
    const loadCybersourceScript = (scriptUrl: string, integrity: string): Promise<void> => {
      return new Promise((resolve, reject) => {
                 // Check if script already exists
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
        script.crossOrigin = 'http://localhost:3000'
        script.onload = () => {
          console.log('✅ Cybersource FLEX script loaded successfully')
          console.log('🔍 Checking window object for Flex...')
          console.log('window.Flex exists:', !!window.Flex)
          console.log('window.Flex value:', window.Flex)
          console.log('window object keys:', Object.keys(window).filter(key => key.includes('FLEX') || key.includes('flex') || key.includes('Cybersource')))
          
          // Wait for FLEX to be available after script loads
          let attempts = 0
          const maxAttempts = 100 // 5 seconds max wait
          
          const waitForFLEX = () => {
                                      console.log(`🔍 Attempt ${attempts + 1}: window.Flex =`, window.Flex)
            console.log(`🔍 Attempt ${attempts + 1}: typeof window.Flex =`, typeof window.Flex)
            
            if (window.Flex && typeof window.Flex === 'function') {
              console.log('✅ FLEX library is ready')
              resolve()
            } else {
              attempts++
              if (attempts >= maxAttempts) {
                console.log('❌ Final attempt - window.Flex:', window.Flex)
                console.log('❌ Available window properties:', Object.getOwnPropertyNames(window).filter(prop => 
                  prop.toLowerCase().includes('flex') || 
                  prop.toLowerCase().includes('cyber') ||
                  prop.toLowerCase().includes('cs')
                ))
                reject(new Error('Flex library failed to initialize after script load'))
                return
              }
              console.log(`⏳ Waiting for FLEX to initialize... (${attempts}/${maxAttempts})`)
              setTimeout(waitForFLEX, 50)
            }
          }
          waitForFLEX()
        }
        script.onerror = () => {
          console.error('❌ Failed to load Cybersource FLEX script')
          reject(new Error('Failed to load Cybersource script'))
        }
        
        document.head.appendChild(script)
        console.log('📜 Loading Cybersource script:', scriptUrl)
      })
    }
    
    const initializeMicroform = async () => {
      try {
        console.log('🔄 Step 1: Getting JWT from backend...')
        
        // Get microform token from backend
        const response = await fetch('http://localhost:8080/api/v1/payment/checkout-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
           'transactionId': 'I4pyyshLem'
          })
        })
        
        console.log('📡 API Response status:', response.status, response.ok)
        
        const data = await response.json()
        console.log('📦 API Response data:', data)
        
        if (data.result !== 'SUCCESS') {
          throw new Error(`Backend API returned error: ${data.result}. Errors: ${data.readableErrorMessages?.join(', ') || 'Unknown error'}`)
        }
        
        if (!data.token) {
          throw new Error('No token received from backend API')
        }

        console.log('🔍 Step 2: Decoding JWT to extract script info...')
        
        // Decode JWT to get script URL and integrity
        const decodedJWT = decodeJWT(data.token)
        console.log('🔓 Decoded JWT:', decodedJWT)
        
        const clientLibrary = decodedJWT.ctx?.[0]?.data?.clientLibrary
        const clientLibraryIntegrity = decodedJWT.ctx?.[0]?.data?.clientLibraryIntegrity
        
        if (!clientLibrary || !clientLibraryIntegrity) {
          throw new Error('Missing clientLibrary or clientLibraryIntegrity in JWT')
        }
        
        console.log('📜 Script URL:', clientLibrary)
        console.log('🔐 Integrity:', clientLibraryIntegrity)

        console.log('⬇️ Step 3: Loading Cybersource script...')
        
        // Load the correct script with integrity check
        await loadCybersourceScript(clientLibrary, clientLibraryIntegrity)
        
        console.log('🎫 Step 4: Initializing Flex SDK with capture context...')
        
        // Initialize Flex SDK with the capture context (JWT token)
        if (!window.Flex) {
          throw new Error('Cybersource Flex library is not available')
        }
        const flex = new window.Flex(data.token)
        console.log('✅ Flex SDK initialized')
        
        console.log('🎫 Step 5: Creating microform with styling...')
        
        // Create microform with basic styling
        const microform = flex.microform({ 
          styles: {
            'input': {
              'font-size': '16px',
              'color': '#374151'
            }
          }
        })
        setMicroformInstance(microform)
        console.log('✅ Microform created')
        
        console.log('🔧 Step 6: Creating and loading microform fields...')

        // Create and load microform fields following official documentation
        const numberField = microform.createField('number', {
          placeholder: 'Card Number'
        })
        
        const securityCodeField = microform.createField('securityCode', {
          placeholder: 'CVV'
        })
        
        // Load fields into containers
        if (cardNumberRef.current) {
          numberField.load(cardNumberRef.current)
          console.log('✅ Card number field loaded')
          
          // Add field validation listeners
          numberField.on('change', (event: any) => {
            console.log('🔢 Card number field change:', event)
            console.log('🔢 Card number valid:', event.valid)
            console.log('🔢 Card number could be valid:', event.couldBeValid)
          })
          
          numberField.on('error', (event: any) => {
            console.error('❌ Card number field error:', event)
          })
          
          numberField.on('load', () => {
            console.log('✅ Card number field loaded and ready')
          })
        }

        if (cvvRef.current) {
          securityCodeField.load(cvvRef.current)
          console.log('✅ Security code field loaded')
          
          // Add field validation listeners
          securityCodeField.on('change', (event: any) => {
            console.log('🔢 Security code field change:', event)
            console.log('🔢 Security code valid:', event.valid)
            console.log('🔢 Security code could be valid:', event.couldBeValid)
          })
          
          securityCodeField.on('error', (event: any) => {
            console.error('❌ Security code field error:', event)
          })
          
          securityCodeField.on('load', () => {
            console.log('✅ Security code field loaded and ready')
          })
        }

        console.log('🔧 Step 7: Setting up Cardinal Commerce device data collection...')
        
        // Set up Cardinal Commerce message listener using the separate class
        const cardinalListener = CardinalCommerceListener.getInstance();
        cardinalListener.startListening((messageData) => {
          // Enable payment button when any message is received (like visa-aft)
          setIsAuthenticating(false)
          
          if (messageData.MessageType === "profile.completed" && messageData.Status === true) {
            console.log('✅ Device data collection completed successfully')
            console.log('🔍 Cardinal Commerce Session Data:')
            console.log('  Session ID:', messageData.SessionId)
            console.log('  Message Type:', messageData.MessageType)
            console.log('  Status:', messageData.Status)
            console.log('  Full Message Data:', messageData)
            
            // Enhanced Cardinal data logging
            console.log('🎯 DETAILED CARDINAL SESSION DATA:')
            console.log('🎯 ===============================')
            console.log('🎯 Session ID:', messageData.SessionId)
            console.log('🎯 Message Type:', messageData.MessageType)
            console.log('🎯 Status:', messageData.Status)
            
            // Log any additional data that might be in the message
            if (messageData.Data) {
              console.log('📊 Additional Cardinal Data:', messageData.Data)
              console.log('📊 Data type:', typeof messageData.Data)
              if (typeof messageData.Data === 'object') {
                console.log('📊 Data keys:', Object.keys(messageData.Data))
                for (const [key, value] of Object.entries(messageData.Data)) {
                  console.log(`📊   Data.${key}:`, value)
                }
              }
            }
            if (messageData.ErrorNumber) {
              console.log('⚠️ Cardinal Error Number:', messageData.ErrorNumber)
            }
            if (messageData.ErrorDescription) {
              console.log('⚠️ Cardinal Error Description:', messageData.ErrorDescription)
            }
            
            // Log any other properties that might exist
            console.log('🔍 Checking for other Cardinal properties...')
            const knownProps = ['SessionId', 'MessageType', 'Status', 'Data', 'ErrorNumber', 'ErrorDescription']
            for (const [key, value] of Object.entries(messageData)) {
              if (!knownProps.includes(key)) {
                console.log(`🔍 Additional property found: ${key} =`, value)
              }
            }
            console.log('🎯 ===============================')
            
            console.log('🔍 Setting deviceDataCollected to true')
            setDeviceDataCollected(true)
            console.log('🔍 Setting cardinalSessionId to:', messageData.SessionId)
            setCardinalSessionId(messageData.SessionId) // Fixed: use SessionId instead of "Session Id"
            
            console.log('🎯 Cardinal Commerce fingerprint session ID captured:', messageData.SessionId)
            console.log('🎯 This will be used as fingerprintSessionId in device data')
            
            // Auto-proceed to payment processing since we have all required data (only once)
            if (!autoPaymentTriggeredRef.current) {
              console.log('🚀 Auto-proceeding to payment processing...')
              autoPaymentTriggeredRef.current = true
              
              // Get the current form data and proceed with payment
              const currentFormData = watch()
              if (currentFormData.amount && currentFormData.firstName && currentFormData.lastName && currentFormData.email) {
                // Use setTimeout to ensure state updates are complete
                setTimeout(() => {
                  processPaymentWithDeviceData(messageData.SessionId, currentFormData)
                }, 100)
              } else {
                console.log('⚠️ Form data not complete, user needs to fill form and submit again')
                toast.success('Device data collected! Please complete the form and submit again.')
              }
            } else {
              console.log('⚠️ Auto payment already triggered, skipping duplicate call')
            }
            
          } else if (messageData.MessageType === "profile.error") {
            console.error('❌ Device data collection failed:', messageData)
            console.error('❌ ERROR CARDINAL DATA DUMP:')
            console.error('❌ =========================')
            console.error('❌ Complete error messageData:', messageData)
            for (const [key, value] of Object.entries(messageData)) {
              console.error(`❌   ${key}:`, value)
            }
            console.error('❌ =========================')
            // Don't show error toast, just log it (like visa-aft)
          } else {
            console.log('ℹ️ Other Cardinal Commerce message:', messageData.MessageType)
            console.log('ℹ️ OTHER MESSAGE CARDINAL DATA DUMP:')
            console.log('ℹ️ =================================')
            console.log('ℹ️ Complete other messageData:', messageData)
            for (const [key, value] of Object.entries(messageData)) {
              console.log(`ℹ️   ${key}:`, value)
            }
            console.log('ℹ️ =================================')
          }
        });
        
        console.log('✅ Cardinal Commerce device data collection listener set up')

        // Note: Cardinal Commerce form will be submitted after authentication setup
        // when accessToken and ddcUrl are available (like visa-aft)

        setIsInitialized(true)
        console.log('🎉 Microform initialization complete!')
        
      } catch (error) {
        console.error('❌ Microform initialization error:', error)
        toast.error(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    initializeMicroform()
    
    // Cleanup function to stop the listener when component unmounts
    return () => {
      const cardinalListener = CardinalCommerceListener.getInstance();
      cardinalListener.stopListening();
    }
  }, [])

  // Process payment with collected device data (like visa-aft receipt.php)
  const processPaymentWithDeviceData = async (sessionId: string, data: PaymentFormData) => {
    console.log('🚀 processPaymentWithDeviceData called with sessionId:', sessionId)
    
    try {
      console.log('💳 Processing payment with collected device data...')
      
      // Collect comprehensive device information with the real session ID
      const deviceInfo = collectDeviceInformation(sessionId)
      
      // Create payment request with all collected data (like visa-aft)
      const paymentRequest = {
        transientToken: currentTokenRef.current || paymentToken,
        cardHolder: `${data.firstName} ${data.lastName}`,
        currency: data.currency,
        totalAmount: data.amount.toString(),
        returnUrl: window.location.origin + '/payment/3ds-callback',
        merchantReference: merchantReference || 'order-' + Date.now(),
        ecommerceIndicatorAuth: 'internet',
        isSaveCard: false,
        // Personal information
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        // Device information (like visa-aft)
        ...deviceInfo
      }
      
      console.log('📤 Payment Request with Device Data:')
      console.log('  Transient Token:', paymentRequest.transientToken ? paymentRequest.transientToken.substring(0, 20) + '...' : 'null')
      console.log('  Card Holder:', paymentRequest.cardHolder)
      console.log('  Currency:', paymentRequest.currency)
      console.log('  Total Amount:', paymentRequest.totalAmount)
      console.log('  Return URL:', paymentRequest.returnUrl)
      console.log('  Merchant Reference:', paymentRequest.merchantReference)
      console.log('  First Name:', paymentRequest.firstName)
      console.log('  Last Name:', paymentRequest.lastName)
      console.log('  Email:', paymentRequest.email)
      console.log('  IP Address:', paymentRequest.ipAddress)
      console.log('  Fingerprint Session ID:', paymentRequest.fingerprintSessionId)
      console.log('  User Agent:', paymentRequest.userAgentBrowserValue)
      console.log('  Full Payment Request:', paymentRequest)

      const response = await fetch('http://localhost:8080/api/v1/payment/combined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentRequest)
      })

      const responseData = await response.json()
      console.log('📥 Payment response:', responseData)

      if (responseData.result === 'SUCCESS') {
        // Payment authorized successfully by the backend (no capture)
        console.log('✅ Payment authorized successfully (authorization-only flow)')
        const paymentResponse = responseData.paymentResponse;
        setStep('success');
        setTransactionId(paymentResponse?.id || paymentResponse?.transactionId);
        toast.success('Payment authorized successfully!');
      } else if (responseData.result === 'CHALLENGE_REQUIRED') {
        // Handle 3DS challenge
        console.log('🔐 3DS challenge required')
        const paymentData = responseData.paymentResponse
        const stepUpUrl = paymentData.consumerAuthenticationInformation?.stepUpUrl
        const challengeAccessToken = paymentData.consumerAuthenticationInformation?.accessToken
        const referenceId = paymentData.consumerAuthenticationInformation?.referenceId
        const clientRefInfo = paymentData.clientReferenceInformation;
        const merchantRef = clientRefInfo?.code || 'order-' + Date.now();
        
        if (stepUpUrl && challengeAccessToken && referenceId) {
          setChallengeStepUpUrl(stepUpUrl)
          setChallengeAccessToken(challengeAccessToken)
          setChallengeTransactionId(referenceId)
          setMerchantReference(merchantRef); 
          setShowChallenge(true)
        } else {
          throw new Error('Missing challenge data from payment response')
        }
      } else {
        throw new Error(responseData.error || 'Payment failed')
      }
    } catch (error) {
      console.error('Payment processing error:', error)
      toast.error(error instanceof Error ? error.message : 'Payment failed')
      setStep('form')
    } finally {
      setIsAuthenticating(false)
    }
  }

  // 3D Secure Authentication Functions
  const setupPayerAuthentication = async (transientToken: string): Promise<AuthenticationSetupResponse> => {
    try {
      console.log('🔐 Setting up 3D Secure authentication...')
      
      const authRequest: AuthenticationSetupRequest = {
        isTransientToken: true,
        transientToken: transientToken,
        isSavedToken: false
      }

      const response = await fetch('http://localhost:3000/payment/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authRequest)
      })

      if (!response.ok) {
        throw new Error(`Authentication setup failed: ${response.status}`)
      }

      const authData: AuthenticationSetupResponse = await response.json()
      console.log('🔐 Authentication setup response:', authData)

      if (authData.data?.status === 'COMPLETED') {
        setAuthenticationSetup(authData)
        setAccessToken(authData.data.consumerAuthenticationInformation?.accessToken || null)
        setDdcUrl(authData.data.consumerAuthenticationInformation?.deviceDataCollectionUrl || null)
        setDdcReference(authData.data.consumerAuthenticationInformation?.referenceId || null)
        setMerchantReference(authData.data.clientReferenceInformation?.code || null)
        return authData
      } else {
        throw new Error('Authentication setup not completed')
      }
    } catch (error) {
      console.error('❌ Authentication setup error:', error)
      throw error
    }
  }

  // Trigger device data collection
  const triggerDeviceDataCollection = async () => {
    try {
      console.log('📡 Triggering Cardinal Commerce device data collection...')
      
      // Submit the Cardinal Commerce form (accessToken and ddcUrl are now available from auth setup)
      const cardinalCollectionForm = document.querySelector('#cardinal_collection_form') as HTMLFormElement
      if (cardinalCollectionForm && accessToken && ddcUrl) {
        console.log('🔍 Cardinal Commerce form data:', {
          action: ddcUrl,
          jwt: accessToken ? accessToken.substring(0, 50) + '...' : 'empty'
        })
        cardinalCollectionForm.submit()
        console.log('✅ Cardinal Commerce form submitted')
      } else {
        console.warn('⚠️ Cardinal collection form not found or missing accessToken/ddcUrl')
        console.log('🔍 Current state:', { accessToken: !!accessToken, ddcUrl: !!ddcUrl })
      }
      
      // Wait for device data collection to complete
      return new Promise<void>((resolve, reject) => {
        const checkComplete = function() {
          if (deviceDataCollected && cardinalSessionId) {
            console.log('✅ Device data collection completed successfully')
            resolve()
          } else {
            setTimeout(checkComplete, 500) // Check every 500ms
          }
        }
        checkComplete()
      })
    } catch (error) {
      console.error('❌ Device data collection failed:', error)
      console.warn('⚠️ Continuing payment flow without device data collection')
      // Don't throw error, just log and continue
      return Promise.resolve()
    }
  }

  // Enrollment Check Function
  const checkEnrollment = async (tokenizedToken: string, data: PaymentFormData): Promise<EnrollmentCheckResponse> => {
    try {
      console.log('🔍 Checking 3D Secure enrollment...')
      
      const enrollmentRequest: EnrollmentCheckRequest = {
        flexResponse: tokenizedToken,
        cardHolderName: `${data.firstName} ${data.lastName}`,
        currency: data.currency,
        totalAmount: data.amount.toString(),
        paReference: ddcReference || undefined,
        returnUrl: `${window.location.origin}/payment/challenge-callback`,
        merchantReference: merchantReference || undefined,
        ecommerceIndicatorAuth: 'vbv'
      }

      const response = await fetch('http://localhost:3000/payment/enrol-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrollmentRequest)
      })

      if (!response.ok) {
        throw new Error(`Enrollment check failed: ${response.status}`)
      }

      const enrollmentData: EnrollmentCheckResponse = await response.json()
      console.log('🔍 Enrollment check response:', enrollmentData)

      return enrollmentData
    } catch (error) {
      console.error('❌ Enrollment check error:', error)
      throw error
    }
  }

  // Challenge Completion Handler
  const handleChallengeComplete = async (
    success: boolean,
    authenticationTransactionId?: string,
    data?: PaymentFormData,
    tokenizedToken?: string
  ) => {
    setShowChallenge(false)
    if (!success || !authenticationTransactionId || !data || !tokenizedToken) {
      toast.error('3DS challenge failed or cancelled')
      setStep('form')
      return
    }
    setIsLoading(true)
    try {
      // Collect device information (only ip and fingerprintSessionId for after-challenge)
      const deviceInfo = collectDeviceInformation()
      const afterChallengeDeviceInfo = {
        ipAddress: deviceInfo.ipAddress,
        fingerprintSessionId: deviceInfo.fingerprintSessionId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email
      }

      // Call /api/v1/payment/combined-after-challenge
      const afterRes = await fetch('http://localhost:8080/api/v1/payment/combined-after-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authenticationTransactionId,
          currency: data.currency,
          totalAmount: data.amount.toString(),
          transientToken: tokenizedToken,
          merchantReference: merchantReference || 'order-' + Date.now(),
          ecommerceIndicatorAuth: 'internet',
          // Device information (only ip and fingerprintSessionId)
          ...afterChallengeDeviceInfo
        })
      })
      const afterData = await afterRes.json()
      if (afterData.result === 'SUCCESS') {
        // Payment authorized successfully after challenge (no capture)
        console.log('✅ Payment authorized successfully after challenge (authorization-only)')
        const paymentResponse = afterData.paymentResponse;
        setStep('success');
        setTransactionId(paymentResponse?.id || paymentResponse?.transactionId);
        toast.success('Payment authorized successfully!');
      } else {
        throw new Error(afterData.error || 'Payment failed after challenge')
      }
    } catch (error) {
      console.error('After challenge error:', error)
      toast.error(error instanceof Error ? error.message : 'Payment failed after challenge')
      setStep('form')
    } finally {
      setIsLoading(false)
    }
  }

  // Collect device information from browser (like visa-aft)
  const collectDeviceInformation = (sessionId?: string) => {
    console.log('🔍 Starting device information collection...')
    console.log('🔍 Session ID parameter:', sessionId)
    console.log('🔍 Current cardinalSessionId state:', cardinalSessionId)
    
    // Use the provided session ID or fall back to state, then to mock
    const fingerprintSessionId = sessionId || cardinalSessionId || `mock-session-${Date.now()}`
    console.log('🔍 Final fingerprint session ID:', fingerprintSessionId)
    
    // Collect all available device information
    console.log('🔍 Current clientIpAddress state:', clientIpAddress)
    
    const deviceInfo = {
      ipAddress: clientIpAddress || '127.0.0.1', // Use localhost as fallback if IP not available
      fingerprintSessionId: fingerprintSessionId, // Use real Cardinal Commerce session ID
      // Additional device information fields
      httpAcceptBrowserValue: navigator.userAgent.includes('Chrome') ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      httpAcceptContent: navigator.userAgent.includes('Chrome') ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      httpBrowserLanguage: navigator.language || 'en-US',
      httpBrowserJavaEnabled: false, // Java is typically disabled in modern browsers
      httpBrowserJavaScriptEnabled: true, // We're running JavaScript, so it's enabled
      httpBrowserColorDepth: screen.colorDepth?.toString() || '24',
      httpBrowserScreenHeight: screen.height?.toString() || '1280',
      httpBrowserScreenWidth: screen.width?.toString() || '1280',
      httpBrowserTimeDifference: new Date().getTimezoneOffset().toString(),
      userAgentBrowserValue: navigator.userAgent
    }
    
    // Log detailed device information
    console.log('📱 Device Information Collected:')
    console.log('  IP Address:', deviceInfo.ipAddress)
    console.log('  Fingerprint Session ID:', deviceInfo.fingerprintSessionId)
    console.log('  Browser Language:', deviceInfo.httpBrowserLanguage)
    console.log('  Screen Resolution:', `${deviceInfo.httpBrowserScreenWidth}x${deviceInfo.httpBrowserScreenHeight}`)
    console.log('  Color Depth:', deviceInfo.httpBrowserColorDepth)
    console.log('  Timezone Offset:', deviceInfo.httpBrowserTimeDifference)
    console.log('  User Agent:', deviceInfo.userAgentBrowserValue)
    console.log('  Accept Browser Value:', deviceInfo.httpAcceptBrowserValue)
    console.log('  Accept Content:', deviceInfo.httpAcceptContent)
    console.log('  Java Enabled:', deviceInfo.httpBrowserJavaEnabled)
    console.log('  JavaScript Enabled:', deviceInfo.httpBrowserJavaScriptEnabled)
    
    // Log additional browser capabilities
    console.log('🔧 Additional Browser Capabilities:')
    console.log('  Cookie Enabled:', navigator.cookieEnabled)
    console.log('  Do Not Track:', navigator.doNotTrack)
    console.log('  Platform:', navigator.platform)
    console.log('  Vendor:', navigator.vendor)
    console.log('  Connection Type:', (navigator as any).connection?.type || 'unknown')
    console.log('  Connection Speed:', (navigator as any).connection?.downlink || 'unknown')
    console.log('  Memory Info:', (navigator as any).deviceMemory || 'unknown')
    console.log('  Hardware Concurrency:', navigator.hardwareConcurrency || 'unknown')
    console.log('  Max Touch Points:', navigator.maxTouchPoints || 'unknown')
    
    // Log screen information
    console.log('🖥️ Screen Information:')
    console.log('  Available Width:', screen.availWidth)
    console.log('  Available Height:', screen.availHeight)
    console.log('  Pixel Depth:', screen.pixelDepth)
    console.log('  Orientation:', screen.orientation?.type || 'unknown')
    
    // Log window information
    console.log('🪟 Window Information:')
    console.log('  Inner Width:', window.innerWidth)
    console.log('  Inner Height:', window.innerHeight)
    console.log('  Outer Width:', window.outerWidth)
    console.log('  Outer Height:', window.outerHeight)
    console.log('  Device Pixel Ratio:', window.devicePixelRatio)
    
    // Log location information
    console.log('🌍 Location Information:')
    console.log('  Protocol:', window.location.protocol)
    console.log('  Hostname:', window.location.hostname)
    console.log('  Port:', window.location.port)
    console.log('  Pathname:', window.location.pathname)
    console.log('  Search:', window.location.search)
    console.log('  Hash:', window.location.hash)
    
    console.log('✅ Device information collection completed')
    console.log('📦 Final device info object:', deviceInfo)
    
    return deviceInfo
  }

  const onSubmit = async (data: PaymentFormData) => {
    let tokenizedToken: string | null = null;
    if (!microformInstance) {
      toast.error('Payment form not initialized')
      return
    }

    // Validate that required fields are present
    if (!data.expirationMonth || !data.expirationYear) {
      toast.error('Please select card expiration month and year')
      return
    }

    // Check if Cybersource fields are loaded
    if (!cardNumberRef.current || !cvvRef.current) {
      toast.error('Payment fields not loaded. Please refresh the page.')
      return
    }

    setIsLoading(true)

    try {
      // Step 1: Tokenize card (like visa-aft checkout.php)
      await new Promise<void>((resolve, reject) => {
        microformInstance.createToken({
          expirationMonth: data.expirationMonth,
          expirationYear: data.expirationYear,
        }, (err: any, token: string) => {
          if (err) {
            reject(new Error(err.message || 'Tokenization failed'))
            return
          }
          tokenizedToken = token;
          setCardType('unknown');
          resolve()
        })
      })

      if (!tokenizedToken) {
        throw new Error('Tokenization failed - no token received')
      }

      // Store the tokenized token for later use in processPayment
      setPaymentToken(tokenizedToken)
      currentTokenRef.current = tokenizedToken
      console.log('💳 Token stored successfully')

      // Step 2: Check if device data collection is already complete
      if (deviceDataCollected && cardinalSessionId && authenticationSetup?.data?.consumerAuthenticationInformation?.accessToken && authenticationSetup?.data?.consumerAuthenticationInformation?.deviceDataCollectionUrl) {
        console.log('✅ Device data already collected, payment will be processed automatically')
        console.log('ℹ️ No need to submit form again - payment processing is automatic')
        toast.success('Device data collected! Payment will be processed automatically.')
        setIsLoading(false)
        return
      }

      // Step 3: Submit to backend for authentication setup (like visa-aft token.php)
      console.log('📤 Submitting to backend for authentication setup...')
      
      const authSetupRequest = {
        transientToken: tokenizedToken,
        cardHolder: `${data.firstName} ${data.lastName}`,
        currency: data.currency,
        totalAmount: data.amount.toString(),
        paReference: 'ref-' + Date.now(),
        returnUrl: window.location.origin + '/payment/3ds-callback',
        merchantReference: 'order-' + Date.now(),
        ecommerceIndicatorAuth: 'internet',
        isSaveCard: data.saveCard || false,
        // Personal information
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email
      }

      const authResponse = await fetch('http://localhost:8080/api/v1/payment/combined-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authSetupRequest)
      })

      const authResponseData = await authResponse.json()
      console.log('📥 Authentication setup response:', authResponseData)

      if (authResponseData.result !== 'SUCCESS') {
        throw new Error(authResponseData.error || 'Authentication setup failed')
      }

      // Extract authentication setup data
      const authSetup = authResponseData.authenticationSetup
      if (!authSetup) {
        throw new Error('No authentication setup data received')
      }

      // Extract data from the nested structure
      const consumerAuthInfo = authSetup.consumerAuthenticationInformation
      const clientRefInfo = authSetup.clientReferenceInformation
      
      if (!consumerAuthInfo) {
        throw new Error('No consumer authentication information received')
      }

      const accessToken = consumerAuthInfo.accessToken
      const ddcUrl = consumerAuthInfo.deviceDataCollectionUrl
      const ddcReference = consumerAuthInfo.referenceId
      const merchantRef = clientRefInfo?.code || 'order-' + Date.now()

      console.log('🔐 Authentication setup completed:', {
        accessToken: accessToken ? accessToken.substring(0, 50) + '...' : 'null',
        ddcUrl: ddcUrl,
        ddcReference: ddcReference,
        merchantRef: merchantRef
      })

      // Step 4: Trigger device data collection (like visa-aft)
      console.log('📡 Triggering Cardinal Commerce device data collection...')
      setIsAuthenticating(true)
      
      const cardinalCollectionForm = document.querySelector('#cardinal_collection_form') as HTMLFormElement
      if (cardinalCollectionForm && ddcUrl && accessToken) {
        // Update form action and JWT
        cardinalCollectionForm.action = ddcUrl
        const jwtInput = cardinalCollectionForm.querySelector('#cardinal_collection_form_input') as HTMLInputElement
        if (jwtInput) {
          jwtInput.value = accessToken
        }
        
        console.log('🔍 Cardinal Commerce form data:', {
          action: ddcUrl,
          jwt: accessToken ? accessToken.substring(0, 50) + '...' : 'null'
        })
        
        cardinalCollectionForm.submit()
        console.log('✅ Cardinal Commerce form submitted')
      } else {
        throw new Error('Cardinal Commerce form not found or missing accessToken/ddcUrl')
      }

      // Step 5: Wait for device data collection to complete
      // The Cardinal Commerce message listener will set deviceDataCollected to true
      // and the user can then submit the form again to complete the payment
      console.log('⏳ Waiting for device data collection to complete...')
      console.log('ℹ️ Please submit the form again after device data collection is complete')
      
      // Store the authentication data for the next submission
      setAccessToken(accessToken)
      setDdcUrl(ddcUrl)
      setDdcReference(ddcReference)
      setMerchantReference(merchantRef)
      setIsAuthenticating(false)

    } catch (error) {
      console.error('Payment error:', error)
      toast.error(error instanceof Error ? error.message : 'Payment failed')
      setIsAuthenticating(false)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setStep('form')
    setPaymentToken(null)
    setTransactionId(null)
    setCardType('unknown')
    autoPaymentTriggeredRef.current = false
    setDeviceDataCollected(false)
    setCardinalSessionId(null)
  }

  if (step === 'success') {
    return (
      <div className="card p-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Authorized!</h2>
          <p className="text-gray-600 mb-4">
            Your payment has been authorized successfully.
          </p>
          {transactionId && (
            <p className="text-sm text-gray-500 mb-6">
              Transaction ID: <span className="font-mono">{transactionId}</span>
            </p>
          )}
          <button
            onClick={resetForm}
            className="btn-primary"
          >
            Authorize Another Payment
          </button>
        </div>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="card p-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-4">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authorizing Payment</h2>
          <p className="text-gray-600">
            Please wait while we securely authorize your payment...
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Cardinal Commerce Device Data Collection - Outside main form */}
      <iframe 
        id="cardinal_collection_iframe" 
        name="collectionIframe" 
        height="10" 
        width="10" 
        style={{ display: 'none' }}
      />
      <form 
        id="cardinal_collection_form" 
        method="POST" 
        target="collectionIframe"
        action={ddcUrl ?? ''}
        style={{ display: 'none' }}
      >
        <input 
          id="cardinal_collection_form_input" 
          type="hidden" 
          name="JWT"
          value={accessToken || ''}
        />
      </form>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-8">
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center space-x-2">
          <Lock className="h-5 w-5 text-green-600" />
          <span className="text-sm text-gray-600">Secured by Cybersource</span>
        </div>
      </div>

      {/* Amount Section */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="amount" className="form-label">
              Amount *
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="1"
              className="form-input"
              placeholder="0.00"
              {...register('amount', {
                required: 'Amount is required',
                min: { value: 1, message: 'Minimum amount is $1' },
                max: { value: 10000, message: 'Maximum amount is $10,000' }
              })}
            />
            {errors.amount && (
              <p className="form-error">{errors.amount.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="currency" className="form-label">
              Currency *
            </label>
            <select
              id="currency"
              className="form-input"
              {...register('currency', { required: 'Currency is required' })}
            >
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="PHP">PHP - Philippine Peso</option>
            </select>
          </div>
        </div>

        {amount && (
          <div className="mt-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {currency} {amount ? parseFloat(amount.toString()).toFixed(2) : '0.00'}
            </p>
          </div>
        )}
      </div>

      {/* Personal Information */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Personal Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="firstName" className="form-label">
              First Name *
            </label>
            <input
              id="firstName"
              type="text"
              className="form-input"
              placeholder="John"
              {...register('firstName', {
                required: 'First name is required',
                minLength: { value: 2, message: 'Minimum 2 characters' }
              })}
            />
            {errors.firstName && (
              <p className="form-error">{errors.firstName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="form-label">
              Last Name *
            </label>
            <input
              id="lastName"
              type="text"
              className="form-input"
              placeholder="Doe"
              {...register('lastName', {
                required: 'Last name is required',
                minLength: { value: 2, message: 'Minimum 2 characters' }
              })}
            />
            {errors.lastName && (
              <p className="form-error">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="form-label">
            Email Address *
          </label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="john.doe@example.com"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Invalid email address'
              }
            })}
          />
          {errors.email && (
            <p className="form-error">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* Card Information */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Lock className="h-5 w-5 mr-2" />
          Card Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="form-label">
              Card Number * {CARD_TYPES[cardType as keyof typeof CARD_TYPES]}
            </label>
            <div
              ref={cardNumberRef}
              className="microform-field bg-white"
              style={{ minHeight: '48px' }}
            />
            {mounted && !isInitialized && (
              <div className="flex items-center mt-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading secure card input...
              </div>
            )}
          </div>

          <div>
            <label className="form-label">
              Security Code *
            </label>
            <div
              ref={cvvRef}
              className="microform-field bg-white"
              style={{ minHeight: '48px' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="expirationMonth" className="form-label">
              Expiration Month *
            </label>
            <select
              id="expirationMonth"
              className="form-input"
              {...register('expirationMonth', { required: 'Month is required' })}
            >
              <option value="">Month</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month.toString().padStart(2, '0')}>
                  {month.toString().padStart(2, '0')} - {new Date(0, month - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            {errors.expirationMonth && (
              <p className="form-error">{errors.expirationMonth.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="expirationYear" className="form-label">
              Expiration Year *
            </label>
            <select
              id="expirationYear"
              className="form-input"
              {...register('expirationYear', { required: 'Year is required' })}
            >
              <option value="">Year</option>
              {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() + i).map(year => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
            {errors.expirationYear && (
              <p className="form-error">{errors.expirationYear.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Billing Address */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Billing Address
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="country" className="form-label">
              Country *
            </label>
            <select
              id="country"
              className="form-input"
              {...register('country', { required: 'Country is required' })}
            >
              {COUNTRIES.map(country => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            {errors.country && (
              <p className="form-error">{errors.country.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="city" className="form-label">
              City
            </label>
            <input
              id="city"
              type="text"
              className="form-input"
              placeholder="New York"
              {...register('city')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="address" className="form-label">
              Address
            </label>
            <input
              id="address"
              type="text"
              className="form-input"
              placeholder="123 Main Street"
              {...register('address')}
            />
          </div>

          <div>
            <label htmlFor="postalCode" className="form-label">
              Postal Code
            </label>
            <input
              id="postalCode"
              type="text"
              className="form-input"
              placeholder="12345"
              {...register('postalCode')}
            />
          </div>
        </div>
      </div>



      {/* Security Notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Your payment is secure</p>
            <p>Your card information is encrypted and processed securely through Cybersource. We never store your card details.</p>
          </div>
        </div>
      </div>

      {/* 3D Secure Status */}
      {mounted && isAuthenticating && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <Loader2 className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 animate-spin flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">3D Secure Authentication</p>
              <p>Please wait while we verify your identity with your bank...</p>
            </div>
          </div>
        </div>
      )}

      {mounted && deviceDataCollected && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-green-800">
              <p className="font-medium mb-1">3D Secure Verification Complete</p>
              <p>Your identity has been verified successfully.</p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !isInitialized || isAuthenticating || (deviceDataCollected && cardinalSessionId !== null) || autoPaymentTriggeredRef.current}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing...</span>
          </>
        ) : isAuthenticating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Authenticating...</span>
          </>
        ) : deviceDataCollected && cardinalSessionId ? (
          <>
            <CheckCircle className="h-5 w-5" />
            <span>Payment Processing Automatically...</span>
          </>
        ) : (
          <>
            <Lock className="h-5 w-5" />
            <span>Pay Securely</span>
          </>
        )}
      </button>

      {mounted && !isInitialized && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Initializing secure payment form...
        </p>
      )}
      </form>

      {/* 3D Secure Challenge Modal */}
      {showChallenge && challengeStepUpUrl && challengeAccessToken && (
        <ChallengeModal
          isOpen={showChallenge}
          onClose={() => setShowChallenge(false)}
          accessToken={challengeAccessToken || ''}
          stepUpUrl={challengeStepUpUrl}
          onChallengeComplete={handleChallengeComplete}
        />
      )}
      {paymentResult && (
        <div className={paymentResult.success ? 'success' : 'error'}>
          {paymentResult.message}
        </div>
      )}
    </>
  )
} 