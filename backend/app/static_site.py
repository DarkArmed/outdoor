"""Serve the built SPA with the existing FastAPI/Starlette dependencies."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def attach_static_site(app: FastAPI, directory: str) -> None:
    root = Path(directory).resolve()
    if not (root / "index.html").is_file() or not (root / "assets").is_dir():
        raise RuntimeError("STATIC_DIR must contain a built index.html and assets directory")

    # Match real files only. Never turn asset/API errors into an HTML success.
    app.mount("/assets", StaticFiles(directory=root / "assets"), name="assets")

    def index():
        return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})

    for path in ("/", "/login", "/register", "/profile", "/my-trips", "/plan/{plan_id}"):
        app.add_api_route(path, index, methods=["GET", "HEAD"], include_in_schema=False)
