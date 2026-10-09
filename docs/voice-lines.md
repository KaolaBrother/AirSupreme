# Voice lines

The radio lines and the story narration ship as two pre-recorded voice packs, English and Mandarin, in `public/voice/`. The game plays them through `VoiceSystem` ([api.md → Voice](api.md#voice)). There is no generation script in this repository: the packs were produced outside it. This page records what the runtime and the tests expect, so a line can be changed or re-recorded without breaking either.

## Regenerating voice lines

### Where the script comes from

`getVoiceScript()` (`src/features/campaign/CampaignData.ts`) is the single source of the voiced script. It returns a fresh `VoiceScriptLine[]` in playback order — prologue, then each chapter's briefing paragraphs and radio lines, then the first-contact lines, the generic lines and the epilogue:

```typescript
export interface VoiceScriptLine {
  id: string; // stable, unique, also the file name
  speaker: CampaignSpeakerId;
  text: LocalizedText; // en → English pack, zh → Mandarin pack
  kind: 'narration' | 'radio';
}
```

- The text itself lives in `CampaignChapters.ts` (chapter `intro` paragraphs and `radio` lines), `CampaignRadio.ts` (`UNIT_FIRST_CONTACT_RADIO`, `GENERIC_RADIO`) and `CampaignStory.ts` (`CAMPAIGN_PROLOGUE`, `CAMPAIGN_EPILOGUE`), all under `src/features/campaign/`.
- Narration is spoken by `NARRATION_SPEAKER` (`'hq'`, Skydome). The player (`'player'`, Falcon) never speaks.
- Casting notes per speaker: `CAMPAIGN_SPEAKERS[speaker].gender` and `.voiceDirection` (`en` for the English cast, `zh` for the Mandarin cast), in `CampaignCast.ts`.
- Titles, objectives, briefing one-liners, boss briefs, weapon-unlock lines, debrief summaries and credits are shown but not voiced.

### Ids and file names

Each line's `id` is its file name: `public/voice/en/<id>.mp3` and `public/voice/zh/<id>.mp3`, served at `/voice/<en|zh>/<id>.mp3`. Ids are lowercase letters, digits and single hyphens, and follow these patterns (pinned by `src/__tests__/VoiceScript.test.ts`):

| Lines | Id pattern | Example |
| ----- | ---------- | ------- |
| Chapter radio | `c{NN}-{trigger}[-{index}]-{speaker}[-{n}]` | `c03-wave-start-2-wingman2` |
| Chapter briefing | `c{NN}-briefing-{n}` (the test pins the `c{NN}-` prefix) | `c01-briefing-1` |
| Prologue / epilogue | `prologue-{n}` / `epilogue-{n}` (the test pins the prefix) | `prologue-1` |
| First contact | `contact-{unit type}` (lowercase, `_` → `-`) | `contact-ally-awacs` |
| Generic | `generic-{GenericRadioKey}` | `generic-awacs-lost` |

The runtime knows only ids. If the words of a line change, its recordings must be replaced in both packs (or the line given a new id); otherwise the old recording keeps playing under the new subtitle.

### Manifest: `public/voice/manifest.json`

```json
{
  "version": 1,
  "format": "mp3",
  "languages": {
    "en": { "prologue-1": { "duration": 8.32, "bytes": 151334 } },
    "zh": { "prologue-1": { "duration": 8.0, "bytes": 146319 } }
  }
}
```

- `format` is the file extension for every line.
- `languages.en` / `languages.zh` hold one entry per line id: `duration` in seconds and `bytes`, the file size.
- `VoiceSystem` loads the manifest once, on demand, and fetches only ids listed for the current language (`en` → `en/`, `zh-CN` → `zh/`). An id that is not listed plays as text only, without a request. An entry needs a positive `duration` to count; playback timing comes from the decoded audio.
- `src/__tests__/VoicePack.test.ts` reads the manifest from disk and checks it against `getVoiceScript()`: the same ids in both languages, no ids the script no longer has, a positive `duration` and an `.mp3` of exactly `bytes` for every entry, and no unlisted audio in either folder. A new script line without recordings fails it.

### Provenance: `public/voice/provenance.json`

A record of how each file was made; nothing in the game or the tests reads it.

- Top level: `version`, `generator` (free text naming the generator and model), `languages`.
- Per language: `model`, `flowId`, `flowName`, `createdAt`, `outputFormat`, `generationsPerLine`, `cast` (speaker id → `{ voiceId, name }`), `totalDurationSeconds` and `fileCount` for the main run, `files`, `failures`, and `topups` (later runs, each with `flowId`, `flowName`, `createdAt`, `fileCount`).
- Per file: `id`, `speaker`, `kind`, `path` (relative to `public/voice/`), `sha256` of the file as shipped, `voiceId`, `generationId`, `chars`, an optional delivery `tag`, and `batch` / `flowId` on files that came from a top-up run.
- The Mandarin entry records `cast` and `outputFormat` as `null`; its files still carry their `voiceId`.

The current packs were generated with ElevenLabs `eleven_v4`, one take per line, and both packs list the same lines.

### C2PA provenance

Every MP3 in both packs carries the C2PA provenance data (Content Credentials) that the generator embedded in the file. Keep it: copy generated files into the pack byte for byte rather than re-encoding or stripping metadata, so the embedded credentials and the recorded `sha256` stay valid.

### Steps

1. Edit the line in the campaign data, both `en` and `zh`. Keep existing ids; give a new line a new id that follows the patterns above.
2. Take the changed lines from `getVoiceScript()`: id, speaker, kind and the text for the language being recorded.
3. Generate one take per line and language, using the same voice as the speaker's other lines (see the `voiceId` of that speaker's files in `provenance.json`). The packs need no post-processing: radio filtering, loudness normalisation and music ducking happen at playback.
4. Save each take as `public/voice/<en|zh>/<id>.mp3`.
5. Update `manifest.json` (`duration`, `bytes`) for every changed id, in both languages.
6. Update `provenance.json`: replace or add the file entries (`sha256`, `voiceId`, `generationId`, `chars`, …) and record the run under `topups`.
7. Run `npx vitest run src/__tests__/VoicePack.test.ts src/__tests__/VoiceScript.test.ts`, then the full checks (`npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build`).
8. Listen in a dev build: `npm run dev`, start a mission, then in the browser console `window.__AIR_SUPREME_DEV__.voice.say('<id>')` plays a line through the radio chain (`say('<id>', 'narration')` for the narration chain); `.state()` shows the manifest, the current line and the caches, and `.sample()` reads the voice and music levels and the duck.
