from django.utils.dateparse import parse_date 
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Insumo, Servicio, Lote, Movimiento
from .serializers import (
    InsumoSerializer, 
    ServicioSerializer, 
    LoteSerializer, 
    MovimientoCreateSerializer,
    ReporteMovimientoSerializer
)

# =============================================
# Vista para crear Movimientos (Entrada/Salida)
# Endpoint: POST /api/inventory/movimientos/
# =============================================
class MovimientoCreateView(APIView):
    """
    Crea un nuevo movimiento (Entrada o Salida) con sus detalles.
    """
    # Protegemos el endpoint: Solo usuarios autenticados pueden crear movimientos
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Pasamos el 'context' al serializer para que pueda acceder al 'request.user'
        serializer = MovimientoCreateSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            # El .save() llamará al método .create() de nuestro serializer
            # que ya tiene toda la lógica de validación y creación.
            serializer.save() 
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # Si la validación falla (ej. stock insuficiente),
        # DRF automáticamente devuelve un error 400 con el detalle.
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# =============================================
# Vistas para LEER datos (Listas para el Frontend)
# =============================================

class InsumoListView(APIView):
    """
    Devuelve la lista de todos los insumos con su stock actual.
    Endpoint: GET /api/inventory/insumos/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        insumos = Insumo.objects.all().order_by('nombre')
        serializer = InsumoSerializer(insumos, many=True)
        return Response(serializer.data)

class ServicioListView(APIView):
    """
    Devuelve la lista de todos los servicios (destinos).
    Endpoint: GET /api/inventory/servicios/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        servicios = Servicio.objects.all().order_by('nombre')
        serializer = ServicioSerializer(servicios, many=True)
        return Response(serializer.data)

class LoteListView(APIView):
    """
    Devuelve los lotes disponibles PARA UN INSUMO ESPECÍFICO.
    Endpoint: GET /api/inventory/lotes/?insumo_id=1
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # Obtenemos el ID del insumo de los parámetros de la URL (query params)
        insumo_id = request.query_params.get('insumo_id', None)
        
        if not insumo_id:
            return Response(
                {"error": "Se requiere el parámetro 'insumo_id'."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filtramos lotes que pertenezcan a ese insumo Y que tengan stock
        lotes = Lote.objects.filter(insumo_id=insumo_id, stock_por_lote__gt=0).order_by('fecha_caducidad')
        
        serializer = LoteSerializer(lotes, many=True)
        return Response(serializer.data)

# =============================================
# Vista para Reporte de Movimientos (Fase 4.3)
# Endpoint: GET /api/inventory/reportes/movimientos/
# =============================================
class ReporteMovimientosView(APIView):
    """
    Genera un informe de movimientos
    con filtros personalizables.

    Filtros disponibles (Query Params):
    - fecha_inicio (YYYY-MM-DD)
    - fecha_fin (YYYY-MM-DD)
    - tipo_movimiento (Entrada o Salida)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # 1. Empezar con todos los movimientos
        # .prefetch_related() es una optimización para cargar 
        # los 'detalles', 'lote', 'insumo' en una sola consulta
        queryset = Movimiento.objects.all().prefetch_related(
            'detalles__lote__insumo', 
            'usuario', 
            'servicio_destino'
        ).order_by('-fecha_registro')

        # 2. Aplicar filtros de la URL (Query Params)
        fecha_inicio = request.query_params.get('fecha_inicio', None)
        fecha_fin = request.query_params.get('fecha_fin', None)
        tipo_mov = request.query_params.get('tipo_movimiento', None)

        if fecha_inicio:
            fecha_inicio_obj = parse_date(fecha_inicio)
            if fecha_inicio_obj:
                # __gte = "greater than or equal" (mayor o igual)
                queryset = queryset.filter(fecha_registro__date__gte=fecha_inicio_obj)

        if fecha_fin:
            fecha_fin_obj = parse_date(fecha_fin)
            if fecha_fin_obj:
                # __lte = "less than or equal" (menor o igual)
                queryset = queryset.filter(fecha_registro__date__lte=fecha_fin_obj)

        if tipo_mov in ['Entrada', 'Salida']:
            queryset = queryset.filter(tipo_movimiento=tipo_mov)

        # 3. Serializar los datos filtrados
        serializer = ReporteMovimientoSerializer(queryset, many=True)
        return Response(serializer.data)    