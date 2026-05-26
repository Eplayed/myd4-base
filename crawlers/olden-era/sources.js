const BASE_URL = 'https://www.olden-era.com';

const SOURCES = [
  { key: 'units', type: 'unit', name: 'Units', path: '/en/units', file: 'units.json' },
  { key: 'artefacts', type: 'artifact', name: 'Artefacts', path: '/en/artefacts', file: 'artifacts.json' },
  { key: 'spells', type: 'spell', name: 'Spells', path: '/en/spells', file: 'spells.json' },
  { key: 'heroes', type: 'hero', name: 'Heroes', path: '/en/heroes', file: 'heroes.json' },
  { key: 'skills', type: 'skill', name: 'Skills', path: '/en/skills', file: 'skills.json' },
  { key: 'classes', type: 'class', name: 'Classes', path: '/en/classes', file: 'classes.json' },
  { key: 'factions', type: 'faction', name: 'Factions', path: '/en/factions', file: 'factions.json', detail: false },
  { key: 'resources', type: 'resource', name: 'Resources', path: '/en/resources', file: 'resources.json', detail: false },
];

module.exports = {
  BASE_URL,
  SOURCES: SOURCES.map(source => ({
    ...source,
    url: `${BASE_URL}${source.path}`,
    zhUrl: `${BASE_URL}${source.path.replace('/en/', '/zh/')}`,
  })),
};
