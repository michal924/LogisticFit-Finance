#!/usr/bin/env node
// Dostęp księgowej: TYLKO biblioteka "Finance Spółka", TYLKO odczyt.
// Część A planu PLAN-FAZA4.md.
//
// Użycie:
//   node setup/grant-accountant-access.mjs <email>             nadaj rolę read na korzeniu Finance Spółka (wysyła zaproszenie)
//   node setup/grant-accountant-access.mjs <email> --no-email  nadaj bez wysyłania e-maila z zaproszeniem
//   node setup/grant-accountant-access.mjs <email> --revoke    odbierz bezpośrednie uprawnienia tej osoby
//   node setup/grant-accountant-access.mjs --list              pokaż obecne uprawnienia biblioteki
//   --yes                                                      bez pytania o potwierdzenie
//
// SharePoint sam nada "limited access" do witryny (potrzebne, żeby otworzyć bibliotekę).
// Pozostałe biblioteki (JDG, Prywatne) zostają niewidoczne.

import { createInterface } from 'node:readline/promises';
import { graph, graphAll, getLibraryDrives } from './lib/graph.mjs';

const LIBRARY = 'Finance Spółka';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

const MANUAL = `
Wariant ręczny (z PLAN-FAZA4.md):
  Biblioteka Finance Spółka → ⚙ → Library settings → Permissions for this document library
  → Stop Inheriting Permissions → Grant Permissions → dodaj księgową → poziom Read.`;

function usage(msg) {
  if (msg) console.error(msg);
  console.error('Użycie: node setup/grant-accountant-access.mjs <email> [--revoke] [--no-email] [--yes] | --list');
  process.exit(2);
}

async function confirm(question) {
  if (flags.has('--yes') || !process.stdin.isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} [t/N] `)).trim().toLowerCase();
  rl.close();
  return answer === 't' || answer === 'tak' || answer === 'y';
}

function emailsOf(p) {
  const ids = [p.grantedToV2, p.grantedTo, ...(p.grantedToIdentitiesV2 || []), ...(p.grantedToIdentities || [])];
  const out = new Set();
  for (const id of ids.filter(Boolean)) {
    for (const who of [id.user, id.siteUser]) {
      if (who?.email) out.add(who.email.toLowerCase());
      if (who?.loginName) {
        const m = who.loginName.match(/[^|]+@[^|]+$/);
        if (m) out.add(m[0].toLowerCase());
      }
    }
  }
  if (p.invitation?.email) out.add(p.invitation.email.toLowerCase());
  return [...out];
}

function describe(p) {
  const who = emailsOf(p).join(', ') ||
    p.grantedToV2?.siteGroup?.displayName || p.grantedToV2?.group?.displayName ||
    p.link?.scope || '(?)';
  const inherited = p.inheritedFrom ? ' (dziedziczone z witryny)' : '';
  return `${(p.roles || []).join('/')}\t${who}${inherited}`;
}

async function main() {
  if (!flags.has('--list')) {
    if (!email) usage('Podaj e-mail księgowej.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) usage(`To nie wygląda na e-mail: ${email}`);
  }

  const drive = (await getLibraryDrives()).get(LIBRARY);
  const permsPath = `/drives/${drive.id}/root/permissions`;

  if (flags.has('--list')) {
    const perms = await graphAll(permsPath);
    console.log(`Uprawnienia: ${LIBRARY} (${drive.webUrl})`);
    for (const p of perms) console.log(`  ${describe(p)}`);
    return;
  }

  if (flags.has('--revoke')) {
    const perms = await graphAll(permsPath);
    const mine = perms.filter((p) => emailsOf(p).includes(email));
    const direct = mine.filter((p) => !p.inheritedFrom);
    if (!mine.length) {
      console.log(`${email} nie ma uprawnień do ${LIBRARY}.`);
      return;
    }
    if (!direct.length) {
      console.log(`${email} ma tylko uprawnienia dziedziczone z witryny. Usuń je w ustawieniach witryny.`);
      return;
    }
    if (!(await confirm(`Odebrać ${email} dostęp do ${LIBRARY} (${direct.length} uprawn.)?`))) return;
    for (const p of direct) {
      await graph('DELETE', `${permsPath}/${p.id}`);
      console.log(`  usunięto: ${describe(p)}`);
    }
    console.log('Dostęp odebrany.');
    return;
  }

  const sendInvitation = !flags.has('--no-email');
  const q = `Nadać ${email} dostęp TYLKO DO ODCZYTU do biblioteki ${LIBRARY}` +
    (sendInvitation ? ' i wysłać zaproszenie e-mailem?' : ' (bez e-maila)?');
  if (!(await confirm(q))) return;

  try {
    const res = await graph('POST', `/drives/${drive.id}/root/invite`, {
      recipients: [{ email }],
      roles: ['read'],
      requireSignIn: true,
      sendInvitation,
      message: sendInvitation
        ? 'Dostęp do dokumentów LogisticFit (Finance Spółka), tylko do odczytu.'
        : undefined,
    });
    for (const p of res.value || []) console.log(`  nadano: ${describe(p)}`);
    console.log(`\nGotowe. Link do biblioteki: ${drive.webUrl}`);
    console.log('Sprawdź: księgowa widzi tylko Finance Spółka i nie może edytować ani usuwać plików.');
  } catch (e) {
    console.error(`Graph odrzucił udostępnienie korzenia biblioteki:\n  ${e.message}`);
    console.error(MANUAL);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`Błąd: ${e.message}`);
  process.exit(1);
});
