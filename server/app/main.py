from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.services import openai_service
from app.api import chat, auth, admin, pdf
from dotenv import load_dotenv
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load env variables
load_dotenv(dotenv_path=".env.development.local")

# Add middleware for formatting request logs
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        body = await request.body()
        print(f"--- Incoming Request ---")
        print(f"URL: {request.url}")
        print(f"Method: {request.method}")
        print(f"Headers: {dict(request.headers)}")
        response = await call_next(request)
        print(f"--- End Request ---\n")
        return response

# Properly create the lifespan of this fastapi app
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting up the FastAPI application.")
    
    # Initialize services
    app.state.openai_client = openai_service.OpenAIService(api_key=os.getenv("OPENAI_KEY"))
    yield
    
    # Shutdown actions
    logger.info("Shutting down the FastAPI application.")

# Create app instance
app = FastAPI(lifespan=lifespan)

# CORS configuration for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LoggingMiddleware)

# Include routers
app.include_router(chat.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(pdf.router)

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "CFCI Innovation Intake API is running"}

