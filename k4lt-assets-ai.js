// k4lt-assets-ai.js

import { registerSettings } from "./modules/settings.js";
import { addAIGeneratedNotice } from "./modules/settings.js";
import { checkForTheBlackMadonnaModule } from "./modules/MadonnaAdditional.js";
import { handleRenderJournalEntrySheet } from "./modules/MadonnaAdditional.js";
import { checkForGalleryOfSoulsModule } from "./modules/GalleryAdditional.js";
import { checkForOakwoodHeightsModule } from "./modules/OakwoodAdditional.js";
import { checkForAnEchoFromThePastModule, updateEchoAdditionalContent, handleEchoJournalRender } from "./modules/EchoAdditional.js";

Hooks.once("init", registerSettings);
Hooks.once("ready", () => {
  kultLogger("Initializing k4lt-assets-ai module");
  checkForTheBlackMadonnaModule();
  checkForGalleryOfSoulsModule();
  checkForOakwoodHeightsModule();
  checkForAnEchoFromThePastModule().catch(error => console.error("K4LT Assets AI | Echo initialization failed", error));
});
Hooks.on("importAdventure", adventure => {
  if (["An Echo From the Past", "Écho du Passé"].includes(adventure.name)) updateEchoAdditionalContent();
});
Hooks.on("createToken", () => updateEchoAdditionalContent());
/* ---- COMPENDIUMS TO HIDE ---- */
const COMPENDIUMS_TO_HIDE = [
  "k4lt-assets-ai.additional-journals--aeftp",
  "k4lt-assets-ai.additional-scenes--tbm",
  "k4lt-assets-ai.additional-playlists--tbm",
  "k4lt-assets-ai.additional-journals--gos",
  "k4lt-assets-ai.additional-journals--oh"
];
/* ---- HIDE COMPENDIUMS ---- */
const hideConfiguredCompendiums = (html = document) => {
  for (const packId of COMPENDIUMS_TO_HIDE) {
    html
      .querySelector(`.directory-item[data-pack="${packId}"]`)
      ?.remove();
  }
};
/* ---- HOOKS ---- */
Hooks.on("renderCompendiumDirectory", (app, html) => {
  hideConfiguredCompendiums(html);
});
// Existing hooks (keep according to your needs)
Hooks.on("renderSettingsConfig", addAIGeneratedNotice);
Hooks.on("renderJournalEntrySheet", handleRenderJournalEntrySheet);
Hooks.on("renderJournalEntrySheet", handleEchoJournalRender);
Hooks.on("renderJournalEntryPageSheet", handleEchoJournalRender);
function getCurrentModuleId() {
  const path = import.meta.url;
  const match = path.match(/modules\/([^/]+)\//);
  return match ? match[1] : null;
}
/* ----------------------------------------- */
/* SETTINGS LINKS                            */
/* ----------------------------------------- */
function addDTLinksToSettings(app, htmlElement) {
  const html = htmlElement instanceof HTMLElement ? htmlElement : htmlElement?.[0];
  if (!html) return;
  const settingsBlocks = [...html.querySelectorAll("section.settings.flexcol")];
  const targetBlock = settingsBlocks.find(block =>
    block.querySelector(
      'button[data-action="openApp"][data-app="configure"]',
    )
  );
  if (!targetBlock) {
    console.warn("K4LT Assets AI | Settings block not found");
    return;
  }
  const buttons = targetBlock.querySelectorAll(
    'button[data-action="openApp"]',
  );
  if (!buttons.length) {
    console.warn("K4LT Assets AI | No settings buttons found");
    return;
  }
  const lastButton = buttons[buttons.length - 1];
  if (targetBlock.querySelector(".dt-links")) return;
  const section = document.createElement("section");
  section.classList.add(
    "settings",
    "flexcol",
    "dt-links",
  );
  section.innerHTML = `
    <h4 class="divider" style="margin-top: 1rem;">
      ${game.i18n.localize("k4lt-assets-ai.Module.Title")}
    </h4>
  `;
  const links = [
    {
      icon: "fab fa-github",
      key: "Git",
    },
    {
      icon: "fa-regular fa-mug-hot fa-bounce",
      key: "Donation",
    },
  ];
  for (const { icon, key } of links) {
    const label = game.i18n.localize(
      `k4lt-assets-ai.Links.${key}Title`,
    );
    const url = game.i18n.localize(
      `k4lt-assets-ai.Links.${key}URL`,
    );
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `
      <i class="${icon}"></i>
      ${label}
      <sup>
        <i class="fa-light fa-up-right-from-square"></i>
      </sup>
    `;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      window.open(url, "_blank");
    });
    section.appendChild(btn);
  }
  targetBlock.insertBefore(
    section,
    lastButton.nextSibling,
  );
}
Hooks.on("renderSettings", addDTLinksToSettings);
