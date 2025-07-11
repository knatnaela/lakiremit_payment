'use client'

import { useState, useEffect, useRef } from 'react'
import { X, AlertCircle, CheckCircle, Loader2, Lock } from 'lucide-react'

interface ChallengeModalProps {
  isOpen: boolean
  onClose: () => void
  accessToken: string
  stepUpUrl: string
  onChallengeComplete: (success: boolean, transactionId?: string) => void
}

export default function ChallengeModal({
  isOpen,
  onClose,
  accessToken,
  stepUpUrl,
  onChallengeComplete
}: ChallengeModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [challengeStatus, setChallengeStatus] = useState<'loading' | 'processing' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [canClose, setCanClose] = useState(false)
  
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (isOpen && accessToken && stepUpUrl) {
      console.log('🔐 Starting 3D Secure challenge...')
      console.log('🔐 Access Token:', accessToken)
      console.log('🔐 Step Up URL:', stepUpUrl)
      
      // Allow closing after 5 seconds (like visa-aft)
      const closeTimer = setTimeout(() => {
        setCanClose(true)
      }, 5000)

      // Submit challenge form
      if (formRef.current) {
        formRef.current.submit()
        setIsLoading(false)
        setChallengeStatus('processing')
      }

      return () => clearTimeout(closeTimer)
    }
  }, [isOpen, accessToken, stepUpUrl])

  const handleClose = () => {
    if (!canClose) {
      alert('The authentication process cannot be interrupted yet!')
      return
    }
    onClose()
  }

  const handleIframeLoad = () => {
    console.log('✅ Challenge iframe loaded')
    setIsLoading(false)
  }

  const handleIframeError = () => {
    console.error('❌ Challenge iframe failed to load')
    setChallengeStatus('error')
    setErrorMessage('Failed to load authentication page')
  }

  const handleMessage = (event: MessageEvent) => {
    // Handle messages from the challenge iframe
    console.log('📡 Challenge message received:', event.data)
    
    if (event.data?.status === 'success') {
      setChallengeStatus('success')
      onChallengeComplete(true, event.data.transactionId)
    } else if (event.data?.status === 'error') {
      setChallengeStatus('error')
      setErrorMessage(event.data.message || 'Authentication failed')
      onChallengeComplete(false)
    }
  }

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
              <Lock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                3D Secure Authentication
              </h3>
              <p className="text-sm text-gray-500">
                Complete authentication with your bank
              </p>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            disabled={!canClose}
            className={`p-2 rounded-full transition-colors ${
              canClose 
                ? 'hover:bg-gray-100 text-gray-400 hover:text-gray-600' 
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center space-x-3">
            {challengeStatus === 'loading' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-blue-600">Loading authentication page...</span>
              </>
            )}
            
            {challengeStatus === 'processing' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
                <span className="text-yellow-600">Processing authentication...</span>
              </>
            )}
            
            {challengeStatus === 'success' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-600">Authentication successful!</span>
              </>
            )}
            
            {challengeStatus === 'error' && (
              <>
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-600">Authentication failed</span>
              </>
            )}
          </div>
          
          {errorMessage && (
            <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
          )}
        </div>

        {/* Challenge Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading secure authentication...</p>
              </div>
            </div>
          ) : (
            <div className="relative">
              <iframe
                ref={iframeRef}
                name="step-up-iframe"
                className="w-full h-96 border border-gray-200 rounded-lg"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="3D Secure Authentication"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Lock className="h-4 w-4" />
              <span>Secure authentication powered by your bank</span>
            </div>
            
            {canClose && challengeStatus !== 'processing' && (
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Hidden Form for Challenge */}
        <div style={{ display: 'none' }}>
          <form
            ref={formRef}
            id="step-up-form"
            target="step-up-iframe"
            method="post"
            action={stepUpUrl}
          >
            <input type="hidden" name="JWT" value={accessToken} />
            <input type="hidden" name="MD" value={Date.now().toString()} />
          </form>
        </div>
      </div>
    </div>
  )
} 