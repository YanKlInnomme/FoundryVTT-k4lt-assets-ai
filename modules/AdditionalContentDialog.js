// AdditionalContentDialog.js

import { saveAdditionalContentChoice } from "./settings.js";

// Shared dialog and settings lifecycle for all scenarios.
export async function promptAdditionalContent(scenario, setting, updateContent) {
    const choice = await new Promise(resolve => {
      const dialog = new Dialog({
        title: game.i18n.localize("k4lt-assets-ai.Dialog.moduleActivatedTitle"),
        content: `<p>${game.i18n.localize(`k4lt-assets-ai.${scenario}.Dialog.moduleActivatedContent`)}</p><p>${game.i18n.localize("k4lt-assets-ai.Dialog.moduleActivatedQuestion")}</p><div style="display:flex;justify-content:center;margin:10px 0"><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" name="hide-assets-dialog"> ${game.i18n.localize("k4lt-assets-ai.Dialog.doNotShowAgain")}</label></div>`,
        buttons: Object.fromEntries([["yes", true], ["no", false]].map(([key, value]) => [key, {
          label: game.i18n.localize(value ? "Yes" : "No"),
          callback: html => resolve({value, hide: (html[0] ?? html).querySelector('[name="hide-assets-dialog"]').checked}),
        }])),
        default: "no",
        close: () => resolve(null),
        render: () => requestAnimationFrame(() => {
          const root = dialog.element[0];
          const containers = root.querySelectorAll(".window-content, .dialog-content");
          const overflow = Math.max(0, ...[...containers].map(element => element.scrollHeight - element.clientHeight));
          if (overflow) dialog.setPosition({height: Math.ceil(root.getBoundingClientRect().height + overflow + 8)});
        }),
      }, {width: 520, height: "auto"});
      dialog.render(true);
    });
    if (choice) return saveAdditionalContentChoice(setting, choice, updateContent);
    return updateContent();
}
