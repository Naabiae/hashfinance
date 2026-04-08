# Module 2 — Backend

**Project:** RWA Liquidity Hub — HashKey Chain Horizon Hackathon
**Stack:** Node.js (TypeScript) · Express · ethers.js v6 · Bull queue · Redis · PostgreSQL (optional, SQLite for demo)
**Role:** Oracle keeper, NAV price pusher, event indexer, API layer for the frontend

---

## Overview

### What we are building

The backend has four responsibilities:

1. **Oracle Keeper** — watches off-chain RWA NAV sources, formats prices, and calls `PriceOracle.pushRWAPrice()` on-chain
2. **Event Indexer** — listens to contract events (swaps, liquidity changes, yield distribution) and stores them for the frontend dashboard
3. **REST API** — serves pool state, price history, LP positions, and transaction history to the frontend
4. **KYC Redirect Service** — checks a wallet's KYC status via the SBT and redirects unverified users to HashKey's KYC portal

### Why we need a backend

Three things cannot be done purely on-chain:

- **NAV price sourcing**: RWA token prices come from TradFi data sources (Bloomberg, Reuters, fund administrator reports). These are off-chain. Someone has to fetch them and push to the oracle contract — that's the keeper.
- **Historical data**: Smart contracts only store current state. The frontend needs price history, swap history, and LP analytics. The indexer stores events so the UI can render charts and tables.
- **UX APIs**: Calling multiple contracts and aggregating state is slow when done from the browser. A backend does it once and caches the result.

For the hackathon, the NAV source will be mocked (simulated bond prices with realistic daily updates). The architecture is identical to production — only the data source changes.

---

## Service 1 — Oracle Keeper

### What it does

A cron job that runs every 5 minutes. Fetches simulated RWA NAV data, formats it, and submits to `PriceOracle.pushRWAPrice()`. In production this connects to Bloomberg Terminal API or a licensed data vendor. For the demo it generates realistic bond price data with small daily drift.

### Why we need it

The PriceOracle contract cannot pull data — Ethereum contracts cannot make outbound HTTP calls. The keeper is the trusted bridge between off-chain data and the on-chain oracle. This is the standard pattern used by Chainlink node operators, APRO operators, and all institutional oracle networks.

The keeper must be a separate process (not an API endpoint) because it runs on a schedule regardless of user activity. If the keeper dies, the circuit breaker kicks in after MAX_STALENESS and halts trading — this is intentional and safe.

### Architecture

```
[NAV Data Source]
       │
       ▼
[Keeper Cron Job] ─── every 5 minutes
       │
       ├── fetch price from mock source (or Bloomberg in prod)
       ├── sign tx with KEEPER_PRIVATE_KEY
       ├── call PriceOracle.pushRWAPrice(token, price, timestamp)
       └── log result to database + console
```

### Modules to implement

**`src/keeper/priceSource.ts`** — NAV data fetcher
- `getMockBondPrice(isinCode: string): Promise<{ price: bigint, timestamp: number }>`
- Generates a realistic daily drift: start at $100.00, add small random walk ±0.2% per update
- Uses `isinCode` as seed for deterministic demo prices
- In production: replace with Bloomberg BLPAPI or Refinitiv Eikon REST call

**`src/keeper/oraclePusher.ts`** — on-chain transaction sender
- Connects to HashKey Chain via ethers.js provider
- Loads KEEPER_PRIVATE_KEY from env
- Calls `priceOracle.pushRWAPrice(tokenAddress, price, timestamp)`
- Implements retry with exponential backoff (3 attempts)
- Handles `nonce too low` errors by refetching nonce

**`src/keeper/index.ts`** — cron scheduler
- Uses `node-cron` to run every 5 minutes: `cron.schedule('*/5 * * * *', runKeeper)`
- Loops over all registered RWA tokens
- Fetches price, pushes on-chain, logs result
- If push fails 3 times → send alert (console.error for hackathon, PagerDuty in prod)

### Environment variables needed

```
KEEPER_PRIVATE_KEY=0x...
RPC_URL=https://hk-testnet.rpc.alt.technology
PRICE_ORACLE_ADDRESS=0x...
CHAIN_ID=133
PUSH_INTERVAL_MINUTES=5
MAX_RETRY=3
```

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `keeper_mockPrice_returns_valid` | Call getMockBondPrice | Returns price > 0, timestamp within last minute |
| `keeper_pushPrice_success` | Mock contract, call oraclePusher | Contract `pushRWAPrice` called with correct args |
| `keeper_retry_on_failure` | Mock contract to fail twice then succeed | Retries 3 times, succeeds on 3rd |
| `keeper_handles_nonce_error` | Mock nonce too low error | Refetches nonce, retries |
| `keeper_logs_result` | Successful push | Log entry with txHash created |

### Test validation checklist

- [ ] All 5 unit tests pass with mocked contract
- [ ] Integration test: deploy PriceOracle to testnet, run keeper, verify price appears on-chain
- [ ] Verify staleness: stop keeper for 25 hours, attempt swap — confirm oracle reverts with "stale price"
- [ ] Confirm price visible on Blockscout under contract Events tab

### Resources

- ethers.js v6 docs: `https://docs.ethers.org/v6/`
- node-cron: `https://github.com/node-cron/node-cron`
- Exponential backoff pattern: `https://github.com/tim-kos/node-retry`
- HashKey testnet RPC: `https://hk-testnet.rpc.alt.technology`

---

## Service 2 — Event Indexer

### What it does

Listens to blockchain events from all deployed contracts using ethers.js `contract.on(eventName, callback)` and `provider.getLogs()`. Stores events in a local SQLite database (PostgreSQL in production). Provides the data layer for the REST API.

### Why we need it

Smart contracts emit events but don't store them in queryable form. `getLogs` is slow and unreliable for building UIs — it requires knowing the exact block range, doesn't paginate well, and times out on large ranges. The indexer solves this by maintaining a local, always-up-to-date database of all relevant events.

This is the same architecture used by The Graph Protocol — we're building a simplified in-process version for the hackathon.

### Database schema (SQLite)

```
TABLE swaps (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash      TEXT UNIQUE NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp    INTEGER NOT NULL,
  user_address TEXT NOT NULL,
  token_in     TEXT NOT NULL,
  token_out    TEXT NOT NULL,
  amount_in    TEXT NOT NULL,    -- stored as string to avoid BigInt precision loss
  amount_out   TEXT NOT NULL,
  price        TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
)

TABLE liquidity_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash      TEXT UNIQUE NOT NULL,
  block_number INTEGER NOT NULL,
  timestamp    INTEGER NOT NULL,
  lp_address   TEXT NOT NULL,
  event_type   TEXT NOT NULL,   -- "ADD" | "REMOVE"
  rwa_amount   TEXT NOT NULL,
  stable_amount TEXT NOT NULL,
  shares       TEXT NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
)

TABLE price_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  token_address TEXT NOT NULL,
  price        TEXT NOT NULL,
  timestamp    INTEGER NOT NULL,
  pushed_by    TEXT NOT NULL,   -- keeper wallet address
  tx_hash      TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
)

TABLE yield_distributions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_hash         TEXT UNIQUE NOT NULL,
  block_number    INTEGER NOT NULL,
  timestamp       INTEGER NOT NULL,
  total_amount    TEXT NOT NULL,
  recipient_count INTEGER NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
)

TABLE indexer_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL      -- stores last indexed block per contract
)
```

### Modules to implement

**`src/indexer/eventListeners.ts`**
- `startListeners(contracts: ContractMap)` — sets up real-time event listeners for all 5 contracts
- `listenSwaps(pool)` — on `Swap` event: insert into `swaps` table
- `listenLiquidity(pool)` — on `LiquidityAdded` and `LiquidityRemoved`: insert into `liquidity_events`
- `listenPrices(oracle)` — on `PricePushed`: insert into `price_history`
- `listenYield(pool)` — on `YieldDistributed`: insert into `yield_distributions`

**`src/indexer/historicalSync.ts`**
- `syncFromBlock(contract, eventName, fromBlock, toBlock)` — backfills events from deployment block
- Runs once on startup to fill gaps
- Uses `provider.getLogs` with block range chunking (500 blocks per chunk)
- Updates `indexer_state` table with last synced block

**`src/indexer/db.ts`**
- Initializes SQLite database
- Exports typed query functions: `insertSwap()`, `getSwapsByUser()`, `getPriceHistory()`, etc.
- Uses `better-sqlite3` for synchronous SQLite access (simpler than async drivers for hackathon)

### Environment variables needed

```
RPC_URL=https://hk-testnet.rpc.alt.technology
RWA_POOL_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...
RWA_TOKEN_ADDRESS=0x...
DEPLOYMENT_BLOCK=1234567   # block at which contracts were deployed
DB_PATH=./data/rwa_hub.db
```

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `indexer_stores_swap_event` | Mock Swap event, fire it | Row appears in swaps table |
| `indexer_stores_liquidity_event` | Mock LiquidityAdded event | Row in liquidity_events |
| `indexer_deduplicates_by_txhash` | Insert same tx_hash twice | No duplicate row |
| `indexer_syncs_historical` | Mock getLogs response, run sync | All events inserted |
| `indexer_resumes_from_last_block` | Restart indexer | Reads last block from state table |

### Test validation checklist

- [ ] All 5 unit tests pass with mocked provider
- [ ] Integration test: deploy to testnet, run 3 swaps, confirm all appear in DB
- [ ] Restart indexer mid-run, confirm it resumes from last indexed block without duplicates
- [ ] Query `price_history` after keeper runs 3 cycles — confirm 3 rows for each token

### Resources

- ethers.js contract events: `https://docs.ethers.org/v6/api/contract/#ContractEvent`
- better-sqlite3: `https://github.com/WiseLibs/better-sqlite3`
- ethers.js getLogs: `https://docs.ethers.org/v6/api/providers/#Provider-getLogs`

---

## Service 3 — REST API

### What it does

Express.js REST API that serves aggregated data to the frontend. All responses are JSON. Authentication is wallet-signature based (SIWE — Sign In With Ethereum) for user-specific endpoints. Public endpoints require no auth.

### Why we need it

The frontend needs aggregated, formatted data fast. Calling 5 contracts from the browser on every page load is slow and makes too many RPC calls. The API caches contract state (refreshed every 30 seconds) and serves pre-formatted data.

### Endpoints to implement

**Public endpoints (no auth)**

`GET /api/pool/state`
Returns current pool state: reserves, spread, total shares, accumulated fees, oracle price, last price update, circuit breaker status
- Reads from RWAPool and PriceOracle contracts on-chain
- Cached 30 seconds

`GET /api/pool/price-history?token=0x...&from=1710000000&to=1710100000`
Returns array of `{ price, timestamp }` from `price_history` DB table
- Paginated: `?page=1&limit=100`

`GET /api/pool/swaps?limit=50&offset=0`
Returns recent swaps from DB

`GET /api/pool/yield-distributions`
Returns history of yield distributions

`GET /api/health`
Returns `{ status: "ok", block: <latest>, keeperLastRun: <timestamp> }`

**Authenticated endpoints (require SIWE)**

`GET /api/user/position?address=0x...`
Returns LP shares, share value in USDC, pending yield
- Calls `pool.lpShares(address)` and computes USD value at oracle price

`GET /api/user/kyc-status?address=0x...`
Returns KYC level (0–4) and status (NONE/APPROVED/REVOKED) from KYCRegistry
- If level 0: returns `{ verified: false, kycPortalUrl: "https://kyc-testnet.hunyuankyc.com" }`

`GET /api/user/history?address=0x...`
Returns user's swaps and liquidity events from DB

`GET /api/user/estimate-swap?tokenIn=0x...&amountIn=10000000000`
Returns estimated swap output, fee, spread impact, execution price
- All computed off-chain from oracle price — no on-chain call needed

### Middleware to implement

**`src/api/middleware/cache.ts`** — in-memory cache with TTL
- Uses `node-cache` or simple `Map` with expiry
- Pool state: 30s TTL
- Price history: 60s TTL
- User position: 10s TTL (changes when swaps happen)

**`src/api/middleware/rateLimit.ts`** — simple rate limit
- 60 requests per minute per IP using `express-rate-limit`
- Prevents abuse from bots during demo

**`src/api/middleware/errorHandler.ts`** — unified error responses
- All errors return `{ error: { code: string, message: string } }`
- Log full stack trace server-side

### Environment variables needed

```
PORT=3001
RPC_URL=https://hk-testnet.rpc.alt.technology
RWA_POOL_ADDRESS=0x...
KYC_REGISTRY_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...
DB_PATH=./data/rwa_hub.db
CACHE_TTL_SECONDS=30
```

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `api_pool_state_returns_200` | GET /api/pool/state | 200, has reserves and price fields |
| `api_price_history_paginated` | GET with limit/offset | Returns correct page |
| `api_user_kyc_verified` | Mock KYC level 2, GET kyc-status | Returns `{ verified: true, level: 2 }` |
| `api_user_kyc_unverified` | Mock KYC level 0 | Returns `{ verified: false, kycPortalUrl: ... }` |
| `api_estimate_swap_math` | Send 1000 USDC, 100 NAV price | Returns ~10 RWA minus spread |
| `api_cache_works` | Call pool/state twice | Second call served from cache, no RPC call |
| `api_rate_limit` | Send 61 requests in 1 min | 61st returns 429 |

### Test validation checklist

- [ ] All 7 unit tests pass with mocked contracts and DB
- [ ] Start backend, frontend, testnet — do end-to-end: connect wallet → KYC check → see pool state → swap
- [ ] Confirm `/api/user/kyc-status` returns real data from testnet SBT

### Resources

- Express.js: `https://expressjs.com/en/guide/routing.html`
- ethers.js provider: `https://docs.ethers.org/v6/api/providers/`
- express-rate-limit: `https://github.com/express-rate-limit/express-rate-limit`
- node-cache: `https://github.com/node-cache/node-cache`
- SIWE (Sign In With Ethereum): `https://docs.login.xyz/`

---

## Service 4 — KYC Redirect Service

### What it does

A single endpoint that checks a wallet's KYC status and returns either a "proceed" signal or a redirect URL to HashKey's KYC onboarding portal. The frontend calls this on wallet connect.

### Why we need it

The demo needs to show the compliance story clearly. When a judge connects an unverified wallet, the UI should smoothly redirect them to KYC rather than showing a cryptic smart contract revert. This service is the UX glue that makes the compliance layer legible.

### Endpoint

`GET /api/kyc/check?address=0x...`

Response if verified:
```
{
  "address": "0x...",
  "verified": true,
  "level": 2,
  "levelName": "ADVANCED",
  "status": "APPROVED",
  "canSwap": true,
  "canProvideLiquidity": true
}
```

Response if not verified:
```
{
  "address": "0x...",
  "verified": false,
  "level": 0,
  "levelName": "NONE",
  "status": "NONE",
  "canSwap": false,
  "canProvideLiquidity": false,
  "kycPortalUrl": "https://kyc-testnet.hunyuankyc.com",
  "requiredLevel": "BASIC for swapping, ADVANCED for providing liquidity"
}
```

### Modules to implement

**`src/kyc/kycChecker.ts`**
- `checkKYC(address: string): Promise<KYCStatus>` — calls KYCRegistry.getLevel and KYCRegistry.isRevoked
- Maps level number to name: `{ 0: "NONE", 1: "BASIC", 2: "ADVANCED", 3: "PREMIUM", 4: "ULTIMATE" }`
- Computes `canSwap` (level >= 1) and `canProvideLiquidity` (level >= 2)
- Caches result per address for 60 seconds (KYC status rarely changes)

### Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `kyc_verified_level2` | Mock level 2, call checkKYC | canSwap true, canProvideLiquidity true |
| `kyc_verified_level1` | Mock level 1 | canSwap true, canProvideLiquidity false |
| `kyc_unverified` | Mock level 0 | Both false, kycPortalUrl present |
| `kyc_revoked` | Mock REVOKED status | Both false regardless of level |
| `kyc_cache_hit` | Call twice same address | Second call does not hit contract |

### Test validation checklist

- [ ] All 5 tests pass
- [ ] Integration test with live testnet SBT: connect wallet with real KYC, confirm level matches
- [ ] Connect unverified wallet, confirm kycPortalUrl is returned and loads correctly

### Resources

- HashKey KYC portal (testnet): `https://kyc-testnet.hunyuankyc.com`
- HashKey KYC SBT interface: `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC`

---

## Backend startup sequence

Start services in this order:

1. `npm run db:migrate` — create SQLite tables
2. `npm run indexer:sync` — backfill historical events from deployment block
3. `npm run keeper:start` — start oracle keeper cron
4. `npm run api:start` — start Express API on port 3001
5. Indexer runs as a background thread inside the API process (or as a separate process)

## Project structure

```
backend/
├── src/
│   ├── keeper/
│   │   ├── priceSource.ts
│   │   ├── oraclePusher.ts
│   │   └── index.ts
│   ├── indexer/
│   │   ├── eventListeners.ts
│   │   ├── historicalSync.ts
│   │   └── db.ts
│   ├── api/
│   │   ├── routes/
│   │   │   ├── pool.ts
│   │   │   └── user.ts
│   │   ├── middleware/
│   │   │   ├── cache.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── errorHandler.ts
│   │   └── index.ts
│   ├── kyc/
│   │   └── kycChecker.ts
│   ├── contracts/
│   │   ├── abis/              -- JSON ABIs of all 5 contracts
│   │   └── addresses.ts       -- deployed addresses per network
│   └── config.ts
├── tests/
│   ├── keeper/
│   ├── indexer/
│   ├── api/
│   └── kyc/
├── data/                      -- SQLite DB lives here
├── .env.example
├── package.json
└── tsconfig.json
```

## Key references consolidated

| Resource | URL |
|---|---|
| ethers.js v6 | `https://docs.ethers.org/v6/` |
| node-cron | `https://github.com/node-cron/node-cron` |
| better-sqlite3 | `https://github.com/WiseLibs/better-sqlite3` |
| Express.js | `https://expressjs.com/` |
| express-rate-limit | `https://github.com/express-rate-limit/express-rate-limit` |
| SIWE | `https://docs.login.xyz/` |
| HashKey testnet RPC | `https://hk-testnet.rpc.alt.technology` |
| HashKey KYC docs | `https://docs.hashkeychain.net/docs/Build-on-HashKey-Chain/Tools/KYC` |
| APRO oracle docs | `https://docs.apro.com/en/data-push/getting-started` |
