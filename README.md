# Mochi Converter

Mochi Converter is a full-stack PDF-to-editable-Word website. Its React/Vite frontend uses a cream kitten mascot and a soft lavender-and-peach theme; the existing FastAPI API and Redis-backed Celery workers process uploads with `pdf2docx` and optional OCR. The tagline is “Soft, sweet Word files, in a paw-sec.”

> Conversion quality depends on the source PDF. Complex layouts can require a little cleanup in Word, and OCR quality depends on scan clarity.

## What’s included

- Drag-and-drop and multi-file upload (up to 10 PDFs, 50 MB each).
- Server-side PDF signature and size checks, filename sanitization, and IP-based rate limiting.
- Background conversion jobs with upload and conversion status polling.
- Optional OCR, password-protected PDF retry, individual DOCX downloads, and batch ZIP downloads.
- `pdf2docx` conversion with LibreOffice headless as a fallback.
- One-hour temporary file retention, with periodic cleanup via Celery Beat.
- Responsive React interface, reduced-motion support, keyboard-accessible controls, dark mode, session conversion history, and toast notifications.
- Privacy, terms, and contact routes; Open Graph metadata, `robots.txt`, and sitemap.
- Optional Google Analytics and AdSense integrations, disabled unless configured.
- Mochi mascot images generated as transparent, max-512px PNG and WebP copies, each under 150 KB. The original `photos/*.png` files stay unchanged.

The mascot asset pipeline runs automatically before each frontend production build. To regenerate optimized copies manually after adding images to the root `photos/` folder, run `npm --workspace frontend run optimize:mascots`. Docker builds copy `photos/` into the frontend build context; `.dockerignore` intentionally does not exclude it.

## Run locally with Docker Compose

Requirements: Docker Desktop (or Docker Engine) and Docker Compose v2.

From the project directory:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open Mochi Converter at [http://localhost:8080](http://localhost:8080). The API health check is at [http://localhost:8000/health](http://localhost:8000/health). Compose starts Redis, the API, a Celery worker with two concurrent processes, the cleanup scheduler, and the static frontend. Uploaded files and Redis data use named Docker volumes.

To stop the services, run `docker compose down`. To also remove all stored uploads and Redis state, run `docker compose down --volumes`; this permanently deletes those Docker volumes.

## Run without Docker

### Backend

The backend requires Python 3.11+, Redis, Tesseract (including the language data you need), `ocrmypdf`, and LibreOffice Writer for its production setup. For a quick local check on Windows, the API can run without Redis or a separately started worker; OCR still needs the Tesseract tools installed. Start the API:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:REDIS_URL = "redis://localhost:6379/0"
$env:LOCAL_DEV = "true"
$env:CORS_ORIGINS = "http://localhost:5173"
$env:STORAGE_DIR = "$PWD\data"
uvicorn app.main:app --reload --port 8000
```

In `LOCAL_DEV=true` mode, the API runs conversion jobs in its own background thread and keeps job state in memory. Do not use this mode for production or run multiple API instances with it. For the production queue, leave `LOCAL_DEV=false`, start Redis, and run a worker and the file-cleanup scheduler in separate terminals:

```powershell
celery -A app.worker.celery_app worker --loglevel=INFO --concurrency=2
celery -A app.worker.celery_app beat --loglevel=INFO
```

### Frontend

```powershell
cd frontend
npm install
$env:VITE_API_URL = "http://localhost:8000"
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `REDIS_URL` | Redis broker and job-state store | `redis://redis:6379/0` in Compose |
| `CORS_ORIGINS` | Comma-separated, exact allowed frontend origins | `http://localhost:5173` |
| `STORAGE_DIR` | Temporary upload and conversion directory | `/data` |
| `RATE_LIMIT` | Per-IP API rate limit for job creation and password retry | `20/minute` |
| `VITE_API_URL` | Public base URL of the FastAPI service, set at frontend build time | `http://localhost:8000` |
| `VITE_GA_ID` | Optional Google Analytics measurement ID | unset |
| `VITE_ADSENSE_CLIENT_ID` | Optional AdSense publisher client ID | unset |
| `VITE_ADSENSE_SLOT_ID` | Optional AdSense responsive ad slot | unset |

Set `CORS_ORIGINS` to the exact HTTPS frontend origin(s) in production. Do not use `*` for a public deployment. The API does not terminate TLS; put it behind an HTTPS load balancer or reverse proxy and set `VITE_API_URL` to its HTTPS URL.

The sitemap and canonical Open Graph URL use `https://mochiconverter.com`. Update these URLs in `frontend/public/sitemap.xml`, `frontend/public/robots.txt`, and `frontend/index.html` if your production domain differs.

## Production deployment

### Frontend on Vercel

1. Import the repository and set the project root to `frontend` (or configure the root `npm` workspace).
2. Use `npm install` as the install command and `npm run build` as the build command; the output directory is `dist`.
3. Add `VITE_API_URL` with the public HTTPS URL for the separately deployed API.
4. Optionally add `VITE_GA_ID`, `VITE_ADSENSE_CLIENT_ID`, and `VITE_ADSENSE_SLOT_ID`.
5. Add the deployed Vercel origin to the backend's `CORS_ORIGINS`. The included `frontend/vercel.json` sends SPA routes to `index.html`.

Vite's output is static; configure equivalent SPA route rewrites if you use a different frontend host.

### Backend on Render, Railway, or a VPS

Deploy `backend/Dockerfile` as the API service and run the same image separately for:

- API: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Worker: `celery -A app.worker.celery_app worker --loglevel=INFO --concurrency=2`
- Scheduler: `celery -A app.worker.celery_app beat --loglevel=INFO`

Provision Redis and configure `REDIS_URL`, `CORS_ORIGINS`, and `STORAGE_DIR=/data` consistently on all three services. The API and worker must share the same persistent filesystem mounted at `/data`; otherwise a worker's output cannot be downloaded by the API. Run one Beat scheduler. Use a managed Redis instance or restrict Redis to the private service network, and terminate HTTPS at the platform proxy. Set an appropriate persistent-disk policy for temporary file storage. Keep the `pdf_data` disk isolated from application code and backups because its contents are user uploads.

For a single VPS, `docker compose up -d --build` is a convenient starting point. Put a TLS-enabled reverse proxy such as Caddy or Traefik in front of the frontend and API; expose only the proxy publicly, use a private network for Redis, and set production origins and frontend build variables before building.

## Tests and builds

```powershell
cd backend
pip install -r requirements.txt
$env:PYTHONPATH = "."
pytest
```

```powershell
cd frontend
npm install
npm run build
```

## Operational and privacy notes

- PDFs are stored in a per-job directory with a random UUID. Output endpoints validate the job, index, and resolved storage path before serving a file.
- Job metadata has a one-hour expiry from job creation; Celery Beat removes corresponding files at approximately the one-hour mark (within the cleanup interval).
- Configure HTTPS at the edge for production. Local Compose uses HTTP for development.
- Do not upload documents you are not authorized to process. Avoid sending confidential files to third-party analytics or ad integrations.
- OCR currently uses Tesseract's English language data in the provided container. Add the appropriate `tesseract-ocr-<language>` packages to `backend/Dockerfile` if you need additional languages.
- The contact route provides product-support guidance; update its contact addresses in `frontend/src/App.jsx` to the support channels you operate before launch.
