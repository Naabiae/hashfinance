'use client'

import { useKYCStatus } from '@/hooks/useKYCStatus'
import { Lock } from 'lucide-react'

export function KYCGate({ requiredLevel, currentLevel, kycPortalUrl }: { requiredLevel: number, currentLevel: number, kycPortalUrl: string }) {
  if (currentLevel >= requiredLevel) return null

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 bg-zinc-950/80 backdrop-blur-sm rounded-3xl border border-white/5">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm text-center shadow-2xl">
        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <Lock className="w-6 h-6 text-amber-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Verification Required</h3>
        <p className="text-sm text-zinc-400 mb-6">
          To perform this action, you need <strong>Level {requiredLevel}</strong> KYC verification. 
          Your current level is <strong>{currentLevel === 0 ? 'None' : `Level ${currentLevel}`}</strong>.
        </p>
        <a 
          href={kycPortalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full block py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors mb-3"
        >
          Complete KYC on HashKey Portal
        </a>
        <button 
          onClick={() => window.location.reload()}
          className="text-sm text-zinc-500 hover:text-white transition-colors"
        >
          Already verified? Refresh status
        </button>
      </div>
    </div>
  )
}
