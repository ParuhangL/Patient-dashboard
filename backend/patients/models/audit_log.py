from django.db import models
from django.contrib.auth.models import User


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ("create", "Create"),
        ("update", "Update"),
        ("delete", "Delete"),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=50)  # e.g. 'Patient'
    object_id = models.IntegerField(null=True)
    object_str = models.CharField(max_length=255)  # e.g. 'John Doe'
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user} {self.action} {self.model_name} {self.object_id}"
