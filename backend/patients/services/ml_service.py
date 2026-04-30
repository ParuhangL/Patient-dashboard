import pandas as pd
import numpy as np
from typing import Any, Dict, Optional, List
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.cluster import KMeans
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, r2_score
import warnings

warnings.filterwarnings("ignore")

from patients.services.base import BasePredictor


# ──────────────────────────────────────────────
# 1. TrendPredictor — Linear Regression
# ──────────────────────────────────────────────


class TrendPredictor(BasePredictor):
    """
    Predicts systolic BP trend by age using Linear Regression.
    Inheritance: BasePredictor
    """

    def __init__(self):
        super().__init__(model_name="TrendPredictor")
        self.model = LinearRegression()
        self.r2_score = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        features = self._select_features(X, ["age"])
        if features.empty or y is None:
            raise ValueError(
                "TrendPredictor requires 'age' column and a target series."
            )
        self.feature_columns = list(features.columns)
        self.model.fit(features, y)
        preds = self.model.predict(features)
        self.r2_score = round(r2_score(y, preds), 4)
        self.is_fitted = True

    def predict(self, X: pd.DataFrame) -> List[float]:
        self._check_fitted()
        features = self._select_features(X, self.feature_columns)
        return self.model.predict(features).tolist()

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "algorithm": "Linear Regression",
            "target": "blood_pressure_systolic",
            "features": self.feature_columns,
            "r2_score": self.r2_score,
            "coefficient": round(self.model.coef_[0], 4) if self.is_fitted else None,
            "intercept": round(self.model.intercept_, 4) if self.is_fitted else None,
        }


# ──────────────────────────────────────────────
# 2. PatientClusterer — KMeans Clustering
# ──────────────────────────────────────────────


class PatientClusterer(BasePredictor):
    """
    Groups patients into health profiles using KMeans.
    Inheritance: BasePredictor
    """

    CLUSTER_LABELS = {
        0: "Low Risk",
        1: "Moderate Risk",
        2: "High Risk",
    }

    def __init__(self, n_clusters: int = 3):
        super().__init__(model_name="PatientClusterer")
        self.n_clusters = n_clusters
        self.model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        self.scaler = StandardScaler()
        self.inertia = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        features = self._select_features(
            X, ["age", "bmi", "blood_pressure_systolic", "glucose_level"]
        )
        if features.empty:
            raise ValueError(
                "PatientClusterer requires at least one of: age, bmi, blood_pressure_systolic, glucose_level"
            )
        self.feature_columns = list(features.columns)
        scaled = self.scaler.fit_transform(features)
        self.model.fit(scaled)
        self.inertia = round(self.model.inertia_, 4)
        self.is_fitted = True

    def predict(self, X: pd.DataFrame) -> List[Dict]:
        self._check_fitted()
        features = self._select_features(X, self.feature_columns)
        scaled = self.scaler.transform(features)
        cluster_ids = self.model.predict(scaled).tolist()
        return [
            {
                "cluster_id": cid,
                "profile": self.CLUSTER_LABELS.get(cid, f"Cluster {cid}"),
            }
            for cid in cluster_ids
        ]

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "algorithm": "KMeans Clustering",
            "n_clusters": self.n_clusters,
            "features": self.feature_columns,
            "inertia": self.inertia,
            "cluster_labels": self.CLUSTER_LABELS,
        }


# ──────────────────────────────────────────────
# 3. DiseasePredictor — Logistic Regression
# ──────────────────────────────────────────────


class DiseasePredictor(BasePredictor):
    """
    Predicts diabetes probability using Logistic Regression.
    Inheritance: BasePredictor
    """

    def __init__(self):
        super().__init__(model_name="DiseasePredictor")
        self.model = LogisticRegression(random_state=42, max_iter=1000)
        self.scaler = StandardScaler()
        self.accuracy = None
        self.classes = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        if y is None:
            raise ValueError("DiseasePredictor requires a target series (is_diabetic).")
        features = self._select_features(
            X,
            [
                "age",
                "bmi",
                "glucose_level",
                "blood_pressure_systolic",
                "is_smoker",
                "has_hypertension",
            ],
        )
        if features.empty:
            raise ValueError("DiseasePredictor: no usable feature columns found.")
        self.feature_columns = list(features.columns)
        scaled = self.scaler.fit_transform(features)

        if len(y.unique()) < 2:
            raise ValueError("DiseasePredictor needs at least 2 classes in target.")

        self.model.fit(scaled, y)
        preds = self.model.predict(scaled)
        self.accuracy = round(accuracy_score(y, preds), 4)
        self.classes = self.model.classes_.tolist()
        self.is_fitted = True

    def predict(self, X: pd.DataFrame) -> List[Dict]:
        self._check_fitted()
        features = self._select_features(X, self.feature_columns)
        scaled = self.scaler.transform(features)
        predictions = self.model.predict(scaled).tolist()
        probabilities = self.model.predict_proba(scaled).tolist()
        return [
            {
                "prediction": "Diabetic" if pred == 1 else "Non-Diabetic",
                "probability_diabetic": round(prob[1], 4),
                "probability_non_diabetic": round(prob[0], 4),
            }
            for pred, prob in zip(predictions, probabilities)
        ]

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "algorithm": "Logistic Regression",
            "target": "is_diabetic",
            "features": self.feature_columns,
            "accuracy": self.accuracy,
            "classes": self.classes,
        }


# ──────────────────────────────────────────────
# 4. DiagnosisTreePredictor — Decision Tree
# ──────────────────────────────────────────────


class DiagnosisTreePredictor(BasePredictor):
    """
    Interpretable diagnosis using Decision Tree.
    Inheritance: BasePredictor
    """

    RISK_LABELS = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}

    def __init__(self, max_depth: int = 4):
        super().__init__(model_name="DiagnosisTreePredictor")
        self.model = DecisionTreeClassifier(
            max_depth=max_depth, random_state=42, class_weight="balanced"
        )
        self.max_depth = max_depth
        self.accuracy = None
        self.feature_importances = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        if y is None:
            raise ValueError(
                "DiagnosisTreePredictor requires a target series (risk_label)."
            )
        features = self._select_features(
            X,
            [
                "age",
                "bmi",
                "glucose_level",
                "blood_pressure_systolic",
                "blood_pressure_diastolic",
                "heart_rate",
                "cholesterol",
                "is_smoker",
                "has_hypertension",
            ],
        )
        if features.empty:
            raise ValueError("DiagnosisTreePredictor: no usable feature columns found.")
        self.feature_columns = list(features.columns)
        self.model.fit(features, y)
        preds = self.model.predict(features)
        self.accuracy = round(accuracy_score(y, preds), 4)
        self.feature_importances = {
            col: round(float(imp), 4)
            for col, imp in zip(self.feature_columns, self.model.feature_importances_)
        }
        self.is_fitted = True

    def predict(self, X: pd.DataFrame) -> List[Dict]:
        self._check_fitted()
        features = self._select_features(X, self.feature_columns)
        predictions = self.model.predict(features).tolist()
        probabilities = self.model.predict_proba(features).tolist()
        classes = self.model.classes_.tolist()
        return [
            {
                "risk_label": self.RISK_LABELS.get(pred, str(pred)),
                "confidence": round(max(prob), 4),
                "probabilities": {
                    self.RISK_LABELS.get(cls, str(cls)): round(p, 4)
                    for cls, p in zip(classes, prob)
                },
            }
            for pred, prob in zip(predictions, probabilities)
        ]

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "algorithm": "Decision Tree",
            "target": "risk_label",
            "max_depth": self.max_depth,
            "features": self.feature_columns,
            "accuracy": self.accuracy,
            "feature_importances": self.feature_importances,
        }


# ──────────────────────────────────────────────
# 5. RuleBasedPredictor — Rule Engine
# ──────────────────────────────────────────────


class RuleBasedPredictor(BasePredictor):
    """
    Rule-based diagnosis engine using explicit clinical thresholds.
    Polymorphism: implements the same fit/predict interface as ML predictors.
    Abstraction: rules encapsulated, callers only see risk_label + reasons.
    """

    RULES = [
        {
            "name": "Hyperglycemia",
            "column": "glucose_level",
            "threshold": 126,
            "operator": ">",
            "risk_contribution": 2,
            "reason": "Glucose > 126 mg/dL (diabetic range)",
        },
        {
            "name": "Pre-diabetes",
            "column": "glucose_level",
            "threshold": 100,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Glucose 100–125 mg/dL (pre-diabetic range)",
        },
        {
            "name": "Hypertensive Crisis",
            "column": "blood_pressure_systolic",
            "threshold": 140,
            "operator": ">",
            "risk_contribution": 2,
            "reason": "Systolic BP > 140 mmHg (hypertensive)",
        },
        {
            "name": "Elevated BP",
            "column": "blood_pressure_systolic",
            "threshold": 120,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Systolic BP 120–139 mmHg (elevated)",
        },
        {
            "name": "Obese BMI",
            "column": "bmi",
            "threshold": 30,
            "operator": ">",
            "risk_contribution": 2,
            "reason": "BMI > 30 (obese)",
        },
        {
            "name": "Overweight BMI",
            "column": "bmi",
            "threshold": 25,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "BMI 25–29.9 (overweight)",
        },
        {
            "name": "High Cholesterol",
            "column": "cholesterol",
            "threshold": 200,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Cholesterol > 200 mg/dL (borderline high)",
        },
        {
            "name": "Smoker",
            "column": "is_smoker",
            "threshold": 0,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Active smoker",
        },
        {
            "name": "Hypertension Flag",
            "column": "has_hypertension",
            "threshold": 0,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Diagnosed hypertension",
        },
        {
            "name": "Senior Age",
            "column": "age",
            "threshold": 60,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Age > 60 (elevated baseline risk)",
        },
    ]

    RISK_THRESHOLDS = {
        "LOW": (0, 2),
        "MEDIUM": (3, 5),
        "HIGH": (6, 999),
    }

    def __init__(self):
        super().__init__(model_name="RuleBasedPredictor")
        self.is_fitted = True  # No training needed — rule engine is always ready

    def fit(self, X: pd.DataFrame, y=None) -> None:
        """No fitting required for rule-based engine."""
        self.feature_columns = [
            r["column"] for r in self.RULES if r["column"] in X.columns
        ]
        self.is_fitted = True

    def _evaluate_row(self, row: dict) -> Dict[str, Any]:
        score = 0
        triggered_reasons = []

        for rule in self.RULES:
            col = rule["column"]
            val = row.get(col, None)
            if val is None:
                continue
            try:
                val = float(val)
            except (ValueError, TypeError):
                continue

            if rule["operator"] == ">" and val > rule["threshold"]:
                # Avoid double-counting layered rules (e.g. glucose >126 also >100)
                # Only add the highest applicable contribution per column group
                score += rule["risk_contribution"]
                triggered_reasons.append(rule["reason"])

        # Deduplicate by keeping only the highest-contribution reason per column
        seen_columns = {}
        deduped_reasons = []
        for rule in self.RULES:
            col = rule["column"]
            val = row.get(col, None)
            if val is None:
                continue
            try:
                val = float(val)
            except (ValueError, TypeError):
                continue
            if rule["operator"] == ">" and val > rule["threshold"]:
                if col not in seen_columns:
                    seen_columns[col] = rule
                    deduped_reasons.append(rule["reason"])

        # Recompute score using deduplicated rules
        deduped_score = sum(
            seen_columns[col]["risk_contribution"] for col in seen_columns
        )

        risk_label = "LOW"
        for label, (low, high) in self.RISK_THRESHOLDS.items():
            if low <= deduped_score <= high:
                risk_label = label
                break

        return {
            "risk_label": risk_label,
            "risk_score": deduped_score,
            "triggered_rules": deduped_reasons,
            "confidence": round(min(deduped_score / 6.0, 1.0), 4),
        }

    def predict(self, X: pd.DataFrame) -> List[Dict]:
        self._check_fitted()
        return [self._evaluate_row(row) for row in X.to_dict(orient="records")]

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "algorithm": "Rule-Based Engine",
            "target": "risk_label",
            "total_rules": len(self.RULES),
            "risk_thresholds": self.RISK_THRESHOLDS,
            "features_used": [r["column"] for r in self.RULES],
        }


# ──────────────────────────────────────────────
# 6. MLAnalysisService — Orchestrator
# ──────────────────────────────────────────────


class MLAnalysisService:
    """
    Orchestrates all 4 ML models on a cleaned DataFrame.
    Encapsulates model coordination and result aggregation.
    """

    def __init__(self):
        self.trend_predictor = TrendPredictor()
        self.clusterer = PatientClusterer()
        self.disease_predictor = DiseasePredictor()
        self.diagnosis_tree = DiagnosisTreePredictor()
        self.rule_predictor = RuleBasedPredictor()

    def _build_risk_target(self, df: pd.DataFrame) -> pd.Series:
        """
        Derives a numeric risk label (0/1/2) from available columns.
        Used as target for DiseasePredictor and DiagnosisTreePredictor.
        """

        def score_row(row):
            score = 0
            if row.get("glucose_level", 0) > 125:
                score += 1
            if row.get("bmi", 0) > 30:
                score += 1
            if row.get("blood_pressure_systolic", 0) > 135:
                score += 1
            if row.get("is_smoker", 0):
                score += 1
            if row.get("has_hypertension", 0):
                score += 1
            if score <= 1:
                return 0  # LOW
            elif score <= 3:
                return 1  # MEDIUM
            else:
                return 2  # HIGH

        return df.apply(score_row, axis=1)

    def _build_diabetic_target(self, df: pd.DataFrame) -> pd.Series:
        """
        Derives binary diabetic label from glucose + is_diabetic if present.
        """
        if "is_diabetic" in df.columns:
            return df["is_diabetic"].astype(int)
        # fallback: glucose > 125 as proxy
        return (df.get("glucose_level", pd.Series([0] * len(df))) > 125).astype(int)

    def run(self, df: pd.DataFrame) -> Dict[str, Any]:
        results = {}
        errors = {}

        # 1. TrendPredictor
        try:
            if "age" in df.columns and "blood_pressure_systolic" in df.columns:
                self.trend_predictor.fit(df, df["blood_pressure_systolic"])
                results["trend_prediction"] = {
                    "predictions": self.trend_predictor.predict(df),
                    "model_info": self.trend_predictor.get_model_info(),
                }
        except Exception as e:
            errors["trend_prediction"] = str(e)

        # 2. PatientClusterer
        try:
            self.clusterer.fit(df)
            results["clustering"] = {
                "predictions": self.clusterer.predict(df),
                "model_info": self.clusterer.get_model_info(),
            }
        except Exception as e:
            errors["clustering"] = str(e)

        # 3. DiseasePredictor
        try:
            diabetic_target = self._build_diabetic_target(df)
            if len(diabetic_target.unique()) >= 2:
                self.disease_predictor.fit(df, diabetic_target)
                results["disease_prediction"] = {
                    "predictions": self.disease_predictor.predict(df),
                    "model_info": self.disease_predictor.get_model_info(),
                }
            else:
                errors["disease_prediction"] = (
                    "Not enough class variation in diabetic target."
                )
        except Exception as e:
            errors["disease_prediction"] = str(e)

        # 4. DiagnosisTreePredictor
        try:
            risk_target = self._build_risk_target(df)
            if len(risk_target.unique()) >= 2:
                self.diagnosis_tree.fit(df, risk_target)
                results["diagnosis_tree"] = {
                    "predictions": self.diagnosis_tree.predict(df),
                    "model_info": self.diagnosis_tree.get_model_info(),
                }
            else:
                errors["diagnosis_tree"] = "Not enough risk variation in dataset."
        except Exception as e:
            errors["diagnosis_tree"] = str(e)

        # 5. RuleBasedPredictor
        try:
            self.rule_predictor.fit(df)
            results["rule_based"] = {
                "predictions": self.rule_predictor.predict(df),
                "model_info": self.rule_predictor.get_model_info(),
            }
        except Exception as e:
            errors["rule_based"] = str(e)

        return {
            "status": "completed" if not errors else "partial",
            "results": results,
            "errors": errors,
            "rows_analysed": len(df),
        }
