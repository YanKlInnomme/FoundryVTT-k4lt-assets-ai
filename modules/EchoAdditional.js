// EchoAdditional.js

import { promptAdditionalContent } from "./AdditionalContentDialog.js";
import { regenerateSceneThumbnails, updateActorTokens, importAdditionalJournal as importJournalFromCompendium, removeAdditionalJournal as removeImportedJournal } from "./AdditionalContentHelpers.js";
const JOURNAL_UUIDS = {
  en: "Compendium.k4lt-assets-ai.additional-journals--aeftp.JournalEntry.9cf17e9d1fe22309",
  fr: "Compendium.k4lt-assets-ai.additional-journals--aeftp.JournalEntry.075368131aad7da7",
};
const MODULE = "k4lt-assets-ai";
const SETTING = "useEchoAdditionalContent";
const FLAG = "echoOriginalImages";
const ROOT = `modules/${MODULE}/scenarios/an-echo-from-the-past/`;
let mappingPromise;
let pending = Promise.resolve();
const journalData = new Map();

function loadJournalData(file) {
  if (!journalData.has(file)) journalData.set(file, fetch(`${ROOT}${file}`).then(response => {
    if (!response.ok) throw new Error(`Echo journals: HTTP ${response.status}`);
    return response.json();
  }).catch(error => { journalData.delete(file); throw error; }));
  return journalData.get(file);
}

function addMissingJournalBlocks(current, template) {
  const keys = [...template.matchAll(/data-echo-ai-block="([^"]+)"/g)].map(match => match[1]);
  if (keys.every(key => current.includes(`data-echo-ai-block="${key}"`))) return current;
  const parser = new DOMParser();
  const source = parser.parseFromString(template, "text/html");
  const target = parser.parseFromString(current, "text/html");
  let changed = false;
  for (const block of source.querySelectorAll("[data-echo-ai-block]")) {
    if (target.querySelector(`[data-echo-ai-block="${block.dataset.echoAiBlock}"]`)) continue;
    // Anchor to the preceding section heading where possible; never replace edited narrative.
    let heading = block.previousElementSibling;
    while (heading && !/^H[1-6]$/.test(heading.tagName)) heading = heading.previousElementSibling;
    const anchor = heading && [...target.querySelectorAll("h1,h2,h3,h4,h5,h6")].find(h => h.textContent === heading.textContent);
    if (anchor) anchor.after(block.cloneNode(true));
    else target.body.append(block.cloneNode(true));
    changed = true;
  }
  return changed ? target.body.innerHTML : current;
}

async function updateAdditionalJournals(data) {
  const languages = new Set();
  for (const journal of game.journal) {
    if (!isEchoJournal(journal)) continue;
    for (const lang of ["en", "fr"]) if (patchesForLanguage(journal, lang)) languages.add(lang);
  }
  for (const lang of ["en", "fr"]) {
    const {patches} = await loadJournalData(`journal-patches-${lang}.json`);
    for (const journal of game.journal) {
      const relevant = patches.filter(p => matches(journal, [{id: p.journalId, name: p.journalName}], data));
      if (!relevant.length) continue;
      languages.add(lang);
      const updates = [];
      for (const patch of relevant) {
        const page = journal.pages.find(p => p.name === patch.pageName && (p.id === patch.pageId || belongsToScenario(journal, data)));
        if (!page) continue;
        const current = page.text?.content ?? "";
        const html = current === patch.originalHtml ? patch.html : addMissingJournalBlocks(current, patch.html);
        if (html !== current) updates.push({_id: page.id, "text.content": html});
      }
      if (updates.length) await journal.updateEmbeddedDocuments("JournalEntryPage", updates);
    }
  }
  return languages;
}

async function importAdditionalJournal(languages) {
  for (const lang of languages) {
    const existing = game.journal.find(j => j.getFlag(MODULE, "echoGallery") && j.getFlag(MODULE, "echoImportedId") === j.id && j.getFlag(MODULE, "echoLanguage") === lang);
    const folder = game.journal.find(j => isEchoJournal(j) && patchesForLanguage(j, lang))?.folder?.id ?? null;
    const imported = await importJournalFromCompendium(JOURNAL_UUIDS[lang], {existing, folder, flags: {[MODULE]: {echoGallery: true, echoLanguage: lang}}});
    if (!imported) continue;
    if (imported.getFlag(MODULE, "echoImportedId") !== imported.id) await imported.setFlag(MODULE, "echoImportedId", imported.id);
    const updates = imported.pages.filter(page => page.ownership.default === 0 && Object.keys(page.ownership).length === 1)
      .map(page => ({_id: page.id, "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.INHERIT}));
    if (updates.length) await imported.updateEmbeddedDocuments("JournalEntryPage", updates);
  }
}

async function removeAdditionalJournal() {
  for (const journal of [...game.journal]) {
    if (journal.getFlag(MODULE, "echoGallery") && journal.getFlag(MODULE, "echoImportedId") === journal.id) await removeImportedJournal(journal.id);
  }
}

function patchesForLanguage(journal, lang) {
  const names = lang === "fr" ? ["Scénario", "Personnages Non Joueurs", "Personnages Joueurs & Aides de jeu"]
    : ["Scenario", "Non-Player Characters", "Player Characters & Handouts"];
  return names.some(name => sameName(name, journal.name));
}

function sameName(a, b) {
  return typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

function mapping() {
  return mappingPromise ??= fetch(`${ROOT}integration.json`).then(response => {
    if (!response.ok) throw new Error(`Echo asset mapping: HTTP ${response.status}`);
    return response.json();
  }).catch(error => { mappingPromise = undefined; throw error; });
}

function enabled() {
  return game.settings.settings.has(`${MODULE}.${SETTING}`) && game.settings.get(MODULE, SETTING);
}

function electedGM() {
  const first = game.users.find(user => user.active && user.isGM);
  return game.user.isGM && first?.id === game.user.id;
}

function belongsToScenario(document, data) {
  for (let folder = document.folder; folder; folder = folder.folder) {
    if (data.folderNames.some(name => sameName(name, folder.name))) return true;
  }
  const source = document._stats?.compendiumSource ?? document.flags?.core?.sourceId ?? "";
  return data.adventureIds.some(id => source.includes(id));
}

function matches(document, targets, data) {
  return targets.some(target =>
    (sameName(document.name, target.name) && (document.id === target.id || belongsToScenario(document, data)))
    || (document._stats?.compendiumSource ?? document.flags?.core?.sourceId ?? "").endsWith(`.${target.id}`)
  );
}

// Store only fields actually changed, and do not overwrite later GM edits on restore.
async function changeImages(document, fields, image, apply) {
  const saved = document.getFlag(MODULE, FLAG) ?? {};
  const next = {...saved};
  const update = {};
  for (const [field, originals] of Object.entries(fields)) {
    const current = foundry.utils.getProperty(document, field);
    if (apply) {
      if (current === image || !originals.includes(current)) continue;
      next[field] ??= {original: current, applied: image};
      update[field] = image;
    } else if (saved[field]) {
      if (current === saved[field].applied) update[field] = saved[field].original;
      delete next[field];
    }
  }
  if (JSON.stringify(next) !== JSON.stringify(saved)) {
    if (Object.keys(next).length) update[`flags.${MODULE}.${FLAG}`] = next;
    else update[`flags.${MODULE}.${FLAG}`] = new foundry.data.operators.ForcedDeletion();
  }
  if (Object.keys(update).length) await document.update(update);
}

async function updateActorsAndScenes(apply) {
  if (!electedGM()) {
    refreshJournals();
    return;
  }
  const data = await mapping();
  const actors = new Map();
  for (const entry of data.actors) {
    for (const actor of game.actors) {
      if (!matches(actor, entry.targets, data)) continue;
      actors.set(actor.id, entry);
      await changeImages(actor, {
        img: entry.targets.map(t => t.currentPortrait),
        "prototypeToken.texture.src": entry.targets.map(t => t.currentPrototypeToken),
      }, entry.image, apply);
    }
  }
  for (const [actorId, entry] of actors) {
    await updateActorTokens(game.actors.get(actorId), entry.image, {includeUnlinked: true, updateToken: token => changeImages(token, {
      "texture.src": entry.targets.flatMap(t => [t.currentPortrait, t.currentPrototypeToken]),
    }, entry.image, apply)});
  }
  for (const scene of game.scenes) {
    if (!apply) for (const token of scene.tokens) {
      if (!actors.has(token.actorId) && token.getFlag(MODULE, FLAG)) await changeImages(token, Object.fromEntries(Object.keys(token.getFlag(MODULE, FLAG)).map(k => [k, []])), null, false);
    }
    const entry = data.scenes.find(entry => matches(scene, entry.targets, data));
    let backgroundChanged = false;
    for (const level of scene.levels ?? []) {
      const previousBackground = level.background.src;
      if (entry) await changeImages(level, {"background.src": entry.targets.flatMap(t => t.levels.map(l => l.currentImage))}, entry.image, apply);
      else if (!apply && level.getFlag(MODULE, FLAG)) await changeImages(level, {"background.src": []}, null, false);
      backgroundChanged ||= previousBackground !== level.background.src;
    }
    if (backgroundChanged) await regenerateSceneThumbnails([scene]);
  }
  // Also restore saved actors which the GM renamed or moved since activation.
  if (!apply) for (const actor of game.actors) {
    const saved = actor.getFlag(MODULE, FLAG);
    if (saved) await changeImages(actor, Object.fromEntries(Object.keys(saved).map(k => [k, []])), null, false);
  }
  return data;
}

function refreshJournals() {
  for (const app of Object.values(ui.windows ?? {})) {
    if (app.document?.documentName === "JournalEntry" || app.document?.documentName === "JournalEntryPage") app.render(false);
  }
}

async function applyEchoAdditionalContent() {
  if (!electedGM()) return;
  kultLogger("✅ Applying An Echo From the Past additional content.");
  const data = await updateActorsAndScenes(true);
  const languages = await updateAdditionalJournals(data);
  await importAdditionalJournal(languages);
  refreshJournals();
}

async function removeEchoAdditionalContent() {
  if (!electedGM()) return;
  kultLogger("❌ Removing An Echo From the Past additional content.");
  await removeAdditionalJournal();
  const data = await updateActorsAndScenes(false);
  await updateAdditionalJournals(data);
  refreshJournals();
}

export function updateEchoAdditionalContent() {
  pending = pending.catch(() => {}).then(() => enabled() ? applyEchoAdditionalContent() : removeEchoAdditionalContent());
  return pending.catch(error => {
    console.error("K4LT Assets AI | Echo integration failed", error);
    ui.notifications.error(game.i18n.localize("k4lt-assets-ai.Echo.Error"));
  });
}

export async function checkForAnEchoFromThePastModule() {
  if (!game.modules.get("k4lt-assets")?.active) return;
  if (!electedGM() || !game.settings.settings.has(`${MODULE}.${SETTING}`)) return;
  const data = await mapping();
  const found = game.actors.some(actor => data.actors.some(entry => matches(actor, entry.targets, data)))
    || game.scenes.some(scene => data.scenes.some(entry => matches(scene, entry.targets, data)));
  if (!found) return updateEchoAdditionalContent();
  if (!game.settings.get(MODULE, "hideAssetsDialog")) {
    return promptAdditionalContent("Echo", SETTING, updateEchoAdditionalContent);
  }
  await updateEchoAdditionalContent();
}

export function isEchoJournal(document) {
  const journal = document?.documentName === "JournalEntryPage" ? document.parent : document;
  if (!journal) return false;
  for (let folder = journal.folder; folder; folder = folder.folder) {
    if (["An Echo From the Past", "Écho du Passé"].some(name => sameName(name, folder.name))) return true;
  }
  const source = journal._stats?.compendiumSource ?? journal.flags?.core?.sourceId ?? "";
  return ["WBvEoswkh5PscCHS", "uYX4vmSNkiR8lccN"].some(id => source.includes(id));
}

export function handleEchoJournalRender(app, html) {
  const root = html[0] ?? html;
  const echoJournal = isEchoJournal(app.document ?? app.object);
  for (const element of root.querySelectorAll('.conditional[data-condition="showIfAITrue"], .conditional[data-condition="showIfAIFalse"]')) {
    if (element.dataset.aiScenario !== "an-echo-from-the-past" && !echoJournal) continue;
    element.classList.toggle("hidden", element.dataset.condition === "showIfAIFalse" ? enabled() : !enabled());
  }
}
