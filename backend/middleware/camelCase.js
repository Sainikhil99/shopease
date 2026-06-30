// Transforms all outgoing JSON keys from snake_case to camelCase.
// Applied globally so every route automatically returns camelCase to the frontend.
// e.g. { shop_name, bill_number, created_at } → { shopName, billNumber, createdAt }

const toCamel = s => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function deepCamel(val) {
  if (Array.isArray(val)) return val.map(deepCamel);
  if (val && typeof val === 'object' && !(val instanceof Date)) {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => [toCamel(k), deepCamel(v)])
    );
  }
  return val;
}

module.exports = (req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function (data) { return origJson(deepCamel(data)); };
  next();
};
