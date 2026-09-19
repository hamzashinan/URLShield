"""
ML Feature Preparation
Transforms extracted features into the exact format required by the XGBoost model
"""

import numpy as np
from typing import Dict, Any
from URLshield.logger import get_logger

logger = get_logger(__name__)


def prepare_features_for_model(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform extracted features into the exact format required by the model
    
    Expected model features:
    - url_length (int/float)
    - domain_length (int/float)
    - path_length (int/float)
    - num_subdomains (int/float)
    - num_dots (int/float)
    - domain_num_hyphens (int/float)
    - num_special_chars (int/float)
    - url_entropy (float)
    - is_idn (0/1)
    - brand_word_present (0/1)
    - misleading_keyword_present (0/1)
    - domain_age_days (int/float or NaN)
    - Is_Tunneling (0/1)
    - ttl_avg (float or NaN)
    - ssim_score (float or NaN)
    - favicon_similarity_score (float or NaN)
    - asn_number (int/float or NaN)
    - reverse_dns_entropy (float or NaN)
    - typosquatting_score_encoded (1/2/3) - encoded from Low/Medium/High
    - brand_position_root_domain (0/1)
    - brand_position_subdomain (0/1)
    - HTTPS_Yes (0/1)
    
    Parameters:
    - features: Dictionary with extracted features
    
    Returns:
    - Dictionary with model-ready features
    """
    logger.info("🔄 Preparing features for ML model...")
    
    ml_features = {}
    
    # Direct copy features (no transformation needed)
    direct_features = [
        'url_length', 'domain_length', 'path_length', 'num_subdomains',
        'num_dots', 'domain_num_hyphens', 'num_special_chars', 'url_entropy',
        'is_idn', 'brand_word_present', 'misleading_keyword_present',
        'domain_age_days', 'Is_Tunneling', 'ttl_avg', 'ssim_score',
        'favicon_similarity_score', 'asn_number', 'reverse_dns_entropy'
    ]
    
    for feature in direct_features:
        if feature in features:
            value = features[feature]
            # Convert None to np.nan for numeric features
            if value is None and feature not in ['is_idn', 'brand_word_present', 'misleading_keyword_present', 'Is_Tunneling']:
                ml_features[feature] = np.nan
            else:
                ml_features[feature] = value
        else:
            # Set defaults for missing features
            if feature in ['is_idn', 'brand_word_present', 'misleading_keyword_present', 'Is_Tunneling']:
                ml_features[feature] = 0
            elif feature in ['domain_age_days', 'ttl_avg', 'ssim_score', 'favicon_similarity_score', 'asn_number', 'reverse_dns_entropy']:
                ml_features[feature] = np.nan
            else:
                ml_features[feature] = 0
    
    # Transform typosquatting_score to typosquatting_score_encoded
    typo_score = features.get('typosquatting_score', 'Low')
    typo_mapping = {'Low': 1, 'Medium': 2, 'High': 3}
    ml_features['typosquatting_score_encoded'] = typo_mapping.get(typo_score, 1)
    logger.info(f"   typosquatting_score: '{typo_score}' → {ml_features['typosquatting_score_encoded']}")
    
    # Transform brand_position to brand_position_root_domain and brand_position_subdomain
    brand_position = features.get('brand_position', 'none')
    ml_features['brand_position_root_domain'] = 1 if brand_position == 'root_domain' else 0
    ml_features['brand_position_subdomain'] = 1 if brand_position == 'subdomain' else 0
    logger.info(f"   brand_position: '{brand_position}' → root={ml_features['brand_position_root_domain']}, sub={ml_features['brand_position_subdomain']}")
    
    # Transform HTTPS to HTTPS_Yes
    https_value = features.get('HTTPS', False)
    ml_features['HTTPS_Yes'] = 1 if https_value else 0
    logger.info(f"   HTTPS: {https_value} → HTTPS_Yes={ml_features['HTTPS_Yes']}")
    
    # Add metadata (not used by model but useful for tracking)
    ml_features['domain'] = features.get('domain', '')
    ml_features['url'] = features.get('url', '')
    
    logger.info(f"✅ Feature preparation complete: {len(ml_features)} features ready for model")
    
    return ml_features


def validate_model_features(features: Dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Validate that all required features are present
    
    Parameters:
    - features: Dictionary with ML features
    
    Returns:
    - (is_valid, missing_features)
    """
    required_features = [
        'url_length', 'domain_length', 'path_length', 'num_subdomains',
        'num_dots', 'domain_num_hyphens', 'num_special_chars', 'url_entropy',
        'is_idn', 'brand_word_present', 'misleading_keyword_present',
        'domain_age_days', 'Is_Tunneling', 'ttl_avg', 'ssim_score',
        'favicon_similarity_score', 'asn_number', 'reverse_dns_entropy',
        'typosquatting_score_encoded', 'brand_position_root_domain',
        'brand_position_subdomain', 'HTTPS_Yes'
    ]
    
    missing = [f for f in required_features if f not in features]
    
    return len(missing) == 0, missing


def get_feature_summary(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get a human-readable summary of features
    
    Parameters:
    - features: Dictionary with ML features
    
    Returns:
    - Dictionary with feature summary
    """
    import pandas as pd
    
    summary = {
        'url_structure': {
            'url_length': features.get('url_length', 0),
            'domain_length': features.get('domain_length', 0),
            'path_length': features.get('path_length', 0),
            'num_subdomains': features.get('num_subdomains', 0),
            'num_dots': features.get('num_dots', 0),
            'domain_num_hyphens': features.get('domain_num_hyphens', 0),
            'num_special_chars': features.get('num_special_chars', 0),
            'url_entropy': features.get('url_entropy', 0.0),
        },
        'detection_features': {
            'is_idn': features.get('is_idn', 0),
            'brand_word_present': features.get('brand_word_present', 0),
            'misleading_keyword_present': features.get('misleading_keyword_present', 0),
            'typosquatting_score_encoded': features.get('typosquatting_score_encoded', 1),
            'brand_position_root_domain': features.get('brand_position_root_domain', 0),
            'brand_position_subdomain': features.get('brand_position_subdomain', 0),
        },
        'network_features': {
            'domain_age_days': features.get('domain_age_days', np.nan),
            'HTTPS_Yes': features.get('HTTPS_Yes', 0),
            'Is_Tunneling': features.get('Is_Tunneling', 0),
            'ttl_avg': features.get('ttl_avg', np.nan),
            'asn_number': features.get('asn_number', np.nan),
            'reverse_dns_entropy': features.get('reverse_dns_entropy', np.nan),
        },
        'similarity_features': {
            'ssim_score': features.get('ssim_score', np.nan),
            'favicon_similarity_score': features.get('favicon_similarity_score', np.nan),
        }
    }
    
    return summary


