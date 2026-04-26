from rest_framework import serializers
from patients.models import MedicalRecord


class MedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"

    def validate(self, data):
        systolic = data.get("blood_pressure_systolic")
        diastolic = data.get("blood_pressure_diastolic")
        if systolic and diastolic and systolic <= diastolic:
            raise serializers.ValidationError(
                "Systolic BP must be greater than diastolic BP."
            )
        return data
