# Illustration Downloader

Extension Chrome/Brave pour sauvegarder facilement les illustrations depuis **X.com** et **Pixiv**.

**Documentation :** [Français](README.md) | [English](README.en.md) — L’extension est disponible en français, anglais, japonais, coréen, chinois et espagnol (`_locales/`). **Traductions de la doc** (README, tests) dans d’autres langues sont les bienvenues (ja, ko, zh_CN, es, etc.).

- **Auteur** : Fracker (assisté par Cursor)
- **Version** : 1.0.0 — [SemVer](https://semver.org/)

## Installation

1. Ouvrir `chrome://extensions` (ou `brave://extensions`).
2. Activer **Mode développeur**.
3. Cliquer sur **Charger l’extension non empaquetée** et choisir le dossier du projet (ex. `illustrationDownloader`).

## Utilisation

- **Cliquer sur l’icône de l’extension** ouvre la **page des paramètres**.
- **X.com** : un bouton **↓** apparaît sur les images des tweets. **Pixiv** : même bouton sur les images des pages d’œuvre (artworks).
- Les images sont enregistrées dans **Téléchargements\[sous-dossier]\landscape**, **portrait** ou **square** selon le ratio (ou **nsfw** si option activée).
- Nom du fichier : `YYYYMMDD_platform_artistName.ext` — `platform` vaut `x` ou `pixiv`. En cas de doublon, le navigateur renomme (ex. `fichier (1).jpg`).
- **Pixiv** : l’image téléchargée est en **format original** (img-original) ; auteur et titre de l’œuvre sont détectés depuis la page.
- **Métadonnées (v1.5+)** : pour les images **JPEG**, l’extension écrit des métadonnées EXIF : date du téléchargement, auteur (nom d’utilisateur), source (URL du post), description (texte du tweet). Les autres formats (PNG, WebP, etc.) sont enregistrés sans modification des métadonnées.

## Paramètres (page dédiée)

Tous les paramètres se trouvent sur une seule page (ouverte en cliquant sur l’icône ou via Clic droit → Options) :

- **Dossier personnalisé** (v1.1+) : bouton **Choisir un dossier…** pour enregistrer les images dans un dossier de votre choix (ex. `C:\Images`), avec sous-dossiers `landscape`, `portrait`, `square`.  
  - **Chrome / Edge** : fonctionne directement.  
  - **Brave** : activer le flag **File System Access API** : `brave://flags/#file-system-access-api` → Enabled → redémarrer Brave. Sans ce flag, le bloc « Dossier personnalisé » n’apparaît pas et seul le sous-dossier des Téléchargements est utilisé.
- **Sous-dossier des Téléchargements** : utilisé si aucun dossier personnalisé n’est choisi (ex. `Illustrations` → `Téléchargements\Illustrations\landscape`, etc.).
- **Demander à chaque fois où enregistrer** : si coché, la boîte « Enregistrer sous » s’ouvre à chaque téléchargement. Décoché par défaut.
- **Format carré (tolérance)** : ratio min/max pour considérer une image comme carrée (défaut 0,9–1,1).

- **Illustrations NSFW** : si activé, un second bouton (🔞, fond rose) apparaît à gauche du bouton de téléchargement. Un clic enregistre l’image dans le dossier **nsfw** (sans distinction paysage/portrait/carré).

Penser à cliquer sur **Enregistrer** après avoir modifié les paramètres.

## Tests (parcours critiques)

Pour éviter les régressions (ex. boutons qui n’apparaissent plus) :

- **Windows** : installer Node.js une fois (ex. `winget install OpenJS.NodeJS.LTS` ou [nodejs.org](https://nodejs.org/)), puis double-cliquer sur **`run-tests.bat`** ou exécuter `npm install` puis `npm test` dans le dossier du projet.
- **Autres** : `npm install` puis `npm test`.

- **i18n** : `init()` résout toujours, `t()` retourne les messages, fallback si fetch échoue.
- **Content overlay** : le callback type `init().then(addButtons, addButtons)` appelle bien `addButtons` (résolution ou rejet).
- **Background** : `getFormatFolder`, `getExtensionFromUrl`, `safeFilenamePart`.
- **_locales** : clés critiques présentes dans toutes les langues, messages avec `$1$` ont `placeholders` défini.

**Maintenance** : voir **[tests/README](tests/README.md)** ([EN](tests/README.en.md)) pour exécution, mise à jour des tests et rappels sur les parcours critiques (boutons overlay, i18n).

## Fichiers

- `manifest.json` – Manifest V3 (v1.1.0 : + offscreen pour dossier personnalisé)
- `js/background.js` – Téléchargement, format (paysage/portrait/carré), injection EXIF (v1.5), écriture via offscreen si dossier personnalisé
- `js/lib/piexif.js` – Librairie EXIF (écriture métadonnées JPEG)
- `js/i18n.js` – Internationalisation (auto / langue personnalisée)
- `js/content.js` + `css/content.css` – Overlay sur les images X.com et Pixiv
- `options/options.html` + `js/options.js` + `css/options.css` – Page des paramètres
- `offscreen.html` + `js/offscreen.js` – Écriture des fichiers dans le dossier choisi (File System Access API)
- `tests/` – Tests Vitest (parcours critiques)

## Versioning (SemVer)

Le projet suit [Semantic Versioning](https://semver.org/) (SemVer) : **MAJOR.MINOR.PATCH**.

| Composant | Rôle |
|-----------|------|
| **MAJOR** | Changements incompatibles (comportement ou « API » utilisateur rompu). |
| **MINOR** | Nouvelles fonctionnalités rétrocompatibles. |
| **PATCH** | Corrections de bugs rétrocompatibles. |

En phase de pré-release (pas de release publique), la version reste en **0.MINOR.PATCH** : le major 0 indique que toute mise à jour peut encore introduire des changements incompatibles. Au passage en release publique, la version pourra passer à **1.0.0** et les règles SemVer s’appliqueront pleinement.

Exemples : 1.0.0 → 1.0.1 (correctif), 1.0.1 → 1.1.0 (nouvelle fonctionnalité).

## Release

Historique des versions (SemVer, voir section Versioning ci-dessus).

| Version | Date       | Nouveautés |
|---------|------------|------------|
| 1.0.0   | 2026-02-19 | **Release 1.0.** Pixiv : img-original prioritaire, essai extensions (.png, .jpg, …) avant img-master ; pages profil (URLs /c/, _square1200) ; nom d'artiste depuis h1/og:title sur page utilisateur. Tests Pixiv (getBestImageUrl, pximgOriginal*). |
| 0.6.0   | 2025-02-15 | Support **Pixiv** (format original, fallback master si 404). Auteur depuis bloc DOM + metadata « … by Auteur ». Referer via declarativeNetRequest. Pas d’overlay sur les avatars. |
| 0.5.0   | 2025-02-15 | **Métadonnées** EXIF + XMP (date, auteur, source, description). Encodage UTF-8 pour japonais et autres langues. Auteur X depuis URL sur vue photo. |
| 0.4.0   | 2025-02-11 | Option **NSFW** (bouton 🔞, dossier nsfw). Tolérance **format carré** configurable. |
| 0.3.0   | 2025-02-11 | Sous-dossier des Téléchargements configurable. Option « Demander à chaque fois où enregistrer ». |
| 0.2.0   | 2025-02-11 | **Dossier personnalisé** (File System Access API, document offscreen). |
| 0.1.0   | 2025-02-11 | X.com : overlay ↓ sur les images, dossiers landscape/portrait/square, nom `YYYYMMDD_x_artistName.ext`. i18n, page options. |
