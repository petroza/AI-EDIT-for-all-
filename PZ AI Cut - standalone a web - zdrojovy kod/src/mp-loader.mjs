// Načtení MediaPipe (výřez podle obličeje) jako modul s pevnou adresou – CSP okna nedovolí vložené skripty
// (bezpečnost S12), dřív se modul stavěl z textu. Verze musí sedět s web/ai/reframe.js (MP).
import * as M from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

window.__pzMediaPipe = M;
window.dispatchEvent(new Event('pz-mediapipe'));
