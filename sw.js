// sw.js — service worker : garde l'appli sur le téléphone pour l'ouvrir sans réseau.
// À chaque nouvelle version : changer VERSION ici ET les « ?v= » dans index.html (même valeur).
// Ne garde JAMAIS : les images de la carte (règle d'OpenStreetMap), la recherche de lieux, les réponses de Supabase.
"use strict";

const VERSION = "4a6";
const CACHE = "riddim-" + VERSION;

// Fichiers de l'appli (mêmes adresses que dans index.html)
const FICHIERS = [
  "./",
  "style.css?v=" + VERSION,
  "config.js?v=" + VERSION,
  "app.js?v=" + VERSION,
  "steps.js?v=" + VERSION,
  "createurs.js?v=" + VERSION,
  "carte.js?v=" + VERSION,
  "cours.js?v=" + VERSION,
  "savoir.js?v=" + VERSION,
  "fonts/anton-latin-400.woff2",   // police d'affiche (lettres des titres)
  "manifest.json",
  "icones/icone-180.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
];
// Bibliothèques (versions figées ; demandées en « cors », comme dans index.html avec l'empreinte)
const BIBLIOTHEQUES = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
];

// Installation : tout est téléchargé d'un coup (si un fichier manque, la nouvelle version n'est pas installée)
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([
    ...FICHIERS.map((f) => new Request(f, { cache: "reload" })),
    ...BIBLIOTHEQUES.map((u) => new Request(u, { mode: "cors" })),
  ])));
});

// Activation : on efface les anciennes versions
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((noms) => Promise.all(noms.filter((n) => n.startsWith("riddim-") && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Bandeau « Nouvelle version : Recharger » → l'appli demande d'activer la version en attente
self.addEventListener("message", (e) => {
  if (e.data === "activer") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const racine = new URL("./", self.registration.scope).pathname;

  // La page de l'appli : réseau d'abord (toujours la dernière version en ligne), copie gardée sinon
  if (req.mode === "navigate" && url.origin === self.location.origin && (url.pathname === racine || url.pathname === racine + "index.html")) {
    e.respondWith(
      fetch(url.pathname + url.search, { cache: "no-cache", credentials: "same-origin" })
        .then((rep) => {
          if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put("./", copie)); }
          return rep;
        })
        .catch(() => caches.match("./", { cacheName: CACHE }).then((rep) => rep || caches.match("./")))
    );
    return;
  }

  // Fichiers de l'appli (adresses avec ?v=) et bibliothèques : copie d'abord, réseau sinon
  const memeOrigine = url.origin === self.location.origin && req.mode !== "navigate";
  if (memeOrigine || url.origin === "https://cdn.jsdelivr.net") {
    e.respondWith(
      caches.match(req).then((garde) => garde || fetch(req).then((rep) => {
        if (rep.ok && memeOrigine && url.pathname !== racine + "sw.js") {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return rep;
      }))
    );
  }
  // Tout le reste (Supabase, carte, Nominatim) : directement par le réseau, jamais gardé
});
