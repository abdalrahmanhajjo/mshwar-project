#!/usr/bin/env python3
"""Run the canonical SQL migrations (mshwar-database/scripts/migrate.py).

Kept here so `python scripts/migrate.py` works from services/api, locally and in the API image.
"""

import runpy
from pathlib import Path

_here = Path(__file__).resolve()
_runner = next(
    (
        candidate / "mshwar-database" / "scripts" / "migrate.py"
        for candidate in _here.parents
        if (candidate / "mshwar-database" / "scripts" / "migrate.py").is_file()
    ),
    Path("/mshwar-database/scripts/migrate.py"),
)

if __name__ == "__main__":
    runpy.run_path(str(_runner), run_name="__main__")
