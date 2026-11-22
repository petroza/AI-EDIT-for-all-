'use strict';
/* Hlavní menu jako data – stejné pro desktop (Electron, main.js) i web (HTML lišta, web/menubar.js).
 * Položka: { label, cmd, arg, accel, local } | '-' | { label, submenu } | { label, role } (jen desktop)
 *   local = zkratku zpracuje okno (v Electronu registerAccelerator:false), na webu se zkratka jen zobrazí.
 *   desktop / web = položka jen pro danou verzi. */

function menuTemplate() {
  const m = (label, cmd, accel, local = true, extra = {}) => ({ label, cmd, accel, local, ...extra });
  return [
    { label: 'File', submenu: [
      m('New Project', 'newProject', 'CmdOrCtrl+Alt+N', false),
      m('Open Project…', 'openProject', 'CmdOrCtrl+O', false),
      m('Save', 'save', 'CmdOrCtrl+S', false),
      m('Save As…', 'saveAs', 'CmdOrCtrl+Shift+S', false),
      '-',
      m('Import…', 'import', 'CmdOrCtrl+I', false),
      m('New Sequence…', 'newSequence', 'CmdOrCtrl+N', false),
      '-',
      m('Export Media…', 'export', 'CmdOrCtrl+M', false),
      m('Export Social Versions…', 'exportSocial', undefined, false),
      { desktop: true, sep: true },
      { label: 'Exit', role: 'quit', desktop: true },
    ] },
    { label: 'Edit', submenu: [
      m('Undo', 'undo', 'CmdOrCtrl+Z'), m('Redo', 'redo', 'CmdOrCtrl+Shift+Z'), '-',
      m('Cut', 'cut', 'CmdOrCtrl+X'), m('Copy', 'copy', 'CmdOrCtrl+C'), m('Paste', 'paste', 'CmdOrCtrl+V'),
      m('Paste Insert', 'pasteInsert', 'CmdOrCtrl+Shift+V'), m('Select All', 'selectAll', 'CmdOrCtrl+A'),
      m('Deselect All', 'deselect', 'CmdOrCtrl+Shift+A'), '-',
      m('Clear', 'delete', 'Delete'), m('Ripple Delete', 'rippleDelete', 'Shift+Delete'), '-',
      m('Keyboard Shortcuts', 'help', 'F1', false),
    ] },
    { label: 'Clip', submenu: [
      m('Link / Unlink', 'toggleLink', 'CmdOrCtrl+L'), m('Enable', 'toggleEnable', 'Shift+E'), m('Audio Gain…', 'gain', 'G'),
      m('Set to Fill / Scale to Frame Size', 'toggleFit', undefined, false), m('Match Frame', 'matchFrame', 'F'),
    ] },
    { label: 'Sequence', submenu: [
      m('Add Edit', 'addEdit', 'CmdOrCtrl+K'), m('Add Edit to All Tracks', 'addEditAll', 'CmdOrCtrl+Shift+K'),
      m('Lift', 'lift', ';'), m('Extract', 'extract', '\''),
      m('Ripple Trim Previous Edit to Playhead', 'rippleTrimPrev', 'Q'), m('Ripple Trim Next Edit to Playhead', 'rippleTrimNext', 'W'),
      m('Apply Video Transition (Cross Dissolve)', 'applyCross', 'CmdOrCtrl+D'), m('Apply Audio Transition', 'audioFade', 'CmdOrCtrl+Shift+D'),
      m('Apply Default Transitions to Selection', 'applyBothTransitions', 'Shift+D'),
      m('Apply Dip to Black', 'applyDipBlack', undefined, false), m('Apply Dip to White', 'applyDipWhite', undefined, false),
      m('Clear Transitions', 'removeTransitions', undefined, false), m('Fade In / Fade Out Sequence', 'fadeInOut', undefined, false),
      m('Default Transition Duration…', 'transitionDuration', undefined, false), '-',
      m('Go to Next Gap', 'gotoGap', 'Shift+;'), m('Match Frame', 'matchFrame', 'F'), m('Reverse Match Frame', 'reverseMatchFrame', 'Shift+R'), '-',
      m('Snap in Timeline', 'snap', 'S'), m('Zoom to Sequence', 'zoomFit', '\\'), '-',
      m('Sequence Settings…', 'seqSettings', undefined, false),
      { label: 'Auto Reframe Sequence', submenu: [
        m('9:16 – Reels, TikTok, Shorts', 'reframe916', undefined, false),
        m('4:5 – Instagram / Facebook post', 'reframe45', undefined, false),
        m('1:1 – Square', 'reframe11', undefined, false),
        '-',
        m('All Social Formats (9:16, 4:5, 1:1)', 'reframeAll', undefined, false),
      ] },
      { label: 'Captions', submenu: [
        m('Create Captions from Transcript…', 'captionsFromTranscript', undefined, false),
        '-',
        m('Headline at the Top…', 'headline', undefined, false),
        m('Caption Style…', 'captionStyle', undefined, false),
        m('Edit Caption at Playhead', 'editCaptionHere', undefined, false),
        m('Delete Captions', 'clearCaptions', undefined, false),
      ] },
    ] },
    { label: 'Markers', submenu: [
      m('Mark In', 'markIn', 'I'), m('Mark Out', 'markOut', 'O'), m('Go to In', 'gotoIn', 'Shift+I'), m('Go to Out', 'gotoOut', 'Shift+O'),
      m('Clear In and Out', 'clearInOut', 'CmdOrCtrl+Shift+X'), '-',
      m('Mark Clip', 'markClip', 'X'), m('Mark Selection', 'markSelection', '/'), '-',
      m('Add Marker', 'marker', 'M'), m('Go to Next Marker', 'gotoMarker', 'Shift+M'),
      m('Clear Selected Marker', 'clearMarker', 'CmdOrCtrl+Alt+M'), m('Clear All Markers', 'clearAllMarkers', 'CmdOrCtrl+Alt+Shift+M'),
    ] },
    { label: 'Window', submenu: [
      m('AI Panel', 'toggleAi', 'F4', false), m('Maximize Frame', 'maximizeFrame', '`'),
      { role: 'togglefullscreen', label: 'Full Screen', cmd: 'fullScreen', accel: 'F11' },
      { desktop: true, sep: true },
      { role: 'reload', label: 'Reload', desktop: true }, { role: 'toggleDevTools', label: 'Developer Tools', desktop: true },
      '-',
      { label: 'Language', submenu: [
        { label: 'English', keepLabel: true, cmd: 'setLang', arg: 'en', radio: 'en' },
        { label: 'Čeština', keepLabel: true, cmd: 'setLang', arg: 'cs', radio: 'cs' },
      ] },
    ] },
    { label: 'Help', submenu: [
      m('How to Make a Social Video', 'socialGuide', undefined, false),
      m('Keyboard Shortcuts', 'help', undefined, false),
      { label: 'Open Application Folder', cmd: 'openAppFolder', desktop: true },
      { label: 'About', cmd: 'about', about: true },
    ] },
  ];
}

const ABOUT = {
  en: (v, web) => `Version ${v}\n${web ? 'Web video editor' : 'Standalone video editor'} with the PZ AI panel (transcription, Claude, captions, 9:16).`,
  cs: (v, web) => `Verze ${v}\n${web ? 'Webový střihový program' : 'Samostatný střihový program'} s AI panelem PZ (přepis, Claude, titulky, 9:16).`,
};

module.exports = { menuTemplate, ABOUT };
