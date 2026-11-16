// createurs.js — liste des créateurs (mode « Liste » de l'onglet Carte), fiches crew et personne,
// formulaire, membres d'un crew, photo de profil (avec cadrage)
"use strict";

const TYPES = { crew: "Crews", personne: "Personnes" };
const COTE_PHOTO = 400;       // photo carrée de 400 × 400 px
const QUALITE_PHOTO = 0.82;   // JPEG

// Filtres gardés sur le téléphone (pas la recherche)
const filtresCreateurs = Object.assign(
  { recherche: "", epoques: [], etiquettes: [], types: [] },
  lireLocal("filtres_createurs", {})
);
function sauverFiltresCreateurs() {
  ecrireLocal("filtres_createurs", { epoques: filtresCreateurs.epoques, etiquettes: filtresCreateurs.etiquettes, types: filtresCreateurs.types });
}

// ---------- Petits outils ----------
const parNom = (a, b) => a.nom.localeCompare(b.nom, "fr");

function stepsDe(createurId) {
  return App.donnees.steps.filter((s) => s.createur_id === createurId).sort(parNom);
}

// Membres d'un crew : fondateurs d'abord, anciens à la fin
function membresDe(crewId) {
  return App.donnees.membres
    .filter((m) => m.crew_id === crewId)
    .map((m) => ({ ...m, personne: App.createur(m.personne_id) }))
    .filter((m) => m.personne)
    .sort((a, b) => (a.ancien - b.ancien) || (b.fondateur - a.fondateur) || parNom(a.personne, b.personne));
}

function crewsDe(personneId) {
  return App.donnees.membres
    .filter((m) => m.personne_id === personneId)
    .map((m) => ({ ...m, crew: App.createur(m.crew_id) }))
    .filter((m) => m.crew)
    .sort((a, b) => (a.ancien - b.ancien) || parNom(a.crew, b.crew));
}

function roleDansCrew(m) {
  return [m.fondateur ? "fondateur" : null, m.ancien ? "ancien membre" : null].filter(Boolean).join(" · ");
}

function pluriel(n, mot) { return n + " " + mot + (n > 1 ? "s" : ""); }

function sousTitreCreateur(c) {
  if (c.type === "crew") {
    return ["Crew", App.nomLieu(c.lieu_id) || null, pluriel(membresDe(c.id).length, "membre")].filter(Boolean).join(" · ");
  }
  const crews = crewsDe(c.id).filter((m) => !m.ancien).map((m) => m.crew.nom).join(", ");
  return [App.nomLieu(c.lieu_id) || null, crews || null, pluriel(stepsDe(c.id).length, "step")].filter(Boolean).join(" · ");
}

// Silhouette quand il n'y a pas de photo
function silhouette(taille) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", taille);
  svg.setAttribute("height", taille);
  svg.setAttribute("fill", "#B8AE98");
  svg.setAttribute("aria-hidden", "true");
  const tete = document.createElementNS(ns, "circle");
  tete.setAttribute("cx", "12"); tete.setAttribute("cy", "9"); tete.setAttribute("r", "4.4");
  const corps = document.createElementNS(ns, "path");
  corps.setAttribute("d", "M2.5 24c.8-5.2 4.6-8.4 9.5-8.4s8.7 3.2 9.5 8.4z");
  svg.append(tete, corps);
  return svg;
}

// Petite photo des listes (avec la lettre M / G / X dans le coin) ; sans photo : la lettre seule
function avatar(c) {
  const url = App.urlPhoto(c);
  const sansPhoto = () => lettre(c.etiquette, { carre: c.type === "personne" });
  if (!url) return sansPhoto();
  const bloc = el("span", { class: "avatar " + (ETIQUETTES[c.etiquette] ? c.etiquette : "inconnu") });
  const img = el("img", { src: url, alt: "", decoding: "async" });
  img.addEventListener("error", () => bloc.replaceWith(sansPhoto()));   // lien expiré ou pas de réseau
  const mini = lettre(c.etiquette);
  mini.classList.add("mini");
  bloc.append(img, mini);
  return bloc;
}

// Grande photo ronde de la fiche ; pour Emma et Jade, la toucher ouvre le changement de photo
function grandAvatar(c, ouvrirPhotoAuToucher = true) {
  const classe = ETIQUETTES[c.etiquette] ? c.etiquette : "inconnu";
  const rond = el("span", { class: "avatar-rond " + classe });
  const url = App.urlPhoto(c);
  if (url) {
    const img = el("img", { src: url, alt: "" });
    img.addEventListener("error", () => img.replaceWith(silhouette(56)));
    rond.append(img);
  } else {
    rond.append(silhouette(56));
  }
  const info = ETIQUETTES[c.etiquette];
  const pastille = el("span", { class: "avatar-pastille " + classe, "aria-hidden": "true" }, info ? info.lettre : "?");
  if (!App.estEditrice() || !ouvrirPhotoAuToucher) {
    return el("span", { class: "avatar-grand", role: "img", "aria-label": "Photo de " + c.nom }, rond, pastille);
  }
  return el("button", { type: "button", class: "avatar-grand", "aria-label": "Photo de " + c.nom + " (changer)", onclick: () => ouvrirPhoto(c.id) },
    rond, pastille, el("span", { class: "avatar-appareil", "aria-hidden": "true" }, icone(ICONES.photo, 13, 2.4)));
}

// Ligne d'une liste de steps (réutilisée dans les fiches)
function ligneStep(s) {
  return el("button", { type: "button", class: "ligne", onclick: () => ouvrirFicheStep(s.id) },
    lettre(s.etiquette),
    el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: s.nom }),
      el("span", { class: "ligne-sous", text: s.epoque ? EPOQUES[s.epoque] : "Époque : ?" })));
}

function ligneCreateur(c, sousTitre, quandOnTouche) {
  return el("button", { type: "button", class: "ligne", onclick: quandOnTouche },
    avatar(c),
    el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: c.nom }),
      sousTitre ? el("span", { class: "ligne-sous", text: sousTitre }) : null));
}

// ---------- Onglet Carte : liste des créateurs ----------
function createursFiltres() {
  const mots = sansAccents(filtresCreateurs.recherche).split(/\s+/).filter(Boolean);
  return App.donnees.createurs.filter((c) => {
    if (filtresCreateurs.types.length && !filtresCreateurs.types.includes(c.type)) return false;
    if (filtresCreateurs.etiquettes.length && !filtresCreateurs.etiquettes.includes(c.etiquette)) return false;
    if (filtresCreateurs.epoques.length && !(c.epoques || []).some((e) => filtresCreateurs.epoques.includes(e))) return false;
    if (mots.length) {
      const texte = sansAccents([c.nom, c.autres_noms, c.vrai_nom, App.nomLieu(c.lieu_id)].join(" "));
      if (!mots.every((m) => texte.includes(m))) return false;
    }
    return true;
  }).sort(parNom);
}

// Mode « Liste » de l'onglet Carte (boutonsMode : le choix Carte | Liste, fourni par carte.js)
function dessinerListeCreateurs(contenu, boutonsMode) {
  const actions = App.estEditrice()
    ? [el("button", { type: "button", class: "bouton-rond", "aria-label": "Ajouter un créateur", onclick: () => ouvrirFormulaireCreateur(null) }, icone(ICONES.plus, 22, 2.6))]
    : [];
  contenu.append(App.entete("Carte", ...actions));
  contenu.append(el("div", { class: "bandeau" }, boutonsMode));

  const champ = el("input", { type: "search", placeholder: "Un crew, une personne, un lieu…", "aria-label": "Rechercher un créateur",
    value: filtresCreateurs.recherche, autocomplete: "off" });
  champ.addEventListener("input", () => { filtresCreateurs.recherche = champ.value; dessinerListe(); });
  contenu.append(el("label", { class: "champ-recherche" }, icone(ICONES.loupe, 18), champ));

  const filtres = el("div", { class: "filtres", role: "group", "aria-label": "Filtres" });
  const basculerDans = (liste, valeur) => { const i = liste.indexOf(valeur); if (i >= 0) liste.splice(i, 1); else liste.push(valeur); };
  const pilule = (texte, liste, valeur) => el("button", { type: "button", class: "filtre", "aria-pressed": liste.includes(valeur) ? "true" : "false",
    onclick: () => { basculerDans(liste, valeur); sauverFiltresCreateurs(); App.redessiner(); } }, texte);
  for (const [cle, nom] of Object.entries(EPOQUES)) filtres.append(pilule(nom, filtresCreateurs.epoques, cle));
  for (const cle of ["man", "gyal", "mixte"]) filtres.append(pilule(ETIQUETTES[cle].nom, filtresCreateurs.etiquettes, cle));
  for (const [cle, nom] of Object.entries(TYPES)) filtres.append(pilule(nom, filtresCreateurs.types, cle));
  contenu.append(filtres);

  const compte = el("p", { class: "compte" });
  const liste = el("div", { class: "liste" });
  contenu.append(compte, liste);

  function dessinerListe() {
    const createurs = createursFiltres();
    compte.textContent = pluriel(createurs.length, "créateur");
    liste.replaceChildren();
    if (!createurs.length) liste.append(el("div", { class: "vide", text: "Aucun créateur ne correspond." }));
    for (const c of createurs) liste.append(ligneCreateur(c, sousTitreCreateur(c), () => ouvrirFicheCreateur(c.id, "Carte")));
  }
  dessinerListe();
}

// ---------- Fiche d'un créateur (crew ou personne) ----------
function ouvrirFicheCreateur(id, retour = "Retour") {
  App.ouvrirFeuille((c) => remplirFicheCreateur(c, id, retour), true);
}

function remplirFicheCreateur(c, id, retour) {
  c.replaceChildren();
  const cr = App.createur(id);
  if (!cr) { c.append(el("div", { class: "feuille-haut" }, App.boutonRetour(retour)), el("div", { class: "vide", text: "Ce créateur n'existe plus." })); return; }
  const estCrew = cr.type === "crew";

  c.append(el("div", { class: "feuille-haut" },
    App.boutonRetour(retour),
    App.estEditrice() ? el("button", { type: "button", class: "bouton-principal", onclick: () => ouvrirFormulaireCreateur(cr.id) }, "Modifier") : null));

  // Photo, nom, identité
  const identite = estCrew
    ? ["Crew", App.nomLieu(cr.lieu_id) || null].filter(Boolean).join(" · ")
    : [cr.vrai_nom, App.nomLieu(cr.lieu_id) || null].filter(Boolean).join(" · ");
  c.append(el("div", { class: "tete-createur" },
    grandAvatar(cr),
    el("div", { class: "tete-texte" },
      el("h1", { text: cr.nom }),
      identite ? el("p", { class: "petit", text: identite }) : null,
      cr.photo_chemin && cr.photo_credit ? el("p", { class: "tres-petit", text: "Photo : " + cr.photo_credit }) : null)));

  const puces = el("div", { class: "puces" });
  puces.append(cr.etiquette ? el("span", { class: "puce " + cr.etiquette, text: ETIQUETTES[cr.etiquette].lettre + " · " + ETIQUETTES[cr.etiquette].nom })
    : el("span", { class: "puce", text: (estCrew ? "Man / gyal / mixte" : "Man / gyal") + " : ?" }));
  if ((cr.epoques || []).length) for (const e of cr.epoques) puces.append(el("span", { class: "puce", text: EPOQUES[e] }));
  else puces.append(el("span", { class: "puce", text: "Époque : ?" }));
  if (cr.annee_debut) puces.append(el("span", { class: "puce", text: "depuis " + cr.annee_debut }));
  c.append(puces);
  if (cr.autres_noms) c.append(el("p", { class: "petit", text: "aussi : " + cr.autres_noms }));

  // Personne : ses crews
  if (!estCrew) {
    for (const m of crewsDe(cr.id)) {
      c.append(el("button", { type: "button", class: "carte-createur", onclick: () => ouvrirFicheCreateur(m.crew.id, cr.nom) },
        avatar(m.crew),
        el("span", { class: "ligne-texte" },
          el("span", { class: "petit", text: "Crew" }),
          el("span", { class: "ligne-titre", text: m.crew.nom }),
          roleDansCrew(m) ? el("span", { class: "petit", text: roleDansCrew(m) }) : null),
        icone(ICONES.chevron, 18, 2.4)));
    }
  }

  if (cr.histoire) c.append(el("div", { class: "bloc" }, el("h2", { text: "Histoire" }), el("p", { text: cr.histoire })));

  for (const l of (cr.liens || []).filter((x) => LIEN_VALIDE.test(x))) {
    let hote = l;
    try { hote = new URL(l).hostname.replace(/^www\./, ""); } catch (e) { /* on garde le lien entier */ }
    c.append(el("a", { class: "lien-video", href: l, target: "_blank", rel: "noopener noreferrer" }, icone(ICONES.lien, 18, 2), hote));
  }

  // Fiches d'histoire où il apparaît (savoir.js)
  const fiches = fichesDuCreateur(cr.id);
  if (fiches.length) {
    c.append(el("h2", { class: "titre-section", text: "Dans l'histoire · " + fiches.length }));
    c.append(el("div", { class: "liste" }, fiches.map((h) => el("button", { type: "button", class: "ligne", onclick: () => ouvrirFicheHistoire(h.id, cr.nom) },
      el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: h.titre }),
        el("span", { class: "ligne-sous", text: (h.epoques || []).map((e) => EPOQUES[e]).join(", ") || "Fiche d'histoire" })),
      icone(ICONES.chevron, 18, 2.4)))));
  }

  if (estCrew) {
    // Membres
    const membres = membresDe(cr.id);
    c.append(el("h2", { class: "titre-section", text: "Membres · " + membres.length }));
    const listeMembres = el("div", { class: "liste" });
    if (!membres.length) listeMembres.append(el("div", { class: "vide", text: "Pas encore de membre." }));
    for (const m of membres) listeMembres.append(ligneCreateur(m.personne, roleDansCrew(m), () => ouvrirFicheCreateur(m.personne.id, cr.nom)));
    c.append(listeMembres);
    if (App.estEditrice()) c.append(el("div", { class: "ligne-boutons" },
      el("button", { type: "button", class: "bouton-secondaire", onclick: () => ouvrirMembres(cr.id) }, "Gérer les membres")));

    // Steps du crew lui-même, puis steps de ses membres
    const stepsCrew = stepsDe(cr.id);
    c.append(el("h2", { class: "titre-section", text: "Steps du crew · " + stepsCrew.length }));
    c.append(el("div", { class: "liste" },
      stepsCrew.length ? stepsCrew.map(ligneStep) : el("div", { class: "vide", text: "Aucun step attribué au crew lui-même." })));

    const parMembre = membres.map((m) => ({ m, n: stepsDe(m.personne.id).length })).filter((x) => x.n > 0);
    const total = parMembre.reduce((somme, x) => somme + x.n, 0);
    c.append(el("h2", { class: "titre-section", text: "Steps des membres · " + total }));
    c.append(el("div", { class: "liste" },
      parMembre.length
        ? parMembre.map(({ m, n }) => ligneCreateur(m.personne, pluriel(n, "step"), () => ouvrirFicheCreateur(m.personne.id, cr.nom)))
        : el("div", { class: "vide", text: "Aucun step créé par un membre." })));
  } else {
    const steps = stepsDe(cr.id);
    c.append(el("h2", { class: "titre-section", text: "Steps créés · " + steps.length }));
    c.append(el("div", { class: "liste" }, steps.length ? steps.map(ligneStep) : el("div", { class: "vide", text: "Pas encore de step." })));
  }

  if (App.estEditrice()) {
    const m = App.modif("createurs", cr.id);
    if (m) c.append(el("p", { class: "tres-petit", text: "Modifié par " + m.prenom + " le " + dateLisible(m.modifie_le) }));
  }
}

// ---------- Formulaire (nouveau créateur ou modification) ----------
function ouvrirFormulaireCreateur(id) {
  const cr = id ? App.createur(id) : null;
  if (id && !cr) { message("Ce créateur n'existe plus.", true); return; }
  const dateOuverture = cr ? cr.modifie_le : null;
  // Crew ↔ personne : seulement s'il n'a ni membre ni crew (sinon les liens n'auraient plus de sens)
  const aDesLiens = !!cr && App.donnees.membres.some((m) => m.crew_id === cr.id || m.personne_id === cr.id);

  App.ouvrirFeuille((c) => {
    const f = el("form", { class: "formulaire", novalidate: true });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });

    let type = cr ? cr.type : "personne";
    let etiquette = cr ? cr.etiquette : null;
    const epoques = cr ? [...(cr.epoques || [])] : [];

    const nom = el("input", { type: "text", maxlength: "80", required: true, value: cr ? cr.nom : "" });
    const autres = el("input", { type: "text", maxlength: "200", value: cr ? cr.autres_noms || "" : "", placeholder: "Séparés par des virgules" });
    const vraiNom = el("input", { type: "text", maxlength: "100", value: cr ? cr.vrai_nom || "" : "" });
    const champVraiNom = el("label", {}, "Vrai nom (facultatif)", vraiNom);

    const segType = el("div", { class: "segments deux", role: "group", "aria-label": "Crew ou personne" });
    const segEtiquette = el("div", { class: "segments", role: "group", "aria-label": "Man, gyal ou mixte" });
    function dessinerChoix() {
      segType.replaceChildren(...[["personne", "Personne"], ["crew", "Crew"]].map(([cle, n]) =>
        el("button", { type: "button", disabled: aDesLiens, "aria-pressed": type === cle ? "true" : "false",
          onclick: () => { type = cle; if (type === "personne" && etiquette === "mixte") etiquette = null; dessinerChoix(); } }, n)));
      const choix = type === "crew" ? [["man", "Man"], ["gyal", "Gyal"], ["mixte", "Mixte"], [null, "?"]] : [["man", "Man"], ["gyal", "Gyal"], [null, "?"]];
      segEtiquette.className = "segments" + (choix.length === 4 ? " quatre" : "");
      segEtiquette.replaceChildren(...choix.map(([cle, n]) =>
        el("button", { type: "button", "aria-pressed": etiquette === cle ? "true" : "false", onclick: () => { etiquette = cle; dessinerChoix(); } }, n)));
      champVraiNom.hidden = type !== "personne";
    }
    dessinerChoix();

    // Lieux : chaque ville, suivie de ses quartiers (carte.js)
    const choixLieu = el("select", { "aria-label": "Lieu" });
    remplirChoixLieux(choixLieu, cr ? cr.lieu_id : null);
    const nouveauLieu = el("button", { type: "button", class: "bouton-secondaire",
      onclick: () => ouvrirNouveauLieu({ quandCree: (idLieu) => remplirChoixLieux(choixLieu, idLieu) }) }, "+ Nouveau lieu");

    const pilulesEpoques = el("div", { class: "filtres", role: "group", "aria-label": "Époques" });
    function dessinerEpoques() {
      pilulesEpoques.replaceChildren(...Object.entries(EPOQUES).map(([cle, n]) =>
        el("button", { type: "button", class: "filtre", "aria-pressed": epoques.includes(cle) ? "true" : "false", onclick: () => {
          const i = epoques.indexOf(cle); if (i >= 0) epoques.splice(i, 1); else epoques.push(cle);
          dessinerEpoques();
        } }, n)));
    }
    dessinerEpoques();

    const annee = el("input", { type: "number", inputmode: "numeric", min: "1950", max: "2100", value: cr && cr.annee_debut ? String(cr.annee_debut) : "" });
    const histoire = el("textarea", { maxlength: "5000" }); histoire.value = cr ? cr.histoire || "" : "";
    const liens = el("textarea", { placeholder: "Un lien par ligne (https://…)", autocapitalize: "off", autocorrect: "off", spellcheck: "false" });
    liens.value = cr ? (cr.liens || []).join("\n") : "";

    const enregistrer = el("button", { type: "submit", class: "bouton-principal" }, "Enregistrer");

    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Annuler")),
      el("h1", { text: cr ? "Modifier " + cr.nom : "Nouveau créateur" }), f);
    f.append(
      el("label", {}, "Nom *", nom),
      el("div", { class: "formulaire" }, el("span", { class: "aide", text: aDesLiens ? "Crew ou personne (ne change plus : il a des membres ou des crews)" : "Crew ou personne" }), segType),
      el("div", { class: "formulaire" }, el("span", { class: "aide", text: "Man, gyal (ou mixte pour un crew)" }), segEtiquette),
      el("label", {}, "Autres noms ou orthographes", autres),
      champVraiNom,
      el("label", {}, "Lieu (quartier ou ville)", choixLieu,
        el("span", { class: "aide", text: "Vide = « Lieu inconnu » sur la carte (sauf pour un membre d'un crew)." })),
      el("div", { class: "ligne-boutons" }, nouveauLieu),
      el("div", { class: "formulaire" }, el("span", { class: "aide", text: "Époques (une ou plusieurs)" }), pilulesEpoques),
      el("label", {}, "Année de début (facultatif)", annee),
      el("label", {}, "Histoire", histoire),
      el("label", {}, "Liens", liens, el("span", { class: "aide", text: "Instagram, YouTube… un par ligne, commençant par https://" })),
      cr ? null : el("p", { class: "petit", text: "La photo s'ajoute ensuite en touchant la silhouette dans la fiche." }),
      zoneErreur,
      el("div", { class: "ligne-boutons" }, enregistrer));
    if (cr && App.estAdmin()) f.append(boutonSupprimerCreateur(cr));

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      zoneErreur.textContent = "";
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
      const doublon = App.donnees.createurs.find((x) => x.id !== (cr && cr.id) && x.type === type && sansAccents(x.nom) === sansAccents(valeurNom));
      if (doublon) { zoneErreur.textContent = "Un " + (type === "crew" ? "crew" : "créateur") + " s'appelle déjà « " + doublon.nom + " »."; return; }

      const valeurs = {
        nom: valeurNom,
        type,
        etiquette,
        autres_noms: autres.value.trim() || null,
        vrai_nom: type === "personne" ? vraiNom.value.trim() || null : null,
        lieu_id: choixLieu.value ? Number(choixLieu.value) : null,
        epoques: Object.keys(EPOQUES).filter((cle) => epoques.includes(cle)),   // toujours dans le même ordre
        annee_debut: valeurAnnee,
        histoire: histoire.value.trim() || null,
        liens: listeLiens,
      };
      if (aDesLiens) delete valeurs.type;

      enregistrer.disabled = true;
      try {
        let nouvelId = cr ? cr.id : null;
        if (cr) {
          const r = await App.modifierFiche("createurs", cr.id, valeurs, dateOuverture);
          if (r.conflit) {
            await App.chargerTout();
            const m = App.modif("createurs", cr.id);
            zoneErreur.textContent = "Cette fiche a été modifiée entre-temps" + (m ? " par " + m.prenom : "") +
              ". Tes changements ne sont pas enregistrés : copie-les si besoin, puis rouvre la fiche.";
            enregistrer.disabled = false;
            return;
          }
        } else {
          const { data, error } = await App.client.from("createurs").insert(valeurs).select("id").single();
          if (error) throw error;
          nouvelId = data.id;
        }
        await App.chargerTout();
        App.fermerFeuille();
        message("Créateur enregistré");
        App.rafraichir();
        if (!cr) ouvrirFicheCreateur(nouvelId, "Carte");
      } catch (err) {
        zoneErreur.textContent = erreurLisible(err);
        enregistrer.disabled = false;
      }
    });
  });
}

// Suppression en deux appuis (Emma seulement). Refusée s'il a encore des steps.
function boutonSupprimerCreateur(cr) {
  let confirme = false;
  const bouton = el("button", { type: "button", class: "bouton-danger" }, "Supprimer ce créateur");
  bouton.addEventListener("click", async () => {
    const n = stepsDe(cr.id).length;
    if (n) { message("Il a encore " + pluriel(n, "step") + " : change d'abord leur créateur.", true); return; }
    if (!confirme) { confirme = true; bouton.textContent = "Confirmer la suppression"; bouton.classList.add("confirmer"); return; }
    bouton.disabled = true;
    const { data, error } = await App.client.from("createurs").delete().eq("id", cr.id).select("id");
    if (error || !data.length) { message(error ? erreurLisible(error) : "Suppression refusée.", true); bouton.disabled = false; return; }
    if (cr.photo_chemin) await App.client.storage.from("photos").remove([cr.photo_chemin]);   // la photo part avec la fiche
    await App.chargerTout();
    App.fermerToutesLesFeuilles();
    App.redessiner();
    message("Créateur supprimé");
  });
  return el("div", { class: "ligne-boutons" }, bouton);
}

// ---------- Membres d'un crew (Emma et Jade) ----------
function ouvrirMembres(crewId) {
  App.ouvrirFeuille((c) => {
    c.replaceChildren();
    const crew = App.createur(crewId);
    if (!crew) { c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Retour")), el("div", { class: "vide", text: "Ce crew n'existe plus." })); return; }
    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour(crew.nom)),
      el("h1", { text: "Membres" }), el("p", { class: "sous-titre", text: crew.nom }));

    for (const m of membresDe(crewId)) {
      const fondateur = el("input", { type: "checkbox", checked: m.fondateur });
      fondateur.addEventListener("change", () => changerMembre(m, { fondateur: fondateur.checked }));
      const ancien = el("input", { type: "checkbox", checked: m.ancien });
      ancien.addEventListener("change", () => changerMembre(m, { ancien: ancien.checked }));
      let confirme = false;
      const retirer = el("button", { type: "button", class: "bouton-danger" }, "Retirer du crew");
      retirer.addEventListener("click", () => {
        if (!confirme) { confirme = true; retirer.textContent = "Confirmer : retirer " + m.personne.nom; retirer.classList.add("confirmer"); return; }
        retirer.disabled = true;
        retirerMembre(m);
      });
      c.append(el("div", { class: "bloc" },
        el("div", { class: "ligne-membre" }, avatar(m.personne), el("span", { class: "ligne-titre", text: m.personne.nom })),
        el("label", { class: "interrupteur" }, "Fondateur", fondateur),
        el("label", { class: "interrupteur" }, "Ancien membre", ancien),
        el("div", { class: "ligne-boutons" }, retirer)));
    }

    // Ajouter une personne déjà dans la base, ou en créer une
    const dejaLa = new Set(App.donnees.membres.filter((m) => m.crew_id === crewId).map((m) => m.personne_id));
    const candidates = App.donnees.createurs.filter((x) => x.type === "personne" && !dejaLa.has(x.id)).sort(parNom);
    const choix = el("select", { "aria-label": "Personne à ajouter" }, el("option", { value: "", text: "— Choisir une personne —" }),
      ...candidates.map((x) => el("option", { value: String(x.id), text: x.nom })));
    const ajouter = el("button", { type: "button", class: "bouton-principal", onclick: () => {
      if (!choix.value) { message("Choisis d'abord une personne.", true); return; }
      ajouter.disabled = true;
      ajouterMembre(crewId, Number(choix.value));
    } }, "Ajouter");
    c.append(el("div", { class: "bloc" },
      el("h2", { text: "Ajouter un membre" }), choix,
      el("div", { class: "ligne-boutons" }, ajouter,
        el("button", { type: "button", class: "bouton-secondaire", onclick: () => ouvrirCreateurRapide((id) => ajouterMembre(crewId, id), "personne") }, "+ Nouvelle personne"))));
    c.append(el("p", { class: "petit", text: "Retirer quelqu'un du crew enlève seulement le lien : sa fiche et ses steps restent." }));
  }, true);
}

async function apresChangementMembres(texte) {
  await App.chargerTout();
  App.rafraichir();
  message(texte);
}

async function ajouterMembre(crewId, personneId) {
  const { error } = await App.client.from("membres_crew").insert({ crew_id: crewId, personne_id: personneId });
  if (error) { message(error.code === "23505" ? "Cette personne est déjà dans le crew." : erreurLisible(error), true); App.rafraichir(); return; }
  await apresChangementMembres("Membre ajouté");
}

async function changerMembre(m, champs) {
  const { data, error } = await App.client.from("membres_crew").update(champs)
    .eq("crew_id", m.crew_id).eq("personne_id", m.personne_id).select("crew_id");
  if (error || !data.length) {
    message(error ? erreurLisible(error) : "Ce membre n'est plus dans le crew.", true);
    await App.chargerTout();
    App.rafraichir();
    return;
  }
  await apresChangementMembres("Enregistré");
}

async function retirerMembre(m) {
  const { data, error } = await App.client.from("membres_crew").delete()
    .eq("crew_id", m.crew_id).eq("personne_id", m.personne_id).select("crew_id");
  if (error) { message(erreurLisible(error), true); App.rafraichir(); return; }
  await apresChangementMembres(data.length ? m.personne.nom + " retiré·e du crew" : "Déjà retiré·e");
}

// ---------- Photo de profil ----------
const COTE_MAX_SOURCE = 2400;   // la photo d'origine est d'abord ramenée à 2400 px au plus (cadrage fluide, mémoire)

// Ouvre la photo choisie (HEIC compris sur iPhone) et la ramène à 2400 px au plus sur son grand côté
async function ouvrirImage(fichier) {
  let image;
  if (window.createImageBitmap) {
    try { image = await createImageBitmap(fichier); } catch (e) { /* on essaie autrement */ }
  }
  if (!image) {
    const url = URL.createObjectURL(fichier);
    try { image = new Image(); image.src = url; await image.decode(); } finally { URL.revokeObjectURL(url); }
  }
  const grand = Math.max(image.width, image.height);
  if (grand <= COTE_MAX_SOURCE) return image;
  const r = COTE_MAX_SOURCE / grand;
  const reduite = document.createElement("canvas");
  reduite.width = Math.round(image.width * r);
  reduite.height = Math.round(image.height * r);
  reduite.getContext("2d").drawImage(image, 0, 0, reduite.width, reduite.height);
  if (image.close) image.close();
  return reduite;
}

// Cadre rond réglable : glisser un doigt pour déplacer, curseur pour zoomer (×1 à ×4).
// Le cadre reste toujours rempli. cadre.exporter() renvoie le carré visible, en JPEG 400 × 400.
function creerCadre(image, classe) {
  const TAILLE = 260;   // taille du cadre à l'écran (px)
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = el("canvas", { class: "cadre-photo " + classe, width: String(TAILLE * dpr), height: String(TAILLE * dpr),
    "aria-label": "Cadrage de la photo : glisse pour déplacer" });
  const ctx = canvas.getContext("2d");
  const largeur = image.width, hauteur = image.height;
  const echelleMin = TAILLE / Math.min(largeur, hauteur);   // zoom ×1 : le petit côté remplit le cadre
  let echelle = echelleMin;
  let x = (TAILLE - largeur * echelle) / 2;   // position du coin haut-gauche de la photo dans le cadre
  let y = (TAILLE - hauteur * echelle) / 2;

  function borner() {
    x = Math.min(0, Math.max(TAILLE - largeur * echelle, x));
    y = Math.min(0, Math.max(TAILLE - hauteur * echelle, y));
  }
  function dessiner() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, TAILLE, TAILLE);
    ctx.drawImage(image, x, y, largeur * echelle, hauteur * echelle);
  }

  // Glisser (doigt ou souris)
  let depart = null;
  canvas.addEventListener("pointerdown", (e) => {
    depart = { px: e.clientX, py: e.clientY, x, y, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!depart || e.pointerId !== depart.id) return;
    x = depart.x + (e.clientX - depart.px);
    y = depart.y + (e.clientY - depart.py);
    borner();
    dessiner();
  });
  const finir = (e) => { if (depart && e.pointerId === depart.id) depart = null; };
  canvas.addEventListener("pointerup", finir);
  canvas.addEventListener("pointercancel", finir);

  // Zoom autour du centre du cadre
  const curseur = el("input", { type: "range", min: "1", max: "4", step: "0.01", value: "1", "aria-label": "Zoom" });
  curseur.addEventListener("input", () => {
    const cx = (TAILLE / 2 - x) / echelle, cy = (TAILLE / 2 - y) / echelle;   // point de la photo au centre du cadre
    echelle = echelleMin * Number(curseur.value);
    x = TAILLE / 2 - cx * echelle;
    y = TAILLE / 2 - cy * echelle;
    borner();
    dessiner();
  });

  dessiner();
  return {
    element: el("div", { class: "cadre" }, canvas,
      el("label", { class: "zoom" }, el("span", { text: "−" }), curseur, el("span", { text: "+" })),
      el("p", { class: "petit centre", text: "Glisse la photo pour la placer dans le rond, zoome avec le curseur." })),
    // Carré visible, en pixels de la photo, réduit à 400 × 400
    async exporter() {
      const sortie = document.createElement("canvas");
      sortie.width = COTE_PHOTO; sortie.height = COTE_PHOTO;
      const cote = TAILLE / echelle;
      sortie.getContext("2d").drawImage(image, -x / echelle, -y / echelle, cote, cote, 0, 0, COTE_PHOTO, COTE_PHOTO);
      const blob = await new Promise((ok) => sortie.toBlob(ok, "image/jpeg", QUALITE_PHOTO));
      if (!blob) throw new Error("réduction impossible");
      return blob;
    },
    liberer() { if (image.close) image.close(); },
  };
}

function ouvrirPhoto(id) {
  const cr = App.createur(id);
  if (!cr || !App.estEditrice()) return;

  App.ouvrirFeuille((c) => {
    let cadre = null;   // photo choisie, pas encore envoyée
    const classe = ETIQUETTES[cr.etiquette] ? cr.etiquette : "inconnu";
    const zonePhoto = el("div", { class: "zone-photo" });
    const apercu = el("span", { class: "avatar-rond apercu " + classe });
    const urlActuelle = App.urlPhoto(cr);
    apercu.append(urlActuelle ? el("img", { src: urlActuelle, alt: "Photo actuelle" }) : silhouette(120));
    zonePhoto.append(apercu);

    const info = el("p", { class: "petit centre", text: cr.photo_chemin ? "Photo actuelle" : "Pas encore de photo" });
    const entree = el("input", { type: "file", accept: "image/*", class: "fichier-cache" });
    const choisir = el("label", { class: "bouton-secondaire bouton-fichier" }, cr.photo_chemin ? "Choisir une autre photo" : "Choisir une photo", entree);
    const credit = el("input", { type: "text", maxlength: "120", value: cr.photo_credit || "", placeholder: "Qui a pris la photo ?" });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });
    const enregistrer = el("button", { type: "button", class: "bouton-principal" }, "Enregistrer la photo");

    function majBouton() {
      const creditChange = (credit.value.trim() || null) !== (cr.photo_credit || null);
      enregistrer.disabled = !cadre && !(cr.photo_chemin && creditChange);
    }
    credit.addEventListener("input", majBouton);
    majBouton();

    entree.addEventListener("change", async () => {
      const fichier = entree.files[0];
      entree.value = "";   // permet de rechoisir la même photo
      if (!fichier) return;
      zoneErreur.textContent = "";
      info.textContent = "Ouverture de la photo…";
      let image;
      try {
        image = await ouvrirImage(fichier);
      } catch (e) {
        info.textContent = "";
        zoneErreur.textContent = "Impossible d'ouvrir cette photo. Essaie avec une autre.";
        return;
      }
      if (cadre) cadre.liberer();
      cadre = creerCadre(image, classe);
      zonePhoto.replaceChildren(cadre.element);
      info.textContent = "Nouvelle photo : pas encore envoyée";
      majBouton();
    });

    enregistrer.addEventListener("click", async () => {
      zoneErreur.textContent = "";
      enregistrer.disabled = true;
      const chemin = "createurs/" + cr.id + ".jpg";
      try {
        if (cadre) {
          const blob = await cadre.exporter();
          // upsert : remplace l'ancienne photo au même endroit. Cache court : les autres téléphones voient vite la nouvelle.
          const { error } = await App.client.storage.from("photos").upload(chemin, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "60" });
          if (error) throw error;
        }
        const { data, error } = await App.client.from("createurs")
          .update({ photo_chemin: cadre ? chemin : cr.photo_chemin, photo_credit: credit.value.trim() || null })
          .eq("id", cr.id).select("id");
        if (error) throw error;
        if (!data.length) throw new Error("Ce créateur n'existe plus.");
        if (cadre) cadre.liberer();
        await App.chargerTout();
        App.fermerFeuille();
        message("Photo enregistrée");
        App.rafraichir();
      } catch (e) {
        zoneErreur.textContent = erreurLisible(e);
        majBouton();
      }
    });

    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Annuler")),
      el("h1", { text: "Photo de " + cr.nom }),
      zonePhoto, info,
      el("div", { class: "ligne-boutons centre" }, choisir),
      el("label", {}, "Auteur de la photo (facultatif)", credit, el("span", { class: "aide", text: "Affiché en tout petit sous la photo : « Photo : … »" })),
      zoneErreur,
      el("div", { class: "ligne-boutons" }, enregistrer));
    if (cr.photo_chemin && App.estAdmin()) c.append(boutonSupprimerPhoto(cr));
  });
}

// Suppression de la photo en deux appuis (Emma seulement) : la fiche revient à la silhouette
function boutonSupprimerPhoto(cr) {
  let confirme = false;
  const bouton = el("button", { type: "button", class: "bouton-danger" }, "Supprimer la photo");
  bouton.addEventListener("click", async () => {
    if (!confirme) { confirme = true; bouton.textContent = "Confirmer la suppression"; bouton.classList.add("confirmer"); return; }
    bouton.disabled = true;
    const { data, error } = await App.client.from("createurs").update({ photo_chemin: null, photo_credit: null }).eq("id", cr.id).select("id");
    if (error || !data.length) { message(error ? erreurLisible(error) : "Suppression refusée.", true); bouton.disabled = false; return; }
    const r = await App.client.storage.from("photos").remove([cr.photo_chemin]);
    await App.chargerTout();
    App.fermerFeuille();
    App.rafraichir();
    message(r.error ? "Photo retirée de la fiche (le fichier n'a pas pu être effacé)" : "Photo supprimée");
  });
  return el("div", { class: "ligne-boutons" }, bouton);
}
