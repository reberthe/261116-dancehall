// steps.js — onglet Steps : liste, recherche, filtres, tirage au hasard, fiche d'un step, partie privée, formulaire
"use strict";

// Filtres gardés sur le téléphone
const filtresSteps = Object.assign(
  { recherche: "", aTravailler: false, epoques: [], etiquettes: [], sousCategories: [] },
  lireLocal("filtres_steps", {})
);
let dernierTirage = null;

function sauverFiltres() {
  ecrireLocal("filtres_steps", { aTravailler: filtresSteps.aTravailler, epoques: filtresSteps.epoques, etiquettes: filtresSteps.etiquettes,
    sousCategories: filtresSteps.sousCategories });
}

// Steps qui passent la recherche et les filtres
// Sous-catégories choisies dont l'étiquette est aussi choisie (ex. Waistline seulement si Female est choisi)
function sousCategoriesActives() {
  return filtresSteps.sousCategories.filter((cle) => {
    const sc = App.sousCategorie(cle);
    return sc && filtresSteps.etiquettes.includes(sc.etiquette);
  });
}

// ids : seulement ces steps (ma bibliothèque) ; sinon toute la base
function stepsFiltres(ids = null) {
  const mots = sansAccents(filtresSteps.recherche).split(/\s+/).filter(Boolean);
  const sousCats = sousCategoriesActives();
  return App.donnees.steps.filter((s) => {
    if (ids && !ids.has(s.id)) return false;
    if (filtresSteps.aTravailler && App.aEspacePrive()) {
      const p = App.donnees.perso.get(s.id);
      if (!p || !p.a_travailler) return false;
    }
    if (filtresSteps.epoques.length && !filtresSteps.epoques.includes(s.epoque)) return false;
    if (filtresSteps.etiquettes.length && !filtresSteps.etiquettes.includes(s.etiquette)) return false;
    if (sousCats.length && !sousCats.includes(s.sous_categorie)) return false;
    if (mots.length) {
      const c = App.createur(s.createur_id);
      const sc = App.sousCategorie(s.sous_categorie);
      const texte = sansAccents([s.nom, s.autres_noms, c && c.nom, s.chanson, sc && sc.nom].join(" "));
      if (!mots.every((m) => texte.includes(m))) return false;
    }
    return true;
  }).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

function sousTitreStep(s) {
  const c = App.createur(s.createur_id);
  const sc = App.sousCategorie(s.sous_categorie);
  return [c ? c.nom : "Créateur inconnu", s.epoque ? EPOQUES[s.epoque] : null, sc ? sc.nom : null].filter(Boolean).join(" · ");
}

function pastilleNiveau(niveau) {
  return el("span", { class: "niveau" }, iconeNiveau(niveau), NIVEAUX[niveau]);
}

// ---------- Ma bibliothèque ----------
// Cours où j'ai vu chaque step, les plus récents d'abord : step_id → [cours]
function coursParStep() {
  const coursParId = new Map(App.donnees.cours.map((c) => [c.id, c]));
  const vus = new Map();
  for (const cs of App.donnees.coursSteps) {
    const c = coursParId.get(cs.cours_id);
    if (!cs.step_id || !c) continue;
    if (!vus.has(cs.step_id)) vus.set(cs.step_id, []);
    if (!vus.get(cs.step_id).includes(c)) vus.get(cs.step_id).push(c);
  }
  for (const liste of vus.values()) liste.sort((a, b) => b.jour.localeCompare(a.jour));
  return vus;
}

// Mes steps : vus dans un de mes cours, ou ajoutés à la main
function idsMaBiblio(vus = coursParStep()) {
  const ids = new Set(vus.keys());
  for (const p of App.donnees.perso.values()) if (p.dans_biblio) ids.add(p.step_id);
  return ids;
}

// « Vu 3× · dernier le 12 nov. », « Vu 1× · le 12 nov. » ou « Ajouté à la main »
function resumeVus(cours) {
  if (!cours || !cours.length) return "Ajouté à la main";
  return "Vu " + cours.length + "× · " + (cours.length > 1 ? "dernier le " : "le ") + jourMois(cours[0].jour);
}

// Bibliothèque affichée : « ma » ou « commune » (gardée sur le téléphone ; au départ, la mienne si elle n'est pas vide)
let choixBibliotheque = null;
let choixPour = null;   // compte pour lequel le choix a été fait (une autre personne qui se connecte repart du début)
// Un choix par compte sur le téléphone ; la clé garde une empreinte de l'e-mail, pas l'e-mail lui-même (il resterait après la déconnexion)
function empreinte(texte) {
  let h = 0;
  for (const c of texte) h = (h * 31 + c.codePointAt(0)) | 0;
  return (h >>> 0).toString(36);
}
const cleBibliotheque = () => "bibliotheque:" + empreinte(App.email || "");
function bibliothequeActive(ids) {
  if (!App.aEspacePrive()) return "commune";
  if (choixPour !== App.email) { choixPour = App.email; choixBibliotheque = lireLocal(cleBibliotheque(), null); }
  // Choix de départ fait une fois par ouverture de l'appli : la liste ne bascule pas toute seule quand on ajoute son premier step
  if (!choixBibliotheque) choixBibliotheque = ids.size ? "ma" : "commune";
  return choixBibliotheque;
}

// ---------- Liste ----------
const EPOQUES_COURT = { old_school: "Old", middle_school: "Middle", new_school: "New" };
let triSteps = lireLocal("tri_steps", "createur");   // « createur » ou « az », gardé sur le téléphone

// Sous-titre d'un créateur en tête de groupe : Male · Black Roses Crew · 4 steps
function sousTitreGroupe(c, n) {
  const crews = c.type === "personne" ? crewsDe(c.id).filter((m) => !m.ancien).map((m) => m.crew.nom).join(", ") : "";
  return [ETIQUETTES[c.etiquette] ? ETIQUETTES[c.etiquette].nom : null, c.type === "crew" ? "Crew" : null, crews || null, n ? pluriel(n, "step") : null]
    .filter(Boolean).join(" · ");
}

// Créateurs et crews sans aucun step, qui passent les filtres là où ils ont un sens :
// Female / Male selon leur étiquette (un crew mixte passe dans les deux), époques selon les leurs, recherche sur leurs noms.
// « À travailler », Neutre seul et les sous-catégories portent sur des steps : ils les cachent.
function createursSansStep() {
  if (filtresSteps.aTravailler || sousCategoriesActives().length) return [];
  const etiquettes = filtresSteps.etiquettes;
  const mots = sansAccents(filtresSteps.recherche).split(/\s+/).filter(Boolean);
  const avecSteps = new Set(App.donnees.steps.map((s) => s.createur_id));
  return App.donnees.createurs.filter((c) => {
    if (avecSteps.has(c.id)) return false;
    if (etiquettes.length && !etiquettes.includes(c.etiquette)
        && !(c.etiquette === "mixte" && (etiquettes.includes("gyal") || etiquettes.includes("man")))) return false;
    if (filtresSteps.epoques.length && !(c.epoques || []).some((e) => filtresSteps.epoques.includes(e))) return false;
    if (mots.length) {
      const texte = sansAccents([c.nom, c.autres_noms].join(" "));
      if (!mots.every((m) => texte.includes(m))) return false;
    }
    return true;
  });
}

// ---------- Bouton + : ajouter un step, une personne ou un crew ----------
function ouvrirAjout() {
  const choix = (texte, sous, signe, action) => el("button", { type: "button", class: "ligne choix-ajout",
    onclick: () => { App.fermerFeuille(); action(); } },
    signe, el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: texte }), el("span", { class: "ligne-sous", text: sous })),
    icone(ICONES.chevron, 16, 2.4));
  App.ouvrirTiroir((c) => c.append(
    el("span", { class: "tiroir-poignee", "aria-hidden": "true" }),
    el("div", { class: "tiroir-titre" }, el("h1", { text: "Ajouter" }),
      el("button", { type: "button", class: "lien-fermer", onclick: App.fermerFeuille }, "Fermer")),
    el("div", { class: "bloc-lignes" },
      choix("Un step", "Un pas, avec son créateur et son époque", el("span", { class: "signe-ajout", "aria-hidden": "true" }, icone(ICONES.steps, 18, 2.2)),
        () => ouvrirFormulaireStep(null)),
      choix("Une personne", "Un danseur ou une danseuse", el("span", { class: "signe-ajout carre", "aria-hidden": "true" }, "P"),
        () => ouvrirFormulaireCreateur(null, "personne", "Steps")),
      choix("Un crew", "Un groupe de danseurs", el("span", { class: "signe-ajout", "aria-hidden": "true" }, "C"),
        () => ouvrirFormulaireCreateur(null, "crew", "Steps")))));
}

// Une ligne de step. biblio : { ma, vus, ids } (ma = on est dans ma bibliothèque)
function ligneDeStep(s, avecCreateur, biblio) {
  const p = App.aEspacePrive() ? App.donnees.perso.get(s.id) : null;
  const sc = App.sousCategorie(s.sous_categorie);
  const c = App.createur(s.createur_id);
  let sous;
  if (biblio && biblio.ma) {
    sous = [avecCreateur ? (c ? c.nom : "Créateur inconnu") : null, resumeVus(biblio.vus.get(s.id))].filter(Boolean).join(" · ");
  } else {
    sous = avecCreateur ? sousTitreStep(s) : [s.epoque ? EPOQUES[s.epoque] : "Époque : ?", sc ? sc.nom : null].filter(Boolean).join(" · ");
  }
  const photo = avecCreateur && c ? avatar(c, { petit: true }) : null;
  const aTravailler = biblio && biblio.ma && p && p.a_travailler;
  return el("button", { type: "button", class: "ligne", onclick: () => ouvrirFicheStep(s.id) },
    lettre(s.etiquette, { petite: true }),
    el("span", { class: "ligne-texte" },
      el("span", { class: "ligne-titre" }, s.nom,
        aTravailler ? el("span", { class: "point-travail", title: "À travailler", "aria-label": "à travailler" }) : null),
      el("span", { class: "ligne-sous", text: sous })),
    biblio && biblio.ma && p && p.niveau ? pastilleNiveau(p.niveau) : null,
    biblio && !biblio.ma && biblio.ids.has(s.id)
      ? el("span", { class: "repere-biblio", "aria-label": "dans ma bibliothèque" }, icone("M5 12l5 5 9-10", 11, 3), "Ma biblio") : null,
    photo);
}

function dessinerSteps(contenu) {
  const vus = coursParStep();
  const ids = idsMaBiblio(vus);
  const ma = bibliothequeActive(ids) === "ma";
  const biblio = { ma, vus, ids };

  const actions = App.peutEcrire()
    ? [el("button", { type: "button", class: "bouton-rond", "aria-label": "Ajouter", onclick: ouvrirAjout }, icone(ICONES.plus, 22, 2.6))]
    : [];
  contenu.append(App.decor("bandes"), App.entete({ titre: "Steps", surtitre: "Riddim · Dancehall", grand: true }, ...actions));

  // Commune | Ma bibliothèque
  if (App.aEspacePrive()) {
    const changer = (choix) => { choixBibliotheque = choix; ecrireLocal(cleBibliotheque(), choix); App.redessiner(); window.scrollTo(0, 0); };
    contenu.append(el("div", { class: "segments deux choix-rubrique choix-biblio", role: "group", "aria-label": "Bibliothèque" },
      el("button", { type: "button", "aria-pressed": ma ? "false" : "true", onclick: () => changer("commune") }, "Commune"),
      el("button", { type: "button", "aria-pressed": ma ? "true" : "false", onclick: () => changer("ma") }, "Ma bibliothèque")));
  }

  const champ = el("input", { type: "search", placeholder: ma ? "Un step de ma bibliothèque…" : "Un step, un créateur, un mot…",
    "aria-label": "Rechercher un step", value: filtresSteps.recherche, autocomplete: "off" });
  champ.addEventListener("input", () => { filtresSteps.recherche = champ.value; dessinerListe(); });
  contenu.append(el("label", { class: "champ-recherche" }, icone(ICONES.loupe, 18), champ));

  // Filtres sur une ligne : À travailler · Old · Middle · New · Female (+ Waistline) · Male · Neutre
  const filtres = el("div", { class: "filtres defile", role: "group", "aria-label": "Filtres" });
  const pilule = (texte, actif, basculer, classe = "") => el("button", { type: "button", class: "filtre " + classe, "aria-pressed": actif ? "true" : "false",
    onclick: () => { basculer(); sauverFiltres(); App.redessiner(); } }, texte);
  const basculerDans = (liste, valeur) => { const i = liste.indexOf(valeur); if (i >= 0) liste.splice(i, 1); else liste.push(valeur); };
  if (App.aEspacePrive()) filtres.append(pilule("À travailler", filtresSteps.aTravailler, () => { filtresSteps.aTravailler = !filtresSteps.aTravailler; }));
  for (const [cle, nom] of Object.entries(EPOQUES_COURT)) {
    filtres.append(pilule(nom, filtresSteps.epoques.includes(cle), () => basculerDans(filtresSteps.epoques, cle)));
  }
  for (const cle of ["gyal", "man", "neutre"]) {
    filtres.append(pilule(ETIQUETTES[cle].nom, filtresSteps.etiquettes.includes(cle), () => {
      basculerDans(filtresSteps.etiquettes, cle);
      filtresSteps.sousCategories = sousCategoriesActives();   // décocher Female enlève aussi Waistline
    }));
    // Sous-catégories juste après leur étiquette, seulement quand elle est choisie (ex. « Waistline technique » après Female)
    if (filtresSteps.etiquettes.includes(cle)) {
      for (const sc of App.donnees.sousCategories.filter((x) => x.etiquette === cle)) {
        filtres.append(pilule(sc.nom, filtresSteps.sousCategories.includes(sc.cle), () => basculerDans(filtresSteps.sousCategories, sc.cle), "sous-filtre"));
      }
    }
  }
  contenu.append(filtres);

  // Nombre de steps + tri « Par créateur | A → Z »
  const compte = el("p", { class: "compte" });
  const tri = el("div", { class: "tri", role: "group", "aria-label": "Trier" },
    ...[["createur", "Par créateur"], ["az", "A → Z"]].map(([cle, nom]) => el("button", { type: "button", "aria-pressed": triSteps === cle ? "true" : "false",
      onclick: () => { triSteps = cle; ecrireLocal("tri_steps", cle); App.redessiner(); } }, nom)));
  contenu.append(el("div", { class: "ligne-tri" }, compte, tri));
  const liste = el("div", { class: "liste" });
  contenu.append(liste);

  // Dé : bouton rond dans le coin, il ouvre ses réglages
  const hasard = el("button", { type: "button", class: "bouton-hasard", "aria-label": "Tirer des steps au hasard", title: "Tirer des steps au hasard",
    onclick: () => ouvrirDe(ma ? "ma" : "commune") }, icone(ICONES.de, 24, 2.2));
  document.body.append(hasard);

  function dessinerListe() {
    const steps = stepsFiltres(ma ? ids : null);
    const sansStep = !ma && triSteps === "createur" ? createursSansStep().length : 0;
    compte.textContent = pluriel(steps.length, "step") + (sansStep ? " · " + sansStep + " sans step" : "");
    liste.replaceChildren();
    if (ma && !ids.size) {
      liste.append(el("div", { class: "vide" },
        el("p", { text: "Ta bibliothèque est encore vide." }),
        el("p", { class: "petit", text: "Les steps notés dans tes cours y entrent tout seuls. Tu peux aussi en ajouter depuis la bibliothèque commune (« Ajouter à ma bibliothèque » dans la fiche d'un step)." })));
    } else if (!steps.length && (ma || triSteps === "az" || !createursSansStep().length)) {
      liste.append(el("div", { class: "vide", text: "Aucun step ne correspond." }));
    } else if (triSteps === "az") {
      liste.append(el("div", { class: "bloc-lignes" }, steps.map((s) => ligneDeStep(s, true, biblio))));
    } else {
      // Groupes par créateur (ordre alphabétique), « Créateur inconnu » à la fin
      const groupes = new Map();
      for (const s of steps) {
        if (!groupes.has(s.createur_id)) groupes.set(s.createur_id, []);
        groupes.get(s.createur_id).push(s);
      }
      // Commune : aussi les créateurs et crews qui n'ont encore aucun step (s'ils passent les filtres)
      if (!ma) for (const c of createursSansStep()) groupes.set(c.id, []);
      const ordre = [...groupes.keys()].sort((a, b) => {
        const ca = App.createur(a), cb = App.createur(b);
        if (!ca || !cb) return ca ? -1 : cb ? 1 : 0;
        return parNom(ca, cb);
      });
      for (const id of ordre) {
        const c = App.createur(id);
        const ses = groupes.get(id);
        const tete = c
          ? el("button", { type: "button", class: "groupe-tete", onclick: () => ouvrirFicheCreateur(c.id, "Steps") },
              avatar(c),
              el("span", { class: "ligne-texte" }, el("span", { class: "groupe-nom", text: c.nom }), el("span", { class: "ligne-sous", text: sousTitreGroupe(c, ses.length) })))
          : el("div", { class: "groupe-tete" }, lettre(null),
              el("span", { class: "ligne-texte" }, el("span", { class: "groupe-nom", text: "Créateur inconnu" }), el("span", { class: "ligne-sous", text: pluriel(ses.length, "step") })));
        const lignes = ses.length ? ses.map((s) => ligneDeStep(s, false, biblio))
          : [el("button", { type: "button", class: "ligne sans-step", onclick: () => ouvrirFicheCreateur(c.id, "Steps") },
              el("span", { class: "ligne-texte" }, el("span", { class: "ligne-sous", text: "Pas encore de step" })), icone(ICONES.chevron, 16, 2.4))];
        liste.append(el("section", { class: "groupe" + (ses.length ? "" : " groupe-vide") }, tete, el("div", { class: "bloc-lignes" }, lignes)));
      }
    }
  }
  dessinerListe();
}

// ---------- Dé : réglages puis tirage ----------
const reglagesDe = Object.assign({ nombre: 1, etiquettes: [], priorite: true }, lireLocal("reglages_de", {}));
const NOMBRES_DE = [1, 2, 3, 5, 10];

function ouvrirDe(bibliothequeDepart) {
  let parmi = bibliothequeDepart;
  App.ouvrirTiroir(reglages);

  function reglages(c) {
    c.replaceChildren();
    const vus = coursParStep();
    const ids = idsMaBiblio(vus);
    if (!ids.size) parmi = "commune";
    const choixNombre = el("div", { class: "choix-nombre", role: "group", "aria-label": "Combien de steps" },
      NOMBRES_DE.map((n) => el("button", { type: "button", "aria-pressed": reglagesDe.nombre === n ? "true" : "false",
        onclick: () => { reglagesDe.nombre = n; reglages(c); } }, String(n))));
    const choixParmi = App.aEspacePrive() ? el("div", { class: "segments deux choix-rubrique", role: "group", "aria-label": "Parmi" },
      el("button", { type: "button", "aria-pressed": parmi === "ma" ? "true" : "false", disabled: !ids.size, onclick: () => { parmi = "ma"; reglages(c); } }, "Ma bibliothèque"),
      el("button", { type: "button", "aria-pressed": parmi === "commune" ? "true" : "false", onclick: () => { parmi = "commune"; reglages(c); } }, "Commune")) : null;
    const choixEtiquettes = el("div", { class: "filtres", role: "group", "aria-label": "Étiquette" },
      ["gyal", "man", "neutre"].map((cle) => el("button", { type: "button", class: "filtre", "aria-pressed": reglagesDe.etiquettes.includes(cle) ? "true" : "false",
        onclick: () => {
          const i = reglagesDe.etiquettes.indexOf(cle);
          if (i >= 0) reglagesDe.etiquettes.splice(i, 1); else reglagesDe.etiquettes.push(cle);
          reglages(c);
        } }, ETIQUETTES[cle].nom)));
    const casePriorite = el("input", { type: "checkbox", checked: reglagesDe.priorite });
    casePriorite.addEventListener("change", () => { reglagesDe.priorite = casePriorite.checked; });

    c.append(...[   // (les « null » sont enlevés : append les écrirait en texte)
      el("span", { class: "tiroir-poignee", "aria-hidden": "true" }),
      el("div", { class: "tiroir-titre" }, el("h1", { text: "Tirer des steps" }),
        el("button", { type: "button", class: "lien-fermer", onclick: App.fermerFeuille }, "Fermer")),
      el("div", { class: "reglage" }, el("span", { class: "aide-titre", text: "Combien ?" }), choixNombre),
      choixParmi ? el("div", { class: "reglage" }, el("span", { class: "aide-titre", text: "Parmi" }), choixParmi) : null,
      el("div", { class: "reglage" }, el("span", { class: "aide-titre", text: "Étiquette" }), choixEtiquettes,
        el("span", { class: "aide", text: "Rien de choisi = toutes les étiquettes." })),
      parmi === "ma" ? el("label", { class: "interrupteur" },
        el("span", { class: "ligne-texte" }, el("span", { text: "Priorité « À travailler »" }), el("span", { class: "aide", text: "Ils sortent plus souvent." })),
        casePriorite) : null,
      el("button", { type: "button", class: "bouton-tirer", onclick: () => { ecrireLocal("reglages_de", reglagesDe); resultat(c); } },
        icone(ICONES.de, 22, 2.2), el("span", { text: reglagesDe.nombre > 1 ? "Tirer " + reglagesDe.nombre + " steps" : "Tirer un step" }))].filter(Boolean));
  }

  // Tirage sans remise ; « À travailler » compte triple si la priorité est choisie ; on évite si possible ceux du tirage d'avant
  function resultat(c) {
    const vus = coursParStep();
    const ids = idsMaBiblio(vus);
    const candidats = App.donnees.steps.filter((s) => (parmi !== "ma" || ids.has(s.id))
      && (!reglagesDe.etiquettes.length || reglagesDe.etiquettes.includes(s.etiquette)));
    const precedents = new Set(dernierTirage || []);
    let reste = candidats.filter((s) => !precedents.has(s.id));
    if (reste.length < Math.min(reglagesDe.nombre, candidats.length)) reste = candidats.slice();
    const poids = (s) => (parmi === "ma" && reglagesDe.priorite && (App.donnees.perso.get(s.id) || {}).a_travailler ? 3 : 1);
    const tires = [];
    while (tires.length < reglagesDe.nombre && reste.length) {
      let r = Math.random() * reste.reduce((t, s) => t + poids(s), 0);
      let i = 0;
      while (i < reste.length - 1 && (r -= poids(reste[i])) >= 0) i++;
      tires.push(reste.splice(i, 1)[0]);
    }
    dernierTirage = tires.map((s) => s.id);

    const resume = [parmi === "ma" ? "Ma bibliothèque" : "Commune",
      reglagesDe.etiquettes.length ? reglagesDe.etiquettes.map((e) => ETIQUETTES[e].nom).join(", ") : "toutes les étiquettes",
      parmi === "ma" && reglagesDe.priorite ? "priorité « À travailler »" : null].filter(Boolean).join(" · ");
    c.replaceChildren(...[
      el("span", { class: "tiroir-poignee", "aria-hidden": "true" }),
      el("div", { class: "tiroir-titre" }, el("h1", { text: tires.length > 1 ? "Tes " + tires.length + " steps" : "Ton step" }),
        el("button", { type: "button", class: "lien-fermer", onclick: App.fermerFeuille }, "Fermer")),
      el("p", { class: "aide", text: resume }),
      tires.length
        ? el("div", { class: "bloc-lignes" }, tires.map((s) => ligneDeStep(s, true, { ma: parmi === "ma", vus, ids })))
        : el("div", { class: "vide", text: "Aucun step ne correspond à ces réglages." }),
      tires.length && tires.length < reglagesDe.nombre ? el("p", { class: "aide", text: "Seulement " + pluriel(tires.length, "step") + " correspond" + (tires.length > 1 ? "ent" : "") + " à ces réglages." }) : null,
      el("div", { class: "ligne-boutons" },
        el("button", { type: "button", class: "bouton-tirer", disabled: !candidats.length, onclick: () => resultat(c) }, icone(ICONES.de, 22, 2.2), el("span", { text: "Relancer" })),
        el("button", { type: "button", class: "bouton-secondaire", onclick: () => reglages(c) }, "Réglages"))].filter(Boolean));
  }
}

App.enregistrerOnglet("steps", { titre: "Steps", icone: ICONES.steps, dessiner: dessinerSteps });

// ---------- Fiche d'un step ----------
function ouvrirFicheStep(id) {
  App.ouvrirFeuille((c) => remplirFicheStep(c, id), true);
}

function remplirFicheStep(c, id) {
  c.replaceChildren();
  const s = App.donnees.steps.find((x) => x.id === id);
  if (!s) { c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Steps")), el("div", { class: "vide", text: "Ce step n'existe plus." })); return; }
  const createur = App.createur(s.createur_id);

  c.append(el("div", { class: "feuille-haut" },
    App.boutonRetour("Steps"),
    App.peutEcrire() ? el("button", { type: "button", class: "bouton-principal", onclick: () => ouvrirFormulaireStep(s.id) }, "Modifier") : null));

  c.append(el("h1", { text: s.nom }));
  if (s.autres_noms) c.append(el("p", { class: "sous-titre", text: "aussi appelé : " + s.autres_noms }));

  const puces = el("div", { class: "puces" });
  puces.append(s.etiquette ? el("span", { class: "puce " + s.etiquette, text: ETIQUETTES[s.etiquette].lettre + " · " + ETIQUETTES[s.etiquette].nom })
    : el("span", { class: "puce", text: "Female / male / neutre : ?" }));
  const sousCat = App.sousCategorie(s.sous_categorie);
  if (sousCat) puces.append(el("span", { class: "puce sous-categorie", text: sousCat.nom }));
  puces.append(el("span", { class: "puce", text: s.epoque ? EPOQUES[s.epoque] : "Époque : ?" }));
  if (s.annee) puces.append(el("span", { class: "puce", text: String(s.annee) }));
  if (s.a_verifier) puces.append(el("span", { class: "puce", text: "À vérifier" }));
  c.append(puces);

  c.append(el("button", { type: "button", class: "carte-createur", disabled: !createur,
    onclick: () => createur && ouvrirFicheCreateur(createur.id, s.nom) },
    createur ? avatar(createur) : lettre(null),
    el("span", { class: "ligne-texte" },
      el("span", { class: "petit", text: "Créé par" }),
      el("span", { class: "ligne-titre", text: createur ? createur.nom : "Inconnu" }),
      createur ? el("span", { class: "petit", text: createur.type === "crew" ? "Crew" : "Personne" }) : null),
    createur ? icone(ICONES.chevron, 18, 2.4) : null));

  if (s.decomposition || s.chanson) {
    c.append(el("div", { class: "bloc" },
      el("h2", { text: "Décomposition" }),
      s.decomposition ? el("p", { text: s.decomposition }) : el("p", { class: "petit", text: "Pas encore de décomposition." }),
      s.chanson ? el("p", { class: "petit", text: "Chanson / riddim : " + s.chanson }) : null));
  }

  const liens = (s.liens || []).filter((l) => LIEN_VALIDE.test(l));
  for (const l of liens) {
    let hote = l;
    try { hote = new URL(l).hostname.replace(/^www\./, ""); } catch (e) { /* on garde le lien entier */ }
    c.append(el("a", { class: "lien-video", href: l, target: "_blank", rel: "noopener noreferrer" }, icone(ICONES.lien, 18, 2), hote));
  }

  if (s.note_attribution || s.sources) {
    c.append(el("div", { class: "bloc" },
      el("h2", { text: "Sources" }),
      s.note_attribution ? el("p", { text: s.note_attribution }) : null,
      s.sources ? el("p", { class: "petit", text: s.sources }) : null));
  }

  if (App.aEspacePrive()) c.append(blocBiblio(s.id));
  if (App.estEditrice()) {
    const m = App.modif("steps", s.id);
    if (m) c.append(el("p", { class: "tres-petit", text: "Modifié par " + m.prenom + " le " + dateLisible(m.modifie_le) }));
  }
}

// ---------- Ma bibliothèque (partie privée de la fiche) ----------
function blocBiblio(stepId) {
  const vus = coursParStep().get(stepId) || [];
  const p = App.donnees.perso.get(stepId) || { niveau: null, a_travailler: false, notes: null, dans_biblio: false, reperes: null, video: null };
  const dedans = vus.length > 0 || p.dans_biblio;
  const ecrire = App.peutEcrirePrive();

  // Pas encore dans ma bibliothèque : un seul bouton pour l'ajouter
  if (!dedans) {
    return el("div", { class: "bloc biblio-absent" },
      el("h2", { class: "titre-biblio", text: "Pas encore dans ta bibliothèque" }),
      el("p", { class: "petit", text: "Il y entrera tout seul dès que tu le noteras dans un cours. Appris ailleurs (stage, soirée, vidéo) ? Ajoute-le toi-même." }),
      ecrire ? el("div", { class: "ligne-boutons" }, el("button", { type: "button", class: "bouton-principal", onclick: async (e) => {
        e.currentTarget.disabled = true;
        if (await sauverPerso(stepId, { dans_biblio: true })) { message("Ajouté à ta bibliothèque"); App.rafraichir(); }
        else e.currentTarget.disabled = false;
      } }, icone(ICONES.plus, 18, 2.6), "Ajouter à ma bibliothèque")) : null);
  }

  const bloc = el("div", { class: "bloc prive" });
  bloc.append(el("div", { class: "prive-tete" },
    el("h2", { class: "titre-biblio", text: "Ma bibliothèque" }),
    el("span", { class: "petit toi-seule" }, icone(ICONES.cadenas, 13, 2.4), "Toi seule")));

  // Historique : chaque cours où je l'ai vu (le toucher ouvre le cours)
  const histo = el("div", { class: "historique" }, el("span", { class: "aide-titre", text: "Historique" }));
  if (vus.length) {
    histo.append(el("p", { class: "historique-resume", text: (vus.length > 1 ? "Vu " + vus.length + " fois · dernière fois le " : "Vu 1 fois · le ")
      + jourLong(vus[0].jour).replace(/^\S+ /, "").replace(/ \d{4}$/, "") }));
    for (const c of vus) {
      histo.append(el("button", { type: "button", class: "ligne-cours", onclick: () => ouvrirFicheCours(c.id, "Retour") },
        el("span", {}, el("b", { text: majuscule(jourCourt(c.jour)) }), nomProf(c) ? " · " + nomProf(c) : ""), icone(ICONES.chevron, 16, 2.4)));
    }
  } else histo.append(el("p", { class: "petit", text: "Ajouté à la main · pas encore vu en cours." }));
  bloc.append(histo);

  // Niveau (retoucher le niveau choisi l'enlève) et « À travailler » : enregistrés tout de suite
  const segments = el("div", { class: "segments", role: "group", "aria-label": "Niveau" });
  for (const [cle, nom] of Object.entries(NIVEAUX)) {
    segments.append(el("button", { type: "button", "aria-pressed": p.niveau === cle ? "true" : "false",
      onclick: async () => { if (await sauverPerso(stepId, { niveau: p.niveau === cle ? null : cle })) remplacer(); } }, nom));
  }
  bloc.append(el("span", { class: "aide-titre", text: "Niveau" }), segments);
  const caseTravail = el("input", { type: "checkbox", checked: !!p.a_travailler });
  caseTravail.addEventListener("change", async () => {
    if (!(await sauverPerso(stepId, { a_travailler: caseTravail.checked }))) caseTravail.checked = !caseTravail.checked;
  });
  bloc.append(el("label", { class: "interrupteur" }, "À travailler", caseTravail));

  // Mes repères et notes : un seul bouton
  const reperes = el("textarea", { "aria-label": "Mes repères", placeholder: "Sur quel temps il part, la variante de mon prof, le piège à éviter…", maxlength: "2000" });
  reperes.value = p.reperes || "";
  const notes = el("textarea", { "aria-label": "Mes notes", placeholder: "Mes notes sur ce step…", maxlength: "2000" });
  notes.value = p.notes || "";
  const boutonTextes = el("button", { type: "button", class: "bouton-secondaire", onclick: async () => {
    boutonTextes.disabled = true;
    if (await sauverPerso(stepId, { reperes: reperes.value.trim() || null, notes: notes.value.trim() || null })) message("Enregistré");
    boutonTextes.disabled = false;
  } }, "Enregistrer repères et notes");
  bloc.append(el("span", { class: "aide-titre", text: "Mes repères" }), reperes,
    el("span", { class: "aide-titre", text: "Notes" }), notes, el("div", { class: "ligne-boutons" }, boutonTextes));

  // Ma vidéo : un lien https (Drive, Instagram…) ; privé seulement si la vidéo n'est pas partagée « à tous ceux qui ont le lien »
  const zoneVideo = el("div", { class: "zone-video" });
  function dessinerVideo(enModification) {
    zoneVideo.replaceChildren(el("span", { class: "aide-titre", text: "Ma vidéo" }));
    if (p.video && LIEN_VALIDE.test(p.video) && !enModification) {
      zoneVideo.append(el("div", { class: "ligne-boutons" },
        el("a", { class: "bouton-principal lien-ma-video", href: p.video, target: "_blank", rel: "noopener noreferrer" }, icone("M8 5v14l11-7z", 16, 2), "Ouvrir ma vidéo"),
        ecrire ? el("button", { type: "button", class: "bouton-secondaire", onclick: () => dessinerVideo(true) }, "Changer") : null));
    } else if (ecrire) {
      const champ = el("input", { type: "url", inputmode: "url", "aria-label": "Lien de ma vidéo", placeholder: "https://drive.google.com/…", maxlength: "500", value: p.video || "" });
      const bouton = el("button", { type: "button", class: "bouton-secondaire", onclick: async () => {
        const lien = champ.value.trim();
        if (lien && !LIEN_VALIDE.test(lien)) { message("Le lien doit commencer par https://", true); return; }
        bouton.disabled = true;
        if (await sauverPerso(stepId, { video: lien || null })) { p.video = lien || null; message(lien ? "Lien enregistré" : "Lien enlevé"); dessinerVideo(false); }
        bouton.disabled = false;
      } }, "Enregistrer le lien");
      zoneVideo.append(champ, el("div", { class: "ligne-boutons" }, bouton));
    } else zoneVideo.append(el("p", { class: "petit", text: "Pas de vidéo." }));
    zoneVideo.append(el("p", { class: "aide", text: "Le lien reste privé seulement si la vidéo n'est pas partagée « à tous ceux qui ont le lien »." }));
  }
  dessinerVideo(false);
  bloc.append(zoneVideo);

  // Retirer : seulement un step ajouté à la main et jamais vu en cours ; ses infos sont gardées
  if (!vus.length && ecrire) {
    bloc.append(el("div", { class: "ligne-boutons" }, el("button", { type: "button", class: "bouton-secondaire", onclick: async (e) => {
      e.currentTarget.disabled = true;
      if (await sauverPerso(stepId, { dans_biblio: false })) { message("Retiré de ta bibliothèque (ses infos sont gardées)"); App.rafraichir(); }
      else e.currentTarget.disabled = false;
    } }, "Retirer de ma bibliothèque")));
  }

  if (!ecrire) {   // hors connexion : lecture seule (ouvrir un cours ou la vidéo reste possible)
    bloc.querySelectorAll("button:not(.ligne-cours), input").forEach((x) => { x.disabled = true; });
    reperes.readOnly = true;
    notes.readOnly = true;
  }

  function remplacer() { bloc.replaceWith(blocBiblio(stepId)); }
  return bloc;
}

// Met à jour la ligne privée si elle existe, sinon la crée (pas d'« upsert » : il demanderait le droit de modifier step_id)
async function sauverPerso(stepId, champs) {
  try {
    if (App.donnees.perso.has(stepId)) {
      const r = await App.client.from("perso_steps").update(champs).eq("step_id", stepId).select(COLONNES_PERSO);
      if (r.error) throw r.error;
      if (r.data.length) { App.donnees.perso.set(stepId, r.data[0]); App.sauverCopie(); return true; }
      // la ligne n'existe plus (supprimée ailleurs) : on la recrée
    }
    const r = await App.client.from("perso_steps").insert({ step_id: stepId, ...champs }).select(COLONNES_PERSO);
    if (r.error) throw r.error;
    App.donnees.perso.set(stepId, r.data[0]);
    App.sauverCopie();   // la copie hors connexion suit tout de suite
    return true;
  } catch (e) {
    message(erreurLisible(e), true);
    return false;
  }
}

// ---------- Formulaire (nouveau step ou modification) ----------
function ouvrirFormulaireStep(id) {
  const s = id ? App.donnees.steps.find((x) => x.id === id) : null;
  if (id && !s) { message("Ce step n'existe plus.", true); return; }
  const dateOuverture = s ? s.modifie_le : null;

  App.ouvrirFeuille((c) => {
    const f = el("form", { class: "formulaire", novalidate: true });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });

    const nom = el("input", { type: "text", maxlength: "80", required: true, value: s ? s.nom : "" });
    const autres = el("input", { type: "text", maxlength: "200", value: s ? s.autres_noms || "" : "", placeholder: "Séparés par des virgules" });

    const choixCreateur = el("select", { "aria-label": "Créateur" });
    function remplirCreateurs(choisi) {
      choixCreateur.replaceChildren(el("option", { value: "", text: "— Inconnu —" }));
      for (const cr of [...App.donnees.createurs].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))) {
        choixCreateur.append(el("option", { value: String(cr.id), text: cr.nom + (cr.type === "crew" ? " (crew)" : ""), selected: cr.id === choisi }));
      }
    }
    remplirCreateurs(s ? s.createur_id : null);
    const nouveauCreateur = el("button", { type: "button", class: "bouton-secondaire",
      onclick: () => ouvrirCreateurRapide((nouvelId) => remplirCreateurs(nouvelId)) }, "+ Nouveau créateur");

    const choixEpoque = el("select", { "aria-label": "Époque" },
      el("option", { value: "", text: "— Pas encore renseignée —" }),
      ...Object.entries(EPOQUES).map(([cle, n]) => el("option", { value: cle, text: n, selected: s && s.epoque === cle })));

    let etiquette = s ? s.etiquette : null;
    let sousCategorie = s ? s.sous_categorie || null : null;
    const segEtiquette = el("div", { class: "segments quatre", role: "group", "aria-label": "Female, male ou neutre" });
    const zoneSousCat = el("div", { class: "formulaire" });
    function dessinerEtiquette() {
      segEtiquette.replaceChildren(...[["gyal", "Female"], ["man", "Male"], ["neutre", "Neutre"], [null, "?"]].map(([cle, n]) =>
        el("button", { type: "button", "aria-pressed": etiquette === cle ? "true" : "false", onclick: () => { etiquette = cle; dessinerEtiquette(); } }, n)));
      // Sous-catégories de l'étiquette choisie (une au plus ; retoucher l'enlève)
      const choix = App.donnees.sousCategories.filter((sc) => sc.etiquette === etiquette);
      if (!choix.some((sc) => sc.cle === sousCategorie)) sousCategorie = null;
      zoneSousCat.replaceChildren();
      zoneSousCat.hidden = !choix.length;
      if (choix.length) zoneSousCat.append(el("span", { class: "aide", text: "Sous-catégorie" }),
        el("div", { class: "filtres", role: "group", "aria-label": "Sous-catégorie" }, choix.map((sc) =>
          el("button", { type: "button", class: "filtre", "aria-pressed": sousCategorie === sc.cle ? "true" : "false",
            onclick: () => { sousCategorie = sousCategorie === sc.cle ? null : sc.cle; dessinerEtiquette(); } }, sc.nom))));
    }
    dessinerEtiquette();

    const annee = el("input", { type: "number", inputmode: "numeric", min: "1950", max: "2100", value: s && s.annee ? String(s.annee) : "" });
    const decomposition = el("textarea", { maxlength: "3000" }); decomposition.value = s ? s.decomposition || "" : "";
    const chanson = el("input", { type: "text", maxlength: "150", value: s ? s.chanson || "" : "" });
    const liens = el("textarea", { placeholder: "Un lien par ligne (https://…)", autocapitalize: "off", autocorrect: "off", spellcheck: "false" });
    liens.value = s ? (s.liens || []).join("\n") : "";
    const note = el("textarea", { maxlength: "500" }); note.value = s ? s.note_attribution || "" : "";
    const sources = el("input", { type: "text", maxlength: "500", value: s ? s.sources || "" : "" });
    const aVerifier = el("input", { type: "checkbox", checked: s ? s.a_verifier : false });

    const enregistrer = el("button", { type: "submit", class: "bouton-principal" }, "Enregistrer");

    c.append(
      el("div", { class: "feuille-haut" }, App.boutonRetour("Annuler")),
      el("h1", { text: s ? "Modifier le step" : "Nouveau step" }),
      f);
    f.append(
      el("label", {}, "Nom *", nom),
      el("label", {}, "Autres noms ou orthographes", autres),
      el("label", {}, "Créé par", choixCreateur), el("div", { class: "ligne-boutons" }, nouveauCreateur),
      el("label", {}, "Époque", choixEpoque),
      el("div", { class: "formulaire" }, el("span", { class: "aide", text: "Female, male ou neutre" }), segEtiquette),
      zoneSousCat,
      el("label", {}, "Année (facultatif)", annee),
      el("label", {}, "Décomposition", decomposition),
      el("label", {}, "Chanson ou riddim", chanson),
      el("label", {}, "Liens vidéo", liens, el("span", { class: "aide", text: "Instagram, YouTube, Drive… un par ligne, commençant par https://" })),
      el("label", {}, "Note sur l'attribution", note),
      el("label", {}, "Sources", sources),
      el("label", { class: "interrupteur" }, "À vérifier", aVerifier),
      zoneErreur,
      el("div", { class: "ligne-boutons" }, enregistrer));

    if (s && App.estAdmin()) f.append(boutonSupprimerStep(s));

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      zoneErreur.textContent = "";
      // Vérifications avant d'écrire
      const valeurNom = nom.value.trim();
      if (!valeurNom) { zoneErreur.textContent = "Le nom est obligatoire."; return; }
      const listeLiens = liens.value.split("\n").map((l) => l.trim()).filter(Boolean);
      const mauvais = listeLiens.find((l) => !LIEN_VALIDE.test(l));
      if (mauvais) { zoneErreur.textContent = "Ce lien doit commencer par https:// : " + mauvais; return; }
      if (listeLiens.length > 10) { zoneErreur.textContent = "10 liens au plus."; return; }
      let valeurAnnee = null;
      if (annee.value.trim()) {
        valeurAnnee = Number(annee.value);
        if (!Number.isInteger(valeurAnnee) || valeurAnnee < 1950 || valeurAnnee > 2100) { zoneErreur.textContent = "L'année doit être entre 1950 et 2100."; return; }
      }
      const doublon = App.donnees.steps.find((x) => x.id !== (s && s.id) && sansAccents(x.nom) === sansAccents(valeurNom));
      if (doublon) { zoneErreur.textContent = "Un step s'appelle déjà « " + doublon.nom + " »."; return; }

      const valeurs = {
        nom: valeurNom,
        autres_noms: autres.value.trim() || null,
        createur_id: choixCreateur.value ? Number(choixCreateur.value) : null,
        epoque: choixEpoque.value || null,
        etiquette,
        sous_categorie: sousCategorie,
        annee: valeurAnnee,
        decomposition: decomposition.value.trim() || null,
        chanson: chanson.value.trim() || null,
        liens: listeLiens,
        note_attribution: note.value.trim() || null,
        sources: sources.value.trim() || null,
        a_verifier: aVerifier.checked,
      };

      enregistrer.disabled = true;
      try {
        let nouvelId = s ? s.id : null;
        if (s) {
          const r = await App.modifierFiche("steps", s.id, valeurs, dateOuverture);
          if (r.conflit) {
            await App.chargerTout();
            const m = App.modif("steps", s.id);
            zoneErreur.textContent = "Cette fiche a été modifiée entre-temps" + (m ? " par " + m.prenom : "") +
              ". Tes changements ne sont pas enregistrés : copie-les si besoin, puis rouvre la fiche.";
            enregistrer.disabled = false;
            return;
          }
        } else {
          const { data, error } = await App.client.from("steps").insert(valeurs).select("id").single();
          if (error) throw error;
          nouvelId = data.id;
        }
        await App.chargerTout();
        App.fermerFeuille();
        message("Step enregistré");
        App.rafraichir();
        if (!s) ouvrirFicheStep(nouvelId);
      } catch (err) {
        zoneErreur.textContent = erreurLisible(err);
        enregistrer.disabled = false;
      }
    });
  });
}

// Suppression en deux appuis (Emma seulement)
function boutonSupprimerStep(s) {
  let confirme = false;
  const bouton = el("button", { type: "button", class: "bouton-danger" }, "Supprimer ce step");
  bouton.addEventListener("click", async () => {
    if (!confirme) { confirme = true; bouton.textContent = "Confirmer la suppression"; bouton.classList.add("confirmer"); return; }
    bouton.disabled = true;
    const { data, error } = await App.client.from("steps").delete().eq("id", s.id).select("id");
    if (error || !data.length) { message(error ? erreurLisible(error) : "Suppression refusée.", true); bouton.disabled = false; return; }
    await App.chargerTout();
    App.fermerToutesLesFeuilles();
    App.redessiner();
    message("Step supprimé");
  });
  return el("div", { class: "ligne-boutons" }, bouton);
}

// ---------- Nouveau créateur (formulaire rapide) ----------
// typeImpose : "personne" pour ajouter un membre à un crew
function ouvrirCreateurRapide(quandCree, typeImpose) {
  App.ouvrirFeuille((c) => {
    const f = el("form", { class: "formulaire", novalidate: true });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });
    const nom = el("input", { type: "text", maxlength: "80", required: true });
    let type = typeImpose || "personne";
    let etiquette = null;
    const segType = el("div", { class: "segments", role: "group", "aria-label": "Crew ou personne" });
    const segEtiquette = el("div", { class: "segments", role: "group", "aria-label": "Female, male ou mixte" });
    function dessiner() {
      segType.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
      segType.replaceChildren(...[["personne", "Personne"], ["crew", "Crew"]].map(([cle, n]) =>
        el("button", { type: "button", "aria-pressed": type === cle ? "true" : "false", onclick: () => { type = cle; if (type === "personne" && etiquette === "mixte") etiquette = null; dessiner(); } }, n)));
      const choix = type === "crew" ? [["gyal", "Female"], ["man", "Male"], ["mixte", "Mixte"]] : [["gyal", "Female"], ["man", "Male"]];
      segEtiquette.style.gridTemplateColumns = "repeat(" + choix.length + ", minmax(0, 1fr))";
      segEtiquette.replaceChildren(...choix.map(([cle, n]) =>
        el("button", { type: "button", "aria-pressed": etiquette === cle ? "true" : "false", onclick: () => { etiquette = etiquette === cle ? null : cle; dessiner(); } }, n)));
    }
    dessiner();
    const creer = el("button", { type: "submit", class: "bouton-principal" }, "Créer");
    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Annuler")), el("h1", { text: "Nouveau créateur" }), f);
    f.append(el("label", {}, "Nom *", nom),
      typeImpose ? null : el("div", { class: "formulaire" }, el("span", { class: "aide", text: "Crew ou personne" }), segType),
      el("div", { class: "formulaire" }, el("span", { class: "aide", text: "Female, male (ou mixte pour un crew)" }), segEtiquette),
      el("p", { class: "petit", text: "Le lieu, l'histoire, les membres et la photo se remplissent ensuite dans la fiche du créateur (« Modifier »)." }),
      zoneErreur, el("div", { class: "ligne-boutons" }, creer));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      zoneErreur.textContent = "";
      const valeurNom = nom.value.trim();
      if (!valeurNom) { zoneErreur.textContent = "Le nom est obligatoire."; return; }
      if (App.donnees.createurs.some((x) => x.type === type && sansAccents(x.nom) === sansAccents(valeurNom))) {
        zoneErreur.textContent = "Ce créateur existe déjà."; return;
      }
      creer.disabled = true;
      const { data, error } = await App.client.from("createurs").insert({ nom: valeurNom, type, etiquette }).select("id").single();
      if (error) { zoneErreur.textContent = erreurLisible(error); creer.disabled = false; return; }
      await App.chargerTout();
      App.fermerFeuille();
      message("Créateur ajouté");
      quandCree(data.id);
      App.rafraichir();
    });
  });
}
