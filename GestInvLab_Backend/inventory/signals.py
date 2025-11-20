from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import F
from .models import Detalle_Movimiento, Lote

# Esta es la "señal" que se ejecutará después de guardar un Detalle_Movimiento
@receiver(post_save, sender=Detalle_Movimiento)
def update_stock_on_save(sender, instance, created, **kwargs):
    pass 