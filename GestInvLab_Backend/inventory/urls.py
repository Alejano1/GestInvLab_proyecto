from django.urls import path
from . import views

app_name = 'inventory'

urlpatterns = [
    # --- Endpoints de LECTURA (GET) ---
    path('insumos/', views.InsumoListView.as_view(), name='insumo-list'),
    path('servicios/', views.ServicioListView.as_view(), name='servicio-list'),
    path('lotes/', views.LoteListView.as_view(), name='lote-list'),

    # --- Endpoints de ESCRITURA (POST) ---
    path('movimientos/', views.MovimientoCreateView.as_view(), name='movimiento-create'),
    path('movimientos/', views.MovimientoCreateView.as_view(), name='movimiento-create'),
    path('reportes/movimientos/', views.ReporteMovimientosView.as_view(), name='reporte-movimientos'),
]

