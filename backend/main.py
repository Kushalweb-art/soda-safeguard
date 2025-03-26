
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging
from dotenv import load_dotenv

from app.database import create_tables
from app.routes import postgres_router, dataset_router, validation_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables on startup
    create_tables()
    logger.info("Database tables created")
    yield
    # Clean up resources if needed
    logger.info("Application shutting down")

app = FastAPI(
    title="Data Validator API",
    description="Backend API for the Data Validator application",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS with settings from environment
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
if not allowed_origins or allowed_origins[0] == "":
    allowed_origins = [
        "http://localhost:3000",
        "https://localhost:3000",
        "http://localhost:5173",  # Vite dev server
        "https://localhost:5173",
        "http://127.0.0.1:5173",
        "https://127.0.0.1:5173",
        "http://localhost:5174",  # Another common Vite port
        "https://localhost:5174",
        "http://127.0.0.1:5174",
        "https://127.0.0.1:5174",
        "http://localhost:8080",  # Added for current Vite server
        "https://localhost:8080",
        "http://127.0.0.1:8080",  # Added for current Vite server
        "https://127.0.0.1:8080",
        "http://localhost",
        "https://localhost",
        "http://127.0.0.1",
        "https://127.0.0.1",
    ]

logger.info(f"Configuring CORS with allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(postgres_router, prefix="/api/postgres", tags=["PostgreSQL Connections"])
app.include_router(dataset_router, prefix="/api/datasets", tags=["CSV Datasets"])
app.include_router(validation_router, prefix="/api/validation", tags=["Validation"])

@app.get("/")
async def root():
    return {"message": "Welcome to the Data Validator API"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "api": "online"}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    client_host = request.client.host if request.client else "unknown"
    logger.info(f"Received request: {request.method} {request.url.path} from {client_host}")
    origin = request.headers.get('origin')
    logger.info(f"Headers: Origin: {origin}")
    protocol = "https" if request.url.scheme == "https" else "http"
    logger.info(f"Protocol: {protocol}")
    
    try:
        response = await call_next(request)
        logger.info(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request error: {str(e)}")
        raise

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
