// savoir.js — onglet Savoir : lexique (cartes) et histoire (fiches par époque, avec les créateurs concernés)
"use strict";

let rechercheLexique = "";
let rechercheHistoire = "";
const filtresHistoire = Object.assign({ epoques: [] }, lireLocal("filtres_histoire", {}));

// ---------- Onglet ----------
function dessinerSavoir(contenu) {
  const mode = lireLocal("mode_savoir", "lexique") === "histoire" ? "histoire" : "lexique";
  const ajouter = App.peutEcrire()
    ? [el("button", { type: "button", class: "bouton-rond", "aria-label": mode === "lexique" ? "Ajouter un terme" : "Ajouter une fiche d'histoire",
        onclick: () => (mode === "lexique" ? ouvrirFormulaireTerme(null) : ouvrirFormulaireHistoire(null)) }, icone(ICONES.plus, 22, 2.6))]
    : [];
  contenu.append(App.entete("Savoir", ...ajouter));
  const changer = (m) => { ecrireLocal("mode_savoir", m); App.redessiner(); window.scrollTo(0, 0); };
  contenu.append(el("div", { class: "bandeau" }, el("div", { class: "segments deux mode-carte", role: "group", "aria-label": "Lexique ou histoire" },
    el("button", { type: "button", "aria-pressed": mode === "lexique" ? "true" : "false", onclick: () => changer("lexique") }, "Lexique"),
    el("button", { type: "button", "aria-pressed": mode === "histoire" ? "true" : "false", onclick: () => changer("histoire") }, "Histoire"))));
  if (mode === "lexique") dessinerLexique(contenu); else dessinerHistoire(contenu);
}

App.enregistrerOnglet("savoir", { titre: "Savoir", icone: ICONES.savoir, dessiner: dessinerSavoir });

// ---------- Lexique ----------
function termesFiltres() {
  const mots = sansAccents(rechercheLexique).split(/\s+/).filter(Boolean);
  return App.donnees.lexique
    .filter((t) => mots.every((m) => sansAccents([t.terme, t.definition, t.exemple].join(" ")).includes(m)))
    .sort((a, b) => a.terme.localeCompare(b.terme, "fr"));
}

function dessinerLexique(contenu) {
  const champ = el("input", { type: "search", placeholder: "Un terme, un mot de la définition…", "aria-label": "Rechercher un terme",
    value: rechercheLexique, autocomplete: "off" });
  champ.addEventListener("input", () => { rechercheLexique = champ.value; dessinerListe(); });
  contenu.append(el("label", { class: "champ-recherche" }, icone(ICONES.loupe, 18), champ));
  const compte = el("p", { class: "compte" });
  const liste = el("div", { class: "liste" });
  contenu.append(compte, liste);

  function dessinerListe() {
    const termes = termesFiltres();
    compte.textContent = pluriel(termes.length, "terme");
    liste.replaceChildren();
    if (!App.donnees.lexique.length) {
      liste.append(el("div", { class: "vide", text: App.peutEcrire() ? "Pas encore de terme. Touche + pour ajouter le premier." : "Pas encore de terme." }));
      return;
    }
    if (!termes.length) liste.append(el("div", { class: "vide", text: "Aucun terme ne correspond." }));
    for (const t of termes) liste.append(carteTerme(t));
  }
  dessinerListe();
}

// Carte complète d'un terme. Pour Emma et Jade, la toucher ouvre sa modification (sauf le lien).
function carteTerme(t) {
  const carte = el("div", { class: "carte-terme" + (App.peutEcrire() ? " modifiable" : "") },
    el("h3", { text: t.terme }),
    el("p", { text: t.definition }),
    t.exemple ? el("p", { class: "exemple", text: "Ex. : " + t.exemple }) : null,
    t.lien && LIEN_VALIDE.test(t.lien) ? el("a", { href: t.lien, target: "_blank", rel: "noopener noreferrer" }, icone(ICONES.lien, 15, 2.2), "Écouter un exemple") : null);
  if (App.peutEcrire()) {
    carte.setAttribute("role", "button");
    carte.setAttribute("tabindex", "0");
    carte.setAttribute("aria-label", "Modifier " + t.terme);
    carte.addEventListener("click", (e) => { if (!e.target.closest("a")) ouvrirFormulaireTerme(t.id); });
  }
  return carte;
}

function ouvrirFormulaireTerme(id) {
  const t = id ? App.donnees.lexique.find((x) => x.id === id) : null;
  if (id && !t) { message("Ce terme n'existe plus.", true); return; }
  const dateOuverture = t ? t.modifie_le : null;

  App.ouvrirFeuille((c) => {
    const f = el("form", { class: "formulaire", novalidate: true });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });
    const terme = el("input", { type: "text", maxlength: "60", required: true, value: t ? t.terme : "" });
    const definition = el("textarea", { maxlength: "1000", required: true }); definition.value = t ? t.definition : "";
    const exemple = el("input", { type: "text", maxlength: "300", value: t ? t.exemple || "" : "", placeholder: "Une phrase où on l'utilise" });
    const lien = el("input", { type: "url", inputmode: "url", autocapitalize: "off", autocorrect: "off", spellcheck: "false",
      value: t ? t.lien || "" : "", placeholder: "https://…" });
    const enregistrer = el("button", { type: "submit", class: "bouton-principal" }, "Enregistrer");
    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Annuler")),
      el("h1", { text: t ? "Modifier « " + t.terme + " »" : "Nouveau terme" }), f);
    f.append(el("label", {}, "Terme *", terme),
      el("label", {}, "Définition *", definition),
      el("label", {}, "Exemple", exemple),
      el("label", {}, "Lien (un exemple à écouter ou à voir)", lien),
      zoneErreur, el("div", { class: "ligne-boutons" }, enregistrer));
    if (t && App.estAdmin()) f.append(boutonSupprimer("Supprimer ce terme", async () => {
      const { data, error } = await App.client.from("lexique").delete().eq("id", t.id).select("id");
      return error || !data.length ? (error ? erreurLisible(error) : "Suppression refusée.") : null;
    }, "Terme supprimé"));

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      zoneErreur.textContent = "";
      const valeurTerme = terme.value.trim(), valeurDef = definition.value.trim(), valeurLien = lien.value.trim();
      if (!valeurTerme) { zoneErreur.textContent = "Le terme est obligatoire."; return; }
      if (!valeurDef) { zoneErreur.textContent = "La définition est obligatoire."; return; }
      if (valeurLien && !LIEN_VALIDE.test(valeurLien)) { zoneErreur.textContent = "Le lien doit commencer par https://"; return; }
      const doublon = App.donnees.lexique.find((x) => x.id !== (t && t.id) && sansAccents(x.terme) === sansAccents(valeurTerme));
      if (doublon) { zoneErreur.textContent = "« " + doublon.terme + " » est déjà dans le lexique."; return; }
      const valeurs = { terme: valeurTerme, definition: valeurDef, exemple: exemple.value.trim() || null, lien: valeurLien || null };
      enregistrer.disabled = true;
      try {
        if (t) {
          const r = await App.modifierFiche("lexique", t.id, valeurs, dateOuverture);
          if (r.conflit) { await messageConflit(zoneErreur, "lexique", t.id); enregistrer.disabled = false; return; }
        } else {
          const { error } = await App.client.from("lexique").insert(valeurs);
          if (error) throw error;
        }
        await App.chargerTout();
        App.fermerFeuille();
        message("Terme enregistré");
        App.rafraichir();
      } catch (err) {
        zoneErreur.textContent = erreurLisible(err);
        enregistrer.disabled = false;
      }
    });
  });
}

// ---------- Histoire ----------
function createursDeFiche(histoireId) {
  return App.donnees.histoireCreateurs
    .filter((hc) => hc.histoire_id === histoireId)
    .map((hc) => App.createur(hc.createur_id)).filter(Boolean).sort(parNom);
}

function fichesDuCreateur(createurId) {
  const ids = new Set(App.donnees.histoireCreateurs.filter((hc) => hc.createur_id === createurId).map((hc) => hc.histoire_id));
  return App.donnees.histoire.filter((h) => ids.has(h.id)).sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
}

// Rang d'une fiche : sa première époque (old → new), « sans époque » à la fin
const ORDRE_EPOQUES = Object.keys(EPOQUES);
function rangEpoque(h) {
  const rangs = (h.epoques || []).map((e) => ORDRE_EPOQUES.indexOf(e)).filter((i) => i >= 0);
  return rangs.length ? Math.min(...rangs) : ORDRE_EPOQUES.length;
}

function fichesFiltrees() {
  const mots = sansAccents(rechercheHistoire).split(/\s+/).filter(Boolean);
  return App.donnees.histoire.filter((h) => {
    if (filtresHistoire.epoques.length && !(h.epoques || []).some((e) => filtresHistoire.epoques.includes(e))) return false;
    const texte = sansAccents([h.titre, h.texte, ...createursDeFiche(h.id).map((c) => c.nom)].join(" "));
    return mots.every((m) => texte.includes(m));
  }).sort((a, b) => rangEpoque(a) - rangEpoque(b) || a.titre.localeCompare(b.titre, "fr"));
}

function dessinerHistoire(contenu) {
  const champ = el("input", { type: "search", placeholder: "Un titre, un mot, un créateur…", "aria-label": "Rechercher dans l'histoire",
    value: rechercheHistoire, autocomplete: "off" });
  champ.addEventListener("input", () => { rechercheHistoire = champ.value; dessinerListe(); });
  contenu.append(el("label", { class: "champ-recherche" }, icone(ICONES.loupe, 18), champ));
  const filtres = el("div", { class: "filtres", role: "group", "aria-label": "Époques" });
  for (const [cle, nom] of Object.entries(EPOQUES)) {
    filtres.append(el("button", { type: "button", class: "filtre", "aria-pressed": filtresHistoire.epoques.includes(cle) ? "true" : "false",
      onclick: () => {
        const i = filtresHistoire.epoques.indexOf(cle);
        if (i >= 0) filtresHistoire.epoques.splice(i, 1); else filtresHistoire.epoques.push(cle);
        ecrireLocal("filtres_histoire", filtresHistoire);
        App.redessiner();
      } }, nom));
  }
  contenu.append(filtres);
  const liste = el("div", { class: "liste" });
  contenu.append(liste);

  function dessinerListe() {
    const fiches = fichesFiltrees();
    liste.replaceChildren();
    if (!App.donnees.histoire.length) {
      liste.append(el("div", { class: "vide", text: App.peutEcrire() ? "Pas encore de fiche. Touche + pour écrire la première." : "Pas encore de fiche." }));
      return;
    }
    if (!fiches.length) { liste.append(el("div", { class: "vide", text: "Aucune fiche ne correspond." })); return; }
    let rangCourant = -1;
    for (const h of fiches) {
      const rang = rangEpoque(h);
      if (rang !== rangCourant) {
        rangCourant = rang;
        liste.append(el("h2", { class: "titre-section", text: rang < ORDRE_EPOQUES.length ? EPOQUES[ORDRE_EPOQUES[rang]] : "Sans époque" }));
      }
      const n = createursDeFiche(h.id).length;
      liste.append(el("button", { type: "button", class: "ligne", onclick: () => ouvrirFicheHistoire(h.id) },
        el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: h.titre }),
          el("span", { class: "ligne-sous", text: [(h.epoques || []).map((e) => EPOQUES[e]).join(", ") || null, n ? pluriel(n, "créateur") : null].filter(Boolean).join(" · ") || "Fiche d'histoire" })),
        icone(ICONES.chevron, 18, 2.4)));
    }
  }
  dessinerListe();
}

function ouvrirFicheHistoire(id, retour = "Savoir") {
  App.ouvrirFeuille((c) => remplirFicheHistoire(c, id, retour), true);
}

function remplirFicheHistoire(c, id, retour) {
  c.replaceChildren();
  const h = App.donnees.histoire.find((x) => x.id === id);
  if (!h) { c.append(el("div", { class: "feuille-haut" }, App.boutonRetour(retour)), el("div", { class: "vide", text: "Cette fiche n'existe plus." })); return; }
  c.append(el("div", { class: "feuille-haut" }, App.boutonRetour(retour),
    App.peutEcrire() ? el("button", { type: "button", class: "bouton-principal", onclick: () => ouvrirFormulaireHistoire(h.id) }, "Modifier") : null));
  c.append(el("h1", { text: h.titre }));
  c.append(el("div", { class: "puces" }, (h.epoques || []).length
    ? h.epoques.map((e) => el("span", { class: "puce", text: EPOQUES[e] }))
    : el("span", { class: "puce", text: "Époque : ?" })));
  if (h.texte) c.append(el("div", { class: "bloc" }, el("p", { text: h.texte })));
  for (const l of (h.liens || []).filter((x) => LIEN_VALIDE.test(x))) {
    let hote = l;
    try { hote = new URL(l).hostname.replace(/^www\./, ""); } catch (e) { /* on garde le lien entier */ }
    c.append(el("a", { class: "lien-video", href: l, target: "_blank", rel: "noopener noreferrer" }, icone(ICONES.lien, 18, 2), hote));
  }
  const createurs = createursDeFiche(h.id);
  if (createurs.length) {
    c.append(el("h2", { class: "titre-section", text: "Créateurs concernés · " + createurs.length }));
    c.append(el("div", { class: "liste" }, createurs.map((cr) => ligneCreateur(cr, sousTitreCreateur(cr), () => ouvrirFicheCreateur(cr.id, h.titre)))));
  }
  if (App.estEditrice()) {
    const m = App.modif("histoire", h.id);
    if (m) c.append(el("p", { class: "tres-petit", text: "Modifié par " + m.prenom + " le " + dateLisible(m.modifie_le) }));
  }
}

function ouvrirFormulaireHistoire(id) {
  const h = id ? App.donnees.histoire.find((x) => x.id === id) : null;
  if (id && !h) { message("Cette fiche n'existe plus.", true); return; }
  const dateOuverture = h ? h.modifie_le : null;

  App.ouvrirFeuille((c) => {
    const f = el("form", { class: "formulaire", novalidate: true });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });
    const titre = el("input", { type: "text", maxlength: "120", required: true, value: h ? h.titre : "" });
    const epoques = h ? [...(h.epoques || [])] : [];
    const pilules = el("div", { class: "filtres", role: "group", "aria-label": "Époques" });
    function dessinerEpoques() {
      pilules.replaceChildren(...Object.entries(EPOQUES).map(([cle, n]) =>
        el("button", { type: "button", class: "filtre", "aria-pressed": epoques.includes(cle) ? "true" : "false", onclick: () => {
          const i = epoques.indexOf(cle); if (i >= 0) epoques.splice(i, 1); else epoques.push(cle);
          dessinerEpoques();
        } }, n)));
    }
    dessinerEpoques();
    const texte = el("textarea", { maxlength: "10000", class: "grand", required: true }); texte.value = h ? h.texte : "";
    const liens = el("textarea", { placeholder: "Un lien par ligne (https://…)", autocapitalize: "off", autocorrect: "off", spellcheck: "false" });
    liens.value = h ? (h.liens || []).join("\n") : "";

    // Créateurs concernés : recherche + puces à retirer
    const choisis = h ? createursDeFiche(h.id).map((cr) => cr.id) : [];
    const zoneChoisis = el("div", { class: "puces" });
    const recherche = el("input", { type: "search", placeholder: "Chercher un créateur à ajouter…", "aria-label": "Chercher un créateur", autocomplete: "off" });
    const resultats = el("div", { class: "liste" });
    function dessinerChoisis() {
      zoneChoisis.replaceChildren(...choisis.map((cid, i) => {
        const cr = App.createur(cid);
        return el("span", { class: "puce choisie" }, cr ? cr.nom : "?",
          el("button", { type: "button", class: "retirer", "aria-label": "Retirer " + (cr ? cr.nom : ""),
            onclick: () => { choisis.splice(i, 1); dessinerChoisis(); dessinerResultats(); } }, "✕"));
      }));
      if (!choisis.length) zoneChoisis.append(el("span", { class: "petit", text: "Aucun créateur pour l'instant." }));
    }
    function dessinerResultats() {
      resultats.replaceChildren();
      const mots = sansAccents(recherche.value).split(/\s+/).filter(Boolean);
      if (!mots.length) return;
      const trouves = App.donnees.createurs
        .filter((cr) => !choisis.includes(cr.id) && mots.every((m) => sansAccents([cr.nom, cr.autres_noms, cr.vrai_nom].join(" ")).includes(m)))
        .sort(parNom).slice(0, 8);
      if (!trouves.length) resultats.append(el("p", { class: "petit", text: "Aucun créateur trouvé (crée-le d'abord dans l'onglet Carte → Liste)." }));
      for (const cr of trouves) {
        resultats.append(ligneCreateur(cr, "+ Ajouter", () => { choisis.push(cr.id); recherche.value = ""; dessinerChoisis(); dessinerResultats(); }));
      }
    }
    recherche.addEventListener("input", dessinerResultats);
    dessinerChoisis();

    const enregistrer = el("button", { type: "submit", class: "bouton-principal" }, "Enregistrer");
    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Annuler")),
      el("h1", { text: h ? "Modifier la fiche" : "Nouvelle fiche d'histoire" }), f);
    f.append(el("label", {}, "Titre *", titre),
      el("div", { class: "formulaire" }, el("span", { class: "aide", text: "Époques (une ou plusieurs)" }), pilules),
      el("label", {}, "Texte *", texte),
      el("div", { class: "bloc" }, el("h2", { text: "Créateurs concernés" }), zoneChoisis, recherche, resultats),
      el("label", {}, "Liens", liens, el("span", { class: "aide", text: "Un par ligne, commençant par https:// (10 au plus)" })),
      zoneErreur, el("div", { class: "ligne-boutons" }, enregistrer));
    if (h && App.estAdmin()) f.append(boutonSupprimer("Supprimer cette fiche", async () => {
      const { data, error } = await App.client.from("histoire").delete().eq("id", h.id).select("id");
      return error || !data.length ? (error ? erreurLisible(error) : "Suppression refusée.") : null;
    }, "Fiche supprimée"));

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      zoneErreur.textContent = "";
      const valeurTitre = titre.value.trim(), valeurTexte = texte.value.trim();
      if (!valeurTitre) { zoneErreur.textContent = "Le titre est obligatoire."; return; }
      if (!valeurTexte) { zoneErreur.textContent = "Le texte est obligatoire."; return; }
      const listeLiens = liens.value.split("\n").map((l) => l.trim()).filter(Boolean);
      const mauvais = listeLiens.find((l) => !LIEN_VALIDE.test(l));
      if (mauvais) { zoneErreur.textContent = "Ce lien doit commencer par https:// : " + mauvais; return; }
      if (listeLiens.length > 10) { zoneErreur.textContent = "10 liens au plus."; return; }
      const valeurs = { titre: valeurTitre, epoques: ORDRE_EPOQUES.filter((cle) => epoques.includes(cle)), texte: valeurTexte, liens: listeLiens };
      enregistrer.disabled = true;
      try {
        let ficheId = h ? h.id : null;
        if (h) {
          const r = await App.modifierFiche("histoire", h.id, valeurs, dateOuverture);
          if (r.conflit) { await messageConflit(zoneErreur, "histoire", h.id); enregistrer.disabled = false; return; }
        } else {
          const { data, error } = await App.client.from("histoire").insert(valeurs).select("id").single();
          if (error) throw error;
          ficheId = data.id;
        }
        // Créateurs concernés : on retire les liens enlevés, on ajoute les nouveaux
        const avant = App.donnees.histoireCreateurs.filter((hc) => hc.histoire_id === ficheId).map((hc) => hc.createur_id);
        for (const cid of avant.filter((x) => !choisis.includes(x))) {
          const { error } = await App.client.from("histoire_createurs").delete().eq("histoire_id", ficheId).eq("createur_id", cid);
          if (error) throw error;
        }
        const nouveaux = choisis.filter((x) => !avant.includes(x)).map((cid) => ({ histoire_id: ficheId, createur_id: cid }));
        if (nouveaux.length) {
          const { error } = await App.client.from("histoire_createurs").insert(nouveaux);
          if (error) throw error;
        }
        await App.chargerTout();
        App.fermerFeuille();
        message("Fiche enregistrée");
        App.rafraichir();
        if (!h) ouvrirFicheHistoire(ficheId);
      } catch (err) {
        zoneErreur.textContent = erreurLisible(err);
        enregistrer.disabled = false;
      }
    });
  });
}

// ---------- Outils communs ----------
async function messageConflit(zone, table, id) {
  await App.chargerTout();
  const m = App.modif(table, id);
  zone.textContent = "Cette fiche a été modifiée entre-temps" + (m ? " par " + m.prenom : "") +
    ". Tes changements ne sont pas enregistrés : copie-les si besoin, puis rouvre la fiche.";
}

// Suppression en deux appuis (Emma seulement). supprimer() renvoie un message d'erreur, ou null si c'est fait.
function boutonSupprimer(texte, supprimer, messageFait) {
  let confirme = false;
  const bouton = el("button", { type: "button", class: "bouton-danger" }, texte);
  bouton.addEventListener("click", async () => {
    if (!confirme) { confirme = true; bouton.textContent = "Confirmer la suppression"; bouton.classList.add("confirmer"); return; }
    bouton.disabled = true;
    const erreur = await supprimer();
    if (erreur) { message(erreur, true); bouton.disabled = false; return; }
    await App.chargerTout();
    App.fermerToutesLesFeuilles();
    App.redessiner();
    message(messageFait);
  });
  return el("div", { class: "ligne-boutons" }, bouton);
}
