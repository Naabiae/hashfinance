"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAutoInvest = runAutoInvest;
exports.startAutoInvestCron = startAutoInvestCron;
const node_cron_1 = __importDefault(require("node-cron"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const merchantClient_1 = require("./merchantClient"); // Need to add this to merchantClient
dotenv_1.default.config();
const dbPath = process.env.DB_PATH || path_1.default.join(__dirname, '../../data/rwa_hub.db');
const db = new better_sqlite3_1.default(dbPath);
function runAutoInvest() {
    console.log("Running weekly Auto-Invest (DCA) Cron Job...");
    try {
        const stmt = db.prepare('SELECT mandate_id, user_address, amount FROM payfi_mandates WHERE active = 1');
        const mandates = stmt.all();
        for (const mandate of mandates) {
            console.log(`Triggering payment for mandate ${mandate.mandate_id}, user ${mandate.user_address}, amount ${mandate.amount}`);
            // Note: triggerReusablePayment must be implemented in merchantClient.ts 
            // to call HashKey API to charge against an existing mandate.
            // It will emit a webhook on success, which handles the minting.
            (0, merchantClient_1.triggerReusablePayment)(mandate.mandate_id, mandate.amount).catch(err => {
                console.error(`Failed to trigger mandate ${mandate.mandate_id}:`, err.message);
            });
        }
        console.log(`Auto-Invest cycle complete. Processed ${mandates.length} mandates.`);
    }
    catch (err) {
        console.error("Error in auto-invest cron:", err.message);
    }
}
// In production, this would be `0 0 * * 0` (every Sunday)
function startAutoInvestCron() {
    // For demo purposes, we can run it every 5 minutes to show it working
    node_cron_1.default.schedule('*/5 * * * *', runAutoInvest);
    console.log("Auto-Invest Cron Job scheduled.");
}
//# sourceMappingURL=autoInvestCron.js.map