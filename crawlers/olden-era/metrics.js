function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getGoldCost(unit) {
  const cost = unit.derived && unit.derived.cost ? unit.derived.cost : {};
  return Number.isFinite(Number(cost.gold)) ? Number(cost.gold) : null;
}

function getGrowth(unit) {
  return toNumber(unit.properties.growth ?? unit.properties.weekly_growth);
}

function getAverageDamage(unit) {
  return unit.derived && unit.derived.damageRange
    ? toNumber(unit.derived.damageRange.average)
    : null;
}

function buildUnitMetrics(unit) {
  const hp = toNumber(unit.properties.hp);
  const attack = toNumber(unit.properties.attack);
  const defense = toNumber(unit.properties.defense);
  const speed = toNumber(unit.properties.speed);
  const initiative = toNumber(unit.properties.initiative);
  const growth = getGrowth(unit);
  const gold = getGoldCost(unit);
  const averageDamage = getAverageDamage(unit);

  const weeklyTotalHealth = hp !== null && growth !== null ? hp * growth : null;
  const weeklyAverageDamage = averageDamage !== null && growth !== null ? averageDamage * growth : null;
  const weeklyGoldCost = gold !== null && growth !== null ? gold * growth : null;

  return {
    averageDamage,
    goldCost: gold,
    weeklyGrowth: growth,
    weeklyTotalHealth,
    weeklyAverageDamage,
    weeklyGoldCost,
    healthPerGold: hp !== null && gold ? round(hp / gold) : null,
    averageDamagePerGold: averageDamage !== null && gold ? round(averageDamage / gold) : null,
    weeklyHealthPerGold: weeklyTotalHealth !== null && weeklyGoldCost ? round(weeklyTotalHealth / weeklyGoldCost) : null,
    weeklyDamagePerGold: weeklyAverageDamage !== null && weeklyGoldCost ? round(weeklyAverageDamage / weeklyGoldCost) : null,
    speed,
    initiative,
    attack,
    defense,
    formulaNotes: [
      'averageDamage = (minDamage + maxDamage) / 2',
      'weeklyTotalHealth = hp * weeklyGrowth',
      'weeklyAverageDamage = averageDamage * weeklyGrowth',
      'gold efficiency metrics use gold only; rare resources are not converted to gold',
    ],
  };
}

function attachUnitMetrics(units) {
  return units.map(unit => ({
    ...unit,
    derived: {
      ...(unit.derived || {}),
      metrics: buildUnitMetrics(unit),
    },
  }));
}

function buildRankings(units, updatedAt) {
  const metrics = [
    'averageDamage',
    'hp',
    'attack',
    'defense',
    'speed',
    'initiative',
    'weeklyTotalHealth',
    'weeklyAverageDamage',
    'healthPerGold',
    'averageDamagePerGold',
  ];

  const rankingGroups = [];
  const scopes = [
    { key: 'all', filter: () => true },
    ...Array.from(new Set(units.map(unit => unit.properties.faction).filter(Boolean))).map(faction => ({
      key: `faction_${faction}`,
      filter: unit => unit.properties.faction === faction,
    })),
  ];

  for (const scope of scopes) {
    const scoped = units.filter(scope.filter);
    for (const metric of metrics) {
      const rows = scoped
        .map(unit => ({
          unitId: unit.id,
          name: unit.name,
          zhName: unit.zhName,
          faction: unit.properties.faction,
          tier: unit.properties.tier,
          value: metric === 'hp' ? toNumber(unit.properties.hp) : unit.derived.metrics[metric],
        }))
        .filter(row => Number.isFinite(row.value))
        .sort((a, b) => b.value - a.value);

      rankingGroups.push({
        id: `${scope.key}_${metric}`,
        scope: scope.key,
        metric,
        count: rows.length,
        rows: rows.map((row, index) => ({ rank: index + 1, ...row })),
      });
    }
  }

  return {
    schemaVersion: 1,
    updatedAt,
    formulaNotes: [
      'Rankings are calculated from structured unit fields.',
      'Gold efficiency metrics use gold only; rare resources are not converted to gold.',
      'Rankings are data views, not official strength recommendations.',
    ],
    groups: rankingGroups,
  };
}

function statValue(unit, key) {
  if (key === 'averageDamage') return unit.derived.metrics.averageDamage;
  if (key === 'goldCost') return unit.derived.metrics.goldCost;
  if (key === 'weeklyTotalHealth') return unit.derived.metrics.weeklyTotalHealth;
  if (key === 'weeklyAverageDamage') return unit.derived.metrics.weeklyAverageDamage;
  return toNumber(unit.properties[key]);
}

function diff(upgrade, base, key) {
  const baseValue = statValue(base, key);
  const upgradeValue = statValue(upgrade, key);
  if (!Number.isFinite(baseValue) || !Number.isFinite(upgradeValue)) {
    return { key, base: baseValue, upgrade: upgradeValue, delta: null, percent: null };
  }
  const delta = upgradeValue - baseValue;
  return {
    key,
    base: baseValue,
    upgrade: upgradeValue,
    delta: round(delta),
    percent: baseValue === 0 ? null : round(delta / baseValue, 4),
  };
}

function buildUpgradeComparisons(units, upgradeGroups, updatedAt) {
  const byId = Object.fromEntries(units.map(unit => [unit.id, unit]));
  const stats = ['hp', 'attack', 'defense', 'averageDamage', 'speed', 'initiative', 'goldCost', 'weeklyTotalHealth', 'weeklyAverageDamage'];
  const groups = [];

  for (const group of upgradeGroups) {
    const base = byId[group.baseUnitId];
    if (!base) continue;
    const upgrades = group.upgradeIds
      .map(id => byId[id])
      .filter(Boolean)
      .map(unit => ({
        unitId: unit.id,
        name: unit.name,
        zhName: unit.zhName,
        deltas: stats.map(key => diff(unit, base, key)),
        abilityDiff: {
          added: (unit.derived.abilitiesDetailed || [])
            .filter(ability => !(base.derived.abilitiesDetailed || []).some(baseAbility => baseAbility.id === ability.id))
            .map(ability => ({ id: ability.id, name: ability.name, zhName: ability.zhName })),
          removed: (base.derived.abilitiesDetailed || [])
            .filter(ability => !(unit.derived.abilitiesDetailed || []).some(upgradeAbility => upgradeAbility.id === ability.id))
            .map(ability => ({ id: ability.id, name: ability.name, zhName: ability.zhName })),
        },
      }));

    groups.push({
      id: group.id,
      faction: group.faction,
      tier: group.tier,
      baseUnitId: group.baseUnitId,
      baseName: base.name,
      baseZhName: base.zhName,
      upgrades,
      source: group.source,
      confidence: group.confidence,
    });
  }

  return {
    schemaVersion: 1,
    updatedAt,
    formulaNotes: [
      'Upgrade comparisons show stat deltas against the base unit.',
      'They are comparison data, not automatic recommendations.',
      'Recommendation text should come from manual review.',
    ],
    groups,
  };
}

module.exports = {
  attachUnitMetrics,
  buildRankings,
  buildUpgradeComparisons,
};
