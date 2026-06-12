import pandas as pd
import numpy as np
from typing import Any, Dict, Optional, List
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.cluster import KMeans
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, r2_score, confusion_matrix
import warnings
from datetime import date as date_type

warnings.filterwarnings("ignore")

from patients.services.base import BasePredictor


class TrendPredictor(BasePredictor):
    """
    Predicts systolic BP trend by age using Linear Regression.
    Inheritance: BasePredictor
    """

    def __init__(self):
        super().__init__(model_name="TrendPredictor")
        self.model = LinearRegression()
        self.model_dbp = LinearRegression()
        self.r2_score = None
        self.r2_score_dbp = None
        self.r2_score_test = None
        self.r2_score_dbp_test = None
        self.train_size = None
        self.test_size = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        features = self._select_features(X, ["age"])
        if features.empty or y is None:
            raise ValueError(
                "TrendPredictor requires 'age' column and a target series."
            )
        self.feature_columns = list(features.columns)

        if len(features) >= 10:
            X_train, X_test, y_train, y_test = train_test_split(
                features, y, test_size=0.2, random_state=42
            )
            dbp_col = (
                X["blood_pressure_diastolic"]
                if "blood_pressure_diastolic" in X.columns
                else None
            )
            if dbp_col is not None:
                _, _, dbp_train, dbp_test = train_test_split(
                    features, dbp_col, test_size=0.2, random_state=42
                )
        else:
            X_train, X_test, y_train, y_test = features, None, y, None
            dbp_col = (
                X["blood_pressure_diastolic"]
                if "blood_pressure_diastolic" in X.columns
                else None
            )
            dbp_train = dbp_col
            dbp_test = None

        self.train_size = len(X_train)
        self.test_size = len(X_test) if X_test is not None else 0

        self.model.fit(X_train, y_train)
        train_preds = self.model.predict(X_train)
        self.r2_score = round(r2_score(y_train, train_preds), 4)

        if X_test is not None:
            test_preds = self.model.predict(X_test)
            self.r2_score_test = round(r2_score(y_test, test_preds), 4)

        if dbp_col is not None:
            self.model_dbp.fit(X_train, dbp_train)
            train_preds_dbp = self.model_dbp.predict(X_train)
            self.r2_score_dbp = round(r2_score(dbp_train, train_preds_dbp), 4)

            if dbp_test is not None:
                test_preds_dbp = self.model_dbp.predict(X_test)
                self.r2_score_dbp_test = round(r2_score(dbp_test, test_preds_dbp), 4)

        self.is_fitted = True

    def predict(self, X: pd.DataFrame) -> List[Dict]:
        self._check_fitted()
        features = self._select_features(X, self.feature_columns)
        sbp_preds = self.model.predict(features).tolist()
        dbp_preds = (
            self.model_dbp.predict(features).tolist()
            if self.r2_score_dbp is not None
            else [None] * len(sbp_preds)
        )
        return [
            {
                "predicted_bp": round(sbp, 2),
                "predicted_systolic_bp": round(sbp, 2),
                "predicted_diastolic_bp": round(dbp, 2) if dbp is not None else None,
                "confidence": None,
            }
            for sbp, dbp in zip(sbp_preds, dbp_preds)
        ]

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "algorithm": "Linear Regression",
            "target": "blood_pressure_systolic",
            "features": self.feature_columns,
            "r2_score_train": self.r2_score,
            "r2_score_test": self.r2_score_test,
            "r2_score_dbp_train": self.r2_score_dbp,
            "r2_score_dbp_test": self.r2_score_dbp_test,
            "train_size": self.train_size,
            "test_size": self.test_size,
            "coefficient": round(self.model.coef_[0], 4) if self.is_fitted else None,
            "intercept": round(self.model.intercept_, 4) if self.is_fitted else None,
        }


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
        self.train_size = None
        self.test_size = None
        self.inertia_test = None

    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        features = self._select_features(
            X, ["age", "bmi", "blood_pressure_systolic", "glucose_level"]
        )
        if features.empty:
            raise ValueError(
                "PatientClusterer requires at least one of: age, bmi, blood_pressure_systolic, glucose_level"
            )
        self.feature_columns = list(features.columns)

        if len(features) >= 10:
            X_train, X_test = train_test_split(features, test_size=0.2, random_state=42)
        else:
            X_train, X_test = features, None

        self.train_size = len(X_train)
        self.test_size = len(X_test) if X_test is not None else 0

        scaled_train = self.scaler.fit_transform(X_train)
        self.model.fit(scaled_train)
        self.inertia = round(self.model.inertia_, 4)

        if X_test is not None:
            scaled_test = self.scaler.transform(X_test)
            labels_test = self.model.predict(scaled_test)
            centers = self.model.cluster_centers_
            inertia_test = sum(
                float(np.sum((scaled_test[i] - centers[labels_test[i]]) ** 2))
                for i in range(len(scaled_test))
            )
            self.inertia_test = round(inertia_test, 4)

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
                "confidence": None,
            }
            for cid in cluster_ids
        ]

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "algorithm": "KMeans Clustering",
            "n_clusters": self.n_clusters,
            "features": self.feature_columns,
            "inertia_train": self.inertia,
            "inertia_test": self.inertia_test,
            "train_size": self.train_size,
            "test_size": self.test_size,
            "cluster_labels": self.CLUSTER_LABELS,
        }


class DiseasePredictor(BasePredictor):
    """
    Predicts diabetes probability using Logistic Regression.
    Inheritance: BasePredictor
    """

    def __init__(self):
        super().__init__(model_name="DiseasePredictor")
        self.model = LogisticRegression(random_state=42, max_iter=1000)
        self.scaler = StandardScaler()
        self.accuracy_train = None
        self.accuracy_test = None
        self.train_size = None
        self.test_size = None
        self.classes = None
        self.confusion_matrix = None  # computed on test set

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

        if len(features) >= 10 and len(y.unique()) >= 2:
            X_train, X_test, y_train, y_test = train_test_split(
                features, y, test_size=0.2, random_state=42, stratify=y
            )
        else:
            X_train, X_test, y_train, y_test = features, None, y, None

        self.train_size = len(X_train)
        self.test_size = len(X_test) if X_test is not None else 0

        if len(y_train.unique()) < 2:
            raise ValueError("DiseasePredictor needs at least 2 classes in target.")

        scaled_train = self.scaler.fit_transform(X_train)
        self.model.fit(scaled_train, y_train)

        train_preds = self.model.predict(scaled_train)
        self.accuracy_train = round(accuracy_score(y_train, train_preds), 4)

        if X_test is not None:
            scaled_test = self.scaler.transform(X_test)
            test_preds = self.model.predict(scaled_test)
            self.accuracy_test = round(accuracy_score(y_test, test_preds), 4)

            # Confusion matrix on test set — rows=actual, cols=predicted
            # Classes are [0=Non-Diabetic, 1=Diabetic]
            cm = confusion_matrix(y_test, test_preds, labels=[0, 1])
            self.confusion_matrix = {
                "TN": int(cm[0][0]),
                "FP": int(cm[0][1]),
                "FN": int(cm[1][0]),
                "TP": int(cm[1][1]),
                "labels": ["Non-Diabetic", "Diabetic"],
            }

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
            "accuracy_train": self.accuracy_train,
            "accuracy_test": self.accuracy_test,
            "train_size": self.train_size,
            "test_size": self.test_size,
            "classes": self.classes,
            "confusion_matrix": self.confusion_matrix,
        }


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
        self.accuracy_train = None
        self.accuracy_test = None
        self.train_size = None
        self.test_size = None
        self.feature_importances = None
        self.confusion_matrix = None  # computed on test set

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

        if len(features) >= 10 and len(y.unique()) >= 2:
            X_train, X_test, y_train, y_test = train_test_split(
                features, y, test_size=0.2, random_state=42, stratify=y
            )
        else:
            X_train, X_test, y_train, y_test = features, None, y, None

        self.train_size = len(X_train)
        self.test_size = len(X_test) if X_test is not None else 0

        self.model.fit(X_train, y_train)

        train_preds = self.model.predict(X_train)
        self.accuracy_train = round(accuracy_score(y_train, train_preds), 4)

        if X_test is not None:
            test_preds = self.model.predict(X_test)
            self.accuracy_test = round(accuracy_score(y_test, test_preds), 4)

            # Confusion matrix on test set — rows=actual, cols=predicted
            # Classes: 0=LOW, 1=MEDIUM, 2=HIGH
            cm = confusion_matrix(y_test, test_preds, labels=[0, 1, 2])
            self.confusion_matrix = {
                "matrix": [[int(cell) for cell in row] for row in cm],
                "labels": ["LOW", "MEDIUM", "HIGH"],
            }

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
            "accuracy_train": self.accuracy_train,
            "accuracy_test": self.accuracy_test,
            "train_size": self.train_size,
            "test_size": self.test_size,
            "feature_importances": self.feature_importances,
            "confusion_matrix": self.confusion_matrix,
        }


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
            "name": "High Diastolic BP",
            "column": "blood_pressure_diastolic",
            "threshold": 90,
            "operator": ">",
            "risk_contribution": 2,
            "reason": "Diastolic BP > 90 mmHg (hypertensive range)",
        },
        {
            "name": "Elevated Diastolic BP",
            "column": "blood_pressure_diastolic",
            "threshold": 80,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Diastolic BP 80–90 mmHg (elevated)",
        },
        {
            "name": "High Heart Rate",
            "column": "heart_rate",
            "threshold": 100,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Heart rate > 100 bpm (tachycardia)",
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
            "name": "Very High Cholesterol",
            "column": "cholesterol",
            "threshold": 240,
            "operator": ">",
            "risk_contribution": 2,
            "reason": "Cholesterol > 240 mg/dL (high)",
        },
        {
            "name": "Borderline Cholesterol",
            "column": "cholesterol",
            "threshold": 200,
            "operator": ">",
            "risk_contribution": 1,
            "reason": "Cholesterol 200–240 mg/dL (borderline high)",
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
        self.is_fitted = True

    def fit(self, X: pd.DataFrame, y=None) -> None:
        self.feature_columns = [
            r["column"] for r in self.RULES if r["column"] in X.columns
        ]
        self.is_fitted = True

    def _evaluate_row(self, row: dict) -> Dict[str, Any]:
        seen_columns = {}
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

        deduped_score = sum(
            seen_columns[col]["risk_contribution"] for col in seen_columns
        )
        deduped_reasons = [seen_columns[col]["reason"] for col in seen_columns]

        risk_label = "LOW"
        for label, (low, high) in self.RISK_THRESHOLDS.items():
            if low <= deduped_score <= high:
                risk_label = label
                break

        return {
            "risk_label": risk_label,
            "risk_score": deduped_score,
            "triggered_rules": deduped_reasons,
            "confidence": 1.0,
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


class MLAnalysisService:
    """
    Orchestrates all ML models on a cleaned DataFrame.
    Loads persisted models from disk on init — shared across all users.
    Falls back to fresh instances when no saved model exists yet.
    Retrains on ALL patients in the DB, not just the current upload batch.
    """

    def __init__(self):
        self.trend_predictor = BasePredictor.load("TrendPredictor") or TrendPredictor()
        self.clusterer = BasePredictor.load("PatientClusterer") or PatientClusterer()
        self.disease_predictor = (
            BasePredictor.load("DiseasePredictor") or DiseasePredictor()
        )
        self.diagnosis_tree = (
            BasePredictor.load("DiagnosisTreePredictor") or DiagnosisTreePredictor()
        )
        self.rule_predictor = RuleBasedPredictor()

    def _build_full_df(self) -> pd.DataFrame:
        from patients.models import Patient

        qs = Patient.objects.all().values(
            "date_of_birth",
            "blood_pressure_systolic",
            "blood_pressure_diastolic",
            "heart_rate",
            "glucose_level",
            "bmi",
            "cholesterol",
            "is_smoker",
            "is_diabetic",
            "has_hypertension",
        )

        if not qs.exists():
            return pd.DataFrame()

        df = pd.DataFrame.from_records(qs)

        today = date_type.today()
        df["age"] = df["date_of_birth"].apply(
            lambda d: (today - d).days // 365 if pd.notna(d) and d is not None else None
        )
        df = df.drop(columns=["date_of_birth"])

        for col in ["is_smoker", "is_diabetic", "has_hypertension"]:
            if col in df.columns:
                df[col] = df[col].astype(int)

        numeric_cols = [
            "age",
            "blood_pressure_systolic",
            "blood_pressure_diastolic",
            "heart_rate",
            "glucose_level",
            "bmi",
            "cholesterol",
        ]
        existing_numeric = [c for c in numeric_cols if c in df.columns]
        df = df.dropna(subset=existing_numeric, how="all")

        for col in existing_numeric:
            if df[col].isnull().any():
                df[col] = df[col].fillna(df[col].median())

        return df.reset_index(drop=True)

    def _build_risk_target(self, df: pd.DataFrame) -> pd.Series:
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
                return 0
            elif score <= 3:
                return 1
            else:
                return 2

        return df.apply(score_row, axis=1)

    def _build_diabetic_target(self, df: pd.DataFrame) -> pd.Series:
        if "is_diabetic" in df.columns:
            return df["is_diabetic"].astype(int)
        return (df.get("glucose_level", pd.Series([0] * len(df))) > 125).astype(int)

    def run(self, df: pd.DataFrame) -> Dict[str, Any]:
        results = {}
        errors = {}

        train_df = self._build_full_df()
        if train_df.empty:
            train_df = df
            print(
                "[MLAnalysisService] Warning: DB empty, training on upload batch only."
            )
        else:
            print(f"[MLAnalysisService] Training on {len(train_df)} patients from DB.")

        # 1. TrendPredictor
        try:
            if (
                "age" in train_df.columns
                and "blood_pressure_systolic" in train_df.columns
            ):
                self.trend_predictor.fit(train_df, train_df["blood_pressure_systolic"])
                self.trend_predictor.save()
                predict_df = df if "age" in df.columns else train_df
                results["trend_prediction"] = {
                    "predictions": self.trend_predictor.predict(predict_df),
                    "model_info": self.trend_predictor.get_model_info(),
                }
        except Exception as e:
            errors["trend_prediction"] = str(e)

        # 2. PatientClusterer
        try:
            self.clusterer.fit(train_df)
            self.clusterer.save()
            results["clustering"] = {
                "predictions": self.clusterer.predict(df),
                "model_info": self.clusterer.get_model_info(),
            }
        except Exception as e:
            errors["clustering"] = str(e)

        # 3. DiseasePredictor
        try:
            diabetic_target = self._build_diabetic_target(train_df)
            if len(diabetic_target.unique()) >= 2:
                self.disease_predictor.fit(train_df, diabetic_target)
                self.disease_predictor.save()
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
            risk_target = self._build_risk_target(train_df)
            if len(risk_target.unique()) >= 2:
                self.diagnosis_tree.fit(train_df, risk_target)
                self.diagnosis_tree.save()
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
