# WindSight UK — Wind Generation Observatory

WindSight UK is a web-based wind generation observatory for exploring UK wind power generation, historical analysis, forecast versions, and half-hourly delivery intervals. It provides a dashboard for comparing forecast predictions with actual generation data.

## Live Application

- **Frontend:** [WindSight UK — Vercel](https://qvntx-7k.vercel.app/)
- **Backend API:** [WindSight UK API — Render](https://qvntx-7k.onrender.com/)
- **API Health Check:** [Check API Status](https://qvntx-7k.onrender.com/health)
- **API Documentation:** [FastAPI Swagger UI](https://qvntx-7k.onrender.com/docs)

## Features

- Interactive dashboard for exploring wind generation data.
- Historical analysis of wind generation.
- Forecast horizon selection and forecast version exploration.
- Comparison of forecast predictions with actual generation.
- Half-hourly delivery interval analysis.
- FastAPI backend with REST endpoints and API documentation.
- Separate frontend and backend deployments.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| API communication | REST API |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## Project Structure

The repository is organized into frontend and backend components.

```text
qvntx-7k/
├── backend/
│   ├── app/
│   │   ├── analytics/       # Analytics-related modules
│   │   ├── api/             # API routes and endpoints
│   │   ├── schemas/         # Request and response schemas
│   │   ├── services/        # Application and data services
│   │   ├── __init__.py      # Python package initialization
│   │   ├── config.py        # Application configuration and settings
│   │   ├── exceptions.py    # Application exception handling
│   │   └── main.py          # FastAPI application entry point
│   ├── data/
│   │   └── cache/           # Cache directory
│   ├── scripts/             # Utility and data-processing scripts
│   ├── tests/               # Backend tests
│   ├── .dockerignore        # Docker build exclusions
│   ├── .env.example         # Example environment configuration
│   └── Dockerfile           # Backend container configuration
├── frontend/
│   ├── src/
│   │   └── services/
│   │       └── api.ts       # API communication service
│   ├── vercel.json          # Vercel deployment configuration
│   └── package.json         # Frontend dependencies and scripts
└── README.md                # Project documentation
```

## Prerequisites

Install the following tools before running the project locally:

- Python 3.11 or a version supported by the backend dependencies.
- Node.js and npm.
- Git.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Anushkarai3A/qvntx-7k.git
cd qvntx-7k
```

### 2. Start the Backend

Open a terminal and run:

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

Install the backend dependencies using the dependency file provided in the repository:

```bash
pip install -r requirements.txt
```

If the dependency file is located elsewhere, use its actual path.

Configure the required environment variables using the provided `.env.example` as a reference. Then start the FastAPI server from the `backend` directory:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend should be available at:

- API: `http://127.0.0.1:8000`
- API documentation: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### 3. Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create or configure the frontend environment file if required by the application. For local development, configure the API base URL to point to the local backend:

```text
VITE_API_URL=http://127.0.0.1:8000
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal, commonly `http://localhost:5173`.

> **Note:** The exact dependency installation and startup commands depend on the package and dependency files present in the repository. If the backend uses a different dependency manifest or application import path, follow that configuration.

## Deployment

The application is deployed as two separate services.

### Frontend — Vercel

The React and TypeScript frontend is hosted on Vercel.

[Open WindSight UK](https://qvntx-7k.vercel.app/)

### Backend — Render

The FastAPI backend is hosted on Render and exposes the API endpoints used by the frontend.

[Open Backend API](https://qvntx-7k.onrender.com/)

The frontend must be configured to use the deployed backend URL, and the backend CORS configuration must allow the deployed frontend origin.

## API Endpoints

The backend exposes health-check and API endpoints.

| Endpoint | Purpose |
|---|---|
| `/health` | Checks backend service status |
| `/docs` | Interactive API documentation |
| `/api/overview` | Retrieves overview data for the selected forecast horizon |

For additional endpoints, request parameters, and response schemas, refer to the [API documentation](https://qvntx-7k.onrender.com/docs).

## License

No license has been specified in this README. Add a license file if you intend to define how others may use, modify, or distribute the project.
