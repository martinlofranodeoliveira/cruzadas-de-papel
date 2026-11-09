#!/usr/bin/env python3
"""Independent stdlib reconstruction and verification of five supplied UI exports.

No app imports, browser internals or rendering. Download provenance must be recorded
separately by the person/agent that actually used the visible browser.
"""
import argparse
from collections import Counter
import hashlib
import html
import json
from pathlib import Path
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FILENAMES = ("cruzadas-projeto.json", "cruzadas-atividade.ipuz", "cruzadas-gabarito.ipuz",
             "cruzadas-atividade.svg", "cruzadas-gabarito.svg")
IPUZ_KEYS = {"version", "kind", "uniqueid", "title", "author", "intro", "dimensions", "block", "empty", "charset", "puzzle", "clues"}
NS = "{http://www.w3.org/2000/svg}"
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,39}\Z")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def exact_keys(value, keys, label):
    require(type(value) is dict and set(value) == set(keys), f"{label}: unexpected structure/keys")


def integer(value, minimum, maximum, label):
    require(type(value) is int and minimum <= value <= maximum, f"{label}: invalid integer")


def text(value, maximum, label, required=False):
    require(type(value) is str and len(value) <= maximum, f"{label}: invalid text/length")
    require(not required or bool(value.strip()), f"{label}: empty required text")
    require(value == "" or bool(value.strip()), f"{label}: whitespace-only text")
    require(not any(ord(ch) < 32 or ord(ch) in (127, 0x2028, 0x2029, 0xFFFE, 0xFFFF)
                    or 0xD800 <= ord(ch) <= 0xDFFF for ch in value), f"{label}: forbidden character")


def normalize(source):
    text(source, 80, "source", True)
    value = "".join(ch for ch in unicodedata.normalize("NFD", source) if not 0x300 <= ord(ch) <= 0x36F)
    value = value.translate(str.maketrans("", "", " -'’"))
    require(re.fullmatch(r"[A-Za-z]+", value) is not None, "source: unsupported character")
    value = value.upper()
    require(2 <= len(value) <= 21, "answer: invalid normalized length")
    return value


def reconstruct(project):
    """Rebuild cells, maximal runs, numbers and crossing graph from author JSON."""
    exact_keys(project, {"version", "puzzle", "entries"}, "project")
    require(type(project["version"]) is int and project["version"] == 1, "project version")
    puzzle = project["puzzle"]
    exact_keys(puzzle, {"id", "title", "subtitle", "author", "width", "height"}, "puzzle")
    require(type(puzzle["id"]) is str and ID.fullmatch(puzzle["id"]), "puzzle id")
    for field, maximum in (("title", 100), ("subtitle", 160), ("author", 80)):
        text(puzzle[field], maximum, field, field == "title")
    w, h = puzzle["width"], puzzle["height"]
    integer(w, 5, 21, "width")
    integer(h, 5, 21, "height")
    entries = project["entries"]
    require(type(entries) is list and 1 <= len(entries) <= 40, "entries: expected ready puzzle")
    grid = [[None for _ in range(w)] for _ in range(h)]
    occupants = [[[] for _ in range(w)] for _ in range(h)]
    starts, ids, registered = set(), set(), set()
    graph = {}
    for entry in entries:
        exact_keys(entry, {"id", "source", "answer", "clue", "placement"}, "entry")
        eid = entry["id"]
        require(type(eid) is str and ID.fullmatch(eid) and eid not in ids, "entry id/duplicate")
        ids.add(eid)
        graph[eid] = set()
        require(entry["answer"] == normalize(entry["source"]), "answer differs from original source normalization")
        text(entry["clue"], 200, "clue", True)
        placement = entry["placement"]
        exact_keys(placement, {"row", "col", "direction"}, "placement")
        row, col, direction = placement["row"], placement["col"], placement["direction"]
        integer(row, 0, h - 1, "row")
        integer(col, 0, w - 1, "col")
        require(direction in ("across", "down"), "direction")
        dr, dc = (0, 1) if direction == "across" else (1, 0)
        require(row + dr * (len(entry["answer"]) - 1) < h and col + dc * (len(entry["answer"]) - 1) < w, "out of bounds")
        starts.add((row, col))
        signature = (row, col, direction, len(entry["answer"]))
        require(signature not in registered, "duplicate registered run")
        registered.add(signature)
        for offset, letter in enumerate(entry["answer"]):
            r, c = row + dr * offset, col + dc * offset
            require(grid[r][c] in (None, letter), "letter collision")
            require(all(previous_direction != direction for _, previous_direction in occupants[r][c]), "same-direction collision")
            require(len(occupants[r][c]) < 2, "more than two entries in cell")
            grid[r][c] = letter
            occupants[r][c].append((eid, direction))
    runs = set()
    for r in range(h):
        for c in range(w):
            if grid[r][c] is None:
                continue
            for direction, dr, dc in (("across", 0, 1), ("down", 1, 0)):
                if (r - dr >= 0 and c - dc >= 0 and grid[r - dr][c - dc] is not None):
                    continue
                length = 0
                rr, cc = r, c
                while rr < h and cc < w and grid[rr][cc] is not None:
                    length += 1
                    rr, cc = rr + dr, cc + dc
                if length >= 2:
                    runs.add((r, c, direction, length))
    require(runs == registered, "maximal runs differ from registered words (accidental touches or missing entries)")
    crossings = 0
    for row in occupants:
        for cell in row:
            if len(cell) == 2:
                crossings += 1
                a, b = cell[0][0], cell[1][0]
                graph[a].add(b)
                graph[b].add(a)
    seen, components = set(), 0
    for eid in ids:
        if eid in seen:
            continue
        components += 1
        todo = [eid]
        while todo:
            current = todo.pop()
            if current not in seen:
                seen.add(current)
                todo.extend(graph[current] - seen)
    require(components == 1, "disconnected crossing graph")
    numbers = {start: number for number, start in enumerate(sorted(starts), 1)}
    return {"grid": grid, "numbers": numbers, "runs": runs, "components": components, "crossings": crossings,
            "lightCells": sum(letter is not None for row in grid for letter in row)}


def check_ipuz(value, project, expected, solution):
    exact_keys(value, IPUZ_KEYS | ({"solution"} if solution else set()), "IPUZ")
    require(value["version"] == "http://ipuz.org/v2", "IPUZ version")
    require(value["kind"] == ["http://ipuz.org/crossword#1"], "IPUZ kind")
    require(value["uniqueid"] == project["puzzle"]["id"], "IPUZ identity")
    require(value["block"] == "#" and type(value["empty"]) is int and value["empty"] == 0, "IPUZ block/empty")
    require(value["charset"] == "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "IPUZ charset")
    for field, source in (("title", "title"), ("author", "author"), ("intro", "subtitle")):
        require(type(value[field]) is str and html.unescape(value[field]) == project["puzzle"][source], f"IPUZ {field} text")
        require(value[field] == escape_html(project["puzzle"][source]), f"IPUZ {field} canonical HTML escaping")
        require("<" not in value[field] and ">" not in value[field], f"IPUZ {field} must escape HTML markup")
    w, h = project["puzzle"]["width"], project["puzzle"]["height"]
    exact_keys(value["dimensions"], {"width", "height"}, "IPUZ dimensions")
    require(value["dimensions"] == {"width": w, "height": h}, "IPUZ dimensions differ")
    target = [["#" if letter is None else expected["numbers"].get((r, c), 0) for c, letter in enumerate(row)] for r, row in enumerate(expected["grid"])]
    require(value["puzzle"] == target, "IPUZ light cells/blocks/numbers differ")
    require(all(cell == "#" or type(cell) is int for row in value["puzzle"] for cell in row), "IPUZ cell types")
    exact_keys(value["clues"], {"Across", "Down"}, "IPUZ clues")
    for external, internal in (("Across", "across"), ("Down", "down")):
        entries = sorted((entry for entry in project["entries"] if entry["placement"]["direction"] == internal),
                         key=lambda entry: expected["numbers"][(entry["placement"]["row"], entry["placement"]["col"])])
        require(type(value["clues"][external]) is list and len(value["clues"][external]) == len(entries), "IPUZ clue count")
        for pair, entry in zip(value["clues"][external], entries):
            require(type(pair) is list and len(pair) == 2 and type(pair[0]) is int and type(pair[1]) is str, "IPUZ clue shape")
            place = entry["placement"]
            require(pair[0] == expected["numbers"][(place["row"], place["col"])], "IPUZ clue number")
            require(html.unescape(pair[1]) == f'{entry["clue"]} ({len(entry["answer"])})', "IPUZ clue text/enumeration")
            require(pair[1] == f'{escape_html(entry["clue"])} ({len(entry["answer"])})', "IPUZ clue canonical HTML escaping")
            require("<" not in pair[1] and ">" not in pair[1], "IPUZ clue must escape HTML markup")
    if solution:
        require(value["solution"] == [[letter or "#" for letter in row] for row in expected["grid"]], "IPUZ solution differs")


def escape_html(value):
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")


def text_units(value):
    return sum(1 if ord(character) <= 0x7F else 2 for character in value)


def check_svg(raw, project, expected, solution):
    require(len(raw) <= 512 * 1024, "SVG exceeds bounded output size")
    require(b"<!DOCTYPE" not in raw.upper() and b"<!ENTITY" not in raw.upper(), "SVG declarations forbidden")
    require(b"<!--" not in raw, "SVG hidden comments forbidden")
    content = raw.removeprefix(b'<?xml version="1.0" encoding="UTF-8"?>')
    require(b"<?" not in content, "SVG processing instructions forbidden")
    root = ET.fromstring(raw)
    require(root.tag == NS + "svg", "SVG namespace/root")
    allowed_attributes = {
        "svg": {"width", "height", "viewBox", "role", "aria-labelledby", "font-family"},
        "g": {"id", "data-cell-size", "data-x", "data-y", "data-row", "data-col", "data-direction", "data-number"},
        "rect": {"x", "y", "width", "height", "fill", "stroke", "stroke-width"},
        "text": {"x", "y", "font-size", "font-weight", "id", "data-role", "text-anchor", "fill", "{http://www.w3.org/XML/1998/namespace}space"},
        "tspan": {"x", "y", "textLength", "lengthAdjust"},
    }
    require(root.get("width") == "1000" and 0 < int(root.get("height", "0")) <= 28000, "SVG canvas dimensions")
    canvas_height = int(root.get("height"))
    require(root.get("viewBox") == f"0 0 1000 {canvas_height}", "SVG viewBox")
    require(root.get("role") == "img" and root.get("aria-labelledby") == "sheet-heading" and root.get("font-family") == "sans-serif", "SVG document attributes")
    parents = {child: parent for parent in root.iter() for child in parent}
    for node in root.iter():
        require(node.tag.startswith(NS) and node.tag[len(NS):] in allowed_attributes, "SVG unexpected element/resource/metadata")
        tag = node.tag[len(NS):]
        require(set(node.attrib) <= allowed_attributes[tag], "SVG unexpected attribute/hidden data")
        require(tag in ("text", "tspan") or not (node.text or "").strip(), "SVG hidden nontext content")
        require(not (node.tail or "").strip(), "SVG unexpected trailing text")
        if tag == "tspan":
            require(parents[node].tag == NS + "text", "SVG text span outside visible text")
        for attr, value in node.attrib.items():
            require(not attr.lower().startswith("on") and "href" not in attr.lower() and "url(" not in value.lower(), "SVG external/active attribute")
            require(attr.lower() not in ("data-source", "data-answer", "data-answers", "data-solution", "style"), "SVG hidden data/style")
            require(not (attr in ("display", "visibility", "opacity", "font-size") and value in ("none", "hidden", "0")), "SVG hidden content")
            if attr in ("x", "y"):
                require(0 <= float(value) <= (1000 if attr == "x" else canvas_height), "SVG off-canvas position")
            if attr == "textLength":
                require(0 < float(value) <= 888, "SVG text length")
            if attr in ("fill", "stroke"):
                require(value in ("#fff", "#202833", "#566171"), "SVG color value/hidden data")
            if attr == "font-weight":
                require(value == "700", "SVG font weight")
            if attr == "font-size":
                require(value in ("9", "11", "13", "14", "16", "19", "30"), "SVG font size")
            if attr == "id":
                require(value == ("grid" if tag == "g" else "sheet-heading"), "SVG identifier/hidden data")
            if attr == "lengthAdjust":
                require(value == "spacingAndGlyphs", "SVG length adjustment")
            if attr == "stroke-width":
                require(value == "1", "SVG stroke width")
            if attr == "text-anchor":
                require(value == "middle", "SVG text anchor")
            if attr == "{http://www.w3.org/XML/1998/namespace}space":
                require(value == "preserve", "SVG whitespace handling")
        if tag == "g":
            allowed_group_shapes = ({"id", "data-cell-size", "data-x", "data-y"}, {"data-row", "data-col"}, {"data-direction", "data-number"})
            require(set(node.attrib) in allowed_group_shapes, "SVG group shape/hidden data")
        if tag == "text" and list(node):
            spans = list(node)
            require(all(span.tag == NS + "tspan" for span in spans), "SVG text children")
            if node.get("data-role") == "clue":
                budget, line_height, width = 26, 20, 432
            elif node.get("id") == "sheet-heading":
                budget, line_height, width = 28, 36, 888
            elif node.get("font-size") == "14":
                budget, line_height, width = 60, 18, 888
            else:
                require(node.get("font-size") == "16", "SVG wrapped text font")
                budget, line_height, width = 54, 21, 888
            lines = ["".join(span.itertext()) for span in spans]
            for index, span in enumerate(spans):
                line = lines[index]
                units = text_units(line)
                require(0 < units <= budget, "SVG line budget exceeded")
                require(units * int(node.get("font-size")) <= width, "SVG conservative line width")
                if index < len(spans) - 1:
                    remaining = "".join(lines[index + 1:])
                    require(bool(remaining), "SVG empty continuation line")
                    if line.endswith(" "):
                        next_word, separator, _ = remaining.partition(" ")
                        # If the next boundary still fits, this was not the
                        # last available space (or the break was unnecessary).
                        require(units + text_units(next_word + separator) > budget, "SVG premature word boundary")
                    else:
                        require(" " not in line, "SVG broke a word despite an available space")
                        require(units + text_units(remaining[0]) > budget, "SVG premature token break")
                if index:
                    require(float(span.get("y")) - float(spans[index - 1].get("y")) == line_height, "SVG wrapped line spacing")
    grids = [node for node in root.iter(NS + "g") if node.get("id") == "grid"]
    require(len(grids) == 1, "SVG expected one grid")
    grid = grids[0]
    size = int(grid.attrib["data-cell-size"])
    x, y = int(grid.attrib["data-x"]), int(grid.attrib["data-y"])
    require(size == 32 and x >= 0 and y >= 0, "SVG grid constants")
    cells = {(int(node.attrib["data-row"]), int(node.attrib["data-col"])): node for node in grid if node.tag == NS + "g"}
    w, h = project["puzzle"]["width"], project["puzzle"]["height"]
    require(len(cells) == w * h and len(list(grid)) == w * h, "SVG explicit cell count/duplicates")
    require(len(list(root.iter(NS + "rect"))) == 1 + w * h, "SVG unexpected rectangle")
    background = [node for node in root if node.tag == NS + "rect"]
    require(len(background) == 1 and background[0].attrib == {"width": "1000", "height": str(canvas_height), "fill": "#fff"}, "SVG canvas background")
    all_numbers, all_letters = [], []
    for r in range(h):
        for c in range(w):
            cell = cells[(r, c)]
            rects = list(cell.iter(NS + "rect"))
            require(len(rects) == 1, "SVG expected one rectangle per cell")
            rect = rects[0]
            require([int(rect.get(key, "-1")) for key in ("x", "y", "width", "height")] == [x + c * size, y + r * size, size, size], "SVG cell geometry")
            letter = expected["grid"][r][c]
            require(rect.get("fill") == ("#fff" if letter else "#202833"), "SVG blocked/light fill")
            numbers = [node for node in cell.iter(NS + "text") if node.get("data-role") == "number"]
            letters = [node for node in cell.iter(NS + "text") if node.get("data-role") == "letter"]
            number = expected["numbers"].get((r, c))
            require(["".join(node.itertext()) for node in numbers] == ([str(number)] if number else []), "SVG numbering differs")
            require(["".join(node.itertext()) for node in letters] == ([letter] if solution and letter else []), "SVG solution letter presence/content")
            require(len(list(cell)) == 1 + len(numbers) + len(letters), "SVG unexpected cell data")
            all_numbers.extend(numbers)
            all_letters.extend(letters)
    require(len([node for node in root.iter() if node.get("data-role") == "number"]) == len(all_numbers), "SVG stray number data")
    require(len([node for node in root.iter() if node.get("data-role") == "letter"]) == len(all_letters), "SVG stray solution data")
    groups = [node for node in root.iter(NS + "g") if node.get("data-direction")]
    require(len(groups) == len(project["entries"]), "SVG clue groups")
    require(len(list(root.iter(NS + "g"))) == 1 + w * h + len(groups), "SVG unexpected group")
    actual = {}
    for node in groups:
        key = (node.get("data-direction"), int(node.attrib["data-number"]))
        require(key not in actual, "SVG duplicate clue")
        clue_nodes = [text for text in node.iter(NS + "text") if text.get("data-role") == "clue"]
        require(len(clue_nodes) == 1, "SVG clue text shape")
        actual[key] = "".join(clue_nodes[0].itertext())
    wanted = {}
    for entry in project["entries"]:
        place = entry["placement"]
        number = expected["numbers"][(place["row"], place["col"])]
        wanted[(place["direction"], number)] = f'{number}. {entry["clue"]} ({len(entry["answer"])})'
    require(actual == wanted, "SVG complete clue text/enumeration")
    common_texts = ["".join(node.itertext()) for node in root.iter(NS + "text") if node.get("data-role") is None]
    expected_texts = ["Gabarito" if solution else "Atividade", project["puzzle"]["title"],
                      "Uma letra A–Z por célula. As pistas indicam o número de letras.",
                      "Horizontal", "Vertical", "Cruzadas de Papel · LOFRANO TECNOLOGIA"]
    if project["puzzle"]["subtitle"]:
        expected_texts.append(project["puzzle"]["subtitle"])
    if project["puzzle"]["author"]:
        expected_texts.append("Autoria: " + project["puzzle"]["author"])
    require(Counter(common_texts) == Counter(expected_texts), "SVG unexpected or missing visible author text")
    require(all(node.get("data-role") in (None, "number", "letter", "clue") for node in root.iter()), "SVG unexpected text role")
    return root


def parse_json(raw):
    require(len(raw) <= 512 * 1024, "JSON exceeds 512 KiB")
    return json.loads(raw.decode("utf-8"))


def verify(fixture_path, downloads):
    fixture_raw = Path(fixture_path).read_bytes()
    project = parse_json(fixture_raw)
    expected = reconstruct(project)
    raw = {name: (Path(downloads) / name).read_bytes() for name in FILENAMES}
    downloaded_project = parse_json(raw[FILENAMES[0]])
    require(downloaded_project == project, "Downloaded author JSON differs from fixture")
    require(raw[FILENAMES[0]] == fixture_raw, "Downloaded author JSON differs from canonical fixture bytes")
    reconstruct(downloaded_project)
    for index, solution in ((1, False), (2, True)):
        check_ipuz(parse_json(raw[FILENAMES[index]]), project, expected, solution)
    for index, solution in ((3, False), (4, True)):
        check_svg(raw[FILENAMES[index]], project, expected, solution)
    return {"verified": True, "scope": "Independent stdlib semantic checks of supplied files; browser provenance is separate evidence. No PNG is produced or claimed.",
            "fixture": {"path": str(Path(fixture_path)), "sha256": hashlib.sha256(fixture_raw).hexdigest()},
            "files": [{"name": name, "bytes": len(raw[name]), "sha256": hashlib.sha256(raw[name]).hexdigest()} for name in FILENAMES],
            "stats": {"width": project["puzzle"]["width"], "height": project["puzzle"]["height"], "entries": len(project["entries"]),
                      "lightCells": expected["lightCells"], "crossings": expected["crossings"], "components": expected["components"], "numbers": len(expected["numbers"])}}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", type=Path, default=ROOT / "fixtures/demo-project.json")
    parser.add_argument("--downloads", type=Path, required=True)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)
    report = verify(args.fixture, args.downloads)
    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output, encoding="utf-8")
    print(output, end="")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, ET.ParseError) as error:
        print(f"Independent verification failed: {error}", file=sys.stderr)
        sys.exit(1)
