import { redirect } from 'next/navigation'
import ClientChallengeProcessor from './ClientChallengeProcessor'
import { API_CONFIG } from '@/constants/api'

export default async function ChallengeProcessing({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const transactionId = searchParams.TransactionId as string
  const md = searchParams.MD as string

  if (!transactionId || !md) {
    // Use direct URL construction to avoid any issues
    const baseUrl = API_CONFIG.FRONTEND_BASE_URL
    redirect(`${baseUrl}/?error=missing_parameters`)
  }

  return <ClientChallengeProcessor transactionId={transactionId} md={md} />
} 