from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from patients.services.etl import ETLPipeline
from patients.services.ml_service import MLAnalysisService
from patients.models import Patient, AnalysisResult, BatchAnalysisReport
from patients.serializers import BatchAnalysisReportSerializer
import pandas as pd
import traceback
from patients.services.ml_service import MLAnalysisService, RuleBasedPredictor


class DataUploadView(APIView):
    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            pipeline = ETLPipeline()
            df, report = pipeline.run(file, file.name)

            if report.errors:
                return Response(
                    {"error": report.errors}, status=status.HTTP_400_BAD_REQUEST
                )

            records = pipeline.df_to_records(df)

            return Response(
                {
                    "report": report.to_dict(),
                    "preview": records[:10],
                    "total_rows": len(records),
                }
            )

        except Exception as e:
            print(traceback.format_exc())
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AnalyseView(APIView):
    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response(
                {"error": "No file provided."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # ---------------- ETL ----------------
            pipeline = ETLPipeline()
            df, report = pipeline.run(file, file.name)

            if report.errors:
                return Response(
                    {"error": report.errors}, status=status.HTTP_400_BAD_REQUEST
                )

            df = df.reset_index(drop=True)

            # ---------------- ML ----------------
            ml_service = MLAnalysisService()
            ml_output = ml_service.run(df)

            results = ml_output.get("results") or {}

            # Attach patient names to each model's predictions
            patient_names = []
            for _, row in df.iterrows():
                first = str(row.get("first_name", "")).strip()
                last = str(row.get("last_name", "")).strip()
                name = f"{first} {last}".strip() or "Unknown"
                patient_names.append(name)

            for model_key in results:
                preds = results[model_key].get("predictions", [])
                for i, pred in enumerate(preds):
                    name = (
                        patient_names[i] if i < len(patient_names) else f"Patient {i+1}"
                    )
                    if isinstance(pred, dict):
                        pred["patient_name"] = name
                    elif isinstance(pred, (int, float)):
                        results[model_key]["predictions"][i] = {
                            "value": pred,
                            "patient_name": name,
                        }

            diagnosis_preds = results.get("diagnosis_tree", {}).get("predictions") or []
            disease_preds = (
                results.get("disease_prediction", {}).get("predictions") or []
            )
            rule_preds = results.get("rule_based", {}).get("predictions") or []
            trend_preds = results.get("trend_prediction", {}).get("predictions") or []
            cluster_preds = results.get("clustering", {}).get("predictions") or []

            linked_count = 0
            created_count = 0

            # ---------------- Helpers ----------------
            def safe_float(val):
                if pd.isna(val):
                    return None
                try:
                    return float(val)
                except (ValueError, TypeError):
                    return None

            def safe_bool(val):
                if pd.isna(val):
                    return False
                return str(val).strip().lower() in ("1", "true", "yes")

            def safe_date(val):
                if pd.isna(val):
                    return None
                try:
                    return pd.to_datetime(val, errors="coerce").date()
                except Exception:
                    return None

            # ---------------- Processing ----------------
            for idx, (_, row) in enumerate(df.iterrows()):
                patient = None

                email = row.get("email")
                email_clean = (
                    str(email).strip()
                    if pd.notna(email) and str(email).strip()
                    else None
                )

                if email_clean:
                    patient = Patient.objects.filter(
                        email=email_clean, owner=request.user
                    ).first()

                if not patient:
                    first = str(row.get("first_name", "")).strip()
                    last = str(row.get("last_name", "")).strip()
                    if first and last:
                        patient = Patient.objects.filter(
                            first_name__iexact=first,
                            last_name__iexact=last,
                            owner=request.user,
                        ).first()

                fields = {
                    "first_name": str(row.get("first_name", "Unknown")).strip()
                    or "Unknown",
                    "last_name": str(row.get("last_name", "")).strip(),
                    "gender": str(row.get("gender", "O")).strip()[:1].upper() or "O",
                    "phone": str(row.get("phone", "")).strip(),
                    "blood_pressure_systolic": safe_float(
                        row.get("blood_pressure_systolic")
                    ),
                    "blood_pressure_diastolic": safe_float(
                        row.get("blood_pressure_diastolic")
                    ),
                    "heart_rate": safe_float(row.get("heart_rate")),
                    "glucose_level": safe_float(row.get("glucose_level")),
                    "bmi": safe_float(row.get("bmi")),
                    "cholesterol": safe_float(row.get("cholesterol")),
                    "is_smoker": safe_bool(row.get("is_smoker")),
                    "is_diabetic": safe_bool(row.get("is_diabetic")),
                    "has_hypertension": safe_bool(row.get("has_hypertension")),
                }

                dob = safe_date(row.get("date_of_birth"))
                if dob:
                    fields["date_of_birth"] = dob

                email_clean = (
                    str(email).strip()
                    if pd.notna(email) and str(email).strip()
                    else None
                )
                if email_clean:
                    fields["email"] = email_clean

                # ---------------- Create / Update ----------------
                if email_clean:
                    patient, created = Patient.objects.get_or_create(
                        email=email_clean,
                        owner=request.user,
                        defaults=fields,
                    )
                    if created:
                        created_count += 1
                    else:
                        for attr, val in fields.items():
                            if val not in (None, ""):
                                setattr(patient, attr, val)
                        patient.save()
                        linked_count += 1
                else:
                    # No email — match by first_name + last_name + date_of_birth
                    patient = Patient.objects.filter(
                        owner=request.user,
                        first_name=fields.get("first_name", ""),
                        last_name=fields.get("last_name", ""),
                        date_of_birth=fields.get("date_of_birth"),
                    ).first()
                    if patient:
                        for attr, val in fields.items():
                            if val not in (None, ""):
                                setattr(patient, attr, val)
                        patient.save()
                        linked_count += 1
                    else:
                        Patient.objects.create(owner=request.user, **fields)
                        created_count += 1

                # ---------------- Save ML Results ----------------

                # Decision Tree
                if idx < len(diagnosis_preds):
                    pred = diagnosis_preds[idx]
                    if isinstance(pred, dict):
                        AnalysisResult.objects.get_or_create(
                            patient=patient,
                            model_type="decision_tree",
                            notes=f"Batch upload: {file.name}",
                            defaults={
                                "result": pred,
                                "confidence": pred.get("confidence"),
                                "risk_label": pred.get("risk_label", ""),
                            },
                        )

                # Logistic Regression
                if idx < len(disease_preds):
                    pred = disease_preds[idx]
                    if isinstance(pred, dict):
                        conf = max(
                            pred.get("probability_diabetic") or 0,
                            pred.get("probability_non_diabetic") or 0,
                        )
                        AnalysisResult.objects.get_or_create(
                            patient=patient,
                            model_type="logistic",
                            notes=f"Batch upload: {file.name}",
                            defaults={
                                "result": pred,
                                "confidence": round(conf, 4),
                                "risk_label": pred.get("prediction", ""),
                            },
                        )

                # Rule Based
                if idx < len(rule_preds):
                    pred = rule_preds[idx]
                    if isinstance(pred, dict):
                        AnalysisResult.objects.get_or_create(
                            patient=patient,
                            model_type="rule_based",
                            notes=f"Batch upload: {file.name}",
                            defaults={
                                "result": pred,
                                "confidence": pred.get("confidence"),
                                "risk_label": pred.get("risk_label", ""),
                            },
                        )

                # Linear Regression (Trend Prediction)
                if idx < len(trend_preds):
                    pred = trend_preds[idx]
                    val = pred.get("predicted_bp") if isinstance(pred, dict) else pred
                    bp_risk = (
                        "HIGH"
                        if (val or 0) > 140
                        else "MEDIUM" if (val or 0) > 120 else "LOW"
                    )
                    AnalysisResult.objects.get_or_create(
                        patient=patient,
                        model_type="linear_regression",
                        notes=f"Batch upload: {file.name}",
                        defaults={
                            "result": {"predicted_systolic_bp": val},
                            "confidence": None,
                            "risk_label": bp_risk,
                        },
                    )

                # KMeans Clustering
                if idx < len(cluster_preds):
                    pred = cluster_preds[idx]
                    if isinstance(pred, dict):
                        AnalysisResult.objects.get_or_create(
                            patient=patient,
                            model_type="kmeans",
                            notes=f"Batch upload: {file.name}",
                            defaults={
                                "result": pred,
                                "confidence": None,
                                "risk_label": pred.get("profile", ""),
                            },
                        )

            # ---------------- Batch Report ----------------
            batch_report = BatchAnalysisReport.objects.create(
                owner=request.user,
                file_name=file.name,
                status=ml_output.get("status", "completed"),
                total_rows=len(df),
                linked_patients=linked_count,
                unlinked_rows=0,
                etl_report=report.to_dict(),
                ml_results=ml_output,
                notes=f"{created_count} new patients created, {linked_count} updated.",
            )

            return Response(
                {
                    "etl_report": report.to_dict(),
                    "ml_results": ml_output,
                    "total_rows": len(df),
                    "batch_report_id": batch_report.id,
                    "linked_patients": linked_count,
                    "created_patients": created_count,
                    "unlinked_rows": 0,
                }
            )

        except Exception as e:
            traceback.print_exc()
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PredictView(APIView):
    def post(self, request):
        rows = request.data.get("data")

        if not rows or not isinstance(rows, list):
            return Response(
                {"error": "Provide 'data' as a list of patient row objects."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            df = pd.DataFrame(rows)
            ml_service = MLAnalysisService()
            ml_output = ml_service.run(df)
            return Response(ml_output)

        except Exception as e:
            print(traceback.format_exc())
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BatchReportListView(APIView):
    def get(self, request):
        reports = BatchAnalysisReport.objects.filter(owner=request.user)
        serializer = BatchAnalysisReportSerializer(reports, many=True)
        return Response(serializer.data)


class AnalysePatientView(APIView):
    def post(self, request, pk):
        try:
            patient = Patient.objects.get(pk=pk, owner=request.user)
        except Patient.DoesNotExist:
            return Response(
                {"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND
            )

        row = {
            "age": patient.age or 0,
            "blood_pressure_systolic": patient.blood_pressure_systolic or 0,
            "blood_pressure_diastolic": patient.blood_pressure_diastolic or 0,
            "heart_rate": patient.heart_rate or 0,
            "glucose_level": patient.glucose_level or 0,
            "bmi": float(patient.bmi) if patient.bmi else 0,
            "cholesterol": patient.cholesterol or 0,
            "is_smoker": int(patient.is_smoker),
            "is_diabetic": int(patient.is_diabetic),
            "has_hypertension": int(patient.has_hypertension),
        }
        df = pd.DataFrame([row])

        results = {}
        errors = {}

        # 1. Rule-based
        try:
            rule_predictor = RuleBasedPredictor()
            rule_predictor.fit(df)
            preds = rule_predictor.predict(df)
            results["rule_based"] = {
                "predictions": preds,
                "model_info": rule_predictor.get_model_info(),
            }
            pred = preds[0]
            AnalysisResult.objects.create(
                patient=patient,
                model_type="rule_based",
                result=pred,
                confidence=pred.get("confidence"),
                risk_label=pred.get("risk_label", ""),
                notes="Single patient analysis",
            )
        except Exception as e:
            errors["rule_based"] = str(e)

        # 2. Logistic Regression
        try:
            glucose = row["glucose_level"]
            bmi = row["bmi"]
            is_diabetic_flag = patient.is_diabetic

            score = 0
            if glucose > 125:
                score += 3
            elif glucose > 100:
                score += 1
            if bmi > 30:
                score += 2
            elif bmi > 25:
                score += 1
            if row["has_hypertension"]:
                score += 1
            if row["is_smoker"]:
                score += 1
            if row["age"] > 45:
                score += 1

            prob_diabetic = round(min(score / 8.0, 0.97), 4)
            if is_diabetic_flag:
                prob_diabetic = max(prob_diabetic, 0.65)

            prob_non = round(1 - prob_diabetic, 4)
            prediction = "Diabetic" if prob_diabetic >= 0.5 else "Non-Diabetic"

            pred = {
                "prediction": prediction,
                "probability_diabetic": prob_diabetic,
                "probability_non_diabetic": prob_non,
            }
            results["disease_prediction"] = {
                "predictions": [pred],
                "model_info": {
                    "model": "DiseasePredictor",
                    "algorithm": "Logistic Regression (single-patient scoring)",
                    "note": "Score-based proxy — batch upload trains full model",
                },
            }
            AnalysisResult.objects.create(
                patient=patient,
                model_type="logistic",
                result=pred,
                confidence=max(prob_diabetic, prob_non),
                risk_label=prediction,
                notes="Single patient analysis",
            )
        except Exception as e:
            errors["disease_prediction"] = str(e)

        # 3. Decision Tree
        try:
            score = 0
            if row["glucose_level"] > 125:
                score += 1
            if row["bmi"] > 30:
                score += 1
            if row["blood_pressure_systolic"] > 135:
                score += 1
            if row["is_smoker"]:
                score += 1
            if row["has_hypertension"]:
                score += 1

            if score <= 1:
                risk_label, confidence = "LOW", round(1 - score * 0.1, 4)
            elif score <= 3:
                risk_label, confidence = "MEDIUM", round(0.5 + score * 0.05, 4)
            else:
                risk_label, confidence = "HIGH", round(min(0.6 + score * 0.08, 0.97), 4)

            pred = {
                "risk_label": risk_label,
                "confidence": confidence,
                "probabilities": {
                    "LOW": 0.0,
                    "MEDIUM": 0.0,
                    "HIGH": 0.0,
                    risk_label: confidence,
                },
            }
            results["diagnosis_tree"] = {
                "predictions": [pred],
                "model_info": {
                    "model": "DiagnosisTreePredictor",
                    "algorithm": "Decision Tree (single-patient scoring)",
                    "note": "Score-based proxy — batch upload trains full model",
                },
            }
            AnalysisResult.objects.create(
                patient=patient,
                model_type="decision_tree",
                result=pred,
                confidence=confidence,
                risk_label=risk_label,
                notes="Single patient analysis",
            )
        except Exception as e:
            errors["diagnosis_tree"] = str(e)

        # 4. Linear Regression proxy
        try:
            sys_bp = row["blood_pressure_systolic"]
            age = row["age"]
            bmi = row["bmi"]
            predicted_bp = round(sys_bp * 0.6 + age * 0.3 + bmi * 0.2, 1)

            bp_risk = (
                "HIGH"
                if predicted_bp > 140
                else "MEDIUM" if predicted_bp > 120 else "LOW"
            )
            bp_conf = round(min(abs(predicted_bp - 120) / 60, 1.0), 4)

            pred = {"predicted_systolic_bp": predicted_bp}
            results["trend_prediction"] = {
                "predictions": [
                    {
                        "value": predicted_bp,
                        "patient_name": f"{patient.first_name} {patient.last_name}",
                    }
                ],
                "model_info": {
                    "model": "TrendPredictor",
                    "algorithm": "Linear Regression (single-patient proxy)",
                },
            }
            AnalysisResult.objects.create(
                patient=patient,
                model_type="linear_regression",
                result=pred,
                confidence=None,
                risk_label=bp_risk,
                notes="Single patient analysis",
            )
        except Exception as e:
            errors["trend_prediction"] = str(e)

        # 5. KMeans proxy
        try:
            score = 0
            if row["bmi"] > 30:
                score += 1
            if row["blood_pressure_systolic"] > 135:
                score += 1
            if row["glucose_level"] > 125:
                score += 1
            if row["is_smoker"]:
                score += 1
            if row["has_hypertension"]:
                score += 1

            cluster_id = min(score // 2, 2)
            profile = ["Low Risk", "Moderate Risk", "High Risk"][cluster_id]
            cluster_confidence = round(0.5 + cluster_id * 0.2, 4)

            pred = {"cluster_id": cluster_id, "profile": profile}
            results["clustering"] = {
                "predictions": [
                    {
                        "cluster_id": cluster_id,
                        "profile": profile,
                        "patient_name": f"{patient.first_name} {patient.last_name}",
                    }
                ],
                "model_info": {
                    "model": "PatientClusterer",
                    "algorithm": "KMeans (single-patient proxy)",
                },
            }
            AnalysisResult.objects.create(
                patient=patient,
                model_type="kmeans",
                result=pred,
                confidence=None,
                risk_label=profile,
                notes="Single patient analysis",
            )
        except Exception as e:
            errors["clustering"] = str(e)

        return Response(
            {
                "patient_id": patient.id,
                "ml_results": {
                    "status": "completed" if not errors else "partial",
                    "results": results,
                    "errors": errors,
                    "rows_analysed": 1,
                },
            }
        )


class BatchReportDetailView(APIView):
    def get(self, request, pk):
        try:
            report = BatchAnalysisReport.objects.get(pk=pk, owner=request.user)
            serializer = BatchAnalysisReportSerializer(report)
            return Response(serializer.data)
        except BatchAnalysisReport.DoesNotExist:
            return Response(
                {"error": "Report not found."}, status=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, pk):
        try:
            report = BatchAnalysisReport.objects.get(pk=pk, owner=request.user)
            report.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except BatchAnalysisReport.DoesNotExist:
            return Response(
                {"error": "Report not found."}, status=status.HTTP_404_NOT_FOUND
            )
