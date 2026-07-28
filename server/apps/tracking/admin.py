from django.contrib import admin

from .models import Event, EventBatch

admin.site.register(EventBatch)
admin.site.register(Event)
