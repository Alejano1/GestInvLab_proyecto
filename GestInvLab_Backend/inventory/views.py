from django.db import transaction
from django.db.models import F
from django.utils.dateparse import parse_date 
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated, IsAdminUser 
import traceback 
from django.contrib.auth.models import User 
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from .models import User, Insumo, Servicio, Lote, Movimiento, Detalle_Movimiento
from .serializers import (
    InsumoSerializer, 
    ServicioSerializer, 
    LoteSerializer, 
    MovimientoCreateSerializer,
    ReporteMovimientoSerializer,
    EntradaCreateSerializer,
    UserSerializer,
    InsumoCreateAdminSerializer,
    InsumoUpdateAdminSerializer,
    UserCreateAdminSerializer,
    UserUpdateAdminSerializer
)

# =============================================
# Vista para crear Movimientos (SALIDA)
# =============================================
class MovimientoCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = MovimientoCreateSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            movimiento = serializer.save()
            serializer_respuesta = ReporteMovimientoSerializer(movimiento)
            return Response(serializer_respuesta.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# =============================================
# Vistas para LEER datos
# =============================================

class InsumoListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, *args, **kwargs):
        insumos = Insumo.objects.all().order_by('nombre')
        serializer = InsumoSerializer(insumos, many=True)
        return Response(serializer.data)

class ServicioListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, *args, **kwargs):
        servicios = Servicio.objects.all().order_by('nombre')
        serializer = ServicioSerializer(servicios, many=True)
        return Response(serializer.data)

class LoteListView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, *args, **kwargs):
        insumo_id = request.query_params.get('insumo_id', None)
        if not insumo_id:
            return Response(
                {"error": "Se requiere el parámetro 'insumo_id'."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        lotes = Lote.objects.filter(insumo_id=insumo_id, stock_por_lote__gt=0).order_by('fecha_caducidad')
        serializer = LoteSerializer(lotes, many=True)
        return Response(serializer.data)

# =============================================
# Vistas para Filtros de Reportes
# =============================================
class UserListView(generics.ListAPIView):
    queryset = User.objects.filter(is_active=True).order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

class ReporteMovimientosView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, *args, **kwargs):
        queryset = Movimiento.objects.all().prefetch_related(
            'detalles__lote__insumo', 
            'usuario', 
            'servicio_destino'
        ).order_by('-fecha_registro')
        
        
        fecha_inicio = request.query_params.get('fecha_inicio', None)
        fecha_fin = request.query_params.get('fecha_fin', None)
        tipo_mov = request.query_params.get('tipo_movimiento', None)
        insumo_id = request.query_params.get('insumo_id', None)
        servicio_id = request.query_params.get('servicio_id', None)
        usuario_id = request.query_params.get('usuario_id', None)
        
        if fecha_inicio:
            fecha_inicio_obj = parse_date(fecha_inicio)
            if fecha_inicio_obj:
                queryset = queryset.filter(fecha_registro__date__gte=fecha_inicio_obj)
        if fecha_fin:
            fecha_fin_obj = parse_date(fecha_fin)
            if fecha_fin_obj:
                queryset = queryset.filter(fecha_registro__date__lte=fecha_fin_obj)
        if tipo_mov in ['Entrada', 'Salida']:
            queryset = queryset.filter(tipo_movimiento=tipo_mov)
        if insumo_id:
            queryset = queryset.filter(detalles__lote__insumo_id=insumo_id).distinct()
        if servicio_id:
            queryset = queryset.filter(servicio_destino_id=servicio_id)
        if usuario_id:
            queryset = queryset.filter(usuario_id=usuario_id)
        
        serializer = ReporteMovimientoSerializer(queryset, many=True)
        return Response(serializer.data)

# =============================================
# Vista para MÓDULO DE ENTRADA
# =============================================
class EntradaCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, *args, **kwargs):
        serializer = EntradaCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        validated_data = serializer.validated_data
        detalles_data = validated_data.pop('detalles')
        
        try:
            with transaction.atomic():
                movimiento = Movimiento.objects.create(
                    usuario=request.user,
                    tipo_movimiento='Entrada'
                )
                current_year = timezone.now().year
                movimiento.numero_documento = f"ENT-{current_year}-{movimiento.id:05d}"
                movimiento.save(update_fields=['numero_documento'])

                for detalle in detalles_data:
                    insumo_id = detalle['insumo_id']
                    numero_lote = detalle['numero_lote']
                    
                    lote_obj, created = Lote.objects.get_or_create(
                        insumo_id=insumo_id,
                        numero_lote=numero_lote,
                        defaults={'fecha_caducidad': detalle.get('fecha_caducidad')}
                    )
                    
                    if not created and detalle.get('fecha_caducidad'):
                        lote_obj.fecha_caducidad = detalle.get('fecha_caducidad')
                        lote_obj.save()

                    Detalle_Movimiento.objects.create(
                        movimiento=movimiento,
                        lote=lote_obj,
                        cantidad=detalle['cantidad']
                    )
                    
                    Lote.objects.filter(id=lote_obj.id).update(
                        stock_por_lote=F('stock_por_lote') + detalle['cantidad']
                    )
            
        except Exception as e:
            print("¡¡¡ERROR INTERNO EN ENTRADACREATEVIEW!!!")
            traceback.print_exc() 
            return Response(
                {"error": f"Error interno del servidor (views.py): {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        serializer_respuesta = ReporteMovimientoSerializer(movimiento)
        return Response(serializer_respuesta.data, status=status.HTTP_201_CREATED)

# =============================================
# VISTAS DE ADMINISTRACIÓN
# =============================================

class AdminInsumoView(APIView):
    """
    API para que el Admin gestione Insumos (Crear y Listar)
    Endpoint: /api/inventory/admin/insumos/
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, *args, **kwargs):
        """ Devuelve la lista de insumos (para la tabla de admin) """
        insumos = Insumo.objects.all().order_by('nombre')
        serializer = InsumoSerializer(insumos, many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        """ Crea un nuevo Insumo """
        serializer = InsumoCreateAdminSerializer(data=request.data)
        if serializer.is_valid():
            insumo = serializer.save()
            return Response(InsumoSerializer(insumo).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminServicioView(APIView):
    """
    API para que el Admin gestione Servicios (Crear y Listar)
    Endpoint: /api/inventory/admin/servicios/
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request, *args, **kwargs):
        """ Devuelve la lista de servicios (para la tabla de admin) """
        servicios = Servicio.objects.all().order_by('nombre')
        serializer = ServicioSerializer(servicios, many=True)
        return Response(serializer.data)

    def post(self, request, *args, **kwargs):
        """ Crea un nuevo Servicio """
        serializer = ServicioSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =============================================
# ¡VISTA DE LOGIN PERSONALIZADA!
# =============================================
class CustomAuthToken(ObtainAuthToken):
    """
    Devuelve: token, username, y si es staff (admin).
    """
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'username': user.username,
            'is_staff': user.is_staff 
        })

class AdminInsumoDetailView(generics.UpdateAPIView):
    """
    API para que el Admin actualice un Insumo (el umbral)
    Endpoint: PATCH /api/inventory/admin/insumos/<int:pk>/
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = Insumo.objects.all()
    serializer_class = InsumoUpdateAdminSerializer    

class AdminUserView(generics.ListCreateAPIView):
    """
    API para que el Admin LISTE y CREE usuarios.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = User.objects.all().order_by('username')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateAdminSerializer
        return UserSerializer

class AdminUserDetailView(generics.UpdateAPIView):
    """
    API para que el Admin ACTUALICE (PATCH) un usuario.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    queryset = User.objects.all()
    serializer_class = UserUpdateAdminSerializer    