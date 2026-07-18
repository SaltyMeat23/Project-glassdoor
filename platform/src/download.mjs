// Download + extract EFAST2 datasets into cache/ without ingesting.
// Usage: node src/download.mjs [year ...]   (default: 2023)

import { getDatasetCsv } from './lib/efast.mjs';

const years = process.argv.slice(2).map(Number).filter(Boolean);
const YEARS = years.length ? years : [2023];
const DATASETS = ['F_5500']; // add 'F_SCH_H', 'F_SCH_R' when we ingest financials

for (const year of YEARS) {
  console.log(`\n== ${year} ==`);
  for (const ds of DATASETS) await getDatasetCsv(ds, year);
}
console.log('\nDownloads ready in cache/.');
