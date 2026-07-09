import requests
from bs4 import BeautifulSoup

def get_screener_fundamentals(ticker: str) -> dict:
    """
    Scrapes the top ratio grid from Screener.in and returns clean floats.
    """
    clean_ticker = ticker.replace('.NS', '').replace('.BO', '')
    url = f"https://www.screener.in/company/{clean_ticker}/consolidated/"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=8)
        
        # Fallback to standalone if consolidated page doesn't exist
        if response.status_code != 200:
            url = f"https://www.screener.in/company/{clean_ticker}/"
            response = requests.get(url, headers=headers, timeout=8)
            
        if response.status_code != 200:
            return {}
            
        soup = BeautifulSoup(response.text, 'html.parser')
        metrics = {}
        
        ratios_ul = soup.find('ul', id='top-ratios')
        if ratios_ul:
            for li in ratios_ul.find_all('li'):
                name_elem = li.find('span', class_='name')
                value_elem = li.find('span', class_='number')
                
                if name_elem and value_elem:
                    name = name_elem.text.strip()
                    # Clean out commas, currency, and percentage signs for pure float conversion
                    val_str = value_elem.text.strip().replace(',', '').replace('₹', '').replace('%', '').replace('Cr.', '').strip()
                    try:
                        metrics[name] = float(val_str)
                    except ValueError:
                        pass
                        
        return metrics
        
    except Exception as e:
        print(f"Screener fetch error for {clean_ticker}: {e}")
        return {}