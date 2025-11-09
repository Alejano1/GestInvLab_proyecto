# GestInvLab: Sistema de Gestión de Inventario para Laboratorios

Sistema web para la digitalización y gestión de inventario de insumos en Laboratorio Clínico del Hospital de Lota. Este proyecto optimiza la logística, reduce el riesgo de desabastecimiento y automatiza el seguimiento de stock y fechas de caducidad.

Este proyecto es desarrollado como el Proyecto de Título para optar al título de Ingeniero en Computación e Informática.


## Tecnologías Utilizadas

* **Backend:** Python, Django, Django REST Framework
* **Base de Datos:** MySQL
* **Autenticación:** Autenticación por Tokens (DRF)

---

## Características Principales

* **Autenticación de Usuarios:** Login seguro para personal de laboratorio y administradores.
* **Gestión de Stock en Tiempo Real:** Los módulos de Entrada y Salida actualizan el stock automáticamente.
* **Validación de Stock:** El sistema previene salidas de insumos si no hay stock disponible.
* **Trazabilidad de Lotes:** Seguimiento de insumos por número de lote y fecha de caducidad.
* **Módulo de Reportes:** Generación de informes de consumo por rango de fechas.
* **Panel de Administración:** Interfaz de admin de Django para la gestión de usuarios e insumos.

---

##  Cómo Ejecutar (Desarrollo Local)

Sigue estos pasos para levantar el proyecto en tu máquina local.

### Prerrequisitos

* Python 3.10+
* Un servidor MySQL
* VS Code con la extensión "Live Server"

### 1. Backend (Django API)

1.  **Clonar el repositorio:**
    ```bash
    git clone (https://github.com/Alejano1/GestInvLab_Proyecto.git)
    cd GestInvLab_Proyecto_Final/GestInvLab_Backend
    ```

2.  **Crear y activar el entorno virtual:**
    ```bash
    # macOS / Linux
    python3 -m venv venv
    source venv/bin/activate
    
    # Windows
    python -m venv venv
    .\venv\Scripts\activate
    ```

3.  **Instalar dependencias:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configurar la Base de Datos:**
    * Crea una base de datos vacía en MySQL llamada `gestinvlab`.
    * Crea el archivo `.env` (copiando `.env.example` si tuvieras uno, o creándolo manualmente):
    ```ini
    # Archivo: GestInvLab_Backend/.env
    DB_HOST=localhost
    DB_NAME=gestinvlab
    DB_USER=root
    DB_PASSWORD=tu_contraseña_secreta
    DB_PORT=3306
    ```

5.  **Ejecutar las migraciones y el servidor:**
    ```bash
    python3 manage.py migrate
    python3 manage.py runserver
    ```
    El backend estará corriendo en `http://127.0.0.1:8000`

