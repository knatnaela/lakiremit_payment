'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { CreditCard, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import {
  PaymentFormData,
  Transaction,
  TransactionResponse
} from '@/types/payment'
import ChallengeIframe from './ChallengeIframe'
import AddressForm from './AddressForm'
import { useSearchParams } from 'next/navigation'
import { API_ENDPOINTS, buildApiUrl, CHALLENGE_URLS } from '@/constants/api'

// Global type declaration for Mastercard PaymentSession
declare global {
  interface Window {
    PaymentSession: any
  }
}

// (removed) CARD_TYPE_CODES was unused in this component

// Countries are now handled by the AddressForm component

export default function MasterCardPaymentForm() {
  // Mastercard Session SDK state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isPaymentSessionReady, setIsPaymentSessionReady] = useState(false)
  const [isCardTokenized, setIsCardTokenized] = useState(false)

  // Core state variables
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'processing' | '3ds-verification' | 'success' | 'failed'>('form')
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Transaction data state
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [isLoadingTransaction, setIsLoadingTransaction] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(null)

  // Challenge Flow States
  const [showChallenge, setShowChallenge] = useState(false)
  const [challengeStepUpUrl, setChallengeStepUpUrl] = useState<string | null>(null)
  const [challengeAccessToken, setChallengeAccessToken] = useState<string | null>(null);
  const [pareq, setPareq] = useState<string | null>(null);
  const initializationStartedRef = useRef(false);

  // Mastercard field refs
  const cardNumberRef = useRef<HTMLDivElement>(null)
  const cvvRef = useRef<HTMLDivElement>(null)
  const expiryMonthRef = useRef<HTMLDivElement>(null)
  const expiryYearRef = useRef<HTMLDivElement>(null)

  // Legacy refs removed (unused)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Removed unused client IP logic to satisfy lint

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
    if (process.env.NODE_ENV === 'development') {
      return `Bearer ${process.env.BEARER_TOKEN}`;
    }
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find(cookie => cookie.trim().startsWith('access_token'));
    if (!authCookie) { return null }
    const token = authCookie.split('=')[1].trim();
    return `Bearer ${token}`;
  }

  // Fetch transaction data from query parameter
  useEffect(() => {
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

  // (removed) getCardTypeName was unused

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
    if (isPaymentSessionReady || initializationStartedRef.current) {
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

    // Removed unused helpers (decodeJWT, loadCybersourceScript)

    const configurePaymentSession = (sessionId: string) => {
      if (!sessionId || !window.PaymentSession) {
        throw new Error('PaymentSession not available')
      }

      window.PaymentSession.configure({
        session: sessionId,
        fields: {
          card: {
            number: "#card-number",
            securityCode: "#security-code",
            expiryMonth: "#expiry-month",
            expiryYear: "#expiry-year"
          }
        },
        frameEmbeddingMitigation: ["javascript"],
        locale: "en_US", // Set locale for better accessibility
        callbacks: {
          initialized: (response: any) => {
            if (response.status === "ok") {
              console.log('✅ PaymentSession initialized successfully')
            } else {
              console.error('❌ PaymentSession initialization failed:', response)
            }
          },
          formSessionUpdate: (response: any) => {
            console.log('🔄 Form session update:', response)

            if (response.status === "ok") {
              console.log('✅ Session updated successfully - card data tokenized')
              setIsCardTokenized(true)
              // Card data has been successfully tokenized
            } else if (response.status === "fields_in_error") {
              // Handle field validation errors with better messaging
              const errorMessages = []

              if (response.errors?.cardNumber) {
                errorMessages.push('Card number is invalid or missing')
              }
              if (response.errors?.securityCode) {
                errorMessages.push('Security code is invalid')
              }
              if (response.errors?.expiryMonth) {
                errorMessages.push('Expiry month is required')
              }
              if (response.errors?.expiryYear) {
                errorMessages.push('Expiry year is required')
              }

              if (errorMessages.length > 0) {
                toast.error(errorMessages.join(', '))
              }
            } else if (response.status === "request_timeout") {
              toast.error('Request timeout - please try again')
            } else if (response.status === "system_error") {
              toast.error('System error - please contact support')
            } else if (response.status === "session_expired") {
              toast.error('Payment session expired - please refresh the page')
            }
          },
          onCardTypeChange: (response: any) => {
            console.log('Card type detected:', response.cardType)
            // You can update UI based on card type here
          },
          onValidityChange: (response: any) => {
            console.log('Field validity changed:', response.valid)
          },
          onFocus: (response: any) => {
            console.log('Field focused:', response.fieldId)
          },
          onBlur: (response: any) => {
            console.log('Field blurred:', response.fieldId)
          },
          onFieldFocus: (response: any) => {
            console.log('Field focused:', response.fieldId)
            // Ensure proper focus handling for accessibility
            if (response.fieldId === 'card.number') {
              window.PaymentSession.setFocus('card.number')
            }
          }
        },
        interaction: {
          displayControl: {
            formatCard: "EMBOSSED",
            invalidFieldCharacters: "ALLOW" // Better for accessibility
          }
        }
      })
    }

    const createMastercardFields = () => {
      // Create card number field
      const cardNumberField = document.createElement('input')
      cardNumberField.id = 'card-number'
      cardNumberField.className = 'form-input'
      cardNumberField.title = 'card number'
      cardNumberField.setAttribute('aria-label', 'enter your card number')
      cardNumberField.readOnly = true
      cardNumberField.tabIndex = 1

      // Create CVV field
      const cvvField = document.createElement('input')
      cvvField.id = 'security-code'
      cvvField.className = 'form-input'
      cvvField.title = 'security code'
      cvvField.setAttribute('aria-label', 'three digit CVV security code')
      cvvField.readOnly = true
      cvvField.tabIndex = 3

      // Create expiry month dropdown
      const expiryMonthField = document.createElement('select')
      expiryMonthField.id = 'expiry-month'
      expiryMonthField.className = 'form-input'
      expiryMonthField.title = 'expiry month'
      expiryMonthField.setAttribute('aria-label', 'select expiry month')
      expiryMonthField.setAttribute('readonly', 'true')
      expiryMonthField.tabIndex = 2

      // Add month options
      const monthOptions = [
        { value: '', text: 'Select Month' },
        { value: '01', text: 'January' },
        { value: '02', text: 'February' },
        { value: '03', text: 'March' },
        { value: '04', text: 'April' },
        { value: '05', text: 'May' },
        { value: '06', text: 'June' },
        { value: '07', text: 'July' },
        { value: '08', text: 'August' },
        { value: '09', text: 'September' },
        { value: '10', text: 'October' },
        { value: '11', text: 'November' },
        { value: '12', text: 'December' }
      ]

      monthOptions.forEach(option => {
        const optionElement = document.createElement('option')
        optionElement.value = option.value
        optionElement.textContent = option.text
        expiryMonthField.appendChild(optionElement)
      })

      // Create expiry year dropdown
      const expiryYearField = document.createElement('select')
      expiryYearField.id = 'expiry-year'
      expiryYearField.className = 'form-input'
      expiryYearField.title = 'expiry year'
      expiryYearField.setAttribute('aria-label', 'select expiry year')
      expiryYearField.setAttribute('readonly', 'true')
      expiryYearField.tabIndex = 4

      // Add year options (current year + 20 years)
      const currentYear = new Date().getFullYear()

      for (let i = 0; i < 20; i++) {
        const year = currentYear + i
        const optionElement = document.createElement('option')
        optionElement.value = year.toString()
        optionElement.textContent = year.toString()
        expiryYearField.appendChild(optionElement)
      }

      // Load fields into containers
      if (cardNumberRef.current) {
        cardNumberRef.current.appendChild(cardNumberField)
      }
      if (cvvRef.current) {
        cvvRef.current.appendChild(cvvField)
      }
      if (expiryMonthRef.current) {
        expiryMonthRef.current.appendChild(expiryMonthField)
      }
      if (expiryYearRef.current) {
        expiryYearRef.current.appendChild(expiryYearField)
      }
    }





    const loadMastercardScript = (merchantId: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src*="test-gateway.mastercard.com"]`)
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
        script.src = `https://test-gateway.mastercard.com/form/version/100/merchant/${merchantId}/session.js`
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

    const initializeMastercardSession = async () => {
      try {
        console.log('🔄 Initializing Mastercard provider...')

        // Get session from backend
        const transactionId = searchParams.get('transactionId')

        if (!transactionId) {
          throw new Error('No transaction ID provided in URL')
        }

        // const response = await fetch(buildApiUrl(API_ENDPOINTS.PAYMENT.CHECKOUT_TOKEN), {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     'transactionId': transactionId,
        //     'provider': 'mastercard'
        //   })
        // })

        // const data = await response.json()

        // if (data.result !== 'SUCCESS') {
        //   throw new Error(`Backend API returned error: ${data.result}. Errors: ${data.readableErrorMessages?.join(', ') || 'Unknown error'}`)
        // }

        // if (!data.sessionId || !data.merchantId) {
        //   throw new Error('No session ID or merchant ID received from backend API')
        // }

        console.log('✅ Session and merchant ID received')

        // Store session data
        setSessionId("SESSION0002374325869H8155308I45")
        // Merchant ID kept local where needed

        // Load Mastercard script
        await loadMastercardScript("010100100111")

        // Create field elements
        createMastercardFields()

        // Verify fields were created
        console.log('🔍 Checking field creation:', {
          cardNumber: !!document.getElementById('card-number'),
          securityCode: !!document.getElementById('security-code'),
          expiryMonth: !!document.getElementById('expiry-month'),
          expiryYear: !!document.getElementById('expiry-year')
        })

        // Configure PaymentSession
        configurePaymentSession("SESSION0002374325869H8155308I45")

        // Don't apply styling here - wait for PaymentSession to be fully initialized
        // The styling will be applied in the 'initialized' callback

        setIsPaymentSessionReady(true)

        console.log('✅ Mastercard Session SDK initialized successfully')

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('❌ Failed to initialize Mastercard:', error)
        toast.error(`Failed to initialize: ${errorMsg}`)
      }
    }

    initializeMastercardSession()
  }, [mounted, searchParams]) // Run when mounted or search params change



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



  const onSubmit = async (data: PaymentFormData) => {
    if (!isPaymentSessionReady || !sessionId) {
      toast.error('Payment form not initialized')
      return
    }

    // Validate that we have transaction data
    if (!transaction) {
      toast.error('Transaction data not available')
      return
    }

    // Check if Mastercard fields are loaded
    if (!cardNumberRef.current || !cvvRef.current || !expiryMonthRef.current || !expiryYearRef.current) {
      toast.error('Payment fields not loaded. Please refresh the page.')
      return
    }

    setIsLoading(true)

    try {
      console.log('🔄 Processing payment with Mastercard Session SDK...')

      // Step 1: Tokenize card data using PaymentSession
      if (!window.PaymentSession) {
        throw new Error('PaymentSession not available')
      }

      // Update session with form data to trigger tokenization
      window.PaymentSession.updateSessionFromForm('card')

      // Wait a moment for tokenization to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 2: Process payment with tokenized session ID
      const paymentRequest = {
        sessionId: sessionId, // Use Mastercard session ID (contains tokenized card data)
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
        ...getAddressData(data)
      }

      const response = await fetch(buildApiUrl(API_ENDPOINTS.PAYMENT.COMBINED), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentRequest)
      })

      const responseData = await response.json()

      if (responseData.result === 'SUCCESS') {
        const paymentResponse = responseData.paymentResponse;

        if (paymentResponse.status === 'PENDING_AUTHENTICATION') {
          // Handle 3DS challenge
          const stepUpUrl = paymentResponse.consumerAuthenticationInformation?.stepUpUrl;
          const pareqValue = paymentResponse.consumerAuthenticationInformation?.pareq;
          const accessToken = paymentResponse.consumerAuthenticationInformation?.accessToken;
          const authTransactionId = paymentResponse.consumerAuthenticationInformation?.authenticationTransactionId;

          if (stepUpUrl && pareqValue && accessToken) {
            // Store payment data in localStorage for the challenge completion
            const challengeData = {
              authenticationTransactionId: authTransactionId,
              transactionID: paymentResponse.id,
              currency: transaction.currency,
              totalAmount: transaction.totalAmount.toString(),
              sessionId: sessionId,
              merchantReference: transaction.transactionId,
              ecommerceIndicatorAuth: 'internet',
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
              // Billing address information
              ...getAddressData(data)
            };
            localStorage.setItem('challengeData', JSON.stringify(challengeData));

            setStep('3ds-verification');
            setChallengeStepUpUrl(stepUpUrl)
            setChallengeAccessToken(accessToken)
            setPareq(pareqValue);
            setShowChallenge(true)
          } else {
            throw new Error('Missing challenge data from payment response')
          }
        } else {
          // Payment successful without 3DS
          setStep('success');
          setTransactionId(paymentResponse?.id || paymentResponse?.transactionId);
          toast.success('Payment successful!');
        }
      } else {
        const errorMsg = responseData.error || responseData.message || 'Payment failed';
        throw new Error(errorMsg);
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Payment failed';
      setErrorMessage(errorMsg);
      setStep('failed');
      setIsCardTokenized(false); // Reset tokenization status on error
      toast.error(errorMsg);
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
    if (!isPaymentSessionReady) {
      return (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Initializing Payment Form...</span>
        </>
      )
    }
    if (!isCardTokenized) {
      return (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Validating Card...</span>
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
      <form onSubmit={handleSubmit(onSubmit)} className="card p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center space-x-2">
            <Lock className="h-5 w-5 text-green-600" />
            <span className="text-sm text-gray-600">Secured by Mastercard</span>
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
                Card Number * 💳
              </label>
              <div
                ref={cardNumberRef}
                className="form-input bg-white"
                style={{ minHeight: '48px' }}
              />
              {mounted && !isPaymentSessionReady && (
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
                className="form-input bg-white"
                style={{ minHeight: '48px' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">
                Expiration Month *
              </label>
              <div
                ref={expiryMonthRef}
                className="form-input bg-white"
                style={{ minHeight: '48px' }}
              />
            </div>

            <div>
              <label className="form-label">
                Expiration Year *
              </label>
              <div
                ref={expiryYearRef}
                className="form-input bg-white"
                style={{ minHeight: '48px' }}
              />
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

        {/* Save Card Option */}
        <div className="mt-4 mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              {...register('saveCard')}
              defaultChecked={false}
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Save this card for future payments
              </span>
              <p className="text-xs text-gray-500 mt-1">
                Your card information will be securely stored for faster checkout next time
              </p>
            </div>
          </label>
        </div>

        {/* Security Notice */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Your payment is secure</p>
              <p>Your card information is encrypted and processed securely through Mastercard&apos;s hosted payment fields. We never store your card details.</p>
            </div>
          </div>
        </div>

        {/* Mastercard Session Status */}
        {mounted && !isPaymentSessionReady && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <Loader2 className="h-5 w-5 text-blue-600 mt-0.5 mr-3 animate-spin flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Initializing Payment Form</p>
                <p>Please wait while we securely initialize the payment form...</p>
              </div>
            </div>
          </div>
        )}

        {/* Card Validation Status */}
        {mounted && isPaymentSessionReady && !isCardTokenized && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <Loader2 className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 animate-spin flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Validating Card Information</p>
                <p>Please enter your card details to continue...</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            isLoading ||
            !isPaymentSessionReady ||
            !isCardTokenized ||
            isLoadingTransaction ||
            !transaction ||
            !!transactionError
          }
          className="btn-primary w-full flex items-center justify-center space-x-2"
        >
          {getButtonContent()}
        </button>

        {mounted && !isPaymentSessionReady && (
          <p className="text-center text-sm text-gray-500 mt-4">
            {isLoadingTransaction ? 'Loading transaction...' : 'Initializing Mastercard payment form...'}
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