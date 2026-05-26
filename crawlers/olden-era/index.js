const fs = require('fs');
const path = require('path');
const { outputDir, baseDataDir } = require('../config');
const { SOURCES } = require('./sources');
const { fetchText } = require('./http');
const { parseDetailItem, parseStructuredPage, parseUnitAbilities } = require('./parser');
const { loadOverrides, markDetailError, mergeDetailItem, normalizeItem, slugify } = require('./normalize');
const { attachUpgradeInfo, buildUpgradeGroups } = require('./upgrades');
const { attachUnitMetrics, buildRankings, buildUpgradeComparisons } = require('./metrics');
const { validateEntries, validateIndex } = require('./validate');

const DETAIL_CONCURRENCY = Number(process.env.DETAIL_CONCURRENCY || 8);

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(fileName, data) {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`   wrote ${path.relative(process.cwd(), filePath)}`);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function enrichDetails(entries, checkedAt) {
  if (!entries.length) return entries;
  let done = 0;
  return mapWithConcurrency(entries, DETAIL_CONCURRENCY, async entry => {
    try {
      const html = await fetchText(entry.url, 1);
      const detailItem = parseDetailItem(html);
      const abilityDetails = entry.type === 'unit' ? parseUnitAbilities(html) : [];
      done += 1;
      if (done % 25 === 0 || done === entries.length) {
        console.log(`   details ${done}/${entries.length}`);
      }
      return mergeDetailItem(entry, detailItem, checkedAt, abilityDetails);
    } catch (err) {
      done += 1;
      console.warn(`   detail failed: ${entry.id} ${err.message}`);
      return markDetailError(entry, err);
    }
  });
}

function buildAbilities(units, checkedAt) {
  const map = new Map();
  for (const unit of units) {
    const abilities = unit.derived && Array.isArray(unit.derived.abilitiesDetailed)
      ? unit.derived.abilitiesDetailed
      : [];
    for (const ability of abilities) {
      const existing = map.get(ability.id);
      if (existing) {
        if (!existing.unitIds.includes(unit.id)) existing.unitIds.push(unit.id);
        continue;
      }
      map.set(ability.id, {
        id: ability.id,
        type: 'ability',
        name: ability.name,
        zhName: ability.zhName || '',
        aliases: [],
        icon: ability.icon,
        description: ability.description,
        unitIds: [unit.id],
        source: {
          name: 'olden-era.com',
          url: unit.source.url,
          checkedAt,
          confidence: 'medium',
        },
        schemaVersion: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function idFromUrl(type, url) {
  const tail = String(url || '').split('/').filter(Boolean).pop() || '';
  return `${type}_${slugify(tail)}`;
}

function normalizeAssetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `https://www.olden-era.com${url}`;
  return url;
}

async function buildChineseMaps(checkedAt) {
  const entryMap = {};
  const abilityMapByIcon = {};
  const sourceReports = [];

  for (const source of SOURCES) {
    try {
      const html = await fetchText(source.zhUrl);
      const parsed = parseStructuredPage(html);
      for (const item of parsed.items) {
        const id = idFromUrl(source.type, item.url || item['@id']);
        entryMap[id] = {
          zhName: item.name || '',
          zhDescription: item.description || '',
          zhUrl: item.url || item['@id'] || source.zhUrl,
          checkedAt,
        };
      }
      sourceReports.push({
        key: `${source.key}_zh`,
        name: `${source.name} zh-CN`,
        url: source.zhUrl,
        itemListName: parsed.name,
        expectedCount: parsed.numberOfItems,
        actualCount: parsed.items.length,
        kind: parsed.kind,
        error: parsed.error,
        checkedAt,
        confidence: 'medium',
      });
    } catch (err) {
      sourceReports.push({
        key: `${source.key}_zh`,
        name: `${source.name} zh-CN`,
        url: source.zhUrl,
        itemListName: '',
        expectedCount: 0,
        actualCount: 0,
        kind: 'error',
        error: err.message,
        checkedAt,
        confidence: 'low',
      });
    }
  }

  const unitZhItems = Object.entries(entryMap).filter(([id]) => id.startsWith('unit_'));
  await mapWithConcurrency(unitZhItems, DETAIL_CONCURRENCY, async ([unitId, zh]) => {
    try {
      const html = await fetchText(zh.zhUrl, 1);
      const zhAbilities = parseUnitAbilities(html);
      for (const ability of zhAbilities) {
        const icon = normalizeAssetUrl(ability.icon);
        abilityMapByIcon[icon] = {
          zhName: ability.name || '',
          zhDescription: ability.description || '',
          sourceUnitId: unitId,
          checkedAt,
        };
      }
    } catch (err) {
      // Chinese ability text is helpful but not required for mechanics.
    }
  });

  return { entryMap, abilityMapByIcon, sourceReports };
}

function applyChineseEntry(entry, zhMap) {
  const zh = zhMap[entry.id];
  if (!zh) return entry;
  return {
    ...entry,
    zhName: entry.zhName || zh.zhName || '',
    zhDescription: zh.zhDescription || '',
    aliases: Array.from(new Set([...(entry.aliases || []), zh.zhName].filter(Boolean))),
    source: {
      ...entry.source,
      zhUrl: zh.zhUrl,
    },
  };
}

function applyChineseAbilitiesToUnits(units, abilityMapByIcon) {
  return units.map(unit => {
    const detailed = unit.derived && Array.isArray(unit.derived.abilitiesDetailed)
      ? unit.derived.abilitiesDetailed
      : [];
    if (!detailed.length) return unit;
    const abilitiesDetailed = detailed.map(ability => {
      const zh = abilityMapByIcon[ability.icon];
      if (!zh) return ability;
      return {
        ...ability,
        zhName: ability.zhName || zh.zhName || '',
        zhDescription: zh.zhDescription || '',
      };
    });
    return {
      ...unit,
      derived: {
        ...unit.derived,
        abilitiesDetailed,
      },
    };
  });
}

function applyChineseAbilities(abilities, abilityMapByIcon) {
  return abilities.map(ability => {
    const zh = abilityMapByIcon[ability.icon];
    if (!zh) return ability;
    return {
      ...ability,
      zhName: ability.zhName || zh.zhName || '',
      zhDescription: zh.zhDescription || '',
      aliases: Array.from(new Set([...(ability.aliases || []), zh.zhName].filter(Boolean))),
      source: {
        ...ability.source,
        zhCheckedAt: zh.checkedAt,
      },
    };
  });
}

function flattenProperties(properties) {
  return Object.entries(properties || {})
    .flatMap(([key, value]) => [key, String(value)])
    .filter(Boolean);
}

function buildSearchIndex(datasets, now) {
  const searchableFiles = [
    ['units', 'unit', 'units.json'],
    ['heroes', 'hero', 'heroes.json'],
    ['spells', 'spell', 'spells.json'],
    ['artifacts', 'artifact', 'artifacts.json'],
    ['skills', 'skill', 'skills.json'],
    ['classes', 'class', 'classes.json'],
    ['factions', 'faction', 'factions.json'],
    ['abilities', 'ability', 'abilities.json'],
  ];

  const items = [];
  for (const [key, type, file] of searchableFiles) {
    const rows = datasets[key] || [];
    for (const row of rows) {
      items.push({
        id: row.id,
        type,
        title: row.zhName || row.name,
        name: row.name || '',
        zhName: row.zhName || '',
        subtitle: buildSubtitle(row),
        icon: row.image || row.icon || '',
        sourceFile: file,
        keywords: Array.from(new Set([
          row.id,
          row.name,
          row.zhName,
          row.description,
          row.zhDescription,
          row.summary,
          ...(row.aliases || []),
          ...flattenProperties(row.properties),
        ].filter(Boolean))).join(' ').toLowerCase(),
      });
    }
  }

  return {
    schemaVersion: 1,
    updatedAt: now,
    itemCount: items.length,
    items,
  };
}

function buildSubtitle(row) {
  if (row.type === 'unit') return `${row.properties.faction || ''} T${row.properties.tier || ''}`.trim();
  if (row.type === 'hero') return `${row.properties.faction || ''} ${row.properties.class || ''}`.trim();
  if (row.type === 'spell') return `${row.properties.magic_school || ''} T${row.properties.tier || ''}`.trim();
  if (row.type === 'artifact') return `${row.properties.rarity || ''} ${row.properties.slot || ''}`.trim();
  if (row.type === 'ability') return `${Array.isArray(row.unitIds) ? row.unitIds.length : 0} units`;
  return row.type || '';
}

async function buildOldenEraData() {
  console.log('\n' + '='.repeat(64));
  console.log('  Heroes Olden Era data pipeline');
  console.log('='.repeat(64));
  console.log(`  output: ${outputDir}`);

  const checkedAt = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const overrides = loadOverrides(readJson(path.join(baseDataDir, 'overrides.zh-CN.json'), {}));
  const files = [];
  const sources = [];
  const warnings = [];
  let upgradeGroups = [];
  let abilities = [];
  let unitRankings = null;
  let upgradeComparisons = null;
  const datasets = {};

  console.log('\n[zh-CN] loading Chinese names and ability text');
  const zhMaps = await buildChineseMaps(checkedAt);
  sources.push(...zhMaps.sourceReports);

  for (const source of SOURCES) {
    console.log(`\n[${source.key}] ${source.url}`);
    const html = await fetchText(source.url);
    const parsed = parseStructuredPage(html);
    if (parsed.error) console.warn(`   warning: ${parsed.error}`);
    const listEntries = parsed.items
      .map(item => normalizeItem(item, source, overrides, checkedAt))
      .map(entry => applyChineseEntry(entry, zhMaps.entryMap));
    let entries = source.detail === false ? listEntries : await enrichDetails(listEntries, checkedAt);
    if (source.key === 'units') {
      entries = applyChineseAbilitiesToUnits(entries, zhMaps.abilityMapByIcon);
      entries = attachUnitMetrics(entries);
      const upgradeResult = buildUpgradeGroups(entries);
      upgradeGroups = upgradeResult.groups;
      if (upgradeResult.warnings.length) warnings.push(...upgradeResult.warnings);
      entries = attachUpgradeInfo(entries, upgradeGroups);
      unitRankings = buildRankings(entries, now);
      upgradeComparisons = buildUpgradeComparisons(entries, upgradeGroups, now);
      abilities = applyChineseAbilities(buildAbilities(entries, checkedAt), zhMaps.abilityMapByIcon);
    }
    datasets[source.key === 'artefacts' ? 'artifacts' : source.key] = entries;
    const validation = validateEntries(entries, source);
    if (validation.errors.length) {
      throw new Error(`${source.key} validation failed:\n${validation.errors.join('\n')}`);
    }
    warnings.push(...validation.warnings);
    writeJson(source.file, entries);
    files.push({
      key: source.key,
      type: source.type,
      name: source.name,
      file: source.file,
      count: entries.length,
    });
    sources.push({
      key: source.key,
      name: source.name,
      url: source.url,
      itemListName: parsed.name,
      expectedCount: parsed.numberOfItems,
      actualCount: entries.length,
      kind: parsed.kind,
      error: parsed.error,
      checkedAt,
      confidence: 'medium',
    });
    console.log(`   ${entries.length} entries`);
  }

  const index = {
    game: 'Heroes of Might and Magic: Olden Era',
    schemaVersion: 1,
    updatedAt: now,
    source: 'olden-era.com',
    files: [
      ...files,
      {
        key: 'upgrade_paths',
        type: 'upgrade_path',
        name: 'Upgrade Paths',
        file: 'upgrade_paths.json',
        count: upgradeGroups.length,
      },
      {
        key: 'abilities',
        type: 'ability',
        name: 'Abilities',
        file: 'abilities.json',
        count: abilities.length,
      },
      {
        key: 'search_index',
        type: 'search_index',
        name: 'Search Index',
        file: 'search_index.json',
        count: 0,
      },
      {
        key: 'unit_rankings',
        type: 'unit_ranking',
        name: 'Unit Rankings',
        file: 'unit_rankings.json',
        count: unitRankings ? unitRankings.groups.length : 0,
      },
      {
        key: 'upgrade_comparisons',
        type: 'upgrade_comparison',
        name: 'Upgrade Comparisons',
        file: 'upgrade_comparisons.json',
        count: upgradeComparisons ? upgradeComparisons.groups.length : 0,
      },
    ],
  };
  datasets.abilities = abilities;
  const searchIndex = buildSearchIndex(datasets, now);
  const searchFile = index.files.find(file => file.key === 'search_index');
  if (searchFile) searchFile.count = searchIndex.itemCount;
  const indexErrors = validateIndex(index);
  if (indexErrors.length) throw new Error(indexErrors.join('\n'));

  writeJson('index.json', index);
  writeJson('sources.json', sources);
  writeJson('upgrade_paths.json', {
    schemaVersion: 1,
    updatedAt: now,
    rule: 'Faction units have one base unit and two upgrade options per tier. Neutral units cannot be upgraded.',
    source: {
      name: 'olden-era.com',
      url: 'https://www.olden-era.com/en/units',
      checkedAt,
      confidence: 'high',
    },
    groups: upgradeGroups,
  });
  writeJson('abilities.json', abilities);
  writeJson('zh_overrides.generated.json', {
    schemaVersion: 1,
    updatedAt: now,
    source: 'olden-era.com zh-CN pages',
    entries: zhMaps.entryMap,
    abilityCount: Object.keys(zhMaps.abilityMapByIcon).length,
  });
  writeJson('search_index.json', searchIndex);
  writeJson('unit_rankings.json', unitRankings || { schemaVersion: 1, updatedAt: now, groups: [] });
  writeJson('upgrade_comparisons.json', upgradeComparisons || { schemaVersion: 1, updatedAt: now, groups: [] });

  const missingZh = warnings.length;
  const detailFailures = files.reduce((sum, file) => {
    const rows = readJson(path.join(outputDir, file.file), []);
    return sum + rows.filter(row => row.detail && row.detail.error).length;
  }, 0);
  const missingZhCount = files.reduce((sum, file) => {
    const rows = readJson(path.join(outputDir, file.file), []);
    return sum + rows.filter(row => !row.zhName).length;
  }, 0);
  if (missingZhCount > 0) {
    console.warn(`\n   ${missingZhCount} entries do not have zhName overrides yet.`);
  }
  if (detailFailures > 0) {
    console.warn(`   ${detailFailures} entries failed detail enrichment.`);
  }
  console.log('\nDone.');
}

module.exports = { buildOldenEraData };

if (require.main === module) {
  buildOldenEraData().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
