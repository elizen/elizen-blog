import contextlib
import csv
import importlib.util
import io
import shutil
import subprocess
import tempfile
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError


ROOT = Path(__file__).resolve().parents[2]


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / ".github" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cache = load_script("cache-douban-posters")
sync = load_script("update-douban-posters")
OFFICIAL = "https://img3.doubanio.com/view/photo/s_ratio_poster/public/cover.jpg"
MIRROR = "https://dou.img.lithub.cc/movie/1.jpg"


class PosterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.target = self.root / "movie" / "1.jpg"

    def response(self, data=b"x" * 2048, content_type="image/jpeg"):
        response = io.BytesIO(data)
        response.headers = Message()
        response.headers["Content-Type"] = content_type
        return response

    def test_download_and_cache(self):
        with patch.object(cache, "urlopen", return_value=self.response()) as request:
            self.assertEqual(cache.download((OFFICIAL, self.target)), "downloaded")
            self.assertEqual(cache.download((OFFICIAL, self.target)), "cached")
            request.assert_called_once()
        self.assertEqual(self.target.read_bytes(), b"x" * 2048)

    def test_permanent_failure_logs_identity_and_leaves_no_file(self):
        self.target.parent.mkdir()
        self.target.write_bytes(b"partial")
        error = HTTPError(MIRROR, 404, "Not Found", {}, None)
        self.addCleanup(error.close)
        log = io.StringIO()
        with patch.object(cache, "urlopen", side_effect=error) as request, contextlib.redirect_stderr(log):
            self.assertEqual(cache.download((MIRROR, self.target)), "failed")
            request.assert_called_once()
        self.assertFalse(self.target.exists())
        for detail in ("movie/1", MIRROR, "404"):
            self.assertIn(detail, log.getvalue())

    def test_transient_failure_retries_then_succeeds(self):
        with patch.object(cache, "urlopen", side_effect=[URLError("temporary"), self.response()]) as request, patch.object(cache.time, "sleep"):
            self.assertEqual(cache.download((OFFICIAL, self.target)), "downloaded")
            self.assertEqual(request.call_count, 2)

    def test_invalid_response_is_not_published(self):
        with patch.object(cache, "urlopen", side_effect=lambda *a, **kw: self.response(b"html", "text/html")), patch.object(cache.time, "sleep"), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(cache.download((OFFICIAL, self.target)), "failed")
        self.assertFalse(self.target.exists())
        self.assertFalse(self.target.with_suffix(".jpg.tmp").exists())

    def test_transient_failure_stops_after_three_attempts(self):
        error = HTTPError(OFFICIAL, 503, "Unavailable", {}, None)
        self.addCleanup(error.close)
        with patch.object(cache, "urlopen", side_effect=error) as request, patch.object(cache.time, "sleep"), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(cache.download((OFFICIAL, self.target)), "failed")
            self.assertEqual(request.call_count, 3)
        self.assertFalse(self.target.exists())

    def test_optional_failure_does_not_abort_build_command(self):
        with patch.object(cache, "poster_jobs", return_value=[(MIRROR, self.target)]), patch.object(cache, "download", return_value="failed"), patch("sys.argv", ["cache-douban-posters.py"]), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            cache.main()

    def write_csv(self, path, rows):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", newline="", encoding="utf-8") as target:
            writer = csv.DictWriter(target, fieldnames=["id", "title", "poster", "comment"])
            writer.writeheader()
            writer.writerows(rows)

    def test_sync_preserves_missing_official_mapping_and_other_fields(self):
        csv_path = self.root / "data/douban/movie.csv"
        previous = self.root / "previous"
        rows = [dict(id=str(i), title="title", poster=MIRROR, comment="line one\nline two") for i in range(1, 5)]
        rows[2]["poster"] = OFFICIAL
        self.write_csv(csv_path, rows)
        self.write_csv(previous / "movie.csv", [dict(rows[0], poster=OFFICIAL)])
        new_url = OFFICIAL.replace("cover.jpg", "new.jpg")
        with patch.object(sync, "REPO_ROOT", self.root), patch.object(sync, "official_posters", return_value={"2": new_url, "4": MIRROR}), contextlib.redirect_stdout(io.StringIO()):
            sync.update_csv("movie", previous)
        with csv_path.open(newline="", encoding="utf-8") as source:
            result = list(csv.DictReader(source))
        self.assertEqual([row["poster"] for row in result], [OFFICIAL, new_url, OFFICIAL, ""])
        for original, updated in zip(rows, result):
            self.assertEqual({k: v for k, v in original.items() if k != "poster"}, {k: v for k, v in updated.items() if k != "poster"})

    def test_missing_snapshot_does_not_reintroduce_mirror(self):
        csv_path = self.root / "data/douban/book.csv"
        self.write_csv(csv_path, [dict(id="1", title="title", poster=MIRROR, comment="")])
        with patch.object(sync, "REPO_ROOT", self.root), patch.object(sync, "official_posters", return_value={}), contextlib.redirect_stdout(io.StringIO()):
            sync.update_csv("book", self.root / "missing")
        with csv_path.open(newline="", encoding="utf-8") as source:
            self.assertEqual(next(csv.DictReader(source))["poster"], "")

    @unittest.skipUnless(shutil.which("hugo"), "Hugo is required for template integration")
    def test_hugo_uses_text_fallback_without_broken_image_reference(self):
        partial_dir = self.root / "layouts/partials"
        partial_dir.mkdir(parents=True)
        shutil.copyfile(ROOT / "themes/ivy/layouts/partials/media-page.html", partial_dir / "media-page.html")
        (self.root / "config.toml").write_text('baseURL = "https://example.com/"\n', encoding="utf-8")
        # Render both a present and missing cover for each media kind.
        template = '''{{ range slice "movies" "books" }}
{{ $items := slice (slice "1" "Present" "" "" "" "https://example.com" "8" "" "" "" "" "2026-10-21") (slice "2" "Missing" "" "" "" "https://example.com" "8" "" "" "" "" "2026-10-21") }}
{{ partial "media-page.html" (dict "page" $ "items" $items "kind" "阅读" "english" "READING" "unit" "items" "slug" .) }}
{{ end }}'''
        (self.root / "layouts/index.html").write_text(template, encoding="utf-8")
        for kind in ("movie", "book"):
            cover = self.root / f"static/images/douban/{kind}/1.jpg"
            cover.parent.mkdir(parents=True)
            cover.write_bytes(b"x" * 2048)
        subprocess.run(["hugo", "--source", str(self.root)], check=True, capture_output=True)
        html = (self.root / "public/index.html").read_text(encoding="utf-8")
        for kind in ("movie", "book"):
            self.assertIn(f'data-src="/images/douban/{kind}/1.jpg"', html)
            self.assertNotIn(f"/images/douban/{kind}/2.jpg", html)
        self.assertEqual(html.count('media-cover-fallback"  aria-label="Missing"'), 2)


if __name__ == "__main__":
    unittest.main()
