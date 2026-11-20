// cours.js — onglet Cours (privé : chaque membre, copines comprises, ne voit que ses cours) : liste par mois, fiche, formulaire,
// steps vus (choisis dans la base, ou créés à la volée par Emma et Jade), historique dans la fiche d'un step
"use strict";

let rechercheCours = "";

// ---------- Dates (un cours a un jour, sans heure) ----------
const formatJourCourt = new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const formatJourLong = new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const formatMois = new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", month: "long", year: "numeric" });
const formatJourSemaine = new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", weekday: "short" });
const formatMoisCourt = new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", month: "short" });
const formatJourMois = new Intl.DateTimeFormat("fr-BE", { timeZone: "UTC", day: "numeric", month: "short" });
const formatAujourdhui = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" });   // AAAA-MM-JJ

const versDate = (jour) => new Date(jour + "T12:00:00Z");   // midi UTC : jamais de décalage d'un jour
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function aujourdhui() { return formatAujourdhui.format(new Date()); }
function jourCourt(jour) { return formatJourCourt.format(versDate(jour)); }
function jourMois(jour) { return formatJourMois.format(versDate(jour)); }   // « 12 nov. »
function jourLong(jour) { return majuscule(formatJourLong.format(versDate(jour))); }

// ---------- Données ----------
function stepsDuCours(coursId) {
  return App.donnees.coursSteps
    .filter((cs) => cs.cours_id === coursId)
    .map((cs) => {
      const s = cs.step_id ? App.donnees.steps.find((x) => x.id === cs.step_id) : null;
      return { ...cs, step: s, nom: s ? s.nom : cs.nom_step };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

function nomProf(c) {
  const cr = c.prof_createur_id ? App.createur(c.prof_createur_id) : null;
  return cr ? cr.nom : c.prof_texte || "";
}

// Créateur dont le nom est exactement celui tapé (sans accents ni majuscules)
function createurParNom(texte) {
  const cle = sansAccents(texte.trim());
  return cle ? App.donnees.createurs.find((c) => sansAccents(c.nom) === cle) || null : null;
}

function coursFiltres() {
  const mots = sansAccents(rechercheCours).split(/\s+/).filter(Boolean);
  return App.donnees.cours.filter((c) => {
    if (!mots.length) return true;
    const texte = sansAccents([nomProf(c), c.prof_texte, c.salle, c.notes, ...stepsDuCours(c.id).map((x) => x.nom)].join(" "));
    return mots.every((m) => texte.includes(m));
  }).sort((a, b) => b.jour.localeCompare(a.jour) || b.id - a.id);
}

// ---------- Liste ----------
function dessinerCours(contenu) {
  contenu.append(App.entete({ titre: "Cours", surtitre: "Mes sessions",
    sous: el("span", { class: "sous-entete" }, icone(ICONES.cadenas, 13, 2.4), "Visibles par toi seule") },
    App.peutEcrirePrive() ? el("button", { type: "button", class: "bouton-rond", "aria-label": "Noter un cours", onclick: () => ouvrirFormulaireCours(null) }, icone(ICONES.plus, 22, 2.6)) : null));

  const champ = el("input", { type: "search", placeholder: "Un prof, une salle, un step…", "aria-label": "Rechercher un cours",
    value: rechercheCours, autocomplete: "off" });
  champ.addEventListener("input", () => { rechercheCours = champ.value; dessinerListe(); });
  contenu.append(el("label", { class: "champ-recherche" }, icone(ICONES.loupe, 18), champ));

  const liste = el("div", { class: "liste" });
  contenu.append(liste);

  function dessinerListe() {
    const cours = coursFiltres();
    liste.replaceChildren();
    if (!App.donnees.cours.length) { liste.append(el("div", { class: "vide", text: App.peutEcrirePrive() ? "Pas encore de cours. Touche + pour noter ton premier cours." : "Pas encore de cours." })); return; }
    if (!cours.length) { liste.append(el("div", { class: "vide", text: "Aucun cours ne correspond." })); return; }
    let moisCourant = null;
    for (const c of cours) {
      const mois = c.jour.slice(0, 7);
      if (mois !== moisCourant) {
        moisCourant = mois;
        liste.append(el("h2", { class: "titre-filet", text: majuscule(formatMois.format(versDate(c.jour))) }));
      }
      liste.append(ticketCours(c));
    }
  }
  dessinerListe();
}

// Un cours = un ticket : talon avec la date (bande vert-or-noir sur le bord, comme un bracelet de soirée),
// puis le prof, la salle et les steps vus (3 au plus, puis « + 2 »)
function ticketCours(c) {
  const date = versDate(c.jour);
  const vus = stepsDuCours(c.id);
  const montres = vus.slice(0, 3).map((x) => el("span", { class: "puce", text: x.nom }));
  if (vus.length > 3) montres.push(el("span", { class: "puce", text: "+ " + (vus.length - 3) }));
  return el("button", { type: "button", class: "ticket", onclick: () => ouvrirFicheCours(c.id),
    "aria-label": [jourLong(c.jour), nomProf(c), c.salle, pluriel(vus.length, "step")].filter(Boolean).join(", ") },
    el("span", { class: "talon", "aria-hidden": "true" },
      el("span", { class: "talon-semaine", text: formatJourSemaine.format(date).replace(".", "") }),
      el("span", { class: "talon-jour", text: String(Number(c.jour.slice(8, 10))) }),
      el("span", { class: "talon-mois", text: formatMoisCourt.format(date).replace(".", "") })),
    el("span", { class: "trous", "aria-hidden": "true" }),
    el("span", { class: "ticket-corps", "aria-hidden": "true" },
      el("span", { class: "ticket-prof", text: nomProf(c) || "Cours du " + jourCourt(c.jour) }),
      c.salle ? el("span", { class: "ticket-salle", text: c.salle }) : null,
      montres.length ? el("span", { class: "puces petites" }, montres) : el("span", { class: "ticket-salle", text: "Pas de step noté" })));
}

App.enregistrerOnglet("cours", { titre: "Cours", icone: ICONES.cours, visible: () => App.aEspacePrive(), dessiner: dessinerCours });

// ---------- Fiche d'un cours ----------
function ouvrirFicheCours(id, retour = "Cours") {
  App.ouvrirFeuille((c) => remplirFicheCours(c, id, retour), true);
}

function remplirFicheCours(c, id, retour) {
  c.replaceChildren();
  const cours = App.donnees.cours.find((x) => x.id === id);
  if (!cours) { c.append(el("div", { class: "feuille-haut" }, App.boutonRetour(retour)), el("div", { class: "vide", text: "Ce cours n'existe plus." })); return; }

  c.append(el("div", { class: "feuille-haut" }, App.boutonRetour(retour),
    App.peutEcrirePrive() ? el("button", { type: "button", class: "bouton-principal", onclick: () => ouvrirFormulaireCours(cours.id) }, "Modifier") : null));
  c.append(el("h1", { text: jourLong(cours.jour) }));
  if (cours.salle) c.append(el("p", { class: "sous-titre", text: cours.salle }));

  const prof = cours.prof_createur_id ? App.createur(cours.prof_createur_id) : null;
  if (prof) {
    c.append(el("button", { type: "button", class: "carte-createur", onclick: () => ouvrirFicheCreateur(prof.id, "Cours") },
      avatar(prof),
      el("span", { class: "ligne-texte" }, el("span", { class: "petit", text: "Prof" }), el("span", { class: "ligne-titre", text: prof.nom })),
      icone(ICONES.chevron, 18, 2.4)));
  } else if (cours.prof_texte) {
    c.append(el("div", { class: "bloc" }, el("h2", { text: "Prof" }), el("p", { text: cours.prof_texte })));
  }

  if (cours.lien_chore && LIEN_VALIDE.test(cours.lien_chore)) {
    let hote = cours.lien_chore;
    try { hote = new URL(cours.lien_chore).hostname.replace(/^www\./, ""); } catch (e) { /* on garde le lien entier */ }
    c.append(el("a", { class: "lien-video", href: cours.lien_chore, target: "_blank", rel: "noopener noreferrer" },
      icone(ICONES.lien, 18, 2), "Choré · " + hote));
  }

  const vus = stepsDuCours(cours.id);
  c.append(el("h2", { class: "titre-section", text: "Steps vus · " + vus.length }));
  c.append(el("div", { class: "liste" }, vus.length
    ? vus.map((v) => v.step ? ligneStep(v.step)
      : el("div", { class: "ligne supprime" }, lettre(null), el("span", { class: "ligne-texte" },
          el("span", { class: "ligne-titre", text: v.nom }), el("span", { class: "ligne-sous", text: "Step supprimé de la base" }))))
    : el("div", { class: "vide", text: "Aucun step noté." })));

  if (cours.notes) c.append(el("div", { class: "bloc" }, el("h2", { text: "Notes" }), el("p", { text: cours.notes })));
}

// ---------- Formulaire (nouveau cours ou modification) ----------
function ouvrirFormulaireCours(id) {
  const cours = id ? App.donnees.cours.find((x) => x.id === id) : null;
  if (id && !cours) { message("Ce cours n'existe plus.", true); return; }
  const dateOuverture = cours ? cours.modifie_le : null;

  App.ouvrirFeuille((c) => {
    const f = el("form", { class: "formulaire", novalidate: true });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });

    const jour = el("input", { type: "date", required: true, value: cours ? cours.jour : aujourdhui() });
    const prof = el("input", { type: "text", maxlength: "80", list: "liste-createurs", autocomplete: "off",
      value: cours ? nomProf(cours) : "", placeholder: "Nom du prof" });
    const listeCreateurs = el("datalist", { id: "liste-createurs" },
      ...[...App.donnees.createurs].sort(parNom).map((x) => el("option", { value: x.nom })));
    const aideProf = el("span", { class: "aide" });
    const majAideProf = () => {
      const cr = createurParNom(prof.value);
      aideProf.textContent = cr ? "✓ Relié à la fiche de " + cr.nom : "Si le nom est celui d'un créateur de la base, le cours est relié à sa fiche.";
    };
    prof.addEventListener("input", majAideProf);
    majAideProf();
    const salle = el("input", { type: "text", maxlength: "80", value: cours ? cours.salle || "" : "", placeholder: "Nom de la salle" });
    const lien = el("input", { type: "url", inputmode: "url", autocapitalize: "off", autocorrect: "off", spellcheck: "false",
      value: cours ? cours.lien_chore || "" : "", placeholder: "https://…" });
    const notes = el("textarea", { maxlength: "3000" }); notes.value = cours ? cours.notes || "" : "";

    // Steps vus : { csId (ligne déjà enregistrée), stepId (vide si supprimé de la base), nom }
    const choisis = cours ? stepsDuCours(cours.id).map((v) => ({ csId: v.id, stepId: v.step_id, nom: v.nom })) : [];
    const zoneChoisis = el("div", { class: "puces" });
    const rechercheStep = el("input", { type: "search", placeholder: "Chercher un step à ajouter…", "aria-label": "Chercher un step", autocomplete: "off" });
    const resultats = el("div", { class: "liste" });

    function dessinerChoisis() {
      zoneChoisis.replaceChildren(...choisis.map((x, i) =>
        el("span", { class: "puce choisie" + (x.stepId ? "" : " supprime") }, x.stepId ? x.nom : x.nom + " (supprimé)",
          el("button", { type: "button", class: "retirer", "aria-label": "Retirer " + x.nom,
            onclick: () => { choisis.splice(i, 1); dessinerChoisis(); dessinerResultats(); } }, "✕"))));
      if (!choisis.length) zoneChoisis.append(el("span", { class: "petit", text: "Aucun step pour l'instant." }));
    }
    function dessinerResultats() {
      resultats.replaceChildren();
      const texte = rechercheStep.value.trim();
      if (!texte) return;
      const mots = sansAccents(texte).split(/\s+/).filter(Boolean);
      const dejaLa = new Set(choisis.map((x) => x.stepId).filter(Boolean));
      const trouves = App.donnees.steps
        .filter((s) => !dejaLa.has(s.id) && mots.every((m) => sansAccents([s.nom, s.autres_noms].join(" ")).includes(m)))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr")).slice(0, 8);
      for (const s of trouves) {
        resultats.append(el("button", { type: "button", class: "ligne", onclick: () => {
          choisis.push({ csId: null, stepId: s.id, nom: s.nom });
          rechercheStep.value = "";
          dessinerChoisis(); dessinerResultats();
        } }, lettre(s.etiquette), el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: "+ " + s.nom }),
          el("span", { class: "ligne-sous", text: sousTitreStep(s) }))));
      }
      // Step absent de la base : Emma et Jade le créent tout de suite (nom seulement), à compléter dans l'onglet Steps ;
      // une copine ne peut pas écrire dans la base commune
      const absent = !App.donnees.steps.some((s) => sansAccents(s.nom) === sansAccents(texte));
      if (absent && !App.peutEcrire()) {
        resultats.append(el("p", { class: "aide", text: "Pas dans la base : demande à Emma ou Jade de l'ajouter, puis note-le ici." }));
      }
      if (absent && App.peutEcrire()) {
        const creer = el("button", { type: "button", class: "bouton-secondaire" }, "+ Nouveau step « " + texte + " »");
        creer.addEventListener("click", async () => {
          if (texte.length > 80) { message("80 caractères au plus pour le nom d'un step.", true); return; }
          creer.disabled = true;
          const { data, error } = await App.client.from("steps").insert({ nom: texte }).select("id, nom").single();
          if (error) { message(erreurLisible(error), true); creer.disabled = false; return; }
          await App.chargerTout();
          choisis.push({ csId: null, stepId: data.id, nom: data.nom });
          rechercheStep.value = "";
          dessinerChoisis(); dessinerResultats();
          message("Step créé : complète-le plus tard dans l'onglet Steps");
        });
        resultats.append(el("div", { class: "ligne-boutons" }, creer));
      }
    }
    rechercheStep.addEventListener("input", dessinerResultats);
    dessinerChoisis();

    const enregistrer = el("button", { type: "submit", class: "bouton-principal" }, "Enregistrer");
    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Annuler")),
      el("h1", { text: cours ? "Modifier le cours" : "Nouveau cours" }), f);
    f.append(
      el("label", {}, "Date *", jour),
      el("label", {}, "Prof", prof, listeCreateurs, aideProf),
      el("label", {}, "Salle", salle),
      el("div", { class: "bloc" }, el("h2", { text: "Steps vus" }), zoneChoisis, rechercheStep, resultats),
      el("label", {}, "Lien de la choré", lien),
      el("label", {}, "Notes", notes),
      zoneErreur,
      el("div", { class: "ligne-boutons" }, enregistrer));
    if (cours) f.append(boutonSupprimerCours(cours));

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      zoneErreur.textContent = "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(jour.value)) { zoneErreur.textContent = "La date est obligatoire."; return; }
      const valeurLien = lien.value.trim();
      if (valeurLien && !LIEN_VALIDE.test(valeurLien)) { zoneErreur.textContent = "Le lien doit commencer par https://"; return; }
      const cr = createurParNom(prof.value);
      const valeurs = {
        jour: jour.value,
        prof_texte: prof.value.trim() || null,     // gardé même si relié : utile si la fiche du créateur disparaît
        prof_createur_id: cr ? cr.id : null,
        salle: salle.value.trim() || null,
        lien_chore: valeurLien || null,
        notes: notes.value.trim() || null,
      };

      enregistrer.disabled = true;
      try {
        let coursId = cours ? cours.id : null;
        if (cours) {
          const r = await App.modifierFiche("cours", cours.id, valeurs, dateOuverture);
          if (r.conflit) {
            await App.chargerTout();
            zoneErreur.textContent = "Ce cours a été modifié entre-temps (sur un autre téléphone ?). Tes changements ne sont pas enregistrés : copie-les si besoin, puis rouvre le cours.";
            enregistrer.disabled = false;
            return;
          }
        } else {
          const { data, error } = await App.client.from("cours").insert(valeurs).select("id").single();
          if (error) throw error;
          coursId = data.id;
        }
        // Steps vus : on retire les lignes enlevées, on ajoute les nouvelles
        const gardes = new Set(choisis.map((x) => x.csId).filter(Boolean));
        for (const cs of App.donnees.coursSteps.filter((x) => x.cours_id === coursId && !gardes.has(x.id))) {
          const { error } = await App.client.from("cours_steps").delete().eq("id", cs.id);
          if (error) throw error;
        }
        const nouveaux = choisis.filter((x) => !x.csId && x.stepId).map((x) => ({ cours_id: coursId, step_id: x.stepId }));
        if (nouveaux.length) {
          const { error } = await App.client.from("cours_steps").insert(nouveaux);
          if (error) throw error;
        }
        await App.chargerTout();
        App.fermerFeuille();
        message("Cours enregistré");
        App.rafraichir();
        if (!cours) ouvrirFicheCours(coursId);
      } catch (err) {
        zoneErreur.textContent = erreurLisible(err);
        enregistrer.disabled = false;
      }
    });
  });
}

// Suppression en deux appuis (chacune ses propres cours)
function boutonSupprimerCours(cours) {
  let confirme = false;
  const bouton = el("button", { type: "button", class: "bouton-danger" }, "Supprimer ce cours");
  bouton.addEventListener("click", async () => {
    if (!confirme) { confirme = true; bouton.textContent = "Confirmer la suppression"; bouton.classList.add("confirmer"); return; }
    bouton.disabled = true;
    const { data, error } = await App.client.from("cours").delete().eq("id", cours.id).select("id");
    if (error || !data.length) { message(error ? erreurLisible(error) : "Suppression refusée.", true); bouton.disabled = false; return; }
    await App.chargerTout();
    App.fermerToutesLesFeuilles();
    App.redessiner();
    message("Cours supprimé");
  });
  return el("div", { class: "ligne-boutons" }, bouton);
}

