'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProcessChallenge() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  useEffect(() => {
    const processChallenge = async () => {
      try {
        const transactionId = searchParams?.get('transactionId')
        const md = searchParams?.get('md')

        if (!transactionId) {
          throw new Error('Missing transaction ID')
        }

        // Call the combined-after-challenge API
        const response = await fetch('http://localhost:8080/api/v1/payment/combined-after-challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authenticationTransactionId: transactionId,
            // Force SPA indicator for authenticated flow
            ecommerceIndicatorAuth: 'spa',
            merchantData: md,
            // Add any other required fields from your form state here
          })
        })

        const data = await response.json()

        if (data.result === 'SUCCESS') {
          toast.success('Payment successful!')
          // Redirect to success page or back to payment form with success state
          router.push('/payment/success')
        } else {
          throw new Error(data.error || 'Payment failed')
        }

      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Payment failed')
        // Redirect back to payment form with error state
        router.push('/payment?error=challenge-failed')
        } 
    }

    processChallenge()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Processing Payment
        </h2>
        <p className="text-gray-600">
          Please wait while we complete your payment...
        </p>
      </div>
    </div>
  )
} 