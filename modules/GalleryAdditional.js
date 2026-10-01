// GalleryAdditional.js

import { promptAdditionalContent } from "./AdditionalContentDialog.js";
import { getUpdatedImage, updateActorTokens, importAdditionalJournal, removeAdditionalJournal } from "./AdditionalContentHelpers.js";
const PATHS = {
  old: "modules/k4lt-assets/scenarios/gallery-of-souls/portraits/",
  new: "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/"
};
const JOURNAL_UUID = "Compendium.k4lt-assets-ai.additional-journals--gos.JournalEntry.Vo3fXHH5yNIsc8CR";
const JOURNAL_ID = JOURNAL_UUID.split(".").pop();
const TOKEN_IMAGES = {
  "Scene.vumWOL3w644QsRRW.Token.QjaXUxlnMpZtieks":
    "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/park-guard.webp",
  "Scene.vumWOL3w644QsRRW.Token.SFzGWaLJP5TwSknJ":
    "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/park-guard-2.webp",
  "Scene.gddPobdSIa5nfjVv.Token.CTk3mulaMi8IaL3U":
    "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/howarts-enforcers-6.webp",
  "Scene.gddPobdSIa5nfjVv.Token.eicToooldquNVqRj":
    "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/howarts-enforcers-5.webp",
  "Scene.gddPobdSIa5nfjVv.Token.jC9k3p0Imoo7cc6R":
    "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/howarts-enforcers.webp",
  "Scene.gddPobdSIa5nfjVv.Token.jnrVIgPpgdzbJci4":
    "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/howarts-enforcers-2.webp",
  "Scene.gddPobdSIa5nfjVv.Token.EaFXy4VYUHIsbyH5":
    "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/howarts-enforcers-3.webp",
  "Scene.POzFRJxeNALDJaTq.Token.gjYuyKsd8MiTl5au":
    "modules/k4lt-assets-ai/scenarios/gallery-of-souls/portraits/the-damned-legionnaires-2.webp"
};
const PORTRAIT_MAPPING = {
  "Adorateur du cairath": "cairath-worshiper",
  "Agent de police": "police-officer",
  "Gardien du parc": "park-guard",
  "Hommes de main d'Howart": "howarts-enforcers",
  "M. Pickett": "mr-pickett",
  "Purgatides hurlants": "howling-purgatide"
};
export async function checkForGalleryOfSoulsModule() {
  const isModuleEnabled = game.modules.get("k4lt-assets")?.active;
  if (!isModuleEnabled) {
    kultLogger("Module 'k4lt-assets' is not active. Skipping assets module check.");
    return;
  }
  if (!game.user.isGM) return;
  const essentialActors = ["Fred Hayden", "George Stevenson", "Lizabeth 'Liza' Bennett", "Ray Astor"];
  const foundEssential = essentialActors.some(name => game.actors.getName(name));
  if (!foundEssential) {
    kultLogger("📦 No essential scenario actors found. Application of content delayed.");
    await game.settings.set("k4lt-assets-ai", "useGalleryAdditionalContent", false);
    return;
  }
  const hideDialog = game.settings.get("k4lt-assets-ai", "hideAssetsDialog");
  if (hideDialog) {
    kultLogger("The dialog box is disabled via the settings.");
    const useContent = game.settings.get("k4lt-assets-ai", "useGalleryAdditionalContent");
    return useContent ? applyGalleryAdditionalContent() : removeGalleryAdditionalContent();
  }
  return promptAdditionalContent("Gallery", "useGalleryAdditionalContent", () =>
    game.settings.get("k4lt-assets-ai", "useGalleryAdditionalContent")
      ? applyGalleryAdditionalContent() : removeGalleryAdditionalContent());
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
async function applyGalleryAdditionalContent() {
  kultLogger("✅ Applying Gallery of Souls additional content.");
  const folder = game.folders.find(folder => folder.type === "JournalEntry"
    && ["La Galerie des Âmes", "Gallery of Souls"].some(name =>
      name.toLowerCase() === folder.name?.trim().toLowerCase()));
  await importAdditionalJournal(JOURNAL_UUID, {folder: folder?.id ?? null});
  await updateStandaloneTokens(true);
  for (const actor of game.actors) {
    const currentImg = actor.img;
    const newImg = await getUpdatedImage(actor, currentImg, PATHS.old, PATHS.new, PORTRAIT_MAPPING);
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
async function removeGalleryAdditionalContent() {
  kultLogger("❌ Removing Gallery of Souls additional content.");
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