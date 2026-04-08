'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useQuery } from '@tanstack/react-query'

export function PriceChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['priceHistory'],
    queryFn: async () => {
      // Mock data for demo
      const base = 100
      return Array.from({ length: 30 }).map((_, i) => ({
        timestamp: Date.now() - (30 - i) * 86400000,
        price: base + Math.random() * 2 - 1 + (i * 0.1),
        formattedDate: new Date(Date.now() - (30 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }))
    }
  })

  if (isLoading || !data) return <div className="h-[400px] bg-zinc-900/30 rounded-3xl border border-white/5 animate-pulse" />

  const currentPrice = data[data.length - 1].price

  return (
    <div className="h-[400px] w-full bg-zinc-950 rounded-3xl p-6 border border-white/5 shadow-2xl">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-zinc-100">7-Day NAV History</h3>
        <p className="text-sm text-zinc-500">Historical performance of RWA bond price</p>
      </div>
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="formattedDate" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717a', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            domain={['dataMin - 1', 'dataMax + 1']}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#71717a', fontSize: 12 }}
            dx={-10}
            tickFormatter={(val) => `$${val.toFixed(2)}`}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
            itemStyle={{ color: '#e4e4e7' }}
            formatter={(val: any) => [`$${Number(val).toFixed(4)}`, 'Price']}
            labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
          />
          <ReferenceLine y={currentPrice} stroke="#3f3f46" strokeDasharray="3 3" />
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#3b82f6" 
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#1e3a8a', strokeWidth: 2 }}
            fillOpacity={1} 
            fill="url(#colorPrice)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
