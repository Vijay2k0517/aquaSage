# AquaSage — IBM LinuxONE Deployment & Operational Runbook

## 1. Architecture & Supported Runtime

| Component | Target Specification |
| :--- | :--- |
| **Compute Architecture** | `s390x` (IBM LinuxONE Emperor 4, Rockhopper 4, IBM z16) |
| **Operating System** | Red Hat Enterprise Linux (RHEL) 9.x / Ubuntu 22.04 LTS / SUSE SLES 15 SP5 |
| **Container Engine** | Podman 4.4+ / Docker Engine 24.0+ with Buildx |
| **Language Runtime** | Python 3.11.9 (`python:3.11-slim-bookworm` base image) |
| **ML Framework** | IBM Snap ML v1.15.6 with OpenMP multi-threading acceleration |
| **Deep Learning** | PyTorch 2.2.2 (CPU build for s390x) |
| **Web Server** | Uvicorn ASGI with 4 worker processes behind reverse proxy (Nginx / HAProxy) |
| **Database** | PostgreSQL 16 (Relational state, users, predictions, telemetry) |
| **Cache & Real-time** | Redis 7.2 (Pub/Sub for sensor feeds, rate-limiting, session state) |

---

## 2. Dependency Lock & Snap ML Compatibility

IBM Snap ML (`snapml`) provides GPU and CPU hardware-accelerated training and inference for tree ensembles, linear models, and boosting algorithms. On IBM LinuxONE (s390x), Snap ML leverages SIMD instructions and IBM Z Vector Extension Facility (SIMD).

> [!IMPORTANT]
> **NumPy ABI Pinned Dependency**: Snap ML v1.15.6 C-extension binaries are compiled against the NumPy 1.x C-API. In environments running NumPy 2.x, importing Snap ML triggers `AttributeError: _ARRAY_API not found`. Therefore, the production dependency lock strictly pins `numpy==1.26.4`.

### Installation in s390x Linux Environment
```bash
# Update system dependencies for s390x compilation
sudo apt-get update && sudo apt-get install -y \
    build-essential libgomp1 libopenblas-dev libpq-dev curl

# Create and activate Python 3.11 virtualenv
python3.11 -m venv /opt/aquasage/venv
source /opt/aquasage/venv/bin/activate

# Install LinuxONE locked dependencies
pip install --upgrade pip
pip install -r deploy/linuxone/requirements-linuxone.txt
```

---

## 3. Production Configuration (.env)

Configuration is managed strictly through environment variables. Secrets must never be committed to source control.

Copy the template from `deploy/linuxone/.env.linuxone.example` to `.env`:

```bash
cp deploy/linuxone/.env.linuxone.example .env
chmod 600 .env
```

Key environment settings:
- `ENVIRONMENT=production`
- `SECRET_KEY`: 64-character hexadecimal string (`openssl rand -hex 32`).
- `DATABASE_URL`: Async PostgreSQL connection string (`postgresql+asyncpg://user:pass@host:5432/db`).
- `REDIS_URL`: Redis connection string (`redis://redis:6379/0`).
- `SIMULATOR_MODE=false`: Disables hardware simulation mode for live ESP32 telemetry ingestion.
- `OMP_NUM_THREADS=4`: Dedicated OpenMP thread count for Snap ML vectorization.
- `AQUASAGE_MODEL_PATH=/app/models/future_risk_model.joblib`: Path to serialized future-event risk model.

---

## 4. Containerized Deployment (Docker / Podman on LinuxONE)

### Step 1: Multi-Architecture Build
Build the container image using Buildx targeting `linux/s390x`:

```bash
docker buildx build \
  --platform linux/s390x \
  -f deploy/linuxone/Dockerfile.linuxone \
  -t aquasage-backend:linuxone-latest \
  --load .
```

### Step 2: Launch Stack via Docker Compose
```bash
cd deploy/linuxone
docker compose -f docker-compose.linuxone.yml up -d
```

### Step 3: Run Database Migrations
```bash
docker compose -f docker-compose.linuxone.yml exec aquasage-api alembic upgrade head
```

---

## 5. Health and Readiness Checks

The backend provides two distinct endpoints for container orchestrators (Kubernetes / OpenShift / Docker Swarm):

### Liveness Probe
```http
GET /api/v1/health
```
- **Response**: `{"status": "healthy", "database": "connected", "redis": "connected"}`
- **Purpose**: Verifies that the ASGI event loop and network connectivity are operational.

### Readiness Probe
```http
GET /api/v1/health/ready
```
- **Response**:
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected",
  "predictive_model_loaded": true,
  "predictive_model_path": "/app/models/future_risk_model.joblib",
  "model_version": "1.0.0-snapml-rf"
}
```
- **Purpose**: Verifies that the database connection is alive AND the serialized predictive ML model artifact is loaded and ready to serve inference requests without traffic rejection.

---

## 6. Model Artifacts, Storage, and Provenance

| Artifact | Location | Source / Pipeline | Output Shape / Version |
| :--- | :--- | :--- | :--- |
| **Future Risk Classifier** | `/app/models/future_risk_model.joblib` | `src/models/snapml_risk_predictor.py` | 100 Trees, 10 Causal Features, $H=6\text{h}$ |
| **LSTM Anomaly Detector** | `/app/phase3a/models/lstm_predictor.pth` | `phase3a/train_lstm.py` | Hidden Size: 32, Layers: 2, PyTorch |
| **Feature Scaler** | Included in `future_risk_model.joblib` | `StandardScaler` (Fit on Train 2022-2024) | Mean/Variance across 10 features |
| **Evaluation Audit** | `/app/reports/predictive_risk_evaluation.json` | Chronological Evaluation | Test PR-AUC: 0.7451, F1: 0.7946 |
| **Data Audit** | `/app/reports/data_preparation_audit.json` | `src/preprocessing/data_pipeline.py` | 6 DMAs processed, 0 corrupted |

Model updates must be staged into a persistent read-only volume (`/app/models:ro`) and trigger a graceful rolling restart of the Uvicorn workers.

---

## 7. Operating Modes: Simulator vs. Live Sensor Mode

AquaSage enforces a strict dichotomy between bench simulation and live telemetry:

1. **Live Sensor Mode (`SIMULATOR_MODE=false`)**:
   - Ingests direct JSON payloads from physical ESP32 microcontrollers over HTTP POST `/api/v1/sensor-data` or MQTT.
   - Dual YF-S201 flow sensors and HC-SR04 ultrasonic readings are treated as actual measurements.
   - 15-second freshness guard rejects stale sensor telemetry (`is_stale = true`).

2. **Simulator Demonstration Mode (`SIMULATOR_MODE=true`)**:
   - Displays clear `[SIMULATED DEMO]` badges in the UI (specifically for Acoustic Leak Pinpointing and Motor Overhaul Prognostics).
   - Injects controlled hydraulic perturbations (e.g., pinched suction tubing, simulated pulse jitter).
   - Injected readings are explicitly flagged with `is_simulated = true` in database records and API payloads to prevent pollution of operational audits.

---

## 8. Verification Status & Deployment Checklist

### Validated in Current Work Environment (Windows x86_64)
- [x] Full historical data preparation pipeline (all 6 DMAs sorted, deduplicated, and interpolated).
- [x] Causal feature engineering with strict chronological boundary enforcement (Train $\to$ Val $\to$ Test).
- [x] Model training, calibration, and evaluation (Baseline vs Logistic Regression vs Tree Ensemble).
- [x] Backend API endpoints (`/api/v1/ai/future-risk/{tank_id}`, `/api/v1/health/ready`).
- [x] Automated test suite passing: 81 backend tests + 33 prototype tests = **114/114 passed (100%)**.
- [x] Frontend TypeScript type check: `npx tsc --noEmit` passed with 0 errors.
- [x] Frontend UI integration with `FutureRiskPredictionCard` and freshness handling.

### Items Requiring Verification on IBM LinuxONE On-Metal Hardware
- [ ] Direct execution on IBM LinuxONE Community Cloud or an on-premises IBM z16 LPAR.
- [ ] Native `snapml` wheel execution compiled against Linux `s390x` Vector Facility vs scikit-learn fallback.
- [ ] Production latency benchmarking of Snap ML multi-threaded OpenMP inference under sustained 1,000 req/sec load.
- [ ] Physical ESP32 hardware telemetry ingestion in the field.
