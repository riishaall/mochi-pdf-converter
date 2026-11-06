import json
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from uuid import UUID

import redis

from app.config import settings


redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
_local_jobs: dict[str, tuple[float, dict]] = {}
_local_jobs_lock = RLock()


def job_key(job_id: str) -> str:
    return f"job:{UUID(job_id)}"


def get_job(job_id: str) -> dict | None:
    try:
        key = job_key(job_id)
    except (TypeError, ValueError):
        return None
    if settings.local_dev:
        with _local_jobs_lock:
            entry = _local_jobs.get(key)
            if not entry:
                return None
            expires_at, job = entry
            if expires_at <= datetime.now(timezone.utc).timestamp():
                _local_jobs.pop(key, None)
                return None
            return json.loads(json.dumps(job))
    value = redis_client.get(key)
    return json.loads(value) if value else None


def save_job(job: dict) -> None:
    created = datetime.fromisoformat(job["created_at"])
    elapsed = (datetime.now(timezone.utc) - created).total_seconds()
    key = job_key(job["id"])
    expiry = max(1, int(settings.file_ttl_seconds - elapsed))
    if settings.local_dev:
        with _local_jobs_lock:
            _local_jobs[key] = (datetime.now(timezone.utc).timestamp() + expiry, json.loads(json.dumps(job)))
    else:
        redis_client.set(key, json.dumps(job), ex=expiry)


def delete_job(job_id: str) -> None:
    key = job_key(job_id)
    if settings.local_dev:
        with _local_jobs_lock:
            _local_jobs.pop(key, None)
    else:
        redis_client.delete(key)


def safe_filename(name: str) -> str:
    basename = Path(name.replace("\\", "/")).name.replace("\x00", "")
    stem = Path(basename).stem
    safe_stem = re.sub(r"[^A-Za-z0-9._ -]", "_", stem).strip(" .")[:120] or "document"
    return f"{safe_stem}.pdf"


def job_directory(job_id: str) -> Path:
    return settings.storage_dir / str(UUID(job_id))
