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

function stepsFiltres() {
  const mots = sansAccents(filtresSteps.recherche).split(/\s+/).filter(Boolean);
  const sousCats = sousCategoriesActives();
  return App.donnees.steps.filter((s) => {
    if (filtresSteps.aTravailler && App.estEditrice()) {
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

// ---------- Liste ----------
function dessinerSteps(contenu) {
  const actions = App.peutEcrire()
    ? [el("button", { type: "button", class: "bouton-rond", "aria-label": "Ajouter un step", onclick: () => ouvrirFormulaireStep(null) }, icone(ICONES.plus, 22, 2.6))]
    : [];
  contenu.append(App.entete("Steps", ...actions));

  const champ = el("input", { type: "search", placeholder: "Un step, un créateur, un mot…", "aria-label": "Rechercher un step",
    value: filtresSteps.recherche, autocomplete: "off" });
  champ.addEventListener("input", () => { filtresSteps.recherche = champ.value; dessinerListe(); });
  contenu.append(el("label", { class: "champ-recherche" }, icone(ICONES.loupe, 18), champ));

  // Filtres : « À travailler » (Emma et Jade), puis une ligne pour les époques, une ligne pour female / male / neutre
  const filtres = el("div", { class: "filtres-lignes", role: "group", "aria-label": "Filtres" });
  const pilule = (texte, actif, basculer) => el("button", { type: "button", class: "filtre", "aria-pressed": actif ? "true" : "false",
    onclick: () => { basculer(); sauverFiltres(); App.redessiner(); } }, texte);
  const basculerDans = (liste, valeur) => { const i = liste.indexOf(valeur); if (i >= 0) liste.splice(i, 1); else liste.push(valeur); };
  if (App.estEditrice()) filtres.append(el("div", { class: "filtres" },
    pilule("À travailler", filtresSteps.aTravailler, () => { filtresSteps.aTravailler = !filtresSteps.aTravailler; })));
  filtres.append(el("div", { class: "filtres rang" }, Object.entries(EPOQUES).map(([cle, nom]) =>
    pilule(nom, filtresSteps.epoques.includes(cle), () => basculerDans(filtresSteps.epoques, cle)))));
  filtres.append(el("div", { class: "filtres rang" }, ["gyal", "man", "neutre"].map((cle) =>
    pilule(ETIQUETTES[cle].nom, filtresSteps.etiquettes.includes(cle), () => {
      basculerDans(filtresSteps.etiquettes, cle);
      filtresSteps.sousCategories = sousCategoriesActives();   // décocher Female enlève aussi Waistline
    }))));
  // Sous-catégories : seulement sous une étiquette choisie (ex. « Waistline technique » quand Female est choisi)
  const sousCats = App.donnees.sousCategories.filter((sc) => filtresSteps.etiquettes.includes(sc.etiquette));
  if (sousCats.length) filtres.append(el("div", { class: "filtres sous-filtres" }, sousCats.map((sc) =>
    pilule(sc.nom, filtresSteps.sousCategories.includes(sc.cle), () => basculerDans(filtresSteps.sousCategories, sc.cle)))));
  contenu.append(filtres);

  const compte = el("p", { class: "compte" });
  const liste = el("div", { class: "liste" });
  contenu.append(compte, liste);

  const hasard = el("button", { type: "button", class: "bouton-hasard" });
  document.body.append(hasard);

  function dessinerListe() {
    const steps = stepsFiltres();
    compte.textContent = steps.length + (steps.length > 1 ? " steps" : " step");
    liste.replaceChildren();
    if (!steps.length) liste.append(el("div", { class: "vide", text: "Aucun step ne correspond." }));
    for (const s of steps) {
      const p = App.estEditrice() ? App.donnees.perso.get(s.id) : null;
      liste.append(el("button", { type: "button", class: "ligne", onclick: () => ouvrirFicheStep(s.id) },
        lettre(s.etiquette),
        el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: s.nom }), el("span", { class: "ligne-sous", text: sousTitreStep(s) })),
        p && p.niveau ? pastilleNiveau(p.niveau) : null));
    }
    hasard.replaceChildren(icone(ICONES.de, 22, 2), steps.length > 1 ? "Tirer un step parmi ces " + steps.length : "Tirer un step");
    hasard.disabled = steps.length === 0;
    hasard.onclick = () => {
      let choix = steps;
      if (steps.length > 1 && dernierTirage) choix = steps.filter((s) => s.id !== dernierTirage);
      const s = choix[Math.floor(Math.random() * choix.length)];
      dernierTirage = s.id;
      ouvrirFicheStep(s.id);
    };
  }
  dessinerListe();
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

  if (App.estEditrice()) {
    c.append(blocPrive(s.id));
    const m = App.modif("steps", s.id);
    if (m) c.append(el("p", { class: "tres-petit", text: "Modifié par " + m.prenom + " le " + dateLisible(m.modifie_le) }));
  }
}

// ---------- Partie privée ----------
function blocPrive(stepId) {
  const p = App.donnees.perso.get(stepId) || { niveau: null, a_travailler: false, notes: "" };
  const bloc = el("div", { class: "bloc prive" });
  bloc.append(el("h2", {}, icone(ICONES.cadenas, 14, 2.4), "Pour moi seule"));

  const segments = el("div", { class: "segments", role: "group", "aria-label": "Niveau" });
  for (const [cle, nom] of Object.entries(NIVEAUX)) {
    segments.append(el("button", { type: "button", "aria-pressed": p.niveau === cle ? "true" : "false",
      onclick: async () => {
        const nouveau = p.niveau === cle ? null : cle;   // retoucher le niveau choisi l'enlève
        if (await sauverPerso(stepId, { niveau: nouveau })) remplacerBloc();
      } }, nom));
  }
  bloc.append(segments);

  const caseTravail = el("input", { type: "checkbox", checked: !!p.a_travailler });
  caseTravail.addEventListener("change", async () => {
    if (!(await sauverPerso(stepId, { a_travailler: caseTravail.checked }))) caseTravail.checked = !caseTravail.checked;
  });
  bloc.append(el("label", { class: "interrupteur" }, "À travailler", caseTravail));

  const notes = el("textarea", { "aria-label": "Mes notes", placeholder: "Mes notes sur ce step…", maxlength: "2000" });
  notes.value = p.notes || "";
  const boutonNotes = el("button", { type: "button", class: "bouton-secondaire", onclick: async () => {
    boutonNotes.disabled = true;
    if (await sauverPerso(stepId, { notes: notes.value.trim() || null })) message("Note enregistrée");
    boutonNotes.disabled = false;
  } }, "Enregistrer la note");
  bloc.append(notes, el("div", { class: "ligne-boutons" }, boutonNotes));
  const vus = vuEnCours(stepId);   // cours.js
  if (vus) bloc.append(vus);
  if (App.horsLigne) {   // lecture seule
    bloc.querySelectorAll("button, input").forEach((x) => { x.disabled = true; });
    notes.readOnly = true;
    if (vus) vus.querySelectorAll("button").forEach((x) => { x.disabled = false; });   // ouvrir un cours reste possible
  }

  function remplacerBloc() { bloc.replaceWith(blocPrive(stepId)); }
  return bloc;
}

// Met à jour la ligne privée si elle existe, sinon la crée (pas d'« upsert » : il demanderait le droit de modifier step_id)
async function sauverPerso(stepId, champs) {
  const colonnes = "step_id, niveau, a_travailler, notes";
  try {
    if (App.donnees.perso.has(stepId)) {
      const r = await App.client.from("perso_steps").update(champs).eq("step_id", stepId).select(colonnes);
      if (r.error) throw r.error;
      if (r.data.length) { App.donnees.perso.set(stepId, r.data[0]); App.sauverCopie(); return true; }
      // la ligne n'existe plus (supprimée ailleurs) : on la recrée
    }
    const r = await App.client.from("perso_steps").insert({ step_id: stepId, ...champs }).select(colonnes);
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
