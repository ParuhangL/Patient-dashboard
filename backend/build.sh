#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
python manage.py shell -c "
from django.contrib.auth.models import User
u = User.objects.filter(is_staff=True).first()
if u:
    u.set_password('Admin1234')
    u.save()
    print(f'Password reset for {u.username}')
else:
    print('No staff user found')
"