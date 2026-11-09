"""Empacota fonte Git limpa e build conferido, com ZIPs determinísticos e SHA256SUMS."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import zipfile


ROOT = Path(__file__).resolve().parents[1]
RELEASE = "cruzadas-de-papel-1.0.0"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def archive(path, members):
    with zipfile.ZipFile(path, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for name, data in sorted(members.items()):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            output.writestr(info, data)
    with zipfile.ZipFile(path) as verify:
        assert verify.testzip() is None, "CRC inválido no ZIP recém-criado."
        assert verify.namelist() == sorted(members)
        for name, data in members.items():
            assert verify.read(name) == data, name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    subprocess.run(["node", "scripts/check.mjs"], cwd=ROOT, check=True)
    assert Path(git("rev-parse", "--show-toplevel").decode().strip()).resolve() == ROOT
    assert not git("status", "--porcelain"), "Árvore fonte precisa estar limpa."
    assert json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"] == "1.0.0"
    source = {}
    denied = {".git", ".env", ".openai", ".impeccable", "local", "dist", "node_modules", ".venv", "__pycache__"}
    for item in git("ls-tree", "-rz", "HEAD").split(b"\0"):
        if not item:
            continue
        metadata, raw_name = item.split(b"\t", 1)
        mode, kind, _object_id = metadata.split(b" ")
        name = raw_name.decode("utf-8")
        path = PurePosixPath(name)
        assert mode in (b"100644", b"100755") and kind == b"blob", "Somente arquivos regulares na fonte."
        assert not path.is_absolute() and ".." not in path.parts and "\\" not in name
        assert not any(part in denied or part.startswith((".env.", ".dist-build-")) for part in path.parts), name
        assert not name.endswith((".pyc", ".pyo")), name
        local = ROOT / name
        assert local.is_file() and not local.is_symlink() and local.resolve() == local
        data = local.read_bytes()
        assert data == git("show", "HEAD:" + name), name
        source[name] = data
    build = {}
    for path in (ROOT / "dist").rglob("*"):
        assert not path.is_symlink(), "Links não fazem parte da distribuição."
        if path.is_file():
            build[path.relative_to(ROOT / "dist").as_posix()] = path.read_bytes()
    # A conferência Node já reconstruiu a lista pública exata e todos os hashes.
    args.out.mkdir(parents=True, exist_ok=False)
    archive(args.out / f"{RELEASE}-source.zip", source)
    archive(args.out / f"{RELEASE}-static.zip", build)
    demo_name = "cruzadas-de-papel-demo.json"
    (args.out / demo_name).write_bytes((ROOT / "fixtures/demo-project.json").read_bytes())
    records = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(args.out.iterdir())}
    (args.out / "SHA256SUMS").write_text("".join(f"{digest}  {name}\n" for name, digest in records.items()), encoding="utf-8", newline="\n")
    print(json.dumps({"source_commit": git("rev-parse", "HEAD").decode().strip(),
                      "source_files": len(source), "static_files": len(build), "assets": records}, indent=2))


if __name__ == "__main__":
    main()
