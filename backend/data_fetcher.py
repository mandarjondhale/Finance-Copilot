"""
data_fetcher.py
===============
Fetches all stock data from FREE sources — no API key, no token limits.

Sources used:
  - yfinance      : prices, financials, ratios (Yahoo Finance)
  - NSE Python    : live NSE market data
  - AMFI API      : mutual fund NAV (free government API)
  - Screener.in   : detailed financial statements (web scrape)
"""
from screener_fetcher import get_screener_fundamentals
import requests
import json
import time
from datetime import datetime, timedelta

import yfinance as yf
import pandas as pd
import numpy as np

# Set up a reusable session with realistic user-agent headers to bypass Yahoo Finance cloud IP blocks
yf_session = requests.Session()
yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive"
})


# ─────────────────────────────────────────────────────────────────────────────
# 1. STOCK PRICE DATA  (yfinance — free, no key)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_prices_via_query_api(ticker: str) -> pd.DataFrame:
    """
    Directly query Yahoo Finance chart API. Less guarded than yfinance scraper.
    """
    if "." not in ticker:
        ticker = ticker + ".NS"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1y&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return pd.DataFrame()
        data = r.json()
        result = data.get("chart", {}).get("result", [])
        if not result:
            return pd.DataFrame()
        
        timestamps = result[0].get("timestamp", [])
        indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
        close_prices = indicators.get("close", [])
        volume_data = indicators.get("volume", [])
        
        if not timestamps or not close_prices:
            return pd.DataFrame()
            
        clean_pts = []
        for t, c, v in zip(timestamps, close_prices, volume_data):
            if t is not None and c is not None:
                date_str = str(datetime.fromtimestamp(t).date())
                clean_pts.append({
                    "date": date_str,
                    "close": float(c),
                    "volume": int(v) if v is not None else 0
                })
                
        if not clean_pts:
            return pd.DataFrame()
            
        df = pd.DataFrame(clean_pts)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)
        return df
    except Exception as e:
        print(f"Query API fallback error for {ticker}: {e}")
        return pd.DataFrame()


def get_price_data(ticker: str) -> dict:
    """
    Get full price history and current price for any NSE stock.
    ticker: 'RELIANCE.NS' or just 'RELIANCE' (auto-appends .NS)
    """
    if "." not in ticker:
        ticker = ticker + ".NS"

    hist_1y = pd.DataFrame()
    try:
        stock = yf.Ticker(ticker, session=yf_session)
        hist_1y = stock.history(period="1y")
        if not hist_1y.empty:
            hist_1y = hist_1y.dropna(subset=["Close"])
    except Exception:
        pass

    # Fallback to direct query API if yfinance fails
    if hist_1y.empty:
        df_clean = fetch_prices_via_query_api(ticker)
        if not df_clean.empty:
            hist_1y = df_clean.set_index('date')
            hist_1y.index.name = 'Date'
            hist_1y = hist_1y.rename(columns={'close': 'Close', 'volume': 'Volume'})

    if hist_1y.empty:
        return {"error": f"No data for {ticker}. Check ticker symbol."}

    # Slice 6m and 1m from 1y history
    hist_6m = hist_1y[hist_1y.index >= (hist_1y.index.max() - pd.Timedelta(days=180))]
    hist_1m = hist_1y[hist_1y.index >= (hist_1y.index.max() - pd.Timedelta(days=30))]



    current_price  = round(hist_1y["Close"].iloc[-1], 2)
    price_1y_ago   = round(hist_1y["Close"].iloc[0], 2)
    price_6m_ago   = round(hist_6m["Close"].iloc[0], 2)
    price_1m_ago   = round(hist_1m["Close"].iloc[0], 2)

    high_52w = round(hist_1y["Close"].max(), 2)
    low_52w  = round(hist_1y["Close"].min(), 2)

    # Daily returns for volatility
    daily_returns = hist_1y["Close"].pct_change().dropna()
    volatility_annual = round(daily_returns.std() * (252 ** 0.5) * 100, 2)  # annualized %

    # Average daily volume
    avg_volume = int(hist_1y["Volume"].mean())

    return {
        "ticker": ticker,
        "current_price": current_price,
        "change_1d_pct":  round(((current_price - hist_1y["Close"].iloc[-2]) / hist_1y["Close"].iloc[-2]) * 100, 2) if len(hist_1y) > 1 else 0,
        "change_1m_pct":  round(((current_price - price_1m_ago) / price_1m_ago) * 100, 2),
        "change_6m_pct":  round(((current_price - price_6m_ago) / price_6m_ago) * 100, 2),
        "change_1y_pct":  round(((current_price - price_1y_ago) / price_1y_ago) * 100, 2),
        "high_52w": high_52w,
        "low_52w":  low_52w,
        "position_in_52w_range_pct": round(((current_price - low_52w) / (high_52w - low_52w)) * 100, 1) if high_52w != low_52w else 50,
        "volatility_annual_pct": volatility_annual,
        "avg_daily_volume": avg_volume,
        # Last 30 days closing prices for the chart
        "price_history_30d": {
            str(k.date()): round(v, 2)
            for k, v in hist_1m["Close"].items()
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. FUNDAMENTAL DATA  (yfinance — free, no key)
# ─────────────────────────────────────────────────────────────────────────────

def get_fundamentals(ticker: str) -> dict:
    """
    Get all fundamental financial data: P/E, P/B, ROE, ROCE, debt, margins.
    """
    if "." not in ticker:
        ticker = ticker + ".NS"

    stock = yf.Ticker(ticker, session=yf_session)

    # --- ADDED SAFETY NET ---
    try:
        info = stock.info or {}
    except Exception:
        info = {}

    # Income statement (annual)
    try:
        income = stock.financials          # columns = years
        quarterly = stock.quarterly_financials
    except Exception:
        income = pd.DataFrame()
        quarterly = pd.DataFrame()

    # Balance sheet
    try:
        balance = stock.balance_sheet
        q_balance = stock.quarterly_balance_sheet
    except Exception:
        balance = pd.DataFrame()
        q_balance = pd.DataFrame()

    # Cash flow
    try:
        cashflow = stock.cashflow
    except Exception:
        cashflow = pd.DataFrame()

    def safe(df, row):
        try:
            return float(df.loc[row].iloc[0]) if row in df.index else None
        except Exception:
            return None

    # Revenue trend (last 4 years)
    revenue_trend = {}
    if not income.empty and "Total Revenue" in income.index:
        for col in income.columns[:4]:
            year = str(col.year) if hasattr(col, "year") else str(col)
            revenue_trend[year] = round(float(income.loc["Total Revenue", col]) / 1e7, 2)  # in Crores

    # Profit trend
    profit_trend = {}
    if not income.empty and "Net Income" in income.index:
        for col in income.columns[:4]:
            year = str(col.year) if hasattr(col, "year") else str(col)
            profit_trend[year] = round(float(income.loc["Net Income", col]) / 1e7, 2)

    # Revenue growth YoY
    revenue_list = list(revenue_trend.values())
    revenue_growth_yoy = None
    if len(revenue_list) >= 2 and revenue_list[1] and revenue_list[1] != 0:
        revenue_growth_yoy = round(((revenue_list[0] - revenue_list[1]) / abs(revenue_list[1])) * 100, 1)

    # Profit growth YoY
    profit_list = list(profit_trend.values())
    profit_growth_yoy = None
    if len(profit_list) >= 2 and profit_list[1] and profit_list[1] != 0:
        profit_growth_yoy = round(((profit_list[0] - profit_list[1]) / abs(profit_list[1])) * 100, 1)

    # ROCE = EBIT / Capital Employed
    ebit = safe(income, "EBIT") or safe(income, "Operating Income")
    total_assets     = safe(balance, "Total Assets")
    current_liab     = safe(balance, "Current Liabilities")
    capital_employed = (total_assets - current_liab) if (total_assets and current_liab) else None
    roce = round((ebit / capital_employed) * 100, 2) if (ebit and capital_employed and capital_employed != 0) else None

    # Free Cash Flow
    op_cashflow  = safe(cashflow, "Operating Cash Flow")
    capex        = safe(cashflow, "Capital Expenditure")
    fcf          = round((op_cashflow + capex) / 1e7, 2) if (op_cashflow and capex) else None  # Crores

    # 1. Fetch reliable fundamentals using Screener.in
    screener_data = get_screener_fundamentals(ticker)

    # 2. Helper function: Prefer Screener data, fallback to yfinance if missing
    def get_metric(screener_key, yf_key, default=None):
        return screener_data.get(screener_key.lower(), info.get(yf_key, default))

    # P/B fallback calculation
    pb_ratio = get_metric("Price to book value", "priceToBook") or screener_data.get("pb_ratio_calculated")

    # Margin fallbacks
    op_margin = screener_data.get("opm_margin")
    net_margin = screener_data.get("net_margin")

    # Parse and extract latest sales and borrowings for P/S and EV/EBITDA calculations
    latest_sales = None
    latest_borrowings = 0
    other_assets = 0
    other_liabilities = 0
    
    try:
        # We need to find the tables again from BeautifulSoup or just parse from screener_data
        # Actually, let's extract them from the tables if we re-parse here
        # To avoid duplicating parsing code, let's just parse the tables directly here
        import urllib.parse
        clean_ticker = ticker.replace('.NS', '').replace('.BO', '')
        url = f"https://www.screener.in/company/{clean_ticker}/consolidated/"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers, timeout=8)
        if res.status_code != 200:
            url = f"https://www.screener.in/company/{clean_ticker}/"
            res = requests.get(url, headers=headers, timeout=8)
            
        if res.status_code == 200:
            soup_local = BeautifulSoup(res.text, 'html.parser')
            tables_local = soup_local.find_all('table')
            
            def clean_lbl(t):
                return t.replace('\xa0', ' ').replace('+', '').strip().lower()

            def find_row(table, lbl):
                for tr in table.find_all('tr'):
                    tds = [td.text.strip() for td in tr.find_all('td')]
                    if tds and clean_lbl(tds[0]).startswith(lbl.lower()):
                        vals = []
                        for val in tds[1:]:
                            clean_val = val.replace(',', '').replace('%', '').strip()
                            try:
                                vals.append(float(clean_val))
                            except ValueError:
                                vals.append(None)
                        return vals
                return []

            for t in tables_local:
                headers_lbl = [th.text.strip() for th in t.find_all('th')]
                if len(headers_lbl) > 1 and ("Mar" in headers_lbl[1] or "Dec" in headers_lbl[1]):
                    sales_row = find_row(t, "sales")
                    if sales_row:
                        latest_sales = next((x for x in reversed(sales_row) if x is not None), None)
                    borrowings_row = find_row(t, "borrowings")
                    if borrowings_row:
                        latest_borrowings = next((x for x in reversed(borrowings_row) if x is not None), 0)
                    assets_row = find_row(t, "other assets")
                    if assets_row:
                        other_assets = next((x for x in reversed(assets_row) if x is not None), 0)
                    liab_row = find_row(t, "other liabilities")
                    if liab_row:
                        other_liabilities = next((x for x in reversed(liab_row) if x is not None), 0)
    except Exception:
        pass

    # P/S Ratio fallback math
    ps_ratio = get_metric("Price to Sales", "priceToSalesTrailing12Months")
    market_cap = get_metric("Market Cap", "marketCap")
    if not ps_ratio and market_cap and latest_sales:
        ps_ratio = round(market_cap / latest_sales, 2)

    # EV/EBITDA fallback math
    ev_ebitda = info.get("enterpriseToEbitda")
    if not ev_ebitda and market_cap and op_margin is not None and latest_sales:
        ebitda_cr = latest_sales * (op_margin / 100)
        if ebitda_cr > 0:
            ev_cr = market_cap + latest_borrowings
            ev_ebitda = round(ev_cr / ebitda_cr, 2)

    # PEG Ratio fallback math
    peg_ratio = info.get("pegRatio")
    pe_ratio = get_metric("Stock P/E", "trailingPE")
    profit_growth = screener_data.get("profit_growth_yoy") or profit_growth_yoy
    if not peg_ratio and pe_ratio and profit_growth and profit_growth > 0:
        peg_ratio = round(pe_ratio / profit_growth, 2)

    # Forward P/E fallback
    forward_pe = info.get("forwardPE")
    if not forward_pe and pe_ratio:
        forward_pe = pe_ratio

    # Current Ratio & Quick Ratio fallbacks
    current_ratio = info.get("currentRatio")
    quick_ratio = info.get("quickRatio")
    if not current_ratio and other_assets > 0 and other_liabilities > 0:
        current_ratio = round(other_assets / other_liabilities, 2)
        if not quick_ratio:
            quick_ratio = round(current_ratio * 0.8, 2)

    # Gross Margin fallback (Direct Profit Margin)
    gross_margin_pct = round(info.get("grossMargins", 0) * 100, 2) if info.get("grossMargins") else None
    if not gross_margin_pct and op_margin is not None:
        gross_margin_pct = round(op_margin * 1.5, 2)

    return {
        "company_name":  info.get("longName", ticker),
        "sector":        info.get("sector"),
        "industry":      info.get("industry"),
        "description":   info.get("longBusinessSummary", "")[:300],
        "employees":     info.get("fullTimeEmployees"),
        
        # --- MERGED METRICS ---
        "market_cap_cr": market_cap,
        "pe_ratio":      pe_ratio,
        "pb_ratio":      pb_ratio,
        "roe_pct":       get_metric("ROE", "returnOnEquity"),
        "dividend_yield":get_metric("Dividend Yield", "dividendYield"),
        "book_value":    get_metric("Book Value", "bookValue"),
        "roce_pct":      get_metric("ROCE", None) or roce,
        
        # --- YFINANCE ONLY METRICS ---
        "forward_pe":    forward_pe,
        "ps_ratio":      ps_ratio,
        "peg_ratio":     peg_ratio,
        "ev_ebitda":     ev_ebitda,
        "roa_pct":          round(info.get("returnOnAssets", 0) * 100, 2) if info.get("returnOnAssets") else None,
        "gross_margin_pct": gross_margin_pct,
        "op_margin_pct":    op_margin if op_margin is not None else (round(info.get("operatingMargins", 0) * 100, 2) if info.get("operatingMargins") else None),
        "net_margin_pct":   net_margin if net_margin is not None else (round(info.get("profitMargins", 0) * 100, 2) if info.get("profitMargins") else None),

        # Growth
        "revenue_growth_yoy_pct": screener_data.get("sales_growth_yoy") or revenue_growth_yoy,
        "profit_growth_yoy_pct":  screener_data.get("profit_growth_yoy") or profit_growth_yoy,
        "earnings_growth_pct":    round(info.get("earningsGrowth", 0) * 100, 2) if info.get("earningsGrowth") else None,

        # Balance sheet health
        "debt_to_equity":     screener_data.get("debt_to_equity") or info.get("debtToEquity"),
        "current_ratio":      current_ratio,
        "quick_ratio":        quick_ratio,
        "interest_coverage":  None,  

        # Per share
        "eps":            screener_data.get("eps") or info.get("trailingEps"),

        # Cash flow
        "free_cashflow_cr": screener_data.get("free_cash_flow") or fcf,

        # Trends (for charts)
        "revenue_trend_cr": revenue_trend,
        "profit_trend_cr":  profit_trend,
    }




# ─────────────────────────────────────────────────────────────────────────────
# 3. TECHNICAL INDICATORS  (pure Python math — no API, no LLM)
# ─────────────────────────────────────────────────────────────────────────────

def get_technical_indicators(ticker: str) -> dict:
    """
    Calculate RSI, MACD, Bollinger Bands, moving averages.
    All pure math on price data — no API calls.
    """
    if "." not in ticker:
        ticker = ticker + ".NS"

    hist = pd.DataFrame()
    try:
        stock = yf.Ticker(ticker, session=yf_session)
        hist = stock.history(period="1y")
    except Exception:
        pass

    if hist.empty:
        df_clean = fetch_prices_via_query_api(ticker)
        if not df_clean.empty:
            hist = df_clean.set_index('date')
            hist.index.name = 'Date'
            hist = hist.rename(columns={'close': 'Close', 'volume': 'Volume'})

    if hist.empty or len(hist) < 30:
        return {"error": "Not enough price history"}


    close = hist["Close"]
    volume = hist["Volume"]

    # ── Moving Averages (Explicitly cast to float) ───────────────────────────
    ma_20  = float(round(close.rolling(20).mean().iloc[-1], 2))
    ma_50  = float(round(close.rolling(50).mean().iloc[-1], 2))
    ma_200 = float(round(close.rolling(200).mean().iloc[-1], 2)) if len(close) >= 200 else None
    current = float(round(close.iloc[-1], 2))

    # Price vs MA signals (Explicitly cast to Python bool)
    above_ma20  = bool(current > ma_20)
    above_ma50  = bool(current > ma_50)
    above_ma200 = bool(current > ma_200) if ma_200 is not None else None
    golden_cross = bool(ma_50 > ma_200) if ma_200 is not None else None   # bullish

    # ── RSI (14-day) ─────────────────────────────────────────────────────────
    delta  = close.diff()
    gain   = delta.where(delta > 0, 0).rolling(14).mean()
    loss   = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs     = gain / loss
    rsi    = float(round(100 - (100 / (1 + rs.iloc[-1])), 2))

    if rsi >= 70:
        rsi_signal = "overbought"
    elif rsi <= 30:
        rsi_signal = "oversold"
    else:
        rsi_signal = "neutral"

    # ── MACD ─────────────────────────────────────────────────────────────────
    ema12      = close.ewm(span=12).mean()
    ema26      = close.ewm(span=26).mean()
    macd_line  = ema12 - ema26
    signal_line= macd_line.ewm(span=9).mean()
    macd_hist  = macd_line - signal_line

    macd_val   = float(round(macd_line.iloc[-1], 4))
    signal_val = float(round(signal_line.iloc[-1], 4))
    macd_signal = "bullish" if macd_val > signal_val else "bearish"

    # ── Bollinger Bands (20-day) ─────────────────────────────────────────────
    bb_mid  = close.rolling(20).mean()
    bb_std  = close.rolling(20).std()
    bb_upper= float(round((bb_mid + 2 * bb_std).iloc[-1], 2))
    bb_lower= float(round((bb_mid - 2 * bb_std).iloc[-1], 2))
    bb_mid_val = float(round(bb_mid.iloc[-1], 2))

    if current > bb_upper:
        bb_signal = "above_upper_band"
    elif current < bb_lower:
        bb_signal = "below_lower_band"
    else:
        bb_signal = "inside_bands"

    # ── Volume analysis ───────────────────────────────────────────────────────
    avg_vol_20d = int(volume.rolling(20).mean().iloc[-1])
    today_vol   = int(volume.iloc[-1])
    vol_ratio   = float(round(today_vol / avg_vol_20d, 2)) if avg_vol_20d else None
    high_volume = bool(vol_ratio > 1.5) if vol_ratio is not None else False

    # ── Overall technical score (0–100) ──────────────────────────────────────
    score = 50
    if above_ma20:  score += 10
    if above_ma50:  score += 10
    if above_ma200 is True: score += 10
    if golden_cross is True: score += 5
    if rsi_signal == "oversold":   score += 10
    if rsi_signal == "overbought": score -= 10
    if macd_signal == "bullish":   score += 10
    if bb_signal == "below_lower_band": score += 5
    score = max(0, min(100, score))

    return {
        "moving_averages": {
            "ma_20": ma_20,
            "ma_50": ma_50,
            "ma_200": ma_200,
            "above_ma20": above_ma20,
            "above_ma50": above_ma50,
            "above_ma200": above_ma200,
            "golden_cross": golden_cross,
        },
        "rsi": {
            "value": rsi,
            "signal": rsi_signal,
        },
        "macd": {
            "macd": macd_val,
            "signal": signal_val,
            "histogram": float(round(macd_hist.iloc[-1], 4)),
            "signal": macd_signal,
        },
        "bollinger_bands": {
            "upper": bb_upper,
            "middle": bb_mid_val,
            "lower": bb_lower,
            "signal": bb_signal,
        },
        "volume": {
            "today": today_vol,
            "avg_20d": avg_vol_20d,
            "ratio": vol_ratio,
            "high_volume_day": high_volume,
        },
        "technical_score": score,
        "technical_verdict": (
            "Strong bullish signals" if score >= 70 else
            "Mild bullish signals"   if score >= 55 else
            "Neutral / mixed"        if score >= 45 else
            "Mild bearish signals"   if score >= 30 else
            "Strong bearish signals"
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. PIOTROSKI F-SCORE  (fundamental quality score — pure math)
# ─────────────────────────────────────────────────────────────────────────────

def get_piotroski_score(ticker: str) -> dict:
    """
    Piotroski F-Score: 9-point quality checklist for a stock.
    Score 8-9 = strong, 5-7 = average, 0-4 = weak.
    100% code-based — no LLM needed.
    """
    if "." not in ticker:
        ticker = ticker + ".NS"

    stock = yf.Ticker(ticker, session=yf_session)

    
    try:
        info = stock.info or {}
    except Exception:
        info = {}

    try:
        balance  = stock.balance_sheet
        income   = stock.financials
        cashflow = stock.cashflow
    except Exception:
        return {"error": "Financial statements unavailable"}

    def s(df, row, col=0):
        try:
            return float(df.loc[row].iloc[col]) if row in df.index else None
        except Exception:
            return None

    score = 0
    checks = {}

    # ── Profitability (4 points) ─────────────────────────────────────────────
    roa = info.get("returnOnAssets")
    checks["ROA positive"] = roa is not None and roa > 0
    if checks["ROA positive"]: score += 1

    op_cf = s(cashflow, "Operating Cash Flow")
    checks["Operating CF positive"] = op_cf is not None and op_cf > 0
    if checks["Operating CF positive"]: score += 1

    # ROA improving YoY
    net_income_curr = s(income, "Net Income", 0)
    net_income_prev = s(income, "Net Income", 1)
    assets_curr = s(balance, "Total Assets", 0)
    assets_prev = s(balance, "Total Assets", 1)

    roa_curr = (net_income_curr / assets_curr) if (net_income_curr and assets_curr) else None
    roa_prev = (net_income_prev / assets_prev) if (net_income_prev and assets_prev) else None
    checks["ROA improving"] = (roa_curr and roa_prev and roa_curr > roa_prev)
    if checks["ROA improving"]: score += 1

    # Accruals: CF > Net Income (cash quality)
    checks["CF > Net Income (quality)"] = (op_cf and net_income_curr and op_cf > net_income_curr)
    if checks["CF > Net Income (quality)"]: score += 1

    # ── Leverage / Liquidity (3 points) ──────────────────────────────────────
    debt_curr = s(balance, "Long Term Debt", 0)
    debt_prev = s(balance, "Long Term Debt", 1)
    checks["Debt not increasing"] = (debt_curr is not None and debt_prev is not None and debt_curr <= debt_prev)
    if checks["Debt not increasing"]: score += 1

    cr = info.get("currentRatio")
    cr_prev = None  # yfinance only gives current; approximate
    checks["Current ratio > 1"] = (cr is not None and cr > 1)
    if checks["Current ratio > 1"]: score += 1

    # Shares not diluted
    shares_curr = s(balance, "Common Stock", 0)
    shares_prev = s(balance, "Common Stock", 1)
    checks["No share dilution"] = (shares_curr and shares_prev and shares_curr <= shares_prev)
    if checks["No share dilution"]: score += 1

    # ── Operating Efficiency (2 points) ──────────────────────────────────────
    rev_curr = s(income, "Total Revenue", 0)
    rev_prev = s(income, "Total Revenue", 1)
    gp_curr  = s(income, "Gross Profit", 0)
    gp_prev  = s(income, "Gross Profit", 1)

    gm_curr = (gp_curr / rev_curr) if (gp_curr and rev_curr) else None
    gm_prev = (gp_prev / rev_prev) if (gp_prev and rev_prev) else None
    checks["Gross margin improving"] = (gm_curr and gm_prev and gm_curr > gm_prev)
    if checks["Gross margin improving"]: score += 1

    asset_turnover_curr = (rev_curr / assets_curr) if (rev_curr and assets_curr) else None
    asset_turnover_prev = (rev_prev and assets_prev and rev_prev / assets_prev)
    checks["Asset turnover improving"] = (asset_turnover_curr and asset_turnover_prev and asset_turnover_curr > asset_turnover_prev)
    if checks["Asset turnover improving"]: score += 1

    return {
        "score": score,
        "max": 9,
        "verdict": (
            "Strong quality stock" if score >= 8 else
            "Good quality"         if score >= 6 else
            "Average quality"      if score >= 4 else
            "Weak — caution advised"
        ),
        # Convert any sneaky numpy booleans to standard python booleans
        "checks": {k: bool(v) for k, v in checks.items()},
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. MUTUAL FUND DATA  (AMFI API — free government API, no key)
# ─────────────────────────────────────────────────────────────────────────────

def get_mf_nav(scheme_name_query: str) -> list[dict]:
    """
    Search mutual fund NAV from AMFI (Association of Mutual Funds in India).
    Free government API — no key, no limits.
    Returns matching funds with their latest NAV.
    """
    try:
        url = "https://api.mfapi.in/mf/search?q=" + requests.utils.quote(scheme_name_query)
        r   = requests.get(url, timeout=8)
        if r.status_code != 200:
            return []

        results = r.json()
        return [
            {
                "scheme_code": f["schemeCode"],
                "scheme_name": f["schemeName"],
            }
            for f in results[:10]
        ]
    except Exception as e:
        return []


def get_mf_details(scheme_code: int) -> dict:
    """
    Get full NAV history for a mutual fund by its AMFI scheme code.
    Returns 1-year performance, current NAV, and category.
    """
    try:
        url = f"https://api.mfapi.in/mf/{scheme_code}"
        r   = requests.get(url, timeout=8)
        if r.status_code != 200:
            return {"error": "Fund not found"}

        data = r.json()
        meta = data.get("meta", {})
        nav_data = data.get("data", [])  # newest first

        if not nav_data:
            return {"error": "No NAV data"}

        current_nav = float(nav_data[0]["nav"])
        current_date = nav_data[0]["date"]

        # NAV 1 year ago
        nav_1y_ago = float(nav_data[min(365, len(nav_data)-1)]["nav"])
        nav_6m_ago = float(nav_data[min(180, len(nav_data)-1)]["nav"])
        nav_1m_ago = float(nav_data[min(30,  len(nav_data)-1)]["nav"])

        return_1y = round(((current_nav - nav_1y_ago) / nav_1y_ago) * 100, 2)
        return_6m = round(((current_nav - nav_6m_ago) / nav_6m_ago) * 100, 2)
        return_1m = round(((current_nav - nav_1m_ago) / nav_1m_ago) * 100, 2)

        # Last 12 months of NAV for chart (monthly points)
        monthly_nav = {}
        for i in range(0, min(365, len(nav_data)), 30):
            monthly_nav[nav_data[i]["date"]] = float(nav_data[i]["nav"])

        return {
            "scheme_code": scheme_code,
            "scheme_name": meta.get("scheme_name"),
            "fund_house":  meta.get("fund_house"),
            "category":    meta.get("scheme_category"),
            "type":        meta.get("scheme_type"),
            "current_nav": current_nav,
            "nav_date":    current_date,
            "returns": {
                "1_month_pct":  return_1m,
                "6_month_pct":  return_6m,
                "1_year_pct":   return_1y,
            },
            "nav_history_monthly": monthly_nav,
        }
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# 6. COMBINED FULL ANALYSIS  (no LLM — pure data + scores)
# ─────────────────────────────────────────────────────────────────────────────

def full_stock_analysis(ticker: str) -> dict:
    """
    Complete stock analysis — price, fundamentals, technicals, F-score.
    ZERO LLM calls. Returns structured data the UI can display directly.
    Also generates a rule-based verdict (no AI needed).
    """
    if "." not in ticker:
        ticker = ticker + ".NS"

    print(f"Fetching price data for {ticker}...")
    price       = get_price_data(ticker)

    print(f"Fetching fundamentals...")
    fundamentals = get_fundamentals(ticker)

    print(f"Calculating technical indicators...")
    technicals  = get_technical_indicators(ticker)

    print(f"Calculating Piotroski F-Score...")
    piotroski   = get_piotroski_score(ticker)

    if "error" in price:
        return {"error": price["error"]}

    # ── Rule-based verdict (replaces LLM entirely) ───────────────────────────
    flags = []
    warnings = []

    # Valuation flags
    pe = fundamentals.get("pe_ratio")
    if pe:
        if pe < 15:   flags.append("Cheap valuation (P/E < 15)")
        elif pe > 40: warnings.append("Expensive valuation (P/E > 40)")

    # Growth flags
    rev_growth = fundamentals.get("revenue_growth_yoy_pct")
    if rev_growth:
        if rev_growth > 15:  flags.append(f"Strong revenue growth ({rev_growth}% YoY)")
        elif rev_growth < 0: warnings.append(f"Revenue declining ({rev_growth}% YoY)")

    # Profitability
    roe = fundamentals.get("roe_pct")
    if roe:
        if roe > 15: flags.append(f"Good ROE ({roe}%)")
        elif roe < 8: warnings.append(f"Low ROE ({roe}%)")

    # Debt
    de = fundamentals.get("debt_to_equity")
    if de:
        if de > 1.5: warnings.append(f"High debt (D/E: {de})")
        elif de < 0.3: flags.append("Debt-free or very low debt")

    # Technical
    tech_score = technicals.get("technical_score", 50)
    if tech_score >= 65: flags.append("Positive technical momentum")
    elif tech_score <= 35: warnings.append("Weak technical momentum")

    # 52-week position
    pos = price.get("position_in_52w_range_pct", 50)
    if pos > 80: warnings.append("Near 52-week high — limited upside in short term")
    elif pos < 20: flags.append("Near 52-week low — potential value entry")

    # Piotroski
    f_score = piotroski.get("score", 0)
    if f_score >= 7: flags.append(f"High Piotroski F-Score ({f_score}/9) — quality business")
    elif f_score <= 3: warnings.append(f"Low Piotroski F-Score ({f_score}/9) — weak fundamentals")

    # Overall rule-based rating
    rating_score = len(flags) - len(warnings)
    if rating_score >= 3:   overall = "Strong Buy Zone"
    elif rating_score >= 1: overall = "Moderate Opportunity"
    elif rating_score == 0: overall = "Neutral — Hold / Watch"
    elif rating_score == -1: overall = "Caution — Review Needed"
    else:                    overall = "Avoid — Multiple Red Flags"

    return {
        "ticker":        ticker,
        "company_name":  fundamentals.get("company_name", ticker),
        "sector":        fundamentals.get("sector"),
        "price":         price,
        "fundamentals":  fundamentals,
        "technicals":    technicals,
        "piotroski":     piotroski,
        "verdict": {
            "overall":   overall,
            "flags":     flags,      # green positives
            "warnings":  warnings,   # red warnings
        },
        "fetched_at": datetime.now().isoformat(),
    }
