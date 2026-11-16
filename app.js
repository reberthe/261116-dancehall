// app.js — cœur de l'appli : connexion, chargement des données, onglets, feuilles, petits outils
"use strict";

const App = {
  client: null,
  profil: null,                 // { role, prenom } de la personne connectée
  donnees: {
    steps: [],
    createurs: [],
    perso: new Map(),           // step_id → ligne de perso_steps (partie privée)
    modifs: new Map(),          // "table:id" → { prenom, modifie_le } (Emma et Jade seulement)
  },
  onglets: {},
  ordreOnglets: [],
  ongletActif: "steps",
  feuilles: [],
  derniereLecture: 0,
};

// ---------- Libellés ----------
const ETIQUETTES = {
  man: { lettre: "M", nom: "Man" },
  gyal: { lettre: "G", nom: "Gyal" },
  neutre: { lettre: "N", nom: "Neutre" },
  mixte: { lettre: "X", nom: "Mixte" },
};
const EPOQUES = { old_school: "Old school", middle_school: "Middle school", new_school: "New school" };
const NIVEAUX = { a_apprendre: "À apprendre", en_cours: "En cours", maitrise: "Maîtrisé" };
const LIEN_VALIDE = /^https:\/\/\S+$/;

// ---------- Outils ----------

// Crée un élément. Le texte passe toujours par textContent : jamais de HTML venant des données.
function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(attrs)) {
    if (valeur === undefined || valeur === null || valeur === false) continue;
    if (cle === "text") e.textContent = valeur;
    else if (cle === "class") e.className = valeur;
    else if (cle.startsWith("on") && typeof valeur === "function") e.addEventListener(cle.slice(2), valeur);
    else if (["value", "checked", "disabled", "hidden", "selected"].includes(cle)) e[cle] = valeur;
    else e.setAttribute(cle, valeur === true ? "" : String(valeur));
  }
  for (const enfant of enfants.flat()) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    e.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return e;
}

// Icône SVG à partir d'un tracé (dessins fixes, écrits dans le code)
function icone(trace, taille = 20, epaisseur = 2.2) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", taille);
  svg.setAttribute("height", taille);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", epaisseur);
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", trace);
  svg.append(p);
  return svg;
}
const ICONES = {
  plus: "M12 5v14M5 12h14",
  retour: "M15 5l-7 7 7 7",
  chevron: "M9 5l7 7-7 7",
  loupe: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14M20 20l-3.5-3.5",
  lien: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  cadenas: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  de: "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M9 9h.01M15 9h.01M9 15h.01M15 15h.01",
  steps: "M9 18V5l11-2v13M6 15a3 3 0 1 0 0 6a3 3 0 1 0 0-6M17 13a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
  carte: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5",
  cours: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M3 10h18M8 3v4M16 3v4",
  savoir: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
};

// Pastille M / G / N / X (« ? » si pas encore renseigné)
function lettre(etiquette, options = {}) {
  const info = ETIQUETTES[etiquette];
  const classes = ["lettre", info ? etiquette : "inconnu", options.carre ? "carre" : "", options.petite ? "petite" : ""].join(" ");
  return el("span", { class: classes, "aria-label": info ? info.nom : "Pas encore renseigné" }, info ? info.lettre : "?");
}

// Petit rond du niveau : vide, à moitié plein, plein
function iconeNiveau(niveau) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("aria-hidden", "true");
  const rond = document.createElementNS(ns, "circle");
  rond.setAttribute("cx", "6"); rond.setAttribute("cy", "6"); rond.setAttribute("r", "5");
  rond.setAttribute("fill", niveau === "maitrise" ? "currentColor" : "none");
  rond.setAttribute("stroke", "currentColor"); rond.setAttribute("stroke-width", "1.6");
  svg.append(rond);
  if (niveau === "en_cours") {
    const moitie = document.createElementNS(ns, "path");
    moitie.setAttribute("d", "M6 1a5 5 0 0 1 0 10z");
    moitie.setAttribute("fill", "currentColor");
    svg.append(moitie);
  }
  return svg;
}

// Pour chercher sans accents ni majuscules
function sansAccents(texte) {
  return (texte || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Date lisible en heure de Bruxelles
const formatDate = new Intl.DateTimeFormat("fr-BE", { timeZone: "Europe/Brussels", dateStyle: "short", timeStyle: "short" });
function dateLisible(iso) { return iso ? formatDate.format(new Date(iso)) : ""; }

// Stockage du téléphone (peut être indisponible : on ne plante jamais)
function lireLocal(cle, defaut) {
  try { const v = localStorage.getItem("dh_" + cle); return v === null ? defaut : JSON.parse(v); } catch (e) { return defaut; }
}
function ecrireLocal(cle, valeur) {
  try { localStorage.setItem("dh_" + cle, JSON.stringify(valeur)); } catch (e) { /* tant pis */ }
}

// Message court en haut de l'écran
let minuterieMessage = null;
function message(texte, erreur = false) {
  const zone = document.getElementById("message");
  zone.textContent = texte;
  zone.className = "visible" + (erreur ? " erreur-msg" : "");
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => { zone.className = ""; }, erreur ? 5000 : 2500);
}

// Erreur Supabase → phrase compréhensible
function erreurLisible(erreur) {
  const code = erreur && erreur.code;
  if (code === "23505") return "Ce nom existe déjà.";
  if (code === "23503") return "Cette fiche est utilisée ailleurs : impossible de la supprimer.";
  if (code === "23514") return "Une des valeurs n'est pas acceptée.";
  if (code === "42501") return "Tu n'as pas le droit de faire ça.";
  if (erreur && /Failed to fetch|NetworkError|network/i.test(erreur.message || "")) return "Pas de réseau : réessaie plus tard.";
  return "Erreur : " + ((erreur && erreur.message) || "inconnue");
}

App.estEditrice = () => !!App.profil && (App.profil.role === "admin" || App.profil.role === "editrice");
App.estAdmin = () => !!App.profil && App.profil.role === "admin";
App.createur = (id) => App.donnees.createurs.find((c) => c.id === id) || null;
App.modif = (table, id) => App.donnees.modifs.get(table + ":" + id) || null;

// ---------- Feuilles plein écran ----------
App.ouvrirFeuille = function (construire) {
  const feuille = el("div", { class: "feuille", role: "dialog", "aria-modal": "true" });
  const contenu = el("div", { class: "feuille-contenu" });
  feuille.append(contenu);
  document.getElementById("feuilles").append(feuille);
  App.feuilles.push(feuille);
  document.body.style.overflow = "hidden";
  construire(contenu);
  return feuille;
};
App.fermerFeuille = function () {
  const f = App.feuilles.pop();
  if (f) f.remove();
  if (!App.feuilles.length) document.body.style.overflow = "";
};
App.fermerToutesLesFeuilles = function () {
  while (App.feuilles.length) App.fermerFeuille();
};
App.boutonRetour = function (texte, quandOnTouche) {
  return el("button", { type: "button", class: "bouton-retour", onclick: quandOnTouche || App.fermerFeuille },
    icone(ICONES.retour, 20, 2.4), texte);
};

// ---------- Lecture des données ----------

// Lit toute une table, par paquets de 1000 (limite de l'API)
async function toutLire(table, colonnes, tri) {
  const lignes = [];
  for (let debut = 0; ; debut += 1000) {
    let requete = App.client.from(table).select(colonnes).range(debut, debut + 999);
    if (tri) requete = requete.order(tri);
    const { data, error } = await requete;
    if (error) throw error;
    lignes.push(...data);
    if (data.length < 1000) return lignes;
  }
}

App.chargerTout = async function () {
  const [steps, createurs] = await Promise.all([
    toutLire("steps", "*", "id"),
    toutLire("createurs", "id, type, nom, etiquette, lieu_id, modifie_le", "id"),
  ]);
  App.donnees.steps = steps;
  App.donnees.createurs = createurs;
  if (App.estEditrice()) {
    const [perso, modifs] = await Promise.all([
      toutLire("perso_steps", "step_id, niveau, a_travailler, notes"),
      toutLire("modifications", "table_nom, fiche_id, prenom, modifie_le"),
    ]);
    App.donnees.perso = new Map(perso.map((p) => [p.step_id, p]));
    App.donnees.modifs = new Map(modifs.map((m) => [m.table_nom + ":" + m.fiche_id, m]));
  }
  App.derniereLecture = Date.now();
};

// ---------- Écriture avec le contrôle « modifiée entre-temps » ----------
// Renvoie { ligne } si c'est enregistré, { conflit: true } si la fiche a changé depuis son ouverture.
App.modifierFiche = async function (table, id, valeurs, dateOuverture) {
  const { data, error } = await App.client.from(table).update(valeurs)
    .eq("id", id).eq("modifie_le", dateOuverture).select();
  if (error) throw error;
  if (!data.length) return { conflit: true };
  return { ligne: data[0] };
};

// ---------- Onglets ----------
App.enregistrerOnglet = function (id, onglet) {
  App.onglets[id] = onglet;
  if (!App.ordreOnglets.includes(id)) App.ordreOnglets.push(id);
};

App.dessinerBarre = function () {
  const barre = document.getElementById("barre");
  barre.replaceChildren();
  for (const id of App.ordreOnglets) {
    const onglet = App.onglets[id];
    if (onglet.visible && !onglet.visible()) continue;
    barre.append(el("button", {
      type: "button",
      "aria-current": id === App.ongletActif ? "page" : null,
      onclick: () => { App.ongletActif = id; ecrireLocal("onglet", id); App.dessinerBarre(); App.redessiner(); window.scrollTo(0, 0); },
    }, icone(onglet.icone, 24, id === App.ongletActif ? 2.2 : 2), onglet.titre));
  }
};

App.redessiner = function () {
  const contenu = document.getElementById("contenu");
  contenu.replaceChildren();
  document.querySelectorAll(".bouton-hasard").forEach((b) => b.remove());
  const onglet = App.onglets[App.ongletActif];
  if (onglet) onglet.dessiner(contenu);
};

// En-tête d'un onglet : grand titre + bande + bouton du profil (déconnexion)
App.entete = function (titre, ...actions) {
  return el("div", { class: "entete" },
    el("div", {}, el("h1", { text: titre }),
      el("div", { class: "bande", "aria-hidden": "true" }, el("span"), el("span"), el("span"))),
    el("div", { class: "entete-actions" }, ...actions,
      el("button", { type: "button", class: "pastille-profil", onclick: App.menuProfil, "aria-label": "Profil et déconnexion" },
        App.profil ? App.profil.prenom : "")));
};

App.menuProfil = function () {
  App.ouvrirFeuille((c) => {
    const roles = { admin: "Tout (ajouter, modifier, supprimer)", editrice: "Ajouter et modifier", lectrice: "Lecture seule" };
    c.append(
      el("div", { class: "feuille-haut" }, App.boutonRetour("Retour")),
      el("h1", { text: App.profil.prenom }),
      el("div", { class: "bloc" }, el("h2", { text: "Mes droits" }), el("p", { text: roles[App.profil.role] || App.profil.role })),
      el("button", { type: "button", class: "bouton-danger", onclick: App.deconnecter }, "Se déconnecter de ce téléphone"),
    );
  });
};

// Onglets qui arrivent plus tard
function ongletBientot(texte) {
  return (contenu) => contenu.append(App.entete(texte.titre), el("div", { class: "bientot", text: texte.message }));
}
App.enregistrerOnglet("steps", { titre: "Steps", icone: ICONES.steps, dessiner: () => {} });   // remplacé par steps.js
App.enregistrerOnglet("carte", { titre: "Carte", icone: ICONES.carte,
  dessiner: ongletBientot({ titre: "Carte", message: "La carte arrive à l'étape 3c." }) });
App.enregistrerOnglet("cours", { titre: "Cours", icone: ICONES.cours, visible: () => App.estEditrice(),
  dessiner: ongletBientot({ titre: "Cours", message: "Tes cours arrivent à l'étape 3d." }) });
App.enregistrerOnglet("savoir", { titre: "Savoir", icone: ICONES.savoir,
  dessiner: ongletBientot({ titre: "Savoir", message: "Le lexique et l'histoire arrivent à l'étape 3e." }) });

// ---------- Connexion ----------
function montrer(ecran) {
  for (const id of ["ecran-connexion", "ecran-sans-acces", "appli"]) document.getElementById(id).hidden = id !== ecran;
}

App.entrer = async function () {
  const { data, error } = await App.client.rpc("mon_profil");
  if (error) { message(erreurLisible(error), true); montrer("ecran-connexion"); return; }
  App.profil = data && data[0] ? data[0] : null;
  if (!App.profil) { montrer("ecran-sans-acces"); return; }
  try {
    await App.chargerTout();
  } catch (e) {
    message(erreurLisible(e), true);
  }
  const memorise = lireLocal("onglet", "steps");
  App.ongletActif = App.onglets[memorise] && (!App.onglets[memorise].visible || App.onglets[memorise].visible()) ? memorise : "steps";
  montrer("appli");
  App.dessinerBarre();
  App.redessiner();
};

App.deconnecter = async function () {
  App.fermerToutesLesFeuilles();
  await App.client.auth.signOut({ scope: "local" });   // ce téléphone seulement
  App.profil = null;
  App.donnees = { steps: [], createurs: [], perso: new Map(), modifs: new Map() };
  montrer("ecran-connexion");
};

App.demarrer = async function () {
  if (!window.supabase || typeof CONFIG === "undefined") {   // CONFIG est une constante, pas une propriété de window
    document.body.textContent = "Impossible de charger l'appli (fichier manquant ou bloqué).";
    return;
  }
  App.client = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_CLE_PUBLIQUE);

  document.getElementById("form-connexion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const bouton = document.getElementById("bouton-connexion");
    const zoneErreur = document.getElementById("connexion-erreur");
    zoneErreur.textContent = "";
    const email = document.getElementById("connexion-email").value.trim();
    const mdp = document.getElementById("connexion-mdp").value;
    if (!email || !mdp) { zoneErreur.textContent = "Remplis l'e-mail et le mot de passe."; return; }
    bouton.disabled = true;
    const { error } = await App.client.auth.signInWithPassword({ email, password: mdp });
    bouton.disabled = false;
    if (error) {
      zoneErreur.textContent = /invalid/i.test(error.message) ? "E-mail ou mot de passe incorrect." : erreurLisible(error);
      return;
    }
    document.getElementById("connexion-mdp").value = "";
    await App.entrer();
  });
  document.getElementById("bouton-deconnexion-sans-acces").addEventListener("click", App.deconnecter);

  // En revenant sur l'appli après un moment, on relit les données (Jade a pu modifier entre-temps)
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || !App.profil) return;
    if (Date.now() - App.derniereLecture < 60 * 1000) return;
    try { await App.chargerTout(); if (!App.feuilles.length) App.redessiner(); } catch (e) { /* hors connexion : on garde ce qu'on a */ }
  });

  const { data } = await App.client.auth.getSession();
  if (data.session) await App.entrer();
  else montrer("ecran-connexion");
};

document.addEventListener("DOMContentLoaded", App.demarrer);
