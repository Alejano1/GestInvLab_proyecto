from rest_framework import serializers
from .models import Insumo, Lote, Servicio, Movimiento, Detalle_Movimiento
from django.contrib.auth.models import User
from django.db.models import Sum, F
from django.utils import timezone 

# --- Serializadores para LECTURA (GET) ---

class ServicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servicio
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    """ Serializer simple para listar usuarios """
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']

class InsumoSerializer(serializers.ModelSerializer):
    # Campo calculado
    stock_total = serializers.SerializerMethodField()
    
    class Meta:
        model = Insumo
        fields = ['id', 'nombre', 'codigo_producto', 'stock_total', 'umbral_critico']

    def get_stock_total(self, insumo_obj):
        # Suma el stock de todos los lotes de este insumo
        total = insumo_obj.lotes.aggregate(
            total_stock=Sum('stock_por_lote')
        )['total_stock']
        
        return total or 0 # Devuelve 0 si es None
        

class LoteSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.StringRelatedField(source='insumo.nombre')
    class Meta:
        model = Lote
        fields = ['id', 'insumo', 'insumo_nombre', 'numero_lote', 'fecha_caducidad', 'stock_por_lote']

# --- Serializadores para CREACIÓN (POST) ---

class DetalleMovimientoCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para el detalle *dentro* de un movimiento de SALIDA.
    """
    class Meta:
        model = Detalle_Movimiento
        fields = ['lote', 'cantidad']


class MovimientoCreateSerializer(serializers.ModelSerializer):
    """
    Serializer principal para crear un Movimiento de SALIDA.
    (Usado por el Módulo de Salida)
    """
    detalles = DetalleMovimientoCreateSerializer(many=True)

    # El servicio de destino es OBLIGATORIO para una salida
    servicio_destino = serializers.PrimaryKeyRelatedField(
        queryset=Servicio.objects.all(), 
        required=True, 
        allow_null=False
    )

    class Meta:
        model = Movimiento
        fields = ['servicio_destino', 'detalles']

    def create(self, validated_data):
        detalles_data = validated_data.pop('detalles')
        usuario = self.context['request'].user

        # --- Validación de Stock ---
        for item in detalles_data:
            lote = item['lote']
            cantidad_solicitada = item['cantidad']
            if lote.stock_por_lote < cantidad_solicitada:
                raise serializers.ValidationError(
                    f"Stock insuficiente para {lote.insumo.nombre} (Lote: {lote.numero_lote}). "
                    f"Stock: {lote.stock_por_lote}, Solicitado: {cantidad_solicitada}"
                )

        # --- Crear Movimiento ---
        movimiento = Movimiento.objects.create(
            usuario=usuario, 
            tipo_movimiento='Salida', 
            **validated_data
        )
        
        # 2. Generar N° Documento Automático
        current_year = timezone.now().year
        movimiento.numero_documento = f"SAL-{current_year}-{movimiento.id:05d}"
        movimiento.save()

        # 3. Crear los Detalles y Actualizar Stock del Lote
        for detalle_data in detalles_data:
            Detalle_Movimiento.objects.create(movimiento=movimiento, **detalle_data)
            
            # Actualizar el Lote (Descontar stock)
            lote = detalle_data['lote']
            cantidad = detalle_data['cantidad']
            Lote.objects.filter(id=lote.id).update(
                stock_por_lote=F('stock_por_lote') - cantidad
            )

        return movimiento
    
# --- Serializadores para MÓDULO DE ENTRADA  ---

class DetalleEntradaCreateSerializer(serializers.Serializer):
    """
    Serializer para CADA item en la lista de detalles de la entrada.
    """
    insumo_id = serializers.IntegerField()
    numero_lote = serializers.CharField(max_length=100)
    fecha_caducidad = serializers.DateField(required=False, allow_null=True)
    cantidad = serializers.IntegerField(min_value=1)

    def validate_insumo_id(self, value):
        if not Insumo.objects.filter(id=value).exists():
            raise serializers.ValidationError("No existe un Insumo con este ID.")
        return value


class EntradaCreateSerializer(serializers.Serializer):
    """
    Serializer principal para el endpoint de ENTRADAS.
    """
    detalles = DetalleEntradaCreateSerializer(many=True)

    def validate_detalles(self, value):
        if not value or len(value) == 0:
            raise serializers.ValidationError("La lista de 'detalles' no puede estar vacía.")
        return value

# --- Serializadores para REPORTES ---

class ReporteDetalleMovimientoSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.CharField(source='lote.insumo.nombre')
    insumo_codigo = serializers.CharField(source='lote.insumo.codigo_producto')
    lote_numero = serializers.CharField(source='lote.numero_lote')

    class Meta:
        model = Detalle_Movimiento
        fields = ['insumo_nombre', 'insumo_codigo', 'lote_numero', 'cantidad']


class ReporteMovimientoSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()
    servicio_destino = serializers.StringRelatedField()
    detalles = ReporteDetalleMovimientoSerializer(many=True, read_only=True)

    class Meta:
        model = Movimiento
        fields = [
            'id',
            'tipo_movimiento',
            'fecha_registro',
            'usuario',
            'servicio_destino',
            'numero_documento',
            'detalles' 
        ]


# --- Serializer para el módulo admin

class InsumoCreateAdminSerializer(serializers.ModelSerializer):
    """
    Serializer simple para crear Insumos desde el panel de admin.
    """
    class Meta:
        model = Insumo
        fields = ['nombre', 'codigo_producto', 'umbral_critico']      

class InsumoUpdateAdminSerializer(serializers.ModelSerializer):
    """
    Serializer SÚPER simple, solo para actualizar el umbral.
    """
    class Meta:
        model = Insumo
        # Solo permitimos que se actualice este campo
        fields = ['umbral_critico']

class UserCreateAdminSerializer(serializers.ModelSerializer):
    """
    Serializer para crear usuarios desde el panel de admin.
    Maneja el hashing de la contraseña.
    """
    class Meta:
        model = User
        # Pedimos estos campos
        fields = ['username', 'password', 'is_staff']
        # Hacemos que la contraseña sea de solo escritura (no se puede leer)
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        # Usamos create_user para hashear la contraseña
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            is_staff=validated_data.get('is_staff', False),
            is_active=True 
        )
        return user

class UserUpdateAdminSerializer(serializers.ModelSerializer):
    """
    Serializer para actualizar el rol (is_staff) o el estado (is_active)
    de un usuario.
    """
    class Meta:
        model = User
        fields = ['is_active', 'is_staff']