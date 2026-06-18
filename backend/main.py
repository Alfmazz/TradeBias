from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from analysis import analyze_ticker

app = FastAPI(title="TradeBias API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "TradeBias API is running"}


@app.get("/api/analyze/{ticker}")
def analyze(ticker: str, lang: str = "en"):
    ticker = ticker.strip().upper()

    if not ticker or len(ticker) > 12:
        raise HTTPException(status_code=400, detail="Invalid ticker symbol.")

    lang = lang if lang in ("en", "es") else "en"

    try:
        result = analyze_ticker(ticker, lang=lang)
    except Exception:
        raise HTTPException(status_code=500, detail="Something went wrong while analyzing this ticker. Please try again.")

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result