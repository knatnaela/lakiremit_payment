'use client'

import { useState } from 'react'
import PaymentForm from './PaymentForm'
import { PaymentProviderFactory } from './payment/providers/PaymentProviderFactory'

export default function PaymentFormExample() {
  const [selectedProvider, setSelectedProvider] = useState<'cybersource' | 'mastercard'>('mastercard')

  // Example of how the factory pattern would work
  const createProvider = () => {
    try {
      const provider = PaymentProviderFactory.createProvider(selectedProvider)
      
      return provider
    } catch (error) {
      return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Laki Remit Payment</h1>
          <p className="text-gray-600 mb-6">Secure and fast money transfer service with multi-provider support</p>
          
          {/* Provider Selection */}
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">Select Payment Provider</h2>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="provider"
                  value="cybersource"
                  checked={selectedProvider === 'cybersource'}
                  onChange={(e) => setSelectedProvider(e.target.value as 'cybersource' | 'mastercard')}
                  className="mr-2"
                />
                Cybersource
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="provider"
                  value="mastercard"
                  checked={selectedProvider === 'mastercard'}
                  onChange={(e) => setSelectedProvider(e.target.value as 'cybersource' | 'mastercard')}
                  className="mr-2"
                />
                Mastercard
              </label>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Current provider: <span className="font-semibold">{selectedProvider}</span>
            </p>
            
            {/* Factory Pattern Demo */}
            <div className="mt-4 p-3 bg-blue-50 rounded border">
              <h3 className="text-sm font-semibold mb-2">Factory Pattern Demo</h3>
              <button 
                onClick={createProvider}
                className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                Create Provider Instance
              </button>
              <p className="text-xs text-gray-600 mt-1">
                Check console to see the provider instance being created
              </p>
            </div>
          </div>
        </div>

        {/* Payment Form - Currently only supports Cybersource */}
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> The PaymentForm currently only supports Cybersource. 
            The factory pattern is ready but not yet integrated into the main form.
          </p>
        </div>
        
        <PaymentForm />
      </div>
    </div>
  )
} 