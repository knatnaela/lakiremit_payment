export interface CardData {
  expirationMonth: string
  expirationYear: string
}

export interface PaymentData {
  token: string
  amount: string
  currency: string
  firstName: string
  lastName: string
  email: string
  billing: any
}

export interface PaymentResult {
  success: boolean
  transactionId?: string
  requires3DS?: boolean
  challengeData?: any
  error?: string
}

export interface ChallengeData {
  stepUpUrl: string
  accessToken: string
  pareq: string
  transactionId: string
}

export interface ChallengeResult {
  success: boolean
  transactionId?: string
  error?: string
}

export interface DeviceData {
  sessionId: string
  ipAddress: string
  userAgent: string
}

export interface PaymentProvider {
  initialize(): Promise<void>
  tokenizeCard(cardData: CardData): Promise<string>
  processPayment(paymentData: PaymentData): Promise<PaymentResult>
  handle3DSChallenge(challengeData: ChallengeData): Promise<ChallengeResult>
  collectDeviceData(): Promise<DeviceData>
  isInitialized(): boolean
  cleanup(): void
} 