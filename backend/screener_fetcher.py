import requests
from bs4 import BeautifulSoup

def get_screener_fundamentals(ticker: str) -> dict:
    """
    Scrapes the top ratio grid and financial statement tables from Screener.in.
    Returns clean floats for P/E, P/B, ROE, ROCE, FCF, Debt/Equity, Margins, Growth.
    """
    clean_ticker = ticker.replace('.NS', '').replace('.BO', '')
    url = f"https://www.screener.in/company/{clean_ticker}/consolidated/"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
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
        
        # Clean labels to ignore spaces and signs
        def clean_label(text):
            return text.replace('\xa0', ' ').replace('+', '').strip().lower()

        # Helper to find row values in a table by row label
        def find_row_in_table(table, label):
            for tr in table.find_all('tr'):
                tds = [td.text.strip() for td in tr.find_all('td')]
                if tds and clean_label(tds[0]).startswith(label.lower()):
                    vals = []
                    for val in tds[1:]:
                        clean_val = val.replace(',', '').replace('%', '').strip()
                        try:
                            vals.append(float(clean_val))
                        except ValueError:
                            vals.append(None)
                    return vals
            return []

        # 1. Parse top ratios UL
        ratios_ul = soup.find('ul', id='top-ratios')
        if ratios_ul:
            for li in ratios_ul.find_all('li'):
                name_elem = li.find('span', class_='name')
                value_elem = li.find('span', class_='number')
                if name_elem and value_elem:
                    name = clean_label(name_elem.text)
                    val_str = value_elem.text.strip().replace(',', '').replace('₹', '').replace('%', '').replace('Cr.', '').strip()
                    try:
                        metrics[name] = float(val_str)
                    except ValueError:
                        pass

        # 2. Add P/B mathematical fallback if not present
        if 'current price' in metrics and 'book value' in metrics and metrics['book value'] > 0:
            metrics['pb_ratio_calculated'] = round(metrics['current price'] / metrics['book value'], 2)

        # Find tables
        tables = soup.find_all('table')

        # 3. Parse Sales & Profit Growth (Table 2 & 3)
        for table in tables:
            headers = [th.text.strip() for th in table.find_all('th')]
            if headers and "Compounded Sales Growth" in headers[0]:
                row_vals = find_row_in_table(table, "ttm")
                if row_vals:
                    metrics["sales_growth_yoy"] = row_vals[0]
            if headers and "Compounded Profit Growth" in headers[0]:
                row_vals = find_row_in_table(table, "ttm")
                if row_vals:
                    metrics["profit_growth_yoy"] = row_vals[0]

        # 4. Parse P&L Table (Table 1)
        for table in tables:
            headers = [th.text.strip() for th in table.find_all('th')]
            if len(headers) > 1 and ("Mar" in headers[1] or "Dec" in headers[1]):
                sales_row = find_row_in_table(table, "sales")
                opm_row = find_row_in_table(table, "opm")
                net_profit_row = find_row_in_table(table, "net profit")
                eps_row = find_row_in_table(table, "eps in rs")
                
                if opm_row:
                    metrics["opm_margin"] = next((x for x in reversed(opm_row) if x is not None), None)
                if eps_row:
                    metrics["eps"] = next((x for x in reversed(eps_row) if x is not None), None)
                if sales_row and net_profit_row:
                    latest_sales = next((x for x in reversed(sales_row) if x is not None), None)
                    latest_profit = next((x for x in reversed(net_profit_row) if x is not None), None)
                    if latest_sales is not None:
                        metrics["latest_sales"] = latest_sales
                    if latest_sales and latest_profit:
                        metrics["net_margin"] = round((latest_profit / latest_sales) * 100, 2)

        # 5. Parse Balance Sheet Table (Table 6)
        for table in tables:
            headers = [th.text.strip() for th in table.find_all('th')]
            if len(headers) > 1 and ("Mar" in headers[1] or "Dec" in headers[1]):
                borrowings = find_row_in_table(table, "borrowings")
                reserves = find_row_in_table(table, "reserves")
                share_capital = find_row_in_table(table, "equity capital") or find_row_in_table(table, "share capital")
                other_assets_row = find_row_in_table(table, "other assets")
                other_liab_row = find_row_in_table(table, "other liabilities")
                
                if other_assets_row:
                    metrics["other_assets"] = next((x for x in reversed(other_assets_row) if x is not None), 0)
                if other_liab_row:
                    metrics["other_liabilities"] = next((x for x in reversed(other_liab_row) if x is not None), 0)

                if borrowings and reserves and share_capital:
                    latest_borrowings = next((x for x in reversed(borrowings) if x is not None), 0)
                    latest_reserves = next((x for x in reversed(reserves) if x is not None), 0)
                    latest_capital = next((x for x in reversed(share_capital) if x is not None), 0)
                    metrics["latest_borrowings"] = latest_borrowings
                    equity = latest_reserves + latest_capital
                    if equity > 0:
                        metrics["debt_to_equity"] = round(latest_borrowings / equity, 2)


        # 6. Parse Free Cash Flow Table (Table 7)
        for table in tables:
            headers = [th.text.strip() for th in table.find_all('th')]
            if len(headers) > 1 and ("Mar" in headers[1] or "Dec" in headers[1]):
                fcf_row = find_row_in_table(table, "free cash flow")
                if fcf_row:
                    metrics["free_cash_flow"] = next((x for x in reversed(fcf_row) if x is not None), None)

        return metrics
        
    except Exception as e:
        print(f"Screener fetch error for {clean_ticker}: {e}")
        return {}