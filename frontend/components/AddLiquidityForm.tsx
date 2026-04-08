'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useKYCStatus } from '@/hooks/useKYCStatus'
import { KYCGate } from './KYCGate'

export function AddLiquidityForm() {
  const [usdcAmount, setUsdcAmount] = useState('')
  const [rwaAmount, setRwaAmount] = useState('')
  const { status, isLoading } = useKYCStatus()

  return (
    <div className="relative">
      {!isLoading && status && (
        <KYCGate requiredLevel={2} currentLevel={status.level} kycPortalUrl={status.kycPortalUrl} />
      )}
      
      <div className={`bg-zinc-950 border border-white/5 rounded-3xl p-6 shadow-2xl transition-opacity ${(!isLoading && status && status.level < 2) ? 'opacity-20 pointer-events-none' : ''}`}>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Direct DeFi Deposit</h2>
          <p className="text-sm text-zinc-400">Add both USDC and RWA tokens to the pool manually using Web3.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-900 rounded-2xl p-4 border border-white/5 focus-within:border-blue-500/50 transition-colors">
            <label className="block text-sm font-medium text-zinc-500 mb-2">USDC Deposit</label>
            <div className="flex items-center justify-between">
              <input 
                type="number" 
                placeholder="0.0" 
                value={usdcAmount}
                onChange={e => setUsdcAmount(e.target.value)}
                className="bg-transparent text-3xl font-bold text-white w-full outline-none placeholder:text-zinc-700"
              />
              <div className="flex items-center space-x-2 bg-zinc-800 px-4 py-2 rounded-xl ml-4 font-bold text-white">USDC</div>
            </div>
          </div>

          <div className="flex justify-center -my-6 relative z-10">
            <div className="bg-zinc-800 text-white p-2 rounded-full border-4 border-zinc-950">
              <Plus className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-4 border border-white/5 focus-within:border-blue-500/50 transition-colors">
            <label className="block text-sm font-medium text-zinc-500 mb-2">RWA Deposit</label>
            <div className="flex items-center justify-between">
              <input 
                type="number" 
                placeholder="0.0" 
                value={rwaAmount}
                onChange={e => setRwaAmount(e.target.value)}
                className="bg-transparent text-3xl font-bold text-white w-full outline-none placeholder:text-zinc-700"
              />
              <div className="flex items-center space-x-2 bg-zinc-800 px-4 py-2 rounded-xl ml-4 font-bold text-white">RWA</div>
            </div>
          </div>
        </div>

        <button className="w-full mt-8 py-4 px-6 bg-white hover:bg-zinc-200 text-black font-bold rounded-2xl transition-colors shadow-lg">
          Add Liquidity
        </button>
      </div>
    </div>
  )
}
