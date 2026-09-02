"use client";

/**
 * Firebase for the web client. The site is the product now, so it calls
 * the same backend the app did — which means it needs the same two
 * tokens on every request: a Firebase ID token (anonymous is fine) and
 * an App Check token (reCAPTCHA Enterprise).
 *
 * Everything here is client-only and lazy: `getAuthedHeaders()` is the
 * single entry point, it initialises Firebase on first call, and the
 * whole module is dynamically imported so the SDK is never in the
 * initial page load.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken,
  type AppCheck,
} from "firebase/app-check";
import {
  getAuth,
  signInAnonymously,
  type Auth,
} from "firebase/auth";

const config = {
  apiKey: "AIzaSyAW02Qjh8bpSluC2NTYyuc2ZuqgZBJOKaI",
  authDomain: "crititrack-f7430.firebaseapp.com",
  projectId: "crititrack-f7430",
  storageBucket: "crititrack-f7430.firebasestorage.app",
  messagingSenderId: "1042019566653",
  appId: "1:1042019566653:web:e126a8504cec33a523d654",
};

/** Public reCAPTCHA Enterprise site key, registered in Firebase App
 * Check. Public by design — it ships in every client. */
const RECAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ??
  "6LeL-54tAAAAAJstdsua0EMljQuvUvrZOJpEk26_";

let app: FirebaseApp | undefined;
let appCheck: AppCheck | undefined;
let auth: Auth | undefined;

function ensureInit(): void {
  if (app) return;
  app = getApps()[0] ?? initializeApp(config);
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
  auth = getAuth(app);
}

/**
 * The `Authorization` and `X-Firebase-AppCheck` headers the backend
 * requires. Signs in anonymously on first use. Throws if attestation or
 * sign-in fails, so the caller can render a typed error rather than a
 * silent empty result.
 */
export async function getAuthedHeaders(): Promise<Record<string, string>> {
  ensureInit();

  const [{ token: acToken }, idToken] = await Promise.all([
    getAppCheckToken(appCheck!, /* forceRefresh */ false),
    (async () => {
      const user =
        auth!.currentUser ?? (await signInAnonymously(auth!)).user;
      return user.getIdToken();
    })(),
  ]);

  return {
    Authorization: `Bearer ${idToken}`,
    "X-Firebase-AppCheck": acToken,
  };
}
