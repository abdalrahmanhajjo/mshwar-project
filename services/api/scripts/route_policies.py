"""Write docs/security/route-policies.md from the app's route table (MSHWAR-108).

Usage: PYTHONPATH=. python scripts/route_policies.py
"""

from __future__ import annotations

from pathlib import Path

from app.core.access import render_route_table
from app.main import app

TARGET = Path(__file__).resolve().parents[3] / "docs" / "security" / "route-policies.md"


def main() -> None:
    TARGET.write_text(render_route_table(app), encoding="utf-8")
    print(f"wrote {TARGET}")


if __name__ == "__main__":
    main()
