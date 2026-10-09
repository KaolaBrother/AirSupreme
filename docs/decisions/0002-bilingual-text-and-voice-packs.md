# 0002 — Bilingual text in place, and pre-recorded voice packs keyed by line id

- **Status**: accepted
- **Date**: 2026-10-09 (records decisions taken while making English the default language and adding voice acting: i18n core `a3434fc`; bilingual data `666838a`, `b30a040`; UI and runtime strings merged in `862fafa`, `d3ea554`; voice packs `8277131`; `VoiceSystem` `16f4c07`; presentation wiring `d87dd33`; wingman-line top-up `ed418e3`)

## Context

- Every player-facing string had been written in Chinese, inline: in the UI classes, the coordinator's toasts, the boss warnings and the data tables (for example `PowerUpConfig.name` was `'生命恢复'` and `CampaignSpeaker.callsign` a `string`). English was to become the default language, with Simplified Chinese kept as a setting that can be switched while playing.
- The two ways to localise were key-based string tables (an id per string, one table per language, lookups by key) or bilingual values in place (both languages written where the text is defined, picked at the point of display).
- The work was split into parallel batches that owned disjoint files — the campaign data and cast, the UI layer, the runtime strings — all branched from the same commit.
- Shared constraints from the campaign API spec still applied: new modules may not touch `document` / `window` at import time, and per-frame HUD paths must not allocate.
- The rewritten script was to be voiced in English and Mandarin with one generated take per line, the radio lines sounding like radio and the music staying audible but out of the way.

## Decision

1. **Bilingual text in place (`LocalizedText`).** `src/i18n/index.ts` defines `LocalizedText { en, zh }` with both fields required, the locale state (`Locale = 'en' | 'zh-CN'`, `DEFAULT_LOCALE = 'en'`, `getLocale` / `setLocale` / `onLocaleChange`, `normalizeLocale` falling back to English) and `tr()` / `localize()` / `format()` (`{name}` placeholders). Player-facing text is a `LocalizedText` written next to the data or code it belongs to — config `name` / `description` / `unit` / `label` fields, every campaign field, UI literals as `tr({ en, zh })` — and is resolved where it is displayed. There are no string keys and no per-language tables. `localize()` passes plain strings through, so code could migrate file by file. Per-frame code keeps its bilingual objects as module constants. The language is a persisted start-flow setting (`StartFlowSettings.language`, English by default, not taken from the browser) applied by `src/main.ts` before any UI renders.
2. **Voice packs keyed by line id.** Every voiced line carries a stable id — `RadioLine.id`, `VoicedText.id` for briefing / prologue / epilogue paragraphs — that is also its file name, and `getVoiceScript()` is the single list of what is voiced. Each language has a pack of pre-generated, one-take MP3 files committed to the repository at `public/voice/<en|zh>/<id>.mp3`, plus:
   - `public/voice/manifest.json` — the runtime contract: the lines each pack has, with `duration` and `bytes`. `VoiceSystem` only requests listed ids, so a line without a recording is simply text-only.
   - `public/voice/provenance.json` — how each file was made: generator and model, voice ids, generation ids and `sha256` per file. The files keep the C2PA provenance data the generator embedded.

   Everything that shapes the sound happens at playback, in `VoiceSystem`: the per-speaker radio filter and squelch, the clean narration chain, loudness normalisation and music ducking (through `voiceDuckBridge`). Voice is optional at every layer — `DefaultCampaignPresentationDeps.voice` and `StoryOverlay.narration` may be absent, a missing manifest or file, a slow load or volume 0 all fall back to text — and timing is owned by the UI (`RadioComms.holdForVoice` / `releaseVoice`, the `StoryNarration` hook), which waits only briefly for a voice to start and otherwise keeps its text-only timing.

## Consequences

- The batches merged with conflicts only at imports and read sites (`862fafa`, `d3ea554` wrapped the now-bilingual data reads in `tr()`); consumers gained `tr()` where they read a field, and there was no shared table to merge. The type system enforces completeness — a `LocalizedText` without both languages does not compile — and tests check the data tables and the campaign fields in both languages (`BilingualData.test.ts`, `CampaignData.test.ts`).
- Both languages ship in the JavaScript bundle; nothing is loaded per language except the voice pack.
- A third language would mean widening `Locale` and `LocalizedText` and filling in every literal and data field — the compiler lists each place, but there is no translator-facing file to hand off. Text cannot be edited without touching code.
- Live switching relies on subscribers: the menus, HUD, health bars, model preview, radio panel, page shell and `VoiceSystem` redraw or react on `onLocaleChange`; story cards and runtime toasts take the new language from the next one they produce.
- Voice ids are independent of any i18n mechanism, so the subtitle and the recording of a line share one id. Changing a line's words therefore means re-recording it in both languages (or giving it a new id): `VoicePack.test.ts` checks that the script and both manifests list the same ids and that every listed file exists at its recorded size, but it cannot tell when the words under an unchanged id have changed.
- Radio colouring, loudness and ducking can be tuned without regenerating audio, and the recorded files stay byte-identical to the generator's output, so their `sha256` and embedded C2PA data remain valid.
- The packs add about 38 MB to the repository and the deployed site (200 lines per language at the time of writing). They are fetched on demand — the current chapter's lines are prefetched when it starts — and decoded audio is held in a small LRU.
- There is no generation tooling in the repository; regenerating lines is a documented manual process ([`docs/voice-lines.md`](../voice-lines.md)).
- With voiced defeat lines, the wait between a boss kill and the debrief had to grow: `BOSS_OUTRO_MAX_MS` in `CampaignFlowController` went from 6.5 s to 16 s. *Update (`3b3e0e1`):* 16 s still cut the longer defeat sequences short, so the outro now runs on game time and waits until the radio is idle, with a ceiling of the radio backlog (voiced lines at their manifest duration in the current language) plus 6 s, at most 75 s (`BOSS_OUTRO_MAX_SECONDS`); see [api.md → Campaign flow](../api.md#campaign-flow).

## References

- [`docs/api.md`](../api.md) — Localisation (i18n), Campaign data, Campaign presentation, Wingmen, Session settings, Voice
- [`docs/architecture.md`](../architecture.md) — data flow (text) and Audio (voice)
- [`docs/voice-lines.md`](../voice-lines.md) — manifest and provenance fields, id patterns, regeneration steps
- [ADR 0001](0001-campaign-presentation-adapter.md) — the presentation seam the voice is wired through
