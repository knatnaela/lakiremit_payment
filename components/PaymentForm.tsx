'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { CreditCard, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import {
  PaymentFormData,
  MicroformInstance,
  FlexTokenPayload,
  Transaction,
  TransactionResponse
} from '@/types/payment'
import ChallengeIframe from './ChallengeIframe'
import { CardinalCommerceListener } from './CardinalCommerceListener'
import { decodeJWT, generateUUID } from '@/utils/utils'
import AddressForm from './AddressForm'
import { useSearchParams } from 'next/navigation'
import { API_CONFIG, API_ENDPOINTS, buildApiUrl, CHALLENGE_URLS } from '@/constants/api'


// Card type mapping for Cybersource
const CARD_TYPE_CODES = {
  '001': 'Visa',
  '002': 'Mastercard',
  '003': 'American Express',
  '004': 'Discover',
  '005': 'Diners Club',
  '006': 'Carte Blanche',
  '007': 'JCB',
  '014': 'EnRoute',
  '021': 'JAL',
  '024': 'Maestro (UK Domestic)',
  '031': 'Delta',
  '033': 'Visa Electron',
  '034': 'Dankort',
  '036': 'Cartes Bancaires',
  '037': 'Carta Si',
  '039': 'EAN',
  '040': 'UATP',
  '042': 'Maestro (International)',
  '050': 'Hipercard',
  '051': 'Aura',
  '054': 'Elo',
  '062': 'China UnionPay'
}

// Countries are now handled by the AddressForm component

export default function PaymentForm() {
  const [microformInstance, setMicroformInstance] = useState<MicroformInstance | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [paymentToken, setPaymentToken] = useState<string | null>(null)
  const [cardType, setCardType] = useState<string>('unknown')
  const [step, setStep] = useState<'form' | 'processing' | '3ds-verification' | 'success' | 'failed'>('form')
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [deviceDataCollected, setDeviceDataCollected] = useState(false)
  const [cardinalSessionId, setCardinalSessionId] = useState<string | null>(null)
  const [uuidSessionId, setUuidSessionId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [clientIpAddress, setClientIpAddress] = useState<string>('')
  const [checkoutToken, setCheckoutToken] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Transaction data state
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [isLoadingTransaction, setIsLoadingTransaction] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(null)

  // 3D Secure Authentication States
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [ddcUrl, setDdcUrl] = useState<string | null>(null)

  // Challenge Flow States
  const [showChallenge, setShowChallenge] = useState(false)
  const [challengeStepUpUrl, setChallengeStepUpUrl] = useState<string | null>(null)

  const [challengeAccessToken, setChallengeAccessToken] = useState<string | null>(null);
  const [pareq, setPareq] = useState<string | null>(null);
  const autoPaymentTriggeredRef = useRef(false);
  const [isCollectingDeviceData, setIsCollectingDeviceData] = useState(false)
  const initializationStartedRef = useRef(false);

  const cardNumberRef = useRef<HTMLDivElement>(null)
  const cvvRef = useRef<HTMLDivElement>(null)
  const currentTokenRef = useRef<string | null>(null)

  // Prevent hydration mismatch and generate UUID session ID
  useEffect(() => {
    setMounted(true)
    // Generate UUID session ID for device fingerprinting
    setUuidSessionId(generateUUID())
  }, [])

  // Get client IP address
  useEffect(() => {
    const getClientIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json')
        if (!response.ok) {
          throw new Error(`IP API returned status: ${response.status}`)
        }
        const data = await response.json()
        setClientIpAddress(data.ip)
      } catch (error) {
        // Fallback: Try alternative IP service
        try {
          const fallbackResponse = await fetch('https://api64.ipify.org?format=json')
          const fallbackData = await fallbackResponse.json()
          setClientIpAddress(fallbackData.ip)
        } catch (fallbackError) {
          setClientIpAddress('127.0.0.1') // Use localhost as final fallback
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
    setValue,
    control
  } = useForm<PaymentFormData>({
    defaultValues: {
      currency: 'USD',
      saveCard: false,
      billing: {
        country: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        address2: ''
      }
    }
  })

  const searchParams = useSearchParams()

  const getAuthToken = () => {
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find(cookie => cookie.trim().startsWith('access_token'));
    if (!authCookie) { return null }
    const token = authCookie.split('=')[1].trim();
    return `Bearer ${token}`;
  }

  // Fetch transaction data from query parameter
  useEffect(() => {
    // Prefill names and fixed billing defaults from URL and spec
    const fn = searchParams.get('firstName') || ''
    const ln = searchParams.get('lastName') || ''
    if (fn) { setValue('firstName', fn) }
    if (ln) { setValue('lastName', ln) }
    setValue('billing', {
      address: '1295 Charleston rd',
      city: 'CA',
      state: '',
      postalCode: '94043',
      country: 'US',
      address2: 'Mountain View'
    })

    const fetchTransaction = async () => {
      if (!mounted) { return }

      const transactionId = searchParams.get('transactionId')
      if (!transactionId) {
        setTransactionError('Transaction not found')
        return
      }

      setIsLoadingTransaction(true)
      setTransactionError(null)

      const authToken = getAuthToken();

      try {
        const response = await fetch(buildApiUrl(API_ENDPOINTS.TRANSACTION.GET_USER_TRANSACTION(transactionId)), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken || '',
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data: TransactionResponse = await response.json()

        if (data.result !== 'SUCCESS') {
          throw new Error(data.readableErrorMessages?.join(', ') || 'Failed to fetch transaction')
        }

        if (!data.transactions || data.transactions.length === 0) {
          throw new Error('Transaction not found')
        }

        const transactionData = data.transactions[0]
        setTransaction(transactionData)

        // Set form values with transaction data
        setValue('amount', transactionData.totalAmount)
        setValue('currency', transactionData.currency)

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to fetch transaction'
        setTransactionError(errorMsg)
        toast.error(errorMsg)
      } finally {
        setIsLoadingTransaction(false)
      }
    }

    fetchTransaction()
  }, [mounted, setValue, searchParams])

  // Helper function to get card type name
  const getCardTypeName = (cardTypeCode: string) => {
    return CARD_TYPE_CODES[cardTypeCode as keyof typeof CARD_TYPE_CODES] || 'Unknown'
  }

  // Helper function to extract address data from form
  const getAddressData = (data: PaymentFormData) => {
    // Handle both flat and nested billing structures
    if (data.billing) {
      return {
        billToAddress1: data.billing.address,
        billToAddress2: data.billing.address2,
        billToCity: data.billing.city,
        billToState: data.billing.state,
        billToPostalCode: data.billing.postalCode,
        billToCountry: data.billing.country
      }
    }
    return {
      billToAddress1: data.address,
      billToAddress2: data.address2,
      billToCity: data.city,
      billToState: data.state,
      billToPostalCode: data.postalCode,
      billToCountry: data.country
    }
  }

  // Initialize Cybersource Microform
  useEffect(() => {
    // Prevent duplicate initialization
    if (isInitialized || checkoutToken || initializationStartedRef.current) {
      return
    }

    // Only require mounted state and transaction ID from URL
    if (!mounted) {
      return
    }

    const transactionId = searchParams.get('transactionId')
    if (!transactionId) {
      return // Don't initialize if no transaction ID in URL
    }

    initializationStartedRef.current = true

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
        script.crossOrigin = API_CONFIG.FRONTEND_BASE_URL
        script.onload = () => {
          // Wait for FLEX to be available after script loads
          let attempts = 0
          const maxAttempts = 100 // 5 seconds max wait

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

    const initializeMicroform = async () => {
      try {
        // Get microform token from backend
        const transactionId = searchParams.get('transactionId')

        if (!transactionId) {
          throw new Error('No transaction ID provided in URL')
        }

        const response = await fetch(buildApiUrl(API_ENDPOINTS.PAYMENT.CHECKOUT_TOKEN), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'transactionId': transactionId
          })
        })

        const data = await response.json()

        if (data.result !== 'SUCCESS') {
          throw new Error(`Backend API returned error: ${data.result}. Errors: ${data.readableErrorMessages?.join(', ') || 'Unknown error'}`)
        }

        if (!data.token) {
          throw new Error('No token received from backend API')
        }

        // Store the checkout token for later use
        setCheckoutToken(data.token)

        // Decode JWT to get script URL and integrity
        const decodedJWT = decodeJWT(data.token)
        const clientLibrary = decodedJWT.ctx?.[0]?.data?.clientLibrary
        const clientLibraryIntegrity = decodedJWT.ctx?.[0]?.data?.clientLibraryIntegrity

        if (!clientLibrary || !clientLibraryIntegrity) {
          throw new Error('Missing clientLibrary or clientLibraryIntegrity in JWT')
        }

        // Load the correct script with integrity check
        await loadCybersourceScript(clientLibrary, clientLibraryIntegrity)

        // Initialize Flex SDK with the capture context (JWT token)
        if (!window.Flex) {
          throw new Error('Cybersource Flex library is not available')
        }
        const flex = new window.Flex(data.token)

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

          // Add field validation listeners
          numberField.on('change', () => {
            // Handle card number validation silently
          })

          numberField.on('error', () => {
            toast.error('Card number field error')
          })
        }

        if (cvvRef.current) {
          securityCodeField.load(cvvRef.current)

          // Add field validation listeners
          securityCodeField.on('change', () => {
            // Handle security code validation silently
          })

          securityCodeField.on('error', () => {
            toast.error('Security code field error')
          })
        }

        // Note: Cardinal Commerce listener is set up in a separate useEffect to avoid conflicts

        // Note: Cardinal Commerce form will be submitted after authentication setup
        // when accessToken and ddcUrl are available (like visa-aft)

        setIsInitialized(true)

      } catch (error) {
        toast.error(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    initializeMicroform()

    // Cleanup function to stop the listener when component unmounts
    return () => {
      const cardinalListener = CardinalCommerceListener.getInstance();
      cardinalListener.stopListening();
    }
  }, [mounted, searchParams]) // Run when mounted or search params change

  // Process payment with collected device data
  const processPaymentWithDeviceData = async (sessionId: string, data: PaymentFormData) => {
    try {
      // Validate that we have transaction data
      if (!transaction) {
        throw new Error('Transaction data not available')
      }

      // Collect comprehensive device information with the real session ID
      const deviceInfo = collectDeviceInformation(sessionId)

      // Create payment request with all collected data
      const paymentRequest = {
        transientToken: currentTokenRef.current || paymentToken,
        flexResponse: currentTokenRef.current || paymentToken,
        cardHolder: `${data.firstName} ${data.lastName}`,
        currency: transaction.currency,
        totalAmount: transaction.totalAmount.toString(),
        returnUrl: CHALLENGE_URLS.RESULT_CALLBACK,
        merchantReference: transaction.transactionId,
        ecommerceIndicatorAuth: 'internet',
        // Personal information
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        saveCard: data.saveCard || false,
        // Billing address information
        ...getAddressData(data),
        // Device information
        ...deviceInfo
      }

      console.log('API Request (COMBINED):', { endpoint: buildApiUrl(API_ENDPOINTS.PAYMENT.COMBINED), payload: paymentRequest })
      const response = await fetch(buildApiUrl(API_ENDPOINTS.PAYMENT.COMBINED), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentRequest)
      })

      const responseData = await response.json()
      console.log('API Response (COMBINED):', { status: response.status, data: responseData })

      if (responseData.result === 'SUCCESS') {
        const paymentResponse = responseData.paymentResponse;
        setStep('success');
        setTransactionId(paymentResponse?.id || paymentResponse?.transactionId);
        toast.success('Payment successful!');
        const paymentResponseStatus = paymentResponse.status;
        if (paymentResponseStatus === 'PENDING_AUTHENTICATION') {
          // Handle 3DS challenge
          const paymentData = responseData.paymentResponse;
          const stepUpUrl = paymentData.consumerAuthenticationInformation?.stepUpUrl;
          const authTransactionId = paymentData.consumerAuthenticationInformation?.authenticationTransactionId;
          const clientRefInfo = paymentData.clientReferenceInformation;
          const merchantRef = clientRefInfo?.code || 'order-' + Date.now();

          const pareqValue = paymentData.consumerAuthenticationInformation?.pareq;
          const accessToken = paymentData.consumerAuthenticationInformation?.accessToken;

          // Store payment data in localStorage for the challenge completion
          const challengeData = {
            authenticationTransactionId: authTransactionId,
            transactionID: paymentData.id,
            currency: transaction.currency,
            totalAmount: transaction.totalAmount.toString(),
            transientToken: currentTokenRef.current || paymentToken,
            merchantReference: merchantRef,
            ecommerceIndicatorAuth: 'internet',
            ipAddress: deviceInfo.ipAddress,
            deviceIpAddress: deviceInfo.deviceIpAddress,
            fingerprintSessionId: deviceInfo.fingerprintSessionId,
            deviceFingerprintId: deviceInfo.deviceFingerprintId,
            cardinalSessionId: deviceInfo.cardinalSessionId,
            deviceSessionId: deviceInfo.deviceSessionId,
            deviceUserAgent: deviceInfo.deviceUserAgent,
            userAgentBrowserValue: deviceInfo.userAgentBrowserValue,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            // Billing address information
            ...getAddressData(data)
          };
          localStorage.setItem('challengeData', JSON.stringify(challengeData));

          if (stepUpUrl && pareqValue && accessToken) {

            setStep('3ds-verification'); // Set step to 3DS verification
            setChallengeStepUpUrl(stepUpUrl)
            setChallengeAccessToken(accessToken)
            setPareq(pareqValue);
            setShowChallenge(true)
          } else {
            throw new Error('Missing challenge data from payment response')
          }
        }
      } else {
        const errorMsg = responseData.error || responseData.message || 'Payment failed';
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Payment failed';
      setErrorMessage(errorMsg);
      setStep('failed');
      toast.error(errorMsg);
    } finally {
      setIsAuthenticating(false)
    }
  }

  // 3D Secure Authentication Functions

  // Trigger device data collection

  // Enrollment Check Function

  // Handle URL params after challenge completion
  useEffect(() => {
    const url = new URL(window.location.href)
    const status = url.searchParams.get('status')
    const message = url.searchParams.get('message')
    const transactionId = url.searchParams.get('transactionId')
    const md = url.searchParams.get('md')

    if (status === 'challenge_complete' && transactionId && md) {
      // Get stored payment data from localStorage
      const storedChallengeData = localStorage.getItem('challengeData')
      if (!storedChallengeData) {
        toast.error('Payment data not found')
        setStep('form')
        return
      }

      const challengeData = JSON.parse(storedChallengeData)

      // Send the final payment request to the backend
      fetch(buildApiUrl(API_ENDPOINTS.PAYMENT.COMBINED_AFTER_CHALLENGE), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...challengeData,
          // Use the post-challenge auth transaction ID returned by ACS
          authenticationTransactionId: transactionId,
          transactionId,
          merchantReference: transactionId,
          // Force SPA indicator for authenticated flow
          ecommerceIndicatorAuth: 'spa',
          md,
          sessionId: md // Include the session ID from Cybersource
        })
      })
        .then(response => response.json())
        .then(data => {
          if (data.result === 'SUCCESS') {
            setStep('success')
            setTransactionId(data.paymentResponse?.id || transactionId)
            toast.success('Payment successful!')
            localStorage.removeItem('challengeData') // Clear stored data
          } else {
            throw new Error(data.error || 'Payment completion failed')
          }
        })
        .catch(error => {
          toast.error(error instanceof Error ? error.message : 'Payment failed')
          setStep('form')
        })
        .finally(() => {
          // Reset challenge-related states
          setChallengeStepUpUrl(null)
          setChallengeAccessToken(null)
          setPareq(null)
          setShowChallenge(false)
        })
    } else if (status === 'error') {
      setStep('form')
      toast.error(`Payment failed: ${message}`)
    }

  }, [])

  // Collect device information from browser
  const collectDeviceInformation = (sessionId?: string) => {
    // Use the provided session ID, UUID session ID, or fall back to Cardinal session ID
    const fingerprintSessionId = sessionId || uuidSessionId || cardinalSessionId || `mock-session-${Date.now()}`

    const deviceInfo = {
      ipAddress: clientIpAddress || '127.0.0.1', // Use localhost as fallback if IP not available
      deviceIpAddress: clientIpAddress || '127.0.0.1',
      fingerprintSessionId: fingerprintSessionId, // Use generated UUID session ID
      // Common aliases to maximize backend compatibility
      deviceFingerprintId: fingerprintSessionId,
      cardinalSessionId: fingerprintSessionId,
      deviceSessionId: fingerprintSessionId,
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
      userAgentBrowserValue: navigator.userAgent,
      deviceUserAgent: navigator.userAgent
    }

    return deviceInfo
  }

  const onSubmit = async (data: PaymentFormData) => {
    let tokenizedToken: string | null = null;
    if (!microformInstance) {
      toast.error('Payment form not initialized')
      return
    }

    // Validate that we have transaction data
    if (!transaction) {
      toast.error('Transaction data not available')
      return
    }

    // Validate that required fields are present
    if (!data.expirationMonth || !data.expirationYear) {
      toast.error('Please select card expiration month and year')
      return
    }

    // Reset auto-payment trigger to allow manual submission
    autoPaymentTriggeredRef.current = false

    // Check if Cybersource fields are loaded
    if (!cardNumberRef.current || !cvvRef.current) {
      toast.error('Payment fields not loaded. Please refresh the page.')
      return
    }

    setIsLoading(true)

    try {
      // Step 1: Tokenize card
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
          const decodedToken: FlexTokenPayload = decodeJWT(token);
          const detectedCardTypes = decodedToken.content.paymentInformation.card.number.detectedCardTypes;
          const cardTypeCode = detectedCardTypes?.[0] || '001';
          setCardType(cardTypeCode);

          resolve()
        })
      })

      if (!tokenizedToken) {
        throw new Error('Tokenization failed - no token received')
      }

      // Store the tokenized token for later use in processPayment
      setPaymentToken(tokenizedToken)
      currentTokenRef.current = tokenizedToken

      // Step 2: Check if device data collection is already complete
      if (deviceDataCollected && cardinalSessionId) {
        processPaymentWithDeviceData(uuidSessionId!, data)
        setIsLoading(false)
        return
      }

      // Step 3: Submit to backend for authentication setup
      // Use the existing checkout token from initialization instead of generating a new one
      const authSetupRequest = {
        transientToken: tokenizedToken,
        cardHolder: `${data.firstName} ${data.lastName}`,
        currency: transaction.currency,
        totalAmount: transaction.totalAmount.toString(),
        paReference: 'ref-' + Date.now(),
        returnUrl: CHALLENGE_URLS.RESULT_CALLBACK,
        merchantReference: transaction.transactionId,
        ecommerceIndicatorAuth: 'internet',
        isSaveCard: data.saveCard || false,
        // Card type information
        cardType: cardType,
        cardTypeName: getCardTypeName(cardType),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        // Billing address information
        ...getAddressData(data)
      }

      console.log('API Request (COMBINED_INIT):', { endpoint: buildApiUrl(API_ENDPOINTS.PAYMENT.COMBINED_INIT), payload: authSetupRequest })
      const authResponse = await fetch(buildApiUrl(API_ENDPOINTS.PAYMENT.COMBINED_INIT), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authSetupRequest)
      })

      const authResponseData = await authResponse.json()
      console.log('API Response (COMBINED_INIT):', { status: authResponse.status, data: authResponseData })

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

      if (!consumerAuthInfo) {
        throw new Error('No consumer authentication information received')
      }

      const accessToken = consumerAuthInfo.accessToken
      const ddcUrl = consumerAuthInfo.deviceDataCollectionUrl

      // Step 4: Trigger device data collection
      setIsAuthenticating(true)
      setIsCollectingDeviceData(true)

      const cardinalCollectionForm = document.querySelector('#cardinal_collection_form') as HTMLFormElement
      if (cardinalCollectionForm && ddcUrl && accessToken && uuidSessionId) {
        // Build Cardinal Commerce URL with organization ID and session ID
        // The ddcUrl from Setup service is the base URL, we need to add orgId and sessionId
        const cardinalUrl = `${ddcUrl}?orgId=aby_0385_lakiremit&sessionId=${uuidSessionId}`

        // Update form action and JWT
        cardinalCollectionForm.action = cardinalUrl
        const jwtInput = cardinalCollectionForm.querySelector('#cardinal_collection_form_input') as HTMLInputElement
        if (jwtInput) {
          jwtInput.value = accessToken
        }

        console.log('Submitting Cardinal Commerce form with:', {
          url: cardinalUrl,
          accessToken: accessToken.substring(0, 20) + '...',
          sessionId: uuidSessionId
        })

        cardinalCollectionForm.submit()

        // Set a timeout to reset collecting state if Cardinal Commerce doesn't respond
        setTimeout(() => {
          if (isCollectingDeviceData) {
            console.log('Cardinal Commerce timeout - assuming device data collection complete')
            setIsCollectingDeviceData(false)
            setDeviceDataCollected(true)
          }
        }, 10000) // 10 second timeout
      } else {
        throw new Error('Cardinal Commerce form not found or missing accessToken/ddcUrl/uuidSessionId')
      }

      // Store the authentication data for the next submission
      setAccessToken(accessToken)
      setDdcUrl(ddcUrl)
      setIsAuthenticating(false)

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed')
      setIsAuthenticating(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChallengeComplete = async (transactionId: string, md?: string) => {
    try {

      // Get stored payment data from localStorage
      const storedChallengeData = localStorage.getItem('challengeData');
      if (!storedChallengeData) {
        throw new Error('Payment data not found');
      }

      const challengeData = JSON.parse(storedChallengeData);

      // Send the final payment request to the backend
      console.log('API Request (COMBINED_AFTER_CHALLENGE):', { endpoint: buildApiUrl(API_ENDPOINTS.PAYMENT.COMBINED_AFTER_CHALLENGE), payload: { ...challengeData, transactionId, ...(md && { md }) } })
      const response = await fetch(buildApiUrl(API_ENDPOINTS.PAYMENT.COMBINED_AFTER_CHALLENGE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...challengeData,
          // Use the post-challenge auth transaction ID returned by ACS
          authenticationTransactionId: transactionId,
          transactionId: transactionId,
          // Force SPA indicator for authenticated flow
          ecommerceIndicatorAuth: 'spa',
          ...(md && { md }) // Only include md if it's provided
        })
      });

      const responseData = await response.json();
      console.log('API Response (COMBINED_AFTER_CHALLENGE):', { status: response.status, data: responseData })

      if (responseData.result === 'SUCCESS') {
        setStep('success');
        setTransactionId(responseData.paymentResponse?.id || transactionId);
        toast.success('Payment successful!');

        // Clear stored payment data
        localStorage.removeItem('challengeData');
      } else {
        const errorMsg = responseData.error || responseData.message || 'Payment completion failed';
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Payment completion failed';
      setErrorMessage(errorMsg);
      setStep('failed');
      toast.error(errorMsg);
    } finally {
      // Reset challenge-related states
      setShowChallenge(false);
      setChallengeStepUpUrl(null);
      setChallengeAccessToken(null);
      setPareq(null);
    }
  };

  // Update the Cardinal Commerce listener to handle device data collection state
  useEffect(() => {
    const cardinalListener = CardinalCommerceListener.getInstance();

    // Handle Cardinal Commerce messages
    const handleCardinalMessage = (messageData: any) => {
      console.log('Cardinal Commerce message received:', messageData)
      setIsAuthenticating(false)

      if (messageData.MessageType === "profile.completed" && messageData.Status === true) {
        // Only process if we haven't already processed this session ID
        if (!deviceDataCollected || cardinalSessionId !== uuidSessionId) {
          setDeviceDataCollected(true)
          setCardinalSessionId(uuidSessionId) // Use our generated UUID session ID
          setIsCollectingDeviceData(false)

          console.log('Device fingerprinting completed with our UUID session ID:', uuidSessionId)

          // Auto-proceed to payment processing since we have all required data (only once)
          if (!autoPaymentTriggeredRef.current) {
            autoPaymentTriggeredRef.current = true

            // Get the current form data and proceed with payment
            const currentFormData = watch()


            if (transaction && currentFormData.firstName && currentFormData.lastName && currentFormData.email && uuidSessionId) {
              setTimeout(() => {
                processPaymentWithDeviceData(uuidSessionId!, currentFormData)
              }, 100)
            }
          }
        } else {
          console.log('Device fingerprinting already completed for session ID:', messageData.SessionId)
        }
      } else if (messageData.MessageType === "profile.error") {
        setIsCollectingDeviceData(false)
        console.log('Device fingerprinting failed, but payment can still proceed')
        // Handle error silently - user can still proceed with payment
      } else {
        console.log('Unknown Cardinal Commerce message type:', messageData.MessageType)
      }
    };

    // Set up listener
    cardinalListener.startListening(handleCardinalMessage);
    console.log('Cardinal Commerce listener started')

    return () => {
      cardinalListener.stopListening();
      console.log('Cardinal Commerce listener stopped')
    }
  }, [transaction, watch, processPaymentWithDeviceData]);

  const getButtonContent = () => {
    if (isLoadingTransaction) {
      return (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading Transaction...</span>
        </>
      )
    }
    if (transactionError) {
      return (
        <>
          <AlertCircle className="h-5 w-5" />
          <span>Transaction Error</span>
        </>
      )
    }
    if (!transaction) {
      return (
        <>
          <AlertCircle className="h-5 w-5" />
          <span>No Transaction Found</span>
        </>
      )
    }
    if (isLoading) {
      return (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Processing Payment...</span>
        </>
      )
    }
    if (isAuthenticating) {
      return (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Verifying Card...</span>
        </>
      )
    }
    if (isCollectingDeviceData) {
      return (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Collecting Device Data...</span>
        </>
      )
    }
    if (deviceDataCollected && cardinalSessionId) {
      return (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Processing Payment...</span>
        </>
      )
    }
    return (
      <>
        <Lock className="h-5 w-5" />
        <span>Pay Securely</span>
      </>
    )
  }

  if (step === 'success') {
    const navigateBackToApp = () => {
      const params = new URLSearchParams({ status: 'success' })
      if (transactionId) {
        params.append('transactionId', transactionId)
      }
      window.location.href = `lakiremit://payment-result?${params.toString()}`
    }

    return (
      <div className="card p-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-4">
            Your payment has been processed successfully.
          </p>
          {transactionId && (
            <p className="text-sm text-gray-500 mb-6">
              Transaction ID: <span className="font-mono">{transactionId}</span>
            </p>
          )}
          <button
            onClick={navigateBackToApp}
            className="btn-primary"
          >
            Return to App
          </button>
        </div>
      </div>
    )
  }

  if (step === 'failed') {
    const navigateBackToApp = () => {
      const params = new URLSearchParams({ status: 'failed' })
      if (transactionId) {
        params.append('transactionId', transactionId)
      }
      if (errorMessage) {
        params.append('error', errorMessage)
      }
      window.location.href = `lakiremit://payment-result?${params.toString()}`
    }

    return (
      <div className="card p-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
          <p className="text-gray-600 mb-4">
            {errorMessage || 'Your payment could not be processed. Please try again.'}
          </p>
          <button
            onClick={navigateBackToApp}
            className="btn-primary"
          >
            Return to App
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Payment</h2>
          <p className="text-gray-600">
            Please wait while we process your payment...
          </p>
        </div>
      </div>
    )
  }

  if (step === '3ds-verification') {
    if (!showChallenge || !challengeStepUpUrl || !pareq) {
      return (
        <div className="card p-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 mb-4">
              <Loader2 className="h-8 w-8 text-yellow-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Preparing Verification</h2>
            <p className="text-gray-600">Please wait...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="card p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Bank Verification Required</h2>
          <p className="text-gray-600 mb-4">Please complete the verification process below.</p>
          <div className="challenge-container mx-auto">
            <ChallengeIframe
              stepUpUrl={challengeStepUpUrl}
              accessToken={challengeAccessToken || ''}
              pareq={pareq}
              onChallengeComplete={handleChallengeComplete}
            />
          </div>
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
            {transaction && (
              <span className="text-xs text-gray-400 ml-4">
                ID: {transaction.transactionId}
              </span>
            )}
          </div>
        </div>

        {/* Transaction Loading State */}
        {isLoadingTransaction && (
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin mr-3" />
                <h3 className="text-lg font-semibold text-blue-900">Loading Transaction</h3>
              </div>
              <p className="text-blue-700">Please wait while we fetch your transaction details...</p>
            </div>
          </div>
        )}

        {transactionError && (
          <div className="mb-8 p-6 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-200">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-600 mr-3" />
                <h3 className="text-lg font-semibold text-red-900">Transaction Error</h3>
              </div>
              <p className="text-red-700">{transactionError}</p>
            </div>
          </div>
        )}

        {transaction && !isLoadingTransaction && (
          <div className="mb-8 p-4 bg-green-50 rounded-lg">
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Transaction Details</h3>
              <div className="text-3xl font-bold text-green-600">
                {transaction.currency} {transaction.totalAmount.toFixed(2)}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Transaction ID</p>
                <p className="font-mono font-medium">{transaction.transactionId}</p>
              </div>
              <div>
                <p className="text-gray-600">Receiver</p>
                <p className="font-medium">{transaction.receiverFullName}</p>
              </div>
              <div>
                <p className="text-gray-600">Bank</p>
                <p className="font-medium">{transaction.bankName}</p>
              </div>
              <div>
                <p className="text-gray-600">Status</p>
                <p className="font-medium">{transaction.paymentStatus}</p>
              </div>
            </div>

            {/* Hidden form fields for amount and currency */}
            <input type="hidden" {...register('amount', { required: false })} />
            <input type="hidden" {...register('currency', { required: false })} />
          </div>
        )}

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
                Card Number * {(() => {
                  const cardTypeName = CARD_TYPE_CODES[cardType as keyof typeof CARD_TYPE_CODES]
                  return cardTypeName ? `${cardTypeName} 💳` : '💳'
                })()}
              </label>
              <div
                ref={cardNumberRef}
                className="microform-field bg-white"
                style={{ minHeight: '48px' }}
              />
              {cardType !== 'unknown' && CARD_TYPE_CODES[cardType as keyof typeof CARD_TYPE_CODES] && (
                <div className="mt-2 text-sm text-green-600 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {CARD_TYPE_CODES[cardType as keyof typeof CARD_TYPE_CODES]} detected
                </div>
              )}
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

        {/* Billing Address hidden (prefilled with fixed values) */}

        {/* Save Card Option hidden for now */}

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
                <p className="font-medium mb-1">3D Secure Verification</p>
                <p>Please wait while we verify your card with your bank...</p>
              </div>
            </div>
          </div>
        )}

        {mounted && deviceDataCollected && !isAuthenticating && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-green-800">
                <p className="font-medium mb-1">Card Verification Complete</p>
                <p>Your card has been verified successfully. Processing payment...</p>
              </div>
            </div>
          </div>
        )}

        {/* Device Data Collection Status */}
        {mounted && isCollectingDeviceData && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <Loader2 className="h-5 w-5 text-blue-600 mt-0.5 mr-3 animate-spin flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Collecting Device Data</p>
                <p>Please wait while we securely collect device information...</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            isLoading ||
            !isInitialized ||
            isAuthenticating ||
            isCollectingDeviceData ||
            isLoadingTransaction ||
            !transaction ||
            !!transactionError ||
            (deviceDataCollected && !!cardinalSessionId && autoPaymentTriggeredRef.current)
          }
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          {getButtonContent()}
        </button>

        {mounted && !isInitialized && (
          <p className="text-center text-sm text-gray-500 mt-4">
            {isLoadingTransaction ? 'Loading transaction...' : 'Initializing secure payment form...'}
          </p>
        )}
      </form>

      {/* {paymentResult && (
        <div className={paymentResult.success ? 'success' : 'error'}>
          {paymentResult.message}
        </div>
      )} */}
    </>
  )
} 