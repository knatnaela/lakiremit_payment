export interface PaymentFormData {
  firstName: string
  lastName: string
  email: string
  amount: number
  currency: string
  expirationMonth: string
  expirationYear: string
  // Billing address - can be flat or nested
  country: string
  address: string
  city: string
  state: string
  postalCode: string
  address2?: string
  // Nested billing address structure (for AddressForm component)
  billing?: {
    country: string
    address: string
    city: string
    state: string
    postalCode: string
    address2?: string
  }
  cardinalSessionId?: string
  paReference?: string
  merchantReference?: string
  saveCard: boolean
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

// {
//   "iss": "Flex/08",
//   "exp": 1752347838,
//   "type": "mf-2.0.0",
//   "iat": 1752346938,
//   "jti": "1E5CT8O7GN6IJ3NREYVWEOLF7Q5U931932JG5XMPAABIBBVD8HXF6872B4BEFBAA",
//   "content": {
//     "paymentInformation": {
//       "card": {
//         "expirationYear": {
//           "value": "2038"
//         },
//         "number": {
//           "detectedCardTypes": [
//             "001"
//           ],
//           "maskedValue": "XXXXXXXXXXXX2503",
//           "bin": "400000"
//         },
//         "securityCode": {},
//         "expirationMonth": {
//           "value": "02"
//         }
//       }
//     }
//   }
// }

export interface FlexTokenPayload {
  iss: string;
  exp: number;
  type: string;
  iat: number;
  jti: string;
  content: Content;
}
export interface Content {
  paymentInformation: PaymentInformation;
}
export interface PaymentInformation {
  card: Card;
}
export interface Card {
  expirationYear: ExpirationYearOrExpirationMonth;
  number: CardNumber;
  securityCode: SecurityCode;
  expirationMonth: ExpirationYearOrExpirationMonth;
}
export interface ExpirationYearOrExpirationMonth {
  value: string;
}
export interface CardNumber {
  detectedCardTypes?: string[] | null;
  maskedValue: string;
  bin: string;
}
export interface SecurityCode {
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

// Transaction API Response Interface
export interface Transaction {
  createdAt: string
  updatedAt: string
  id: string
  receiverFullName: string
  receiverPhoneNumber: string
  receiverBankAccount: string
  bankName: string
  senderFullName: string
  senderCountryCode: string
  sentAmount: number
  exchangeRate: number
  receivableAmount: number
  totalReceivableAmount: number
  currency: string
  transferType: string
  gift: number
  reason: string
  transactionFee: number
  totalAmount: number
  transactionId: string
  paymentStatus: string
  status: string
  transactionType: string
  settlementStatus: string
}

export interface TransactionResponse {
  errors: string[]
  result: string
  readableErrorMessages: string[]
  totalItems: number | null
  totalPage: number
  pageSize: number
  transactions: Transaction[]
  errorCodes: string[]
} 