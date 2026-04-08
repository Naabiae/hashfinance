"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyHMAC = verifyHMAC;
exports.handlePaymentSuccess = handlePaymentSuccess;
const crypto_1 = __importDefault(require("crypto"));
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
// Assume RWAPool ABI is imported
// import RWAPoolABI from '../../contracts/abis/RWAPool.json';
dotenv_1.default.config();
const APP_SECRET = process.env.HASHKEY_APP_SECRET || 'sk_test_456';
const RPC_URL = process.env.RPC_URL || 'https://hk-testnet.rpc.alt.technology';
const GATEWAY_KEEPER_PRIVATE_KEY = process.env.GATEWAY_KEEPER_PRIVATE_KEY || '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const RWA_POOL_ADDRESS = process.env.RWA_POOL_ADDRESS || '0x...';
// The ABI for RWAPool.mintFromGateway
const poolAbi = [
    "function mintFromGateway(address lp, uint256 stableAmount) external"
];
// Helper to verify HashKey Webhook Signature
function verifyHMAC(req) {
    const sigHeader = req.headers['x-signature'];
    if (!sigHeader)
        throw new Error("Missing X-Signature header");
    let ts = 0;
    let receivedV1 = '';
    sigHeader.split(',').forEach(part => {
        if (part.startsWith('t='))
            ts = parseInt(part.substring(2), 10);
        else if (part.startsWith('v1='))
            receivedV1 = part.substring(3);
    });
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
        throw new Error("Timestamp out of tolerance");
    }
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const message = `${ts}.${rawBody}`;
    const expected = crypto_1.default.createHmac('sha256', APP_SECRET).update(message).digest('hex');
    if (expected !== receivedV1) {
        throw new Error("Signature mismatch");
    }
    return true;
}
async function handlePaymentSuccess(paymentData) {
    if (paymentData.status !== 'payment-successful' && paymentData.status !== 'payment-included') {
        console.log(`Payment status is ${paymentData.status}, ignoring...`);
        return;
    }
    const payerAddress = paymentData.payer_address;
    const amountStr = paymentData.amount; // In smallest units
    const amount = BigInt(amountStr);
    console.log(`Processing successful payment for ${payerAddress}, amount: ${amount.toString()}`);
    try {
        const provider = new ethers_1.ethers.JsonRpcProvider(RPC_URL);
        const keeperWallet = new ethers_1.ethers.Wallet(GATEWAY_KEEPER_PRIVATE_KEY, provider);
        const poolContract = new ethers_1.ethers.Contract(RWA_POOL_ADDRESS, poolAbi, keeperWallet);
        console.log(`Calling mintFromGateway(${payerAddress}, ${amount.toString()})`);
        // Execute the transaction
        // NOTE: In production, we'd want to handle gas limits and retries
        const tx = await poolContract.mintFromGateway(payerAddress, amount);
        console.log(`Transaction submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    }
    catch (error) {
        console.error("Failed to execute mintFromGateway:", error.message);
        throw error;
    }
}
//# sourceMappingURL=webhookHandler.js.map