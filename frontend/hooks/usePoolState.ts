'use client'

import { useQuery } from '@tanstack/react-query'

export interface PoolState {
  rwaReserve: string
  usdcReserve: string
  spreadBps: number
  feeBps: number
  accumulatedFees: string
  oraclePrice: string
  timestamp: number
}

export function usePoolState() {
  return useQuery({
    queryKey: ['poolState'],
    queryFn: async (): Promise<PoolState> => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/pool/state`)
      if (res.ok) return await res.json()
      
      // Fallback mock data
      return {
        rwaReserve: "1500000.00",
        usdcReserve: "150000000.00",
        spreadBps: 30,
        feeBps: 10,
        accumulatedFees: "45000.00",
        oraclePrice: "100.05",
        timestamp: Math.floor(Date.now() / 1000) - 120 // 2 minutes ago
      }
    },
    refetchInterval: 15_000
  })
}
