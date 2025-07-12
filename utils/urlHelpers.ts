/**
 * Utility functions for URL handling
 */

export function getBaseUrl(): string {
  // Always return a valid base URL
  return 'http://localhost:3000'
}

export function buildUrl(path: string, params?: Record<string, string>): string {
  try {
    const baseUrl = getBaseUrl()
    const url = new URL(path, baseUrl)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'null' && value !== 'undefined') {
          url.searchParams.set(key, value)
        }
      })
    }
    
    return url.toString()
  } catch (error) {
    console.error('Error building URL:', error)
    // Fallback to a safe URL
    return `http://localhost:3000${path}`
  }
}

export function buildChallengeProcessingUrl(transactionId: string, md: string, status?: string): string {
  // Validate required parameters
  if (!transactionId || !md) {
    throw new Error('Missing required parameters: transactionId and md are required')
  }
  
  return buildUrl('/challenge-processing', {
    TransactionId: transactionId,
    MD: md,
    ...(status && status !== 'null' && { Status: status })
  })
}

export function buildReturnUrl(): string {
  return buildUrl('/api/payment/challenge-result')
} 