from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from .base import BaseHealthEntity


class Patient(BaseHealthEntity):
    # ── Owner ──────────────────────────────────────────────────────────
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="patients",
        null=True,  # null for now so existing rows don't break migration
        blank=True,
    )

    # ── Demographics ───────────────────────────────────────────────────
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(
        max_length=10, choices=[("M", "Male"), ("F", "Female"), ("O", "Other")]
    )
    email = models.EmailField(unique=True, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True)

    # ── Health Metrics ─────────────────────────────────────────────────
    blood_pressure_systolic = models.FloatField(
        validators=[MinValueValidator(50), MaxValueValidator(300)],
        null=True,
        blank=True,
    )
    blood_pressure_diastolic = models.FloatField(
        validators=[MinValueValidator(30), MaxValueValidator(200)],
        null=True,
        blank=True,
    )
    heart_rate = models.FloatField(null=True, blank=True)
    glucose_level = models.FloatField(null=True, blank=True)
    bmi = models.FloatField(null=True, blank=True)
    cholesterol = models.FloatField(null=True, blank=True)

    # ── Lifestyle ──────────────────────────────────────────────────────
    is_smoker = models.BooleanField(default=False)
    is_diabetic = models.BooleanField(default=False)
    has_hypertension = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def age(self):
        from datetime import date

        today = date.today()
        born = self.date_of_birth
        return (today.year - born.year) - (
            (today.month, today.day) < (born.month, born.day)
        )

    @property
    def risk_level(self):
        score = 0
        if self.blood_pressure_systolic:
            if self.blood_pressure_systolic >= 140:
                score += 2
            elif self.blood_pressure_systolic >= 130:
                score += 1
        if self.glucose_level:
            if self.glucose_level >= 126:
                score += 2
            elif self.glucose_level >= 100:
                score += 1
        if self.bmi and self.bmi >= 30:
            score += 1
        if self.cholesterol:
            if self.cholesterol >= 240:
                score += 2
            elif self.cholesterol >= 200:
                score += 1
        if self.is_smoker:
            score += 1
        if self.is_diabetic:
            score += 1
        if self.has_hypertension:
            score += 1

        if score >= 5:
            return "HIGH"
        elif score >= 2:
            return "MEDIUM"
        return "LOW"
