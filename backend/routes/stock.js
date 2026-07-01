const router = require('express').Router();
const auth   = require('../middleware/auth');
const { query } = require('../db');

// GET /api/stock?from=&to=&productId=&limit=2000
router.get('/', auth, async (req, res) => {
  const { from, to, productId } = req.query;
  const limit = Math.min(5000, parseInt(req.query.limit) || 2000);

  const conditions = ['shop_id = $1'];
  const params     = [req.shop.shopId];
  let idx = 2;

  if (from)      { conditions.push(`created_at >= $${idx++}`); params.push(from); }
  if (to)        { conditions.push(`created_at <= $${idx++}`); params.push(to); }
  if (productId) { conditions.push(`product_id = $${idx++}`); params.push(productId); }

  params.push(limit);
  const result = await query(
    `SELECT * FROM stock_ledger WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${idx}`,
    params
  );
  res.json({ entries: result.rows, total: result.rows.length });
});

// POST /api/stock — single ledger entry
router.post('/', auth, async (req, res) => {
  const { productId, type, qty, balanceAfter, supplierName, invoiceNo, billNumber, costPrice, note } = req.body;
  if (!productId || !type || qty == null) {
    return res.status(400).json({ error: 'productId, type, qty are required' });
  }
  const result = await query(
    `INSERT INTO stock_ledger
       (shop_id, product_id, type, qty, balance_after, supplier_name, invoice_no, bill_number, cost_price, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.shop.shopId, productId, type, qty, balanceAfter || 0,
     supplierName || null, invoiceNo || null, billNumber || null, costPrice || 0, note || null]
  );
  res.status(201).json(result.rows[0]);
});

// POST /api/stock/batch — multiple entries in one round-trip (bill sales, returns)
router.post('/batch', auth, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array required' });
  }

  const valuePlaceholders = [];
  const params = [];
  let idx = 1;

  for (const e of entries) {
    valuePlaceholders.push(
      `($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`
    );
    params.push(
      req.shop.shopId, e.productId, e.type, e.qty, e.balanceAfter || 0,
      e.supplierName || null, e.invoiceNo || null, e.billNumber || null,
      e.costPrice || 0, e.note || null
    );
  }

  await query(
    `INSERT INTO stock_ledger
       (shop_id, product_id, type, qty, balance_after, supplier_name, invoice_no, bill_number, cost_price, note)
     VALUES ${valuePlaceholders.join(',')}`,
    params
  );
  res.status(201).json({ inserted: entries.length });
});

module.exports = router;
