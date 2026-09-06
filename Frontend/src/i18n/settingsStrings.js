// settingsStrings.js — the translation layer for the Settings surface.
//
// Scope, stated plainly: this app has no i18n framework, and the rest of
// the product is written in English inline. Rather than pull in a large
// localization dependency or fabricate translations for hundreds of
// strings across every screen, this covers the Settings screens only —
// the surface the language preference lives on — so choosing Kurdish
// visibly does something real. Every other screen stays English for now,
// and the Language page says so honestly instead of implying full
// coverage.
//
// The Kurdish here is Sorani. It should be reviewed by a native speaker
// before this ships to real users; it is a starting point, not a
// verified localization.
const STRINGS = {
  ENGLISH: {
    dir: "ltr",
    settings: "Settings",
    backToProfile: "Back to Profile",
    backToSettings: "Back to Settings",
    logOut: "Log Out",

    account: "Account",
    accountSub: "Manage your account and password",
    accountTitle: "Account",
    accountLead: "Your account information",
    employeeId: "Employee ID",
    employeeIdHint: "This is your unique employee ID",
    userId: "User ID",
    userIdHint: "This is the ID you sign in with",
    password: "Password",
    passwordHidden: "Your password is hidden for security reasons.",
    passwordNotice:
      "For security, your password cannot be viewed — not by you, and not by an administrator. If you are locked out, an administrator can reset it for you.",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm New Password",
    passwordChanged: "Password changed successfully.",
    passwordMismatch: "The new passwords do not match.",
    passwordTooShort: "New password must be at least 8 characters.",
    cancel: "Cancel",
    saving: "Saving…",

    notifications: "Notifications",
    notificationsSub: "Choose when you receive notifications",
    notificationsTitle: "Notifications",
    notificationsLead: "Choose when and how you receive notifications.",
    modeAll: "All Notifications",
    modeAllSub: "Receive all notifications from TeamMart (tasks, messages, updates).",
    modeMentions: "Mentions Only",
    modeMentionsSub: "Only get notified when someone mentions you in chat.",
    modeWork: "Work Activity Only",
    modeWorkSub: "Only work notifications, and only while you are checked in and working.",
    modeMute: "Mute All",
    modeMuteSub: "Turn off all optional notifications.",
    notificationsFootnote:
      "Important account notifications (such as your account status or role changing) are always delivered, even when muted.",

    language: "Language",
    languageSub: "Select your preferred language",
    languageTitle: "Language",
    languageLead: "Choose your preferred language.",
    english: "English",
    englishSub: "Use English language",
    kurdish: "Kurdish",
    kurdishSub: "Bikarhênana zimanê kurdî",
    languageFootnote:
      "Kurdish currently covers the Settings screens. The rest of the app is still in English while translation continues.",
    saved: "Saved",
  },

  KURDISH: {
    dir: "rtl",
    settings: "ڕێکخستنەکان",
    backToProfile: "گەڕانەوە بۆ پرۆفایل",
    backToSettings: "گەڕانەوە بۆ ڕێکخستنەکان",
    logOut: "چوونەدەرەوە",

    account: "هەژمار",
    accountSub: "بەڕێوەبردنی هەژمار و وشەی نهێنی",
    accountTitle: "هەژمار",
    accountLead: "زانیاری هەژمارەکەت",
    employeeId: "ناسنامەی کارمەند",
    employeeIdHint: "ئەمە ناسنامەی تایبەتی تۆیە",
    userId: "ناسنامەی بەکارهێنەر",
    userIdHint: "ئەمە ئەو ناسنامەیەیە کە پێی دەچیتە ژوورەوە",
    password: "وشەی نهێنی",
    passwordHidden: "وشەی نهێنیت لەبەر پاراستن شاراوەیە.",
    passwordNotice:
      "لەبەر پاراستن، وشەی نهێنیت ناتوانرێت ببینرێت — نە لەلایەن تۆوە و نە لەلایەن بەڕێوەبەرەوە. ئەگەر نەتوانیت بچیتە ژوورەوە، بەڕێوەبەر دەتوانێت بۆت ڕێکی بخاتەوە.",
    changePassword: "گۆڕینی وشەی نهێنی",
    currentPassword: "وشەی نهێنی ئێستا",
    newPassword: "وشەی نهێنی نوێ",
    confirmNewPassword: "دووبارەکردنەوەی وشەی نهێنی نوێ",
    passwordChanged: "وشەی نهێنی بە سەرکەوتوویی گۆڕدرا.",
    passwordMismatch: "وشە نهێنییە نوێیەکان وەک یەک نین.",
    passwordTooShort: "وشەی نهێنی نوێ دەبێت لانیکەم ٨ پیت بێت.",
    cancel: "پاشگەزبوونەوە",
    saving: "پاشەکەوتکردن…",

    notifications: "ئاگادارکردنەوەکان",
    notificationsSub: "دیاریبکە کەی ئاگادارکردنەوە وەردەگریت",
    notificationsTitle: "ئاگادارکردنەوەکان",
    notificationsLead: "دیاریبکە کەی و چۆن ئاگادارکردنەوە وەردەگریت.",
    modeAll: "هەموو ئاگادارکردنەوەکان",
    modeAllSub: "هەموو ئاگادارکردنەوەکانی تیم‌مارت وەربگرە (ئەرک، نامە، نوێکردنەوە).",
    modeMentions: "تەنها ئاماژەکان",
    modeMentionsSub: "تەنها کاتێک ئاگادار دەکرێیتەوە کە کەسێک لە چاتدا ئاماژەت پێدەکات.",
    modeWork: "تەنها چالاکی کار",
    modeWorkSub: "تەنها ئاگادارکردنەوەی کار، ئەویش کاتێک لە کاردایت.",
    modeMute: "بێدەنگکردنی هەموو",
    modeMuteSub: "کوژاندنەوەی هەموو ئاگادارکردنەوە ناپێویستەکان.",
    notificationsFootnote:
      "ئاگادارکردنەوە گرنگەکانی هەژمار (وەک گۆڕانی دۆخ یان ڕۆڵ) هەمیشە دەگەن، تەنانەت کاتێک بێدەنگ کراوە.",

    language: "زمان",
    languageSub: "زمانی دڵخوازت هەڵبژێرە",
    languageTitle: "زمان",
    languageLead: "زمانی دڵخوازت هەڵبژێرە.",
    english: "ئینگلیزی",
    englishSub: "بەکارهێنانی زمانی ئینگلیزی",
    kurdish: "کوردی",
    kurdishSub: "بە کاری کوردی بیکار بێنە",
    languageFootnote:
      "کوردی لە ئێستادا تەنها ڕووپەڕەکانی ڕێکخستن دەگرێتەوە. بەشەکانی تری ئەپ هێشتا بە ئینگلیزین.",
    saved: "پاشەکەوتکرا",
  },
};

export function stringsFor(language) {
  return STRINGS[language] ?? STRINGS.ENGLISH;
}
