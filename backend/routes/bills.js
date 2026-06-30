const router = require('express').Router();
const auth = require('../middleware/auth');
const { query, pool } = require('../db');

// Generate bill number: BILL-YYYY-NNNNN
// Uses an atomic INSERT ... ON CONFLICT DO UPDATE so two PM2 workers racing to
// create a bill at the same millisecond always get different sequence numbers.
// COUNT(*)+1 was NOT safe under cluster mode — this is.
async function generateBillNumber(shopId) {
  const year = new Date().getFullYear();
  const result = await query(
    `INSERT INTO bill_sequences (shop_id, seq_type, year, last_seq)
     VALUES ($1, 'bill', $2, 1)
     ON CONFLICT (shop_id, seq_type, year)
     DO UPDATE SET last_seq = bill_sequences.last_seq + 1
     RETURNING last_seq`,
    [shopId, year]
  );
  return `BILL-${year}-${String(result.rows[0].last_seq).padStart(5, '0')}`;
}

// GET /api/bills — paginated list
router.get('/', auth, async (req, res) => {
  const { page = 1, limit = 20, search, payment, from, to } = req.query;
  const offset = (page - 1) * limit;
  const params = [req.shop.shopId];
  let where = 'WHERE b.shop_id = $1';
  let idx = 2;
  if (search) { where += ` AND (b.customer_name ILIKE $${idx} OR b.bill_number ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
  if (payment) { where += ` AND b.payment_mode = $${idx}`; params.push(payment); idx++; }
  if (from) { where += ` AND b.created_at >= $${idx}`; params.push(from); idx++; }
  if (to) { where += ` AND b.created_at <= $${idx}`; params.push(to); idx++; }

  const [billsResult, countResult] = await Promise.all([
    query(`SELECT b.*, (SELECT json_agg(bi.*) FROM bill_items bi WHERE bi.bill_id = b.id) as items
           FROM bills b ${where} ORDER BY b.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
          [...params, limit, offset]),
    query(`SELECT COUNT(*) FROM bills b ${where}`, params),
  ]);
  res.json({ bills: billsResult.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/bills/:id
router.get('/:id', auth, async (req, res) => {
  const result = await query(
    `SELECT b.*, (SELECT json_agg(bi.*) FROM bill_items bi WHERE bi.bill_id = b.id) as items
     FROM bills b WHERE b.id = $1 AND b.shop_id = $2`,
    [req.params.id, req.shop.shopId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Bill not found' });
  res.json(result.rows[0]);
});

// POST /api/bills — create bill, reduce stock, generate PDF
router.post('/', auth, async (req, res) => {
  const { customerName, customerPhone, items, subtotal, discountAmount, taxAmount, total, paymentMode, couponCode } = req.body;
  if (!customerName || !items?.length || !total) return res.status(400).json({ error: 'Missing required bill data' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billNumber = await generateBillNumber(req.shop.shopId);

    // Upsert customer
    let customerId = null;
    if (customerName) {
      const custResult = await client.query(
        `INSERT INTO customers (shop_id, name, phone) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING RETURNING id`,
        [req.shop.shopId, customerName, customerPhone || null]
      );
      customerId = custResult.rows[0]?.id || null;
    }

    // Create bill
    const billResult = await client.query(
      `INSERT INTO bills (bill_number, shop_id, customer_id, customer_name, customer_phone, subtotal, discount_amount, tax_amount, total, payment_mode, coupon_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [billNumber, req.shop.shopId, customerId, customerName, customerPhone || null, subtotal, discountAmount || 0, taxAmount || 0, total, paymentMode, couponCode || null]
    );
    const bill = billResult.rows[0];

    // Insert items + reduce stock
    for (const item of items) {
      await client.query(
        `INSERT INTO bill_items (bill_id, product_id, product_name, quantity, mrp, selling_price, discount_amount, gst_rate, item_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [bill.id, item.productId || null, item.productName, item.qty, item.mrp, item.sellingPrice, (item.mrp - item.sellingPrice) * item.qty, item.gstRate || 0, item.itemTotal]
      );
      if (item.productId) {
        await client.query(
          'UPDATE products SET stock_qty = GREATEST(stock_qty - $1, 0) WHERE id = $2 AND shop_id = $3',
          [item.qty, item.productId, req.shop.shopId]
        );
      }
    }

    // Update coupon usage
    if (couponCode) {
      await client.query(
        'UPDATE coupons SET times_used = times_used + 1 WHERE shop_id = $1 AND code = $2',
        [req.shop.shopId, couponCode]
      );
    }

    await client.query('COMMIT');

    // Fetch full bill with items
    const fullBill = await query(
      `SELECT b.*, (SELECT json_agg(bi.*) FROM bill_items bi WHERE bi.bill_id = b.id) as items
       FROM bills b WHERE b.id = $1`,
      [bill.id]
    );
    res.status(201).json(fullBill.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bill creation failed:', err);
    res.status(500).json({ error: 'Failed to create bill' });
  } finally {
    client.release();
  }
});

module.exports = router;
