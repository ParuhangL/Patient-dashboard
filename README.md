# Patient Diagnostic Dashboard

Full-stack patient diagnostic system with ML analysis.

## Tech Stack
- Backend: Django 4.2 + Django REST Framework
- Database: PostgreSQL
- ML: scikit-learn, Pandas, NumPy
- Frontend: React (Vite) + Tailwind CSS + Recharts
- Auth: JWT (djangorestframework-simplejwt)

## Setup — Backend

1. Create and activate virtual environment
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

2. Install dependencies
pip install -r requirements.txt

3. Create `.env` file in `backend/` folder
SECRET_KEY=any-random-string
DATABASE_NAME=patient_dashboard
DATABASE_USER=postgres
DATABASE_PASSWORD=your-postgres-password
DATABASE_HOST=localhost
DATABASE_PORT=5432

4. Create the PostgreSQL database
```sql
   CREATE DATABASE patient_dashboard;
```

5. Run migrations
python manage.py makemigrations
python manage.py migrate

6. Create a superuser (optional)
python manage.py createsuperuser

7. Start the server
python manage.py runserver

## Setup — Frontend

1. Install dependencies
cd frontend
npm install

2. Start dev server
npm run dev

## URLs
- Frontend: http://localhost:5173
- Backend API: http://127.0.0.1:8000
- Django Admin: http://127.0.0.1:8000/admin

## CSV Format
Upload CSVs with these columns:
first_name, last_name, date_of_birth, gender, bmi,
blood_pressure_systolic, blood_pressure_diastolic,
heart_rate, glucose_level, cholesterol,
is_smoker, is_diabetic, has_hypertension
date_of_birth format: YYYY-MM-DD