from rest_framework import serializers
from patients.models import MedicalRecord
import datetime


class MedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "patient"]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def validate_visit_date(self, value):
        if value > datetime.date.today():
            raise serializers.ValidationError("Visit date cannot be in the future.")
        return value

    def validate_blood_pressure_systolic(self, value):
        if value is not None and not (50 <= value <= 260):
            raise serializers.ValidationError(
                "Systolic BP must be between 50 and 260 mmHg."
            )
        return value

    def validate_blood_pressure_diastolic(self, value):
        if value is not None and not (30 <= value <= 160):
            raise serializers.ValidationError(
                "Diastolic BP must be between 30 and 160 mmHg."
            )
        return value

    def validate_heart_rate(self, value):
        if value is not None and not (20 <= value <= 300):
            raise serializers.ValidationError(
                "Heart rate must be between 20 and 300 bpm."
            )
        return value

    def validate_glucose_level(self, value):
        if value is not None and not (20 <= value <= 700):
            raise serializers.ValidationError(
                "Glucose level must be between 20 and 700 mg/dL."
            )
        return value

    def validate_bmi(self, value):
        if value is not None and not (10 <= value <= 70):
            raise serializers.ValidationError("BMI must be between 10 and 70.")
        return value

    def validate_temperature(self, value):
        if value is not None and not (30 <= value <= 45):
            raise serializers.ValidationError(
                "Temperature must be between 30 and 45 °C."
            )
        return value

    def validate(self, data):
        systolic = data.get("blood_pressure_systolic")
        diastolic = data.get("blood_pressure_diastolic")
        if systolic is not None and diastolic is not None:
            if systolic <= diastolic:
                raise serializers.ValidationError(
                    "Systolic BP must be greater than diastolic BP."
                )
            if (systolic - diastolic) < 10:
                raise serializers.ValidationError(
                    "Pulse pressure (systolic − diastolic) must be at least 10 mmHg."
                )
        return data
