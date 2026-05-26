const PLAYABLE_FACTIONS = new Set(['temple', 'necropolis', 'schism', 'dungeon', 'sylvan', 'hive']);

function defaultUpgradeInfo() {
  return {
    available: false,
    role: 'none',
    baseUnitId: '',
    upgradeIds: [],
    siblingIds: [],
    groupId: '',
    source: {
      rule: 'Neutral units cannot be upgraded, or no verified upgrade group is available.',
      confidence: 'high',
    },
  };
}

function groupKey(unit) {
  return `${unit.properties.faction}_tier_${unit.properties.tier}`;
}

function buildUpgradeGroups(units) {
  const groupsByKey = {};
  const warnings = [];

  for (const unit of units) {
    const faction = unit.properties.faction;
    const tier = unit.properties.tier;
    if (!PLAYABLE_FACTIONS.has(faction) || !Number.isFinite(Number(tier))) continue;
    const key = groupKey(unit);
    if (!groupsByKey[key]) groupsByKey[key] = [];
    groupsByKey[key].push(unit);
  }

  const groups = Object.entries(groupsByKey).map(([key, rows]) => {
    rows.sort((a, b) => Number(a.listPosition || 0) - Number(b.listPosition || 0));
    const faction = rows[0].properties.faction;
    const tier = Number(rows[0].properties.tier);

    if (rows.length !== 3) {
      warnings.push(`${key}: expected 3 units, found ${rows.length}`);
      return {
        id: key,
        faction,
        tier,
        baseUnitId: rows[0] ? rows[0].id : '',
        upgradeIds: rows.slice(1).map(unit => unit.id),
        unitIds: rows.map(unit => unit.id),
        confidence: 'low',
        source: 'olden-era.com ItemList order did not match expected 3-unit tier group.',
      };
    }

    return {
      id: key,
      faction,
      tier,
      baseUnitId: rows[0].id,
      upgradeIds: [rows[1].id, rows[2].id],
      unitIds: rows.map(unit => unit.id),
      confidence: 'high',
      source: 'olden-era.com Units ItemList order. Site text states faction units have two upgrade options; neutral units cannot be upgraded.',
    };
  });

  return {
    groups: groups.sort((a, b) => a.faction.localeCompare(b.faction) || a.tier - b.tier),
    warnings,
  };
}

function attachUpgradeInfo(units, groups) {
  const groupByUnit = {};
  for (const group of groups) {
    for (const unitId of group.unitIds) {
      groupByUnit[unitId] = group;
    }
  }

  return units.map(unit => {
    const group = groupByUnit[unit.id];
    if (!group || group.confidence !== 'high') {
      return {
        ...unit,
        upgrade: defaultUpgradeInfo(),
      };
    }

    const isBase = unit.id === group.baseUnitId;
    const siblingIds = group.unitIds.filter(id => id !== unit.id);
    return {
      ...unit,
      upgrade: {
        available: true,
        role: isBase ? 'base' : 'upgrade',
        baseUnitId: group.baseUnitId,
        upgradeIds: group.upgradeIds,
        siblingIds,
        groupId: group.id,
        source: {
          rule: group.source,
          confidence: group.confidence,
        },
      },
    };
  });
}

module.exports = {
  attachUpgradeInfo,
  buildUpgradeGroups,
};
