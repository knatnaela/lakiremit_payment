'use client'

import { useEffect } from 'react'
import { CloudCog, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface ClientChallengeProcessorProps {
  transactionId: string
  md: string
}

export default function ClientChallengeProcessor({ transactionId, md }: ClientChallengeProcessorProps) {
  useEffect(() => {
    const processChallenge = async () => {
      try {
        // Get stored payment data from localStorage
        const storedChallengeData = localStorage.getItem('challengeData')
        if (!storedChallengeData) {
          throw new Error('Payment data not found')
        }
      
        console.log('Challenge Processing');

        const challengeData = JSON.parse(storedChallengeData)

        // Send the final payment request to the backend
        const backendResponse = await fetch('http://localhost:8080/api/v1/payment/challenge-complete', {
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

        const data = await backendResponse.json()

        if (data.result === 'SUCCESS') {
          // Clear stored payment data
          localStorage.removeItem('challengeData')
          
          // Use window.location.href for redirect
          window.location.href = `/?status=success&transactionId=${data.paymentResponse?.id || transactionId}`
        } else {
          throw new Error(data.error || 'Payment completion failed')
        }

      } catch (error) {
        console.error('Challenge processing error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Payment processing failed'
        // Use window.location.href for error redirect
        window.location.href = `/?status=error&message=${encodeURIComponent(errorMessage)}`
      }
    }

    processChallenge()
  }, [transactionId, md]) // Removed router from dependencies since we're not using it

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Processing Payment
          </h2>
          <p className="text-gray-600 mb-4">
            Please wait while we complete your payment...
          </p>
          <p className="text-sm text-gray-500">
            Do not close this window.
          </p>
        </div>
      </div>
    </div>
  )
} 