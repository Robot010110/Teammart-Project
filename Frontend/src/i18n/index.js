import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en/translation.json";
import ckb from "../locales/ckb/translation.json";

// i18n/index.js — AION's localization core.
//
// Two languages, matching what the product actually offers: English and
// Sorani Kurdish (Central Kurdish). The BCP-47 tag for Sorani is `ckb`,
// which is what i18next and `<html lang>` use; the backend stores the
// same preference as the AppLanguage enum ENGLISH/KURDISH, so the two
// maps below translate between them rather than changing the API or the
// database — see profileService.updateMyPreferences.
export const LANGUAGES = {
  en: { tag: "en", dir: "ltr", apiValue: "ENGLISH", label: "English", endonym: "English" },
  ckb: { tag: "ckb", dir: "rtl", apiValue: "KURDISH", label: "Kurdish", endonym: "کوردی (سۆرانی)" },
};

// Backend enum -> i18next tag, and back. The account is still the source
// of truth for a signed-in person (it follows them across devices, which
// localStorage would not).
export const API_TO_TAG = { ENGLISH: "en", KURDISH: "ckb" };
export const TAG_TO_API = { en: "ENGLISH", ckb: "KURDISH" };

// Mirrored locally ONLY so the pre-login screens (splash, role select,
// login) can render in the right language: there is no profile to read
// yet at that point. Once signed in, the account value wins and
// overwrites this. Deliberately a separate key from the auth token.
export const STORED_LANG_KEY = "aion_language";

export function readStoredTag() {
  try {
    const v = localStorage.getItem(STORED_LANG_KEY);
    return v && LANGUAGES[v] ? v : null;
  } catch {
    // Private mode / blocked site data — fall back to the default rather
    // than letting a storage exception break app startup.
    return null;
  }
}

export function writeStoredTag(tag) {
  try {
    localStorage.setItem(STORED_LANG_KEY, tag);
  } catch {
    /* non-fatal: the account preference is the real store */
  }
}

// Applies the language to the document itself. `dir` on <html> is what
// makes the whole UI mirror — every Tailwind logical utility (ms-/me-/
// ps-/pe-/text-start/border-s) keys off it, so this one line is what
// turns the app RTL rather than any per-component branching.
export function applyDocumentLanguage(tag) {
  const meta = LANGUAGES[tag] ?? LANGUAGES.en;
  const el = document.documentElement;
  el.setAttribute("lang", meta.tag);
  el.setAttribute("dir", meta.dir);
  // Lets CSS switch the font stack for Kurdish without every component
  // knowing about it — see index.css.
  el.classList.toggle("lang-ckb", tag === "ckb");
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ckb: { translation: ckb },
  },
  lng: readStoredTag() ?? "en",
  fallbackLng: "en",
  // Missing Kurdish key falls back to the English string rather than
  // rendering the raw key at the user — a partially translated screen
  // should read as English, never as `home.greeting`.
  returnEmptyString: false,
  interpolation: {
    // React already escapes rendered output; double-escaping here would
    // turn an apostrophe in a name into &#39;.
    escapeValue: false,
  },
});

applyDocumentLanguage(i18n.language);

i18n.on("languageChanged", (tag) => {
  applyDocumentLanguage(tag);
  writeStoredTag(tag);
});

// Called once the signed-in profile arrives (App.jsx session restore).
// The account is the source of truth — it follows the person across
// devices — so this overrides whatever the pre-login local mirror said.
// A no-op when they already match, so it will not thrash on re-render.
export function applyProfileLanguage(apiLanguage) {
  const tag = API_TO_TAG[apiLanguage];
  if (tag && i18n.language !== tag) i18n.changeLanguage(tag);
}

// Settings -> Language. Switches immediately (no reload: React re-renders
// on i18next's languageChanged, and dir/font swap on <html>), then lets
// the caller persist to the account.
export function setLanguageTag(tag) {
  if (LANGUAGES[tag] && i18n.language !== tag) i18n.changeLanguage(tag);
}

// Pre-login language selection (role picker / staff / employee login
// screens — the only surfaces reachable before a session exists).
//
// The problem this solves: once login succeeds, App.jsx's session-restore
// path would otherwise unconditionally apply the ACCOUNT's saved
// language (applyProfileLanguage), silently discarding whatever the
// person just picked on the login screen a moment earlier. But the
// account's saved language must still win on an ordinary login where
// nobody touched the pre-login toggle — e.g. a fresh browser with no
// local history, logging into an account that was previously set to
// Kurdish in Settings on a different device. Both directions are real,
// so the two cases have to be told apart rather than one rule picking a
// permanent winner.
//
// The distinguishing signal is intent: did the person actually tap the
// pre-login toggle THIS visit, or is the current language just whatever
// was already active (the localStorage mirror, or the "en" default)?
// sessionStorage captures exactly that — cleared when the tab/session
// ends, so a choice from a past visit can never masquerade as "just
// made" and wrongly override a real account preference on some later,
// unrelated login.
const EXPLICIT_CHOICE_KEY = "aion_language_explicit";

function markLanguageExplicit() {
  try {
    sessionStorage.setItem(EXPLICIT_CHOICE_KEY, "1");
  } catch {
    /* private mode / blocked storage — worst case the account's saved
       language wins after login instead of the pre-login pick, which is
       still a reasonable, working fallback. */
  }
}

// Read-once: called exactly once per login attempt (App.jsx's
// handleLogin), so a choice can only ever apply to the ONE login it was
// made for, never linger and affect a later one in the same tab.
export function consumeExplicitLanguageChoice() {
  try {
    const v = sessionStorage.getItem(EXPLICIT_CHOICE_KEY);
    sessionStorage.removeItem(EXPLICIT_CHOICE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

// Used ONLY by the pre-login language toggle (RoleSelectScreen /
// StaffLoginScreen / EmployeeLoginScreen). Deliberately a separate
// function from setLanguageTag — the in-app Settings picker (which
// writes straight to the account itself via updateMyPreferences) has no
// need to participate in the pre-login explicit-choice tracking above.
export function setLanguageTagFromPreLogin(tag) {
  setLanguageTag(tag);
  markLanguageExplicit();
}

export default i18n;
