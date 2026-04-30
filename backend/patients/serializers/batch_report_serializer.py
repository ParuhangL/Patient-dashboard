from rest_framework import serializers
from patients.models import BatchAnalysisReport


class BatchAnalysisReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BatchAnalysisReport
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
