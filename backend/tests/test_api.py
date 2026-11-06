from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture
def api(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, dict]]:
    jobs = {}
    monkeypatch.setattr(main.settings, "storage_dir", tmp_path)
    monkeypatch.setattr(main.limiter, "enabled", False)
    monkeypatch.setattr(main, "save_job", lambda job: jobs.update({job["id"]: job.copy()}))
    monkeypatch.setattr(main.convert_job, "delay", lambda *args: None)
    with TestClient(main.app) as client:
        yield client, jobs


def test_upload_creates_a_queued_job(api: tuple[TestClient, dict]) -> None:
    client, jobs = api
    response = client.post(
        "/api/jobs",
        files=[("files", ("Quarterly report.pdf", b"%PDF-1.7\nsample", "application/pdf"))],
        data={"ocr": "true"},
    )

    assert response.status_code == 200
    job = jobs[response.json()["id"]]
    assert job["status"] == "queued"
    assert job["ocr"] is True
    assert Path(job["files"][0]["path"]).read_bytes() == b"%PDF-1.7\nsample"


def test_upload_rejects_non_pdf_extension(api: tuple[TestClient, dict]) -> None:
    client, _ = api
    response = client.post(
        "/api/jobs",
        files=[("files", ("notes.txt", b"not a PDF", "text/plain"))],
    )

    assert response.status_code == 415
    assert "not a PDF" in response.json()["detail"]


def test_upload_enforces_per_file_size_and_cleans_partial_data(
    api: tuple[TestClient, dict],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, jobs = api
    monkeypatch.setattr(main.settings, "max_file_size", 10)
    response = client.post(
        "/api/jobs",
        files=[("files", ("oversized.pdf", b"%PDF-1.7\nmore than ten bytes", "application/pdf"))],
    )

    assert response.status_code == 413
    assert jobs == {}
    assert list(main.settings.storage_dir.iterdir()) == []
