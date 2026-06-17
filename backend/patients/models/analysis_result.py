from django.db import models
from .base import BaseHealthEntity
from .patient import Patient


class AnalysisResult(BaseHealthEntity):
    """
    Stores ML model outputs for a patient.
    OOP: Inherits BaseHealthEntity.
    """

    MODEL_CHOICES = [
        ("linear_regression", "Linear Regression"),
        ("kmeans", "KMeans Clustering"),
        ("logistic", "Logistic Regression"),
        ("decision_tree", "Decision Tree"),
        ("rule_based", "Rule Based"),
        ("isolation_forest", "Isolation Forest"),
    ]

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="analyses"
    )
    model_type = models.CharField(max_length=50, choices=MODEL_CHOICES)
    result = models.JSONField()
    confidence = models.FloatField(null=True, blank=True)
    risk_label = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.patient} — {self.model_type}"

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("patient", "model_type")]
