// Baut den Kartenstil für die Jury Map (map/style-<stand>.json) im ADC-Look: hell, grau, schwarze Pins.
//
// Neu bauen (z. B. wenn die Karte aktualisiert wird):
//   cd tools/map && npm install && node build_style.mjs 2026-10
//
// Woher der Rest in map/ kommt (einmalig, nicht Teil dieses Skripts):
// - hamburg-<stand>.pmtiles: OpenStreetMap-Ausschnitt aus dem Protomaps-Build, mit dem pmtiles-CLI
//   (github.com/protomaps/go-pmtiles):
//   pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles hamburg-<stand>.pmtiles --bbox=9.82,53.48,10.14,53.65 --maxzoom=14
// - fonts/ und sprites/: github.com/protomaps/basemaps-assets (fonts/Noto Sans …, sprites/v4/grayscale*)
// Wird eine Datei ersetzt, den Dateinamen ändern (/map/ wird ein Jahr gecacht).
import { writeFileSync } from 'node:fs';
import { layers, namedFlavor } from '@protomaps/basemaps';

const stand = process.argv[2];
if (!stand) { console.error('Stand angeben, z. B. node build_style.mjs 2026-10'); process.exit(1); }

const g = namedFlavor('grayscale');
const flavor = {
  ...g,
  background: '#d4d4d0', water: '#d4d4d0', earth: '#f4f4f2',
  park_a: '#e8e8e4', park_b: '#e8e8e4', wood_a: '#e8e8e4', wood_b: '#e8e8e4', scrub_a: '#ebebe7', scrub_b: '#ebebe7',
  hospital: '#efefec', industrial: '#ecece9', school: '#efefec', pedestrian: '#f7f7f5', zoo: '#ebebe7',
  aerodrome: '#ecece9', sand: '#efefec', beach: '#efefec', military: '#ecece9',
  buildings: '#e4e4e0', pier: '#e4e4e0',
  other: '#ffffff', minor_service: '#ffffff', minor_a: '#ffffff', minor_b: '#ffffff', link: '#ffffff', major: '#ffffff', highway: '#ffffff',
  minor_service_casing: '#dcdcd8', minor_casing: '#dcdcd8', link_casing: '#d0d0cc', major_casing_early: '#d0d0cc', major_casing_late: '#d0d0cc',
  highway_casing_early: '#c4c4c0', highway_casing_late: '#c4c4c0',
  bridges_other: '#ffffff', bridges_minor: '#ffffff', bridges_link: '#ffffff', bridges_major: '#ffffff', bridges_highway: '#ffffff',
  railway: '#c9c9c5',
  roads_label_minor: '#8a8a86', roads_label_minor_halo: '#ffffff', roads_label_major: '#6b6b6b', roads_label_major_halo: '#ffffff',
  subplace_label: '#6b6b6b', subplace_label_halo: '#f4f4f2', city_label: '#0a0a0a', city_label_halo: '#f4f4f2',
  ocean_label: '#8a8a86', address_label: '#9a9a96', address_label_halo: '#f4f4f2'
};

const style = {
  version: 8,
  glyphs: '/map/fonts/{fontstack}/{range}.pbf',
  sprite: '/map/sprites/grayscale',
  sources: {
    protomaps: {
      type: 'vector',
      url: 'pmtiles:///map/hamburg-' + stand + '.pmtiles',
      attribution: '© <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>'
    }
  },
  layers: layers('protomaps', flavor, { lang: 'de' })
};
// Die Seite macht aus den Pfaden beim Laden volle URLs (jury.js)

writeFileSync(new URL('../../map/style-' + stand + '.json', import.meta.url), JSON.stringify(style));
console.log('map/style-' + stand + '.json geschrieben,', style.layers.length, 'Ebenen');
