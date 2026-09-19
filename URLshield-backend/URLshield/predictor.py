"""ML Model predictor for backend phishing detection"""

import pandas as pd
import numpy as np
import xgboost as xgb
import joblib
from pathlib import Path
from typing import Tuple, Optional, Dict, Any

from URLshield.logger import get_logger

logger = get_logger(__name__)


MODEL_PATH = Path("models/xgboost_phishing_model.pkl")
LABEL_ENCODER_PATH = Path("models/label_encoder.pkl")
SCALER_PATH = Path("models/scaler.pkl")


def is_model_available() -> bool:
    """Return True when all ML artifacts required for prediction exist."""
    return (
        MODEL_PATH.exists()
        and LABEL_ENCODER_PATH.exists()
        and SCALER_PATH.exists()
    )


class PhishingModelPredictor:
    """Phishing detection model predictor"""
    
    def __init__(self, model_path: str, label_encoder_path: str = 'label_encoder.pkl', 
                 scaler_path: str = 'scaler.pkl'):
        """Initialize predictor with model and preprocessing artifacts"""
        self.model_path = Path(model_path)
        self.label_encoder_path = Path(label_encoder_path)
        self.scaler_path = Path(scaler_path)
        self.model = None
        self.label_encoder = None
        self.scaler = None
        
    def load_model(self):
        """Load model and preprocessing objects"""
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model not found: {self.model_path}")
        if not self.label_encoder_path.exists():
            raise FileNotFoundError(f"Label encoder not found: {self.label_encoder_path}")
        if not self.scaler_path.exists():
            raise FileNotFoundError(f"Scaler not found: {self.scaler_path}")
            
        # Load preprocessing objects
        self.label_encoder = joblib.load(self.label_encoder_path)
        self.scaler = joblib.load(self.scaler_path)
        
        # Load model
        if str(self.model_path).endswith('.pkl'):
            self.model = joblib.load(self.model_path)
        else:
            self.model = xgb.XGBClassifier()
            self.model.load_model(str(self.model_path))
    
    def predict(self, new_data: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Make predictions on new data
        
        Parameters:
        - new_data: DataFrame with features
        
        Returns:
        - predictions: Predicted class labels
        - probabilities: Prediction probabilities
        """
        if self.model is None:
            self.load_model()
        
        # Define the raw input features (before encoding)
        raw_features = [
            'url_length', 'domain_length', 'path_length', 'num_subdomains', 'num_dots',
            'domain_num_hyphens', 'num_special_chars', 'ip_address', 'url_entropy',
            'is_idn', 'typosquatting_score', 'brand_word_present', 'misleading_keyword_present',
            'brand_position', 'domain_age_days', 'HTTPS', 'Is_Tunneling', 'ttl_avg', 'ssim_score',
            'favicon_similarity_score', 'asn_number', 'reverse_dns_entropy'
        ]

        # Copy and ensure all raw features are present
        df = new_data.copy()
        
        logger.info("=" * 80)
        logger.info("🔍 ML PREDICTION PIPELINE - DATA FLOW")
        logger.info("=" * 80)
        
        # Log incoming raw features
        logger.info("📥 STEP 1: RAW INPUT FEATURES")
        raw_feature_sample = {k: v for k, v in df.iloc[0].to_dict().items() if k in raw_features}
        for feature, value in raw_feature_sample.items():
            logger.info(f"   {feature}: {value} ({type(value).__name__})")
        
        for feature in raw_features:
            if feature not in df.columns:
                # Set default values for missing features
                if feature == 'HTTPS':
                    df[feature] = False
                elif feature == 'typosquatting_score':
                    df[feature] = 'Low'
                elif feature == 'brand_position':
                    df[feature] = 'none'
                elif feature == 'domain_age_days' or feature == 'ttl_avg' or feature == 'reverse_dns_entropy' or feature == 'ssim_score' or feature == 'favicon_similarity_score' or feature == 'asn_number':
                    df[feature] = np.nan  # Use NaN for missing numeric features (matches training data)
                else:
                    df[feature] = 0
                logger.info(f"   ⚠️  {feature}: MISSING - using default {df[feature].iloc[0]}")
        
        # PREPROCESSING STEP 1: Encode typosquatting_score to ordinal (1, 2, 3)
        logger.info("\n🔄 STEP 2: ORDINAL ENCODING")
        typosquatting_mapping = {'Low': 1, 'Medium': 2, 'High': 3}
        if 'typosquatting_score' in df.columns:
            original_value = df['typosquatting_score'].iloc[0]
            df['typosquatting_score_encoded'] = df['typosquatting_score'].map(typosquatting_mapping)
            encoded_value = df['typosquatting_score_encoded'].iloc[0]
            logger.info(f"   typosquatting_score: '{original_value}' → {encoded_value}")
        
        # PREPROCESSING STEP 2: One-hot encode brand_position and HTTPS (drop_first=True as in training)
        logger.info("\n🔄 STEP 3: ONE-HOT ENCODING")
        logger.info(f"   brand_position: '{df['brand_position'].iloc[0]}'")
        logger.info(f"   HTTPS: {df['HTTPS'].iloc[0]}")
        
        df_encoded = pd.get_dummies(df, columns=['brand_position', 'HTTPS'], drop_first=True)
        
        # Log created one-hot columns
        one_hot_cols = [col for col in df_encoded.columns if col.startswith('brand_position_') or col.startswith('HTTPS_')]
        if one_hot_cols:
            logger.info("   Created columns:")
            for col in one_hot_cols:
                logger.info(f"      {col}: {df_encoded[col].iloc[0]}")
        
        # Get expected features from model
        logger.info("\n🎯 STEP 4: FEATURE ALIGNMENT")
        try:
            booster = self.model.get_booster()
            expected_features = booster.feature_names
            logger.info(f"   Model expects {len(expected_features)} features")
        except Exception:
            # Fallback: construct expected features manually
            logger.warning("Could not get feature names from model, using fallback")
            expected_features = None
        
        if expected_features is None:
            raise ValueError("Model does not expose feature names. Cannot align features.")
        
        # Ensure all expected features exist (add missing ones with 0)
        missing_features = []
        for col in expected_features:
            if col not in df_encoded.columns:
                df_encoded[col] = 0
                missing_features.append(col)
        
        if missing_features:
            logger.info(f"   Added {len(missing_features)} missing features with default value 0")
            logger.info(f"   Missing: {missing_features[:5]}{'...' if len(missing_features) > 5 else ''}")
        
        # Select only the features the model expects, in the correct order
        X_new = df_encoded.reindex(columns=expected_features, fill_value=0)
        logger.info(f"   ✅ Aligned to {len(X_new.columns)} features in correct order")
        
        # PREPROCESSING STEP 3: Scale numerical features
        logger.info("\n📏 STEP 5: FEATURE SCALING")
        numerical_columns = ['url_length', 'domain_length', 'path_length', 'num_subdomains',
                            'num_dots', 'domain_num_hyphens', 'num_special_chars', 'url_entropy',
                            'domain_age_days', 'ttl_avg', 'ssim_score', 'favicon_similarity_score',
                            'asn_number', 'reverse_dns_entropy']
        
        # Filter to only columns that exist in X_new
        numerical_columns = [col for col in numerical_columns if col in X_new.columns]
        logger.info(f"   Scaling {len(numerical_columns)} numerical features")
        
        # Show before/after for a few key features
        sample_features = ['url_length', 'domain_age_days', 'ttl_avg']
        before_values = {}
        for feat in sample_features:
            if feat in X_new.columns:
                before_values[feat] = X_new[feat].iloc[0]
        
        if numerical_columns:
            # Convert to float first (None becomes NaN automatically in numeric context)
            # XGBoost requires numeric dtypes (int, float, bool) - object dtype will fail
            X_numeric = X_new[numerical_columns].apply(pd.to_numeric, errors='coerce')
            scaled_values = self.scaler.transform(X_numeric)
            
            # Convert DataFrame columns to float64 type before assignment
            for col in numerical_columns:
                if col in X_new.columns:
                    X_new[col] = X_new[col].astype('float64')
            
            # Now safely assign scaled values
            for i, col in enumerate(numerical_columns):
                if col in X_new.columns:
                    X_new[col] = scaled_values[:, i]
        
        # Log before/after scaling
        logger.info("   Sample scaling (before → after):")
        for feat in sample_features:
            if feat in before_values:
                after = X_new[feat].iloc[0]
                before_val = before_values[feat]
                # Handle NaN values in logging
                if pd.isna(before_val) or pd.isna(after):
                    logger.info(f"      {feat}: {before_val} → {after}")
                else:
                    logger.info(f"      {feat}: {before_val:.2f} → {after:.4f}")
        
        # Make predictions
        logger.info("\n🤖 STEP 6: MODEL PREDICTION")
        predictions = self.model.predict(X_new)
        probabilities = self.model.predict_proba(X_new)
        
        # Convert numeric predictions back to labels
        prediction_labels = self.label_encoder.inverse_transform(predictions)
        
        # Normalize labels to lowercase for consistency
        normalized_labels = [label.lower() for label in prediction_labels]
        
        # Log prediction results
        logger.info(f"   Raw prediction (numeric): {predictions[0]}")
        logger.info(f"   Prediction label (original): {prediction_labels[0]}")
        logger.info(f"   Prediction label (normalized): {normalized_labels[0]}")
        logger.info(f"   Class probabilities:")
        for label, prob in zip(self.label_encoder.classes_, probabilities[0]):
            logger.info(f"      {label}: {prob:.4f} ({prob*100:.2f}%)")
        
        # Return normalized labels
        return np.array(normalized_labels), probabilities
        
        # Get feature importance explanation
        logger.info("\n💡 STEP 7: FEATURE IMPORTANCE & REASONING")
        feature_importance = self._get_feature_importance_explanation(X_new, df)
        logger.info(f"   Top features influencing this prediction:")
        for i, (feature, value, importance) in enumerate(feature_importance[:10], 1):
            logger.info(f"      {i}. {feature}: {value} (importance: {importance:.4f})")
        
        logger.info("=" * 80)
        
        # Store feature importance for later use
        self._last_feature_importance = feature_importance
        
        return prediction_labels, probabilities
    
    def _get_feature_importance_explanation(self, X_processed: pd.DataFrame, X_raw: pd.DataFrame) -> list:
        """
        Get feature importance with actual values for explanation
        
        Parameters:
        - X_processed: Processed features (after encoding and scaling)
        - X_raw: Raw features (before encoding)
        
        Returns:
        - List of tuples (feature_name, value, importance_score)
        """
        try:
            # Get feature importances from the model
            feature_importances = self.model.feature_importances_
            
            # Combine with feature names and values
            importance_data = []
            for i, (feature_name, importance) in enumerate(zip(X_processed.columns, feature_importances)):
                # Get the processed value
                processed_value = X_processed.iloc[0][feature_name]
                
                # Try to get raw value if it exists
                raw_value = processed_value
                if feature_name in X_raw.columns:
                    raw_value = X_raw.iloc[0][feature_name]
                elif feature_name == 'typosquatting_score_encoded' and 'typosquatting_score' in X_raw.columns:
                    raw_value = X_raw.iloc[0]['typosquatting_score']
                elif feature_name.startswith('brand_position_') and 'brand_position' in X_raw.columns:
                    raw_value = f"brand_position={X_raw.iloc[0]['brand_position']}"
                elif feature_name.startswith('HTTPS_') and 'HTTPS' in X_raw.columns:
                    raw_value = f"HTTPS={X_raw.iloc[0]['HTTPS']}"
                
                importance_data.append((feature_name, raw_value, importance))
            
            # Sort by importance (descending)
            importance_data.sort(key=lambda x: x[2], reverse=True)
            
            return importance_data
            
        except Exception as e:
            logger.warning(f"Could not get feature importance: {e}")
            return []
    
    def _generate_reasoning(self, prediction: str, features: Dict[str, Any]) -> list:
        """
        Generate human-readable reasoning for the prediction
        
        Parameters:
        - prediction: The prediction label
        - features: Raw feature dictionary
        
        Returns:
        - List of reasoning strings
        """
        reasons = []
        is_phishing = prediction.lower() == "phishing"
        
        # Domain age reasoning
        domain_age = features.get('domain_age_days', 0)
        if domain_age > 0:
            if domain_age < 30:
                reasons.append(f"Domain is very new ({domain_age:.0f} days old) - suspicious")
            elif domain_age < 365:
                reasons.append(f"Domain is relatively new ({domain_age:.0f} days old)")
            else:
                years = domain_age / 365
                reasons.append(f"Domain is established ({years:.1f} years old) - trustworthy")
        
        # HTTPS reasoning
        if not features.get('HTTPS', False):
            reasons.append("Website does not use HTTPS - security risk")
        
        # Typosquatting reasoning
        typo_score = features.get('typosquatting_score', 'Low')
        if typo_score == 'High':
            reasons.append("Domain appears to be typosquatting a known brand - high risk")
        elif typo_score == 'Medium':
            reasons.append("Domain shows similarity to known brands - moderate risk")
        
        # Brand detection
        if features.get('brand_word_present', 0) == 1:
            brand_pos = features.get('brand_position', 'none')
            if brand_pos == 'subdomain':
                reasons.append("Brand name found in subdomain - common phishing tactic")
            elif brand_pos == 'root_domain':
                reasons.append("Brand name in root domain - likely legitimate")
            else:
                reasons.append("Brand name detected in URL")
        
        # Misleading keywords
        if features.get('misleading_keyword_present', 0) == 1:
            reasons.append("URL contains misleading keywords (login, secure, verify, etc.)")
        
        # URL structure
        url_length = features.get('url_length', 0)
        if url_length > 75:
            reasons.append(f"URL is unusually long ({url_length} characters) - suspicious")
        
        num_subdomains = features.get('num_subdomains', 0)
        if num_subdomains > 3:
            reasons.append(f"URL has many subdomains ({num_subdomains}) - suspicious")
        
        # Visual similarity
        ssim_score = features.get('ssim_score', 0)
        if ssim_score is not None and ssim_score > 0.7:
            reasons.append(f"Website appearance is very similar to known brand (SSIM: {ssim_score:.2f})")
        elif ssim_score is not None and ssim_score > 0.4:
            reasons.append(f"Website has some visual similarity to known brand (SSIM: {ssim_score:.2f})")
        
        # Favicon similarity
        favicon_sim = features.get('favicon_similarity_score', 0)
        if favicon_sim is not None and favicon_sim > 0.8:
            reasons.append(f"Favicon matches known brand ({favicon_sim:.2f}) - could be impersonation")
        
        # Network indicators
        ttl = features.get('ttl_avg', 0)
        if ttl is not None and ttl > 0 and ttl < 300:
            reasons.append(f"Low DNS TTL ({ttl:.0f}s) - may indicate temporary/malicious infrastructure")
        
        # If no specific reasons, add generic one
        if not reasons:
            if is_phishing:
                reasons.append("Multiple indicators suggest this is a phishing attempt")
            else:
                reasons.append("URL appears legitimate based on analyzed features")
        
        return reasons
    
    def predict_from_features_dict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict from features dictionary (from features.json)
        
        Parameters:
        - features: Dictionary with extracted features
        
        Returns:
        - Dictionary with prediction, confidence, and probabilities
        """
        try:
            # Convert None values back to np.nan for numeric features
            # (None comes from JSON null, but pandas/XGBoost needs np.nan)
            numeric_features = [
                'domain_age_days', 'ttl_avg', 'ssim_score', 
                'favicon_similarity_score', 'asn_number', 'reverse_dns_entropy'
            ]
            for key in numeric_features:
                if key in features and features[key] is None:
                    features[key] = np.nan
            
            # Convert dict to DataFrame
            df = pd.DataFrame([features])
            
            # Make prediction
            predictions, probabilities = self.predict(df)
            
            # Get confidence (max probability)
            confidence = float(np.max(probabilities[0]))
            prediction = predictions[0]
            
            # Rule-based override: Force phishing prediction for obvious fake domains
            # This compensates for model bias toward "legitimate"
            domain_exists = features.get('domain_exists', 1)
            https_yes = features.get('HTTPS_Yes', 1)
            domain_age = features.get('domain_age_days', 9999)
            
            # Strong indicators of phishing
            if domain_exists == 0 or (https_yes == 0 and domain_age < 30):
                # Find the phishing class index
                phishing_classes = [cls for cls in self.label_encoder.classes_ 
                                   if 'phish' in cls.lower() or 'sus' in cls.lower() or 'bad' in cls.lower() or 'mal' in cls.lower()]
                if phishing_classes:
                    prediction = phishing_classes[0]
                    confidence = max(confidence, 0.85)  # Boost confidence
                    logger.warning(f"Rule override: Domain flagged as phishing due to strong indicators "
                                   f"(domain_exists={domain_exists}, HTTPS={https_yes}, age={domain_age})")
            
            # Get class probabilities
            class_probs = {
                label: float(prob) 
                for label, prob in zip(self.label_encoder.classes_, probabilities[0])
            }
            
            # Generate human-readable reasoning
            reasoning = self._generate_reasoning(prediction, features)
            top_features = []
            if hasattr(self, '_last_feature_importance') and self._last_feature_importance:
                top_features = [
                    {"feature": feat, "value": str(val), "importance": float(imp)}
                    for feat, val, imp in self._last_feature_importance[:5]
                ]
            
            result = {
                "prediction": prediction,
                "confidence": confidence,
                "probabilities": class_probs,
                "risk_score": confidence if prediction.lower() == "phishing" else (1 - confidence),
                "reasoning": reasoning,
                "top_features": top_features
            }
            
            logger.info("\n" + "=" * 80)
            logger.info("📊 FINAL PREDICTION RESULT")
            logger.info("=" * 80)
            logger.info(f"   Prediction: {prediction.upper()}")
            logger.info(f"   Confidence: {confidence:.2%}")
            logger.info(f"   Risk Score: {result['risk_score']:.2%}")
            logger.info(f"   All Probabilities: {class_probs}")
            logger.info(f"\n💭 REASONING:")
            for reason in reasoning:
                logger.info(f"   • {reason}")
            logger.info("=" * 80 + "\n")
            
            return result
            
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            return {
                "prediction": "unknown",
                "confidence": 0.0,
                "probabilities": {},
                "risk_score": 0.5,
                "error": str(e)
            }


# Global predictor instance (lazy loaded)
_predictor: Optional[PhishingModelPredictor] = None


def get_predictor() -> PhishingModelPredictor:
    """Get or create global predictor instance"""
    global _predictor
    if _predictor is None:
        if not is_model_available():
            logger.warning(f"Model not found at {MODEL_PATH}, predictions disabled")
            raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
        
        _predictor = PhishingModelPredictor(
            str(MODEL_PATH),
            str(LABEL_ENCODER_PATH),
            str(SCALER_PATH)
        )
        _predictor.load_model()
        logger.info("ML predictor loaded successfully")
    
    return _predictor


# Known safe domains that should never be marked as phishing
TRUSTED_DOMAINS = {
    'facebook.com', 'google.com', 'youtube.com', 'twitter.com', 'x.com',
    'instagram.com', 'linkedin.com', 'github.com', 'microsoft.com', 
    'apple.com', 'amazon.com', 'netflix.com', 'wikipedia.org',
    'yahoo.com', 'reddit.com', 'whatsapp.com', 'tiktok.com', 'bing.com'
}

def predict_from_features(features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Convenience function to predict from features dictionary
    
    Parameters:
    - features: Dictionary with extracted features (should have 'ml_features' key)
    
    Returns:
    - Prediction result dictionary or None if prediction fails
    """
    try:
        # Check allowlist for trusted domains
        input_url = features.get('input_url', '')
        if input_url:
            import tldextract
            extracted = tldextract.extract(input_url)
            domain_name = f"{extracted.domain}.{extracted.suffix}".lower()
            
            if domain_name in TRUSTED_DOMAINS:
                logger.info(f"Domain {domain_name} is in trusted allowlist. Forcing Legitimate prediction.")
                return {
                    "prediction": "legitimate",
                    "confidence": 0.99,
                    "probabilities": {"phishing": 0.0, "legitimate": 0.99, "suspected": 0.01},
                    "risk_score": 0.01,
                    "reasoning": [f"Domain '{domain_name}' is a known trusted service"],
                    "top_features": []
                }

        # Hard rule: if domain has NO DNS records (doesn't exist), force Phishing
        # Check if DNS A records exist in the extraction data
        dns_data = features.get('extraction', {}).get('dns', {})
        a_records = dns_data.get('a_records', [])
        
        if not a_records or len(a_records) == 0:
            logger.warning("Domain has no DNS A records, forcing Phishing prediction")
            return {
                "prediction": "Phishing",
                "confidence": 0.95,
                "probabilities": {"Phishing": 0.95, "Legitimate": 0.03, "Suspected": 0.02},
                "risk_score": 0.95,
                "reasoning": ["Domain does not exist (no DNS records) - strong phishing indicator"]
            }
        
        predictor = get_predictor()
        
        # Extract ml_features if nested
        if 'ml_features' in features:
            ml_features = features['ml_features']
        else:
            ml_features = features
        
        return predictor.predict_from_features_dict(ml_features)
    except FileNotFoundError:
        logger.warning("ML model not available, skipping prediction")
        return None
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return None

