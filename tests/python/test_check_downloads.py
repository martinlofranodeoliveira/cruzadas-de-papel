"""Offline independent checker tests. Reference SVGs are NOT browser evidence."""
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("checker", ROOT / "tools/check_downloads.py")
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)
PREPARE_SPEC = importlib.util.spec_from_file_location("prepare", ROOT / "tools/prepare-exolve.py")
prepare = importlib.util.module_from_spec(PREPARE_SPEC)
PREPARE_SPEC.loader.exec_module(prepare)


class DownloadsTest(unittest.TestCase):
    def setUp(self):
        self.project = json.loads((ROOT / "fixtures/demo-project.json").read_text(encoding="utf-8"))
        self.expected = checker.reconstruct(self.project)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        for source, target in (("demo-project.json", checker.FILENAMES[0]),
                               ("demo-activity.ipuz", checker.FILENAMES[1]),
                               ("demo-solution.ipuz", checker.FILENAMES[2]),
                               ("interop/reference-activity.svg", checker.FILENAMES[3]),
                               ("interop/reference-solution.svg", checker.FILENAMES[4])):
            shutil.copyfile(ROOT / "fixtures" / source, self.directory / target)

    def ipuz(self, solution=False):
        return json.loads((self.directory / checker.FILENAMES[2 if solution else 1]).read_text(encoding="utf-8"))

    def svg(self, solution=False):
        return (self.directory / checker.FILENAMES[4 if solution else 3]).read_bytes()

    def check_ipuz(self, value, solution=False):
        checker.check_ipuz(value, self.project, self.expected, solution)

    def check_svg(self, value, solution=False):
        checker.check_svg(value, self.project, self.expected, solution)

    def test_known_original_nine_word_geometry(self):
        # Hand-audited coordinates and spelling, not derived from app analysis.
        coordinates = [("CASA", 2, 2, "across"), ("CAFE", 2, 2, "down"),
                       ("FEIRA", 4, 2, "across"), ("ACAO", 4, 6, "down"),
                       ("ARTE", 6, 6, "across"), ("TEMA", 6, 8, "down"),
                       ("MALA", 8, 8, "across"), ("LUA", 8, 10, "down"),
                       ("AGUA", 10, 10, "across")]
        actual = [(e["answer"], e["placement"]["row"], e["placement"]["col"], e["placement"]["direction"]) for e in self.project["entries"]]
        self.assertEqual(actual, coordinates)
        self.assertEqual((self.project["puzzle"]["width"], self.project["puzzle"]["height"]), (15, 13))
        self.assertEqual([self.expected[key] for key in ("lightCells", "crossings", "components")], [28, 8, 1])
        self.assertEqual(self.expected["numbers"], {(2, 2): 1, (4, 2): 2, (4, 6): 3, (6, 6): 4, (6, 8): 5, (8, 8): 6, (8, 10): 7, (10, 10): 8})
        self.assertEqual(len(self.expected["runs"]), 9)

    def test_valid_five_files_and_audit_association(self):
        report = checker.verify(ROOT / "fixtures/demo-project.json", self.directory)
        self.assertTrue(report["verified"])
        self.assertIn("browser provenance is separate", report["scope"])
        self.assertEqual([item["name"] for item in report["files"]], list(checker.FILENAMES))
        for item in report["files"]:
            raw = (self.directory / item["name"]).read_bytes()
            self.assertEqual(item["sha256"], hashlib.sha256(raw).hexdigest())
            self.assertEqual(item["bytes"], len(raw))

    def test_cli_creates_nested_report_and_no_png(self):
        report = self.directory / "nested/evidence/independent.json"
        result = subprocess.run([sys.executable, str(ROOT / "tools/check_downloads.py"), "--downloads", str(self.directory), "--report", str(report)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(report.read_text())["verified"])
        self.assertEqual(list(self.directory.rglob("*.png")), [])

    def test_failed_cli_does_not_write_success_report(self):
        (self.directory / checker.FILENAMES[1]).write_text("{", encoding="utf-8")
        report = self.directory / "failed.json"
        result = subprocess.run([sys.executable, str(ROOT / "tools/check_downloads.py"), "--downloads", str(self.directory), "--report", str(report)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(report.exists())
        self.assertNotIn("PNG", result.stderr)

    def test_missing_real_file_fails(self):
        (self.directory / checker.FILENAMES[4]).unlink()
        with self.assertRaises(FileNotFoundError):
            checker.verify(ROOT / "fixtures/demo-project.json", self.directory)

    def test_author_json_change_and_noncanonical_bytes_fail(self):
        path = self.directory / checker.FILENAMES[0]
        path.write_text(json.dumps(self.project), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "canonical fixture bytes"):
            checker.verify(ROOT / "fixtures/demo-project.json", self.directory)
        changed = deepcopy(self.project)
        changed["puzzle"]["title"] += " alterado"
        path.write_text(json.dumps(changed), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "differs from fixture"):
            checker.verify(ROOT / "fixtures/demo-project.json", self.directory)

    def test_normalization_known_unicode_boundary(self):
        for source, answer in (("ação", "ACAO"), ("maçã", "MACA"), ("São Paulo", "SAOPAULO"), ("d'água", "DAGUA"), ("d’água", "DAGUA")):
            self.assertEqual(checker.normalize(source), answer)
        for source in ("straße", "A_B", "A\tB", "A\u00a0B", "A/B", "A\u200bB", "A\ud800B", "x", "a" * 22):
            with self.subTest(source=repr(source)), self.assertRaises(ValueError):
                checker.normalize(source)

    def test_single_line_and_xml_noncharacters_fail(self):
        for character in ("\u2028", "\u2029", "\ufffe", "\uffff"):
            for field in ("title", "subtitle", "author"):
                bad = deepcopy(self.project)
                bad["puzzle"][field] = "Texto" + character
                with self.subTest(field=field, character=repr(character)), self.assertRaisesRegex(ValueError, "forbidden character"):
                    checker.reconstruct(bad)
            bad = deepcopy(self.project)
            bad["entries"][0]["clue"] = "Pista" + character
            with self.assertRaisesRegex(ValueError, "forbidden character"):
                checker.reconstruct(bad)

    def test_answer_source_corruption_fails(self):
        project = deepcopy(self.project)
        project["entries"][0]["answer"] = "CAZA"
        with self.assertRaisesRegex(ValueError, "normalization"):
            checker.reconstruct(project)

    def test_geometry_and_reference_corruption_fail(self):
        cases = []
        duplicate = deepcopy(self.project)
        duplicate["entries"][1]["id"] = duplicate["entries"][0]["id"]
        cases.append(duplicate)
        for direction, row, col in (("across", 2, 2), ("down", 2, 3), ("across", 12, 14)):
            bad = deepcopy(self.project)
            bad["entries"][1]["placement"] = {"row": row, "col": col, "direction": direction}
            cases.append(bad)
        missing = deepcopy(self.project)
        missing["entries"].pop(1)
        cases.append(missing)
        disconnected = deepcopy(self.project)
        disconnected["entries"] = [disconnected["entries"][0], disconnected["entries"][-1]]
        cases.append(disconnected)
        for bad in cases:
            with self.subTest(entries=len(bad["entries"])), self.assertRaises(ValueError):
                checker.reconstruct(bad)

    def test_activity_structural_secrets_fail(self):
        for key in ("solution", "answer", "answers", "source", "entries", "saved", "checksum", "annotation", "origin"):
            bad = self.ipuz()
            bad[key] = ["SECRET"]
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.check_ipuz(bad)

    def test_activity_nested_secret_fails(self):
        bad = self.ipuz()
        bad["clues"]["Across"][0] = {"number": 1, "clue": "A", "answer": "CASA"}
        with self.assertRaises(ValueError):
            self.check_ipuz(bad)

    def test_ipuz_number_block_blank_and_clue_corruptions_fail(self):
        for row, col, cell in ((2, 2, 2), (2, 3, 1), (0, 0, 0), (2, 2, True), (2, 3, "A")):
            bad = self.ipuz()
            bad["puzzle"][row][col] = cell
            with self.subTest(cell=cell), self.assertRaises(ValueError):
                self.check_ipuz(bad)
        for mutate in (lambda v: v["clues"]["Across"].pop(), lambda v: v["clues"]["Across"][0].__setitem__(0, 99), lambda v: v["clues"]["Down"][0].__setitem__(1, "Pista truncada (4)")):
            bad = self.ipuz()
            mutate(bad)
            with self.assertRaises(ValueError):
                self.check_ipuz(bad)

    def test_ipuz_unescaped_html_and_solution_corruption_fail(self):
        bad = self.ipuz()
        for direction, clues in bad["clues"].items():
            for pair in clues:
                if "&lt;" in pair[1]:
                    pair[1] = pair[1].replace("&lt;", "<")
        with self.assertRaises(ValueError):
            self.check_ipuz(bad)
        solved = self.ipuz(True)
        solved["solution"][2][2] = "X"
        with self.assertRaisesRegex(ValueError, "solution differs"):
            self.check_ipuz(solved, True)

    def test_svg_activity_has_no_letters_and_rejects_metadata(self):
        self.assertNotIn(b'data-role="letter"', self.svg())
        for injected in (b'<metadata>{"source":"casa"}</metadata>', b'<script>alert(1)</script>',
                         b'<foreignObject/>', b'<image href="https://example.invalid/a"/>', b'<text x="1" y="1">CASA</text>',
                         b'<g id="CASA"/>', b'<tspan x="1" y="1">CASA</tspan>',
                         b'<!-- {"solution":"CASA"} -->', b'<?hidden solution="CASA"?>'):
            bad = self.svg().replace(b"</svg>", injected + b"</svg>")
            with self.subTest(injected=injected), self.assertRaises(ValueError):
                self.check_svg(bad)

    def test_svg_letter_number_geometry_and_clue_corruptions_fail(self):
        corruptions = [self.svg(True).replace(b'data-role="letter"', b'data-role="leak"', 1),
                       self.svg().replace(b'data-role="number"', b'data-role="letter"', 1),
                       self.svg().replace(b'data-col="0"', b'data-col="1"', 1),
                       self.svg().replace(b'width="32"', b'width="31"', 1),
                       self.svg().replace(b'fill="#202833"', b'fill="#fff"', 1),
                       self.svg().replace(b'data-role="clue"', b'data-role="source"', 1),
                       self.svg().replace(b'textLength="', b'textLength="9999', 1),
                       self.svg().replace(b'x="56"', b'x="-56"', 1),
                       self.svg().replace(b'<svg ', b'<svg onload="alert(1)" ', 1)]
        for index, bad in enumerate(corruptions):
            with self.subTest(index=index), self.assertRaises((ValueError, KeyError)):
                self.check_svg(bad)

    def test_svg_real_line_breaks_are_required_without_fitting_hints(self):
        root = ET.fromstring(self.svg())
        for node in root.iter(checker.NS + "tspan"):
            node.attrib.pop("textLength", None)
            node.attrib.pop("lengthAdjust", None)
        self.check_svg(ET.tostring(root, encoding="utf-8"))
        clue_text = next(node for node in root.iter(checker.NS + "text") if node.get("data-role") == "clue" and len(node) > 1)
        first, second = list(clue_text)[:2]
        first.text = (first.text or "") + (second.text or "")
        clue_text.remove(second)
        # Full clue content is unchanged, but a long line can cross columns in
        # renderers that ignore textLength. The independent budget catches it.
        with self.assertRaisesRegex(ValueError, "line budget"):
            self.check_svg(ET.tostring(root, encoding="utf-8"))
        root = ET.fromstring(self.svg())
        spans = list(root.iter(checker.NS + "tspan"))
        for token in ("histórias.", "lembranças."):
            self.assertTrue(any(token in (span.text or "") for span in spans), token)
        clue_text = next(node for node in root.iter(checker.NS + "text") if node.get("data-role") == "clue" and "histórias." in "".join(node.itertext()))
        previous, final = list(clue_text)[-2:]
        previous.text += final.text[0]
        final.text = final.text[1:]
        # This also preserves all text and stays inside the width budget, but
        # incorrectly fragments an ordinary word when a space was available.
        with self.assertRaisesRegex(ValueError, "broke a word"):
            self.check_svg(ET.tostring(root, encoding="utf-8"))

    def test_preparer_has_fixed_commit_and_detects_modified_bytes(self):
        self.assertEqual(prepare.COMMIT, "8f0d4f6dbb82a1b0ff477795aa8f46e9510bfaa2")
        self.assertEqual(len(prepare.PINS), 10)
        with self.assertRaisesRegex(ValueError, "SHA256 mismatch"):
            prepare.verify_file("exolve-from-ipuz.js", b"patched converter")
        parser = prepare.Dependencies()
        parser.feed('<script src="exolve-m.js?v1.71"></script><link rel="stylesheet" href="exolve-m.css?v1.71">')
        self.assertEqual(parser.files, {"exolve-m.js", "exolve-m.css"})
        with self.assertRaises(ValueError):
            prepare.Dependencies().feed('<script src="https://example.invalid/remote.js"></script>')


if __name__ == "__main__":
    unittest.main()
