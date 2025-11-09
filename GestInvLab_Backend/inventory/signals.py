from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import F
from .models import Detalle_Movimiento, Lote, Insumo

# Esta es la "señal" que se ejecutará después de guardar un Detalle_Movimiento
@receiver(post_save, sender=Detalle_Movimiento)
def update_stock_on_save(sender, instance, created, **kwargs):
    """
    Actualiza el stock en el Lote y en el Insumo principal
    cada vez que se crea un nuevo Detalle_Movimiento.
    """

    # 'created' es True solo la primera vez que se guarda
    if not created:
        return

    detalle = instance
    movimiento = detalle.movimiento
    lote = detalle.lote
    insumo = lote.insumo
    cantidad = detalle.cantidad

    if movimiento.tipo_movimiento == 'Entrada':
        # Incrementar el stock
        Lote.objects.filter(id=lote.id).update(stock_por_lote=F('stock_por_lote') + cantidad)
        Insumo.objects.filter(id=insumo.id).update(stock_actual=F('stock_actual') + cantidad)

    elif movimiento.tipo_movimiento == 'Salida':
        # Reducir el stock
        # (Añadiremos validación de stock negativo en la API más adelante)
        Lote.objects.filter(id=lote.id).update(stock_por_lote=F('stock_por_lote') - cantidad)
        Insumo.objects.filter(id=insumo.id).update(stock_actual=F('stock_actual') - cantidad)

    # Le decimos a la BD que haga la operación matemática ella misma.