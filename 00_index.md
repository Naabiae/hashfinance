# RWA Liquidity Hub — Technical Specification Index

**Hackathon:** HashKey Chain Horizon Hackathon (DeFi + PayFi tracks)
**Submission deadline:** April 15, 2026 at 23:59 GMT+8
**Prize pool:** $40,000 USDT
**Network:** HashKey Chain Testnet (chainId 133) → Mainnet (chainId 177)

---

## What we are building

A compliant RWA (Real World Asset) liquidity pool on HashKey Chain. Institutional investors can:

- Hold KYC-gated RWA tokens (tokenized bonds, treasuries, receivables)
- Provide liquidity to an oracle-anchored pool (no x·y=k AMM — price comes from APRO oracle)
- Swap USDC ↔ RWA tokens at verified NAV price plus spread
- Receive yield distributions natively and execute Auto-Invest (DCA) via HashKey PayFi Gateway
- Execute large trades through a TradeGuard commit-reveal mechanism for institutional safety

---

## The five design decisions this spec defends

| Decision | Why |
|---|---|
| Oracle-anchored pool, not x·y=k | RWA NAVs are off-chain; constant-product math creates arb at every NAV update |
| HashKey KYC SBT as compliance source | Native chain infrastructure; judges want to see it used, not reimplemented |
| HashKey PayFi Gateway | PayFi track bonus points; creates compliant Web2.5 fiat/crypto onboarding (Checkout & Auto-Invest DCA) |
| TradeGuard commit-reveal | Mirrors HashKey CEO's "fat finger" rollback concept; no other submission will have it |
| ERC-20 `_update` hook for transfer compliance | Token-level enforcement as well as pool-level; Policy-as-Code pattern |

---

## Module files

| File | Contents |
|---|---|
| `01_smart_contracts.md` | All 5 Solidity contracts: KYCRegistry, RWAToken, PriceOracle, RWAPool, TradeGuard |
| `02_backend.md` | Oracle keeper, event indexer, REST API, KYC redirect service |
| `03_hsp_payments.md` | PayFi Gateway integration, Institutional Checkout, Auto-Invest (DCA) and webhook verification |
| `04_frontend.md` | Next.js app: Dashboard, Swap, Liquidity, History pages + all components |

---

## Build sequence (8 days)

### Day 1–2 — Smart contracts (deploy to testnet by end of Day 2)

1. KYCRegistry — start here, everything depends on it
2. RWAToken — add compliance hook
3. PriceOracle — integrate APRO feed
4. RWAPool — core pool logic
5. TradeGuard — commit-reveal
6. Write and run all contract tests locally
7. Deploy full contract suite to HashKey testnet

### Day 3–4 — Backend

1. Set up project structure and DB schema
2. Oracle keeper — get it pushing prices to testnet immediately
3. Event indexer — needs live contracts to index
4. REST API routes
5. KYC redirect service
6. PayFi Gateway integration (Checkout + Webhooks)
7. Run backend integration tests against testnet

### Day 5–6 — Frontend + PayFi integration

1. Configure wagmi with HashKey Chain
2. Pool Dashboard page — uses API, no writes
3. KYC check on wallet connect
4. Swap page — both direct and TradeGuard flows
5. Liquidity page — direct deposit + HashKey PayFi checkout
6. Auto-Invest (DCA) subscription UI
7. History page

### Day 7 — Integration and end-to-end

1. Connect all layers: frontend → backend → contracts → HashKey chain
2. Run full user journey: KYC → direct deposit / PayFi checkout → swap → Auto-Invest
3. Fix any integration bugs
4. Performance check: ensure API responses < 500ms, RPC calls < 3s

### Day 8 — Demo video and submission

1. Record 3-minute demo video showing:
   - KYC gate in action
   - Swap execution (small direct, large via TradeGuard)
   - Institutional Checkout via HashKey Gateway
   - Auto-Invest subscription (reusable mandate)
   - Circuit breaker demo (if possible)
2. Write submission description on DoraHacks
3. Deploy frontend to Vercel
4. Submit before 23:59 GMT+8 April 15

---

## Test count summary

| Module | Tests |
|---|---|
| Smart contracts | 35 (across 4 contracts) |
| Backend | 24 (across 5 services) |
| PayFi Gateway | 10 (Checkout + DCA + Webhook) |
| Frontend | 15 |
| **Total** | **84 tests** |

---

## Addresses and networks

| Item | Testnet | Mainnet |
|---|---|---|
| Chain ID | 133 | 177 |
| RPC | `https://hk-testnet.rpc.alt.technology` | `https://mainnet.hsk.xyz` |
| Explorer | `https://hashkey.blockscout.com` | `https://hashkey.blockscout.com` |
| KYC SBT | `https://kyc-testnet.hunyuankyc.com` (get address from docs) | TBD |
| APRO BTC/USD | `0x64697A6Abb508079687465FA9EF99D2Da955D791` | `0x204ED500ab56A2E19B051561258E3A45c850360F` |
| APRO USDC/USD | `0xCdB10dC9dB30B6ef2a63aB4460263655808fAE27` | `0x244Ce344df8837c9d938867E2Ffbf0E4B0169B56` |
| SUPRA pull | `0x443A0f4Da5d2fdC47de3eeD45Af41d399F0E5702` | `0x16f70cAD28dd621b0072B5A8a8c392970E87C3dD` |
| Chainlink verifier | `0xE02A72Be64DA496797821f1c4BB500851C286C6c` | `0x3278e7a582B94d82487d4B99b31A511CbAe2Cd54` |
| PayFi Gateway | `https://merchant-qa.hashkeymerchant.com` | `https://merchant.hashkey.com` |
| Faucet | `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/Faucet` | N/A |

---

## Master resource list

| Category | Resource | URL |
|---|---|---|
| HashKey | Chain docs | `https://docs.hashkeychain.net` |
| HashKey | KYC SBT integration | `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC` |
| HashKey | Oracle docs | `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/Oracle` |
| HashKey | PayFi Gateway docs | PDF reference |
| HashKey | Developer community | `https://hashfans.io/` |
| HashKey | Telegram group | `https://t.me/HashKeyChainHSK/95285` |
| HashKey | Blockscout explorer | `https://hashkey.blockscout.com` |
| HashKey | KYC testnet portal | `https://kyc-testnet.hunyuankyc.com` |
| Oracle | APRO docs | `https://docs.apro.com/en/data-push/getting-started` |
| Oracle | SUPRA pull oracle | `https://docs.supra.com/oracles/data-feeds/pull-oracle` |
| Oracle | Chainlink AggregatorV3 | `https://docs.chain.link/data-feeds/api-reference` |
| Contracts | OpenZeppelin v5 | `https://docs.openzeppelin.com/contracts/5.x` |
| Contracts | OZ ERC-20 `_update` hook | `https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20-_update-address-address-uint256-` |
| Contracts | OpenZeppelin EnumerableSet | `https://docs.openzeppelin.com/contracts/5.x/api/utils#EnumerableSet` |
| Contracts | Hardhat docs | `https://hardhat.org/docs` |
| Contracts | Hardhat time helpers | `https://hardhat.org/hardhat-network/docs/reference#special-testing-json-rpc-methods` |
| Backend | ethers.js v6 | `https://docs.ethers.org/v6/` |
| Backend | node-cron | `https://github.com/node-cron/node-cron` |
| Backend | better-sqlite3 | `https://github.com/WiseLibs/better-sqlite3` |
| Backend | express-rate-limit | `https://github.com/express-rate-limit/express-rate-limit` |
| Backend | SIWE auth | `https://docs.login.xyz/` |
| Frontend | wagmi v2 | `https://wagmi.sh/react/getting-started` |
| Frontend | viem | `https://viem.sh/` |
| Frontend | ConnectKit | `https://docs.family.co/connectkit` |
| Frontend | Next.js App Router | `https://nextjs.org/docs/app` |
| Frontend | shadcn/ui | `https://ui.shadcn.com/docs` |
| Frontend | React Query | `https://tanstack.com/query/latest/docs/framework/react/overview` |
| Frontend | recharts | `https://recharts.org/en-US/api` |
| Reference | Ondo Finance (RWA pool) | `https://github.com/ondoprotocol/tokenized-funds` |
| Reference | ERC-4626 vault standard | `https://eips.ethereum.org/EIPS/eip-4626` |
| Reference | ERC-3643 T-REX | `https://github.com/TokenySolutions/T-REX` |
| Hackathon | DoraHacks submission | `https://dorahacks.io/hackathon/2045/buidl` |
| Hackathon | AMA schedule | Telegram group above |
