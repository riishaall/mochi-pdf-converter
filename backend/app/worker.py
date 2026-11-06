import logging
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from celery import Celery
from celery.exceptions import SoftTimeLimitExceeded
from pdf2docx import Converter
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError

from app.config import settings
from app.storage import get_job, job_directory, redis_client, save_job


logger = logging.getLogger(__name__)
celery_app = Celery("pdf2word", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=1800,
    task_time_limit=1860,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    beat_schedule={
        "remove-expired-files": {
            "task": "app.worker.cleanup_expired_files",
            "schedule": 60.0,
        }
    },
)


def friendly_error(exc: Exception) -> str:
    if isinstance(exc, (TimeoutError, subprocess.TimeoutExpired, SoftTimeLimitExceeded)):
        return "This conversion took too long. Try a smaller or simpler PDF."
    if isinstance(exc, FileNotFoundError):
        return "A required conversion tool is unavailable. Please try again later."
    if isinstance(exc, PdfReadError):
        return "This PDF looks damaged or unreadable. Please open it in a PDF reader and try a fresh copy."
    return "We couldn't convert this PDF. Please check that it opens correctly and try again."


def set_job(job: dict, status: str, progress: int, state: str, **extra: object) -> None:
    job.update(status=status, progress=progress, state=state, updated_at=datetime.now(timezone.utc).isoformat())
    job.update(extra)
    save_job(job)


def make_unencrypted_pdf(source: Path, destination: Path, password: str) -> None:
    reader = PdfReader(str(source))
    if reader.is_encrypted:
        if not password or not reader.decrypt(password):
            raise PermissionError("The password is missing or incorrect.")
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        with destination.open("wb") as file:
            writer.write(file)
    else:
        shutil.copyfile(source, destination)


def convert_to_docx(source: Path, output: Path, use_ocr: bool, password: str) -> int:
    reader = PdfReader(str(source))
    if reader.is_encrypted:
        decrypted = source.with_name(f"{source.stem}-decrypted.pdf")
        make_unencrypted_pdf(source, decrypted, password)
        source = decrypted

    if use_ocr:
        ocr_output = source.with_name(f"{source.stem}-ocr.pdf")
        result = subprocess.run(
            ["ocrmypdf", "--skip-text", "--rotate-pages", "--deskew", str(source), str(ocr_output)],
            capture_output=True,
            text=True,
            timeout=900,
            check=False,
        )
        if result.returncode:
            message = result.stderr.strip()[-1000:] or "OCR processing failed."
            raise RuntimeError(message)
        source = ocr_output

    page_count = len(PdfReader(str(source)).pages)
    try:
        converter = Converter(str(source))
        try:
            converter.convert(str(output), start=0, end=None)
        finally:
            converter.close()
    except Exception as conversion_error:
        fallback_dir = output.parent / f"fallback-{output.stem}"
        fallback_dir.mkdir(exist_ok=True)
        try:
            result = subprocess.run(
                ["soffice", "--headless", "--convert-to", "docx", "--outdir", str(fallback_dir), str(source)],
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            fallback_output = fallback_dir / f"{source.stem}.docx"
            if result.returncode or not fallback_output.is_file():
                details = result.stderr.strip()[-500:] or result.stdout.strip()[-500:] or "LibreOffice did not produce a document."
                raise RuntimeError(details)
            shutil.move(str(fallback_output), str(output))
        except Exception as fallback_error:
            raise RuntimeError(f"PDF conversion failed. {str(fallback_error)[:250]}") from conversion_error
        finally:
            shutil.rmtree(fallback_dir, ignore_errors=True)
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError("The converter did not produce a Word document.")
    return page_count


@celery_app.task(name="app.worker.convert_job")
def convert_job(job_id: str, password: str = "") -> None:
    job = get_job(job_id)
    if not job:
        logger.warning("Job %s expired before conversion began", job_id)
        return

    set_job(job, "processing", 5, "Analyzing")
    job_dir = job_directory(job_id)
    outputs = []
    try:
        for index, file_info in enumerate(job["files"]):
            source = Path(file_info["path"])
            output = job_dir / f"{index}.docx"
            try:
                reader = PdfReader(str(source))
                if reader.is_encrypted and (not password or not reader.decrypt(password)):
                    raise PermissionError("This PDF is password-protected. Enter its password to continue.")
                set_job(job, "processing", 10 + round(index / max(len(job["files"]), 1) * 70), "Converting")
                pages = convert_to_docx(source, output, job["ocr"], password)
                outputs.append(
                    {
                        "name": f"{Path(file_info['name']).stem}.docx",
                        "size": output.stat().st_size,
                        "pages": pages,
                        "path": str(output),
                        "source_name": file_info["name"],
                        "error": None,
                    }
                )
            except PermissionError as exc:
                job["files"][index]["error"] = "password_required"
                set_job(job, "password_required", 0, "Password required", error=str(exc), outputs=outputs)
                return
            except SoftTimeLimitExceeded:
                set_job(job, "failed", 0, "Conversion timed out", error="This conversion took too long. Try a smaller or simpler PDF.", outputs=outputs)
                return
            except Exception as exc:
                logger.exception("Could not convert %s for job %s", source.name, job_id)
                outputs.append(
                    {
                        "name": f"{Path(file_info['name']).stem}.docx",
                        "size": 0,
                        "pages": 0,
                        "path": "",
                        "source_name": file_info["name"],
                        "error": friendly_error(exc),
                    }
                )

        if not outputs or all(item["error"] for item in outputs):
            details = next((item["error"] for item in outputs if item["error"]), "No files could be converted.")
            set_job(job, "failed", 0, "Conversion failed", error=details, outputs=outputs)
            return

        set_job(job, "ready", 100, "Ready", outputs=outputs, error=None)
    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        set_job(job, "failed", 0, "Conversion failed", error=friendly_error(exc), outputs=outputs)


@celery_app.task(name="app.worker.cleanup_expired_files")
def cleanup_expired_files() -> int:
    root = settings.storage_dir
    if not root.exists():
        return 0
    cutoff = datetime.now(timezone.utc).timestamp() - settings.file_ttl_seconds
    removed = 0
    for path in root.iterdir():
        try:
            created_marker = path / ".created" if path.is_dir() else None
            timestamp = created_marker.stat().st_mtime if created_marker and created_marker.is_file() else path.stat().st_mtime
            if path.is_dir() and timestamp < cutoff:
                shutil.rmtree(path)
                removed += 1
        except OSError:
            logger.exception("Could not remove expired storage path %s", path)
    return removed
