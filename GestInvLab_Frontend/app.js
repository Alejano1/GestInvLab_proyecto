
const API_URL = "http://127.0.0.1:8000";

let currentMovementItems = [];
let currentReportData = []; // Para exportar CSV

// =============================================
// HELPERS (Funciones de Ayuda)
// =============================================

function getToken() {
    return localStorage.getItem("authToken");
}

async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = { "Content-Type": "application/json", ...options.headers };
    if (token) {
        headers["Authorization"] = `Token ${token}`;
    }
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers: headers });
    if (response.status === 401) {
        logout();
        throw new Error("No autorizado");
    }
    return response;
}

function logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    localStorage.removeItem("isStaff");
    window.location.href = "login.html";
}

// =============================================
// LÓGICA DE INICIALIZACIÓN
// =============================================

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const appContent = document.getElementById("app-content");
    if (loginForm) {
        initLoginPage();
    } else if (appContent) {
        initIndexPage();
    }
});

// =============================================
// PÁGINA DE LOGIN (login.html)
// =============================================

function initLoginPage() {
    const loginForm = document.getElementById("login-form");
    loginForm.addEventListener("submit", handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const errorMessage = document.getElementById("error-message");
    errorMessage.classList.add("d-none");
    try {
        const response = await fetch(`${API_URL}/api-token-auth/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: usernameInput.value,
                password: passwordInput.value,
            }),
        });
        if (!response.ok) { throw new Error("Usuario o contraseña incorrectos"); }
        const data = await response.json(); 
        
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("isStaff", data.is_staff); 
        
        window.location.href = "index.html"; 
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove("d-none");
    }
}

// =============================================
// PÁGINA PRINCIPAL (index.html)
// =============================================

function initIndexPage() {
    const token = getToken();
    const username = localStorage.getItem("username");
    const isStaff = localStorage.getItem("isStaff") === 'true'; 

    // 1. Sello de Seguridad
    if (!token) {
        window.location.href = "login.html";
        return; 
    }

    // 2. Configurar botón de Logout
    document.getElementById("logout-button").addEventListener("click", (e) => {
        e.preventDefault();
        logout();
    });
    
    // 3. Mostrar nombre de usuario
    const userNameDisplay = document.getElementById("user-name-display");
    if (userNameDisplay && username) {
        userNameDisplay.textContent = username; 
    }
    
    // 4. Lógica de roles
    const reportesLink = document.getElementById("nav-reportes-link");
    if (reportesLink) {
        reportesLink.classList.remove("d-none"); 
    }
    const adminLink = document.getElementById("nav-admin-link");
    if (adminLink) {
        if (isStaff) {
            adminLink.classList.remove("d-none");
        } else {
            adminLink.classList.add("d-none");
        }
    }
    
    // 5. Configurar Navegación Principal
    const navLinks = document.querySelectorAll("#main-nav .nav-link");
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            if (e.target.classList.contains("active")) return;
            navLinks.forEach(l => l.classList.remove("active"));
            e.target.classList.add("active");
            const linkId = e.target.id; 
            if (linkId) {
                const moduleName = linkId.split("-")[1]; 
                if (moduleName) {
                    showModule(`${moduleName}-module`);
                }
            }
        });
    });

    // 6. Cargar módulos
    loadStockModule();
    loadEntradaModule();
    loadSalidaModule();
    loadReportesModule();
    loadAdministrarModule(); 
}

function showModule(moduleIdToShow) {
    currentMovementItems = [];
    const modules = document.querySelectorAll("#app-content > div");
    modules.forEach(module => module.classList.add("d-none"));
    
    const moduleToShow = document.getElementById(moduleIdToShow);
    if (moduleToShow) moduleToShow.classList.remove("d-none");
    
    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleString("es-CL", {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    if (moduleIdToShow === 'entrada-module') {
        document.getElementById("entrada-fecha-display").value = fechaFormateada;
        renderEntradaTable();
    } else if (moduleIdToShow === 'stock-module') {
        fetchInsumos();
    } else if (moduleIdToShow === 'salida-module') {
        document.getElementById("salida-fecha-display").value = fechaFormateada;
        document.getElementById("salida-servicio-display").value = ""; 
        renderSalidaTable();
        fetchServiciosForSelect("salida-servicio-select");
    } else if (moduleIdToShow === 'reportes-module') {
        loadReportFilters();
    } else if (moduleIdToShow === 'administrar-module') {
        loadAdminTables();
    }
}

// =============================================
// MÓDULO DE STOCK 
// =============================================

function loadStockModule() {
    document.getElementById("refresh-stock-btn").addEventListener("click", fetchInsumos);
    fetchInsumos();
}

async function fetchInsumos() {
    const tableBody = document.getElementById("stock-table-body");
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border" role="status"></div></td></tr>`;
    try {
        const response = await apiFetch("/api/inventory/insumos/");
        if (!response.ok) { throw new Error("No se pudieron cargar los insumos."); }
        const insumos = await response.json();
        renderInsumosTable(insumos);
    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

function renderInsumosTable(insumos) {
    const tableBody = document.getElementById("stock-table-body");
    tableBody.innerHTML = ""; 
    if (insumos.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No se encontraron insumos.</td></tr>`;
        return;
    }
    insumos.forEach(insumo => {
        const row = document.createElement("tr");
        let stockClass = "";
        const umbral = parseInt(insumo.umbral_critico);
        if (!isNaN(umbral) && insumo.stock_total <= umbral && insumo.stock_total > 0) {
            stockClass = "text-warning fw-bold";
        } else if (insumo.stock_total === 0) {
            stockClass = "text-danger fw-bold";
        }
        row.innerHTML = `
            <td><div class="fw-bold">${insumo.nombre}</div></td>
            <td>${insumo.codigo_producto || "N/A"}</td>
            <td><span class="h5 ${stockClass}">${insumo.stock_total}</span></td>
            <td><button class="btn btn-sm btn-outline-primary" onclick="toggleLotes(this, ${insumo.id})">Ver Lotes <i class="bi bi-chevron-down"></i></button></td>
        `;
        tableBody.appendChild(row);
    });
}

async function toggleLotes(button, insumoId) {
    const row = button.closest("tr");
    const subTableId = `lotes-for-${insumoId}`;
    const existingSubTable = document.getElementById(subTableId);
    if (existingSubTable) {
        existingSubTable.remove();
        button.innerHTML = 'Ver Lotes <i class="bi bi-chevron-down"></i>';
        return;
    }
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
    try {
        const response = await apiFetch(`/api/inventory/lotes/?insumo_id=${insumoId}`);
        if (!response.ok) { throw new Error("No se pudieron cargar los lotes."); }
        const lotes = await response.json();
        const subTableRow = document.createElement("tr");
        subTableRow.id = subTableId;
        const subTableCell = document.createElement("td");
        subTableCell.colSpan = 4;
        subTableCell.classList.add("p-3", "bg-light");
        subTableCell.innerHTML = renderLotesTable(lotes);
        subTableRow.appendChild(subTableCell);
        row.after(subTableRow); 
        button.innerHTML = 'Ocultar Lotes <i class="bi bi-chevron-up"></i>';
    } catch (error) {
        console.error(error);
        button.innerHTML = 'Error <i class="bi bi-exclamation-triangle"></i>';
    }
}

function renderLotesTable(lotes) {
    const lotesConStock = lotes.filter(lote => lote.stock_por_lote > 0);
    if (lotesConStock.length === 0) {
        return `<div class="text-center text-muted p-2">Este insumo no tiene lotes con stock disponible.</div>`;
    }
    let tableHtml = `
        <h6 class="text-muted mb-2">Lotes Disponibles (Ordenados por Caducidad)</h6>
        <table class="table table-sm table-bordered bg-white mb-0">
            <thead class="table-secondary">
                <tr><th>N° Lote</th><th>Caducidad</th><th>Stock del Lote</th></tr>
            </thead>
            <tbody>
    `;
    lotesConStock.forEach(lote => {
        let caducidadClass = "";
        if (lote.fecha_caducidad) {
            const caducidadDate = new Date(lote.fecha_caducidad);
            const hoy = new Date();
            const diffTime = caducidadDate - hoy;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 30) { caducidadClass = "text-danger fw-bold"; }
        }
        tableHtml += `
            <tr>
                <td>${lote.numero_lote}</td>
                <td class="${caducidadClass}">${lote.fecha_caducidad || "N/A"}</td>
                <td>${lote.stock_por_lote}</td>
            </tr>
        `;
    });
    tableHtml += `</tbody></table>`;
    return tableHtml;
}

// =============================================
// MÓDULO DE ENTRADA 
// =============================================

function loadEntradaModule() {
    fetchInsumosForSelect("entrada-insumo-select");
    document.getElementById("entrada-add-item-form").addEventListener("submit", (e) => {
        e.preventDefault();
        handleEntradaAddItem();
    });
    document.getElementById("registrar-entrada-btn").addEventListener("click", handleRegistrarEntrada);
}

async function fetchInsumosForSelect(selectId) {
    const select = document.getElementById(selectId);
    try {
        const response = await apiFetch("/api/inventory/insumos/");
        if (!response.ok) { throw new Error("Error al cargar insumos"); }
        const insumos = await response.json();
        select.innerHTML = '<option value="">-- Seleccione un insumo --</option>';
        insumos.forEach(insumo => {
            const option = document.createElement("option");
            option.value = insumo.id;
            option.textContent = `${insumo.nombre} (${insumo.codigo_producto || 'N/A'})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
        select.innerHTML = '<option value="">Error al cargar insumos</option>';
    }
}

function handleEntradaAddItem() {
    const insumoSelect = document.getElementById("entrada-insumo-select");
    const loteInput = document.getElementById("entrada-lote");
    const caducidadInput = document.getElementById("entrada-caducidad");
    const cantidadInput = document.getElementById("entrada-cantidad");
    if (!insumoSelect.value || !loteInput.value || !cantidadInput.value || cantidadInput.value <= 0) {
        alert("Por favor, complete todos los campos (Insumo, Lote y Cantidad > 0).");
        return;
    }
    const newItem = {
        tempId: Date.now(), 
        insumoId: insumoSelect.value,
        insumoNombre: insumoSelect.options[insumoSelect.selectedIndex].text,
        numeroLote: loteInput.value,
        fechaCaducidad: caducidadInput.value || null,
        cantidad: parseInt(cantidadInput.value)
    };
    currentMovementItems.push(newItem);
    renderEntradaTable();
    document.getElementById("entrada-add-item-form").reset();
}

function renderEntradaTable() {
    const tableBody = document.getElementById("entrada-table-body");
    const registerBtn = document.getElementById("registrar-entrada-btn");
    tableBody.innerHTML = ""; 
    if (currentMovementItems.length === 0) {
        const row = document.createElement("tr");
        row.id = "entrada-empty-row";
        row.innerHTML = `<td colspan="4" class="text-center text-muted p-4">Añade insumos desde el formulario.</td>`;
        tableBody.appendChild(row);
        registerBtn.disabled = true;
        return;
    }
    registerBtn.disabled = false;
    currentMovementItems.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.insumoNombre}</td>
            <td>${item.numeroLote}</td>
            <td>${item.cantidad}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="removeMovementItem(${item.tempId}, 'entrada')"><i class="bi bi-trash"></i></button></td>
        `;
        tableBody.appendChild(row);
    });
}

function removeMovementItem(tempId, type) {
    currentMovementItems = currentMovementItems.filter(item => item.tempId !== tempId);
    if (type === 'entrada') {
        renderEntradaTable();
    } else if (type === 'salida') {
        renderSalidaTable();
    }
}

async function handleRegistrarEntrada() {
    const registerBtn = document.getElementById("registrar-entrada-btn");
    const alertBox = document.getElementById("entrada-alert");
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Registrando...';
    alertBox.classList.add("d-none"); 
    const payloadDetalles = currentMovementItems.map(item => ({
        insumo_id: parseInt(item.insumoId),
        numero_lote: item.numeroLote,
        fecha_caducidad: item.fechaCaducidad || null,
        cantidad: item.cantidad
    }));
    const payload = { detalles: payloadDetalles };
    try {
        const response = await apiFetch("/api/inventory/entradas/", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) { throw new Error(JSON.stringify(data)); }
        const nuevoMovimiento = data;
        const fecha = new Date(nuevoMovimiento.fecha_registro).toLocaleString("es-CL", {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        alertBox.innerHTML = `
            <strong>¡Entrada registrada exitosamente!</strong><br>
            Documento: <b>${nuevoMovimiento.numero_documento}</b><br>
            Fecha: ${fecha}
        `;
        alertBox.className = "alert alert-success mt-3";
        currentMovementItems = [];
        renderEntradaTable();
        fetchInsumos(); 
    } catch (error) {
        console.error(error);
        alertBox.textContent = `Error al registrar: ${error.message}`;
        alertBox.className = "alert alert-danger mt-3";
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="bi bi-check-lg"></i> Registrar Entrada';
    }
}

// =============================================
// MÓDULO DE SALIDA
// =============================================

function loadSalidaModule() {
    fetchInsumosForSelect("salida-insumo-select");
    fetchServiciosForSelect("salida-servicio-select");
    document.getElementById("salida-servicio-select").addEventListener("change", (e) => {
        const serviceDisplay = document.getElementById("salida-servicio-display");
        serviceDisplay.value = e.target.value ? e.target.options[e.target.selectedIndex].text : "";
    });
    document.getElementById("salida-insumo-select").addEventListener("change", (e) => {
        const insumoId = e.target.value;
        const loteSelect = document.getElementById("salida-lote-select");
        loteSelect.innerHTML = '<option value="">...</option>';
        loteSelect.disabled = true;
        if (insumoId) fetchLotesForSelect(insumoId);
    });
    document.getElementById("salida-add-item-form").addEventListener("submit", (e) => {
        e.preventDefault();
        handleSalidaAddItem();
    });
    document.getElementById("registrar-salida-btn").addEventListener("click", handleRegistrarSalida);
}

async function fetchServiciosForSelect(selectId) {
    const select = document.getElementById(selectId);
    try {
        const response = await apiFetch("/api/inventory/servicios/");
        if (!response.ok) { throw new Error("Error al cargar servicios"); }
        const servicios = await response.json();
        select.innerHTML = '<option value="">-- Seleccione un servicio --</option>';
        servicios.forEach(servicio => {
            const option = document.createElement("option");
            option.value = servicio.id;
            option.textContent = servicio.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
        select.innerHTML = '<option value="">Error al cargar servicios</option>';
    }
}

async function fetchLotesForSelect(insumoId) {
    const select = document.getElementById("salida-lote-select");
    const cantidadInput = document.getElementById("salida-cantidad");
    select.innerHTML = '<option value="">Cargando lotes...</option>';
    select.disabled = true;
    cantidadInput.disabled = true;
    try {
        const response = await apiFetch(`/api/inventory/lotes/?insumo_id=${insumoId}`);
        if (!response.ok) { throw new Error("Error al cargar lotes"); }
        const lotes = await response.json();
        const lotesConStock = lotes.filter(lote => lote.stock_por_lote > 0);
        if (lotesConStock.length === 0) {
            select.innerHTML = '<option value="">No hay lotes con stock</option>';
            return;
        }
        select.innerHTML = '<option value="">-- Seleccione un lote --</option>';
        lotesConStock.forEach(lote => {
            const option = document.createElement("option");
            option.value = lote.id;
            option.dataset.stock = lote.stock_por_lote; 
            option.textContent = `Lote: ${lote.numero_lote} (Stock: ${lote.stock_por_lote} / Cad: ${lote.fecha_caducidad || 'N/A'})`;
            select.appendChild(option);
        });
        select.disabled = false;
        cantidadInput.disabled = false;
    } catch (error) {
        console.error(error);
        select.innerHTML = '<option value="">Error al cargar lotes</option>';
    }
}

function handleSalidaAddItem() {
    const insumoSelect = document.getElementById("salida-insumo-select");
    const loteSelect = document.getElementById("salida-lote-select");
    const cantidadInput = document.getElementById("salida-cantidad");
    const servicioSelect = document.getElementById("salida-servicio-select");
    if (!servicioSelect.value) {
        alert("Por favor, seleccione un Servicio/Unidad de destino primero.");
        return;
    }
    const selectedLoteOption = loteSelect.options[loteSelect.selectedIndex];
    if (!selectedLoteOption || !selectedLoteOption.value) {
        alert("Por favor, seleccione un lote.");
        return;
    }
    const maxStock = parseInt(selectedLoteOption.dataset.stock || 0);
    const cantidad = parseInt(cantidadInput.value);
    if (!insumoSelect.value || !loteSelect.value || !cantidad || cantidad <= 0) {
        alert("Por favor, complete todos los campos (Insumo, Lote y Cantidad > 0).");
        return;
    }
    if (cantidad > maxStock) {
        alert(`Stock insuficiente. El lote seleccionado solo tiene ${maxStock} unidades.`);
        return;
    }
    const yaExiste = currentMovementItems.some(item => item.loteId == loteSelect.value);
    if (yaExiste) {
        alert("Este lote ya ha sido añadido al detalle. Puede borrarlo y volver a añadirlo si desea cambiar la cantidad.");
        return;
    }
    const newItem = {
        tempId: Date.now(),
        loteId: loteSelect.value,
        insumoNombre: insumoSelect.options[insumoSelect.selectedIndex].text.split('(')[0].trim(),
        numeroLote: selectedLoteOption.text.split('(')[0].trim(),
        cantidad: cantidad,
        servicioNombre: servicioSelect.options[servicioSelect.selectedIndex].text 
    };
    currentMovementItems.push(newItem);
    renderSalidaTable();
    document.getElementById("salida-insumo-select").value = "";
    document.getElementById("salida-lote-select").innerHTML = '<option value="">Seleccione un insumo primero</option>';
    document.getElementById("salida-lote-select").disabled = true;
    document.getElementById("salida-cantidad").value = "";
    document.getElementById("salida-cantidad").disabled = true;
} 

function renderSalidaTable() {
    const tableBody = document.getElementById("salida-table-body");
    const registerBtn = document.getElementById("registrar-salida-btn");
    tableBody.innerHTML = "";
    if (currentMovementItems.length === 0) {
        const row = document.createElement("tr");
        row.id = "salida-empty-row";
        row.innerHTML = `<td colspan="5" class="text-center text-muted p-4">Añade insumos desde el formulario.</td>`;
        tableBody.appendChild(row);
        registerBtn.disabled = true;
        return;
    }
    registerBtn.disabled = false;
    currentMovementItems.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.servicioNombre}</td>
            <td>${item.insumoNombre}</td>
            <td>${item.numeroLote}</td>
            <td>${item.cantidad}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="removeMovementItem(${item.tempId}, 'salida')"><i class="bi bi-trash"></i></button></td>
        `;
        tableBody.appendChild(row);
    });
}

async function handleRegistrarSalida() {
    const registerBtn = document.getElementById("registrar-salida-btn");
    const alertBox = document.getElementById("salida-alert");
    const servicioSelect = document.getElementById("salida-servicio-select");
    if (!servicioSelect.value) {
        alert("Por favor, seleccione un Servicio/Unidad de destino.");
        return;
    }
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Registrando...';
    alertBox.classList.add("d-none"); 
    const payloadDetalles = currentMovementItems.map(item => ({
        lote: parseInt(item.loteId), 
        cantidad: item.cantidad
    }));
    const payload = {
        servicio_destino: parseInt(servicioSelect.value),
        detalles: payloadDetalles
    };
    try {
        const response = await apiFetch("/api/inventory/movimientos/", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data.detalles ? JSON.stringify(data.detalles) : (data.non_field_errors || JSON.stringify(data));
            throw new Error(errorMsg);
        }
        const nuevoMovimiento = data; 
        const fecha = new Date(nuevoMovimiento.fecha_registro).toLocaleString("es-CL", {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        alertBox.innerHTML = `
            <strong>¡Salida registrada exitosamente!</strong><br>
            Documento: <b>${nuevoMovimiento.numero_documento}</b><br>
            Fecha: ${fecha}
        `;
        alertBox.className = "alert alert-success mt-3";
        currentMovementItems = [];
        renderSalidaTable();
        document.getElementById("salida-servicio-select").value = "";
        document.getElementById("salida-servicio-display").value = ""; 
        fetchInsumos(); 
    } catch (error) {
        console.error(error);
        alertBox.textContent = `Error al registrar: ${error.message}`;
        alertBox.className = "alert alert-danger mt-3";
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="bi bi-check-lg"></i> Registrar Salida';
    }
}

// =============================================
// MÓDULO DE REPORTES
// =============================================

let reportFiltersLoaded = false;

function loadReportesModule() {
    if (!reportFiltersLoaded) {
        loadReportFilters();
        reportFiltersLoaded = true;
    }
    document.getElementById("report-form").addEventListener("submit", (e) => {
        e.preventDefault();
        handleGenerateReport();
    });
    document.getElementById("report-clear-btn").addEventListener("click", () => {
        document.getElementById("report-form").reset();
        handleGenerateReport(); 
    });
    document.getElementById("report-download-csv-btn").addEventListener("click", exportReportToCSV);
}

function loadReportFilters() {
    fetchInsumosForSelect("report-insumo");
    fetchServiciosForSelect("report-servicio");
    fetchUsersForSelect("report-usuario");
}

async function fetchUsersForSelect(selectId) {
    const select = document.getElementById(selectId);
    try {
        const response = await apiFetch("/api/inventory/usuarios/"); 
        if (!response.ok) { throw new Error("Error al cargar usuarios"); }
        const usuarios = await response.json();
        select.innerHTML = '<option value="">-- Todos los usuarios --</option>';
        usuarios.forEach(user => {
            const option = document.createElement("option");
            option.value = user.id;
            option.textContent = user.username;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
        select.innerHTML = '<option value="">Error al cargar usuarios</option>';
    }
}

async function handleGenerateReport() {
    const tableBody = document.getElementById("report-table-body");
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4"><div class="spinner-border" role="status"></div></td></tr>`;
    currentReportData = []; // Limpiar datos anteriores

    const params = new URLSearchParams();
    const tipo = document.getElementById("report-tipo").value;
    const insumo = document.getElementById("report-insumo").value;
    const servicio = document.getElementById("report-servicio").value;
    const usuario = document.getElementById("report-usuario").value;
    const fechaInicio = document.getElementById("report-fecha-inicio").value;
    const fechaFin = document.getElementById("report-fecha-fin").value;

    if (tipo) params.append('tipo_movimiento', tipo);
    if (insumo) params.append('insumo_id', insumo);
    if (servicio) params.append('servicio_id', servicio);
    if (usuario) params.append('usuario_id', usuario);
    if (fechaInicio) params.append('fecha_inicio', fechaInicio);
    if (fechaFin) params.append('fecha_fin', fechaFin);

    const queryString = params.toString();

    try {
        const response = await apiFetch(`/api/inventory/reportes/movimientos/?${queryString}`); 
        if (!response.ok) { throw new Error("No se pudo generar el reporte."); }
        
        const movimientos = await response.json();
        currentReportData = movimientos;
        renderReportTable(movimientos);

    } catch (error) {
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">${error.message}</td></tr>`;
    }
}

function renderReportTable(movimientos) {
    const tableBody = document.getElementById("report-table-body");
    tableBody.innerHTML = "";

    if (movimientos.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted p-4">No se encontraron movimientos con esos filtros.</td></tr>`;
        return;
    }

    movimientos.forEach(mov => {
        const fecha = new Date(mov.fecha_registro).toLocaleString("es-CL");
        
        if (mov.detalles.length === 0) {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${fecha}</td>
                <td>${mov.numero_documento}</td>
                <td>${mov.tipo_movimiento}</td>
                <td colspan="3"><em>Movimiento sin detalles</em></td>
                <td>${mov.servicio_destino || 'N/A'}</td>
                <td>${mov.usuario}</td>
            `;
            tableBody.appendChild(row);
        } else {
            mov.detalles.forEach(detalle => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${fecha}</td>
                    <td>${mov.numero_documento}</td>
                    <td><span class="badge ${mov.tipo_movimiento === 'Entrada' ? 'bg-success-subtle text-success-emphasis' : 'bg-danger-subtle text-danger-emphasis'}">${mov.tipo_movimiento}</span></td>
                    <td>${detalle.insumo_nombre}</td>
                    <td>${detalle.lote_numero}</td>
                    <td>${detalle.cantidad}</td>
                    <td>${mov.servicio_destino || 'N/A'}</td>
                    <td>${mov.usuario}</td>
                `;
                tableBody.appendChild(row);
            });
        }
    });
}

function exportReportToCSV() {
    if (currentReportData.length === 0) {
        alert("Por favor, genere un reporte primero antes de exportar.");
        return;
    }

    const headers = [
        "Fecha", "Documento", "Tipo", "Insumo", 
        "Lote", "Cantidad", "Destino", "Usuario"
    ];
    let csvContent = headers.join(",") + "\r\n"; 

    const escapeCSV = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

    currentReportData.forEach(mov => {
        const fecha = new Date(mov.fecha_registro).toLocaleString("es-CL");
        const doc = mov.numero_documento;
        const tipo = mov.tipo_movimiento;
        const destino = mov.servicio_destino || 'N/A';
        const usuario = mov.usuario;

        if (mov.detalles.length === 0) {
            const row = [
                fecha, doc, tipo, "N/A", "N/A", 0, destino, usuario
            ].map(escapeCSV).join(",");
            csvContent += row + "\r\n";
        } else {
            mov.detalles.forEach(detalle => {
                const row = [
                    fecha,
                    doc,
                    tipo,
                    detalle.insumo_nombre,
                    detalle.lote_numero,
                    detalle.cantidad,
                    destino,
                    usuario
                ].map(escapeCSV).join(",");
                csvContent += row + "\r\n";
            });
        }
    });

    // ---  Para la descarga ---
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "reporte_inventario.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert("Tu navegador no soporta la descarga de archivos CSV. Por favor, actualízalo.");
    }
}


// =============================================
// MÓDULO DE ADMINISTRACIÓN 
// =============================================

function loadAdministrarModule() {
    // Conectar los formularios
    document.getElementById("admin-create-insumo-form").addEventListener("submit", handleCreateInsumo);
    document.getElementById("admin-create-servicio-form").addEventListener("submit", handleCreateServicio);
    document.getElementById("admin-create-user-form").addEventListener("submit", handleCreateUsuario);
}

// Carga las 3 tablas de la derecha (Insumos, Servicios, Usuarios)
async function loadAdminTables() {
    
    // --- 1. Cargar Insumos ---
    const insumosTable = document.getElementById("admin-insumos-table");
    insumosTable.innerHTML = `<tr><td colspan="4" class="text-center">Cargando...</td></tr>`;
    try {
        const response = await apiFetch("/api/inventory/admin/insumos/");
        const insumos = await response.json();
        insumosTable.innerHTML = "";
        if (insumos.length === 0) {
            insumosTable.innerHTML = `<tr><td colspan="4">No hay insumos creados.</td></tr>`;
        }
        insumos.forEach(insumo => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${insumo.nombre}</td>
                <td>${insumo.codigo_producto}</td>
                <td>
                    <input type="number" class="form-control form-control-sm" 
                           id="umbral-input-${insumo.id}" 
                           value="${insumo.umbral_critico}" 
                           style="width: 100px;">
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-success" 
                            onclick="handleUpdateUmbral(${insumo.id}, this)">
                        <i class="bi bi-save"></i>
                    </button>
                </td>
            `;
            insumosTable.appendChild(row);
        });
    } catch (error) {
        insumosTable.innerHTML = `<tr><td colspan="4" class="text-danger">Error al cargar insumos.</td></tr>`;
    }

    // --- 2. Cargar Servicios ---
    const serviciosTable = document.getElementById("admin-servicios-table");
    serviciosTable.innerHTML = `<tr><td>Cargando...</td></tr>`;
    try {
        const response = await apiFetch("/api/inventory/admin/servicios/");
        const servicios = await response.json();
        serviciosTable.innerHTML = "";
        if (servicios.length === 0) {
            serviciosTable.innerHTML = `<tr><td>No hay servicios creados.</td></tr>`;
        }
        servicios.forEach(servicio => {
            const row = document.createElement("tr");
            row.innerHTML = `<td>${servicio.nombre}</td>`;
            serviciosTable.appendChild(row);
        });
    } catch (error) {
        serviciosTable.innerHTML = `<tr><td class="text-danger">Error al cargar servicios.</td></tr>`;
    }
    
    // --- 3. Cargar Usuarios ---
    const usuariosTable = document.getElementById("admin-usuarios-table");
    usuariosTable.innerHTML = `<tr><td colspan="3" class="text-center">Cargando...</td></tr>`;
    try {
        const response = await apiFetch("/api/inventory/admin/usuarios/");
        const usuarios = await response.json();
        renderAdminUsuariosTable(usuarios);
    } catch (error) {
        usuariosTable.innerHTML = `<tr><td colspan="3" class="text-danger">Error al cargar usuarios.</td></tr>`;
    }
}

// Lógica para crear un nuevo Insumo
async function handleCreateInsumo(e) {
    e.preventDefault();
    const nombre = document.getElementById("admin-insumo-nombre").value;
    const codigo = document.getElementById("admin-insumo-codigo").value;
    const umbral = document.getElementById("admin-insumo-umbral").value;
    const alertBox = document.getElementById("admin-insumo-alert");
    alertBox.classList.add("d-none");

    const payload = {
        nombre: nombre,
        codigo_producto: codigo, 
        umbral_critico: parseInt(umbral)
    };

    try {
        const response = await apiFetch("/api/inventory/admin/insumos/", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) { 
            const errorMsg = data.codigo_producto || data.nombre || JSON.stringify(data);
            throw new Error(errorMsg);
        }
        
        alertBox.textContent = `Insumo "${data.nombre}" creado exitosamente.`;
        alertBox.className = "alert alert-success mt-3";
        
        document.getElementById("admin-create-insumo-form").reset();
        loadAdminTables(); 
        fetchInsumosForSelect("entrada-insumo-select"); 
        fetchInsumosForSelect("salida-insumo-select"); 
        fetchInsumosForSelect("report-insumo"); 

    } catch (error) {
        alertBox.textContent = `Error: ${error.message}`;
        alertBox.className = "alert alert-danger mt-3";
    }
}

// Lógica para crear un nuevo Servicio
async function handleCreateServicio(e) {
    e.preventDefault();
    const nombre = document.getElementById("admin-servicio-nombre").value;
    const alertBox = document.getElementById("admin-servicio-alert");
    alertBox.classList.add("d-none");

    const payload = { nombre: nombre };

    try {
        const response = await apiFetch("/api/inventory/admin/servicios/", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) { 
            const errorMsg = data.nombre || JSON.stringify(data);
            throw new Error(errorMsg);
        }

        alertBox.textContent = `Servicio "${data.nombre}" creado exitosamente.`;
        alertBox.className = "alert alert-success mt-3";

        document.getElementById("admin-create-servicio-form").reset();
        loadAdminTables(); // Refrescar la tabla de servicios
        fetchServiciosForSelect("salida-servicio-select"); 
        fetchServiciosForSelect("report-servicio"); 
        
    } catch (error) {
        alertBox.textContent = `Error: ${error.message}`;
        alertBox.className = "alert alert-danger mt-3";
    }
}

// Función para actualizar umbral
async function handleUpdateUmbral(insumoId, button) {
    const input = document.getElementById(`umbral-input-${insumoId}`);
    const newUmbral = parseInt(input.value);

    if (isNaN(newUmbral) || newUmbral < 0) {
        alert("Por favor, ingrese un número válido para el umbral (0 o más).");
        return;
    }
    
    button.disabled = true; // Deshabilitar botón mientras guarda
    const originalIcon = button.innerHTML;
    button.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

    const payload = {
        umbral_critico: newUmbral
    };

    try {
        const response = await apiFetch(`/api/inventory/admin/insumos/${insumoId}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(JSON.stringify(data));
        }
        
        // ¡Éxito!
        button.innerHTML = `<i class="bi bi-check-lg text-success"></i>`; 
        setTimeout(() => { button.innerHTML = originalIcon; }, 2000); // Volver al ícono original

    } catch (error) {
        alert(`Error al actualizar el umbral: ${error.message}`);
        button.innerHTML = originalIcon; 
    } finally {
        button.disabled = false;
    }
}

// Funcion para crear Usuario
async function handleCreateUsuario(e) {
    e.preventDefault();
    const username = document.getElementById("admin-user-username").value;
    const password = document.getElementById("admin-user-password").value;
    const isStaff = document.getElementById("admin-user-isstaff").checked;
    const alertBox = document.getElementById("admin-user-alert");
    alertBox.classList.add("d-none");

    const payload = {
        username: username,
        password: password,
        is_staff: isStaff
    };

    try {
        const response = await apiFetch("/api/inventory/admin/usuarios/", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) { 
            const errorMsg = data.username || data.password || JSON.stringify(data);
            throw new Error(errorMsg); 
        }

        alertBox.textContent = `Usuario "${data.username}" creado exitosamente.`;
        alertBox.className = "alert alert-success mt-3";
        
        document.getElementById("admin-create-user-form").reset();
        loadAdminTables(); // Refrescar la tabla de usuarios
        fetchUsersForSelect("report-usuario"); 

    } catch (error) {
        alertBox.textContent = `Error: ${error.message}`;
        alertBox.className = "alert alert-danger mt-3";
    }
}

// Función para renderizar tabla de usuarios
function renderAdminUsuariosTable(usuarios) {
    const tableBody = document.getElementById("admin-usuarios-table");
    const currentUser = localStorage.getItem("username");
    tableBody.innerHTML = "";
    
    if (usuarios.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3">No hay usuarios.</td></tr>`;
        return;
    }

    usuarios.forEach(user => {
        const row = document.createElement("tr");
        
        // El superusuario (ej. 'admin') o el usuario actual no puede desactivarse a sí mismo
        const disableToggles = user.is_superuser || user.username === currentUser;

        row.innerHTML = `
            <td>${user.username} ${user.is_superuser ? '(Superadmin)' : ''}</td>
            <td>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" 
                           id="staff-toggle-${user.id}" 
                           onchange="handleUpdateUserStatus(${user.id}, 'is_staff', this.checked)"
                           ${user.is_staff ? 'checked' : ''}
                           ${disableToggles ? 'disabled' : ''}>
                </div>
            </td>
            <td>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" role="switch" 
                           id="active-toggle-${user.id}" 
                           onchange="handleUpdateUserStatus(${user.id}, 'is_active', this.checked)"
                           ${user.is_active ? 'checked' : ''}
                           ${disableToggles ? 'disabled' : ''}>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Funcion para actualizar rol de usuario
async function handleUpdateUserStatus(userId, field, isChecked) {
    const payload = {};
    payload[field] = isChecked; 

    try {
        const response = await apiFetch(`/api/inventory/admin/usuarios/${userId}/`, {
            method: "PATCH",
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(JSON.stringify(data));
        }
        
        // ¡Éxito! 
        
    } catch (error) {
        alert(`Error al actualizar el usuario: ${error.message}`);
        
        loadAdminTables(); 
    }
}