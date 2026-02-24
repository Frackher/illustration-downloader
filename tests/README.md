# Tests – Illustration Downloader

Tests Vitest sur les **parcours critiques** de l’extension (i18n, overlay, background, locales).

**Documentation :** [Français](README.md) | [English](README.en.md)

## Windows : installer Node.js (une seule fois)

Sous Windows, npm est fourni avec Node.js. Il suffit d’installer Node :

1. **Avec winget** (Windows 10/11, en PowerShell ou Invite de commandes) :
   ```text
   winget install OpenJS.NodeJS.LTS
   ```
   Puis fermer et rouvrir le terminal.

2. **Ou** télécharger l’installateur sur [nodejs.org](https://nodejs.org/) (version LTS), lancer le .msi et suivre l’assistant. Cocher l’option qui ajoute Node au PATH.

3. **Ou** avec Chocolatey : `choco install nodejs-lts`

Après installation, vérifier dans un nouveau terminal : `node -v` et `npm -v` doivent afficher des numéros de version.

## Exécution

**Depuis le dossier du projet** (`imgDownloader`) :

```bash
npm install
npm test
```

Sous Windows, vous pouvez aussi **double-cliquer** sur `run-tests.bat` à la racine du projet : le script installe les dépendances si besoin puis lance les tests (il utilise CMD, pas PowerShell).

**Si PowerShell affiche « l’exécution de scripts est désactivée »** : utilisez l’**Invite de commandes (CMD)** au lieu de PowerShell, ou lancez explicitement npm en CMD :
```cmd
cmd /c "cd /d C:\Users\...\imgDownloader && npm.cmd test"
```
Ou double-cliquez sur `run-tests.bat` (qui utilise déjà `npm.cmd`).

Mode watch (relance à chaque modification) :

```bash
npm run test:watch
```

Sans npm, si Node est déjà installé :

```bash
npx vitest run
```

## Maintenance pour les prochains devs

### Quand modifier les tests

| Changement dans le projet | Fichier(s) de test à mettre à jour |
|--------------------------|-------------------------------------|
| Nouvelle clé i18n utilisée dans le content script ou les options | `locales.test.js` : ajouter la clé dans `CRITICAL_KEYS` si elle est critique pour l’UX. Vérifier que tous les `_locales/*/messages.json` contiennent la clé. |
| Nouveau message avec placeholder `$1$` (ou `$2$`) | `locales.test.js` : le test « messages avec $1$ ont placeholders défini » couvre déjà le cas. Ajouter le `placeholders` dans chaque `messages.json` (sinon Chrome refuse de charger l’extension). |
| Comportement de l’overlay (boutons, I18N.init) | `content-overlay.test.js` et éventuellement `i18n.test.js`. Ne pas supprimer le pattern `init().then(addButtons, addButtons)` sans équivalent qui garantit que `addButtons` est toujours appelé. |
| Logique de format (paysage/portrait/carré) ou nom de fichier dans le background | `background.test.js`. Si de nouvelles fonctions sont extraites, les exposer pour les tests comme `getFormatFolder` / `getExtensionFromUrl` / `safeFilenamePart` (voir `tests/setup.js` → `loadBackground()`). |
| Nouvelle locale (langue) | Créer `_locales/<code>/messages.json`, puis ajouter le code dans `LOCALES` dans `locales.test.js` et dans `SUPPORTED` / `UI_TO_LOCALE` dans `i18n.js`. |

### Rappel : parcours critique « boutons visibles »

Pour que les boutons de téléchargement s’affichent sur les images :

1. **content.js** doit appeler `addButtons()` que `I18N.init()` résolve ou rejette, ou à défaut appeler `addButtons()` si `I18N` est absent.
2. **i18n.js** : `init()` ne doit jamais laisser la promesse sans résolution (toujours un `try/catch` avec fallback, ex. locale `en` ou `messages = {}`).
3. **Mocks** : `tests/setup.js` fournit `loadI18n()` et `loadBackground()` ; ne pas casser la signature de l’API Chrome mockée (storage.sync.get avec callback ou promesse selon le fichier chargé).

### Lancer les tests avant un commit / une PR

Recommandation : exécuter `npm test` avant de pousser du code. Si les tests échouent, corriger le code ou adapter les tests si le comportement attendu a volontairement changé.

### CI (GitHub Actions)

Le dossier `.github/workflows/tests.yml` lance les tests sur chaque push/PR sur `main` ou `master`. Aucune action requise si le dépôt est sur GitHub.

---

Les tests sont conçus pour **ne pas modifier les sources** de l’extension : le chargement de `i18n.js` et `background.js` se fait par `eval` dans le setup avec des mocks globaux (`chrome`, `fetch`), sans patch des fichiers du projet.
