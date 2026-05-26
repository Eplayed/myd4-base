function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const PROPERTY_KEY_MAP = {
  hp_health: 'hp',
  tier_level: 'tier',
  base_skill: 'base_skill_category',
  base_effect: 'base_effect',
  upgraded_effect: 'upgraded_effect',
  experience_awarded_for_killing_unit: 'experience',
};

const SLUG_VALUE_KEYS = new Set([
  'faction',
  'class',
  'magic_school',
  'slot',
  'rarity',
  'base_skill_category',
]);

function normalizeValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d+\.\d+$/.test(text)) return Number(text);
  return text;
}

function propertiesFromAdditionalProperty(item) {
  const result = {};
  const props = Array.isArray(item.additionalProperty) ? item.additionalProperty : [];
  for (const prop of props) {
    if (!prop || !prop.name) continue;
    const rawKey = slugify(prop.name);
    const key = PROPERTY_KEY_MAP[rawKey] || rawKey;
    const value = normalizeValue(prop.value);
    result[key] = typeof value === 'string' && SLUG_VALUE_KEYS.has(key) ? slugify(value) : value;
  }
  return result;
}

function inferId(type, item) {
  const url = item.url || item['@id'] || '';
  const tail = url.split('/').filter(Boolean).pop();
  return `${type}_${slugify(tail || item.name)}`;
}

function normalizeUrl(url) {
  if (!url) return '';
  const secondHttp = String(url).indexOf('https://', 8);
  if (secondHttp > -1) return String(url).slice(secondHttp);
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `https://www.olden-era.com${url}`;
  return url;
}

function normalizeItem(item, source, overrides, checkedAt) {
  const properties = propertiesFromAdditionalProperty(item);
  const id = inferId(source.type, item);
  const override = overrides[id] || {};
  const name = item.name || '';

  return {
    id,
    type: source.type,
    name,
    zhName: override.zhName || '',
    aliases: override.aliases || [],
    summary: override.summary || '',
    description: item.description || '',
    image: normalizeUrl(item.image),
    url: normalizeUrl(item.url || item['@id']),
    listPosition: Number(item.__listPosition || 0),
    properties,
    source: {
      name: 'olden-era.com',
      url: normalizeUrl(item.url || source.url),
      checkedAt,
      confidence: 'medium',
    },
    detail: {
      fetched: false,
      fetchedAt: '',
      error: '',
    },
    schemaVersion: 1,
  };
}

function splitList(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseDamage(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!match) {
    const single = Number(value);
    return Number.isFinite(single) ? { min: single, max: single, average: single } : null;
  }
  const min = Number(match[1]);
  const max = Number(match[2]);
  return { min, max, average: (min + max) / 2 };
}

function parseCost(value) {
  if (!value || typeof value !== 'string') return {};
  const result = {};
  const re = /(\d+)\s*([A-Za-z]+)/g;
  let match;
  while ((match = re.exec(value)) !== null) {
    result[slugify(match[2])] = Number(match[1]);
  }
  return result;
}

function parseSpellLevels(value) {
  if (!value || typeof value !== 'string') return [];
  const normalized = value.replace(/\s*\|\s*/g, '\n');
  const matches = [...normalized.matchAll(/tier(\d+):\s*([\s\S]*?)(?=\ntier\d+:|$)/gi)];
  return matches.map(match => ({
    tier: Number(match[1]),
    effect: match[2].trim(),
  }));
}

function buildDerivedFields(type, properties) {
  if (type === 'unit') {
    const damage = parseDamage(properties.damage);
    return {
      abilities: splitList(properties.abilities),
      damageRange: damage,
      cost: parseCost(properties.cost),
    };
  }

  if (type === 'hero') {
    return {
      startingSkills: splitList(properties.starting_skills),
      specialty: properties.specialty || '',
    };
  }

  if (type === 'spell') {
    return {
      levelEffects: parseSpellLevels(properties.level_effects),
    };
  }

  if (type === 'artifact') {
    return {
      baseEffect: properties.base_effect || properties.effect || '',
      upgradedEffect: properties.upgraded_effect || '',
      set: properties.set || '',
    };
  }

  return {};
}

function normalizeAbility(ability) {
  const id = `ability_${slugify(ability.name)}`;
  return {
    id,
    name: ability.name || '',
    zhName: '',
    aliases: [],
    icon: normalizeUrl(ability.icon),
    description: ability.description || '',
    source: {
      name: 'olden-era.com',
      url: '',
      checkedAt: '',
      confidence: 'medium',
    },
    schemaVersion: 1,
  };
}

function mergeDetailItem(entry, detailItem, checkedAt, abilityDetails = []) {
  const detailProperties = propertiesFromAdditionalProperty(detailItem);
  const properties = {
    ...entry.properties,
    ...detailProperties,
  };
  const normalizedAbilities = abilityDetails.map(ability => {
    const normalized = normalizeAbility(ability);
    return {
      ...normalized,
      source: {
        ...normalized.source,
        url: normalizeUrl(detailItem.url || detailItem['@id'] || entry.url),
        checkedAt,
      },
    };
  });
  const derived = buildDerivedFields(entry.type, properties);
  if (entry.type === 'unit' && normalizedAbilities.length > 0) {
    derived.abilitiesDetailed = normalizedAbilities.map(ability => ({
      id: ability.id,
      name: ability.name,
      zhName: ability.zhName,
      icon: ability.icon,
      description: ability.description,
    }));
    derived.abilities = normalizedAbilities.map(ability => ability.name);
  }
  return {
    ...entry,
    name: detailItem.name || entry.name,
    description: detailItem.description || entry.description,
    image: normalizeUrl(detailItem.image || entry.image),
    url: normalizeUrl(detailItem.url || detailItem['@id'] || entry.url),
    properties,
    derived,
    detail: {
      fetched: true,
      fetchedAt: checkedAt,
      error: '',
    },
  };
}

function markDetailError(entry, error) {
  return {
    ...entry,
    detail: {
      fetched: false,
      fetchedAt: '',
      error: error.message || String(error),
    },
  };
}

function withUpgradeInfo(entry, upgrade) {
  return {
    ...entry,
    upgrade,
  };
}

function loadOverrides(raw) {
  return raw && raw.entries ? raw.entries : {};
}

module.exports = {
  loadOverrides,
  markDetailError,
  mergeDetailItem,
  normalizeAbility,
  normalizeItem,
  slugify,
  withUpgradeInfo,
};
