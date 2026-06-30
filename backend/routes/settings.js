const router = require('express').Router();
const auth = require('../middleware/auth');
const { query } = require('../db');

// GET /api/settings
router.get('/', auth, async (req, res) => {
  const result = await query(
    `SELECT id, owner_name, shop_name, phone, email, address, gstin, logo_url,
            report_email, daily_report, daily_time, monthly_report, low_stock_limit, pdf_attachment
     FROM shops WHERE id = $1`,
    [req.shop.shopId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
  res.json(result.rows[0]);
});

// PUT /api/settings
router.put('/', auth, async (req, res) => {
  const { ownerName, shopName, address, gstin, reportEmail, dailyReport, dailyTime, monthlyReport, lowStockLimit, pdfAttachment } = req.body;
  const result = await query(
    `UPDATE shops SET
       owner_name=$1, shop_name=$2, address=$3, gstin=$4,
       report_email=$5, daily_report=$6, daily_time=$7, monthly_report=$8,
       low_stock_limit=$9, pdf_attachment=$10
     WHERE id=$11 RETURNING id, owner_name, shop_name, address, gstin, report_email,
       daily_report, daily_time, monthly_report, low_stock_limit, pdf_attachment`,
    [ownerName, shopName, address, gstin, reportEmail, dailyReport, dailyTime, monthlyReport, lowStockLimit || 5, pdfAttachment, req.shop.shopId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Shop not found' });
  res.json(result.rows[0]);
});

module.exports = router;
