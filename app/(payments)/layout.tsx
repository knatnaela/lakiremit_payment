export default function PaymentsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            LakiRemit
          </h1>
          <p className="text-gray-600">
            Save more, give more with LakiRemit.
          </p>
        </div>

        {children}
      </div>
    </main>
  )
} 