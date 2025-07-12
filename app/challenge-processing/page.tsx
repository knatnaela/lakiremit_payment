import { redirect } from 'next/navigation'
import ClientChallengeProcessor from './ClientChallengeProcessor'

export default async function ChallengeProcessing({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const transactionId = searchParams.TransactionId as string
  const md = searchParams.MD as string

  if (!transactionId || !md) {
    // Use direct URL construction to avoid any issues
    redirect('http://localhost:3000/?error=missing_parameters')
  }

  return <ClientChallengeProcessor transactionId={transactionId} md={md} />
} 