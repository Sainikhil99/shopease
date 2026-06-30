const router = require('express').Router();
const auth = require('../middleware/auth');
const { query } = require('../db');

// GET /api/coupons
router.get('/', auth, async (req, res) => {
  const result = await query('SELECT * FROM coupons WHERE shop_id = $1 ORDER BY created_at DESC', [req.shop.shopId]);
  res.json(result.rows);
});

// POST /api/coupons
router.post('/', auth, async (req, res) => {
  const { code, type, value, minPurchase, expiryDate } = req.body;
  if (!code || !type || !value || !expiryDate) return res.status(400).json({ error: 'Code, type, value, and expiry date are required' });

  const result = await query(
    `INSERT INTO coupons (shop_id, code, type, value, min_purchase, expiry_date)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.shop.shopId, code.toUpperCase(), type, value, minPurchase || 0, expiryDate]
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/coupons/:id
router.put('/:id', auth, async (req, res) => {
  const { code, type, value, minPurchase, expiryDate, isActive } = req.body;
  const result = await query(
    `UPDATE coupons SET code=$1, type=$2, value=$3, min_purchase=$4, expiry_date=$5, is_active=$6
     WHERE id=$7 AND shop_id=$8 RETURNING *`,
    [code?.toUpperCase(), type, value, minPurchase, expiryDate, isActive, req.params.id, req.shop.shopId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Coupon not found' });
  res.json(result.rows[0]);
});

// DELETE /api/coupons/:id
router.delete('/:id', auth, async (req, res) => {
  await query('DELETE FROM coupons WHERE id = $1 AND shop_id = $2', [req.params.id, req.shop.shopId]);
  res.json({ message: 'Coupon deleted' });
});

// POST /api/coupons/validate
router.post('/validate', auth, async (req, res) => {
  const { code, total } = req.body;
  const result = await query(
    `SELECT * FROM coupons WHERE shop_id = $1 AND code = $2 AND is_active = true AND expiry_date >= CURRENT_DATE`,
    [req.shop.shopId, code?.toUpperCase()]
  );
  if (result.rows.length === 0) return res.json({ valid: false, message: 'Invalid or expired coupon code' });

  const coupon = result.rows[0];
  if (coupon.min_purchase && total < coupon.min_purchase) {
    return res.json({ valid: false, message: `Minimum purchase of ₹${coupon.min_purchase} required` });
  }

  let discount = 0;
  if (coupon.type === 'percentage') discount = (total * coupon.value) / 100;
  else if (coupon.type === 'flat' || coupon.type === 'minimum_purchase') discount = coupon.value;
  else if (coupon.type === 'bogo') discount = coupon.value;

  res.json({ valid: true, discount: Math.min(discount, total), coupon });
});

module.exports = router;
