"""Configurable keyword management for feature extraction"""

import json
from pathlib import Path
from typing import Set, Dict, Any, List, Optional
from datetime import datetime, timezone

from URLshield.logger import get_logger

logger = get_logger(__name__)


DEFAULT_BRAND_MAPPINGS = {
    # Indian banks and government services
    "sbi": "sbi.co.in",
    "sbicard": "sbicard.com",
    "sbilife": "sbilife.co.in",
    "icici": "icicibank.com",
    "bankofbaroda": "bankofbaroda.in",
    "crsorgi": "dc.crsorgi.gov.in",
    "hdfcbank": "hdfcbank.com",
    "hdfc": "hdfcbank.com",
    "hdfcergo": "hdfcergo.com",
    "ncrb": "ncrb.gov.in",
    "airtel": "airtel.in",
    "mgovcloud": "accounts.mgovcloud.in",
    "iocl": "iocl.com",
    "irctc": "irctc.co.in",
    "pnb": "pnbindia.in",
    "pnbindia": "pnbindia.in",
    
    # Major global brands
    "google": "google.com",
    "gmail": "gmail.com",
    "youtube": "youtube.com",
    "chrome": "google.com",
    "android": "google.com",
    "paypal": "paypal.com",
    "amazon": "amazon.com",
    "facebook": "facebook.com",
    "instagram": "instagram.com",
    "whatsapp": "whatsapp.com",
    "microsoft": "microsoft.com",
    "apple": "apple.com",
    "icloud": "icloud.com",
    "netflix": "netflix.com",
    "twitter": "twitter.com",
    "x": "x.com",
    "linkedin": "linkedin.com",
    "telegram": "telegram.org",
    "dropbox": "dropbox.com",
    "github": "github.com",
    "stackoverflow": "stackoverflow.com",
}


class KeywordConfig:
    """Manage brand and misleading keywords configuration"""
    
    DEFAULT_CONFIG_PATH = Path("config/keywords.json")
    
    # No default keywords - must be configured via dashboard
    DEFAULT_BRAND_KEYWORDS = set()
    DEFAULT_MISLEADING_KEYWORDS = set()
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or self.DEFAULT_CONFIG_PATH
        self.brand_keywords: Set[str] = set()
        self.misleading_keywords: Set[str] = set()
        self.last_updated: datetime = datetime.now(timezone.utc)
        self.brand_mappings: Dict[str, str] = {}
        self.load_config()
    
    def load_config(self):
        """Load keywords from config file or use defaults"""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                
                self.brand_keywords = {str(k).lower().strip() for k in config.get('brand_keywords', [])}
                self.misleading_keywords = set(config.get('misleading_keywords', []))
                mappings_raw = config.get('brand_mappings', [])
                self.brand_mappings = self._parse_brand_mappings(mappings_raw)

                if not self.brand_mappings and self.brand_keywords:
                    # Assume keywords already contain domains; map brand to itself
                    self.brand_mappings = {brand: brand for brand in self.brand_keywords}

                # Ensure keywords include all mapping keys
                self.brand_keywords.update(self.brand_mappings.keys())

                self.last_updated = datetime.fromisoformat(
                    config.get('last_updated', datetime.now(timezone.utc).isoformat())
                )
                
                logger.info(
                    f"Loaded keywords config: {len(self.brand_keywords)} brands, "
                    f"{len(self.misleading_keywords)} misleading"
                )
            else:
                # Use defaults and create config file
                self.brand_keywords = self.DEFAULT_BRAND_KEYWORDS.copy()
                self.misleading_keywords = self.DEFAULT_MISLEADING_KEYWORDS.copy()
                self.brand_mappings = DEFAULT_BRAND_MAPPINGS.copy()
                self.brand_keywords.update(self.brand_mappings.keys())
                self.save_config()
                logger.info("Created default keywords config")
        
        except Exception as e:
            logger.error(f"Failed to load keywords config: {e}, using defaults")
            self.brand_keywords = self.DEFAULT_BRAND_KEYWORDS.copy()
            self.misleading_keywords = self.DEFAULT_MISLEADING_KEYWORDS.copy()
            self.brand_mappings = DEFAULT_BRAND_MAPPINGS.copy()
    
    def save_config(self):
        """Save current keywords to config file"""
        try:
            # Ensure config directory exists
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            
            config = {
                'brand_keywords': sorted(list(self.brand_keywords)),
                'misleading_keywords': sorted(list(self.misleading_keywords)),
                'brand_mappings': self._serialize_brand_mappings(),
                'last_updated': datetime.now(timezone.utc).isoformat(),
                'version': '1.1'
            }
            
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=2)
            
            self.last_updated = datetime.now(timezone.utc)
            logger.info("Saved keywords config")
            
        except Exception as e:
            logger.error(f"Failed to save keywords config: {e}")
    
    def add_brand_keyword(self, keyword: str) -> bool:
        """Add a brand keyword"""
        keyword = keyword.lower().strip()
        if keyword and keyword not in self.brand_keywords:
            self.brand_keywords.add(keyword)
            self.save_config()
            logger.info(f"Added brand keyword: {keyword}")
            return True
        return False
    
    def remove_brand_keyword(self, keyword: str) -> bool:
        """Remove a brand keyword"""
        keyword = keyword.lower().strip()
        if keyword in self.brand_keywords:
            self.brand_keywords.remove(keyword)
            removed_mapping = self.brand_mappings.pop(keyword, None)
            self.save_config()
            logger.info(f"Removed brand keyword: {keyword}")
            if removed_mapping:
                logger.info(f"Removed brand mapping for {keyword}")
            return True
        return False
    
    def add_misleading_keyword(self, keyword: str) -> bool:
        """Add a misleading keyword"""
        keyword = keyword.lower().strip()
        if keyword and keyword not in self.misleading_keywords:
            self.misleading_keywords.add(keyword)
            self.save_config()
            logger.info(f"Added misleading keyword: {keyword}")
            return True
        return False
    
    def remove_misleading_keyword(self, keyword: str) -> bool:
        """Remove a misleading keyword"""
        keyword = keyword.lower().strip()
        if keyword in self.misleading_keywords:
            self.misleading_keywords.remove(keyword)
            self.save_config()
            logger.info(f"Removed misleading keyword: {keyword}")
            return True
        return False
    
    def bulk_update_brand_keywords(self, keywords: Set[str]):
        """Replace all brand keywords"""
        self.brand_keywords = {k.lower().strip() for k in keywords if k.strip()}
        # Drop mappings that are no longer referenced
        self.brand_mappings = {
            brand: domain
            for brand, domain in self.brand_mappings.items()
            if brand in self.brand_keywords
        }
        self.save_config()
        logger.info(f"Bulk updated {len(self.brand_keywords)} brand keywords")
    
    def bulk_update_misleading_keywords(self, keywords: Set[str]):
        """Replace all misleading keywords"""
        self.misleading_keywords = {k.lower().strip() for k in keywords if k.strip()}
        self.save_config()
        logger.info(f"Bulk updated {len(self.misleading_keywords)} misleading keywords")
    
    def get_all_keywords(self) -> Dict[str, Any]:
        """Get all keywords and metadata"""
        return {
            'brand_keywords': sorted(list(self.brand_keywords)),
            'misleading_keywords': sorted(list(self.misleading_keywords)),
            'brand_count': len(self.brand_keywords),
            'misleading_count': len(self.misleading_keywords),
            'brand_mappings': self._serialize_brand_mappings(),
            'brand_mapping_count': len(self.brand_mappings),
            'last_updated': self.last_updated.isoformat()
        }

    def get_brand_mappings(self) -> Dict[str, str]:
        """Return brand to legitimate domain mappings."""
        return dict(self.brand_mappings)

    def set_brand_mapping(self, brand: str, domain: str) -> bool:
        """Create or update a brand to domain mapping."""
        brand_key = (brand or "").lower().strip()
        domain_value = (domain or "").strip()

        if not brand_key or not domain_value:
            return False

        existing = self.brand_mappings.get(brand_key)
        self.brand_mappings[brand_key] = domain_value
        self.brand_keywords.add(brand_key)
        self.save_config()

        if existing and existing != domain_value:
            logger.info(f"Updated brand mapping: {brand_key} -> {domain_value}")
        elif not existing:
            logger.info(f"Added brand mapping: {brand_key} -> {domain_value}")
        return True

    def remove_brand_mapping(self, brand: str) -> bool:
        """Remove a brand to domain mapping."""
        brand_key = (brand or "").lower().strip()
        if not brand_key:
            return False

        removed = self.brand_mappings.pop(brand_key, None)
        if removed is not None:
            # Keep keyword unless explicitly removed elsewhere
            self.save_config()
            logger.info(f"Removed brand mapping for {brand_key}")
            return True
        return False

    def _parse_brand_mappings(self, raw: Any) -> Dict[str, str]:
        """Normalize brand mapping payload from config file."""
        mappings: Dict[str, str] = {}

        if isinstance(raw, dict):
            iterable = raw.items()
        elif isinstance(raw, list):
            iterable = []
            for entry in raw:
                if isinstance(entry, dict):
                    brand = entry.get('brand') or entry.get('name')
                    domain = entry.get('domain') or entry.get('url')
                    if brand and domain:
                        iterable.append((brand, domain))
        else:
            iterable = []

        for brand, domain in iterable:
            brand_key = str(brand).lower().strip()
            domain_value = str(domain).strip()
            if brand_key and domain_value:
                mappings[brand_key] = domain_value

        if not mappings:
            mappings = DEFAULT_BRAND_MAPPINGS.copy()

        return mappings

    def _serialize_brand_mappings(self) -> List[Dict[str, str]]:
        """Serialize mappings for persistence."""
        return [
            {'brand': brand, 'domain': domain}
            for brand, domain in sorted(self.brand_mappings.items())
        ]
    
    def reload(self):
        """Reload configuration from file"""
        self.load_config()


# Global instance
_keyword_config: Optional[KeywordConfig] = None


def get_keyword_config() -> KeywordConfig:
    """Get or create global keyword config instance"""
    global _keyword_config
    if _keyword_config is None:
        _keyword_config = KeywordConfig()
    return _keyword_config


def reload_keyword_config():
    """Force reload of keyword configuration"""
    global _keyword_config
    if _keyword_config is not None:
        _keyword_config.reload()
    else:
        _keyword_config = KeywordConfig()

