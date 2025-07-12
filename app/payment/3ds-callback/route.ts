import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Just pass through to the page component
  return NextResponse.next()
}

export const dynamic = 'force-dynamic' 