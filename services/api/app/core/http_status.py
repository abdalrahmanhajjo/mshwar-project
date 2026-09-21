"""HTTP status aliases that stay stable across Starlette versions.

Starlette renamed 422 to HTTP_422_UNPROCESSABLE_CONTENT and deprecated the old
name; the supported FastAPI range includes both, so the number is used directly.
"""

HTTP_422_UNPROCESSABLE = 422
HTTP_413_CONTENT_TOO_LARGE = 413
