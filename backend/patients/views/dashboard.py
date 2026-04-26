from rest_framework.views import APIView
from rest_framework.response import Response
from patients.models import Patient, MedicalRecord, AnalysisResult


class DashboardSummaryView(APIView):
    """GET /api/dashboard/ — aggregated stats for dashboard cards + charts."""

    def get(self, request):
        patients = Patient.objects.filter(is_active=True)
        total = patients.count()

        if total == 0:
            return Response(
                {
                    "summary": {
                        "total_patients": 0,
                        "total_records": 0,
                        "total_analyses": 0,
                    },
                    "risk_distribution": [],
                    "gender_distribution": [],
                    "condition_prevalence": [],
                }
            )

        # Risk distribution
        risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        gender_dist = {}
        condition_counts = {
            "Diabetic": 0,
            "Hypertension": 0,
            "Smokers": 0,
        }

        for p in patients:
            # Risk
            risk = p.risk_level
            risk_counts[risk] = risk_counts.get(risk, 0) + 1

            # Gender
            g = p.get_gender_display() if p.gender else "Unknown"
            gender_dist[g] = gender_dist.get(g, 0) + 1

            # Conditions
            if p.is_diabetic:
                condition_counts["Diabetic"] += 1
            if p.has_hypertension:
                condition_counts["Hypertension"] += 1
            if p.is_smoker:
                condition_counts["Smokers"] += 1

        return Response(
            {
                "summary": {
                    "total_patients": total,
                    "total_records": MedicalRecord.objects.count(),
                    "total_analyses": AnalysisResult.objects.count(),
                },
                "risk_distribution": [
                    {"risk": k, "count": v} for k, v in risk_counts.items()
                ],
                "gender_distribution": [
                    {"gender": k, "count": v} for k, v in gender_dist.items()
                ],
                "condition_prevalence": [
                    {"condition": k, "count": v} for k, v in condition_counts.items()
                ],
            }
        )
