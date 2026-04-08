import { HistoryTabs } from '@/components/HistoryTabs'

export default function HistoryPage() {
  return (
    <div className="max-w-6xl mx-auto py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">Transaction History</h1>
        <p className="text-lg text-zinc-400">Track your swaps, liquidity events, and HashKey PayFi mandates.</p>
      </div>

      <HistoryTabs />
    </div>
  )
}
