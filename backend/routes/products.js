const router = require('express').Router();
const auth = require('../middleware/auth');
const { query } = require('../db');

// GET /api/products?page=1&limit=50&active=true
router.get('/', auth, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(200, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;
  const onlyActive = req.query.active === 'true';

  const where = onlyActive
    ? 'WHERE shop_id = $1 AND is_active = true'
    : 'WHERE shop_id = $1';

  const [rows, count] = await Promise.all([
    query(`SELECT * FROM products ${where} ORDER BY name LIMIT $2 OFFSET $3`, [req.shop.shopId, limit, offset]),
    query(`SELECT COUNT(*) FROM products ${where}`, [req.shop.shopId]),
  ]);
  res.json({ products: rows.rows, total: parseInt(count.rows[0].count), page, limit });
});

// GET /api/products/search?q=
router.get('/search', auth, async (req, res) => {
  const { q } = req.query;
  const result = await query(
    `SELECT * FROM products WHERE shop_id = $1 AND is_active = true
     AND (name ILIKE $2 OR category ILIKE $2)
     ORDER BY name LIMIT 20`,
    [req.shop.shopId, `%${q || ''}%`]
  );
  res.json(result.rows);
});

// GET /api/products/barcode/:code
router.get('/barcode/:code', auth, async (req, res) => {
  const result = await query(
    'SELECT * FROM products WHERE shop_id = $1 AND barcode = $2 AND is_active = true',
    [req.shop.shopId, req.params.code]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
});

// POST /api/products
router.post('/', auth, async (req, res) => {
  const { name, category, barcode, mrp, sellingPrice, costPrice, gstRate, stockQty, minStockAlert, imageUrl } = req.body;
  if (!name || !mrp || !sellingPrice) return res.status(400).json({ error: 'Name, MRP, and selling price are required' });

  const result = await query(
    `INSERT INTO products (shop_id, name, category, barcode, mrp, selling_price, cost_price, gst_rate, stock_qty, min_stock_alert, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.shop.shopId, name, category || 'other', barcode || null, mrp, sellingPrice, costPrice || 0, gstRate || 0, stockQty || 0, minStockAlert || 5, imageUrl || null]
  );
  res.status(201).json(result.rows[0]);
});

// PUT /api/products/:id
router.put('/:id', auth, async (req, res) => {
  const { name, category, barcode, mrp, sellingPrice, costPrice, gstRate, stockQty, minStockAlert, imageUrl, isActive } = req.body;
  const result = await query(
    `UPDATE products SET
       name=$1, category=$2, barcode=$3, mrp=$4, selling_price=$5, cost_price=$6,
       gst_rate=$7, stock_qty=$8, min_stock_alert=$9, image_url=$10, is_active=$11, updated_at=NOW()
     WHERE id=$12 AND shop_id=$13 RETURNING *`,
    [name, category, barcode, mrp, sellingPrice, costPrice, gstRate, stockQty, minStockAlert, imageUrl, isActive ?? true, req.params.id, req.shop.shopId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
  res.json(result.rows[0]);
});

// DELETE /api/products/:id
router.delete('/:id', auth, async (req, res) => {
  await query('DELETE FROM products WHERE id = $1 AND shop_id = $2', [req.params.id, req.shop.shopId]);
  res.json({ message: 'Product deleted' });
});

module.exports = router;
