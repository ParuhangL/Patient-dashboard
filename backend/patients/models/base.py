from django.db import models


class BaseHealthEntity(models.Model):
    """
    Abstract base class - shared fields for all health models.
    OOP: Abstraction + Inheritance
    No database table is created for this class itself.
    """

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True  # Django won't create a table for this

    def deactivate(self):
        """Encapsulated state change - callers never touch is_active directly."""
        self.is_active = False
        self.save(update_fields=["is_active", "updated_at"])

    def __repr__(self):
        return f"<{self.__class__.__name__} pk={self.pk}>"
