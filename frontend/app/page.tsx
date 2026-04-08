import { PriceBadge } from '@/components/PriceBadge'
import { PoolStats } from '@/components/PoolStats'
import { PriceChart } from '@/components/PriceChart'
import { Activity } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between space-y-4 md:space-y-0 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Pool Dashboard</h1>
          <p className="text-zinc-400">Live pool state, oracle price, and recent transactions</p>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PriceBadge price="100.05" timestamp={Math.floor(Date.now() / 1000) - 120} />
        </div>
        <div className="lg:col-span-2">
          <PoolStats />
        </div>
      </div>

      {/* Chart */}
      <div className="mt-8">
        <PriceChart />
      </div>

      {/* Recent Swaps (mocked layout) */}
      <div className="mt-8">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Recent Swaps</h2>
        </div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-950/50 text-zinc-400 border-b border-white/5 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Time</th>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Direction</th>
                <th className="px-6 py-4 font-medium text-right">Amount In</th>
                <th className="px-6 py-4 font-medium text-right">Amount Out</th>
                <th className="px-6 py-4 font-medium text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-zinc-400">2 mins ago</td>
                  <td className="px-6 py-4 font-mono text-zinc-300">0x1234...abcd</td>
                  <td className="px-6 py-4">
                    {i % 2 === 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">Buy RWA</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 text-xs font-medium border border-rose-500/20">Sell RWA</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-zinc-300">{i * 1000} USDC</td>
                  <td className="px-6 py-4 text-right font-mono text-zinc-300">{(i * 10).toFixed(2)} RWA</td>
                  <td className="px-6 py-4 text-right font-mono text-zinc-400">$100.05</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
