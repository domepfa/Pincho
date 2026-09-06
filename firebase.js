/* ================================================================
   firebase.js — dünne REST-Anbindung an Firebase Realtime Database.
   Kein SDK, kein Build-Step (gleiches Prinzip wie bei Firnspur/Fixseil).

   WICHTIG NACH DEM ERSTELLEN DES FIREBASE-PROJEKTS:
   FIREBASE_URL unten durch die echte Datenbank-URL ersetzen
   (Firebase Console → Realtime Database → URL oben, Format etwa
   "https://<projekt>-default-rtdb.<region>.firebasedatabase.app").
   Siehe README.md für die kompletten Setup-Schritte inkl. Security Rules.
   ================================================================= */

const FIREBASE_URL = 'https://pincho-crew-default-rtdb.europe-west1.firebasedatabase.app';

async function fbGet(path) {
  try {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`);
    if (!res.ok) {
      console.error('Firebase GET fehlgeschlagen', path, res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('Firebase GET Fehler', path, e);
    return null;
  }
}

async function fbPut(path, data) {
  try {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.error('Firebase PUT Fehler', path, e);
    return false;
  }
}

async function fbPatch(path, data) {
  try {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (e) {
    console.error('Firebase PATCH Fehler', path, e);
    return false;
  }
}

/* Push = neuer Eintrag mit von Firebase generierter, eindeutiger ID.
   Gibt die generierte ID zurück (oder null bei Fehler). */
async function fbPush(path, data) {
  try {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.name;
  } catch (e) {
    console.error('Firebase POST Fehler', path, e);
    return null;
  }
}

async function fbDelete(path) {
  try {
    const res = await fetch(`${FIREBASE_URL}/${path}.json`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.error('Firebase DELETE Fehler', path, e);
    return false;
  }
}
