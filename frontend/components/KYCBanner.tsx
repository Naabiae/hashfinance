'use client'

import { useKYCStatus } from '@/hooks/useKYCStatus'
import { useAccount } from 'wagmi'
import { AlertTriangle } from 'lucide-react'

export function KYCBanner() {
  const { isConnected } = useAccount()
  const { status, isLoading } = useKYCStatus()

  if (!isConnected || isLoading || !status) return null

  if (status.level >= 2) return null // All good

  return (
    <div className="bg-amber-900/40 border-b border-amber-500/30 text-amber-200 px-4 py-3 text-sm flex items-center justify-center space-x-2 w-full">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>
        Your wallet has <strong>{status.levelName} KYC</strong>. Upgrade to Advanced to provide liquidity.
      </span>
      <a 
        href={status.kycPortalUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="font-medium underline hover:text-amber-100 ml-2 whitespace-nowrap"
      >
        Complete Advanced KYC →
      </a>
    </div>
  )
}
