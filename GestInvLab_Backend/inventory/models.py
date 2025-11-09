from django.db import models
from django.contrib.auth.models import User

class Servicio(models.Model):
    nombre = models.CharField(max_length=255, unique=True, help_text="Ej: Medicina Hombres, Urgencias, Cesfam")

    def __str__(self):
        return self.nombre

    class Meta:
        verbose_name = "Servicio"
        verbose_name_plural = "Servicios"


class Insumo(models.Model):
    nombre = models.CharField(max_length=255, verbose_name="Nombre del Insumo")
    codigo_producto = models.CharField(max_length=100, unique=True, blank=True, null=True, verbose_name="Código de Producto")
    stock_actual = models.IntegerField(default=0, editable=False, verbose_name="Stock Total")
    umbral_critico = models.IntegerField(default=0, verbose_name="Umbral de Stock Crítico")

    def __str__(self):
        return f"{self.nombre} ({self.codigo_producto})"

    class Meta:
        verbose_name = "Insumo"
        verbose_name_plural = "Insumos"


class Lote(models.Model):
    # Un Insumo tiene muchos Lotes
    insumo = models.ForeignKey(Insumo, on_delete=models.CASCADE, related_name="lotes")
    numero_lote = models.CharField(max_length=100, verbose_name="Número de Lote")
    fecha_caducidad = models.DateField(blank=True, null=True, verbose_name="Fecha de Caducidad")
    fecha_recepcion = models.DateField(auto_now_add=True, verbose_name="Fecha de Recepción")
    stock_por_lote = models.IntegerField(default=0, verbose_name="Stock del Lote")

    def __str__(self):
        return f"{self.insumo.nombre} - Lote: {self.numero_lote}"

    class Meta:
        # Elimina lotes duplicados para el mismo insumo
        unique_together = ('insumo', 'numero_lote')
        verbose_name = "Lote"
        verbose_name_plural = "Lotes"


class Movimiento(models.Model):
    TIPO_CHOICES = [
        ('Entrada', 'Entrada'),
        ('Salida', 'Salida'),
    ]
    
    # Quién registra el movimiento
    usuario = models.ForeignKey(User, on_delete=models.PROTECT, related_name="movimientos")
    tipo_movimiento = models.CharField(max_length=10, choices=TIPO_CHOICES, verbose_name="Tipo de Movimiento")
    fecha_registro = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Registro")
    
    # A dónde va el insumo (si es Salida)
    servicio_destino = models.ForeignKey(Servicio, on_delete=models.SET_NULL, blank=True, null=True, verbose_name="Servicio Destino")
    numero_documento = models.CharField(max_length=100, blank=True, null=True, verbose_name="Número de Documento") # Ej. ENT-2024-00123

    def __str__(self):
        return f"{self.get_tipo_movimiento_display()} - {self.fecha_registro.strftime('%Y-%m-%d')}"

    class Meta:
        verbose_name = "Movimiento"
        verbose_name_plural = "Movimientos"

class Detalle_Movimiento(models.Model):
    #A qué movimiento pertenece este detalle
    movimiento = models.ForeignKey(Movimiento, on_delete=models.CASCADE, related_name="detalles")
    # Qué lote específico se movió
    lote = models.ForeignKey(Lote, on_delete=models.PROTECT, related_name="detalles_movimiento")
    cantidad = models.IntegerField(verbose_name="Cantidad")

    def __str__(self):
        return f"Detalle de {self.movimiento.id} - Lote: {self.lote.numero_lote} ({self.cantidad})"

    class Meta:
        verbose_name = "Detalle de Movimiento"
        verbose_name_plural = "Detalles de Movimientos"