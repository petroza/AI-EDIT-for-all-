---
name: pz-ai-cut
description: Edit video in the PZ AI Cut web editor open in the user's Chrome (https://pz-ai-cut.pages.dev) – content-based edits from the transcript, teasers, short versions, social formats 9:16 / 4:5 / 1:1, captions. Use whenever the user wants to cut, transcribe or caption video in PZ AI Cut, or says "Pracuj z panelu PZ AI Cut" / "Work from the PZ AI Cut panel".
---

# PZ AI Cut

The pz-ai-cut tools (MCP server from this plugin) control the editor open in Chrome on this computer. If a tool says the page is not open, ask the user to open https://pz-ai-cut.pages.dev in Chrome and click Allow when Chrome asks about devices on the local network.

PZ AI Cut is a web video editor (Premiere-like) open in the user's Chrome; these tools edit inside it. Media never leaves the user's computer – you only see text.
Workflow: editor_status → transcribe_media (local, cached) → read the transcript (get_transcript / search_transcript; for long ones read selectively) → choose sentences → build_sequence_from_transcript (always a NEW sequence) → sequence_text to check → summarise for the user (sentence ids, duration). To get the same edit in other social formats use reframe_sequence (it follows the speaker's face). For social formats (9:16, 4:5, 1:1) you can add a short headline at the top with set_title (suggest one when the user asks for a social video; it must stay faithful to what is said). Captions only when the edit is final (add_captions); then read them (get_captions) and fix obvious speech-recognition errors (set_captions) – the transcript is automatic and makes mistakes in names and short words. Export is done by the user (File → Export Media) – tell them.
Editing rules: keep whole thoughts, never cut a sentence in the middle unless it makes sense (use fromWord/toWord); remove slips, false starts (keep the last good take), filler and long pauses, but do not remove every pause – leave room to breathe before an important thought and after a punchline. In interviews keep the question with its answer. Keep sentences in a logical, non-misleading order. For short social videos: a strong hook in the first 3 s. A task may end with "Target length: about N s" and "Format: 9:16 …" (presets from the panel; Czech: "Cílová délka", "Formát") – aim for that length (±15 %) and pass the format to build_sequence_from_transcript. Quote numbers and claims exactly as transcribed; if the transcript looks like a recognition error, say so.
With sensitive topics (death, illness, family tragedy, minors) say so to the user and offer a lighter alternative from the same material – the newsroom decides. While a long recording is still being transcribed you can already read the finished part (transcribe_media tells you how far it is). Give every new sequence a short descriptive name. Each rebuild creates another sequence (earlier versions stay) – tell the user which one is final.
Reply in the user's language (Czech users write in Czech).

## Working from the panel
When the user asks you to work from the PZ AI Cut panel: call wait_task repeatedly; for each task do the work, report progress with report_task (id from wait_task) and finish with report_task done: true and a one-sentence summary (sequence name, length). Then call wait_task again. Tasks can end with "Target length" and "Format" – respect them (format → build_sequence_from_transcript format).
