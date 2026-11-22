"""Schémata zapojení pro README (SVG, česky i anglicky): python docs/make_diagrams.py
Výstup: docs/img/schema-<název>-<cs|en>.svg + vlajky flag-cz.svg, flag-gb.svg."""
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).parent / "img"
OUT.mkdir(parents=True, exist_ok=True)

FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif"
C = {  # výplň, okraj, text
    "agent": ("#F1ECFE", "#7C5CE0", "#3B2A8C"),
    "app": ("#E8F1FD", "#2F74D0", "#123F78"),
    "ai": ("#E6F6EC", "#2E9E5B", "#145A31"),
    "cloud": ("#F2F3F5", "#8A929C", "#3D434A"),
    "media": ("#FFF4E0", "#D9902B", "#6E4410"),
}


class Svg:
    def __init__(self, w, h, title):
        self.w, self.h, self.parts = w, h, []
        self.title = title

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, size=14, weight=400, color="#24292F", anchor="start", italic=False):
        st = ' font-style="italic"' if italic else ""
        self.add(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color}" '
                 f'text-anchor="{anchor}"{st}>{escape(s)}</text>')

    def box(self, x, y, w, h, kind, title, lines=(), size=15, center=False):
        fill, stroke, ink = C[kind]
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="1.6"/>')
        tx, anc = (x + w / 2, "middle") if center else (x + 14, "start")
        self.text(tx, y + 26, title, size, 650, ink, anc)
        for i, ln in enumerate(lines):
            self.text(tx, y + 48 + i * 19, ln, 13, 400, "#3D434A", anc)

    def frame(self, x, y, w, h, label, color="#8A929C"):
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="none" stroke="{color}" '
                 f'stroke-width="1.4" stroke-dasharray="6 5"/>')
        self.add(f'<rect x="{x + 14}" y="{y - 11}" width="{len(label) * 7.4 + 16}" height="22" rx="4" fill="#FFFFFF"/>')
        self.text(x + 22, y + 5, label, 13, 600, color)

    def arrow(self, pts, label=None, both=False, dashed=False, color="#57606A", lx=None, ly=None):
        d = "M" + " L".join(f"{x},{y}" for x, y in pts)
        da = ' stroke-dasharray="5 4"' if dashed else ""
        ms = ' marker-start="url(#ah0)"' if both else ""
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="1.8"{da}{ms} marker-end="url(#ah1)"/>')
        if label:
            if lx is None:
                (x1, y1), (x2, y2) = pts[len(pts) // 2 - 1], pts[len(pts) // 2]
                lx, ly = (x1 + x2) / 2, (y1 + y2) / 2
            wbox = len(label) * 6.9 + 14
            self.add(f'<rect x="{lx - wbox / 2}" y="{ly - 11}" width="{wbox}" height="21" rx="4" fill="#FFFFFF" '
                     f'stroke="#D0D7DE" stroke-width="1"/>')
            self.text(lx, ly + 4, label, 12, 500, "#24292F", "middle")

    def save(self, path):
        defs = ('<defs>'
                '<marker id="ah1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
                '<path d="M0,0 L10,5 L0,10 z" fill="#57606A"/></marker>'
                '<marker id="ah0" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
                '<path d="M10,0 L0,5 L10,10 z" fill="#57606A"/></marker></defs>')
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}" font-family="{FONT}" role="img">'
                f'<title>{escape(self.title)}</title>{defs}'
                f'<rect width="{self.w}" height="{self.h}" rx="16" fill="#FFFFFF" stroke="#D0D7DE"/>')
        path.write_text(head + "".join(self.parts) + "</svg>\n", encoding="utf-8")


T = {
    "cs": dict(
        pc="Tvůj počítač – videa ho nikdy neopustí",
        cloud="Cloud (jen text přepisu)",
        cloud_l=["Claude (Anthropic) / GPT (OpenAI)", "nebo vše lokálně přes Hermes"],
        agent="AI agent",
        agent_l=["Claude Code · Claude Desktop", "Codex (ChatGPT)"],
        mcp="MCP server", mcp_l=["my-premiere-mcp/server", "Node.js · nástroje střihu"],
        pr="Adobe Premiere Pro", panel="Panel MY Premiere MCP", panel_l=["CEP · zadání, agenti, stav"],
        host="host.jsx · ExtendScript", host_l=["sekvence, klipy, titulky"],
        worker="Lokální Worker · Python · :7881",
        w1="faster-whisper large-v3", w1b="přepis + časy slov (CUDA)",
        w2="sherpa-onnx", w2b="kdo kdy mluví",
        w3="llama.cpp · gemma3 12B", w3b="osnova, slabá místa :7882",
        w4="Hermes · Qwen3.6-35B", w4b="plán střihu zdarma :8000",
        stdio="stdio (MCP)", bridge="HTTP :7880", wk="HTTP :7881", task="zadání z panelu",
        text="text přepisu",
        t_pr="1 · Premiere plugin – jak je to zapojené",
        t_sa="2 · Standalone PZ AI Cut – jak je to zapojené",
        t_web="3 · Web PZ AI Cut – jak je to zapojené",
        t_all="Tři programy, jedno AI jádro",
        el="PZ AI Cut (Electron)", ed="Střižna", ed_l=["src/ · timeline, monitory,", "zkratky jako Premiere"],
        aip="AI panel", aip_l=["kopie panelu", "z my-premiere-mcp"],
        api="Most místo Premiere", api_l=["pmcp-api.js · :7880 / :7890"],
        ff="ffmpeg", ff_l=["náhledy, proxy, export", "MP4 · MOV · MXF"],
        same="stejný MCP server + Worker jako u Premiere",
        chrome="Chrome / Edge – stránka PZ AI Cut", wed="Střižna", wed_l=["stejný kód src/", "export WebCodecs"],
        wasr="Přepis v prohlížeči", wasr_l=["Whisper · transformers.js"],
        wface="Výřez 9:16", wface_l=["MediaPipe · obličej mluvčího"],
        disk="Videa na disku", disk_l=["File System Access", "nic se nenahrává"],
        conn="Konektor pz-ai-cut", conn_l=["pz-ai-cut.mcpb · Node.js", "127.0.0.1:7895–7897"],
        cf="Cloudflare Pages", cf_l=["pz-ai-cut.pages.dev", "jen statické soubory"],
        agent_web=["Claude Desktop (plugin)", "Codex (ChatGPT)"],
        load="načtení stránky", local="úkoly · 127.0.0.1",
        o1="1 · Premiere plugin", o1_l=["panel v Adobe Premiere Pro", "1 Premiere plugin - instalace.bat"],
        o2="2 · Standalone", o2_l=["PZ AI Cut.exe, bez Adobe", "2 Standalone - postavit.bat"],
        o3="3 · Web", o3_l=["Chrome, nic se neinstaluje", "3 Web - postavit a spustit.bat"],
        core="my-premiere-mcp · AI jádro", core_l=["MCP server + Worker: přepis, mluvčí, multicam, titulky,",
                                                "plán střihu (Hermes / gemma3), 9:16 – modely lokálně na GPU"],
        wcore="AI v prohlížeči", wcore_l=["Whisper + MediaPipe v Chrome", "+ konektor pro Claude / Codex"],
        agents="Claude · Codex · lokální Hermes", agents_l=["stříhají podle obsahu – vždy do NOVÉ sekvence"],
    ),
    "en": dict(
        pc="Your computer – videos never leave it",
        cloud="Cloud (transcript text only)",
        cloud_l=["Claude (Anthropic) / GPT (OpenAI)", "or fully local with Hermes"],
        agent="AI agent",
        agent_l=["Claude Code · Claude Desktop", "Codex (ChatGPT)"],
        mcp="MCP server", mcp_l=["my-premiere-mcp/server", "Node.js · editing tools"],
        pr="Adobe Premiere Pro", panel="MY Premiere MCP panel", panel_l=["CEP · tasks, agents, status"],
        host="host.jsx · ExtendScript", host_l=["sequences, clips, captions"],
        worker="Local Worker · Python · :7881",
        w1="faster-whisper large-v3", w1b="transcript + word timing (CUDA)",
        w2="sherpa-onnx", w2b="who speaks when",
        w3="llama.cpp · gemma3 12B", w3b="outline, weak spots :7882",
        w4="Hermes · Qwen3.6-35B", w4b="free edit planning :8000",
        stdio="stdio (MCP)", bridge="HTTP :7880", wk="HTTP :7881", task="task from panel",
        text="transcript text",
        t_pr="1 · Premiere plugin – how it is wired",
        t_sa="2 · Standalone PZ AI Cut – how it is wired",
        t_web="3 · PZ AI Cut Web – how it is wired",
        t_all="Three apps, one AI core",
        el="PZ AI Cut (Electron)", ed="Editor", ed_l=["src/ · timeline, monitors,", "Premiere shortcuts"],
        aip="AI panel", aip_l=["copy of the panel", "from my-premiere-mcp"],
        api="Bridge (no Premiere)", api_l=["pmcp-api.js · :7880 / :7890"],
        ff="ffmpeg", ff_l=["thumbnails, proxies, export", "MP4 · MOV · MXF"],
        same="same MCP server + Worker as the Premiere plugin",
        chrome="Chrome / Edge – PZ AI Cut page", wed="Editor", wed_l=["same src/ code", "WebCodecs export"],
        wasr="In-browser transcription", wasr_l=["Whisper · transformers.js"],
        wface="9:16 reframe", wface_l=["MediaPipe · speaker's face"],
        disk="Videos on disk", disk_l=["File System Access", "nothing is uploaded"],
        conn="pz-ai-cut connector", conn_l=["pz-ai-cut.mcpb · Node.js", "127.0.0.1:7895–7897"],
        cf="Cloudflare Pages", cf_l=["pz-ai-cut.pages.dev", "static files only"],
        agent_web=["Claude Desktop (plugin)", "Codex (ChatGPT)"],
        load="page load", local="tasks · 127.0.0.1",
        o1="1 · Premiere plugin", o1_l=["panel inside Adobe Premiere Pro", "1 Premiere plugin - instalace.bat"],
        o2="2 · Standalone", o2_l=["PZ AI Cut.exe, no Adobe needed", "2 Standalone - postavit.bat"],
        o3="3 · Web", o3_l=["Chrome, nothing to install", "3 Web - postavit a spustit.bat"],
        core="my-premiere-mcp · AI core", core_l=["MCP server + Worker: transcription, speakers, multicam, captions,",
                                               "edit planning (Hermes / gemma3), 9:16 – models run locally on GPU"],
        wcore="AI in the browser", wcore_l=["Whisper + MediaPipe in Chrome", "+ connector for Claude / Codex"],
        agents="Claude · Codex · local Hermes", agents_l=["edit by content – always into a NEW sequence"],
    ),
}


def premiere(t):
    s = Svg(1000, 600, t["t_pr"])
    s.text(30, 40, t["t_pr"], 20, 700)
    s.box(40, 470, 230, 96, "cloud", t["cloud"], t["cloud_l"])
    s.frame(20, 70, 960, 370, t["pc"])
    s.box(40, 100, 230, 96, "agent", t["agent"], t["agent_l"])
    s.box(370, 100, 230, 96, "app", t["mcp"], t["mcp_l"])
    s.add('<rect x="690" y="92" width="270" height="200" rx="12" fill="#F6F8FB" stroke="#2F74D0" stroke-width="1.2"/>')
    s.text(705, 116, t["pr"], 15, 700, "#123F78")
    s.box(705, 128, 240, 70, "app", t["panel"], t["panel_l"], size=14)
    s.box(705, 210, 240, 70, "media", t["host"], t["host_l"], size=14)
    s.arrow([(825, 198), (825, 210)])
    s.box(40, 250, 620, 170, "ai", t["worker"])
    items = [(t["w1"], t["w1b"]), (t["w2"], t["w2b"]), (t["w3"], t["w3b"]), (t["w4"], t["w4b"])]
    for i, (a, b) in enumerate(items):
        x, y = 56 + (i % 2) * 300, 292 + (i // 2) * 62
        s.add(f'<rect x="{x}" y="{y}" width="285" height="52" rx="8" fill="#FFFFFF" stroke="#9AD3AE"/>')
        s.text(x + 12, y + 22, a, 13.5, 650, "#145A31")
        s.text(x + 12, y + 41, b, 12.5, 400, "#3D434A")
    s.arrow([(270, 148), (370, 148)], t["stdio"], both=True)
    s.arrow([(600, 160), (705, 160)], t["bridge"], both=True, lx=652, ly=140)
    s.arrow([(485, 196), (485, 250)], t["wk"], both=True)
    s.arrow([(935, 128), (935, 82), (155, 82), (155, 100)], t["task"], dashed=True, lx=490, ly=82)
    s.arrow([(70, 196), (70, 232), (30, 232), (30, 518), (40, 518)], None, both=True, dashed=True)
    s.save(OUT / f"schema-premiere-{lang}.svg")


def standalone(t):
    s = Svg(1000, 560, t["t_sa"])
    s.text(30, 40, t["t_sa"], 20, 700)
    s.box(40, 440, 230, 96, "cloud", t["cloud"], t["cloud_l"])
    s.frame(20, 70, 960, 340, t["pc"])
    s.add('<rect x="330" y="92" width="630" height="182" rx="12" fill="#F6F8FB" stroke="#2F74D0" stroke-width="1.2"/>')
    s.text(345, 116, t["el"], 15, 700, "#123F78")
    s.box(345, 128, 190, 84, "app", t["ed"], t["ed_l"], size=14)
    s.box(550, 128, 190, 84, "app", t["aip"], t["aip_l"], size=14)
    s.box(755, 128, 190, 84, "media", t["api"], t["api_l"], size=14)
    s.box(345, 220, 600, 44, "media", t["ff"] + "  ·  " + t["ff_l"][0] + "  ·  " + t["ff_l"][1], size=14)
    s.box(40, 128, 230, 96, "agent", t["agent"], t["agent_l"])
    s.box(40, 310, 920, 82, "ai", t["mcp"] + " + " + t["worker"].split(" · ")[0],
          [t["same"], "faster-whisper · sherpa-onnx · gemma3 · Hermes  (my-premiere-mcp/)"])
    s.arrow([(645, 128), (645, 84), (155, 84), (155, 128)], t["task"], dashed=True, lx=420, ly=84)
    s.arrow([(850, 274), (850, 310)], t["bridge"], both=True, lx=850, ly=292)
    s.arrow([(155, 224), (155, 310)], t["stdio"], both=True)
    s.arrow([(155, 392), (155, 440)], t["text"], both=True, dashed=True)
    s.save(OUT / f"schema-standalone-{lang}.svg")


def web(t):
    s = Svg(1000, 560, t["t_web"])
    s.text(30, 40, t["t_web"], 20, 700)
    s.box(720, 440, 240, 96, "cloud", t["cf"], t["cf_l"])
    s.box(40, 440, 230, 96, "cloud", t["cloud"], t["cloud_l"])
    s.frame(20, 70, 960, 340, t["pc"])
    s.add('<rect x="330" y="92" width="630" height="190" rx="12" fill="#F6F8FB" stroke="#2F74D0" stroke-width="1.2"/>')
    s.text(345, 116, t["chrome"], 15, 700, "#123F78")
    s.box(345, 128, 190, 84, "app", t["wed"], t["wed_l"], size=14)
    s.box(550, 128, 190, 84, "ai", t["wasr"], t["wasr_l"], size=14)
    s.box(755, 128, 190, 84, "ai", t["wface"], t["wface_l"], size=14)
    s.box(345, 222, 600, 50, "media", t["disk"] + "  ·  " + t["disk_l"][0] + "  ·  " + t["disk_l"][1], size=14)
    s.box(40, 128, 230, 96, "agent", t["agent"], t["agent_web"])
    s.box(40, 300, 280, 92, "app", t["conn"], t["conn_l"])
    s.arrow([(155, 224), (155, 300)], t["stdio"], both=True)
    s.arrow([(320, 346), (640, 346), (640, 282)], t["local"], both=True, lx=480, ly=346)
    s.arrow([(840, 440), (840, 282)], t["load"], lx=840, ly=426)
    s.arrow([(70, 224), (70, 262), (30, 262), (30, 488), (40, 488)], None, both=True, dashed=True)
    s.save(OUT / f"schema-web-{lang}.svg")


def overview(t):
    s = Svg(1000, 470, t["t_all"])
    s.text(30, 40, t["t_all"], 20, 700)
    s.box(40, 70, 920, 64, "agent", t["agents"], t["agents_l"], center=True)
    for i, (k, kl) in enumerate([("o1", "o1_l"), ("o2", "o2_l"), ("o3", "o3_l")]):
        s.box(40 + i * 315, 180, 290, 96, "app", t[k], t[kl], center=True)
        s.arrow([(185 + i * 315, 134), (185 + i * 315, 180)], None, both=True)
    s.box(40, 330, 605, 100, "ai", t["core"], t["core_l"], center=True)
    s.box(670, 330, 290, 100, "ai", t["wcore"], t["wcore_l"], center=True)
    s.arrow([(185, 276), (185, 330)], None)
    s.arrow([(500, 276), (500, 330)], None)
    s.arrow([(815, 276), (815, 330)], None)
    s.save(OUT / f"schema-overview-{lang}.svg")


def flags():
    (OUT / "flag-cz.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20" viewBox="0 0 30 20"><title>Čeština</title>'
        '<rect width="30" height="10" fill="#FFFFFF"/><rect y="10" width="30" height="10" fill="#D7141A"/>'
        '<path d="M0,0 L15,10 L0,20 z" fill="#11457E"/>'
        '<rect width="30" height="20" fill="none" stroke="#D0D7DE" stroke-width="0.6"/></svg>\n', encoding="utf-8")
    (OUT / "flag-gb.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20" viewBox="0 0 60 40"><title>English</title>'
        '<clipPath id="c"><rect width="60" height="40"/></clipPath><g clip-path="url(#c)">'
        '<rect width="60" height="40" fill="#012169"/>'
        '<path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" stroke-width="8"/>'
        '<path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" stroke-width="3"/>'
        '<path d="M30,0 V40 M0,20 H60" stroke="#FFFFFF" stroke-width="12"/>'
        '<path d="M30,0 V40 M0,20 H60" stroke="#C8102E" stroke-width="7"/></g>'
        '<rect width="60" height="40" fill="none" stroke="#D0D7DE" stroke-width="1"/></svg>\n', encoding="utf-8")


for lang, t in T.items():
    overview(t), premiere(t), standalone(t), web(t)
flags()
print("ok:", sorted(p.name for p in OUT.glob("*.svg")))
