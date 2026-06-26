from abc import ABC, abstractmethod
import pandas as pd
import numpy as np
from typing import Any, Dict, Optional
from pathlib import Path
import joblib

SAVED_MODELS_DIR = Path(__file__).resolve().parent.parent.parent / "saved_models"
SAVED_MODELS_DIR.mkdir(exist_ok=True)


class BasePredictor(ABC):
    """
    Abstract base class for all ML predictors.
    Enforces a common interface via abstraction and inheritance.
    """

    def __init__(self, model_name: str):
        self.model_name = model_name
        self.model = None
        self.is_fitted = False
        self.feature_columns: list = []

    @abstractmethod
    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> None:
        """Train the model on input features X and optional target y."""
        pass

    @abstractmethod
    def predict(self, X: pd.DataFrame) -> Any:
        """Return predictions for input features X."""
        pass

    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        """Return a dict describing model type, params, and status."""
        pass

    def _check_fitted(self):
        """Encapsulated guard — raises if model hasn't been trained."""
        if not self.is_fitted:
            raise RuntimeError(
                f"{self.model_name} must be fitted before calling predict()."
            )

    def _select_features(self, df: pd.DataFrame, columns: list) -> pd.DataFrame:
        """
        Safely selects only available columns from df.
        Handles missing columns gracefully.
        """
        available = [c for c in columns if c in df.columns]
        missing = set(columns) - set(available)
        if missing:
            print(
                f"[{self.model_name}] Warning: missing columns {missing}, skipping them."
            )
        return df[available].copy()

    def _model_path(self) -> Path:
        """Returns the .joblib file path for this predictor."""
        return SAVED_MODELS_DIR / f"{self.model_name}.joblib"

    def save(self) -> None:
        """
        Persist the entire predictor instance to disk.
        Called after a successful fit() so the trained state survives
        across Django restarts and is shared across all users.
        """
        if not self.is_fitted:
            raise RuntimeError(
                f"Cannot save {self.model_name}: model has not been fitted yet."
            )
        path = self._model_path()
        joblib.dump(self, path)
        print(f"[{self.model_name}] Saved to {path}")

    @classmethod
    def load(cls, model_name: str) -> Optional["BasePredictor"]:
        """
        Load a previously saved predictor from disk.
        Returns the instance if the file exists, None otherwise.
        Callers should check for None and fall back to retraining.
        """
        path = SAVED_MODELS_DIR / f"{model_name}.joblib"
        if not path.exists():
            print(f"[{model_name}] No saved model found at {path}")
            return None
        try:
            instance = joblib.load(path)
            print(f"[{model_name}] Loaded from {path}")
            return instance
        except Exception as e:
            print(f"[{model_name}] Failed to load saved model: {e}")
            return None

    def __repr__(self):
        status = "fitted" if self.is_fitted else "not fitted"
        return f"<{self.model_name} ({status})>"
