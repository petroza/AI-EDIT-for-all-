const P = TN.app.project; const sleep = (ms) => new Promise(r => setTimeout(r, ms)); await sleep(1000);
// najet mysi pres klipy (onmouseover payload)
document.querySelectorAll('.clip').forEach(e => e.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
await sleep(300);
const s = P.sequences[0]; const c = s && s.tracks.audio[0].clips[0];
const unc = P.media.find(m => m.name === 'sitovy.mp4');
const modal = document.querySelector('.modal'); 
return { path: P.path, evil: window.__s14evil, polluted: ({}).s14polluted, seqName: s && s.name, gainType: c && typeof c.gainDb, gain: c && c.gainDb, vClipId: s && s.tracks.video[0].clips[0] && s.tracks.video[0].clips[0].id, tabHtml: (document.querySelector('.seqtab, .tab.seq, [class*="seq-tab"]') || {}).innerHTML, unc: unc && { missing: unc.missing, uncBlocked: unc.uncBlocked }, modal: modal && modal.innerText.slice(0, 400) };
