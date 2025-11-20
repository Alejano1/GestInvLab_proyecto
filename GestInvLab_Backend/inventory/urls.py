from django.urls import path
from . import views

app_name = 'inventory'

urlpatterns = [
    # --- Endpoints de LECTURA (GET) ---
    path('insumos/', views.InsumoListView.as_view(), name='insumo-list'),
    path('servicios/', views.ServicioListView.as_view(), name='servicio-list'),
    path('lotes/', views.LoteListView.as_view(), name='lote-list'),
    path('usuarios/', views.UserListView.as_view(), name='user-list'),
    
    # --- Endpoints de ESCRITURA (POST) ---
    path('movimientos/', views.MovimientoCreateView.as_view(), name='movimiento-create'), # Para Salidas
    path('entradas/', views.EntradaCreateView.as_view(), name='entrada-create'), # Para Entradas
    
    # --- Endpoint de REPORTES ---
    path('reportes/movimientos/', views.ReporteMovimientosView.as_view(), name='reporte-movimientos'),

    # --- ¡NUEVAS RUTAS DE ADMIN! ---
    path('admin/insumos/', views.AdminInsumoView.as_view(), name='admin-insumos'),
    path('admin/servicios/', views.AdminServicioView.as_view(), name='admin-servicios'),
    path('admin/insumos/<int:pk>/', views.AdminInsumoDetailView.as_view(), name='admin-insumo-detail'),
    path('admin/servicios/', views.AdminServicioView.as_view(), name='admin-servicios'),
    path('admin/usuarios/', views.AdminUserView.as_view(), name='admin-usuarios'),
    path('admin/usuarios/<int:pk>/', views.AdminUserDetailView.as_view(), name='admin-usuario-detail'),
]