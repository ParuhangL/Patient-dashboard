from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Avg
from patients.models import Patient, MedicalRecord, AnalysisResult


class DashboardSummaryView(APIView):
    def get(self, request):
        patients = Patient.objects.filter(owner=request.user, is_active=True)
        total = patients.count()

        if total == 0:
            return Response(
                {
                    "summary": {
                        "total_patients": 0,
                        "total_records": 0,
                        "total_analyses": 0,
                        "avg_bmi": None,
                        "avg_glucose": None,
                        "avg_bp_systolic": None,
                        "avg_age": None,
                    },
                    "risk_distribution": [],
                    "gender_distribution": [],
                    "condition_prevalence": [],
                }
            )

        aggs = patients.aggregate(
            avg_bmi=Avg("bmi"),
            avg_glucose=Avg("glucose_level"),
            avg_bp_systolic=Avg("blood_pressure_systolic"),
        )

        from datetime import date

        ages = [
            (date.today() - p.date_of_birth).days // 365
            for p in patients
            if p.date_of_birth
        ]
        avg_age = round(sum(ages) / len(ages), 1) if ages else None

        risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        gender_dist = {}
        condition_counts = {"Diabetic": 0, "Hypertension": 0, "Smokers": 0}

        for p in patients:
            risk_counts[p.risk_level] = risk_counts.get(p.risk_level, 0) + 1
            g = p.get_gender_display() if p.gender else "Unknown"
            gender_dist[g] = gender_dist.get(g, 0) + 1
            if p.is_diabetic:
                condition_counts["Diabetic"] += 1
            if p.has_hypertension:
                condition_counts["Hypertension"] += 1
            if p.is_smoker:
                condition_counts["Smokers"] += 1

        patient_ids = patients.values_list("id", flat=True)

        return Response(
            {
                "summary": {
                    "total_patients": total,
                    "total_records": MedicalRecord.objects.filter(
                        patient_id__in=patient_ids
                    ).count(),
                    "total_analyses": AnalysisResult.objects.filter(
                        patient_id__in=patient_ids
                    ).count(),
                    "avg_bmi": round(aggs["avg_bmi"], 1) if aggs["avg_bmi"] else None,
                    "avg_glucose": (
                        round(aggs["avg_glucose"], 1) if aggs["avg_glucose"] else None
                    ),
                    "avg_bp_systolic": (
                        round(aggs["avg_bp_systolic"], 1)
                        if aggs["avg_bp_systolic"]
                        else None
                    ),
                    "avg_age": avg_age,
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
