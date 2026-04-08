'use client'

import { useState } from 'react'
import { Activity, Droplets, CreditCard } from 'lucide-react'

export function HistoryTabs() {
  const [activeTab, setActiveTab] = useState<'swaps' | 'liquidity' | 'payfi'>('swaps')

  return (
    <div className="bg-zinc-950 rounded-3xl border border-white/5 shadow-2xl overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-white/5 overflow-x-auto hide-scrollbar">
        <button 
          onClick={() => setActiveTab('swaps')}
          className={`flex items-center px-6 py-4 font-semibold text-sm transition-colors whitespace-nowrap ${activeTab === 'swaps' ? 'border-b-2 border-blue-500 text-blue-400 bg-blue-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Activity className="w-4 h-4 mr-2" />
          Swap Events
        </button>
        <button 
          onClick={() => setActiveTab('liquidity')}
          className={`flex items-center px-6 py-4 font-semibold text-sm transition-colors whitespace-nowrap ${activeTab === 'liquidity' ? 'border-b-2 border-emerald-500 text-emerald-400 bg-emerald-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Droplets className="w-4 h-4 mr-2" />
          Liquidity Changes
        </button>
        <button 
          onClick={() => setActiveTab('payfi')}
          className={`flex items-center px-6 py-4 font-semibold text-sm transition-colors whitespace-nowrap ${activeTab === 'payfi' ? 'border-b-2 border-amber-500 text-amber-400 bg-amber-500/5' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          HashKey PayFi
        </button>
      </div>

      {/* Content */}
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-zinc-950 text-zinc-500 uppercase text-xs tracking-wider border-b border-white/5">
            {activeTab === 'swaps' && (
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Direction</th>
                <th className="px-6 py-4 font-medium">Token In</th>
                <th className="px-6 py-4 font-medium text-right">Amount In</th>
                <th className="px-6 py-4 font-medium text-right">Amount Out</th>
                <th className="px-6 py-4 font-medium text-right">Price</th>
              </tr>
            )}
            {activeTab === 'liquidity' && (
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium text-right">RWA Amount</th>
                <th className="px-6 py-4 font-medium text-right">USDC Amount</th>
                <th className="px-6 py-4 font-medium text-right">Shares</th>
              </tr>
            )}
            {activeTab === 'payfi' && (
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Flow</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">HashKey Mandate ID</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-white/5">
            {/* Mock Data for demo */}
            {[1, 2, 3].map((i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4 text-zinc-400">Apr 8, 2026</td>
                
                {/* Swap specific columns */}
                {activeTab === 'swaps' && (
                  <>
                    <td className="px-6 py-4">
                      {i === 1 ? <span className="text-emerald-400">Buy RWA</span> : <span className="text-rose-400">Sell RWA</span>}
                    </td>
                    <td className="px-6 py-4 text-zinc-300 font-mono">{i === 1 ? 'USDC' : 'RWA'}</td>
                    <td className="px-6 py-4 text-right text-zinc-300 font-mono">{i * 1000}</td>
                    <td className="px-6 py-4 text-right text-zinc-300 font-mono">{i * 10}</td>
                    <td className="px-6 py-4 text-right text-zinc-400 font-mono">$100.05</td>
                  </>
                )}

                {/* Liquidity specific columns */}
                {activeTab === 'liquidity' && (
                  <>
                    <td className="px-6 py-4 text-zinc-300">Deposit</td>
                    <td className="px-6 py-4 text-right text-zinc-300 font-mono">{i * 10}</td>
                    <td className="px-6 py-4 text-right text-zinc-300 font-mono">{i * 1000}</td>
                    <td className="px-6 py-4 text-right text-zinc-400 font-mono">{i * 2000}</td>
                  </>
                )}

                {/* PayFi specific columns */}
                {activeTab === 'payfi' && (
                  <>
                    <td className="px-6 py-4 text-zinc-300">{i === 1 ? 'Checkout' : 'Auto-Invest (DCA)'}</td>
                    <td className="px-6 py-4 text-right text-zinc-300 font-mono">${i * 1000}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">payment-successful</span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400 font-mono text-xs">ORDER-2026-{Math.floor(Math.random()*10000)}</td>
                  </>
                )}
              </tr>
            ))}
            
            {/* Empty State Fallback */}
            {false && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
