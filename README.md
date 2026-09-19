# URLShield

URLShield is a phishing intelligence dashboard that combines a Python FastAPI backend with a Vite + React frontend. It lets users analyze URLs, inspect evidence, monitor jobs, and review ML-based phishing risk signals.

## Overview

- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI + background worker
- ML: XGBoost-based phishing model
- Data: local queue and artifact storage under the backend project
- Default API key: `dev-secret-key`
- Default API base URL: `http://localhost:8080`

## Project Structure

```text
URLShield/
├── .venv/                              # Python environment for the project
├── README.md                           # Project overview and setup guide
├── URLshield-backend/
│   ├── config/                         # configuration files and keywords
│   ├── data/                           # queue, running, done, error, example output data
│   ├── docs/                           # documentation files
│   ├── example/                        # sample scripts and batch upload examples
│   ├── mini_backend/                   # lightweight backend area for mini-service work
│   ├── models/                         # trained ML model artifacts
│   ├── scripts/                        # deployment and install helper scripts
│   ├── templates/                      # brand template metadata
│   ├── venv/                           # local backend virtual environment
│   └── URLshield/
│       ├── __init__.py
│       ├── api.py                     # FastAPI API routes
│       ├── batch_exporter.py          # export utilities
│       ├── batch_processor.py         # batch job processing
│       ├── config.py                 # settings and API config
│       ├── feature_extraction.py     # feature extraction logic
│       ├── keyword_config.py         # keyword setup
│       ├── logger.py                 # logging
│       ├── main.py                   # backend app startup
│       ├── ml_feature_prep.py        # feature preparation
│       ├── model_feature_provider.py # model features provider
│       ├── models.py                 # Pydantic request/response models
│       ├── predictor.py              # ML model availability and prediction
│       ├── queue.py                  # local queue implementation
│       ├── scraper.py                # browser scraping logic
│       ├── template_manager.py       # templates
│       ├── url_analyzer.py           # URL analysis logic
│       ├── utils.py                 # helpers
│       ├── worker.py                 # background worker
│       ├── XGBoost.py                # training / model code
│       ├── xgboost_training.py       # training utilities
│       └── ...
├── URLshield-frondend/
│   ├── public/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── ...
└──
```

## Requirements

- Python 3.10+
- Node.js 18+
- npm
- Windows PowerShell or bash shell
- Optional: Playwright browser dependencies for scraping screenshots

## Running the Project

### 1) Backend

Open PowerShell in the project root and run:

```powershell
cd URLshield-backend
$env:PYTHONPATH = "$PWD"
python -m URLshield.main
```

If the project is using the local backend venv specifically:

```powershell
cd URLshield-backend
$env:PYTHONPATH = "$PWD"
.\venv\Scripts\python.exe -m URLshield.main
```

The backend listens on:

- `http://localhost:8080`
- API key default: `dev-secret-key`

### 2) Frontend

In a second terminal:

```powershell
cd URLshield-frondend
npm install
npm run dev -- --host 0.0.0.0
```

The frontend is usually served at:

- `http://localhost:5173`

## Health Check

To validate the backend:

```powershell
Invoke-WebRequest -UseBasicParsing 'http://localhost:8080/health' -Headers @{ 'X-API-Key' = 'dev-secret-key' }
```

You should receive an HTTP 200 response.

## Authentication

Most API calls require the custom `X-API-Key` header. The default development key is:

```text
dev-secret-key
```

If the frontend shows an “Invalid API key” message, check that the browser is not holding stale local storage values and that the backend is running with the same key.

## Common Commands

### Frontend build

```powershell
cd URLshield-frondend
npm run build
```

### Frontend lint

```powershell
cd URLshield-frondend
npm run lint
```

## Notes

- The main backend is the active app for URL analysis and worker tasks.
- The project includes a `mini_backend/` folder for a lighter service model if needed.
- Model artifacts are expected under `URLshield-backend/models/`.
- If model availability is reported as false, verify the files exist and the backend can access them.

## Default Development Setup

This project is designed to run with:

- Frontend on `localhost:5173`
- Backend on `localhost:8080`
- Shared API key `dev-secret-key`

This is the simplest local setup for running and testing the project in development.
# URLShield
