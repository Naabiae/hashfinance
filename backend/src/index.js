"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const merchantClient_1 = require("./payfi/merchantClient");
const webhookHandler_1 = require("./payfi/webhookHandler");
const autoInvestCron_1 = require("./payfi/autoInvestCron");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
// Need raw body for HMAC verification
app.use(body_parser_1.default.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'rwa-hub-backend' });
});
app.post('/api/payfi/checkout', async (req, res) => {
    try {
        const { amount, userAddress } = req.body;
        if (!amount || !userAddress) {
            return res.status(400).json({ error: "Missing amount or userAddress" });
        }
        const orderInfo = await (0, merchantClient_1.createOrder)(amount, userAddress);
        res.json({ success: true, ...orderInfo });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/payfi/reusable', async (req, res) => {
    try {
        const { amount, userAddress } = req.body;
        if (!amount || !userAddress) {
            return res.status(400).json({ error: "Missing amount or userAddress" });
        }
        const orderInfo = await (0, merchantClient_1.createReusableOrder)(amount, userAddress);
        res.json({ success: true, ...orderInfo });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/webhooks/hashkey', async (req, res) => {
    try {
        // 1. Verify Signature
        (0, webhookHandler_1.verifyHMAC)(req);
        // 2. Process Event
        const paymentData = req.body;
        if (paymentData.event_type === 'payment') {
            await (0, webhookHandler_1.handlePaymentSuccess)(paymentData);
        }
        // 3. Return 200 quickly per docs
        res.status(200).json({ code: 0 });
    }
    catch (error) {
        console.error("Webhook Error:", error.message);
        // Still return 200 sometimes or 400 depending on the exact requirement, 
        // returning 400 for signature mismatch
        res.status(400).json({ code: 1, msg: error.message });
    }
});
app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
    // Start Cron Jobs
    (0, autoInvestCron_1.startAutoInvestCron)();
});
//# sourceMappingURL=index.js.map