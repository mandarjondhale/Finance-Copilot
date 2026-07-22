import time
from datetime import datetime, timezone, timedelta

class MemoryCache:
    def __init__(self):
        self.store = {}

    def is_market_hours(self) -> bool:
        """
        Check if current time is within Indian market hours (9:15 AM - 3:30 PM IST, Monday - Friday).
        IST is UTC+5:30.
        """
        now_utc = datetime.now(timezone.utc)
        ist_tz = timezone(timedelta(hours=5, minutes=30))
        now_ist = now_utc.astimezone(ist_tz)
        
        # Weekdays are 0 (Monday) to 4 (Friday)
        if now_ist.weekday() > 4:
            return False
            
        market_start = now_ist.replace(hour=9, minute=15, second=0, microsecond=0)
        market_end = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
        
        return market_start <= now_ist <= market_end

    def get_ttl(self) -> int:
        """
        Get TTL in seconds based on market hours.
        5 minutes (300s) during market hours, 1 hour (3600s) after-hours.
        """
        if self.is_market_hours():
            return 300
        return 3600

    def get(self, key: str):
        if key not in self.store:
            return None
        val, expiry = self.store[key]
        if time.time() > expiry:
            del self.store[key]
            return None
        return val

    def set(self, key: str, value, ttl: int = None):
        if ttl is None:
            ttl = self.get_ttl()
        expiry = time.time() + ttl
        self.store[key] = (value, expiry)

    def delete(self, key: str):
        if key in self.store:
            del self.store[key]

# Global singleton cache instance
cache_instance = MemoryCache()
