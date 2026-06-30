const router = require('express').Router();
const auth = require('../middleware/auth');
const { query } = require('../db');
const { reportLimiter } = require('../middleware/rateLimiter');

// GET /api/dashboard
router.get('/dashboard', auth, reportLimiter, async (req, res) => {
  const shopId = req.shop.shopId;
  const today = new Date().toISOString().split('T')[0];

  const [salesResult, profitResult, billCountResult, lowStockResult] = await Promise.all([
    query(`SELECT COALESCE(SUM(total),0) as total_sales, COALESCE(SUM(discount_amount),0) as total_discounts
           FROM bills WHERE shop_id=$1 AND DATE(created_at)=$2 AND status='completed'`, [shopId, today]),
    query(`SELECT COALESCE(SUM((bi.selling_price - p.cost_price) * bi.quantity),0) as profit
           FROM bill_items bi JOIN bills b ON bi.bill_id=b.id JOIN products p ON bi.product_id=p.id
           WHERE b.shop_id=$1 AND DATE(b.created_at)=$2`, [shopId, today]),
    query(`SELECT COUNT(*) as count FROM bills WHERE shop_id=$1 AND DATE(created_at)=$2`, [shopId, today]),
    query(`SELECT * FROM products WHERE shop_id=$1 AND stock_qty <= min_stock_alert AND is_active=true`, [shopId]),
  ]);

  res.json({
    todaysSales: parseFloat(salesResult.rows[0].total_sales),
    todaysProfit: parseFloat(profitResult.rows[0].profit),
    todaysBillCount: parseInt(billCountResult.rows[0].count),
    todaysDiscounts: parseFloat(salesResult.rows[0].total_discounts),
    lowStockProducts: lowStockResult.rows,
  });
});

// GET /api/reports/daily?date=
router.get('/daily', auth, reportLimiter, async (req, res) => {
  const { date } = req.query;
  const d = date || new Date().toISOString().split('T')[0];
  const shopId = req.shop.shopId;

  const [summary, paymentBreakdown, itemsSold, lowStock] = await Promise.all([
    query(`SELECT COALESCE(SUM(total),0) as revenue, COALESCE(SUM(discount_amount),0) as discounts,
                  COALESCE(SUM(tax_amount),0) as gst, COUNT(*) as bill_count
           FROM bills WHERE shop_id=$1 AND DATE(created_at)=$2 AND status='completed'`, [shopId, d]),
    query(`SELECT payment_mode, SUM(total) as amount, COUNT(*) as count
           FROM bills WHERE shop_id=$1 AND DATE(created_at)=$2 GROUP BY payment_mode`, [shopId, d]),
    query(`SELECT bi.product_name, SUM(bi.quantity) as qty, SUM(bi.item_total) as revenue
           FROM bill_items bi JOIN bills b ON bi.bill_id=b.id
           WHERE b.shop_id=$1 AND DATE(b.created_at)=$2 GROUP BY bi.product_name ORDER BY qty DESC`, [shopId, d]),
    query(`SELECT name, stock_qty, min_stock_alert FROM products WHERE shop_id=$1 AND stock_qty<=min_stock_alert AND is_active=true`, [shopId]),
  ]);

  const profitResult = await query(
    `SELECT COALESCE(SUM((bi.selling_price - p.cost_price) * bi.quantity),0) as profit
     FROM bill_items bi JOIN bills b ON bi.bill_id=b.id JOIN products p ON bi.product_id=p.id
     WHERE b.shop_id=$1 AND DATE(b.created_at)=$2`, [shopId, d]
  );

  res.json({
    date: d, ...summary.rows[0],
    profit: parseFloat(profitResult.rows[0].profit),
    paymentBreakdown: paymentBreakdown.rows,
    itemsSold: itemsSold.rows,
    lowStock: lowStock.rows,
  });
});

// GET /api/reports/monthly?month=YYYY-MM
router.get('/monthly', auth, reportLimiter, async (req, res) => {
  const { month } = req.query;
  const m = month || new Date().toISOString().slice(0, 7);
  const [year, mo] = m.split('-').map(Number);
  const shopId = req.shop.shopId;

  const [summary, topProducts, paymentBreakdown, weeklyBreakdown] = await Promise.all([
    query(`SELECT COALESCE(SUM(total),0) as revenue, COALESCE(SUM(discount_amount),0) as discounts,
                  COALESCE(SUM(tax_amount),0) as gst, COUNT(*) as bill_count, AVG(total) as avg_bill
           FROM bills WHERE shop_id=$1 AND EXTRACT(YEAR FROM created_at)=$2 AND EXTRACT(MONTH FROM created_at)=$3 AND status='completed'`,
          [shopId, year, mo]),
    query(`SELECT bi.product_name, SUM(bi.quantity) as qty, SUM(bi.item_total) as revenue
           FROM bill_items bi JOIN bills b ON bi.bill_id=b.id
           WHERE b.shop_id=$1 AND EXTRACT(YEAR FROM b.created_at)=$2 AND EXTRACT(MONTH FROM b.created_at)=$3
           GROUP BY bi.product_name ORDER BY qty DESC LIMIT 5`, [shopId, year, mo]),
    query(`SELECT payment_mode, SUM(total) as amount, COUNT(*) as count
           FROM bills WHERE shop_id=$1 AND EXTRACT(YEAR FROM created_at)=$2 AND EXTRACT(MONTH FROM created_at)=$3
           GROUP BY payment_mode`, [shopId, year, mo]),
    query(`SELECT DATE_TRUNC('week', created_at) as week, SUM(total) as revenue, COUNT(*) as bills
           FROM bills WHERE shop_id=$1 AND EXTRACT(YEAR FROM created_at)=$2 AND EXTRACT(MONTH FROM created_at)=$3
           GROUP BY week ORDER BY week`, [shopId, year, mo]),
  ]);

  const profitResult = await query(
    `SELECT COALESCE(SUM((bi.selling_price - p.cost_price) * bi.quantity),0) as profit
     FROM bill_items bi JOIN bills b ON bi.bill_id=b.id JOIN products p ON bi.product_id=p.id
     WHERE b.shop_id=$1 AND EXTRACT(YEAR FROM b.created_at)=$2 AND EXTRACT(MONTH FROM b.created_at)=$3`,
    [shopId, year, mo]
  );

  res.json({
    month: m, ...summary.rows[0],
    profit: parseFloat(profitResult.rows[0].profit),
    topProducts: topProducts.rows,
    paymentBreakdown: paymentBreakdown.rows,
    weeklyBreakdown: weeklyBreakdown.rows,
  });
});

// POST /api/reports/send-daily  (manual trigger for testing)
router.post('/send-daily', auth, async (req, res) => {
  const { sendDailyReport } = require('../services/emailService');
  try {
    await sendDailyReport(req.shop.shopId);
    res.json({ message: 'Daily report sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send report', details: err.message });
  }
});

// POST /api/reports/send-monthly
router.post('/send-monthly', auth, async (req, res) => {
  const { sendMonthlyReport } = require('../services/emailService');
  try {
    await sendMonthlyReport(req.shop.shopId);
    res.json({ message: 'Monthly report sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send report', details: err.message });
  }
});

module.exports = router;
