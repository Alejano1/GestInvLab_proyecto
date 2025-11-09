from django.contrib import admin
from .models import Servicio, Insumo, Lote, Movimiento, Detalle_Movimiento

admin.site.register(Servicio)
admin.site.register(Insumo)
admin.site.register(Lote)
admin.site.register(Movimiento)
admin.site.register(Detalle_Movimiento)