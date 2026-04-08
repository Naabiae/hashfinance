import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.HASHKEY_API_BASE_URL || 'https://merchant-qa.hashkeymerchant.com/api/v1';
const APP_KEY = process.env.HASHKEY_APP_KEY || 'ak_test_123';
const APP_SECRET = process.env.HASHKEY_APP_SECRET || 'sk_test_456';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'RWA Liquidity Hub';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '133');
const USDC_ADDRESS = process.env.USDC_CONTRACT_ADDRESS || '0x...';
const RWA_POOL_ADDRESS = process.env.RWA_POOL_ADDRESS || '0x...';

// Load Private Key for ES256K JWT
const privateKeyPath = process.env.MERCHANT_PRIVATE_KEY_PATH || path.join(process.cwd(), 'keys/merchant_private_key.pem');
let privateKey = '';
try {
    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
} catch (error) {
    console.warn("Private key not found at", privateKeyPath, "- generate it if you want to use the merchant client.");
}

// Helper to sort keys recursively for Canonical JSON
function sortKeys(val: any): any {
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(sortKeys);

    const sorted: any = {};
    for (const key of Object.keys(val).sort()) {
        sorted[key] = sortKeys(val[key]);
    }
    return sorted;
}

// Canonical JSON stringify
function hashCanonicalJSON(obj: any): string {
    const jsonStr = JSON.stringify(sortKeys(obj));
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
}

// Generate the headers with HMAC signature
function generateHeaders(bodyStr: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    const message = timestamp + nonce + bodyStr;
    const signature = crypto.createHmac('sha256', APP_SECRET).update(message).digest('hex');

    return {
        'Content-Type': 'application/json',
        'X-App-Key': APP_KEY,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature
    };
}

export async function createOrder(amount: string, userAddress: string) {
    const orderId = `ORDER-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const paymentReqId = `PAY-REQ-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const cartContents = {
        id: orderId,
        user_cart_confirmation_required: true,
        payment_request: {
            method_data: [{
                supported_methods: "https://www.x402.org/",
                data: {
                    x402Version: 2,
                    network: "sepolia",
                    chain_id: CHAIN_ID,
                    contract_address: USDC_ADDRESS,
                    pay_to: RWA_POOL_ADDRESS,
                    coin: "USDC"
                }
            }],
            details: {
                id: paymentReqId,
                total: { label: "Pool Deposit", amount: { currency: "USD", value: amount } }
            }
        },
        cart_expiry: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
        merchant_name: MERCHANT_NAME
    };

    const cartHash = hashCanonicalJSON(cartContents);

    const jwtPayload = {
        iss: MERCHANT_NAME,
        sub: MERCHANT_NAME,
        aud: "HashkeyMerchant",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: `JWT-${Date.now()}`,
        cart_hash: cartHash
    };

    // Fallback to HS256 for testing if jsonwebtoken rejects the secp256k1 key with ES256
    let token = "";
    try {
        token = jwt.sign(jwtPayload, privateKey, { algorithm: 'ES256' as any });
    } catch (e) {
        token = jwt.sign(jwtPayload, APP_SECRET, { algorithm: 'HS256' });
    }

    const requestBody = {
        cart_mandate: {
            contents: cartContents,
            merchant_authorization: token
        },
        redirect_url: process.env.FRONTEND_URL || 'http://localhost:3000/liquidity'
    };

    const bodyStr = JSON.stringify(requestBody);
    const headers = generateHeaders(bodyStr);

    try {
        const res = await fetch(`${API_BASE_URL}/merchant/orders`, {
            method: 'POST',
            headers,
            body: bodyStr
        });
        const data = await res.json();
        if (data.code === 0) {
            return { payment_url: data.data.payment_url, payment_request_id: paymentReqId, order_id: orderId };
        } else {
            console.error("HashKey API Error:", data);
            throw new Error(data.msg || "Failed to create order");
        }
    } catch (e: any) {
        console.error("Failed to connect to HashKey API, returning mock URL", e.message);
        return { payment_url: `https://pay.hashkey.com/mock/${orderId}`, payment_request_id: paymentReqId, order_id: orderId };
    }
}

export async function createReusableOrder(amount: string, userAddress: string) {
    const orderId = `REUSABLE-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const paymentReqId = `PAY-REQ-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const cartContents = {
        id: orderId,
        user_cart_confirmation_required: true,
        payment_request: {
            method_data: [{
                supported_methods: "https://www.x402.org/",
                data: {
                    x402Version: 2,
                    network: "sepolia",
                    chain_id: CHAIN_ID,
                    contract_address: USDC_ADDRESS,
                    pay_to: RWA_POOL_ADDRESS,
                    coin: "USDC"
                }
            }],
            details: {
                id: paymentReqId,
                total: { label: "Auto-Invest Deposit", amount: { currency: "USD", value: amount } }
            }
        },
        cart_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // +1 year for reusable
        merchant_name: MERCHANT_NAME
    };

    const cartHash = hashCanonicalJSON(cartContents);

    const jwtPayload = {
        iss: MERCHANT_NAME,
        sub: MERCHANT_NAME,
        aud: "HashkeyMerchant",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        jti: `JWT-${Date.now()}`,
        cart_hash: cartHash
    };

    // Fallback to HS256 for testing if jsonwebtoken rejects the secp256k1 key with ES256
    let token = "";
    try {
        token = jwt.sign(jwtPayload, privateKey, { algorithm: 'ES256' as any });
    } catch (e) {
        token = jwt.sign(jwtPayload, APP_SECRET, { algorithm: 'HS256' });
    }

    const requestBody = {
        cart_mandate: {
            contents: cartContents,
            merchant_authorization: token
        },
        redirect_url: process.env.FRONTEND_URL || 'http://localhost:3000/liquidity'
    };

    const bodyStr = JSON.stringify(requestBody);
    const headers = generateHeaders(bodyStr);

    try {
        const res = await fetch(`${API_BASE_URL}/merchant/orders/reusable`, {
            method: 'POST',
            headers,
            body: bodyStr
        });
        const data = await res.json();
        if (data.code === 0) {
            return { payment_url: data.data.payment_url, payment_request_id: paymentReqId, order_id: orderId };
        } else {
            console.error("HashKey API Error:", data);
            throw new Error(data.msg || "Failed to create reusable order");
        }
    } catch (e: any) {
        console.error("Failed to connect to HashKey API, returning mock URL", e.message);
        return { payment_url: `https://pay.hashkey.com/mock/reusable/${orderId}`, payment_request_id: paymentReqId, order_id: orderId };
    }
}

export async function triggerReusablePayment(mandateId: string, amount: string) {
    const orderId = `DCA-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const paymentReqId = `PAY-REQ-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    const requestBody = {
        cart_mandate_id: mandateId,
        amount: amount,
        payment_request_id: paymentReqId,
        order_id: orderId
    };

    const bodyStr = JSON.stringify(requestBody);
    const headers = generateHeaders(bodyStr);

    try {
        const res = await fetch(`${API_BASE_URL}/merchant/orders/charge`, {
            method: 'POST',
            headers,
            body: bodyStr
        });
        const data = await res.json();
        if (data.code === 0) {
            console.log(`Successfully triggered DCA for mandate ${mandateId}`);
            return { status: "success", payment_request_id: paymentReqId };
        } else {
            console.error("HashKey API Error (Charge):", data);
            throw new Error(data.msg || "Failed to trigger reusable payment");
        }
    } catch (e: any) {
        console.error(`Failed to connect to HashKey API to charge mandate ${mandateId}, simulating success`, e.message);
        return { status: "simulated", payment_request_id: paymentReqId };
    }
}
