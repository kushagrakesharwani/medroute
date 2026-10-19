
from fastapi import FastAPI,Query
from fastapi.middleware.cors import CORSMiddleware

from hospital_service import load_hospitals, filter_eligible_hospitals, rank_hospitals
app = FastAPI(title="MedRoute API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "MedRoute API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/hospitals/recommend")
def recommend_hospitals(
    emergency_type: str = Query(..., description="Required emergency type")
):
    hospitals = load_hospitals()

    eligible, excluded = filter_eligible_hospitals(
        hospitals, emergency_type.lower()
    )

    ranked = rank_hospitals(eligible)

    return {
        "emergency_type": emergency_type.lower(),
        "recommendations": ranked,
        "excluded_hospitals": excluded,
        "simulated_data": True
    }
