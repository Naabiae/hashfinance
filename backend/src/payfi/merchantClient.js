"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.createReusableOrder = createReusableOrder;
exports.triggerReusablePayment = triggerReusablePayment;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const API_BASE_URL = process.env.HASHKEY_API_BASE_URL || 'https://merchant-qa.hashkeymerchant.com/api/v1';
const APP_KEY = process.env.HASHKEY_APP_KEY || 'ak_test_123';
const APP_SECRET = process.env.HASHKEY_APP_SECRET || 'sk_test_456';
const MERCHANT_NAME = process.env.MERCHANT_NAME || 'RWA Liquidity Hub';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '133');
const USDC_ADDRESS = process.env.USDC_CONTRACT_ADDRESS || '0x...';
const RWA_POOL_ADDRESS = process.env.RWA_POOL_ADDRESS || '0x...';
// Load Private Key for ES256K JWT
const privateKeyPath = process.env.MERCHANT_PRIVATE_KEY_PATH || path_1.default.join(__dirname, '../../keys/merchant_private_key.pem');
let privateKey = '';
try {
    privateKey = fs_1.default.readFileSync(privateKeyPath, 'utf8');
}
catch (error) {
    console.warn("Private key not found at", privateKeyPath, "- generate it if you want to use the merchant client.");
}
// Helper to sort keys recursively for Canonical JSON
function sortKeys(val) {
    if (val === null || typeof val !== 'object')
        return val;
    if (Array.isArray(val))
        return val.map(sortKeys);
    const sorted = {};
    for (const key of Object.keys(val).sort()) {
        sorted[key] = sortKeys(val[key]);
    }
    return sorted;
}
// Canonical JSON stringify
function hashCanonicalJSON(obj) {
    const jsonStr = JSON.stringify(sortKeys(obj));
    return crypto_1.default.createHash('sha256').update(jsonStr).digest('hex');
}
// Generate the headers with HMAC signature
function generateHeaders(bodyStr) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto_1.default.randomBytes(16).toString('hex');
    const message = timestamp + nonce + bodyStr;
    const signature = crypto_1.default.createHmac('sha256', APP_SECRET).update(message).digest('hex');
    return {
        'Content-Type': 'application/json',
        'X-App-Key': APP_KEY,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature
    };
}
async function createOrder(amount, userAddress) {
    const orderId = `ORDER-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
    const paymentReqId = `PAY-REQ-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
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
    const token = jsonwebtoken_1.default.sign(jwtPayload, privateKey, { algorithm: 'ES256K' });
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
        }
        else {
            console.error("HashKey API Error:", data);
            throw new Error(data.msg || "Failed to create order");
        }
    }
    catch (e) {
        console.error("Failed to connect to HashKey API, returning mock URL", e.message);
        return { payment_url: `https://pay.hashkey.com/mock/${orderId}`, payment_request_id: paymentReqId, order_id: orderId };
    }
}
async function createReusableOrder(amount, userAddress) {
    const orderId = `REUSABLE-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
    const paymentReqId = `PAY-REQ-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
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
    const token = jsonwebtoken_1.default.sign(jwtPayload, privateKey, { algorithm: 'ES256K' });
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
        }
        else {
            console.error("HashKey API Error:", data);
            throw new Error(data.msg || "Failed to create reusable order");
        }
    }
    catch (e) {
        console.error("Failed to connect to HashKey API, returning mock URL", e.message);
        return { payment_url: `https://pay.hashkey.com/mock/reusable/${orderId}`, payment_request_id: paymentReqId, order_id: orderId };
    }
}
async function triggerReusablePayment(mandateId, amount) {
    const orderId = `DCA-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
    const paymentReqId = `PAY-REQ-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
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
        }
        else {
            console.error("HashKey API Error (Charge):", data);
            throw new Error(data.msg || "Failed to trigger reusable payment");
        }
    }
    catch (e) {
        console.error(`Failed to connect to HashKey API to charge mandate ${mandateId}, simulating success`, e.message);
        return { status: "simulated", payment_request_id: paymentReqId };
    }
}
//# sourceMappingURL=merchantClient.js.map