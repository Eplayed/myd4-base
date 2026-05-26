function validateEntries(entries, source) {
  const errors = [];
  const warnings = [];
  const seen = new Set();

  if (!Array.isArray(entries)) {
    errors.push(`${source.key}: entries is not an array`);
    return { errors, warnings };
  }

  entries.forEach((entry, index) => {
    const prefix = `${source.key}[${index}]`;
    if (!entry.id) errors.push(`${prefix}: missing id`);
    if (!entry.name) errors.push(`${prefix}: missing name`);
    if (!entry.type) errors.push(`${prefix}: missing type`);
    if (!entry.source || !entry.source.url) errors.push(`${prefix}: missing source.url`);
    if (!entry.detail || entry.detail.fetched !== true) warnings.push(`${entry.id}: detail not fetched`);
    if (entry.id) {
      if (seen.has(entry.id)) errors.push(`${prefix}: duplicate id ${entry.id}`);
      seen.add(entry.id);
    }
    if (!entry.zhName) warnings.push(`${entry.id}: missing zhName override`);
  });

  return { errors, warnings };
}

function validateIndex(index) {
  const errors = [];
  if (!index || !Array.isArray(index.files)) errors.push('index.files missing');
  if (!index.updatedAt) errors.push('index.updatedAt missing');
  return errors;
}

module.exports = {
  validateEntries,
  validateIndex,
};
