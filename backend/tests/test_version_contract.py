import json
from pathlib import Path

from backend.app.main import APP_VERSION


ROOT = Path(__file__).resolve().parents[2]


def test_release_version_is_synchronized_across_project_surfaces():
    canonical = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    frontend = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))["version"]
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    assert canonical == APP_VERSION
    assert frontend == canonical
    assert f"**Version {canonical} ·" in readme
