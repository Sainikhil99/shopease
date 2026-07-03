const router = require('express').Router();
const auth   = require('../middleware/auth');
const { query } = require('../db');

const VALID_CATEGORIES = ['rent', 'electricity', 'staff', 'purchase', 'transport', 'other'];

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', auth, async (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM expenses WHERE shop_id = $1';
  const params = [req.shop.shopId];
  if (from) { params.push(from); sql += ` AND expense_date >= $${params.length}`; }
  if (to)   { params.push(to);   sql += ` AND expense_date <= $${params.length}`; }
  sql += ' ORDER BY expense_date DESC, created_at DESC LIMIT 500';
  try {
    const result = await query(sql, params);
    res.json({ expenses: result.rows });
  } catch (err) {
    console.error('[Expenses] GET error:', err.message);
    res.status(500).json({ error: 'Could not fetch expenses' });
  }
});

// POST /api/expenses
router.post('/', auth, async (req, res) => {
  const { category = 'other', amount, note, expenseDate } = req.body;
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  const cat = VALID_CATEGORIES.includes(category) ? category : 'other';
  try {
    const result = await query(
      `INSERT INTO expenses (shop_id, category, amount, note, expense_date)
       VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE)) RETURNING *`,
      [req.shop.shopId, cat, parseFloat(amount), note || null, expenseDate || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Expenses] POST error:', err.message);
    res.status(500).json({ error: 'Could not save expense' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM expenses WHERE id = $1 AND shop_id = $2 RETURNING id',
      [req.params.id, req.shop.shopId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Expense not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[Expenses] DELETE error:', err.message);
    res.status(500).json({ error: 'Could not delete expense' });
  }
});

module.exports = router;
