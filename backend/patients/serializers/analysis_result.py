from rest_framework import serializers
from patients.models import AnalysisResult


class AnalysisResultSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = AnalysisResult
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_patient_name(self, obj):
        return f"{obj.patient.first_name} {obj.patient.last_name}"
