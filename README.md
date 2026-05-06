# Suivi Divers — v1.2.0

Application Android de suivi personnel (voiture, vétérinaire, médecin, maison…).
Thème Mithril-Anneau.

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
5. Téléchargez `SuiviDivers-v1.2.0`
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
│   └── main.jsx               ← Point d'entrée + plugins Capacitor
├── public/
│   └── icon.png               ← Icône de l'application
├── index.html
├── package.json               ← Dépendances (version 1.2.0)
├── vite.config.js
└── capacitor.config.json
```

---

## Versioning

La version est définie dans `package.json` → champ `"version"`.
Convention :
- `+0.0.1` Patch — correction de bug
- `+0.1.0` Mineure — nouvelle fonctionnalité
- `+1.0.0` Majeure — refonte

---

## Modifier l'application

Éditez `src/App.jsx` directement dans l'interface GitHub, committez,
le build se déclenche automatiquement.
