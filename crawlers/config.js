const path = require('path');

const ROOT = path.join(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';
const envName = isProd ? 'release' : 'dev';

module.exports = {
  ROOT,
  isProd,
  envName,
  outputDir: path.join(ROOT, 'translated-data', envName),
  baseDataDir: path.join(ROOT, 'base-data'),
};
