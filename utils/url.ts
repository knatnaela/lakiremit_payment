export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }
  return 'http://localhost:3000'
}

export const getCallbackUrl = () => {
  return `${getBaseUrl()}/payment/3ds-callback`
} 