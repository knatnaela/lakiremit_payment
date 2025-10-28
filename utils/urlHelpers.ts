/**
 * Utility functions for URL handling
 */

export function getBaseUrl(): string {
  // Use environment variable or fall back to localhost
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
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
    const fallbackBase = getBaseUrl()
    return `${fallbackBase}${path}`
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