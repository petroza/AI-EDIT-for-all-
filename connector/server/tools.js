'use strict';
/* Nástroje konektoru PZ AI Cut. Provádí je stránka v Chrome (web/ai/tools.js) – tady je jen jejich popis pro Clauda.
 * Časy jsou v sekundách. Přepisy jsou ve zdrojovém čase souboru. */

const S = (props, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });
const str = (d) => ({ type: 'string', description: d });
const num = (d) => ({ type: 'number', description: d });
const pick = {
  oneOf: [
    { type: 'integer', description: 'Sentence id' },
    { type: 'object', properties: { id: { type: 'integer' }, fromWord: { type: 'integer', description: 'first word index (0-based) inside the sentence' }, toWord: { type: 'integer', description: 'last word index (inclusive)' } }, required: ['id'] },
  ],
};

const TOOLS = [
  {
    name: 'editor_status',
    description: 'State of the PZ AI Cut editor open in the user\'s Chrome: project name, media files (id, name, duration, whether a transcript exists), sequences and the active sequence. Call this first.',
    inputSchema: S({}),
  },
  {
    name: 'transcribe_media',
    description: 'Transcribe speech in a media file locally in the user\'s browser (Whisper, nothing is uploaded). New imports are transcribed automatically in the background. Cached – when done, a call is instant. If it is still running, the tool returns after ~50 s with the progress and a time estimate – tell the user and call it again later (nothing is lost). Returns sentence count and the first sentences; read the rest with get_transcript / search_transcript.',
    inputSchema: S({ source: str('Media id or file name (from editor_status). Default: the main media of the active sequence.'), language: str('Language code, e.g. "cs", "en", "sk", "uk". Default "cs".'), prompt: str('Names and terms that appear in the recording (improves accuracy).') }),
    timeoutMs: 90000,
  },
  {
    name: 'get_transcript',
    description: 'Sentences of a transcript with ids and source times: "#12 [63.20–68.90] text". A line starting with ↳ continues the previous sentence (do not cut between them). Use fromId/toId to read a part of a long transcript.',
    inputSchema: S({ source: str('Media id or file name'), fromId: { type: 'integer' }, toId: { type: 'integer' }, words: { type: 'boolean', description: 'Include numbered words for each sentence (for fromWord/toWord picks).' } }),
  },
  {
    name: 'search_transcript',
    description: 'Find sentences containing words or phrases (case and diacritics insensitive). Returns matching sentences with ids and times.',
    inputSchema: S({ source: str('Media id or file name'), query: str('Words to find; separate alternatives with |') }, ['query']),
  },
  {
    name: 'build_sequence_from_transcript',
    description: 'Create a NEW sequence from chosen transcript sentences, in the given order (the original stays untouched). Cuts are placed in the pauses between words automatically – never inside a word. A pick is a sentence id, or {id, fromWord, toWord} to use only part of a sentence. Returns the new sequence name, duration and warnings (e.g. a pick that cuts a sentence that continues).',
    inputSchema: S({ source: str('Media id or file name'), picks: { type: 'array', items: pick, description: 'Sentence ids in the order they should play' }, name: str('Short descriptive name of the new sequence, e.g. "Teaser Reels 20s" (the user sees it in the editor)'), format: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'], description: 'Frame format. 9:16 / 1:1 / 4:5 are reframed to the face of the person on screen (the speaker in a wide shot; camera cuts inside a clip are split).' }, captions: { type: 'boolean', description: 'Also add captions from the transcript' } }, ['picks']),
  },
  {
    name: 'build_sequence',
    description: 'Create a NEW sequence from explicit source ranges [{source, in, out}] in order. Prefer build_sequence_from_transcript for speech – it protects words.',
    inputSchema: S({ segments: { type: 'array', items: S({ source: str('Media id or file name'), in: num('source in (s)'), out: num('source out (s)') }, ['source', 'in', 'out']) }, name: str('Name of the new sequence'), format: { type: 'string', enum: ['16:9', '9:16', '1:1', '4:5'], description: 'Frame format; vertical/square formats are reframed to faces' } }, ['segments']),
  },
  {
    name: 'get_sequence',
    description: 'Clips of a sequence (track, timeline start/end, source file and source in/out), markers and captions count. Default: active sequence.',
    inputSchema: S({ name: str('Sequence name or id') }),
  },
  {
    name: 'sequence_text',
    description: 'What is said in a sequence, in timeline order with timeline times (from the transcripts of its sources). Use it to check an edit reads well.',
    inputSchema: S({ name: str('Sequence name or id') }),
  },
  {
    name: 'open_sequence',
    description: 'Show a sequence in the timeline (make it active).',
    inputSchema: S({ name: str('Sequence name or id') }, ['name']),
  },
  {
    name: 'add_captions',
    description: 'Add captions to a sequence from the transcripts of its clips (only after the edit is finished – later edits would shift them). Replaces existing captions of that sequence.',
    inputSchema: S({ name: str('Sequence name or id (default active)'), maxChars: { type: 'integer', description: 'Max characters per line (default: the caption style chosen in the panel; lines never exceed the frame width)' }, lines: { type: 'integer', description: 'Lines per caption, 1–3 (default: the style chosen in the panel, usually 2)' }, highlight: { type: 'boolean', description: 'Highlight the word being spoken (yellow, karaoke style – popular on Reels/TikTok)' } }),
  },
  {
    name: 'get_captions',
    description: 'Read the captions of a sequence with their index, times and text.',
    inputSchema: S({ name: str('Sequence name or id (default active)') }),
  },
  {
    name: 'set_captions',
    description: 'Correct caption texts (e.g. obvious speech-recognition errors: misheard words, names, split words). Times stay the same. Keep the meaning and wording of the speaker – fix only recognition errors.',
    inputSchema: S({ name: str('Sequence name or id (default active)'), fixes: { type: 'array', items: S({ index: { type: 'integer' }, text: str('Corrected text (line breaks are set automatically to fit the frame)') }, ['index', 'text']) } }, ['fixes']),
  },
  {
    name: 'reframe_sequence',
    description: 'Make NEW social-format versions of an existing (16:9) sequence: 9:16 (Reels, TikTok, Shorts), 4:5 (Instagram/Facebook post), 1:1 (square). The picture follows the face of the person on screen (the speaker in wide shots), captions are re-laid out and the headline is kept. Use it when the user wants the same edit in other formats.',
    inputSchema: S({ name: str('Sequence name or id (default active; must be 16:9)'), formats: { type: 'array', items: { type: 'string', enum: ['9:16', '4:5', '1:1'] }, description: 'Formats to create (default ["9:16"])' } }),
    timeoutMs: 180000,
  },
  {
    name: 'set_title',
    description: 'Set (or remove with empty text) the headline shown at the top of the picture for the whole video – for social formats (9:16, 4:5, 1:1). Burned into the export. Keep it short (about 30–45 characters), factual and in the language of the video; it must not claim more than what is said.',
    inputSchema: S({ name: str('Sequence name or id (default active)'), text: str('Headline text; empty = remove'), size: num('Relative size, default 1') }, ['text']),
  },
  {
    name: 'add_markers',
    description: 'Add markers to the active (or named) sequence at timeline times.',
    inputSchema: S({ name: str('Sequence name or id'), markers: { type: 'array', items: S({ time: num('timeline time (s)'), name: str('label') }, ['time']) } }, ['markers']),
  },
  {
    name: 'undo',
    description: 'Undo the last edit in the editor (like Ctrl+Z).',
    inputSchema: S({}),
  },
  {
    name: 'wait_task',
    description: 'Wait (up to ~50 s) for a task the user types into the AI panel of PZ AI Cut. Returns {id, text, seconds} or "no task". When the user asked you to work from the panel, call it repeatedly; after finishing a task call report_task.',
    inputSchema: S({}),
    timeoutMs: 60000,
  },
  {
    name: 'report_task',
    description: 'Show progress or the result of a panel task to the user in the AI panel.',
    inputSchema: S({ id: str('Task id from wait_task'), message: str('Short message for the user'), done: { type: 'boolean' }, error: { type: 'boolean' } }, ['message']),
  },
];

const INSTRUCTIONS = `PZ AI Cut is a web video editor (Premiere-like) open in the user's Chrome; these tools edit inside it. Media never leaves the user's computer – you only see text.
Workflow: editor_status → transcribe_media (local, cached) → read the transcript (get_transcript / search_transcript; for long ones read selectively) → choose sentences → build_sequence_from_transcript (always a NEW sequence) → sequence_text to check → summarise for the user (sentence ids, duration). To get the same edit in other social formats use reframe_sequence (it follows the speaker's face). For social formats (9:16, 4:5, 1:1) you can add a short headline at the top with set_title (suggest one when the user asks for a social video; it must stay faithful to what is said). Captions only when the edit is final (add_captions); then read them (get_captions) and fix obvious speech-recognition errors (set_captions) – the transcript is automatic and makes mistakes in names and short words. Export is done by the user (File → Export Media) – tell them.
Editing rules: keep whole thoughts, never cut a sentence in the middle unless it makes sense (use fromWord/toWord); remove slips, false starts (keep the last good take), filler and long pauses, but do not remove every pause – leave room to breathe before an important thought and after a punchline. In interviews keep the question with its answer. Keep sentences in a logical, non-misleading order. For short social videos: a strong hook in the first 3 s. A task may end with "Target length: about N s" and "Format: 9:16 …" (presets from the panel; Czech: "Cílová délka", "Formát") – aim for that length (±15 %) and pass the format to build_sequence_from_transcript. Quote numbers and claims exactly as transcribed; if the transcript looks like a recognition error, say so.
With sensitive topics (death, illness, family tragedy, minors) say so to the user and offer a lighter alternative from the same material – the newsroom decides. While a long recording is still being transcribed you can already read the finished part (transcribe_media tells you how far it is). Give every new sequence a short descriptive name. Each rebuild creates another sequence (earlier versions stay) – tell the user which one is final.
Reply in the user's language (Czech users write in Czech).`;

module.exports = { TOOLS, INSTRUCTIONS };
