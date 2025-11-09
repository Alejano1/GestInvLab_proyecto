from rest_framework import serializers
from .models import Insumo, Lote, Servicio, Movimiento, Detalle_Movimiento
from django.contrib.auth.models import User


# --- Serializadores para LECTURA (GET) ---

class ServicioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Servicio
        fields = '__all__'

class InsumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Insumo
        fields = ['id', 'nombre', 'codigo_producto', 'stock_actual', 'umbral_critico']

class LoteSerializer(serializers.ModelSerializer):
    # Muestra el nombre del insumo en lugar de solo el ID
    insumo_nombre = serializers.StringRelatedField(source='insumo.nombre')

    class Meta:
        model = Lote
        fields = ['id', 'insumo', 'insumo_nombre', 'numero_lote', 'fecha_caducidad', 'stock_por_lote']

# --- Serializadores para CREACIÓN (POST) ---
class DetalleMovimientoCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para el detalle *dentro* de un movimiento.
    Solo necesitamos el ID del lote y la cantidad.
    """
    class Meta:
        model = Detalle_Movimiento
        fields = ['lote', 'cantidad']


class MovimientoCreateSerializer(serializers.ModelSerializer):
    """
    Serializer principal para crear un Movimiento (Entrada o Salida).
    Acepta una lista de detalles.
    """
    # 'detalles' es una lista de los serializers de arriba
    detalles = DetalleMovimientoCreateSerializer(many=True)

    # Hacemos que el servicio_destino sea opcional
    servicio_destino = serializers.PrimaryKeyRelatedField(
        queryset=Servicio.objects.all(), 
        required=False, 
        allow_null=True
    )

    class Meta:
        model = Movimiento
        fields = ['tipo_movimiento', 'servicio_destino', 'numero_documento', 'detalles']

    def create(self, validated_data):
        # 1. Separar los datos
        # .pop() saca los detalles del diccionario principal
        detalles_data = validated_data.pop('detalles')

        # El usuario no viene en el JSON, lo sacamos del request (lo veremos en la View)
        usuario = self.context['request'].user

        # 2. Validar la lógica de negocio
        if validated_data['tipo_movimiento'] == 'Salida':
            if 'servicio_destino' not in validated_data or validated_data['servicio_destino'] is None:
                raise serializers.ValidationError("Una 'Salida' debe tener un 'servicio_destino'.")

            # --- ¡VALIDACIÓN DE STOCK! ---
            for item in detalles_data:
                lote = item['lote']
                cantidad_solicitada = item['cantidad']
                if lote.stock_por_lote < cantidad_solicitada:
                    raise serializers.ValidationError(
                        f"Stock insuficiente para {lote.insumo.nombre} (Lote: {lote.numero_lote}). "
                        f"Stock disponible: {lote.stock_por_lote}, Solicitado: {cantidad_solicitada}"
                    )

        elif validated_data['tipo_movimiento'] == 'Entrada':
            # En una entrada, el destino debe ser nulo
            validated_data['servicio_destino'] = None

        # 3. Crear los objetos

        # Crear el Movimiento (el "encabezado")
        movimiento = Movimiento.objects.create(usuario=usuario, **validated_data)

        # Crear los Detalles (las "líneas")
        for detalle_data in detalles_data:
            Detalle_Movimiento.objects.create(movimiento=movimiento, **detalle_data)
            # NOTA: ¡Nuestro 'signal' se disparará aquí automáticamente!
            # (El signal se encarga de actualizar el stock)

        return movimiento
    
# --- Serializadores para REPORTES  ---

class ReporteDetalleMovimientoSerializer(serializers.ModelSerializer):
    """
    Serializer para mostrar los detalles DENTRO del reporte de movimientos.
    Incluye nombres legibles en lugar de solo IDs.
    """
    insumo_nombre = serializers.CharField(source='lote.insumo.nombre')
    insumo_codigo = serializers.CharField(source='lote.insumo.codigo_producto')
    lote_numero = serializers.CharField(source='lote.numero_lote')

    class Meta:
        model = Detalle_Movimiento
        fields = ['insumo_nombre', 'insumo_codigo', 'lote_numero', 'cantidad']


class ReporteMovimientoSerializer(serializers.ModelSerializer):
    """
    Serializer principal para el reporte de movimientos (FR05).
    Muestra el encabezado del movimiento y anida sus detalles.
    """
    # Muestra el nombre de usuario en lugar del ID
    usuario = serializers.StringRelatedField()
    
    # Muestra el nombre del servicio en lugar del ID
    servicio_destino = serializers.StringRelatedField()
    
    # Anida la lista de detalles usando el serializer de arriba
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
            'detalles' # 
        ]
