#!/usr/bin/env python3
"""Assemble a single self-contained standalone.html.

Inlines CSS, JS, and the camera dataset so the page works by simply
double-clicking it (file://) with no local web server. External CDN
assets (Leaflet, CARTO tiles) still load over the network."""
import json
import re
import pathlib

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text()
css = (root / "css" / "styles.css").read_text()
js = (root / "js" / "app.js").read_text()
data = json.loads((root / "data" / "cameras.json").read_text())

# Inline stylesheet (replace the local <link>) -> <style>
html = html.replace(
    '  <link rel="stylesheet" href="css/styles.css" />',
    "  <style>\n" + css + "\n  </style>",
)

# Inline data + app script (replace the local <script src="js/app.js">)
data_script = (
    "  <script>window.__CAMERA_DATA__ = "
    + json.dumps(data, ensure_ascii=False)
    + ";</script>\n"
)
html = html.replace(
    '  <script src="js/app.js"></script>',
    data_script + "  <script>\n" + js + "\n  </script>",
)

# Tidy the title to make clear it is the portable build
html = html.replace(
    "<title>NYC Exhaust / Noise Camera Map</title>",
    "<title>NYC Exhaust / Noise Camera Map (standalone)</title>",
)

out = root / "standalone.html"
out.write_text(html)
print("wrote", out, f"({out.stat().st_size} bytes)")
