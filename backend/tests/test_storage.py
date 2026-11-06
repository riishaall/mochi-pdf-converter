import pytest

from app.storage import job_directory, safe_filename


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("report.pdf", "report.pdf"),
        ("../../contract final.PDF", "contract final.pdf"),
        (r"C:\Users\Public\report.pdf", "report.pdf"),
        ("../<script>alert(1)</script>.pdf", "script_.pdf"),
        ("   .pdf", "document.pdf"),
    ],
)
def test_safe_filename(name: str, expected: str) -> None:
    assert safe_filename(name) == expected


def test_job_directory_rejects_non_uuid() -> None:
    with pytest.raises(ValueError):
        job_directory("../../outside")
