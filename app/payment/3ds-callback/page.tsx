'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// Prevent server-side rendering
const NoSSR = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return <>{children}</>
}

export default function ThreeDSCallback() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return

    const handleCallback = () => {
      try {
        // Get parameters from URL
        const transactionId = searchParams?.get('transactionId')
        const status = searchParams?.get('status')
        const md = searchParams?.get('md')

        // Validate required parameters
        if (!transactionId) {
          throw new Error('Missing transaction ID')
        }

        const messageData = {
          type: '3ds-callback',
          data: {
            transactionId,
            status: status || 'success',
            md
          }
        }

        // First try window.parent (iframe case)
        if (window.parent !== window) {
          window.parent.postMessage(messageData, '*')
          return
        }

        // Then try window.opener (popup case)
        if (window.opener) {
          window.opener.postMessage(messageData, '*')
          window.close()
          return
        }

        // If neither works, show error
        setError('Unable to communicate with payment window')
      } catch (error) {
        console.error('3DS Callback Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setError(errorMessage)
        
        // Try to notify parent/opener of error
        const messageData = {
          type: '3ds-callback',
          data: {
            status: 'error',
            error: errorMessage
          }
        }

        if (window.parent !== window) {
          window.parent.postMessage(messageData, '*')
        } else if (window.opener) {
          window.opener.postMessage(messageData, '*')
          window.close()
        }
      }
    }

    // Add small delay to ensure parameters are available
    const timeoutId = setTimeout(handleCallback, 100)
    return () => clearTimeout(timeoutId)
  }, [searchParams])

  const content = (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-red-600 mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Verification Error
            </h2>
            <p className="text-gray-600">
              {error}
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Completing Verification
            </h2>
            <p className="text-gray-600">
              Please wait while we complete your payment...
            </p>
          </>
        )}
      </div>
    </div>
  )

  return <NoSSR>{content}</NoSSR>
} 