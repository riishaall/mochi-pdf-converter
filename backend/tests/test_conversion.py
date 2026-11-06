from pathlib import Path

import fitz
import pytest

from app.worker import convert_to_docx


def create_pdf(path: Path, password: str = "") -> None:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), "A simple editable PDF document")
    options = {"encryption": fitz.PDF_ENCRYPT_AES_256, "user_pw": password, "owner_pw": "owner"} if password else {}
    document.save(path, **options)
    document.close()


def test_converts_pdf_to_docx(tmp_path: Path) -> None:
    source = tmp_path / "source.pdf"
    output = tmp_path / "converted.docx"
    create_pdf(source)

    assert convert_to_docx(source, output, use_ocr=False, password="") == 1
    assert output.is_file()
    assert output.stat().st_size > 0


def test_converts_password_protected_pdf(tmp_path: Path) -> None:
    source = tmp_path / "protected.pdf"
    output = tmp_path / "converted.docx"
    create_pdf(source, password="correct horse")

    with pytest.raises(PermissionError):
        convert_to_docx(source, output, use_ocr=False, password="wrong")

    assert convert_to_docx(source, output, use_ocr=False, password="correct horse") == 1
    assert output.is_file()
