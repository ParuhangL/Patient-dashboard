from rest_framework import serializers
from patients.models import Patient


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
