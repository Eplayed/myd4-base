#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { outputDir } = require('../crawlers/config');

const REQUIRED_FILES = [
  'index.json',
  'sources.json',
  'units.json',
  'artifacts.json',
  'spells.json',
  'heroes.json',
  'skills.json',
  'classes.json',
  'factions.json',
  'resources.json',
  'upgrade_paths.json',
  'abilities.json',
  'search_index.json',
  'unit_rankings.json',
  'upgrade_comparisons.json',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf8'));
}

function main() {
  const errors = [];

  for (const file of REQUIRED_FILES) {
    const filePath = path.join(outputDir, file);
    if (!fs.existsSync(filePath)) errors.push(`Missing ${file}`);
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  const index = readJson('index.json');
  if (!Array.isArray(index.files) || index.files.length === 0) {
    errors.push('index.files is empty');
  }

  const allRowsByFile = {};
  for (const item of index.files || []) {
    const rows = readJson(item.file);
    const list = Array.isArray(rows)
      ? rows
      : rows && Array.isArray(rows.groups)
        ? rows.groups
        : rows && Array.isArray(rows.items)
          ? rows.items
          : null;
    if (!list) errors.push(`${item.file} does not contain an array`);
    if (list && list.length !== item.count) {
      errors.push(`${item.file} count mismatch: index=${item.count} actual=${list.length}`);
    }
    allRowsByFile[item.file] = list || [];
    const ids = new Set();
    for (const row of list || []) {
      if (item.file === 'upgrade_paths.json') {
        if (!row.id || !row.baseUnitId || !Array.isArray(row.upgradeIds)) errors.push(`${item.file}: invalid upgrade group`);
        continue;
      }
      if (item.file === 'unit_rankings.json') {
        if (!row.id || !row.metric || !Array.isArray(row.rows)) errors.push(`${item.file}: invalid ranking group`);
        continue;
      }
      if (item.file === 'upgrade_comparisons.json') {
        if (!row.id || !row.baseUnitId || !Array.isArray(row.upgrades)) errors.push(`${item.file}: invalid comparison group`);
        continue;
      }
      if (!row.id || !row.name || !row.type) errors.push(`${item.file}: invalid row`);
      if (ids.has(row.id)) errors.push(`${item.file}: duplicate id ${row.id}`);
      ids.add(row.id);
    }
  }

  const units = allRowsByFile['units.json'] || [];
  const unitIds = new Set(units.map(unit => unit.id));
  const abilities = allRowsByFile['abilities.json'] || [];
  const abilityIds = new Set(abilities.map(ability => ability.id));
  const upgradePaths = allRowsByFile['upgrade_paths.json'] || [];
  for (const group of upgradePaths) {
    if (!unitIds.has(group.baseUnitId)) errors.push(`upgrade_paths: missing base unit ${group.baseUnitId}`);
    for (const id of group.upgradeIds || []) {
      if (!unitIds.has(id)) errors.push(`upgrade_paths: missing upgrade unit ${id}`);
    }
    if ((group.upgradeIds || []).length !== 2 && group.confidence === 'high') {
      errors.push(`upgrade_paths: high confidence group must have 2 upgrades (${group.id})`);
    }
  }

  for (const unit of units) {
    const detailed = unit.derived && Array.isArray(unit.derived.abilitiesDetailed) ? unit.derived.abilitiesDetailed : [];
    for (const ability of detailed) {
      if (!abilityIds.has(ability.id)) errors.push(`units: missing ability ref ${ability.id} from ${unit.id}`);
      if (!ability.icon || !ability.description) errors.push(`units: incomplete ability ${ability.id} from ${unit.id}`);
    }
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }

  console.log(`Output OK: ${outputDir}`);
}

main();
