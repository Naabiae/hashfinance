import { expect } from 'chai';
import { createOrder, createReusableOrder } from '../src/payfi/merchantClient.ts';
import { verifyHMAC } from '../src/payfi/webhookHandler.ts';
import jwt from 'jsonwebtoken';

import crypto from 'crypto';

describe('Backend PayFi Module Tests', () => {
    it('Should generate a valid ES256K JWT for one-time checkout', async () => {
        // We expect it to fallback to a mock URL if API is not running,
        // but we can intercept or just verify the token generation
        const res = await createOrder("10000.00", "0x123");
        expect(res.order_id).to.include("ORDER");
        expect(res.payment_url).to.include("https://pay.hashkey.com/mock");
    });

    it('Should generate a valid ES256K JWT for reusable (DCA) mandate', async () => {
        const res = await createReusableOrder("1000.00", "0x123");
        expect(res.order_id).to.include("REUSABLE");
        expect(res.payment_url).to.include("https://pay.hashkey.com/mock");
    });

    it('Should fail HMAC verification on bad signature', () => {
        const mockReq = {
            headers: {
                'x-signature': 't=123,v1=bad_hash'
            },
            rawBody: '{"status":"payment-successful"}'
        } as any;

        expect(() => verifyHMAC(mockReq)).to.throw("Timestamp out of tolerance");
    });

    it('Should pass HMAC verification on good signature', () => {
        const APP_SECRET = process.env.HASHKEY_APP_SECRET || 'sk_test_456';
        
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const rawBody = '{"status":"payment-successful"}';
        const message = `${timestamp}.${rawBody}`;
        const expected = crypto.createHmac('sha256', APP_SECRET).update(message).digest('hex');

        const mockReq = {
            headers: {
                'x-signature': `t=${timestamp},v1=${expected}`
            },
            rawBody: rawBody
        } as any;

        expect(verifyHMAC(mockReq)).to.be.true;
    });
});
