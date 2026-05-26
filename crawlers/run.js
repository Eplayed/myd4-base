#!/usr/bin/env node

const { buildOldenEraData } = require('./olden-era');

buildOldenEraData().catch(err => {
  console.error('Data build failed:', err.message);
  process.exit(1);
});
