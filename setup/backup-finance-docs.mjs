#!/usr/bin/env node
// Backup offline (3. kopia) bibliotek dokumentów witryny /sites/finance.
// Część B planu PLAN-FAZA4.md: zamiennik retencji Purview, którego nie ma w Business Standard.
//
// Użycie:
//   node setup/backup-finance-docs.mjs              pełny backup do ~/LogisticFit-Finance-Backup/<RRRR-MM-DD>/
//   node setup/backup-finance-docs.mjs --dry-run    tylko policz pliki i rozmiar, nic nie pobieraj
//   node setup/backup-finance-docs.mjs --out <dir>  inny katalog docelowy
//   node setup/backup-finance-docs.mjs --date <RRRR-MM-DD>  dokończ przerwany backup z danego dnia
//
// Wznawialny: plik, który już istnieje z tym samym rozmiarem, jest pomijany.
// Każdy plik trafia najpierw do *.part i dopiero po pobraniu dostaje docelową nazwę.
// Na końcu powstaje manifest.json z listą plików i podsumowanie z błędami.

import { mkdir, rename, stat, writeFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { graph, graphAll, getLibraryDrives, LIBRARIES } from './lib/graph.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const DRY = flag('--dry-run');
const today = new Date().toLocaleDateString('sv-SE'); // RRRR-MM-DD w lokalnej strefie
const runDate = opt('--date') || today;
if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
  console.error('Data musi mieć format RRRR-MM-DD');
  process.exit(2);
}
const baseDir = opt('--out') || join(homedir(), 'LogisticFit-Finance-Backup');
const runDir = join(baseDir, runDate);

const SELECT = '$select=id,name,size,file,folder,lastModifiedDateTime&$top=999';

async function* walk(driveId, itemId, relPath) {
  const path = itemId
    ? `/drives/${driveId}/items/${itemId}/children?${SELECT}`
    : `/drives/${driveId}/root/children?${SELECT}`;
  for (const item of await graphAll(path)) {
    const rel = relPath ? `${relPath}/${item.name}` : item.name;
    if (item.folder) yield* walk(driveId, item.id, rel);
    else if (item.file) yield { ...item, rel };
  }
}

async function existingSize(p) {
  try {
    return (await stat(p)).size;
  } catch {
    return -1;
  }
}

async function download(driveId, item, target) {
  const res = await graph('GET', `/drives/${driveId}/items/${item.id}/content`, null, { raw: true });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const part = `${target}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
    const got = (await stat(part)).size;
    if (got !== item.size) throw new Error(`rozmiar ${got} B zamiast ${item.size} B`);
    await rename(part, target);
  } catch (e) {
    await rm(part, { force: true });
    throw e;
  }
}

const fmt = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);

async function main() {
  console.log(`${DRY ? '[DRY RUN] ' : ''}Backup Finance → ${runDir}`);
  const drives = await getLibraryDrives();
  const manifest = { date: runDate, startedAt: new Date().toISOString(), libraries: {} };
  const totals = { files: 0, bytes: 0, downloaded: 0, skipped: 0, errors: [] };

  for (const lib of LIBRARIES) {
    const drive = drives.get(lib);
    const libDir = join(runDir, lib);
    const entries = [];
    let libBytes = 0;
    console.log(`\n== ${lib}`);

    for await (const item of walk(drive.id, null, '')) {
      totals.files++;
      totals.bytes += item.size;
      libBytes += item.size;
      entries.push({ path: item.rel, size: item.size, modified: item.lastModifiedDateTime });
      if (DRY) continue;

      const target = join(libDir, item.rel);
      if ((await existingSize(target)) === item.size) {
        totals.skipped++;
        continue;
      }
      try {
        await mkdir(join(target, '..'), { recursive: true });
        await download(drive.id, item, target);
        totals.downloaded++;
        if (totals.downloaded % 25 === 0) console.log(`  pobrano ${totals.downloaded} plików…`);
      } catch (e) {
        totals.errors.push({ library: lib, path: item.rel, error: e.message });
        console.error(`  BŁĄD ${item.rel}: ${e.message}`);
      }
    }
    manifest.libraries[lib] = { files: entries.length, bytes: libBytes, entries };
    console.log(`  ${entries.length} plików, ${fmt(libBytes)}`);
  }

  manifest.finishedAt = new Date().toISOString();
  manifest.errors = totals.errors;

  console.log(
    `\nRazem: ${totals.files} plików, ${fmt(totals.bytes)}` +
      (DRY ? '' : `; pobrano ${totals.downloaded}, pominięto ${totals.skipped}, błędów ${totals.errors.length}`),
  );
  if (!DRY) {
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`Manifest: ${join(runDir, 'manifest.json')}`);
  }
  if (totals.errors.length) {
    console.error(`\nNiektóre pliki się nie pobrały. Uruchom ponownie z --date ${runDate}, żeby je dociągnąć.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\nBackup przerwany: ${e.message}`);
  process.exit(1);
});
