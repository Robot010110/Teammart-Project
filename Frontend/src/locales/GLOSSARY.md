# AION — Sorani Kurdish terminology

The agreed Kurdish for AION's core concepts. **Translate every screen
using these exact words.** The same English concept must never become two
different Kurdish words on two different screens.

Dialect: **Sorani / Central Kurdish (کوردیی ناوەندی)**, Arabic script, as
spoken and written in the Kurdistan Region of Iraq. Register: ordinary
professional workplace language — what a supermarket supervisor would
actually say to staff, not literary or academic Kurdish, and not
transliterated English.

Terms marked ⚠ are the ones a native speaker should confirm; the
reasoning and the alternatives are in `REVIEW.md`.

## Roles

| English | Kurdish | Notes |
|---|---|---|
| Employee | کارمەند | Standard, unambiguous. |
| Supervisor | سەرپەرشتیار | ⚠ Direct supervision of one market. |
| Regional Manager | بەڕێوەبەری ناوچە | Manages a zone of markets. |
| Admin | بەڕێوەبەری سیستەم | Company-wide. Distinguished from بەڕێوەبەری ناوچە. |
| Staff | ستاف | Collective term for non-employee roles. |
| Manager | بەڕێوەبەر | Generic; avoid where a specific role fits. |

## Places

| English | Kurdish | Notes |
|---|---|---|
| Market | مارکێت | ⚠ The supermarket branch. Widely used as a loanword. |
| Zone | ناوچە | Group of markets under a Regional Manager. |
| Department | بەش | Section inside a market. |
| Section | بەش | Same word; context disambiguates. |

## Attendance

| English | Kurdish | Notes |
|---|---|---|
| Attendance | ئامادەبوون | |
| Check In | چوونەژوورەوە | ⚠ Starting the shift. |
| Check Out | چوونەدەرەوە | Ending the shift. Matches existing logOut wording. |
| Break | پشوو | |
| Shift | نۆرە | |
| Late | دواکەوتوو | |
| Absent | ئامادەنەبوو | |
| Present | ئامادە | |
| Working Hours | کاتژمێرەکانی کار | |
| Overtime / Extra Hours | کاتژمێری زیادە | |
| Leave (time off) | مۆڵەت | Not "چوونەدەرەوە". |

## Work

| English | Kurdish | Notes |
|---|---|---|
| Task | ئەرک | |
| Activity | چالاکی | |
| Performance | ئەدا | ⚠ |
| Report | ڕاپۆرت | |
| Inventory Counting | ژماردنی کاڵا | |
| Expired | بەسەرچوو | Past its expiry date. |
| Wasted | زیانلێکەوتوو | |
| Cleaning | پاککردنەوە | |

## Status

| English | Kurdish | Notes |
|---|---|---|
| Pending | چاوەڕوانی پەسەندکردن | ⚠ "awaiting approval" — clearer than bare چاوەڕوان. |
| Approved | پەسەندکراو | |
| Rejected | ڕەتکراوە | |
| Completed | تەواوبوو | |
| In Progress | لە بەردەوامبووندایە | |
| Draft | ڕەشنووس | |
| Active | چالاک | |
| Inactive | ناچالاک | |

## Communication

| English | Kurdish | Notes |
|---|---|---|
| Chat | چات | Loanword; universally understood. |
| Message | نامە | |
| Notification | ئاگادارکردنەوە | Matches existing Settings wording. |
| Announcement | ڕاگەیاندن | |
| Group | گروپ | |

## Common UI verbs

| English | Kurdish | Notes |
|---|---|---|
| Save | پاشەکەوتکردن | From existing Settings. |
| Cancel | پاشگەزبوونەوە | From existing Settings — kept. |
| Delete | سڕینەوە | |
| Edit | دەستکاریکردن | |
| Add | زیادکردن | |
| Search | گەڕان | |
| Filter | فلتەر | |
| Submit | ناردن | |
| Confirm | دڵنیاکردنەوە | |
| Back | گەڕانەوە | From existing Settings. |
| Loading | بارکردن… | |
| Retry | هەوڵدانەوە | |

## Rules

1. **Numerals stay Western (0–9)** everywhere — IDs, dates, times, money,
   counts. The app mixes numbers with Latin-script codes (`SUP-014`) and
   currency, and Arabic-Indic digits alongside those read badly. This
   corrects one inconsistency found in the existing Kurdish, where
   `passwordTooShort` used ٨ while every other number was Western.
2. **Brand names are never translated** — AION and TeamMart stay as-is.
3. **User-generated content is never translated** — chat messages,
   names, notes, market names.
4. **Keep interpolation placeholders exactly** — `{{name}}`, `{{count}}`.
   Kurdish word order differs from English, so move the placeholder
   within the sentence rather than forcing English order.
