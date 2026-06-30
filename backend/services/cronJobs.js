const cron = require('node-cron');
const { query } = require('../db');
const { sendDailyReport, sendMonthlyReport } = require('./emailService');
const { checkAndAlert } = require('./usageAlert');

function startCronJobs() {
  // Daily report: runs at 9:00 PM IST every day (3:30 PM UTC)
  // Note: each shop has its own daily_time — this job checks all shops
  cron.schedule('0 21 * * *', async () => {
    console.log('[CRON] Running daily report job...');
    try {
      const shops = await query(`SELECT id FROM shops WHERE daily_report = true AND report_email IS NOT NULL`);
      for (const shop of shops.rows) {
        try {
          await sendDailyReport(shop.id);
          console.log(`[CRON] Daily report sent for shop ${shop.id}`);
        } catch (err) {
          console.error(`[CRON] Daily report failed for shop ${shop.id}:`, err.message);
          await query(
            `INSERT INTO email_logs (shop_id, type, status, retry_count) VALUES ($1,'daily','failed',1)
             ON CONFLICT DO NOTHING`,
            [shop.id]
          );
          // Retry once after 10 minutes
          setTimeout(() => sendDailyReport(shop.id).catch(console.error), 10 * 60 * 1000);
        }
      }
    } catch (err) {
      console.error('[CRON] Daily report job error:', err);
    }
  }, { timezone: 'Asia/Kolkata' });

  // Monthly report: 1st of every month at 8:00 AM IST (2:30 AM UTC)
  cron.schedule('0 8 1 * *', async () => {
    console.log('[CRON] Running monthly report job...');
    try {
      const shops = await query(`SELECT id FROM shops WHERE monthly_report = true AND report_email IS NOT NULL`);
      for (const shop of shops.rows) {
        try {
          await sendMonthlyReport(shop.id);
          console.log(`[CRON] Monthly report sent for shop ${shop.id}`);
        } catch (err) {
          console.error(`[CRON] Monthly report failed for shop ${shop.id}:`, err.message);
          setTimeout(() => sendMonthlyReport(shop.id).catch(console.error), 10 * 60 * 1000);
        }
      }
    } catch (err) {
      console.error('[CRON] Monthly report job error:', err);
    }
  }, { timezone: 'Asia/Kolkata' });

  // Usage alert: every day at 9 AM IST — checks shop count + DB size
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Checking usage alerts...');
    await checkAndAlert();
  }, { timezone: 'Asia/Kolkata' });

  console.log('[CRON] Scheduled: daily reports at 9 PM IST, monthly on 1st at 8 AM IST, usage check at 9 AM IST');
}

module.exports = { startCronJobs };
