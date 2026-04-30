from rest_framework import serializers
from patients.models import Patient
import re


class PatientListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""

    risk_level = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()

    class Meta:
        model = Patient
        fields = [
            "id",
            "first_name",
            "last_name",
            "age",
            "gender",
            "risk_level",
            "bmi",
            "is_active",
            "created_at",
        ]


class PatientSerializer(serializers.ModelSerializer):
    """Full serializer with all fields + computed properties."""

    risk_level = serializers.ReadOnlyField()
    age = serializers.ReadOnlyField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    # ── Personal Info ─────────────────────────────────────────────────────

    def validate_first_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("First name is required.")
        if len(value) < 2:
            raise serializers.ValidationError(
                "First name must be at least 2 characters."
            )
        if len(value) > 50:
            raise serializers.ValidationError(
                "First name must be 50 characters or fewer."
            )
        if not re.match(r"^[a-zA-Z\s\-']+$", value):
            raise serializers.ValidationError(
                "First name may only contain letters, spaces, hyphens, and apostrophes."
            )
        return value

    def validate_last_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Last name is required.")
        if len(value) < 2:
            raise serializers.ValidationError(
                "Last name must be at least 2 characters."
            )
        if len(value) > 50:
            raise serializers.ValidationError(
                "Last name must be 50 characters or fewer."
            )
        if not re.match(r"^[a-zA-Z\s\-']+$", value):
            raise serializers.ValidationError(
                "Last name may only contain letters, spaces, hyphens, and apostrophes."
            )
        return value

    def validate_gender(self, value):
        allowed = ["M", "F", "O"]
        if value not in allowed:
            raise serializers.ValidationError(
                f"Gender must be one of: {', '.join(allowed)}."
            )
        return value

    def validate_date_of_birth(self, value):
        if value is None:
            return value
        from django.utils import timezone

        today = timezone.now().date()
        if value > today:
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        age = (today - value).days // 365
        if age > 130:
            raise serializers.ValidationError(
                "Date of birth is too far in the past (over 130 years)."
            )
        return value

    def validate_email(self, value):
        if value == "" or value is None:
            return None
        value = value.strip().lower()
        if len(value) > 254:
            raise serializers.ValidationError("Email address is too long.")
        # Check uniqueness excluding current instance on update
        qs = Patient.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A patient with this email already exists."
            )
        return value

    def validate_phone(self, value):
        if not value:
            return value
        value = value.strip()
        # Allow digits, spaces, dashes, parentheses, plus sign
        if not re.match(r"^[\d\s\-\+\(\)]{7,20}$", value):
            raise serializers.ValidationError(
                "Enter a valid phone number (7–20 characters, digits/spaces/dashes/parentheses/+ allowed)."
            )
        return value

    # ── Health Metrics ────────────────────────────────────────────────────

    def validate_blood_pressure_systolic(self, value):
        if value is None:
            return value
        if not (50 <= value <= 300):
            raise serializers.ValidationError(
                "Systolic BP must be between 50 and 300 mmHg."
            )
        return value

    def validate_blood_pressure_diastolic(self, value):
        if value is None:
            return value
        if not (30 <= value <= 200):
            raise serializers.ValidationError(
                "Diastolic BP must be between 30 and 200 mmHg."
            )
        return value

    def validate_heart_rate(self, value):
        if value is None:
            return value
        if not (20 <= value <= 300):
            raise serializers.ValidationError(
                "Heart rate must be between 20 and 300 bpm."
            )
        return value

    def validate_glucose_level(self, value):
        if value is None:
            return value
        if not (20 <= value <= 600):
            raise serializers.ValidationError(
                "Glucose level must be between 20 and 600 mg/dL."
            )
        return value

    def validate_bmi(self, value):
        if value is None:
            return value
        if not (10.0 <= value <= 80.0):
            raise serializers.ValidationError("BMI must be between 10 and 80.")
        return value

    def validate_cholesterol(self, value):
        if value is None:
            return value
        if not (50 <= value <= 700):
            raise serializers.ValidationError(
                "Cholesterol must be between 50 and 700 mg/dL."
            )
        return value

    # ── Cross-field validation ────────────────────────────────────────────

    def validate(self, data):
        systolic = data.get("blood_pressure_systolic")
        diastolic = data.get("blood_pressure_diastolic")

        # On update, fall back to existing instance values if not provided
        if self.instance:
            systolic = (
                systolic
                if systolic is not None
                else self.instance.blood_pressure_systolic
            )
            diastolic = (
                diastolic
                if diastolic is not None
                else self.instance.blood_pressure_diastolic
            )

        if systolic is not None and diastolic is not None:
            if diastolic >= systolic:
                raise serializers.ValidationError(
                    {
                        "blood_pressure_diastolic": "Diastolic BP must be lower than systolic BP."
                    }
                )
            if (systolic - diastolic) < 10:
                raise serializers.ValidationError(
                    {
                        "blood_pressure_diastolic": "Pulse pressure (systolic − diastolic) must be at least 10 mmHg."
                    }
                )

        return data

    @property
    def age(self):
        from datetime import date

        if not self.date_of_birth:
            return None
        today = date.today()
        born = self.date_of_birth
        return (today.year - born.year) - (
            (today.month, today.day) < (born.month, born.day)
        )
