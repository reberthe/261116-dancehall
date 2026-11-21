# 💃 Riddim (appli dancehall)

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
- **lectrice** (les copines) : lit la base commune (steps, créateurs, carte, savoir) sans la modifier.
- **Tout le monde** a son espace privé : « Ma bibliothèque », niveau, « À travailler », Mes repères, Mes notes, Ma vidéo, onglet Cours. Chacune ne voit et ne modifie que le sien.
- Le bouton **+** de l'onglet Steps (Emma et Jade) ajoute un step, une personne ou un crew.
- Un compte qui n'est pas dans la liste des membres ne voit rien.

## 🗄️ Base de données : ordre des scripts (Supabase → SQL Editor)

1. `sql/01_tables.sql`
2. `sql/02_securite.sql`
3. `sql/03_stockage.sql`
4. `donnees/01_membres.sql` ⚠️ **gardé sur l'ordi d'Emma, jamais sur GitHub** (prénoms des copines, dépôt public)
5. `sql/04_test_securite.sql` : toutes les lignes doivent être `ok = true`
6. `sql/05_depart.sql` : données de départ (lieux, créateurs, steps, avec leurs sources)
7. `sql/06_cours_steps_gardes.sql` : un step supprimé reste dans les cours où il a été vu (son nom est gardé). Doit afficher « ok : un step supprimé reste dans le cours »
8. `sql/07_sous_categories.sql` : sous-catégories des steps (pour l'instant « Waistline technique » sous Female). Pour en ajouter une : une ligne de plus dans ce script, puis le relancer. Doit afficher « ok : Waistline technique (gyal) »
9. `sql/08_instagram.sql` : compte Instagram des créateurs (le @ cliquable dans leur fiche). Doit afficher « ok : compte Instagram des créateurs »
10. `sql/11_espace_prive.sql` : espace privé pour tout le monde, copines comprises (« Ma bibliothèque », Mes repères, Ma vidéo, onglet Cours). Chacune ne voit et n'écrit que ses lignes ; la base commune reste écrite par Emma et Jade. Doit afficher les 9 colonnes de `perso_steps` et 3 règles avec `est_membre()`. Puis relancer `04_test_securite.sql` (48 / 48).
11. `sql/12_reprise_bibliotheque.sql` : **une seule fois**, après 11 et avant de publier l'appli 4a6. Un step qui avait déjà un niveau, « À travailler » ou une note entre dans « Ma bibliothèque » de sa propriétaire. Rejouable sans effet (la reprise est notée dans `prive.reprises`).

⚠️ Si on relance un jour `02_securite.sql`, il faut relancer ensuite `06`, `07`, `08` et `11`, dans l'ordre : 02 remet les droits de départ et oublie les colonnes ajoutées après.

## 💾 Sauvegarde (une fois par mois)

L'offre gratuite de Supabase ne fait pas de sauvegarde automatique.
- `sql/09_sauvegarde.sql` (SQL Editor → Run) : copier le résultat dans `sauvegarde_AAAA-MM-JJ.json`, sur l'ordi d'Emma. ⚠️ Jamais sur GitHub : il contient les cours et la partie privée de chacune (Jade et les copines), les prénoms et les rôles. Garder les 3 dernières.
- `sql/10_restauration.sql` : seulement en cas de perte des données. Les tables doivent être vides (le script n'écrase jamais rien) ; coller la sauvegarde à la place de `COLLER_ICI`.
- Les photos ne sont pas dans la sauvegarde.
- Après une restauration dans un projet neuf, **ne pas lancer** `12_reprise_bibliotheque.sql` : la bibliothèque est déjà dans la sauvegarde (le relancer y remettrait les steps retirés à la main).
- Un rappel arrive le 1er de chaque mois à 18 h 35 (tâche programmée « Rappel sauvegarde Riddim »).

Dans la base, les étiquettes gardent leurs noms techniques (`man`, `gyal`) ; l'appli les affiche « Male » (M) et « Female » (F).

## 🎥 Vidéos (Google Drive d'Emma)

- Dossier « Riddim – vidéos » : `Steps` partagé avec les membres de l'appli (Jade en Éditeur), `Cours (privé)` visible seulement par Emma.
- Règles de rangement dans le document « 📌 Comment ranger les vidéos » du dossier.
- Un nouveau membre de l'appli → l'ajouter aussi au partage du dossier « Riddim – vidéos ».

Tous les scripts sont rejouables sans erreur.

## 📁 Fichiers de l'appli

- `index.html`, `style.css` (couleurs, lettres d'affiche, tickets, frise…)
- `config.js` : adresse du projet et clé publique (jamais de clé secrète)
- `app.js` : connexion, chargement des données, onglets, fiches, photos (liens signés)
- `steps.js` : onglet Steps (« Commune | Ma bibliothèque », filtres sur une ligne, tri « Par créateur | A → Z », dé avec réglages), fiche d'un step avec son bloc « Ma bibliothèque »
- `createurs.js` : liste des créateurs (mode « Liste » de l'onglet Carte), fiches crew et personne, membres, photos de profil (avec cadrage)
- `cours.js` : onglet Cours (privé, pour chaque membre, copines comprises : chacune ne voit que ses cours ; un ticket par cours)
- `savoir.js` : onglet Savoir (lexique en dictionnaire avec un A-Z sur le côté, histoire en frise par époque avec les créateurs concernés)
- `carte.js` : onglet Carte (titre JAMAÏQUE caché au zoom, filtres dans un bouton, bulles des villes puis des quartiers, « Lieu inconnu » au centre de la Jamaïque), lieux (création, renommage, suppression)
- `fonts/` : police d'affiche Anton (`anton-latin-400.woff2`) et sa licence (`OFL.txt`)

- `sw.js` : service worker (l'appli s'ouvre sans réseau, bandeau « Nouvelle version »)
- `manifest.json` et `icones/` : nom « Riddim » et icône (vinyle) de l'appli installée

⚠️ À chaque nouvelle version : changer **`VERSION` dans `sw.js`** et **tous les `?v=` dans `index.html`**, avec la même valeur (ex. `4a1`).

## 📱 Installer l'appli sur iPhone

- Dans Safari : ouvrir l'adresse de l'appli → bouton Partager → « Sur l'écran d'accueil ».
- Pour changer le nom ou l'icône d'une appli déjà installée : la supprimer de l'écran d'accueil, puis la réinstaller depuis Safari (il faudra se reconnecter).

## 🤖 Installer l'appli sur Android (version 4a8)

- Dans Chrome : ouvrir l'adresse de l'appli → menu ⋮ → « Ajouter à l'écran d'accueil » → « Installer ». Chrome propose parfois lui-même l'installation dans une petite barre en bas.
- Icône Android : `icones/icone-maskable-512.png` (le vinyle un peu plus petit, pour qu'aucune forme d'icône ne le coupe).
- **Bouton retour d'Android** (ou geste retour) : il ferme la fiche, le tiroir ou le panneau du lieu ouvert au-dessus. Rien d'ouvert : il quitte l'appli.
- Clavier : depuis Chrome 108, Chrome sur Android réagit au clavier comme Safari sur iPhone (rien à régler).
- Appui long sur la carte : géré par Chrome lui-même sur Android (sur iPhone, Leaflet le simule).
- Mêmes règles que sur iPhone : copie hors connexion effacée à la déconnexion, mises à jour par le bandeau « Nouvelle version disponible ».

## 📴 Hors connexion

- Tout se lit sans réseau (copie des données sur le téléphone, effacée à la déconnexion), en lecture seule.
- Pas de photos ni de fond de carte sans réseau (règle d'OpenStreetMap).
- Le service worker ne garde jamais les réponses de Supabase, de la carte ni de Nominatim.

## 📷 Photos de profil

- Dossier fermé `photos` : `createurs/<identifiant>.jpg`, JPEG de 400 × 400, cadré et réduit sur le téléphone avant l'envoi.
- Affichées par des liens signés valables 1 h.
- Remplacer une photo écrase l'ancienne. Seule Emma peut supprimer une photo.

## 🧪 Pages de test (étape 1)

- `test/carte.html` : carte, bulles, appui long, recherche Nominatim
- `test/photo.html` : réduction d'une photo d'iPhone à 400 × 400

## 📚 Bibliothèques (versions figées, avec empreinte)

- supabase-js 2.119.0
- Leaflet 1.9.4

## 📚 Ma bibliothèque (version 4a6)

- En haut de l'onglet Steps : « Commune » (tous les steps) ou « Ma bibliothèque » (les miens). Le choix est gardé sur le téléphone, pour chaque compte ; au départ, Ma bibliothèque si elle n'est pas vide.
- Ma bibliothèque = les steps notés dans mes cours (tout seuls) + ceux ajoutés à la main (« Ajouter à ma bibliothèque » dans la fiche).
- Fiche : historique des cours où je l'ai vu, niveau, À travailler, Mes repères, Notes, Ma vidéo (un lien `https://`). « Retirer » seulement pour un step ajouté à la main ; ses infos sont gardées.
- 🔒 Ma vidéo : le lien est caché aux autres, mais la vidéo n'est privée que si elle n'est pas partagée « à tous ceux qui ont le lien » dans Drive.
- Dé : combien (1, 2, 3, 5, 10), parmi Ma bibliothèque ou la Commune, Female / Male / Neutre, priorité « À travailler » (ils sortent 3 fois plus souvent). Réglages gardés sur le téléphone.
- Les copines ont le même espace privé (bibliothèque, cours). Elles ne créent pas de step : dans un cours, seulement des steps déjà dans la base.

## ➕ Bouton + et créateurs sans step (version 4a7)

- Le **+** de l'onglet Steps (Emma et Jade) ouvre « Ajouter » : un step, une personne ou un crew. Le formulaire s'ouvre avec le bon type déjà choisi.
- Dans la **Commune**, tri « Par créateur » : les créateurs et crews qui n'ont encore aucun step apparaissent aussi, à leur place dans l'ordre alphabétique, avec « Pas encore de step » (on touche pour ouvrir leur fiche).
- Ils suivent les filtres : Female / Male selon leur étiquette (un crew mixte passe dans les deux), époques, recherche sur le nom et les autres noms.
- Ils n'apparaissent pas en A → Z, dans Ma bibliothèque, ni avec « À travailler », Neutre ou une sous-catégorie (ces filtres portent sur des steps).
- Le compte en haut de la liste les indique : « 21 steps · 6 sans step ».

## 🎨 Style (version 4a5)

- Fond sable, boutons et choix actifs en **noir**. Female = magenta (F), Male = vert (M), Neutre = beige (N).
- L'or seulement pour l'onglet actif, le dé et les bandes du drapeau.
- Chaque onglet a son rappel de la Jamaïque : bandes en coin (Steps), gros titre JAMAÏQUE (Carte), tickets « bracelet de soirée » (Cours), drapeau en filigrane (Savoir).
- Titres en lettres d'affiche : police **Anton** (@fontsource/anton 5.3.0, licence libre SIL OFL 1.1, texte dans `fonts/OFL.txt`).
  Le fichier est dans l'appli : il marche sans réseau et rien n'est demandé à Google.
- La maquette de référence : rangée « ✅ Ce qu'on a retenu » de la maquette (Steps J1, Carte, Cours bracelet, Savoir + Jamaïque).

## 🗺️ Carte et lieux

- Fond de carte : OpenStreetMap standard, jamais gardé hors connexion (règle d'OpenStreetMap).
- Recherche d'un lieu : Nominatim, seulement en touchant « Chercher », au plus une recherche toutes les 1,5 s, limitée à la Jamaïque.
- Un lieu = un quartier ou une ville, jamais une adresse. Emma et Jade créent et renomment ; seule Emma supprime un lieu qui n'est pas utilisé.

## ©️ Données de la carte

Fond de carte et recherche de lieux : © OpenStreetMap (contributeurs), licence ODbL.
