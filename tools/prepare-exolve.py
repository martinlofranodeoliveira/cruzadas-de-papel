#!/usr/bin/env python3
"""Opt-in preparation of an unmodified, pinned third-party local QA player."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.request

COMMIT = "8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2"
REPOSITORY = "https://github.com/viresh-ratnakar/exolve"
BASE = f"https://raw.githubusercontent.com/viresh-ratnakar/exolve/{COMMIT}/"
ROOT = Path(__file__).resolve().parents[1]
PINS = {
    "exolve-player.html": "cb3f6b3b49d1f551055f8ecfa21b9fe4998cec314f9196135f008106cd79a168",
    "exolve-m.css": "46989172883a66954ddba497fd1ae525c5a0331826a2c8a71ef823c7234675d3",
    "exolve-m.js": "2f0cfcff2f66bb3115aa08756a68b2d0fc37cf8086365238a2f43645c7d1d6ce",
    "exolve-from-ipuz.js": "9313bef3f05bd492e79678ddcc1e53b30075c247f587fabf454dd5ed1a923fac",
    "exolve-from-puz.js": "1d5c35cd99c69f248963ae1dd54b7530ccbbe691905ad55e1cf6046f083def56",
    "exolve-from-text.js": "5d2d62a15071c9c5fbf939ff4be6e4bc309a5542fb0c27e7ef36609af3bb6238",
    "exolve-to-ipuz.js": "e7d90a6ac585999f17e7eafb83d7ed894d7d2a3182337de2db64249968945e15",
    "exolve-to-puz.js": "3f5ee8ac7854bd27e062b5b49216e50a2aed728d07950da7f9825d495464eff3",
    "exolve-exost.js": "434aad5400ad6f67fc68b1d5e3dab1aecfc48c47cfd7e52d550427605094d26c",
    "LICENSE": "b367add427f0d7fa9bef17bf0ab286e0803877b3ca6304c5fc34249aa0935b03",
}


class Dependencies(HTMLParser):
    def __init__(self):
        super().__init__()
        self.files = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        resource = attrs.get("src") if tag == "script" else (
            attrs.get("href") if tag == "link" and attrs.get("rel") == "stylesheet" else None)
        if resource:
            parsed = urllib.parse.urlsplit(resource)
            if parsed.scheme or parsed.netloc or "/" in parsed.path:
                raise ValueError("Unexpected nonlocal dependency in official player")
            self.files.add(parsed.path)


def verify_file(name, content):
    if hashlib.sha256(content).hexdigest() != PINS[name]:
        raise ValueError(f"SHA256 mismatch: {name}; no file accepted")


def verify_directory(destination):
    for name in PINS:
        verify_file(name, (destination / name).read_bytes())
    parser = Dependencies()
    parser.feed((destination / "exolve-player.html").read_text(encoding="utf-8"))
    if parser.files != set(PINS) - {"LICENSE", "exolve-player.html"}:
        raise ValueError("The official HTML's dependencies differ from the pinned allowlist")
    if json.loads((destination / "PROVENANCE.json").read_text(encoding="utf-8")) != provenance():
        raise ValueError("Provenance manifest differs from pinned sources")


def provenance():
    return {
        "repository": REPOSITORY, "commit": COMMIT, "license": "MIT",
        "licenseFile": "LICENSE", "unmodified": True,
        "files": {name: {"url": BASE + name, "sha256": digest} for name, digest in PINS.items()},
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--download", action="store_true", help="explicitly allow fetching official files")
    action.add_argument("--verify-local", action="store_true", help="offline verification only")
    parser.add_argument("--directory", type=Path, default=ROOT / "local/exolve")
    args = parser.parse_args(argv)
    destination = args.directory.resolve()
    if args.download:
        # Validate all payloads before writing any player files. No patch or rewrite.
        payloads = {}
        for name in PINS:
            with urllib.request.urlopen(BASE + name, timeout=45) as response:
                content = response.read(2 * 1024 * 1024 + 1)
            verify_file(name, content)
            payloads[name] = content
        destination.mkdir(parents=True, exist_ok=True)
        for name, content in payloads.items():
            (destination / name).write_bytes(content)
        (destination / "PROVENANCE.json").write_text(
            json.dumps(provenance(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    verify_directory(destination)
    print(f"Verified {len(PINS)} official unmodified files at {COMMIT}: {destination}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(f"Exolve preparation failed: {error}", file=sys.stderr)
        sys.exit(1)
