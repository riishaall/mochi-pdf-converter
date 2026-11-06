import asyncio
import logging
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings
from app.storage import delete_job, get_job, job_directory, redis_client, safe_filename, save_job
from app.worker import cleanup_expired_files, convert_job


logging.basicConfig(level=logging.INFO)
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://" if settings.local_dev else settings.redis_url)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    if not settings.local_dev:
        yield
        return

    async def clean_local_files() -> None:
        while True:
            await asyncio.sleep(60)
            await asyncio.to_thread(cleanup_expired_files.run)

    cleanup_task = asyncio.create_task(clean_local_files())
    try:
        yield
    finally:
        cleanup_task.cancel()
        await asyncio.gather(cleanup_task, return_exceptions=True)


app = FastAPI(title="PDF2Word Pro API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

MAX_FILES_PER_JOB = 10
PDF_SIGNATURE = b"%PDF-"


@app.get("/health")
async def health() -> dict[str, str]:
    if not settings.local_dev:
        try:
            redis_client.ping()
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Job service is unavailable.") from exc
    return {"status": "ok", "mode": "local" if settings.local_dev else "production"}


@app.post("/api/jobs")
@limiter.limit(settings.rate_limit)
async def create_job(
    request: Request,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    ocr: bool = Form(False),
    password: str = Form(""),
) -> dict:
    if not files or len(files) > MAX_FILES_PER_JOB:
        raise HTTPException(status_code=400, detail=f"Upload between 1 and {MAX_FILES_PER_JOB} PDFs at a time.")

    job_id = str(uuid.uuid4())
    directory = job_directory(job_id)
    directory.mkdir(parents=True, exist_ok=False)
    file_info = []
    total_bytes = 0
    try:
        for index, upload in enumerate(files):
            name = safe_filename(upload.filename or "document.pdf")
            if Path(upload.filename or "").suffix.lower() != ".pdf":
                raise HTTPException(status_code=415, detail=f"{name} is not a PDF file.")
            destination = directory / f"{index}.pdf"
            size = 0
            with destination.open("wb") as output:
                while chunk := await upload.read(1024 * 1024):
                    size += len(chunk)
                    total_bytes += len(chunk)
                    if size > settings.max_file_size:
                        raise HTTPException(status_code=413, detail=f"{name} exceeds the 50 MB per-file limit.")
                    output.write(chunk)
            if size < len(PDF_SIGNATURE):
                raise HTTPException(status_code=400, detail=f"{name} is empty or not a valid PDF.")
            with destination.open("rb") as source:
                if source.read(len(PDF_SIGNATURE)) != PDF_SIGNATURE:
                    raise HTTPException(status_code=415, detail=f"{name} does not contain a valid PDF signature.")
            file_info.append({"name": name, "size": size, "path": str(destination)})
            await upload.close()
        (directory / ".created").touch()
    except Exception:
        shutil.rmtree(directory, ignore_errors=True)
        raise

    now = datetime.now(timezone.utc).isoformat()
    job = {
        "id": job_id,
        "status": "queued",
        "state": "Analyzing",
        "progress": 0,
        "created_at": now,
        "updated_at": now,
        "ocr": ocr,
        "total_size": total_bytes,
        "files": file_info,
        "outputs": [],
        "error": None,
    }
    try:
        save_job(job)
        if settings.local_dev:
            background_tasks.add_task(convert_job.run, job_id, password)
        else:
            convert_job.delay(job_id, password)
    except Exception as exc:
        logging.exception("Could not enqueue job %s", job_id)
        delete_job(job_id)
        shutil.rmtree(directory, ignore_errors=True)
        raise HTTPException(status_code=503, detail="The conversion service is temporarily unavailable. Please try again shortly.") from exc
    return {"id": job_id, "status": job["status"], "state": job["state"]}


@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str) -> dict:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="This job has expired or does not exist.")
    return job


@app.post("/api/jobs/{job_id}/password")
@limiter.limit(settings.rate_limit)
async def retry_with_password(
    request: Request,
    background_tasks: BackgroundTasks,
    job_id: str,
    password: str = Form(...),
) -> dict:
    if not password or len(password) > 256:
        raise HTTPException(status_code=400, detail="Enter a valid PDF password.")
    job = get_job(job_id)
    if not job or job["status"] != "password_required":
        raise HTTPException(status_code=404, detail="This job cannot be retried.")
    job.update(status="queued", state="Analyzing", progress=0, error=None)
    for item in job["files"]:
        item.pop("error", None)
    try:
        save_job(job)
        if settings.local_dev:
            background_tasks.add_task(convert_job.run, job_id, password)
        else:
            convert_job.delay(job_id, password)
    except Exception as exc:
        logging.exception("Could not retry job %s", job_id)
        job.update(status="failed", state="Conversion failed", error="The conversion service is temporarily unavailable. Please try again shortly.")
        save_job(job)
        raise HTTPException(status_code=503, detail=job["error"]) from exc
    return {"id": job_id, "status": "queued", "state": "Analyzing"}


def checked_output(job_id: str, index: int) -> tuple[dict, dict]:
    if index < 0:
        raise HTTPException(status_code=404, detail="The converted file was not found.")
    job = get_job(job_id)
    if not job or job["status"] != "ready":
        raise HTTPException(status_code=404, detail="The converted file is not available.")
    try:
        output = job["outputs"][index]
    except (IndexError, TypeError):
        raise HTTPException(status_code=404, detail="The converted file was not found.")
    expected_parent = job_directory(job_id).resolve()
    path = Path(output["path"]).resolve()
    if output.get("error") or path.parent != expected_parent or not path.is_file():
        raise HTTPException(status_code=404, detail="The converted file is not available.")
    return output, job


@app.get("/api/jobs/{job_id}/download/{index}")
async def download_file(job_id: str, index: int) -> FileResponse:
    output, _ = checked_output(job_id, index)
    return FileResponse(output["path"], filename=output["name"], media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@app.get("/api/jobs/{job_id}/download-all")
async def download_all(job_id: str) -> FileResponse:
    job = get_job(job_id)
    if not job or job["status"] != "ready":
        raise HTTPException(status_code=404, detail="The converted files are not available.")
    zip_path = job_directory(job_id) / "converted-files.zip"
    try:
        with ZipFile(zip_path, "w", ZIP_DEFLATED) as archive:
            added = 0
            used_names: set[str] = set()
            for index, output in enumerate(job["outputs"]):
                if output.get("error"):
                    continue
                checked, _ = checked_output(job_id, index)
                archive_name = checked["name"]
                stem, suffix = Path(archive_name).stem, Path(archive_name).suffix
                duplicate = 2
                while archive_name.casefold() in used_names:
                    archive_name = f"{stem} ({duplicate}){suffix}"
                    duplicate += 1
                used_names.add(archive_name.casefold())
                archive.write(checked["path"], arcname=archive_name)
                added += 1
        if not added:
            raise HTTPException(status_code=404, detail="No converted files are available.")
    except HTTPException:
        raise
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Could not prepare the ZIP download.") from exc
    return FileResponse(zip_path, filename="pdf2word-converted-files.zip", media_type="application/zip")
