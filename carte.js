// carte.js — onglet Carte : carte de la Jamaïque (bulles des villes puis des quartiers), bouton Carte | Liste,
// lieux (création par recherche ou appui long, renommage, suppression)
"use strict";

const JAMAIQUE = [[17.70, -78.37], [18.53, -76.18]];
const CENTRE_JAMAIQUE = [18.12, -77.28];   // bulle « Lieu inconnu »
const ZOOM_QUARTIERS = 12;                 // à partir de ce zoom, on montre les quartiers
const ZOOM_VILLE = 13;                     // zoom quand on touche une ville
const ZOOM_MAX_BULLES = 16;                // au-delà, un groupe de quartiers ouvre directement sa liste
const DELAI_NOMINATIM = 1500;              // ms entre deux recherches (règle Nominatim : 1 par seconde au plus)
// Sur iPhone, l'appui long est simulé par Leaflet (« tapHold ») : on le force, car l'appli installée ne se dit pas « Safari »
const EST_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let carteLeaflet = null;
// Rose des vents du titre JAMAÏQUE (dessin fixe)
const ROSE_DES_VENTS = '<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="rgba(255,255,255,0.5)" stroke="#1E1E1C" stroke-width="1.4"/>' +
  '<path d="M22 6 L27 22 L22 38 L17 22 Z" fill="#1E1E1C"/><path d="M22 6 L27 22 L17 22 Z" fill="#E2B84A"/>' +
  '<text x="22" y="4.5" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="7" fill="#1E1E1C">N</text></svg>';
let derniereRechercheNominatim = 0;

// ---------- Qui est sur la carte ----------

// Un lieu sans position lisible (ne devrait pas arriver : la base l'exige) est traité comme inconnu
function positionValable(l) { return !!l && Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude)); }

// Personne membre (actuelle) d'un crew : on la trouve dans la fiche du crew, pas de double compte
function estMembreActif(c) {
  return c.type === "personne" && App.donnees.membres.some((m) => m.personne_id === c.id && !m.ancien);
}

// Créateurs qui passent les filtres (sans la recherche, réservée à la liste), rangés par lieu
function repartition() {
  const parLieu = new Map();   // lieu_id → [créateurs]
  const inconnus = [];
  for (const c of App.donnees.createurs) {
    if (filtresCreateurs.types.length && !filtresCreateurs.types.includes(c.type)) continue;
    if (filtresCreateurs.etiquettes.length && !filtresCreateurs.etiquettes.includes(c.etiquette)) continue;
    if (filtresCreateurs.epoques.length && !(c.epoques || []).some((e) => filtresCreateurs.epoques.includes(e))) continue;
    if (c.lieu_id && positionValable(App.lieu(c.lieu_id))) {
      if (!parLieu.has(c.lieu_id)) parLieu.set(c.lieu_id, []);
      parLieu.get(c.lieu_id).push(c);
    } else if (!estMembreActif(c)) {
      inconnus.push(c);
    }
  }
  return { parLieu, inconnus };
}

// ---------- Onglet : Carte ou Liste ----------
function dessinerOngletCarte(contenu) {
  const mode = lireLocal("mode_carte", "carte");
  if (mode === "liste") dessinerListeCreateurs(contenu, boutonsMode("liste"));
  else if (typeof L === "undefined") {   // Leaflet pas chargé (pas de réseau au démarrage, site bloqué…)
    contenu.append(App.entete(enteteJamaique()), el("div", { class: "bandeau" }, boutonsMode("carte", true)),
      el("div", { class: "bientot", text: "La carte n'a pas pu se charger. Passe en « Liste », ou relance l'appli avec du réseau." }));
  } else dessinerCarteJamaique(contenu);
}

// seul : choix posé seul (liste, carte pas chargée) ; sinon il est dans la barre blanche de la carte
function boutonsMode(actif, seul = true) {
  const changer = (mode) => { ecrireLocal("mode_carte", mode); App.redessiner(); window.scrollTo(0, 0); };
  return el("div", { class: "segments deux mode-carte" + (seul ? "" : " dans-barre"), role: "group", "aria-label": "Carte ou liste" },
    el("button", { type: "button", "aria-pressed": actif === "carte" ? "true" : "false", onclick: () => changer("carte") }, "Carte"),
    el("button", { type: "button", "aria-pressed": actif === "liste" ? "true" : "false", onclick: () => changer("liste") }, "Liste"));
}

App.enregistrerOnglet("carte", { titre: "Carte", icone: ICONES.carte, dessiner: dessinerOngletCarte });

// ---------- La carte ----------
function dessinerCarteJamaique(contenu) {
  document.body.classList.add("avec-carte");
  const zone = el("div", { class: "zone-carte" });
  const dessus = el("div", { class: "carte-dessus" });
  const fil = el("div", { class: "carte-fil" });
  const aide = el("p", { class: "carte-aide", "aria-hidden": "true" });
  const panneau = el("div", { class: "panneau-lieu", role: "dialog", "aria-label": "Créateurs du lieu", hidden: true });
  contenu.append(zone, dessus, aide, panneau);

  // Haut : barre blanche (Carte | Liste, Filtres, Lieux pour Emma et Jade, profil) ; les filtres s'ouvrent dessous ;
  // puis le gros titre JAMAÏQUE (toute l'île) ou le fil « ‹ Jamaïque » (zoom)
  const nombreFiltres = el("span", { class: "pastille-nombre", "aria-hidden": "true" });
  const boutonFiltres = el("button", { type: "button", class: "bouton-filtres", "aria-expanded": "false", "aria-controls": "carte-filtres" },
    icone("M4 6h16M7 12h10M10 18h4", 20, 2.2), nombreFiltres);
  dessus.append(el("div", { class: "carte-barre" },
    boutonsMode("carte", false),
    el("div", { class: "entete-actions" },
      boutonFiltres,
      App.peutEcrire() ? el("button", { type: "button", class: "pastille-profil", onclick: ouvrirListeLieux }, "Lieux") : null,
      el("button", { type: "button", class: "pastille-profil moi", onclick: App.menuProfil, "aria-label": "Profil et déconnexion" }, App.profil.prenom))));
  const filtres = el("div", { class: "filtres carte-filtres", id: "carte-filtres", role: "group", "aria-label": "Filtres", hidden: true });
  boutonFiltres.addEventListener("click", () => {
    filtres.hidden = !filtres.hidden;
    boutonFiltres.setAttribute("aria-expanded", filtres.hidden ? "false" : "true");
  });
  function majNombreFiltres() {
    const n = filtresCreateurs.epoques.length + filtresCreateurs.etiquettes.length + filtresCreateurs.types.length;
    nombreFiltres.textContent = n ? String(n) : "";
    nombreFiltres.hidden = !n;
    boutonFiltres.setAttribute("aria-label", n ? "Filtres, " + n + " choisi" + (n > 1 ? "s" : "") : "Filtres");
  }
  majNombreFiltres();
  const basculerDans = (liste, valeur) => { const i = liste.indexOf(valeur); if (i >= 0) liste.splice(i, 1); else liste.push(valeur); };
  const pilule = (texte, liste, valeur) => {
    const b = el("button", { type: "button", class: "filtre", "aria-pressed": liste.includes(valeur) ? "true" : "false" }, texte);
    b.addEventListener("click", () => {
      basculerDans(liste, valeur);
      b.setAttribute("aria-pressed", liste.includes(valeur) ? "true" : "false");
      sauverFiltresCreateurs();
      majNombreFiltres();
      fermerPanneau();
      dessinerBulles();
    });
    return b;
  };
  for (const [cle, nom] of Object.entries(EPOQUES)) filtres.append(pilule(nom, filtresCreateurs.epoques, cle));
  for (const cle of ["gyal", "man", "mixte"]) filtres.append(pilule(ETIQUETTES[cle].nom, filtresCreateurs.etiquettes, cle));
  for (const [cle, nom] of Object.entries(TYPES)) filtres.append(pilule(nom, filtresCreateurs.types, cle));
  // Gros titre posé sur la mer : coordonnées, petite bande du drapeau, rose des vents
  const compteIle = el("span", { class: "cartouche-compte" });
  const rose = el("span", { class: "rose-vents", "aria-hidden": "true" });
  rose.innerHTML = ROSE_DES_VENTS;   // dessin fixe
  const cartouche = el("div", { class: "cartouche" },
    el("h2", { class: "cartouche-titre", text: "JAMAÏQUE" }),
    el("span", { class: "cartouche-coord" }, "18° N · 77° O", tricolore()),
    compteIle, rose);
  dessus.append(filtres, cartouche, fil);

  // Carte Leaflet (fond OpenStreetMap ; jamais gardé hors connexion)
  const carte = L.map(zone, { zoomControl: false, tapHold: EST_IOS });
  carteLeaflet = carte;
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(carte);
  carte.attributionControl.setPrefix(false);
  const vue = lireLocal("vue_carte", null);
  if (vue && Number.isFinite(vue.lat) && Number.isFinite(vue.lon) && Number.isFinite(vue.zoom)) carte.setView([vue.lat, vue.lon], vue.zoom);
  else carte.fitBounds(JAMAIQUE);
  const couche = L.layerGroup().addTo(carte);

  App.quandOnQuitte = () => {   // en changeant d'onglet ou de mode
    carte.remove();
    carteLeaflet = null;
    document.body.classList.remove("avec-carte");
  };

  carte.on("moveend", () => {
    const c = carte.getCenter();
    ecrireLocal("vue_carte", { lat: c.lat, lon: c.lng, zoom: carte.getZoom() });
  });
  carte.on("zoomend", dessinerBulles);

  // Appui long (Emma et Jade) : nouveau lieu à cet endroit
  carte.on("contextmenu", (e) => {
    if (!App.peutEcrire()) return;
    ouvrirNouveauLieu({ position: [e.latlng.lat, e.latlng.lng] });
  });

  // decalage : en pixels vers le haut (bulle « Lieu inconnu » qui touche une autre bulle)
  function poserBulle(lat, lon, nom, nombre, classe, quandOnTouche, decalage = 0) {
    const bouton = el("button", { type: "button", class: "bulle " + classe,
      "aria-label": nom + ", " + pluriel(nombre, "créateur") }, el("span", { text: nom }), el("span", { class: "nombre", text: String(nombre) }));
    if (decalage) bouton.style.transform = "translate(-50%, calc(-50% - " + decalage + "px))";
    L.DomEvent.disableClickPropagation(bouton);
    bouton.addEventListener("click", quandOnTouche);
    const icone = L.divIcon({ className: "bulle-ancre", html: bouton, iconSize: [0, 0], iconAnchor: [0, 0] });
    L.marker([lat, lon], { icon: icone, keyboard: false }).addTo(couche);
  }

  // Largeur estimée d'une bulle en pixels (pour savoir si deux bulles se touchent)
  const largeurBulle = (nom) => 12 + nom.length * 7.6 + 8 + 28;
  const seTouchent = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

  // Bulles qui se touchent : la plus grande garde son nom et prend le total
  function regrouper(elements) {
    const gardes = [];
    for (const e of [...elements].sort((a, b) => b.nombre - a.nombre)) {
      const p = carte.latLngToContainerPoint([e.lat, e.lon]);
      const l = largeurBulle(e.nom);
      const boite = { x1: p.x - l / 2, x2: p.x + l / 2, y1: p.y - 18, y2: p.y + 18 };
      const voisin = gardes.find((g) => seTouchent(boite, g.boite));
      if (voisin) { voisin.nombre += e.nombre; voisin.membres.push(e); }
      else gardes.push({ ...e, boite, membres: [e] });
    }
    return gardes;
  }

  function dessinerBulles() {
    couche.clearLayers();
    fil.replaceChildren();
    const { parLieu, inconnus } = repartition();
    const zoom = carte.getZoom();
    const villes = App.donnees.lieux.filter((l) => l.type === "ville");
    const total = [...parLieu.values()].reduce((n, l) => n + l.length, 0) + inconnus.length;
    let elements = [];
    let posees = [];   // bulles posées (pour placer « Lieu inconnu » sans chevauchement)

    if (zoom < ZOOM_QUARTIERS) {
      // Niveau 1 : les villes (avec leurs quartiers)
      for (const v of villes.filter(positionValable)) {
        const createurs = [...(parLieu.get(v.id) || [])];
        for (const q of App.donnees.lieux.filter((l) => l.ville_id === v.id)) createurs.push(...(parLieu.get(q.id) || []));
        if (createurs.length) elements.push({ nom: v.nom, lat: Number(v.latitude), lon: Number(v.longitude), nombre: createurs.length, ville: v });
      }
      posees = regrouper(elements);
      for (const b of posees) {
        const groupe = b.membres.length > 1;
        poserBulle(b.lat, b.lon, groupe ? b.nom + " +" + (b.membres.length - 1) : b.nom, b.nombre, groupe ? "groupe" : "", () => {
          fermerPanneau();
          if (groupe) carte.flyToBounds(L.latLngBounds(b.membres.map((m) => [m.lat, m.lon])), { padding: [80, 80], maxZoom: ZOOM_QUARTIERS - 1 });
          else carte.flyTo([b.lat, b.lon], ZOOM_VILLE);
        });
      }
      cartouche.hidden = false;
      fil.hidden = true;
      const noms = [...filtresCreateurs.epoques.map((e) => EPOQUES[e]), ...filtresCreateurs.etiquettes.map((e) => ETIQUETTES[e].nom),
        ...filtresCreateurs.types.map((t) => TYPES[t])];
      compteIle.textContent = [pluriel(total, "créateur"), ...noms].join(" · ");
      aide.textContent = total ? "Touche une ville pour voir ses quartiers" : "";
    } else {
      // Niveau 2 : les quartiers, et « (sans quartier) » au centre de chaque ville
      for (const l of App.donnees.lieux) {
        const createurs = parLieu.get(l.id) || [];
        if (!createurs.length) continue;
        const ville = l.ville_id ? App.lieu(l.ville_id) : null;
        elements.push({ nom: l.type === "ville" ? l.nom + " (sans quartier)" : l.nom, sousTitre: ville ? ville.nom : "Ville",
          lat: Number(l.latitude), lon: Number(l.longitude), nombre: createurs.length, createurs, lieu: l });
      }
      posees = regrouper(elements);
      for (const b of posees) {
        const groupe = b.membres.length > 1;
        poserBulle(b.lat, b.lon, groupe ? b.nom + " +" + (b.membres.length - 1) : b.nom, b.nombre, groupe ? "groupe" : "", () => {
          if (groupe && carte.getZoom() < ZOOM_MAX_BULLES) {
            fermerPanneau();
            carte.flyToBounds(L.latLngBounds(b.membres.map((m) => [m.lat, m.lon])), { padding: [80, 80], maxZoom: ZOOM_MAX_BULLES });
          } else if (groupe) {
            ouvrirPanneau(b.membres.map((m) => m.nom).join(" · "), "", b.membres.flatMap((m) => m.createurs), null);
          } else {
            ouvrirPanneau(b.nom, b.sousTitre, b.createurs, b.lieu);
          }
        });
      }
      // Zoom : le gros titre disparaît, il reste le fil pour revenir à toute l'île
      cartouche.hidden = true;
      fil.hidden = false;
      fil.append(el("button", { type: "button", onclick: () => { fermerPanneau(); carte.flyToBounds(JAMAIQUE); } }, "‹ Jamaïque"));
      aide.textContent = "";
    }

    // Lieu inconnu : au centre de la Jamaïque, jamais regroupée ; remontée si elle touche une autre bulle
    if (inconnus.length) {
      const p = carte.latLngToContainerPoint(CENTRE_JAMAIQUE);
      const demi = largeurBulle("Lieu inconnu") / 2;
      let decalage = 0;
      const boite = () => ({ x1: p.x - demi, x2: p.x + demi, y1: p.y - 18 - decalage, y2: p.y + 18 - decalage });
      while (decalage < 150 && posees.some((b) => seTouchent(boite(), b.boite))) decalage += 6;
      poserBulle(CENTRE_JAMAIQUE[0], CENTRE_JAMAIQUE[1], "Lieu inconnu", inconnus.length, "inconnue",
        () => ouvrirPanneau("Lieu inconnu", "Pas encore de quartier ni de ville", inconnus, null), decalage);
    }
  }

  // Liste des créateurs d'un lieu, en bas de l'écran
  function ouvrirPanneau(titre, sousTitre, createurs, lieu) {
    const tries = [...createurs].sort(parNom);
    const n = tries.length;
    panneau.replaceChildren(
      el("div", { class: "panneau-haut" },
        el("div", {}, el("h2", { text: titre }), el("p", { class: "petit", text: [sousTitre, pluriel(n, "créateur")].filter(Boolean).join(" · ") })),
        el("button", { type: "button", class: "bouton-secondaire", onclick: fermerPanneau }, "Fermer")),
      el("div", { class: "liste" }, tries.map((c) => ligneCreateur(c, sousTitreCreateur(c), () => ouvrirFicheCreateur(c.id, "Carte")))),
      tries.some((c) => c.type === "crew") ? el("p", { class: "petit", text: "Les membres sans lieu à eux se trouvent dans la fiche de leur crew." }) : null,
      lieu && App.peutEcrire() ? el("div", { class: "ligne-boutons" },
        el("button", { type: "button", class: "bouton-secondaire", onclick: () => ouvrirLieu(lieu.id) }, "Modifier ce lieu")) : null);
    panneau.hidden = false;
    panneau.scrollTop = 0;
    App.panneauOuvert = panneau; App.verifierRetour();   // le retour d'Android le fermera
  }
  function fermerPanneau() { panneau.hidden = true; App.verifierRetour(); }

  dessinerBulles();
}

// ---------- Lieux ----------

// Remplit une liste de choix : chaque ville, suivie de ses quartiers
function remplirChoixLieux(select, choisi) {
  select.replaceChildren(el("option", { value: "", text: "— Aucun —" }));
  for (const v of App.donnees.lieux.filter((l) => l.type === "ville").sort(parNom)) {
    select.append(el("option", { value: String(v.id), text: v.nom, selected: choisi === v.id }));
    for (const q of App.donnees.lieux.filter((l) => l.ville_id === v.id).sort(parNom)) {
      select.append(el("option", { value: String(q.id), text: q.nom + ", " + v.nom, selected: choisi === q.id }));
    }
  }
}

function nombreCreateursLieu(id) { return App.donnees.createurs.filter((c) => c.lieu_id === id).length; }

// Feuille « Lieux » (Emma et Jade) : tous les lieux, pour en ajouter, renommer ou supprimer
function ouvrirListeLieux() {
  App.ouvrirFeuille((c) => {
    c.replaceChildren();
    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Carte"),
      el("button", { type: "button", class: "bouton-principal", onclick: () => ouvrirNouveauLieu({}) }, "+ Nouveau lieu")));
    c.append(el("h1", { text: "Lieux" }),
      el("p", { class: "petit", text: "Astuce : un appui long sur la carte crée un lieu à cet endroit." }));
    const villes = App.donnees.lieux.filter((l) => l.type === "ville").sort(parNom);
    const liste = el("div", { class: "liste" });
    if (!villes.length) liste.append(el("div", { class: "vide", text: "Pas encore de lieu." }));
    for (const v of villes) {
      liste.append(el("button", { type: "button", class: "ligne", onclick: () => ouvrirLieu(v.id) },
        el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: v.nom }),
          el("span", { class: "ligne-sous", text: "Ville · " + pluriel(nombreCreateursLieu(v.id), "créateur") }))));
      for (const q of App.donnees.lieux.filter((l) => l.ville_id === v.id).sort(parNom)) {
        liste.append(el("button", { type: "button", class: "ligne quartier", onclick: () => ouvrirLieu(q.id) },
          el("span", { class: "ligne-texte" }, el("span", { class: "ligne-titre", text: q.nom }),
            el("span", { class: "ligne-sous", text: "Quartier de " + v.nom + " · " + pluriel(nombreCreateursLieu(q.id), "créateur") }))));
      }
    }
    c.append(liste);
  }, true);
}

// Ville la plus proche d'une position (pour proposer la ville d'un nouveau quartier)
function villeLaPlusProche(lat, lon) {
  let meilleure = null, distance = Infinity;
  for (const v of App.donnees.lieux.filter((l) => l.type === "ville")) {
    const d = (Number(v.latitude) - lat) ** 2 + (Number(v.longitude) - lon) ** 2;
    if (d < distance) { distance = d; meilleure = v; }
  }
  return meilleure ? { ville: meilleure, km: Math.sqrt(distance) * 111 } : null;
}

// Nouveau lieu : position donnée par un appui long, ou trouvée en cherchant le nom (Nominatim)
// options : { position: [lat, lon], quandCree: (id) => {} }
function ouvrirNouveauLieu(options) {
  App.ouvrirFeuille((c) => {
    let position = options.position || null;
    const proche = position ? villeLaPlusProche(position[0], position[1]) : null;
    let type = proche && proche.km < 15 ? "quartier" : "ville";

    const f = el("form", { class: "formulaire", novalidate: true });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });
    const nom = el("input", { type: "text", maxlength: "80", required: true });
    const segType = el("div", { class: "segments deux", role: "group", "aria-label": "Quartier ou ville" });
    const choixVille = el("select", { "aria-label": "Ville du quartier" }, el("option", { value: "", text: "— Choisir la ville —" }),
      ...App.donnees.lieux.filter((l) => l.type === "ville").sort(parNom).map((v) =>
        el("option", { value: String(v.id), text: v.nom, selected: proche && proche.ville.id === v.id })));
    const champVille = el("label", {}, "Ville du quartier *", choixVille);
    function dessinerType() {
      segType.replaceChildren(...[["quartier", "Quartier"], ["ville", "Ville"]].map(([cle, n]) =>
        el("button", { type: "button", "aria-pressed": type === cle ? "true" : "false", onclick: () => { type = cle; dessinerType(); } }, n)));
      champVille.hidden = type !== "quartier";
    }
    dessinerType();

    const textePosition = el("p", { class: "petit" });
    function majPosition() {
      textePosition.textContent = position
        ? "📍 Position : " + position[0].toFixed(5) + ", " + position[1].toFixed(5)
        : "📍 Pas encore de position : cherche le lieu ci-dessous, ou fais un appui long sur la carte.";
    }
    majPosition();

    // Recherche Nominatim : seulement en touchant « Chercher », au plus une toutes les 1,5 s
    const champRecherche = el("input", { type: "search", placeholder: "Ex. Trench Town, Mandeville…", "aria-label": "Chercher un lieu", autocomplete: "off" });
    const resultats = el("div", { class: "liste" });
    const chercher = el("button", { type: "button", class: "bouton-secondaire" }, "Chercher");
    chercher.addEventListener("click", async () => {
      const texte = champRecherche.value.trim();
      if (texte.length < 2) return;
      const attente = DELAI_NOMINATIM - (Date.now() - derniereRechercheNominatim);
      if (attente > 0) { message("Attends une seconde avant de chercher à nouveau."); return; }
      derniereRechercheNominatim = Date.now();
      chercher.disabled = true;
      setTimeout(() => { chercher.disabled = false; }, DELAI_NOMINATIM);
      resultats.replaceChildren(el("p", { class: "petit", text: "Recherche…" }));
      try {
        const adresse = "https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=jm&limit=5&accept-language=fr&q=" + encodeURIComponent(texte);
        const reponse = await fetch(adresse);
        if (!reponse.ok) throw new Error("HTTP " + reponse.status);
        const trouves = await reponse.json();
        resultats.replaceChildren();
        if (!trouves.length) resultats.append(el("p", { class: "petit", text: "Aucun résultat. Essaie une autre orthographe, ou fais un appui long sur la carte." }));
        for (const r of trouves) {
          resultats.append(el("button", { type: "button", class: "ligne", onclick: () => {
            position = [Number(r.lat), Number(r.lon)];
            if (!nom.value.trim() && r.name) nom.value = r.name;
            const v = villeLaPlusProche(position[0], position[1]);
            if (type === "quartier" && v && !choixVille.value) choixVille.value = String(v.ville.id);
            majPosition();
            resultats.replaceChildren(el("p", { class: "petit", text: "✓ " + r.display_name }));
          } }, el("span", { class: "ligne-texte" }, el("span", { class: "ligne-sous", text: r.display_name }))));
        }
        if (trouves.length) resultats.append(el("p", { class: "tres-petit", text: "Recherche : © OpenStreetMap (Nominatim)" }));
      } catch (e) {
        resultats.replaceChildren(el("p", { class: "erreur", text: "La recherche n'a pas marché (réseau ?). Réessaie plus tard." }));
      }
    });

    const creer = el("button", { type: "submit", class: "bouton-principal" }, "Créer le lieu");
    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Annuler")), el("h1", { text: "Nouveau lieu" }), f);
    f.append(
      el("div", { class: "formulaire" }, el("span", { class: "aide", text: "Quartier ou ville" }), segType),
      champVille,
      el("label", {}, "Nom *", nom),
      textePosition,
      el("div", { class: "bloc" }, el("h2", { text: "Chercher la position" }),
        el("div", { class: "ligne-recherche" }, champRecherche, chercher), resultats),
      el("p", { class: "petit", text: "🔒 Un quartier ou une ville seulement : jamais une adresse ni un lieu d'entraînement." }),
      zoneErreur,
      el("div", { class: "ligne-boutons" }, creer));

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      zoneErreur.textContent = "";
      const valeurNom = nom.value.trim();
      if (!valeurNom) { zoneErreur.textContent = "Le nom est obligatoire."; return; }
      if (!position) { zoneErreur.textContent = "Il manque la position : cherche le lieu, ou fais un appui long sur la carte."; return; }
      const villeId = type === "quartier" ? Number(choixVille.value) || null : null;
      if (type === "quartier" && !villeId) { zoneErreur.textContent = "Choisis la ville du quartier (crée d'abord la ville si elle manque)."; return; }
      const doublon = App.donnees.lieux.find((l) => l.type === type && (l.ville_id || null) === villeId && sansAccents(l.nom) === sansAccents(valeurNom));
      if (doublon) { zoneErreur.textContent = "« " + doublon.nom + " » existe déjà."; return; }
      creer.disabled = true;
      const { data, error } = await App.client.from("lieux").insert({
        type, nom: valeurNom, ville_id: villeId,
        latitude: Math.round(position[0] * 1e5) / 1e5, longitude: Math.round(position[1] * 1e5) / 1e5,
      }).select("id").single();
      if (error) { zoneErreur.textContent = erreurLisible(error); creer.disabled = false; return; }
      await App.chargerTout();
      App.fermerFeuille();
      message("Lieu créé");
      if (options.quandCree) options.quandCree(data.id);
      App.rafraichir();
    });
  });
}

// Fiche d'un lieu : renommer (Emma et Jade), supprimer s'il n'est pas utilisé (Emma)
function ouvrirLieu(id) {
  const l = App.lieu(id);
  if (!l) { message("Ce lieu n'existe plus.", true); return; }
  const dateOuverture = l.modifie_le;
  App.ouvrirFeuille((c) => {
    const ville = l.ville_id ? App.lieu(l.ville_id) : null;
    const f = el("form", { class: "formulaire", novalidate: true });
    const zoneErreur = el("p", { class: "erreur", role: "alert" });
    const nom = el("input", { type: "text", maxlength: "80", required: true, value: l.nom });
    const enregistrer = el("button", { type: "submit", class: "bouton-principal" }, "Enregistrer");
    const n = nombreCreateursLieu(l.id);
    const quartiers = App.donnees.lieux.filter((x) => x.ville_id === l.id).length;
    c.append(el("div", { class: "feuille-haut" }, App.boutonRetour("Retour")),
      el("h1", { text: l.nom }),
      el("p", { class: "petit", text: (ville ? "Quartier de " + ville.nom : "Ville") + " · " + pluriel(n, "créateur") +
        (quartiers ? " · " + pluriel(quartiers, "quartier") : "") }),
      f);
    f.append(el("label", {}, "Nom *", nom),
      el("p", { class: "petit", text: "📍 " + Number(l.latitude).toFixed(5) + ", " + Number(l.longitude).toFixed(5) + " (la position ne se modifie pas)" }),
      zoneErreur, el("div", { class: "ligne-boutons" }, enregistrer));

    if (App.estAdmin()) {
      let confirme = false;
      const supprimer = el("button", { type: "button", class: "bouton-danger" }, "Supprimer ce lieu");
      supprimer.addEventListener("click", async () => {
        if (n || quartiers) { message("Ce lieu est utilisé (" + [n ? pluriel(n, "créateur") : null, quartiers ? pluriel(quartiers, "quartier") : null].filter(Boolean).join(", ") + ") : impossible de le supprimer.", true); return; }
        if (!confirme) { confirme = true; supprimer.textContent = "Confirmer la suppression"; supprimer.classList.add("confirmer"); return; }
        supprimer.disabled = true;
        const { data, error } = await App.client.from("lieux").delete().eq("id", l.id).select("id");
        if (error || !data.length) { message(error ? erreurLisible(error) : "Suppression refusée.", true); supprimer.disabled = false; return; }
        await App.chargerTout();
        App.fermerFeuille();
        message("Lieu supprimé");
        App.rafraichir();
      });
      f.append(el("div", { class: "ligne-boutons" }, supprimer));
    }

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      zoneErreur.textContent = "";
      const valeurNom = nom.value.trim();
      if (!valeurNom) { zoneErreur.textContent = "Le nom est obligatoire."; return; }
      const doublon = App.donnees.lieux.find((x) => x.id !== l.id && x.type === l.type && (x.ville_id || null) === (l.ville_id || null) && sansAccents(x.nom) === sansAccents(valeurNom));
      if (doublon) { zoneErreur.textContent = "« " + doublon.nom + " » existe déjà."; return; }
      enregistrer.disabled = true;
      try {
        const r = await App.modifierFiche("lieux", l.id, { nom: valeurNom }, dateOuverture);
        if (r.conflit) {
          await App.chargerTout();
          const m = App.modif("lieux", l.id);
          zoneErreur.textContent = "Ce lieu a été modifié entre-temps" + (m ? " par " + m.prenom : "") + ". Rouvre-le pour voir la nouvelle version.";
          enregistrer.disabled = false;
          return;
        }
        await App.chargerTout();
        App.fermerFeuille();
        message("Lieu enregistré");
        App.rafraichir();
      } catch (err) {
        zoneErreur.textContent = erreurLisible(err);
        enregistrer.disabled = false;
      }
    });
  });
}
