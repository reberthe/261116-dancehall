# 💃 Dancehall

Appli pour garder tout le savoir dancehall : steps, crews et créateurs, carte, cours, lexique et histoire.
PWA hébergée sur GitHub Pages, données dans Supabase (offre gratuite).

## 🔧 Réglages faits à la main

Tout le reste est dans les scripts `sql/`.

- **Projet Supabase `261116-dancehall`**, dans l'organisation de Régine, région Europe.
- **Settings → Data API** : « Automatically expose new tables » décoché (fait par Régine). Chaque accès est donné par `grant` dans les scripts.
- **Authentication → Sign In / Providers** : « Allow new users to sign up » décoché (fait par Régine).
- **Organization → Team** : Emma invitée avec le rôle **Developer** (jamais Owner ni Admin).
- **GitHub** : dépôt public `261116-dancehall` sur le compte de Régine, Emma collaboratrice. **Settings → Pages** : branche `main`, dossier racine.

## 🧪 Étape 1 : tests

1. Remplir `config.js` (adresse du projet et clé publique).
2. Lancer `sql/00_test_connexion.sql` dans le SQL Editor, puis ouvrir `test/connexion.html`.
3. Ouvrir `test/carte.html` et `test/photo.html` sur l'iPhone.
4. Lancer `sql/00_test_nettoyage.sql`.

## 📚 Bibliothèques (versions figées, avec empreinte)

- supabase-js 2.119.0
- Leaflet 1.9.4

## ©️ Données de la carte

Fond de carte et recherche de lieux : © OpenStreetMap (contributeurs), licence ODbL.
