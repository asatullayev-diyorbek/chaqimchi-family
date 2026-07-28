from django.contrib import admin

from .models import ChildDevice, EnrollmentCode

admin.site.register(ChildDevice)
admin.site.register(EnrollmentCode)
