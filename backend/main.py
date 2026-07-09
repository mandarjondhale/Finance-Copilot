"""
main.py — FinCopilot API
========================
All core analysis is LLM-free.
Gemini is an optional /summarize endpoint used only if you want
a natural language paragraph. The app works 100% without it.
"""

import os
import io
import pandas as pd
import yfinance as yf
from datetime import date
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, File, UploadFile, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from data_fetcher import (
    full_stock_analysis,
    get_price_data,
    get_mf_nav,
    get_mf_details,
    get_fundamentals,      
    get_piotroski_score    
)
from broker_service import BrokerService


app = FastAPI(title="FinCopilot API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ──────────────────────────────────────────────────────────

class TickerRequest(BaseModel):
    ticker: str

class MFRequest(BaseModel):
    query: str

class MFDetailRequest(BaseModel):
    scheme_code: int

class SummarizeRequest(BaseModel):
    ticker: str
    analysis_data: dict   # pass the full_stock_analysis result

class UserLoginRequest(BaseModel):
    name: str = ""
    email: str
    password: str

class BrokerLoginRequest(BaseModel):
    redirect_uri: str

class BrokerCallbackRequest(BaseModel):
    request_token: str
    redirect_uri: str


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise Exception("SUPABASE_URL or SUPABASE_KEY is missing in your .env file!")
    return create_client(url, key)

def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ")[1]
    sb = get_supabase()
    try:
        user_response = sb.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="User not found in Supabase")
        return user_response.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")



# ── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "FinCopilot API v3",
        "note": "Core analysis is LLM-free. /summarize uses Gemini optionally.",
    }


@app.post("/api/stock/analyze")
def analyze_stock(req: TickerRequest):
    """
    Full stock analysis — price, fundamentals, technicals, Piotroski score.
    NO LLM. No token limits. No API key needed beyond Yahoo Finance (free).
    """
    ticker = req.ticker.upper().strip()
    if "." not in ticker:
        ticker += ".NS"
    try:
        result = full_stock_analysis(ticker)
        if "error" in result:
            raise HTTPException(400, result["error"])
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/api/stock/price/{ticker}")
def get_price(ticker: str):
    """
    Just price data — instant, no LLM, great for live refresh.
    """
    ticker = ticker.upper()
    if "." not in ticker:
        ticker += ".NS"
    try:
        return {"success": True, "data": get_price_data(ticker)}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/mf/search")
def search_mf(req: MFRequest):
    """Search mutual funds by name — AMFI API, free, no key."""
    try:
        results = get_mf_nav(req.query)
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/auth/signup")
def signup(req: UserLoginRequest):
    sb = get_supabase()
    try:
        # Create auth user and save their name in Supabase metadata
        sb.auth.sign_up({
            "email": req.email, 
            "password": req.password,
            "options": {
                "data": {"name": req.name}
            }
        })
        return {"success": True, "data": {"name": req.name, "email": req.email}}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/auth/login")
def login(req: UserLoginRequest):
    sb = get_supabase()
    try:
        result = sb.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password,
        })
        
        # Extract the saved name directly from Supabase
        user_data = result.user.user_metadata or {}
        user_name = user_data.get("name", "")
        
        return {
            "success": True,
            "data": {"name": user_name, "email": req.email},
            "token": result.session.access_token,
        }
    except Exception as e:
        raise HTTPException(401, "Invalid email or password")

@app.post("/api/auth/logout")
def logout():
    sb = get_supabase()
    sb.auth.sign_out()
    return {"success": True}

@app.post("/api/mf/details")
def mf_details(req: MFDetailRequest):
    """Get full NAV history and returns for a mutual fund."""
    try:
        result = get_mf_details(req.scheme_code)
        if "error" in result:
            raise HTTPException(400, result["error"])
        return {"success": True, "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/api/stock/summarize")
def summarize_with_ai(req: SummarizeRequest):
    """
    OPTIONAL — uses Gemini to write a 3-sentence plain-language summary.
    Only called if GEMINI_API_KEY is set. App works without this.
    Token usage: ~200 tokens per call (tiny).
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        return {
            "success": True,
            "summary": None,
            "note": "Set GEMINI_API_KEY in .env to enable AI summaries.",
        }

    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        d = req.analysis_data
        verdict = d.get("verdict", {})
        fin = d.get("fundamentals", {})
        price = d.get("price", {})
        piotroski = d.get("piotroski", {})
        tech = d.get("technicals", {})

        prompt = f"""Write exactly 3 sentences summarizing this Indian stock for a retail investor.
Be specific, use the numbers, keep plain language. No jargon.

Stock: {d.get('company_name')} ({req.ticker})
Overall verdict: {verdict.get('overall')}
P/E: {fin.get('pe_ratio')} | ROE: {fin.get('roe_pct')}% | D/E: {fin.get('debt_to_equity')}
Revenue growth: {fin.get('revenue_growth_yoy_pct')}% | Net margin: {fin.get('net_margin_pct')}%
1Y price change: {price.get('change_1y_pct')}%
Piotroski F-Score: {piotroski.get('score')}/9
Technical score: {tech.get('technical_score')}/100
Positives: {', '.join(verdict.get('flags', [])[:3])}
Warnings: {', '.join(verdict.get('warnings', [])[:3])}

3 sentences only. End with what type of investor this suits."""

        response = model.generate_content(prompt)
        return {"success": True, "summary": response.text.strip()}

    except Exception as e:
        return {"success": True, "summary": None, "error": str(e)}


@app.post("/api/portfolio/upload")
async def upload_csv(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    email = current_user.email
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        # Standardize matching to support Zerodha, Angel One, Groww, Upstox column names
        ticker_col = next((c for c in df.columns if any(x in c.lower() for x in ['ticker', 'symbol', 'instrument', 'company name', 'stock', 'tradingsymbol'])), None)
        shares_col = next((c for c in df.columns if any(x in c.lower() for x in ['share', 'qty', 'quantity'])), None)
        price_col  = next((c for c in df.columns if any(x in c.lower() for x in ['price', 'cost', 'buy', 'average', 'avg'])), None)


        if not ticker_col:
            raise HTTPException(400, "Could not find a 'Ticker' or 'Symbol' column in the CSV.")

        results = []
        sector_allocations = {}
        total_portfolio_value = 0
        total_weighted_pe = 0
        total_weighted_fscore = 0

        # Process up to 25 rows
        for _, row in df.head(25).iterrows():
            sym = str(row[ticker_col]).strip().upper()
            if not sym or sym == 'NAN': continue
            
            shares = float(row[shares_col]) if shares_col and pd.notna(row[shares_col]) else 0
            buy_price = float(row[price_col]) if price_col and pd.notna(row[price_col]) else 0

            # 1. Fetch Bulletproof Price
            current_price = 0
            query_sym = sym if "." in sym else sym + ".NS"
            
            for s in ([sym] if "." in sym else [sym, sym + ".NS"]):
                try:
                    hist = yf.Ticker(s).history(period="5d")
                    if not hist.empty:
                        current_price = float(hist["Close"].iloc[-1])
                        query_sym = s
                        break
                except Exception:
                    continue

            # 2. Fetch Deep Analytics (Sectors, P/E, Piotroski)
            fund = {}
            pio = {}
            try:
                fund = get_fundamentals(query_sym)
                pio = get_piotroski_score(query_sym)
            except Exception:
                pass

            sector = fund.get("sector", "Unknown") if isinstance(fund, dict) else "Unknown"
            pe_ratio = fund.get("pe_ratio") if isinstance(fund, dict) and fund.get("pe_ratio") else 0
            f_score = pio.get("score") if isinstance(pio, dict) and pio.get("score") else 0

            # 3. Calculate Math
            invested = shares * buy_price
            current_value = shares * current_price
            pnl = current_value - invested if invested > 0 else 0
            pnl_pct = (pnl / invested * 100) if invested > 0 else 0

            # Aggregate allocations
            if current_value > 0:
                sector_allocations[sector] = sector_allocations.get(sector, 0) + current_value
                total_portfolio_value += current_value
                total_weighted_pe += (pe_ratio * current_value)
                total_weighted_fscore += (f_score * current_value)

            results.append({
                "ticker": sym,
                "shares": shares,
                "buy_price": buy_price,
                "current_price": current_price,
                "invested": invested,
                "current_value": current_value,
                "pnl": pnl,
                "pnl_pct": pnl_pct,
                "sector": sector,
                "pe_ratio": pe_ratio,
                "f_score": f_score
            })

        # Calculate final portfolio health metrics
        avg_pe = (total_weighted_pe / total_portfolio_value) if total_portfolio_value > 0 else 0
        avg_fscore = (total_weighted_fscore / total_portfolio_value) if total_portfolio_value > 0 else 0
        
        # Convert sector values to percentages
        for s in sector_allocations:
            sector_allocations[s] = round((sector_allocations[s] / total_portfolio_value) * 100, 1)

        # --- NEW: Save Daily Snapshot to Supabase ---
        try:
            sb = get_supabase()
            today_str = date.today().isoformat()
            
            # Check if we already saved a snapshot today
            existing = sb.table("portfolio_snapshots").select("*").eq("user_email", email).eq("snapshot_date", today_str).execute()
            
            total_current_value = sum(r["current_value"] for r in results)
            total_invested_val = sum(r["invested"] for r in results)
            total_pnl_val = sum(r["pnl"] for r in results)

            if existing.data:
                # Update today's existing snapshot
                sb.table("portfolio_snapshots").update({
                    "total_value": total_current_value,
                    "total_invested": total_invested_val,
                    "total_pnl": total_pnl_val
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                # Insert a new snapshot for today
                sb.table("portfolio_snapshots").insert({
                    "user_email": email,
                    "snapshot_date": today_str,
                    "total_value": total_current_value,
                    "total_invested": total_invested_val,
                    "total_pnl": total_pnl_val
                }).execute()
        except Exception as e:
            print(f"Failed to save snapshot: {e}") # Fails silently so it doesn't break the upload
        
        return {
            "success": True, 
            "data": {
                "stocks": results,
                "analysis": {
                    "avg_pe": round(avg_pe, 1),
                    "avg_fscore": round(avg_fscore, 1),
                    "sectors": sector_allocations
                }
            }
        }
    except Exception as e:
        raise HTTPException(500, f"Error processing CSV: {str(e)}")

@app.get("/api/portfolio/history")
def get_portfolio_history(current_user = Depends(get_current_user)):
    email = current_user.email
    sb = get_supabase()
    try:
        # Fetch the last 90 days of snapshots for this user, ordered by date
        result = sb.table("portfolio_snapshots")\
                   .select("*").eq("user_email", email)\
                   .order("snapshot_date", desc=False)\
                   .limit(90).execute()
        
        return {"success": True, "data": result.data or []}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/api/portfolio/broker/login/{broker_name}")
def get_broker_login_url(broker_name: str, req: BrokerLoginRequest, current_user = Depends(get_current_user)):
    try:
        url_data = BrokerService.get_login_url(broker_name, req.redirect_uri)
        return {"success": True, "data": url_data}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/portfolio/broker/callback/{broker_name}")
async def get_broker_holdings(broker_name: str, req: BrokerCallbackRequest, current_user = Depends(get_current_user)):
    email = current_user.email
    try:
        # Fetch raw holdings from broker service
        raw_holdings = BrokerService.handle_callback(broker_name, req.request_token, req.redirect_uri)
        
        results = []
        sector_allocations = {}
        total_portfolio_value = 0
        total_weighted_pe = 0
        total_weighted_fscore = 0

        # Process the holdings retrieved from broker
        for item in raw_holdings:
            sym = item["ticker"].upper().strip()
            shares = item["shares"]
            buy_price = item["buy_price"]

            # Fetch current price
            query_sym = sym if "." in sym else sym + ".NS"
            current_price = 0
            
            for s in ([sym] if "." in sym else [sym, sym + ".NS"]):
                try:
                    hist = yf.Ticker(s).history(period="5d")
                    if not hist.empty:
                        current_price = float(hist["Close"].iloc[-1])
                        query_sym = s
                        break
                except Exception:
                    continue

            # Fetch fundamentals & piotroski
            fund = {}
            pio = {}
            try:
                fund = get_fundamentals(query_sym)
                pio = get_piotroski_score(query_sym)
            except Exception:
                pass

            sector = fund.get("sector", "Unknown") if isinstance(fund, dict) else "Unknown"
            pe_ratio = fund.get("pe_ratio") if isinstance(fund, dict) and fund.get("pe_ratio") else 0
            f_score = pio.get("score") if isinstance(pio, dict) and pio.get("score") else 0

            invested = shares * buy_price
            current_value = shares * current_price
            pnl = current_value - invested
            pnl_pct = (pnl / invested * 100) if invested > 0 else 0

            if current_value > 0:
                sector_allocations[sector] = sector_allocations.get(sector, 0) + current_value
                total_portfolio_value += current_value
                total_weighted_pe += (pe_ratio * current_value)
                total_weighted_fscore += (f_score * current_value)

            results.append({
                "ticker": sym,
                "shares": shares,
                "buy_price": buy_price,
                "current_price": current_price,
                "invested": invested,
                "current_value": current_value,
                "pnl": pnl,
                "pnl_pct": pnl_pct,
                "sector": sector,
                "pe_ratio": pe_ratio,
                "f_score": f_score
            })

        avg_pe = (total_weighted_pe / total_portfolio_value) if total_portfolio_value > 0 else 0
        avg_fscore = (total_weighted_fscore / total_portfolio_value) if total_portfolio_value > 0 else 0
        
        for s in sector_allocations:
            sector_allocations[s] = round((sector_allocations[s] / total_portfolio_value) * 100, 1)

        # Save Daily Snapshot
        try:
            sb = get_supabase()
            today_str = date.today().isoformat()
            
            existing = sb.table("portfolio_snapshots").select("*").eq("user_email", email).eq("snapshot_date", today_str).execute()
            
            total_current_value = sum(r["current_value"] for r in results)
            total_invested_val = sum(r["invested"] for r in results)
            total_pnl_val = sum(r["pnl"] for r in results)

            if existing.data:
                sb.table("portfolio_snapshots").update({
                    "total_value": total_current_value,
                    "total_invested": total_invested_val,
                    "total_pnl": total_pnl_val
                }).eq("id", existing.data[0]["id"]).execute()
            else:
                sb.table("portfolio_snapshots").insert({
                    "user_email": email,
                    "snapshot_date": today_str,
                    "total_value": total_current_value,
                    "total_invested": total_invested_val,
                    "total_pnl": total_pnl_val
                }).execute()
        except Exception as e:
            print(f"Failed to save snapshot: {e}")

        return {
            "success": True, 
            "data": {
                "stocks": results,
                "analysis": {
                    "avg_pe": round(avg_pe, 1),
                    "avg_fscore": round(avg_fscore, 1),
                    "sectors": sector_allocations
                }
            }
        }
    except Exception as e:
        raise HTTPException(500, f"Error linking broker: {str(e)}")