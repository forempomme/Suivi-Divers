# Suivi Divers — v2.0.1

Application Android de suivi personnel (voiture, vétérinaire, médecin, maison…).
Design Material You (style natif Android). Mode sombre par défaut.

---

## Démarrage rapide (depuis Android / GitHub uniquement)

### Étape 1 — Forker ce dépôt
Sur GitHub, cliquez sur **Fork** en haut à droite.

### Étape 2 — Générer le keystore (une seule fois)

Le keystore permet de signer l'APK de façon cohérente. Sans lui, Android
refuse d'installer une mise à jour par-dessus une version existante.

1. Dans votre dépôt → onglet **Actions**
2. Workflow **"Générer le Keystore (à exécuter une seule fois)"**
3. Cliquez **Run workflow**
4. Remplissez :
   - `keystore_password` : un mot de passe fort (ex: `MonMotDePasse2024!`)
   - `key_alias` : laissez `suividivers`
5. Attendez la fin (~1 min), cliquez sur le run terminé
6. Dans les logs de l'étape **"Afficher la valeur KEYSTORE_BASE64"**, copiez la longue chaîne base64
7. **Téléchargez aussi l'artifact** `suividivers-keystore-BACKUP` et conservez-le précieusement

### Étape 3 — Ajouter les secrets GitHub

Dans votre dépôt → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Créez ces 4 secrets :

| Nom | Valeur |
|-----|--------|
| `KEYSTORE_BASE64` | La longue chaîne copiée à l'étape 2 |
| `KEYSTORE_PASSWORD` | Votre mot de passe choisi à l'étape 2 |
| `KEY_ALIAS` | `suividivers` |
| `KEY_PASSWORD` | Votre mot de passe (identique à KEYSTORE_PASSWORD) |

### Étape 4 — Lancer le premier build

1. Onglet **Actions** → workflow **"Build APK"**
2. **Run workflow** → **Run workflow**
3. Attendez ~5-10 min (plus long au premier build)
4. Une fois terminé, cliquez sur le run → section **Artifacts**
5. Téléchargez `SuiviDivers-v2.0.1`
6. Installez l'APK sur votre téléphone

### Mises à jour futures

Modifiez les fichiers directement sur GitHub (éditeur web), committez → le build se
relance automatiquement → téléchargez le nouvel APK → installez par-dessus l'ancien
(pas de désinstallation nécessaire grâce au keystore).

---

## Structure du projet

```
suivi-divers/
├── .github/workflows/
│   ├── build.yml              ← Build automatique à chaque push
│   └── setup-keystore.yml     ← À exécuter une seule fois
├── src/
│   ├── App.jsx                ← Application React complète
│   └── main.jsx               ← Point d'entrée + plugins Capacitor (stockage, notifications, empreinte)
├── public/
│   └── icon.png               ← Icône de l'application
├── index.html
├── package.json               ← Dépendances (version 2.0.1)
├── vite.config.js
└── capacitor.config.json
```

---

## Versioning

La version est définie dans **deux fichiers** à mettre à jour simultanément :
- `package.json` → champ `"version"` (contrôle le nom de l'APK généré)
- `src/App.jsx` → constante `APP_VERSION` (affichée dans l'onglet Réglages)

Convention :
- `+0.0.1` Patch — correction de bug
- `+0.1.0` Mineure — nouvelle fonctionnalité
- `+1.0.0` Majeure — refonte

---

## Historique des versions

### v2.0.1 — Correction de compilation
**Fichiers modifiés : `package.json`, `src/App.jsx` (numéro de version)**
- La compilation échouait (`Could not resolve entry module "recharts"`) : `recharts` avait été retiré de `package.json` alors que `vite.config.js` le cite encore. Remis en place.
- **Compilation GitHub** : dans `.github/workflows/build.yml`, l'étape `android-actions/setup-android@v3` doit avoir `with: packages: 'platform-tools'` (Google a supprimé l'ancien paquet `tools` installé par défaut en v3).

### v2.0.0 — Refonte graphique Material You
**Fichiers modifiés : `src/App.jsx`, `src/main.jsx`, `package.json`, `capacitor.config.json`**

Version majeure : toute l'interface change d'apparence (les données et fonctions restent identiques).
- **Style natif Android (Material You / Material 3)** : surfaces tonales sans bordures, coins très arrondis, police système Roboto (fonctionne hors ligne).
- **Couleur principale au choix** (Réglages › Affichage) : bleu, vert, orange ou violet, en mode clair comme en sombre.
- **Accueil** : grande barre de recherche, cartes « À suivre » qui défilent horizontalement (rouge = en retard, couleur principale = bientôt), grille de catégories, entrées récentes.
- **Bouton « Nouveau suivi »** étendu sur l'accueil, rond sur les autres écrans, masqué dans Ajout et Réglages.
- **Barre de navigation Material** : pastille sous l'onglet actif, badge rouge du nombre de choses à traiter.
- **Historique** : recherche plein format, filtres en puces, entrées regroupées par mois.
- **Détail d'une entrée** : bandeau rouge si en retard, informations en tuiles, documents en vignettes, boutons « C'est fait » et « Agenda » mis en avant.
- **Rapport** : sélecteur de période segmenté, total en grand, comparaison avec l'année précédente, barres mensuelles (appuyer sur une barre affiche le détail du mois), répartition par catégorie en pourcentage.
- **Messages** : bulles remplacées par des « snackbars » Android en bas d'écran.
- **Accessibilité** : vrais boutons partout, libellés pour les lecteurs d'écran, contrastes vérifiés.
- **Technique** : le graphique du rapport n'utilise plus la bibliothèque `recharts` (refait en simple HTML). Barre d'état et écran de démarrage aux couleurs du nouveau thème.

### v1.4.0 — Nouvelles fonctionnalités
**Fichiers modifiés : `src/App.jsx`, `src/main.jsx`, `package.json`, `capacitor.config.json`**

- **Bloc « À suivre » sur l'accueil** : RDV en retard (en rouge), RDV des 30 prochains jours, alertes kilométriques. Le badge de l'onglet Accueil compte ce qui demande une action.
- **Bouton « C'est fait »** dans le détail d'une entrée : crée la nouvelle entrée préremplie (catégorie, titre, personne, intervenant, récurrence). L'ancien rappel est alors marqué « ✓ fait ».
  Règle : un rappel est considéré comme fait dès qu'une entrée **plus récente avec le même titre** existe dans la même catégorie.
- **Récurrence** (« À refaire dans » 1 mois / 3 mois / 6 mois / 1 an / 2 ans) : le prochain RDV se calcule tout seul.
- **Champs par catégorie** (activables dans chaque catégorie) : « Pour qui / animal », « Praticien / intervenant », « Kilométrage ». Par défaut : Voiture = km + garage ; Véto et Médecin = pour qui + praticien ; Maison = intervenant.
- **Kilométrage** : relevé au compteur + échéance (raccourcis +10 000 / +15 000 / +20 000 / +30 000 km). Alerte à moins de 1 000 km, basée sur le relevé le plus élevé de la catégorie (une catégorie = un véhicule).
- **Suggestions de saisie** : titres, personnes et intervenants déjà utilisés.
- **Ajout à Google Agenda** d'un RDV (événement sur la journée).
- **Rapport** : choix « 12 mois » ou par année, comparaison avec l'année précédente, **export CSV** (ouvre dans Excel / Google Sheets).
- **Catégories supprimées restaurables** (y compris les catégories personnalisées).
- **Verrouillage par empreinte** (code du téléphone en secours) : à l'ouverture et après 1 min en arrière-plan. Plugin `@aparajita/capacitor-biometric-auth` 8.0.2 (version compatible Capacitor 6).
- **Photos et PDF stockés en fichiers** dans le dossier privé de l'app (avant : dans les réglages, ce qui ralentissait l'app). Migration automatique au premier lancement.
- **Rappels Android** : notification 3 jours avant (9 h) **et** le jour J (8 h) pour **tous** les RDV futurs (avant : uniquement le jour J, et seulement pour les RDV à moins de 3 jours). Toucher la notification ouvre l'entrée.
- **Corrections** : barre d'état Android et écran de démarrage aux couleurs du thème sombre (avant : clairs au premier lancement).

### v1.3.1 — Corrections de bugs
- **Photos** : l'ajout de photo/image échouait systématiquement (conflit de nom avec l'icône `Image`) → corrigé
- **Photos > 4 Mo** (photos d'appareil photo) étaient refusées sans message → acceptées, compressées automatiquement
- **Barre d'onglets** : elle défilait avec le contenu au lieu de rester fixée en bas → l'app est désormais en plein écran avec barre fixe
- **Pièces jointes** : retirer toutes les pièces jointes d'une entrée n'était pas enregistré → corrigé
- **Rappels de RDV** : un RDV ajouté après l'activation des notifications n'était jamais programmé → reprogrammation automatique
- **Sauvegarde** : écriture immédiate quand l'app passe en arrière-plan (évite de perdre la dernière saisie)
- **Date du jour** : affichait la veille entre 0 h et 2 h (heure UTC au lieu de l'heure française) → corrigé
- **Catégories supprimées** : leurs entrées s'affichaient comme « Divers » → elles gardent leur vrai nom ; le rapport les compte
- **Formulaire** : catégorie par défaut « Voiture » même si elle avait été supprimée → première catégorie visible
- **Modification d'une catégorie par défaut** : son icône était remplacée par 📋 → bouton « Icône d'origine »
- **Emoji** : la recherche ne trouvait jamais rien → recherche par famille + **n'importe quel emoji** via le clavier du téléphone
- **Couleur personnalisée** : sélecteur rendu plus fiable sous Android
- **Rapport** : les barres « Nb entrées » étaient invisibles (même axe que les €) → second axe à droite
- **Import** : aucune confirmation avant d'écraser les données → confirmation ; nettoyage des anciennes pièces jointes
- **Accueil** : les entrées récentes sont cliquables
- Divers : animations réactivées, fonds de catégories adaptés au mode sombre partout, recherche insensible aux accents, bouton + masqué sur l'écran d'ajout, bouton retour qui ne tourne plus en rond

### v1.3.0
- **Modal de création/modification de catégorie** — bottom sheet animé remplaçant le formulaire inline, avec aperçu live (emoji + couleur + nom)
- **Color picker libre** — 8 couleurs prédéfinies + sélecteur natif Android pour choisir n'importe quelle couleur (affichage du code hex)
- **Emoji picker étendu** — 160+ emojis en 12 catégories (Véhicules, Animaux, Santé, Maison, Outils, Finance, Sport, Nourriture, Admin, Nature, Loisirs, Divers) + barre de recherche

### v1.2.0 → v1.3.0 (intermédiaire)
- **Mode sombre par défaut** — l'application démarre en thème sombre ; le choix reste mémorisé
- **Barre d'onglets renforcée** — fond plus distinct (`#0D1628`), bordure dorée visible, icônes inactives lisibles (`#4A6880`)
- **Couleurs des catégories atténuées** — les icônes et badges utilisent la couleur de la pastille à ~10 % d'opacité en mode sombre (plus de fonds clairs agressifs)
- **Bouton flottant `+` (FAB)** — l'onglet "Ajouter" central est remplacé par un bouton rond doré flottant (bas-droite), la barre passe à 4 onglets
- **Gestion complète des catégories** — toutes les catégories (y compris celles par défaut) sont éditables et supprimables depuis l'onglet Réglages ; la suppression d'une catégorie par défaut la masque sans supprimer les entrées associées

### v1.2.0
- Thème Mithril-Anneau
- Première version publique

---

## Modifier l'application

Éditez `src/App.jsx` et `package.json` directement dans l'interface GitHub, committez,
le build se déclenche automatiquement.
