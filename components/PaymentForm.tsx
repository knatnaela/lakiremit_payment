'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { CreditCard, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { 
  PaymentFormData, 
  MicroformInstance, 
  FlexTokenPayload
} from '@/types/payment'
import ChallengeIframe from './ChallengeIframe'
import { CardinalCommerceListener } from './CardinalCommerceListener'
import { decodeJWT } from '@/utils/utils'
import AddressForm from './AddressForm'


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
  const [mounted, setMounted] = useState(false)
  const [clientIpAddress, setClientIpAddress] = useState<string>('')
  const [checkoutToken, setCheckoutToken] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // 3D Secure Authentication States
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [ddcUrl, setDdcUrl] = useState<string | null>(null)
  // const [_, setDdcReference] = useState<string | null>(null)
  const [merchantReference, setMerchantReference] = useState<string | null>(null)

  // Challenge Flow States
  const [showChallenge, setShowChallenge] = useState(false)
  const [challengeStepUpUrl, setChallengeStepUpUrl] = useState<string | null>(null)
  // const [challengeTransactionId, setChallengeTransactionId] = useState<string | null>(null)

  const [challengeAccessToken, setChallengeAccessToken] = useState<string | null>(null);
  // const [paymentResult, setPaymentResult] = useState<any>(null);
  const [pareq, setPareq] = useState<string | null>(null);
  const autoPaymentTriggeredRef = useRef(false);
  const [isCollectingDeviceData, setIsCollectingDeviceData] = useState(false)
  const initializationStartedRef = useRef(false);

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
      billing: {
        country: 'US',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        address2: ''
      }
    }
  })

  const amount = watch('amount')
  const currency = watch('currency')
  const billingCountry = watch('billing.country')
  
  // Debug: Log form values
  useEffect(() => {
 
  }, [amount, currency, billingCountry, watch])

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
        billToCity: data.billing.city,
        billToState: data.billing.state,
        billToPostalCode: data.billing.postalCode,
        billToCountry: data.billing.country
      }
    }
    return {
      billToAddress1: data.address,
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
      // console.log('🔄 Skipping initialization - already initialized, token exists, or initialization in progress')
      return
    }
    
    initializationStartedRef.current = true
    // console.log('🔄 useEffect triggered - starting initialization')
    
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
        // console.log('🔄 Initializing microform - getting checkout token...')
        // Get microform token from backend
        const response = await fetch('http://localhost:8080/api/v1/payment/checkout-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
           'transactionId': 'I4pyyshLem'
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
        // console.log('✅ Checkout token received and stored')
        
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
        
        // Set up Cardinal Commerce message listener using the separate class
        const cardinalListener = CardinalCommerceListener.getInstance();
        cardinalListener.startListening((messageData) => {
          // Enable payment button when any message is received
          setIsAuthenticating(false)
          
          if (messageData.MessageType === "profile.completed" && messageData.Status === true) {
            setDeviceDataCollected(true)
            setCardinalSessionId(messageData.SessionId)
            
            // Auto-proceed to payment processing since we have all required data (only once)
            if (!autoPaymentTriggeredRef.current) {
              autoPaymentTriggeredRef.current = true
              
              // Get the current form data and proceed with payment
              const currentFormData = watch()
              if (currentFormData.amount && currentFormData.firstName && currentFormData.lastName && currentFormData.email) {
                // Use setTimeout to ensure state updates are complete
                setTimeout(() => {
                  processPaymentWithDeviceData(messageData.SessionId, currentFormData)
                }, 100)
              } else {
                toast.success('Device data collected! Please complete the form and submit again.')
              }
            }
          } else if (messageData.MessageType === "profile.error") {
            // Handle error silently - user can still proceed with payment
          }
        });

        // Note: Cardinal Commerce form will be submitted after authentication setup
        // when accessToken and ddcUrl are available (like visa-aft)

        setIsInitialized(true)
        // console.log('🎉 Microform initialization complete!')
        
      } catch (error) {
        // console.error('❌ Microform initialization error:', error)
        toast.error(`Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    initializeMicroform()
    
    // Cleanup function to stop the listener when component unmounts
    return () => {
      const cardinalListener = CardinalCommerceListener.getInstance();
      cardinalListener.stopListening();
    }
  }, [mounted]) // Only run when mounted changes

  // Process payment with collected device data
  const processPaymentWithDeviceData = async (sessionId: string, data: PaymentFormData) => {
    try {
      // Collect comprehensive device information with the real session ID
      const deviceInfo = collectDeviceInformation(sessionId)
      
      // Create payment request with all collected data
      const paymentRequest = {
        transientToken: currentTokenRef.current || paymentToken,
        cardHolder: `${data.firstName} ${data.lastName}`,
        currency: data.currency,
        totalAmount: data.amount.toString(),
        returnUrl: 'http://localhost:3000/api/payment/challenge-result',
        merchantReference: merchantReference || 'order-' + Date.now(),
        ecommerceIndicatorAuth: 'internet',
        isSaveCard: false,
        // Card type information
        cardType: cardType,
        cardTypeName: getCardTypeName(cardType),
        // Personal information
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        // Billing address information
        ...getAddressData(data),
        // Device information
        ...deviceInfo
      }

      const response = await fetch('http://localhost:8080/api/v1/payment/combined', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentRequest)
      })

      const responseData = await response.json()

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
            currency: data.currency,
            totalAmount: data.amount.toString(),
            transientToken: currentTokenRef.current || paymentToken,
            merchantReference: merchantRef,
            ecommerceIndicatorAuth: 'internet',
            ipAddress: deviceInfo.ipAddress,
            fingerprintSessionId: deviceInfo.fingerprintSessionId,
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
            // setChallengeTransactionId(authTransactionId)
            setMerchantReference(merchantRef);
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
      // console.error('❌ Payment failed:', error);
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
      fetch('http://localhost:8080/api/v1/payment/combined-after-challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...challengeData,
          transactionId,
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
        // setChallengeTransactionId(null)
        setPareq(null)
        setShowChallenge(false)
      })
    } else if (status === 'error') {
      setStep('form')
      toast.error(`Payment failed: ${message}`)
    }

    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // Collect device information from browser
  const collectDeviceInformation = (sessionId?: string) => {
    // Use the provided session ID or fall back to state, then to mock
    const fingerprintSessionId = sessionId || cardinalSessionId || `mock-session-${Date.now()}`
    
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
        toast.success('Device data collected! Payment will be processed automatically.')
        setIsLoading(false)
        return
      }

      // Step 3: Submit to backend for authentication setup
      // Use the existing checkout token from initialization instead of generating a new one
      const authSetupRequest = {
        transientToken: tokenizedToken,
        cardHolder: `${data.firstName} ${data.lastName}`,
        currency: data.currency,
        totalAmount: data.amount.toString(),
        paReference: 'ref-' + Date.now(),
        returnUrl: 'http://localhost:3000/api/payment/challenge-result',
        merchantReference: 'order-' + Date.now(),
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

      // console.log('🔄 Calling authentication setup with existing token...')
      const authResponse = await fetch('http://localhost:8080/api/v1/payment/combined-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authSetupRequest)
      })

      const authResponseData = await authResponse.json()
      // console.log('🔍 Authentication setup response:', authResponseData)

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
      // const ddcReference = consumerAuthInfo.referenceId
      const merchantRef = clientRefInfo?.code || 'order-' + Date.now()

      // Step 4: Trigger device data collection
      setIsAuthenticating(true)
      setIsCollectingDeviceData(true)
      
      const cardinalCollectionForm = document.querySelector('#cardinal_collection_form') as HTMLFormElement
      if (cardinalCollectionForm && ddcUrl && accessToken) {
        // Update form action and JWT
        cardinalCollectionForm.action = ddcUrl
        const jwtInput = cardinalCollectionForm.querySelector('#cardinal_collection_form_input') as HTMLInputElement
        if (jwtInput) {
          jwtInput.value = accessToken
        }
        
        cardinalCollectionForm.submit()
      } else {
        throw new Error('Cardinal Commerce form not found or missing accessToken/ddcUrl')
      }

      // Store the authentication data for the next submission
      setAccessToken(accessToken)
      setDdcUrl(ddcUrl)
      // setDdcReference(ddcReference)
      setMerchantReference(merchantRef)
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
      // console.log('🔄 Processing challenge completion...', { transactionId, md });
      
      // Get stored payment data from localStorage
      const storedChallengeData = localStorage.getItem('challengeData');
      if (!storedChallengeData) {
        throw new Error('Payment data not found');
      }

      const challengeData = JSON.parse(storedChallengeData);

      // Send the final payment request to the backend
      const response = await fetch('http://localhost:8080/api/v1/payment/combined-after-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...challengeData,
          transactionId: transactionId,
          ...(md && { md }) // Only include md if it's provided
        })
      });

      const responseData = await response.json();
      // console.log('🔍 Challenge completion response:', responseData);

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
      // console.error('❌ Challenge completion failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Payment completion failed';
      setErrorMessage(errorMsg);
      setStep('failed');
      toast.error(errorMsg);
    } finally {
      // Reset challenge-related states
      setShowChallenge(false);
      setChallengeStepUpUrl(null);
      setChallengeAccessToken(null);
      // setChallengeTransactionId(null);
      setPareq(null);
    }
  };

  // Update the Cardinal Commerce listener to handle device data collection state
  useEffect(() => {
    const cardinalListener = CardinalCommerceListener.getInstance();
    
    // Handle Cardinal Commerce messages
    const handleCardinalMessage = (messageData: any) => {
      setIsAuthenticating(false)
      
      if (messageData.MessageType === "profile.completed" && messageData.Status === true) {
        setDeviceDataCollected(true)
        setCardinalSessionId(messageData.SessionId)
        setIsCollectingDeviceData(false)
        
        // Auto-proceed to payment processing since we have all required data (only once)
        if (!autoPaymentTriggeredRef.current) {
          autoPaymentTriggeredRef.current = true
          
          // Get the current form data and proceed with payment
          const currentFormData = watch()
          if (currentFormData.amount && currentFormData.firstName && currentFormData.lastName && currentFormData.email) {
            setTimeout(() => {
              processPaymentWithDeviceData(messageData.SessionId, currentFormData)
            }, 100)
          } else {
            toast.success('Device data collected! Please complete the form and submit again.')
          }
        }
      } else if (messageData.MessageType === "profile.error") {
        setIsCollectingDeviceData(false)
        // Handle error silently - user can still proceed with payment
      }
    };

    // Set up both listeners
    cardinalListener.startListening(handleCardinalMessage);

    return () => {
      cardinalListener.stopListening();
    }
  }, []);

  const resetForm = () => {
    setStep('form')
    setPaymentToken(null)
    setTransactionId(null)
    setCardType('unknown')
    setErrorMessage(null)
    autoPaymentTriggeredRef.current = false
    setDeviceDataCollected(false)
    setCardinalSessionId(null)
    setCheckoutToken(null)
    setIsInitialized(false)
    initializationStartedRef.current = false
    
    // Reload the page to get a fresh start
    window.location.reload()
  }

  const getButtonContent = () => {
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
            onClick={resetForm}
            className="btn-primary"
          >
            Make Another Payment
          </button>
        </div>
      </div>
    )
  }

  if (step === 'failed') {
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
            onClick={resetForm}
            className="btn-primary"
          >
            Try Again
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

        {Boolean(amount) && (
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

      {/* Billing Address */}
      <AddressForm 
        name="billing" 
        required={true}
        control={control}
        watch={watch}
        setValue={setValue}
        errors={errors}
      />



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
        disabled={isLoading || !isInitialized || isAuthenticating || isCollectingDeviceData || (deviceDataCollected && cardinalSessionId !== null) || autoPaymentTriggeredRef.current}
        className="btn-primary w-full flex items-center justify-center space-x-2"
      >
        {getButtonContent()}
      </button>

      {mounted && !isInitialized && (
        <p className="text-center text-sm text-gray-500 mt-4">
          Initializing secure payment form...
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