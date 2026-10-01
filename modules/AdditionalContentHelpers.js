// AdditionalContentHelpers.js

// Shared operations for scenario additional content
export function formatFilenameFromName(name) {
  const hasG = /\(g\)$/i.test(name);
  return name
    .replace(/\(g\)$/i, "")
    .toLowerCase()
    .replace(/['"‘’]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\./g, "")
    .trim()
    .replace(/\s+/g, "-") + (hasG ? "-g" : "");
}
export async function getUpdatedImage(actor, currentImg, fromPath, toPath, portraitMapping = {}) {
  let targetImg = null;
  if (currentImg?.startsWith(fromPath)) {
    targetImg = toPath + currentImg.split("/").pop();
  } else if (currentImg?.includes("icons/svg/mystery-man.svg")) {
    const filename = portraitMapping[actor.name] ?? formatFilenameFromName(actor.name);
    targetImg = `${toPath}${filename}.webp`;
  }
  if (!targetImg) return null;
  try {
    const files = await foundry.applications.apps.FilePicker.implementation.browse("data", toPath);
    return files.files.includes(targetImg) ? targetImg : null;
  } catch {
    return null;
  }
}
export async function updateActorTokens(actor, img, {includeUnlinked = false, updateToken} = {}) {
  for (const scene of game.scenes) {
    const updates = [];
    for (const token of scene.tokens) {
      if ((!includeUnlinked && !token.actorLink) || token.actorId !== actor.id) continue;
      if (updateToken) { await updateToken(token); continue; }
      updates.push({ _id: token.id, "texture.src": img });
    }
    if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
  }
}

export async function importAdditionalJournal(uuid, {folder = null, existing, flags = {}} = {}) {
  const journalId = uuid.split('.').pop();
  const worldJournal = existing ?? game.journal.get(journalId);
  if (worldJournal) {
    if (folder && !worldJournal.folder) await worldJournal.update({folder});
    return worldJournal;
  }
  const pack = game.packs.get(uuid.split('.').slice(1, 3).join('.'));
  if (!pack) throw new Error(`Additional journal pack not loaded: ${uuid.split('.').slice(1, 3).join('.')}. Restart Foundry to load the module manifest.`);
  const journal = await pack.getDocument(journalId);
  if (!journal) throw new Error(`Additional journal not found in compendium: ${uuid}`);
  const imported = await game.journal.importFromCompendium(pack, journal.id, {folder, flags}, {keepId: true});
  kultLogger(`📖 Imported journal "${imported.name}".`);
  return imported;
}

export async function removeAdditionalJournal(journalId) {
  const journal = game.journal.get(journalId);
  if (!journal) return;
  await journal.delete();
  kultLogger(`📖 Removed journal "${journal.name}".`);
}

export async function regenerateSceneThumbnails(scenes = game.scenes.contents) {
  for (const scene of scenes) {
    try {
      const {thumb} = await scene.createThumbnail();
      await scene.update({thumb});
      kultLogger(`Thumbnail regenerated: ${scene.name}`);
    } catch (error) {
      console.warn(`K4LT Assets AI | Unable to regenerate thumbnail for ${scene.name}`, error);
    }
  }
}
