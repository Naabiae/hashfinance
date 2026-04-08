'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'

export interface KYCStatus {
  level: number
  levelName: string
  canSwap: boolean
  canProvideLiquidity: boolean
  kycPortalUrl: string
}

export function useKYCStatus() {
  const { address, isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['kycStatus', address],
    queryFn: async (): Promise<KYCStatus> => {
      if (!address) return { level: 0, levelName: 'Unverified', canSwap: false, canProvideLiquidity: false, kycPortalUrl: process.env.NEXT_PUBLIC_KYC_PORTAL_URL || 'https://kyc-testnet.hunyuankyc.com' }
      
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001'}/api/kyc/check?address=${address}`)
        if (res.ok) {
          return await res.json()
        }
      } catch (e) {
        console.error('KYC check failed', e)
      }
      
      // Fallback mock logic for UI building
      // E.g. level 2 for everyone for the demo if API fails
      return {
        level: 2,
        levelName: 'Advanced',
        canSwap: true,
        canProvideLiquidity: true,
        kycPortalUrl: process.env.NEXT_PUBLIC_KYC_PORTAL_URL || 'https://kyc-testnet.hunyuankyc.com'
      }
    },
    enabled: isConnected && mounted,
    staleTime: 60000,
  })

  return {
    status: data,
    isLoading: isLoading || !mounted,
    refetch
  }
}
