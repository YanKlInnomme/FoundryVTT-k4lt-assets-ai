// settings.js

let settingsReloadSuspended = false;

// Complete dialog choices without interrupting document updates.
export async function saveAdditionalContentChoice(setting, choice, updateContent) {
  const previous = settingsReloadSuspended;
  settingsReloadSuspended = true;
  try {
    if (game.settings.get("k4lt-assets-ai", setting) !== choice.value) {
      await game.settings.set("k4lt-assets-ai", setting, choice.value);
    }
    if (choice.hide) await game.settings.set("k4lt-assets-ai", "hideAssetsDialog", true);
    return await updateContent();
  }
  finally { settingsReloadSuspended = previous; }
}

function registerToggleSetting(key, { nameKey, hintKey, logLabel }) {
  game.settings.register("k4lt-assets-ai", key, {
    name: game.i18n.localize(nameKey),
    hint: game.i18n.localize(hintKey),
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => {
      kultLogger(`${logLabel} is now: ${value}`);
      if (settingsReloadSuspended) return;
      window.location.reload();
    },
  });
}
export function registerSettings() {
  const isBlackMadonnaEnabled = game.modules.get("k4lt-the-black-madonna")?.active;
  const isScenarioModuleEnabled = game.modules.get("k4lt-en")?.active || game.modules.get("k4lt-fr")?.active;
  /* ---- TOUJOURS DISPONIBLE ---- */
  registerToggleSetting("hideAssetsDialog", {
    nameKey: "k4lt-assets-ai.Settings.hideAssetsDialogName",
    hintKey: "k4lt-assets-ai.Settings.hideAssetsDialogHint",
    logLabel: "The answer to additional content",
  });
  /* ---- THE BLACK MADONNA ---- */
  if (isBlackMadonnaEnabled) {
    registerToggleSetting("useMadonnaAdditionalContent", {
      nameKey: "k4lt-assets-ai.Madonna.Settings.useAdditionalContentName",
      hintKey: "k4lt-assets-ai.Madonna.Settings.useAdditionalContentHint",
      logLabel: "The answer to additional content for The Black Madonna",
    });
  }
  /* ---- GALLERY OF SOULS ---- */
  if (isScenarioModuleEnabled) {
    registerToggleSetting("useGalleryAdditionalContent", {
      nameKey: "k4lt-assets-ai.Gallery.Settings.useAdditionalContentName",
      hintKey: "k4lt-assets-ai.Gallery.Settings.useAdditionalContentHint",
      logLabel: "The answer to additional content for the Gallery of Souls",
    });
  }
  /* ---- OAKWOOD HEIGHTS ---- */
  if (isScenarioModuleEnabled) {
    registerToggleSetting("useOakwoodAdditionalContent", {
      nameKey: "k4lt-assets-ai.Oakwood.Settings.useAdditionalContentName",
      hintKey: "k4lt-assets-ai.Oakwood.Settings.useAdditionalContentHint",
      logLabel: "The answer to additional content for Oakwood Heights",
    });
  }
  /* ---- AN ECHO FROM THE PAST ---- */
  if (isScenarioModuleEnabled) {
  registerToggleSetting("useEchoAdditionalContent", {
    nameKey: "k4lt-assets-ai.Echo.Settings.useAdditionalContentName",
    hintKey: "k4lt-assets-ai.Echo.Settings.useAdditionalContentHint",
    logLabel: "Additional content for An Echo From the Past",
  });
  }
}
export function addAIGeneratedNotice(app, html, data) {
  const targetInput = html.querySelector('[name="k4lt-assets-ai.hideAssetsDialog"]');
  const targetGroup = targetInput?.closest(".form-group");
  if (!targetGroup) return;
  const notice = document.createElement("div");
  notice.className = "form-group k4lt-info-text";
  notice.innerHTML = game.i18n.localize("k4lt-assets-ai.Settings.AIGeneratedNotice");
  targetGroup.insertAdjacentElement("afterend", notice);
  /* ---- WIDE SETTINGS ---- */
  for (const key of [
    "useMadonnaAdditionalContent",
    "useGalleryAdditionalContent",
    "useOakwoodAdditionalContent",
    "useEchoAdditionalContent",
  ]) {
    html.querySelector(`[name="k4lt-assets-ai.${key}"]`)
      ?.closest(".form-group")
      ?.classList.add("k4lt-wide-setting");
  }
}
