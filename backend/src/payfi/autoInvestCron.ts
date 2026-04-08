import cron from 'node-cron';
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';
import { triggerReusablePayment } from './merchantClient'; // Need to add this to merchantClient

dotenv.config();

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data/rwa_hub.db');
const db = new Database(dbPath);

export function runAutoInvest() {
    console.log("Running weekly Auto-Invest (DCA) Cron Job...");
    
    try {
        const stmt = db.prepare('SELECT mandate_id, user_address, amount FROM payfi_mandates WHERE active = 1');
        const mandates = stmt.all() as { mandate_id: string, user_address: string, amount: string }[];
        
        for (const mandate of mandates) {
            console.log(`Triggering payment for mandate ${mandate.mandate_id}, user ${mandate.user_address}, amount ${mandate.amount}`);
            
            // Note: triggerReusablePayment must be implemented in merchantClient.ts 
            // to call HashKey API to charge against an existing mandate.
            // It will emit a webhook on success, which handles the minting.
            triggerReusablePayment(mandate.mandate_id, mandate.amount).catch(err => {
                console.error(`Failed to trigger mandate ${mandate.mandate_id}:`, err.message);
            });
        }
        
        console.log(`Auto-Invest cycle complete. Processed ${mandates.length} mandates.`);
    } catch (err: any) {
        console.error("Error in auto-invest cron:", err.message);
    }
}

// In production, this would be `0 0 * * 0` (every Sunday)
export function startAutoInvestCron() {
    // For demo purposes, we can run it every 5 minutes to show it working
    cron.schedule('*/5 * * * *', runAutoInvest);
    console.log("Auto-Invest Cron Job scheduled.");
}
