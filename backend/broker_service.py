"""
broker_service.py
=================
Handles integrations with major Indian stock brokers (Zerodha, Angel One, Groww, Upstox).
If API credentials are provided in the environment variables, it uses the official SDKs/APIs.
Otherwise, it falls back to a simulated OAuth flow with realistic mock holdings data.
"""

import os
import logging
from typing import Dict, List, Optional

logger = logging.getLogger("FinCopilot.BrokerService")

# --- Try imports for official SDKs ---
try:
    from kiteconnect import KiteConnect
    KITE_AVAILABLE = True
except ImportError:
    KITE_AVAILABLE = False
    logger.warning("kiteconnect package not found. Zerodha API will fall back to mock mode.")

# --- Simulated Mock Portfolio Holdings ---
MOCK_BROKER_HOLDINGS = {
    "zerodha": [
        {"ticker": "RELIANCE", "shares": 25, "buy_price": 2420.50, "sector": "Energy"},
        {"ticker": "TCS", "shares": 15, "buy_price": 3810.00, "sector": "Technology"},
        {"ticker": "HDFCBANK", "shares": 50, "buy_price": 1580.40, "sector": "Financial Services"},
        {"ticker": "ITC", "shares": 100, "buy_price": 420.25, "sector": "Consumer Goods"},
        {"ticker": "TATAMOTORS", "shares": 40, "buy_price": 930.10, "sector": "Automobile"},
    ],
    "angelone": [
        {"ticker": "INFY", "shares": 30, "buy_price": 1450.60, "sector": "Technology"},
        {"ticker": "WIPRO", "shares": 80, "buy_price": 460.90, "sector": "Technology"},
        {"ticker": "BAJFINANCE", "shares": 8, "buy_price": 7100.00, "sector": "Financial Services"},
        {"ticker": "ITC", "shares": 120, "buy_price": 415.80, "sector": "Consumer Goods"},
    ],
    "groww": [
        {"ticker": "ASIANPAINT", "shares": 12, "buy_price": 2890.30, "sector": "Consumer Goods"},
        {"ticker": "SUNPHARMA", "shares": 20, "buy_price": 1510.40, "sector": "Healthcare"},
        {"ticker": "RELIANCE", "shares": 15, "buy_price": 2450.00, "sector": "Energy"},
        {"ticker": "HDFCBANK", "shares": 35, "buy_price": 1605.00, "sector": "Financial Services"},
    ],
    "upstox": [
        {"ticker": "TCS", "shares": 10, "buy_price": 3850.00, "sector": "Technology"},
        {"ticker": "TATAMOTORS", "shares": 60, "buy_price": 915.20, "sector": "Automobile"},
        {"ticker": "INFY", "shares": 25, "buy_price": 1480.00, "sector": "Technology"},
        {"ticker": "ITC", "shares": 150, "buy_price": 425.00, "sector": "Consumer Goods"},
    ]
}


class BrokerService:
    @staticmethod
    def get_login_url(broker: str, redirect_uri: str) -> Dict[str, str]:
        """
        Generates the redirection URL for broker OAuth login.
        If credentials are not configured, it returns a URL pointing back to our local callback
        which will initiate mock authentication simulation.
        """
        broker = broker.lower().strip()
        
        # --- ZERODHA (KITE CONNECT) REAL FLOW ---
        if broker == "zerodha":
            api_key = os.environ.get("ZERODHA_API_KEY")
            if api_key and KITE_AVAILABLE:
                try:
                    kite = KiteConnect(api_key=api_key)
                    login_url = kite.login_url() + f"&redirect_uri={redirect_uri}"
                    return {"url": login_url, "is_mock": False}
                except Exception as e:
                    logger.error(f"Error generating Kite login URL: {e}")
            
            # Fallback to local callback simulation
            logger.info("Zerodha credentials missing or library unavailable. Using mock OAuth redirect.")
            mock_url = f"{redirect_uri}?status=success&broker=zerodha&mock=true"
            return {"url": mock_url, "is_mock": True}

        # --- ANGEL ONE / SMARTAPI REAL FLOW ---
        elif broker == "angelone":
            api_key = os.environ.get("ANGEL_ONE_API_KEY")
            if api_key:
                # Angel One uses smartapi-python or direct POST requests.
                # In typical setups, it requires client code and password rather than a redirect URL.
                # We return a specific URL representing our local simulated flow, or their login page.
                pass
            
            logger.info("Angel One credentials missing. Using mock OAuth redirect.")
            mock_url = f"{redirect_uri}?status=success&broker=angelone&mock=true"
            return {"url": mock_url, "is_mock": True}

        # --- GROWW & UPSTOX FLOW ---
        elif broker in ["groww", "upstox"]:
            # Standard simulated flow for demo
            mock_url = f"{redirect_uri}?status=success&broker={broker}&mock=true"
            return {"url": mock_url, "is_mock": True}

        else:
            raise ValueError(f"Unsupported broker: {broker}")

    @staticmethod
    def handle_callback(broker: str, request_token: str, redirect_uri: str) -> List[Dict]:
        """
        Exchanges callback token for access token and fetches holdings.
        If request_token represents a mock simulation, returns pre-defined mock portfolios.
        """
        broker = broker.lower().strip()

        # Check if it's a simulated mock call
        if request_token == "mock_token" or request_token.startswith("mock"):
            logger.info(f"Fulfilling mock holdings request for {broker}.")
            return MOCK_BROKER_HOLDINGS.get(broker, [])

        # --- ZERODHA REAL API EXCHANGE ---
        if broker == "zerodha":
            api_key = os.environ.get("ZERODHA_API_KEY")
            api_secret = os.environ.get("ZERODHA_API_SECRET")
            if api_key and api_secret and KITE_AVAILABLE:
                try:
                    kite = KiteConnect(api_key=api_key)
                    # Exchange the request token for access token
                    data = kite.generate_session(request_token, api_secret=api_secret)
                    kite.set_access_token(data["access_token"])
                    
                    # Fetch real holdings
                    raw_holdings = kite.holdings()
                    
                    # Parse to standard format
                    holdings = []
                    for h in raw_holdings:
                        ticker = h.get("tradingsymbol", "")
                        # Kite symbols are typically without .NS unless requested. Add NS for NSE stocks.
                        # Check exchange
                        exchange = h.get("exchange", "")
                        if exchange == "NSE" and "." not in ticker:
                            # Ticker remains standard without .NS in frontend since frontend does the .NS formatting or yfinance resolves it.
                            pass
                            
                        holdings.append({
                            "ticker": ticker,
                            "shares": float(h.get("quantity", 0) + h.get("t1_quantity", 0)),
                            "buy_price": float(h.get("average_price", 0)),
                            "sector": "Broker Import" # Will be updated via screener/yfinance fetching
                        })
                    return holdings
                except Exception as e:
                    logger.error(f"Real Zerodha integration failed: {e}. Falling back to mock data.")
                    return MOCK_BROKER_HOLDINGS.get(broker, [])
            
        # --- ANGEL ONE REAL API EXCHANGE ---
        elif broker == "angelone":
            # Real Angel One API verification would go here (using SmartConnect package)
            # Typically requires client code, password, and totp to log in.
            pass

        # Default fallback
        logger.info(f"Broker credentials not fully configured for {broker}. Falling back to mock holdings.")
        return MOCK_BROKER_HOLDINGS.get(broker, [])
