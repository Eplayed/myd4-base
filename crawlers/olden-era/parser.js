function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(text) {
  return decodeHtmlEntities(String(text || '').replace(/<[^>]+>/g, '')).trim();
}

function extractLdJson(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(decodeHtmlEntities(match[1].trim())));
    } catch (err) {
      throw new Error(`Unable to parse ld+json: ${err.message}`);
    }
  }
  return blocks;
}

function parseItemList(html) {
  const blocks = extractLdJson(html);
  const itemList = blocks.find(block => block['@type'] === 'ItemList');
  if (!itemList) {
    throw new Error('No ItemList ld+json block found');
  }
  const items = Array.isArray(itemList.itemListElement)
    ? itemList.itemListElement.map(row => row.item).filter(Boolean)
    : [];
  return {
    name: itemList.name || '',
    numberOfItems: Number(itemList.numberOfItems || items.length),
    items,
  };
}

function parseStructuredPage(html) {
  const blocks = extractLdJson(html);
  const itemList = blocks.find(block => block['@type'] === 'ItemList');
  if (itemList) {
    const items = Array.isArray(itemList.itemListElement)
      ? itemList.itemListElement.map(row => {
        if (!row.item) return null;
        return {
          ...row.item,
          __listPosition: Number(row.position || 0),
        };
      }).filter(Boolean)
      : [];
    return {
      kind: 'itemList',
      name: itemList.name || '',
      numberOfItems: Number(itemList.numberOfItems || items.length),
      items,
      error: '',
    };
  }

  const page = blocks.find(block => block['@type'] && block.name);
  return {
    kind: page ? page['@type'] : 'unknown',
    name: page ? page.name : '',
    numberOfItems: 0,
    items: [],
    error: 'No ItemList ld+json block found',
  };
}

function parseDetailItem(html) {
  const blocks = extractLdJson(html);
  const item = blocks.find(block => {
    const type = block['@type'];
    if (Array.isArray(type)) return type.includes('GameItem') || type.includes('Thing');
    return ['GameItem', 'Thing', 'Product', 'CreativeWork', 'Person'].includes(type);
  });
  if (!item) {
    throw new Error('No detail ld+json item found');
  }
  return item;
}

function parseUnitAbilities(html) {
  const abilities = [];
  const re = /<span class="unit-content-ability-card"><img src="([^"]+)" alt="([^"]+)"[^>]*\/><p class="unit-content-ability-name">([\s\S]*?)<\/p><span class="unit-content-ability-tooltip"><span class="unit-content-ability-tooltip-title">([\s\S]*?)<\/span><span class="unit-content-ability-tooltip-desc">([\s\S]*?)<\/span><\/span><\/span>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    abilities.push({
      icon: decodeHtmlEntities(match[1]),
      name: stripTags(match[3] || match[2] || match[4]),
      description: stripTags(match[5]),
    });
  }
  return abilities;
}

module.exports = { decodeHtmlEntities, parseItemList, parseStructuredPage, parseDetailItem, parseUnitAbilities };
