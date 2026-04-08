# Module 3 — HashKey PayFi Gateway (Merchant API)

**Project:** RWA Liquidity Hub — HashKey Chain Horizon Hackathon
**Stack:** Node.js · TypeScript · HashKey Merchant API (ES256K JWT, HMAC) · Solidity
**Role:** Fiat/Crypto Web2.5 Onboarding, Institutional Checkout, Auto-Invest (DCA)

---

## Overview

### What we are building

A dual-path architecture for depositing liquidity into the RWA Pool. While power-users can use standard DeFi direct smart contract interactions (calling `addLiquidity` via Web3 wallet), we are also integrating the **HashKey Merchant API** to build two institutional-grade "PayFi" features:

1. **Institutional Checkout (One-time orders)** — A compliant, Web2.5-style checkout flow where users are redirected to HashKey's payment gateway to deposit USDC into the pool.
2. **Auto-Invest / DCA (Reusable orders)** — Users sign a reusable payment mandate once, allowing our backend to automatically pull a set amount of USDC periodically (e.g., weekly) and invest it into the RWA pool.

### Why the Merchant API?

The Hackathon's PayFi track specifically rewards projects that integrate HashKey's payment tools. By using the Merchant API, we demonstrate:
- **Compliance:** Real-world payment gateway flows with robust AML and Travel Rule integration.
- **UX Abstraction:** Users don't have to deal with manual ERC-20 `approve` and `transferFrom` transactions.
- **DCA Capabilities:** Traditional blockchains cannot "pull" funds. The reusable mandate enables Web2-style recurring subscriptions (Auto-Invest) in a Web3 context.

---

## Architecture Flow

### Flow 1: Institutional Checkout (One-Time)

1. **Frontend:** User clicks "Checkout with HashKey" to invest 10,000 USDC.
2. **Backend (`POST /api/payfi/checkout`):**
   - Generates a `cart_mandate` detailing the USDC deposit to the `RWAPool` contract.
   - Computes the Canonical JSON and `cart_hash`.
   - Signs an ES256K JWT using the Merchant Private Key.
   - Calls HashKey `POST /api/v1/merchant/orders`.
   - Returns `payment_url` to the frontend.
3. **User:** Redirected to HashKey's portal, approves the payment, and returns to the dApp.
4. **Backend Webhook (`POST /api/webhooks/hashkey`):**
   - HashKey sends a webhook when the payment is `payment-successful`.
   - Backend verifies the HMAC `X-Signature`.
   - Backend Keeper Wallet calls `RWAPool.mintFromGateway(user, amount)`.

### Flow 2: Auto-Invest DCA (Reusable)

1. **Frontend:** User subscribes to "Invest 1,000 USDC Weekly".
2. **Backend (`POST /api/payfi/reusable`):**
   - Generates a `cart_mandate` for a reusable order (`multi_pay: true`).
   - Calls HashKey `POST /api/v1/merchant/orders/reusable`.
3. **User:** Approves the long-term mandate on HashKey's portal.
4. **Backend Cron Job:**
   - A weekly cron job triggers a payment against the saved mandate.
   - On successful payment (via webhook), backend calls `RWAPool.mintFromGateway(user, amount)`.

---

## Technical Specification

### 1. Key Generation

The API requires an ECDSA `secp256k1` keypair for signing the JWT. 
Run these commands to generate the keys for your backend:

```bash
openssl ecparam -name secp256k1 -genkey -noout -out merchant_private_key.pem
openssl ec -in merchant_private_key.pem -pubout -out merchant_public_key.pem
```

### 2. Cart Mandate & Canonical JSON

The core payload is the `cart_mandate`. We use the `x402` protocol definition.

```json
{
  "cart_mandate": {
    "contents": {
      "id": "ORDER-20240301-001",
      "user_cart_confirmation_required": true,
      "payment_request": {
        "method_data": [{
          "supported_methods": "https://www.x402.org/",
          "data": {
            "x402Version": 2,
            "network": "sepolia",
            "chain_id": 133,
            "contract_address": "<USDC_CONTRACT_ADDRESS>",
            "pay_to": "<RWA_POOL_ADDRESS>",
            "coin": "USDC"
          }
        }],
        "details": {
          "id": "PAY-REQ-20240301-001",
          "total": { "label": "Pool Deposit", "amount": { "currency": "USD", "value": "10000.00" } }
        }
      },
      "cart_expiry": "2026-12-31T12:00:00Z",
      "merchant_name": "RWA Liquidity Hub"
    }
  }
}
```

**Canonical JSON Hashing (`cart_hash`):**
The `contents` object must be serialized using Canonical JSON (RFC 8785) — sorting keys recursively with no extra whitespace — before taking the SHA-256 hash.

### 3. ES256K JWT Signature

The `merchant_authorization` field must be an ES256K JWT. 

**Header:** `{"alg": "ES256K", "typ": "JWT"}`
**Payload Claims:**
- `iss`: Merchant Name
- `sub`: Merchant Name
- `aud`: "HashkeyMerchant"
- `iat`: Current timestamp
- `exp`: `iat` + 3600 (1 hour)
- `jti`: Unique ID
- `cart_hash`: 64-char hex string of the SHA-256 hash of the canonical contents.

### 4. HMAC Request Authentication

All `POST` requests to `/merchant/*` require HMAC headers:
- `X-App-Key`: Your HashKey App Key.
- `X-Timestamp`: Current unix timestamp.
- `X-Nonce`: Random string.
- `X-Signature`: HMAC-SHA256 of the request payload.

### 5. Webhook Verification

HashKey sends events to your `webhook_url`. You must verify the `X-Signature` header to prevent spoofing.

**Verification Logic (TypeScript pseudo-code):**
```typescript
const sigHeader = req.headers['x-signature'];
// Parse t=... and v1=... from sigHeader
const timeDiff = Math.abs(Date.now() / 1000 - t);
if (timeDiff > 300) throw new Error("Timestamp out of tolerance");

const message = `${t}.${rawBody}`;
const expected = crypto.createHmac('sha256', APP_SECRET).update(message).digest('hex');

if (expected !== v1) throw new Error("Signature mismatch");
```

---

## Tests to write

| Test | What to assert | Pass condition |
|---|---|---|
| `jwt_generation_valid` | Generate ES256K JWT | Can be decoded, contains `cart_hash` |
| `canonical_json_hash` | Hash a nested object | Matches exact known hex string output |
| `webhook_verification_pass` | Pass valid HMAC signature | Returns true |
| `webhook_verification_fail` | Alter raw body | Throws "Signature mismatch" |
| `webhook_tolerance_fail` | Pass `t` from 10 minutes ago | Throws "Timestamp out of tolerance" |

---

## Key references consolidated

| Resource | URL |
|---|---|
| Merchant API Base (QA) | `https://merchant-qa.hashkeymerchant.com/api/v1` |
| JSON Canonicalization | RFC 8785 |
| HashKey Chain docs | `https://docs.hashkeychain.net` |
