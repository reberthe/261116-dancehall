# 💃 Dancehall

Appli pour garder tout le savoir dancehall : steps, crews et créateurs, carte, cours, lexique et histoire.
PWA hébergée sur GitHub Pages, données dans Supabase (offre gratuite).

## 🔧 Réglages faits à la main

Tout le reste est dans les scripts `sql/`.

- **Projet Supabase `261116-dancehall`**, dans l'organisation de Régine, région Europe.
- **Settings → Data API** : « Automatically expose new tables » décoché (fait par Régine). Chaque accès est donné par `grant` dans les scripts.
- **Authentication → Sign In / Providers** : « Allow new users to sign up » décoché (fait par Régine).
- **Organization → Team** : Emma invitée avec le rôle **Developer** (jamais Owner ni Admin).
- **Authentication → Users** : comptes créés à la main (Emma, Jade, une copine de test, un compte de test sans rôle).
- **GitHub** : dépôt public `261116-dancehall` sur le compte de Régine, Emma collaboratrice. **Settings → Pages** : branche `main`, dossier racine.

## 👥 Rôles

- **admin** (Emma) : lit, ajoute, modifie et supprime tout.
- **editrice** (Jade) : lit, ajoute et modifie ; ne supprime aucune fiche, mais peut retirer un lien (un membre d'un crew, par exemple).
- **lectrice** (les copines) : lecture seule.
- Emma et Jade ont chacune leur partie privée (niveau, « à travailler », notes, cours), invisible pour les autres.
- Un compte qui n'est pas dans la liste des membres ne voit rien.

## 🗄️ Base de données : ordre des scripts (Supabase → SQL Editor)

1. `sql/01_tables.sql`
2. `sql/02_securite.sql`
3. `sql/03_stockage.sql`
4. `donnees/01_membres.sql` ⚠️ **gardé sur l'ordi d'Emma, jamais sur GitHub** (prénoms des copines, dépôt public)
5. `sql/04_test_securite.sql` : toutes les lignes doivent être `ok = true`
6. `sql/05_depart.sql` : données de départ (lieux, créateurs, steps, avec leurs sources)

Tous les scripts sont rejouables sans erreur.

## 🧪 Pages de test (étape 1)

- `test/carte.html` : carte, bulles, appui long, recherche Nominatim
- `test/photo.html` : réduction d'une photo d'iPhone à 400 × 400

## 📚 Bibliothèques (versions figées, avec empreinte)

- supabase-js 2.119.0
- Leaflet 1.9.4

## ©️ Données de la carte

Fond de carte et recherche de lieux : © OpenStreetMap (contributeurs), licence ODbL.
