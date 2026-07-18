// Fetch & cache EFAST2 Form 5500 datasets from the DOL public FOIA store.
//
// Files live at (spaces in the path are significant):
//   https://askebsa.dol.gov/FOIA Files/<YEAR>/Latest/<DATASET>_<YEAR>_Latest.zip
// which 301-redirects to www.askebsa.dol.gov; Node's fetch follows it.
//
// Each zip contains one CSV (quoted, header row first) plus a layout .txt.
// We cache both the zip and the extracted CSV so re-runs are offline & fast.

import AdmZip from 'adm-zip';
import { createWriteStream, existsSync, statSync, readdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = resolve(__dirname, '..', '..', 'cache');

const BASE = 'https://askebsa.dol.gov/FOIA%20Files';

/** URL for a dataset's "latest" annual zip, e.g. dataset='F_5500', year=2023. */
export function datasetUrl(dataset, year) {
  return `${BASE}/${year}/Latest/${dataset}_${year}_Latest.zip`;
}

function zipPath(dataset, year) {
  return join(CACHE_DIR, `${dataset}_${year}.zip`);
}

/** Download the zip to cache (skips if already present and non-empty). */
export async function downloadDataset(dataset, year) {
  const out = zipPath(dataset, year);
  if (existsSync(out) && statSync(out).size > 0) {
    console.log(`  [cache] ${dataset}_${year}.zip already present`);
    return out;
  }
  const url = datasetUrl(dataset, year);
  console.log(`  [get]   ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed ${res.status} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out));
  console.log(`  [saved] ${out} (${statSync(out).size.toLocaleString()} bytes)`);
  return out;
}

/** Extract the single CSV from the zip into cache; returns its path. */
export function extractCsv(dataset, year) {
  // already extracted?
  const existing = readdirSync(CACHE_DIR).find(
    (f) => f.toLowerCase().startsWith(`${dataset}_${year}`.toLowerCase()) &&
           f.toLowerCase().endsWith('.csv'),
  );
  if (existing) {
    console.log(`  [cache] ${existing} already extracted`);
    return join(CACHE_DIR, existing);
  }
  const zip = new AdmZip(zipPath(dataset, year));
  const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.csv'));
  if (!entry) throw new Error(`no CSV entry in ${dataset}_${year}.zip`);
  zip.extractEntryTo(entry, CACHE_DIR, false, true);
  const csvPath = join(CACHE_DIR, entry.entryName.split('/').pop());
  console.log(`  [csv]   ${csvPath}`);
  return csvPath;
}

/** Ensure the dataset is downloaded + extracted; returns the CSV path. */
export async function getDatasetCsv(dataset, year) {
  await downloadDataset(dataset, year);
  return extractCsv(dataset, year);
}
