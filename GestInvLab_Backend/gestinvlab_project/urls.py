from django.contrib import admin
from django.urls import path, include


from inventory.views import CustomAuthToken

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/inventory/', include('inventory.urls')), 
    path('api-token-auth/', CustomAuthToken.as_view()),
]