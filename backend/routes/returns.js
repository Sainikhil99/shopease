const router = require('express').Router();
const auth   = require('../middleware/auth');
const { query, pool } = require('../db');

// GET /api/returns?page=1&limit=20
router.get('/', auth, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const [rows, count] = await Promise.all([
    query(
      `SELECT r.*,
         (SELECT json_agg(ri.*) FROM return_items ri WHERE ri.return_id = r.id) as items
       FROM returns r
       WHERE r.shop_id = $1
       ORDER BY r.returned_at DESC
       LIMIT $2 OFFSET $3`,
      [req.shop.shopId, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM returns WHERE shop_id = $1`, [req.shop.shopId]),
  ]);
  res.json({ returns: rows.rows, total: parseInt(count.rows[0].count), page, limit });
});

// POST /api/returns — process a return, restore stock, mark bill refunded
router.post('/', auth, async (req, res) => {
  const { originalBillId, originalBillNumber, customerName, customerPhone, items, refundAmount, reason } = req.body;
  if (!customerName || !items?.length || !refundAmount) {
    return res.status(400).json({ error: 'customerName, items, and refundAmount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-generate return number: RET-YYYY-NNNNN (atomic, same pattern as bills)
    const year = new Date().getFullYear();
    const seqRes = await client.query(
      `INSERT INTO bill_sequences (shop_id, seq_type, year, last_seq)
       VALUES ($1, 'return', $2, 1)
       ON CONFLICT (shop_id, seq_type, year)
       DO UPDATE SET last_seq = bill_sequences.last_seq + 1
       RETURNING last_seq`,
      [req.shop.shopId, year]   // seq_type='return' keeps returns separate from bills
    );
    const returnNumber = `RET-${year}-${String(seqRes.rows[0].last_seq).padStart(5, '0')}`;

    // Insert return header
    const retRes = await client.query(
      `INSERT INTO returns
         (return_number, shop_id, original_bill_id, original_bill_number,
          customer_name, customer_phone, refund_amount, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [returnNumber, req.shop.shopId, originalBillId || null, originalBillNumber || null,
       customerName, customerPhone || null, refundAmount, reason || null]
    );
    const ret = retRes.rows[0];

    // Insert return items and restore stock
    for (const item of items) {
      await client.query(
        `INSERT INTO return_items
           (return_id, product_id, product_name, return_qty, selling_price, cost_price)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ret.id, item.productId || null, item.productName, item.returnQty,
         item.sellingPrice || 0, item.costPrice || 0]
      );
      if (item.productId) {
        await client.query(
          `UPDATE products
           SET stock_qty = stock_qty + $1
           WHERE id = $2 AND shop_id = $3`,
          [item.returnQty, item.productId, req.shop.shopId]
        );
      }
    }

    // Mark original bill as having a return
    if (originalBillId) {
      await client.query(
        `UPDATE bills
         SET status = 'refunded',
             returned_amount = COALESCE(returned_amount, 0) + $1
         WHERE id = $2 AND shop_id = $3`,
        [refundAmount, originalBillId, req.shop.shopId]
      );
    }

    await client.query('COMMIT');

    const full = await query(
      `SELECT r.*, (SELECT json_agg(ri.*) FROM return_items ri WHERE ri.return_id = r.id) as items
       FROM returns r WHERE r.id = $1`,
      [ret.id]
    );
    res.status(201).json(full.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Return failed:', err);
    res.status(500).json({ error: 'Failed to process return' });
  } finally {
    client.release();
  }
});

module.exports = router;
