# Sorani Kurdish — terms needing a native speaker's confirmation

Everything in `ckb/translation.json` was written to read as ordinary
Kurdish workplace language. These are the specific places where a native
speaker's judgement would genuinely change the wording — either because
several natural options exist, or because the English term has no settled
Kurdish equivalent in a retail context.

Each entry gives the choice made, the alternative, and why. Confirming or
correcting these is quick; the rest of the file follows from them, so
changing one here means changing it consistently everywhere via
`GLOSSARY.md`.

---

### Supervisor → سەرپەرشتیار
**Alternative:** بەڕێوەبەر
سەرپەرشتیار reads as hands-on supervision of people doing work, which
matches this role (one market, directly over its employees). بەڕێوەبەر
implies broader management authority and is already used for
بەڕێوەبەری ناوچە (Regional Manager) and بەڕێوەبەری سیستەم (Admin), so
reusing it here would blur three distinct roles. **Confirm this is what
supermarket staff in Kurdistan actually call this position.**

### Market → مارکێت
**Alternative:** فرۆشگا / سوپەرمارکێت
مارکێت is the everyday loanword and is what staff are most likely to
say. فرۆشگا is more formally "store/shop" and may read as more correct
written Kurdish but less like real speech. This word appears constantly
throughout the app, so it is worth getting right.

### Check In → چوونەژوورەوە
**Alternative:** دەستپێکردنی کار ("starting work")
چوونەژوورەوە literally means "entering", and is also the natural phrase
for signing in to an account — which the app uses it for in
`auth.signIn`. That overlap could be confusing on the Attendance screen,
where Check In means starting a shift, not logging in. **If the two need
to be distinct, Attendance should use دەستپێکردنی کار / کۆتاییهێنانی کار.**

### Performance → ئەدا
**Alternative:** کارایی
ئەدا is the closer match for "performance" as an evaluated measure of how
someone works. کارایی leans towards "efficiency/productivity". The
Performance screen shows a score and history, so ئەدا was chosen.

### Pending → چاوەڕوانی پەسەندکردن
**Alternative:** چاوەڕوان
The full phrase means "awaiting approval", which is what this status
actually means in AION — an item a Supervisor has not reviewed yet. Bare
چاوەڕوان just means "waiting" and is vaguer. The trade-off is length:
this is a status badge, and the longer phrase may crowd narrow chips on
a phone. **If it overflows in practice, shorten to چاوەڕوان.**

### Cashier → قاسە
**Alternative:** فرۆشیار
قاسە refers to the till/register position specifically. فرۆشیار is
"salesperson" more generally. Login offers Worker vs Cashier as distinct
account types, so the till-specific word seemed right.

### Overlooking → چاودێر
This is an AION-specific role name (`OVERLOOKING_SUPERVISOR` — the
evening-shift counterpart to Supervisor), not a standard job title, so
there is no established Kurdish for it. چاودێر means "watcher/monitor".
**This one is a guess and most likely to need changing.**

### "Saving…" → پاشەکەوت دەکرێت…
The existing Kurdish had پاشەکەوتکردن, which is the noun "saving" rather
than the in-progress "it is being saved". Changed for grammar. The noun
form is kept for the Save *button* (`common.save`), where it is correct.

### Password length message
The existing Kurdish read `لانیکەم ٨ پیت` — Arabic-Indic ٨ and پیت
("letter"). Changed to Western `8` and نووسە ("character"): the digit for
consistency with every other number in the app (see GLOSSARY rule 1), and
نووسە because a password may contain digits and symbols, not just
letters. **Confirm نووسە is the natural word here rather than پیت.**

---

## Existing Kurdish that was kept unchanged

The Settings Kurdish already in the app was good and was carried over
verbatim, including: ڕێکخستنەکان, هەژمار, وشەی نهێنی, ئاگادارکردنەوەکان,
زمان, گەڕانەوە بۆ پرۆفایل, چوونەدەرەوە, and the full password-privacy
and notifications paragraphs. Only the two items noted above were
changed, plus "TeamMart" → "AION" inside `modeAllSub` to match the
rebrand.
