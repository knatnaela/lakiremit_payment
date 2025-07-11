export interface PaymentFormData {
  firstName: string
  lastName: string
  email: string
  amount: number
  currency: string
  expirationMonth: string
  expirationYear: string
  country: string
  address?: string
  city?: string
  postalCode?: string
  cardinalSessionId?: string
  paReference?: string
  merchantReference?: string
  saveCard?: boolean
}

export interface CybersourceToken {
  token: string
  cardType?: string
  lastFour?: string
}

export interface PaymentResponse {
  success: boolean
  transactionId?: string
  message: string
  error?: string
}

// 3D Secure Authentication Interfaces
export interface AuthenticationSetupRequest {
  isTransientToken: boolean
  transientToken?: string
  isSavedToken: boolean
  paymentInstrument?: string
}

export interface AuthenticationSetupResponse {
  ok: boolean
  data: {
    status: string
    consumerAuthenticationInformation?: {
      accessToken: string
      deviceDataCollectionUrl: string
      referenceId: string
    }
    clientReferenceInformation?: {
      code: string
    }
  }
}

export interface CardinalCommerceMessage {
  MessageType: string
  Status: boolean
  'Session Id'?: string
  [key: string]: any
}

// Enrollment Check Interfaces
export interface EnrollmentCheckRequest {
  flexResponse: string
  cardHolderName: string
  currency: string
  totalAmount: string
  paReference?: string
  returnUrl?: string
  merchantReference?: string
  cavvAuth?: string
  xidAuth?: string
  authDirectoryServeTrxId?: string
  authSpecificationVersion?: string
  ecommerceIndicatorAuth?: string
}

export interface EnrollmentCheckResponse {
  ok: boolean
  data: {
    status: string
    consumerAuthenticationInformation?: {
      accessToken: string
      stepUpUrl: string
      referenceId: string
    }
    clientReferenceInformation?: {
      code: string
    }
  }
}

// Challenge Flow Interfaces
export interface ChallengeRequest {
  accessToken: string
  stepUpUrl: string
}

export interface ChallengeResponse {
  success: boolean
  transactionId?: string
  status: string
  message: string
}

// Cybersource Flex SDK interfaces (following official documentation)
export interface FlexConstructor {
  new (captureContext: string): FlexInstance
}

export interface FlexInstance {
  microform: (options?: { styles?: any }) => MicroformInstance
}

export interface MicroformInstance {
  createField: (fieldType: 'number' | 'securityCode', options?: {
    placeholder?: string
  }) => MicroformField
  createToken: (options: {
    expirationMonth: string
    expirationYear: string
  }, callback: (err: any, token: string) => void) => void
}

export interface MicroformField {
  load: (container: HTMLElement | string) => void
  on: (event: string, callback: (event: any) => void) => void
}

// Global type for Cybersource Flex object
declare global {
  interface Window {
    Flex?: FlexConstructor
  }
} 