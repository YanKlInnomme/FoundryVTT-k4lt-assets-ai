// MadonnaAdditional.js

import { promptAdditionalContent } from "./AdditionalContentDialog.js";
import { regenerateSceneThumbnails } from "./AdditionalContentHelpers.js";
import { isEchoJournal } from "./EchoAdditional.js";
const PATHS = {
    old: "modules/k4lt-the-black-madonna/assets/portraits/",
    new: "modules/k4lt-assets-ai/img/the-black-madonna/portraits/"
};
export async function checkForTheBlackMadonnaModule() {
    const isModuleEnabled = game.modules.get("k4lt-the-black-madonna")?.active;
    if (!isModuleEnabled) {
        kultLogger("Module 'k4lt-the-black-madonna' is not active. Skipping assets module check.");
        return;
    }
    if (!game.user.isGM) return;
    const essentialActors = [
        "Alexi Blobel",
        "Ivan Chezenko",
        "Krister Blühme"
    ];
    const foundEssential = essentialActors.some(name => game.actors.getName(name));
    if (!foundEssential) {
        kultLogger("📦 No essential campaign players found. Application of content delayed.");
        return;
    }
    const hideDialog = game.settings.get("k4lt-assets-ai", "hideAssetsDialog");
    if (hideDialog) {
        kultLogger("The dialog box is disabled via the settings.");
        const useContent = game.settings.get("k4lt-assets-ai", "useMadonnaAdditionalContent");
        return useContent ? applyMadonnaAdditionalContent() : removeMadonnaAdditionalContent();
    }
    return promptAdditionalContent("Madonna", "useMadonnaAdditionalContent", () =>
    game.settings.get("k4lt-assets-ai", "useMadonnaAdditionalContent")
      ? applyMadonnaAdditionalContent() : removeMadonnaAdditionalContent());
}
function formatFilenameFromName(name) {
    const hasG = /\(g\)$/i.test(name);
    // Special management for Aleksandr “Sasha” Pogodin
    if (name.includes('Aleksandr “Sasha” Pogodin') || name.includes('Aleksandr “Sasha” Pogodin')) {
        return hasG ? "aleksandr-sasha-pogodin-g" : "aleksandr-sasha-pogodin";
    }
    return name
        .replace(/\(g\)$/i, "")
        .toLowerCase()
        .replace(/"|"|\"|\'/g, "")
        .replace(/\(.*?\)/g, "")
        .replace(/\./g, "")
        .trim()
        .replace(/\s+/g, "-")
        + (hasG ? "-g" : "");
}
function getUpdatedImage(actor, currentImg, fromPath, toPath) {
    if (currentImg?.startsWith(fromPath)) {
        const filename = currentImg.split("/").pop();
        return toPath + filename;
    } else if (currentImg?.includes("icons/svg/mystery-man.svg")) {
        const filename = formatFilenameFromName(actor.name) + ".webp";
        return toPath + filename;
    }
    return null;
}
async function updateActorDescription(actor, fromPath, toPath) {
    const html = actor.system?.description;
    if (!html) return;
    let updated = html.replaceAll(fromPath, toPath);
    // Special handling for Zoya Selivanova
    if (actor.name === "Zoya Selivanova") {
        if (fromPath === PATHS.old && toPath === PATHS.new) {
            // Passage vers le contenu enrichi : ajouter l'image après le premier paragraphe
            if (!updated.includes('zoya-selivanova-true-form.webp')) {
                // Trouver la fin du premier paragraphe
                const firstParagraphEnd = updated.indexOf('</p>');
                if (firstParagraphEnd !== -1) {
                    const imageHtml = `\n<img style="width: 35%; height: 35%; border: none; transform: rotate(4deg); position: relative; left: 15px" src="${toPath}/zoya-selivanova-true-form.webp">`;
                    updated = updated.slice(0, firstParagraphEnd + 4) + imageHtml + updated.slice(firstParagraphEnd + 4);
                }
            }
        } else if (fromPath === PATHS.new && toPath === PATHS.old) {
            // Retour vers le contenu de base : supprimer l'image
            const trueShapePattern = /<img[^>]*src="[^"]*zoya-selivanova-true-form\.webp"[^>]*>/gi;
            updated = updated.replace(trueShapePattern, '');
            // Clean up any empty tags that may remain
            updated = updated.replace(/<p>\s*<\/p>/gi, '');
            updated = updated.replace(/\s+/g, ' ').trim();
        }
    }
    // Fix double .webp extension issue
    updated = updated.replace(/\.webp\.webp/g, '.webp');
    if (html !== updated) {
        await actor.update({ "system.description": updated });
        kultLogger(`📝 Updated description for ${actor.name}`);
    }
}
async function applyMadonnaAdditionalContent() {
    kultLogger("✅ Applying additional content to journal entries.");
    const npcs = game.actors.filter(actor => actor.type === "npc");
    for (let actor of npcs) {
        const currentImg = actor.img;
        const newImg = getUpdatedImage(actor, currentImg, PATHS.old, PATHS.new);
        if (newImg && newImg !== currentImg) {
            const existingFlag = actor.getFlag("k4lt-assets-ai", "originalPortrait");
            if (!existingFlag) {
                await actor.setFlag("k4lt-assets-ai", "originalPortrait", currentImg);
            }
            kultLogger(`📝 Updating image for ${actor.name} -> ${newImg}`);
            await actor.update({ img: newImg });
        }
        await updateActorDescription(actor, PATHS.old, PATHS.new);
        await updateOrRestoreTokens(PATHS.old, PATHS.new, false);
        await updateOrRestorePrototypeTokens(actor, PATHS.old, PATHS.new, false);
    }
    await updateAppendixJournal();
    await importAdditionalScenes();
    await importAdditionalPlaylists();
}
async function removeMadonnaAdditionalContent() {
    kultLogger("❌ Removing additional content from journal entries.");
    const npcs = game.actors.filter(actor => actor.type === "npc");
    for (let actor of npcs) {
        const originalImg = actor.getFlag("k4lt-assets-ai", "originalPortrait");
        if (originalImg && actor.img !== originalImg) {
            kultLogger(`🔁 Restoring original image for ${actor.name} -> ${originalImg}`);
            await actor.update({ img: originalImg });
            await actor.unsetFlag("k4lt-assets-ai", "originalPortrait");
        }
        await updateActorDescription(actor, PATHS.new, PATHS.old);
        await updateOrRestoreTokens(PATHS.new, PATHS.old, true);
        await updateOrRestorePrototypeTokens(actor, PATHS.new, PATHS.old, true);
    }
    await updateAppendixJournal();
    await removeAdditionalScenes();
    await removeAdditionalPlaylists();
}
async function updateOrRestoreTokens(fromPath, toPath, isRestoring = false) {
    for (let scene of game.scenes) {
        const updates = [];
        for (let tokenData of scene.tokens) {
            const actor = game.actors.get(tokenData.actorId);
            const token = scene.tokens.get(tokenData._id);
            if (!token || !actor || actor.type !== "npc") continue;
            const currentImg = foundry.utils.getProperty(tokenData, "texture.src");
            if (!currentImg) continue;
            let targetImg = null;
            if (isRestoring) {
                const saved = await token.getFlag("k4lt-assets-ai", "originalTokenImage");
                if (saved && currentImg !== saved) {
                    targetImg = saved;
                    await token.unsetFlag("k4lt-assets-ai", "originalTokenImage");
                } else if (currentImg.startsWith(fromPath)) {
                    const filename = currentImg.split("/").pop();
                    targetImg = toPath + filename;
                }
            } else {
                targetImg = getUpdatedImage(actor, currentImg, fromPath, toPath);
                const existingFlag = await token.getFlag("k4lt-assets-ai", "originalTokenImage");
                if (!existingFlag && targetImg) {
                    await token.setFlag("k4lt-assets-ai", "originalTokenImage", currentImg);
                }
            }
            if (targetImg && currentImg !== targetImg) {
                updates.push({ _id: token.id, "texture.src": targetImg });
                kultLogger(`🎭 ${isRestoring ? "Restoring" : "Updating"} token for ${actor.name} in ${scene.name}`);
            }
        }
        if (updates.length > 0) {
            await scene.updateEmbeddedDocuments("Token", updates);
        }
    }
}
async function updateOrRestorePrototypeTokens(actor, fromPath, toPath, isRestoring = false) {
    const protoImg = actor.prototypeToken?.texture?.src;
    if (!protoImg) return;
    if (isRestoring) {
        const originalProto = actor.getFlag("k4lt-assets-ai", "originalPrototypeImage");
        if (originalProto && protoImg !== originalProto) {
            kultLogger(`🔁 Restoring prototype token for ${actor.name} -> ${originalProto}`);
            await actor.update({ "prototypeToken.texture.src": originalProto });
            await actor.unsetFlag("k4lt-assets-ai", "originalPrototypeImage");
        }
    } else {
        const newProtoImg = getUpdatedImage(actor, protoImg, fromPath, toPath);
        if (newProtoImg && newProtoImg !== protoImg) {
            const existingFlag = actor.getFlag("k4lt-assets-ai", "originalPrototypeImage");
            if (!existingFlag) {
                await actor.setFlag("k4lt-assets-ai", "originalPrototypeImage", protoImg);
            }
            kultLogger(`🛠️ Updating prototype token for ${actor.name} -> ${newProtoImg}`);
            await actor.update({ "prototypeToken.texture.src": newProtoImg });
        }
    }
}
async function updateAppendixJournal() {
    const journal = await fromUuid("JournalEntry.EzxCEbW68W7DM16p");
    if (!journal) {
        kultLogger("📘 Journal 'Appendix' not found.");
        return;
    }
    // Use the generation functions (with new visual style)
    const importantNPCsHtml = await generateImportantNPCsHTML();
    const peopleAndCreaturesHtml = await generatePeopleAndCreaturesHTML();
    const updates = journal.pages.map(p => {
        kultLogger("🔍 Checking page:", p.name);
        if (p.name?.trim().toLowerCase() === "important npcs") {
            return { _id: p.id, name: p.name, text: { content: importantNPCsHtml } };
        }
        if (p.name?.trim().toLowerCase() === "people and creatures") {
            return { _id: p.id, name: p.name, text: { content: peopleAndCreaturesHtml } };
        }
        return null;
    }).filter(Boolean);
    await journal.updateEmbeddedDocuments("JournalEntryPage", updates);
    kultLogger("📘 Updated 'Important NPCs' journal page.");
    kultLogger("📘 Updated 'People and Creatures' journal page.");
}
async function generateImportantNPCsHTML() {
    const folderNames = ["Important NPCs", "The Three Nepharites"];
    const desiredOrder = [
        "Alexi Blobel", "Krister Blühme", "Ivan Chezenko", "Leonard Freude", "Pyotr Gallentinov",
        "Fyodor Gregoritch", "Nigel Harcombe", "Alfred Hausser", "Siegfried Hinderman",
        "Nikolay Kalenko", "Filip Kramer", "Helga Krausst", "Colonel Roman Leskov",
        "Anton Mahler", "Reinhold Messner", "Magda Orlova", "Aleksandr \"Sasha\" Pogodin",
        "Ivan Pogodin (I)", "Hans Georg Richter", "Dr. Helmut Schafer", "Heidi Schmidt",
        "Albert Schossel", "Zoya Selivanova", "General Strelkov (I)", "Dr. Natalya Tatlina",
        "Ilya Topov", "Ernst Vogel", "The Wanderer", "Alyona", "Katya", "Yelena"
    ];
    const folders = folderNames.map(name =>
        game.folders.find(f => f.name === name && f.type === "Actor")
    ).filter(Boolean);
    if (folders.length === 0) {
        return "<p><em>No 'Important NPCs' or 'The Three Nepharites' folders found.</em></p>";
    }
    const actors = folders.flatMap(folder => folder.contents)
        .filter(actor => desiredOrder.includes(actor.name))
        .sort((a, b) => desiredOrder.indexOf(a.name) - desiredOrder.indexOf(b.name));
    if (actors.length === 0) {
        return "<p><em>No Important NPC actors found.</em></p>";
    }
    return await generateActorHTML(actors, "Important NPCs");
}
async function generatePeopleAndCreaturesHTML() {
    const folder = game.folders.find(f => f.name === "People and Creatures" && f.type === "Actor");
    if (!folder) return "<p><em>'People and Creatures' folder not found.</em></p>";
    const actorOrder = [
        "Black Berets", "Black Berets (G)", "Blobel's Henchmen", "Boy Legionaries", "Coldsouls",
        "Damned Legionaries", "Dobermans", "Dream-Cannibals", "Dream-Cook", "Dream-Creature",
        "Dream-Incarnate of Chagidiel", "Dream-Orderlies", "German Police", "Guards",
        "Harcombe's Novices", "Ivan Pogodin's Henchmen", "KGB Commandos", "KGB Commandos (G)",
        "Living Dead", "Medical Orderlies", "Members of Slava", "Missile Base Engineers",
        "Neo-Nazis", "Parent Creatures", "Quisquilles", "Sasha Pogodin's Bodyguards", "Soldiers",
        "Twisted Mental Patients"
    ];
    const actors = folder.contents
        .filter(actor => actorOrder.includes(actor.name))
        .sort((a, b) => actorOrder.indexOf(a.name) - actorOrder.indexOf(b.name));
    if (actors.length === 0) {
        return "<p><em>No People and Creatures actors found.</em></p>";
    }
    return await generateActorHTML(actors, "People and Creatures");
}
async function generateActorHTML(actors, sectionName) {
    let html = `
        <div style="display:flex;flex-direction:row;flex-wrap:wrap;gap:10px;margin-bottom:20px">
            <div style="width:100%;text-align:center;font-weight:normal;margin-bottom:10px">
                ${sectionName} (${actors.length} actors)
            </div>
    `;
    for (let actor of actors) {
        const trueFormImg = await findTrueFormImage(actor);
        const imageCount = trueFormImg ? 2 : 1;
        const imgStyle = imageCount === 1 ? 'width: 175px; height: auto;' : 'width: 87px; height: auto;';
        html += `
            <div style="flex:1 1 150px;padding:10px;border:1px solid #ccc;text-align:center;border-radius:5px">
                <div style="display:flex; flex-direction:column; align-items:center; gap:5px">
                    <img style="border: none; ${imgStyle}" src="${actor.img}" alt="${actor.name}">
                    ${trueFormImg ? `<img style="border: none; ${imgStyle}" src="${trueFormImg}" alt="${actor.name} - True Form">` : ""}
                    <div style="font-weight:normal">@UUID[${actor.uuid}]{${actor.name}}</div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    return html;
}
async function findTrueFormImage(actor) {
    const trueFormPath = actor.img.replace(".webp", "-true-form.webp");
    try {
        const files = await foundry.applications.apps.FilePicker.implementation.browse("data", trueFormPath);
        return files.files.includes(trueFormPath) ? trueFormPath : null;
    } catch {
        return null;
    }
}
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export function handleRenderJournalEntrySheet(app, html, data) {
  if (isEchoJournal(app.document ?? app.object)) return;
  if (
    !game.modules.get("k4lt-the-black-madonna")?.active ||
    !game.settings.settings.has(
      "k4lt-assets-ai.useMadonnaAdditionalContent",
    )
  ) {
    return;
  }
  kultLogger("Hook renderJournalEntrySheet triggered");
  wait(100).then(() => {
    const useMadonnaAdditionalContent = game.settings.get(
      "k4lt-assets-ai",
      "useMadonnaAdditionalContent",
    );
    kultLogger(
      "Setting 'useMadonnaAdditionalContent':",
      useMadonnaAdditionalContent,
    );
    const isGM = game.user.isGM;
    kultLogger("User is GM:", isGM);
    const conditions = {
      showIfAITrue: useMadonnaAdditionalContent,
      showIfAdmin: isGM,
    };
    const conditionalElements = html.querySelectorAll(
      ".journal-entry-content .conditional",
    );
    kultLogger(`${conditionalElements.length} 'conditional' element(s) found`);
    conditionalElements.forEach((element, index) => {
      if (element.dataset.aiScenario === "an-echo-from-the-past") return;
      const conditionKey = element.dataset.condition;
      const shouldShow = conditions[conditionKey];
      kultLogger(
        `Element #${index} (${conditionKey}): ${
          shouldShow ? "shown" : "hidden"
        }`,
      );
      if (shouldShow) {
        element.classList.remove("hidden");
      }
    });
  });
}
async function importAdditionalScenes() {
    const pack = game.packs.get('k4lt-assets-ai.additional-scenes--tbm');
    if (!pack) {
        kultLogger("Compendium k4lt-assets-ai.additional-scenes--tbm not found.");
        return;
    }
    await pack.getIndex();
    const scenes = await pack.getDocuments();
    const currentScene = game.scenes.active;
    let importedCount = 0;
    for (const scene of scenes) {
        let targetScene = game.scenes.find(s => s.name === scene.name);
        if (!targetScene) {
            kultLogger(`Importing scene: ${scene.name}`);
            const newSceneData = scene.toObject();
            newSceneData.flags = {
                ...newSceneData.flags,
                "k4lt-assets-ai": {
                    sourceCompendium: pack.metadata.id,
                    originalId: scene.id
                }
            };
            targetScene = await Scene.create(newSceneData);
            importedCount++;
        } else {
            kultLogger(`Scene already exists: ${scene.name}`);
        }
    }
    if (currentScene) await currentScene.view();
    if (importedCount > 0) {
    kultLogger(`${importedCount} additional TBM scenes imported.`);
    // Laisse Foundry finir les créations avant de générer les miniatures
    await wait(3000);
    await regenerateSceneThumbnails();
    } else {
    kultLogger("All TBM scenes already exist.");
    }
}
/**
 * Import playlists from the additional-playlists--tbm compendium and fix journal links
 */
async function importAdditionalPlaylists() {
    const pack = game.packs.get('k4lt-assets-ai.additional-playlists--tbm');
    if (!pack) {
        kultLogger("Compendium k4lt-assets-ai.additional-playlists--tbm not found.");
        return;
    }
    // Get the list of playlists from the compendium
    await pack.getIndex();
    const compendiumPlaylists = await pack.getDocuments();
    if (compendiumPlaylists.length === 0) {
        kultLogger("No playlists found in the compendium.");
        return;
    }
    // Create a list of playlist names from the compendium
    const compendiumPlaylistNames = compendiumPlaylists.map(playlist => playlist.name);
    // Find existing playlists in the world with the same names
    const existingPlaylists = game.playlists.filter(playlist =>
        compendiumPlaylistNames.includes(playlist.name)
    );
    let importedCount = 0;
    let skippedCount = 0;
    // Import playlists that don't already exist
    for (const compendiumPlaylist of compendiumPlaylists) {
        const existingPlaylist = existingPlaylists.find(p => p.name === compendiumPlaylist.name);
        if (existingPlaylist) {
            kultLogger(`Playlist "${compendiumPlaylist.name}" already exists, skipping.`);
            skippedCount++;
            continue;
        }
        try {
            kultLogger(`Importing playlist: ${compendiumPlaylist.name}`);
            await Playlist.createDocuments([compendiumPlaylist.toObject()]);
            importedCount++;
        } catch (error) {
            kultLogger(`Failed to import playlist ${compendiumPlaylist.name}:`, error);
        }
    }
    // Fix journal links after import
    await fixJournalLinksBasedOnTitles();
    // Summary
    if (importedCount > 0) {
        kultLogger(`${importedCount} playlist(s) imported successfully.`);
    }
    if (skippedCount > 0) {
        kultLogger(`${skippedCount} playlist(s) skipped (already exist).`);
    }
    if (importedCount === 0 && skippedCount === 0) {
        kultLogger("No playlists were imported.");
    }
}
/**
 * Fix journal links by matching link titles with playlist sound names
 */
async function fixJournalLinksBasedOnTitles() {
    kultLogger("Fixing journal links based on titles...");
    let fixedLinksCount = 0;
    // Get all journal entries
    for (const journal of game.journal) {
        let journalUpdated = false;
        const updateData = { pages: [] };
        for (const page of journal.pages) {
            let pageContent = page.text?.content || "";
            let pageUpdated = false;
            // Find all @UUID links with titles
            const uuidRegex = /@UUID\[([^\]]+)\]\{([^}]+)\}/g;
            let match;
            while ((match = uuidRegex.exec(pageContent)) !== null) {
                const oldUUID = match[1];
                const linkTitle = match[2];
                // Find the corresponding playlist sound by name
                const newUUID = findPlaylistSoundByName(linkTitle);
                if (newUUID && newUUID !== oldUUID) {
                    // Replace the old UUID with the new one
                    const oldLink = `@UUID[${oldUUID}]{${linkTitle}}`;
                    const newLink = `@UUID[${newUUID}]{${linkTitle}}`;
                    pageContent = pageContent.replace(oldLink, newLink);
                    pageUpdated = true;
                    fixedLinksCount++;
                    kultLogger(`Fixed link: "${linkTitle}" -> ${newUUID}`);
                }
            }
            if (pageUpdated) {
                updateData.pages.push({
                    _id: page.id,
                    "text.content": pageContent
                });
                journalUpdated = true;
            }
        }
        // Update the journal if any pages were modified
        if (journalUpdated) {
            try {
                await journal.update(updateData);
                kultLogger(`Updated journal: ${journal.name}`);
            } catch (error) {
                kultLogger(`Failed to update journal ${journal.name}:`, error);
            }
        }
    }
    if (fixedLinksCount > 0) {
        kultLogger(`${fixedLinksCount} link(s) fixed in journals.`);
    } else {
        kultLogger("No links needed fixing.");
    }
}
/**
 * Find a playlist sound by its name and return its UUID
 */
function findPlaylistSoundByName(soundName) {
    for (const playlist of game.playlists) {
        const sound = playlist.sounds.find(s => s.name === soundName);
        if (sound) {
            return sound.uuid;
        }
    }
    return null;
}
/**
 * Fix links in a specific journal entry
 */
async function fixSpecificJournalLinks(journalId) {
    const journal = game.journal.get(journalId);
    if (!journal) {
        kultLogger(`Journal with ID ${journalId} not found.`);
        return;
    }
    let fixedLinksCount = 0;
    const updateData = { pages: [] };
    for (const page of journal.pages) {
        let pageContent = page.text?.content || "";
        let pageUpdated = false;
        // Find all @UUID links with titles
        const uuidRegex = /@UUID\[([^\]]+)\]\{([^}]+)\}/g;
        let match;
        while ((match = uuidRegex.exec(pageContent)) !== null) {
            const oldUUID = match[1];
            const linkTitle = match[2];
            // Find the corresponding playlist sound by name
            const newUUID = findPlaylistSoundByName(linkTitle);
            if (newUUID && newUUID !== oldUUID) {
                // Replace the old UUID with the new one
                const oldLink = `@UUID[${oldUUID}]{${linkTitle}}`;
                const newLink = `@UUID[${newUUID}]{${linkTitle}}`;
                pageContent = pageContent.replace(oldLink, newLink);
                pageUpdated = true;
                fixedLinksCount++;
                kultLogger(`Fixed link: "${linkTitle}" -> ${newUUID}`);
            }
        }
        if (pageUpdated) {
            updateData.pages.push({
                _id: page.id,
                "text.content": pageContent
            });
        }
    }
    // Update the journal if any pages were modified
    if (updateData.pages.length > 0) {
        try {
            await journal.update(updateData);
            kultLogger(`Updated journal: ${journal.name} with ${fixedLinksCount} fixed links`);
        } catch (error) {
            kultLogger(`Failed to update journal ${journal.name}:`, error);
        }
    }
}
/**
 * Remove scenes that were imported from the additional-scenes--tbm compendium
 */
async function removeAdditionalScenes() {
    const scenesToDelete = game.scenes.filter(scene => 
        scene.flags?.["k4lt-assets-ai"]?.sourceCompendium === 'k4lt-assets-ai.additional-scenes--tbm'
    );
    if (scenesToDelete.length === 0) {
        kultLogger("No imported TBM scenes found to remove.");
        return 0;
    }
    const currentScene = game.scenes.active;
    let deletedCount = 0;
    for (const scene of scenesToDelete) {
        try {
            kultLogger(`Removing scene: ${scene.name}`);
            await scene.delete();
            deletedCount++;
        } catch (error) {
            kultLogger(`Failed to remove scene ${scene.name}:`, error);
        }
    }
    // If the current scene was deleted, activate another scene if available
    if (currentScene && !game.scenes.get(currentScene.id)) {
        const remainingScenes = game.scenes.contents;
        if (remainingScenes.length > 0) {
            await remainingScenes[0].view();
        }
    }
    if (deletedCount > 0) {
        kultLogger(`${deletedCount} TBM scenes removed.`);
    }
    return deletedCount;
}
/**
 * Remove playlists that were imported from the additional-playlists--tbm compendium
 */
async function removeAdditionalPlaylists() {
    const pack = game.packs.get('k4lt-assets-ai.additional-playlists--tbm');
    if (!pack) {
        kultLogger("Compendium k4lt-assets-ai.additional-playlists--tbm not found.");
        return 0;
    }
    // Get the list of playlist names from the compendium to identify imported playlists
    await pack.getIndex();
    const compendiumPlaylists = await pack.getDocuments();
    const compendiumPlaylistNames = compendiumPlaylists.map(playlist => playlist.name);
    // Find playlists in the world that match compendium names
    const playlistsToDelete = game.playlists.filter(playlist =>
        compendiumPlaylistNames.includes(playlist.name)
    );
    if (playlistsToDelete.length === 0) {
        kultLogger("No imported TBM playlists found to remove.");
        return 0;
    }
    let deletedCount = 0;
    for (const playlist of playlistsToDelete) {
        try {
            kultLogger(`Removing playlist: ${playlist.name}`);
            await playlist.delete();
            deletedCount++;
        } catch (error) {
            kultLogger(`Failed to remove playlist ${playlist.name}:`, error);
        }
    }
    if (deletedCount > 0) {
        kultLogger(`${deletedCount} TBM playlists removed.`);
    }
    return deletedCount;
}
