from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.static_site import attach_static_site


@pytest.fixture
def site(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>container-spa</html>", encoding="utf-8")
    (tmp_path / "assets" / "app.js").write_text("window.ok = true", encoding="utf-8")
    app = FastAPI()
    attach_static_site(app, str(tmp_path))
    return TestClient(app)


@pytest.mark.parametrize("path", ["/", "/login", "/register", "/profile", "/my-trips", "/plan/example?trip=1"])
def test_deep_links(site, path):
    response = site.get(path)
    assert response.status_code == 200
    assert "container-spa" in response.text
    assert response.headers["cache-control"] == "no-cache"
    assert site.head(path).status_code == 200


@pytest.mark.parametrize("path", ["/api/missing", "/api", "/assets/missing.js", "/unknown", "/.env", "/backend/app/config.py", "/assets/%2e%2e%2findex.html"])
def test_unknown_and_private_paths_are_not_spa(site, path):
    response = site.get(path)
    assert response.status_code == 404
    assert "container-spa" not in response.text


def test_static_asset_and_methods(site):
    assert site.get("/assets/app.js").text == "window.ok = true"
    assert site.post("/login").status_code == 405


def test_missing_build_fails(tmp_path):
    with pytest.raises(RuntimeError, match="STATIC_DIR"):
        attach_static_site(FastAPI(), str(tmp_path))
