"""Homelab practice tools for 0xDay: hardening checklist with before/after score, incident report
generator and weekly homelab routine. Called from build.py as build_hlops.build(page, esc).

All browser-only: state lives in localStorage on the visitor's own browser, nothing is sent anywhere.
The data is public and fictional-safe (no real addresses or credentials).

Data:
  content/harden.json  systems -> checks {t, why, how, w}
  content/weekly.json  weekly routine tasks and a rotating focus list
"""
import json, hashlib


def _ver():
    return hashlib.sha1((open("hlops.css").read() + open("hlops.js").read()).encode()).hexdigest()[:8]


def _head(v, kind, data=None):
    h = f'\n<link rel="stylesheet" href="hlops.css?v={v}">\n<script src="hlops.js?v={v}" defer></script>'
    h += f'\n<script id="ho-data" type="application/json">{json.dumps({"kind": kind, "data": data})}</script>'
    return h


def build(page, esc):
    v = _ver()
    H = json.load(open("content/harden.json"))
    n = sum(len(s["checks"]) for s in H["systems"])
    body = '''<p class="cmd">./harden --score</p>
<h1>~/harden</h1>
<p>A hardening checklist for each system in the lab, with a score. Tick what is actually done on the real machine, press <b>save baseline</b> once, then come back after a work session and watch the number move. Everything is stored in this browser only, and you update it by hand, so the score is only as honest as you are.</p>
<div id="ho-harden" class="ho-app" aria-live="polite"></div>
<noscript><p>The checklist needs JavaScript.</p></noscript>
<p><a href="weekly.html">./weekly</a> <span class="muted">// what to do in the lab this week</span> · <a href="homelab.html">cd ../homelab</a></p>'''
    page("harden.html", "hardening checklist :: 0xDay", body, cur="lab", head=_head(v, "harden", H),
         desc=f"Per-system hardening checklist ({n} checks) with a before and after score for a Proxmox homelab.")

    body = '''<p class="cmd">./report --from-notes</p>
<h1>~/report</h1>
<p>Paste rough lab notes, get an incident report you can edit. Lines that start with a time (<code>02:14 ...</code>) become the timeline, lines that start with <code>host:</code>, <code>ioc:</code>, <code>attack:</code> fill those sections, and everything else becomes the summary. Nothing leaves your browser. Do not paste real credentials or private addresses.</p>
<div id="ho-report" class="ho-app"></div>
<noscript><p>The generator needs JavaScript.</p></noscript>
<p><a href="drills/security-onion-intrusion-hunt.html">./hunt</a> <span class="muted">// a log-hunt lab to write up</span> · <a href="weekly.html">./weekly</a></p>'''
    page("report.html", "incident report generator :: 0xDay", body, cur="lab", head=_head(v, "report"),
         desc="Turn rough lab notes into a structured incident report: summary, timeline, indicators, root cause and actions.")

    W = json.load(open("content/weekly.json"))
    body = '''<p class="cmd">crontab -l  # weekly</p>
<h1>~/weekly</h1>
<p>A short routine for using the homelab every week, so it stops being something I built once. Pick what fits the time you have. Ticks reset each week and live in this browser only.</p>
<div id="ho-weekly" class="ho-app" aria-live="polite"></div>
<noscript><p>The routine needs JavaScript.</p></noscript>
<p><a href="harden.html">./harden</a> · <a href="report.html">./report</a> · <a href="drills.html">./drills</a></p>'''
    page("weekly.html", "weekly homelab routine :: 0xDay", body, cur="lab", head=_head(v, "weekly", W),
         desc="A weekly checklist for actually using a homelab: patching, alert triage, one attack and one detection, a write-up.")
    return [("harden", "harden.html", "per-system checklist with a score", f"{n} checks"),
            ("report", "report.html", "notes into an incident report", "generator"),
            ("weekly", "weekly.html", "what to do in the lab each week", f'{len(W["tasks"])} tasks')]
