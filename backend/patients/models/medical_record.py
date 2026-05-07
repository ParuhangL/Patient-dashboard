from django.db import models
from .base import BaseHealthEntity
from .patient import Patient


class MedicalRecord(BaseHealthEntity):
    """
    Time-series health data per patient.
    Each row = one checkup/visit.
    OOP: Inherits BaseHealthEntity, linked to Patient via ForeignKey.
    """

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name="records"
    )
    visit_date = models.DateField()
    diagnosis = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    # Vitals recorded at this visit
    blood_pressure_systolic = models.FloatField(null=True, blank=True)
    blood_pressure_diastolic = models.FloatField(null=True, blank=True)
    heart_rate = models.FloatField(null=True, blank=True)
    glucose_level = models.FloatField(null=True, blank=True)
    bmi = models.FloatField(null=True, blank=True)
    temperature = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["-visit_date"]

    def __str__(self):
        return f"{self.patient} — {self.visit_date}"
