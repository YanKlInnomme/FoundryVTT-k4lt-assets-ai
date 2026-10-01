// OakwoodAdditional.js

import { promptAdditionalContent } from "./AdditionalContentDialog.js";
import { getUpdatedImage, updateActorTokens, importAdditionalJournal, removeAdditionalJournal } from "./AdditionalContentHelpers.js";
const PATHS = {
  old: "modules/k4lt-assets/scenarios/oakwood-heights/portraits",
  new: "modules/k4lt-assets-ai/scenarios/oakwood-heights/portraits/",
};
const JOURNAL_UUID =
  "Compendium.k4lt-assets-ai.additional-journals--oh.JournalEntry.1bJykpcr0GQPwEu4";
const JOURNAL_ID = JOURNAL_UUID.split(".").pop();
const TOKEN_IMAGES = {
  /*
  "Scene.xxx.Token.yyy":
    "modules/k4lt-assets-ai/scenarios/oakwood-heights/portraits/example.webp",
  */
};
export async function checkForOakwoodHeightsModule() {
  const isModuleEnabled = game.modules.get("k4lt-assets")?.active;
  if (!isModuleEnabled) {
    kultLogger("Module 'k4lt-assets' is not active. Skipping assets module check.");
    return;
  }
  if (!game.user.isGM) return;
  const essentialActors = ["Aidan Kostroff", "Caitlyn Dehamre", "Felicia Jenner", "Joshua Katz"];
  const foundEssential = essentialActors.some(name => game.actors.getName(name));
  if (!foundEssential) {
    kultLogger("📦 No essential scenario actors found. Application of content delayed.");
    await game.settings.set("k4lt-assets-ai", "useOakwoodAdditionalContent", false);
    return;
  }
  const hideDialog = game.settings.get("k4lt-assets-ai", "hideAssetsDialog");
  if (hideDialog) {
    kultLogger("The dialog box is disabled via the settings.");
    const useContent = game.settings.get("k4lt-assets-ai", "useOakwoodAdditionalContent");
    return useContent ? applyOakwoodAdditionalContent() : removeOakwoodAdditionalContent();
  }
  return promptAdditionalContent("Oakwood", "useOakwoodAdditionalContent", () =>
    game.settings.get("k4lt-assets-ai", "useOakwoodAdditionalContent")
      ? applyOakwoodAdditionalContent() : removeOakwoodAdditionalContent());
}
async function updateStandaloneTokens(apply) {
  for (const [uuid, img] of Object.entries(TOKEN_IMAGES)) {
    const token = await fromUuid(uuid);
    if (!token) continue;
    if (apply) {
      const original = token.getFlag("k4lt-assets-ai", "originalTexture");
      if (!original) await token.setFlag("k4lt-assets-ai", "originalTexture", token.texture.src);
      await token.update({ "texture.src": img });
    } else {
      const original = token.getFlag("k4lt-assets-ai", "originalTexture");
      if (!original) continue;
      await token.update({ "texture.src": original });
      await token.unsetFlag("k4lt-assets-ai", "originalTexture");
    }
  }
}
async function applyOakwoodAdditionalContent() {
  kultLogger("✅ Applying Oakwood Heights additional content.");
  const folder = game.folders.find(folder => folder.type === "JournalEntry"
    && ["Oakwood Heights VF", "Oakwood Heights"].some(name =>
      name.toLowerCase() === folder.name?.trim().toLowerCase()));
  await importAdditionalJournal(JOURNAL_UUID, {folder: folder?.id ?? null});
  await updateStandaloneTokens(true);
  for (const actor of game.actors) {
    const currentImg = actor.img;
    const newImg = await getUpdatedImage(actor, currentImg, PATHS.old, PATHS.new);
    if (!newImg || newImg === currentImg) continue;
    const originalData = actor.getFlag("k4lt-assets-ai", "originalPortraitData");
    if (!originalData) {
      await actor.setFlag("k4lt-assets-ai", "originalPortraitData", {
        img: actor.img,
        prototype: actor.prototypeToken.texture.src,
      });
    }
    kultLogger(`🖼️ Updating portrait for ${actor.name} -> ${newImg}`);
    await actor.update({ img: newImg, "prototypeToken.texture.src": newImg });
    await updateActorTokens(actor, newImg);
  }
}
async function removeOakwoodAdditionalContent() {
  kultLogger("❌ Removing Oakwood Heights additional content.");
  await removeAdditionalJournal(JOURNAL_ID);
  await updateStandaloneTokens(false);
  for (const actor of game.actors) {
    const originalData = actor.getFlag("k4lt-assets-ai", "originalPortraitData");
    if (!originalData) continue;
    await actor.update({ img: originalData.img, "prototypeToken.texture.src": originalData.prototype });
    await updateActorTokens(actor, originalData.prototype);
    await actor.unsetFlag("k4lt-assets-ai", "originalPortraitData");
  }
}