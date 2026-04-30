from django.db import models
from django.contrib.auth.models import User
from .base import BaseHealthEntity


class BatchAnalysisReport(BaseHealthEntity):
    STATUS_CHOICES = [
        ("completed", "Completed"),
        ("partial", "Partial"),
        ("failed", "Failed"),
    ]

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="batch_reports",
        null=True,
        blank=True,
    )

    file_name = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="completed"
    )
    total_rows = models.IntegerField(default=0)
    linked_patients = models.IntegerField(default=0)
    unlinked_rows = models.IntegerField(default=0)
    etl_report = models.JSONField(default=dict)
    ml_results = models.JSONField(default=dict)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.file_name} — {self.total_rows} rows ({self.created_at.date()})"
