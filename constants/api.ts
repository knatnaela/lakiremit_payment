// API Configuration Constants
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
  FRONTEND_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
} as const

// API Endpoints
export const API_ENDPOINTS = {
  TRANSACTION: {
    GET_USER_TRANSACTION: (transactionId: string) => `/api/v1/transaction/user/${transactionId}`
  },
  PAYMENT: {
    CHECKOUT_TOKEN: '/api/v1/payment/checkout-token',
    COMBINED: '/api/v1/payment/combined',
    COMBINED_INIT: '/api/v1/payment/combined-init',
    COMBINED_AFTER_CHALLENGE: '/api/v1/payment/combined-after-challenge',
    CHALLENGE_COMPLETE: '/api/v1/payment/challenge-complete'
  }
} as const

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`
}

// Challenge callback URLs
export const CHALLENGE_URLS = {
  RESULT_CALLBACK: `${API_CONFIG.FRONTEND_BASE_URL}/api/payment/challenge-result`,
  PROCESSING_PAGE: `${API_CONFIG.FRONTEND_BASE_URL}/app/challenge-processing`,
  CALLBACK_HANDLER: `${API_CONFIG.FRONTEND_BASE_URL}/app/payment/3ds-callback`
} as const 