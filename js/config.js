/* ================================================================
   config.js — das Einzige, worin sich Haupt-App und Beta (/beta/)
   unterscheiden. Wird als erstes Skript geladen; der restliche Code ist
   in beiden Ordnern identisch (siehe tools/promote-beta.sh).
   - STORAGE_PREFIX: eigener Offline-Speicher je App (gleiche Domain)
   - ASSET_BASE: Bilder/Anleitungen liegen nur einmal unter /assets/
   ================================================================= */
const IS_BETA = location.pathname.includes('/beta/');
const STORAGE_PREFIX = IS_BETA ? 'pinchobeta_' : 'pincho_';
const ASSET_BASE = IS_BETA ? '../assets/' : './assets/';
