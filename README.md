# WindSight UK — Wind Generation Observatory

## Overview

WindSight UK is a full-stack web application for exploring UK wind power generation, historical data, and forecast predictions. It provides an interactive dashboard for analysing forecast horizons, forecast versions, and half-hourly delivery intervals.

## Live Deployment

- **Frontend:** https://qvntx-7k.vercel.app/
- **Backend API:** https://qvntx-7k.onrender.com/
- **API Health Check:** https://qvntx-7k.onrender.com/health
- **Interactive API Documentation:** https://qvntx-7k.onrender.com/docs

## Technology Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **API:** REST
- **Containerization:** Docker
- **Frontend Hosting:** Vercel
- **Backend Hosting:** Render

## Features

- Interactive wind generation dashboard
- Historical generation analysis
- Forecast horizon and forecast version exploration
- Forecast and actual generation comparison
- Half-hourly delivery interval analysis
- REST API for retrieving application data
- API health-check endpoint
- Containerized backend deployment

## Project Structure

```text
qvntx-7k/
├── backend/
│   ├── app/
│   │   ├── analytics/       # Analytics modules
│   │   ├── api/             # API routes and endpoints
│   │   ├── schemas/         # API request and response schemas
│   │   ├── services/        # Data and analysis services
│   │   ├── config.py        # Application settings and CORS configuration
│   │   ├── exceptions.py    # Exception handling
│   │   └── main.py          # FastAPI application entry point
│   ├── data/
│   │   └── cache/           # Cached data
│   ├── scripts/             # Utility scripts
│   ├── tests/               # Backend tests
│   ├── .env.example         # Example environment configuration
│   └── Dockerfile           # Backend container definition
├── frontend/
│   ├── src/                 # React and TypeScript source code
│   │   └── services/
│   │       └── api.ts       # API communication
│   ├── package.json         # Frontend dependencies and scripts
│   └── vercel.json          # Vercel deployment configuration
└── README.md
```

## Prerequisites

Install the following tools:

- Git
- Python
- Node.js and npm
- Docker Desktop or Docker Engine with Docker Compose

## Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/Anushkarai3A/qvntx-7k.git
cd qvntx-7k
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows:**

```powershell
.venv\Scripts\activate
```

**macOS/Linux:**

```bash
source .venv/bin/activate
```

Install the dependencies using the backend's actual dependency manifest. If `requirements.txt` is present:

```bash
pip install -r requirements.txt
```

Configure the required environment variables based on `.env.example`, then start the server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at:

- API: http://localhost:8000
- API documentation: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### 3. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create a local `.env` file if required and configure the API base URL:

```text
VITE_API_URL=http://localhost:8000
```

Start the Vite development server:

```bash
npm run dev
```

Open the local URL displayed by Vite, usually http://localhost:5173.

## Run with Docker

The backend includes a Dockerfile for containerized execution.

From the repository root, build the backend image:

```bash
docker build -t windsight-backend ./backend
```

Run the container:

```bash
docker run --rm -p 8000:8000 windsight-backend
```

Open http://localhost:8000/docs to access the API documentation.

If a root-level `docker-compose.yml` is included in the repository and configured for both services, the entire application can be started using:

```bash
docker compose up --build
```

Stop the services with:

```bash
docker compose down
```

## Deployment

The application uses separate frontend and backend deployments.

### Frontend

The React application is deployed on Vercel:

https://qvntx-7k.vercel.app/

### Backend

The FastAPI service is deployed on Render:

https://qvntx-7k.onrender.com/

The frontend API configuration and backend CORS settings must be configured for the deployed domains.

## AI Tools Disclosure

**AI tools were used as development assistance during this project.** They helped with code troubleshooting, debugging deployment issues, understanding configuration errors, and preparing technical documentation. The application was integrated and tested through the development and deployment workflow.

AI tools were used as an aid; they do not replace the application's implementation, testing, or verification.
