import { PaymentProvider } from './PaymentProvider'
import { CybersourceProvider } from './CybersourceProvider'
import { MastercardProvider } from './MastercardProvider'

export class PaymentProviderFactory {
  static createProvider(type: 'cybersource' | 'mastercard'): PaymentProvider {
    switch(type) {
      case 'cybersource':
        return new CybersourceProvider()
      case 'mastercard':
        return new MastercardProvider()
      default:
        throw new Error(`Unknown payment provider: ${type}`)
    }
  }
} 