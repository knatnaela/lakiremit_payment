import PaymentForm from '@/components/PaymentForm'

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Laki Remit Payment
          </h1>
          <p className="text-gray-600">
            Secure and fast money transfer service
          </p>
        </div>
        
        <PaymentForm />
      </div>
    </main>
  )
} 