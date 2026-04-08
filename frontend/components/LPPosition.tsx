'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { Wallet, PieChart, Coins } from 'lucide-react'

export function LPPosition() {
  const { address } = useAccount()

  const { data, isLoading } = useQuery({
    queryKey: ['lpPosition', address],
    queryFn: async () => {
      // Mock data
      return {
        sharesOwned: "12500.00",
        shareValueUsdc: "12515.50",
        poolOwnershipPct: "0.85",
        pendingYield: "124.50"
      }
    },
    enabled: !!address
  })

  if (!address) return (
    <div className="bg-zinc-900 border border-white/5 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
      <Wallet className="w-12 h-12 text-zinc-700 mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">Wallet Not Connected</h3>
      <p className="text-zinc-500">Connect your wallet to view your liquidity position.</p>
    </div>
  )

  if (isLoading || !data) return <div className="animate-pulse bg-zinc-900 border border-white/5 rounded-3xl min-h-[300px]" />

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-3xl p-8">
      <h3 className="text-2xl font-bold text-white mb-8">Your Position</h3>
      
      <div className="grid gap-6">
        <div className="bg-black/50 rounded-2xl p-6 border border-white/5">
          <div className="flex items-center text-zinc-400 mb-2">
            <PieChart className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium uppercase tracking-wider">Pool Shares</span>
          </div>
          <p className="text-4xl font-bold font-mono text-white">{data.sharesOwned}</p>
          <p className="text-sm text-zinc-500 mt-2">{data.poolOwnershipPct}% of total pool</p>
        </div>

        <div className="bg-black/50 rounded-2xl p-6 border border-white/5">
          <div className="flex items-center text-zinc-400 mb-2">
            <Coins className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium uppercase tracking-wider">Position Value</span>
          </div>
          <p className="text-4xl font-bold font-mono text-white">${data.shareValueUsdc}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-900/20 to-transparent rounded-2xl p-6 border border-blue-500/20">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-sm font-medium text-blue-400 uppercase tracking-wider mb-2 block">Pending Yield</span>
              <p className="text-3xl font-bold font-mono text-blue-100">${data.pendingYield}</p>
            </div>
            <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50" disabled={Number(data.pendingYield) === 0}>
              Claim Yield
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
