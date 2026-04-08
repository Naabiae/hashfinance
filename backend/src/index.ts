import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createOrder, createReusableOrder } from './payfi/merchantClient';
import { verifyHMAC, handlePaymentSuccess } from './payfi/webhookHandler';
import { startAutoInvestCron } from './payfi/autoInvestCron';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Need raw body for HMAC verification
app.use(bodyParser.json({
    verify: (req: any, res, buf) => {
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
        
        const orderInfo = await createOrder(amount, userAddress);
        res.json({ success: true, ...orderInfo });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/payfi/reusable', async (req, res) => {
    try {
        const { amount, userAddress } = req.body;
        if (!amount || !userAddress) {
            return res.status(400).json({ error: "Missing amount or userAddress" });
        }
        
        const orderInfo = await createReusableOrder(amount, userAddress);
        res.json({ success: true, ...orderInfo });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/webhooks/hashkey', async (req, res) => {
    try {
        // 1. Verify Signature
        verifyHMAC(req);
        
        // 2. Process Event
        const paymentData = req.body;
        if (paymentData.event_type === 'payment') {
            await handlePaymentSuccess(paymentData);
        }
        
        // 3. Return 200 quickly per docs
        res.status(200).json({ code: 0 });
    } catch (error: any) {
        console.error("Webhook Error:", error.message);
        // Still return 200 sometimes or 400 depending on the exact requirement, 
        // returning 400 for signature mismatch
        res.status(400).json({ code: 1, msg: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
    
    // Start Cron Jobs
    startAutoInvestCron();
});
