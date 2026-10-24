// ==========================================
// app.js - Lógica Monolítica del Frontend
// ==========================================

let currentUser = {}; 
let globalProducts = []; 
let chartsInstance = {};

// 1. UTILIDADES Y UI
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast neu-outset`;
    let icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
    let color = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)';
    
    toast.innerHTML = `<i class="fa-solid ${icon}" style="color: ${color}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    if (html.getAttribute('data-theme') === 'light') {
        html.setAttribute('data-theme', 'dark'); icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        html.setAttribute('data-theme', 'light'); icon.classList.replace('fa-sun', 'fa-moon');
    }
}

function toggleSubmenu(id) { document.getElementById(id).classList.toggle('expanded'); }

function switchView(viewId, clickedElement) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-item, .submenu li').forEach(el => el.classList.remove('active'));
    if (clickedElement) clickedElement.classList.add('active');
}

// 2. CONEXIÓN AL BACKEND
async function fetchAPI(url, options = {}) {
    const token = localStorage.getItem('nexostock_token');
    const headers = { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}), ...options.headers };
    return fetch(url, { ...options, headers });
}

// 3. SEGURIDAD Y LOGIN
async function handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    if (!user || !pass) return showToast('Ingresa usuario y contraseña', 'error');

    try {
        const res = await fetchAPI('/api/auth', { method: 'POST', body: JSON.stringify({ username: user, password: pass }) });
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('nexostock_token', data.token);
            currentUser = { username: data.username, role: data.role };
            
            document.getElementById('login-screen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('app-layout').style.display = 'flex';
                initApp();
            }, 500);
            showToast('¡Bienvenido a NexoStock!', 'success');
        } else {
            showToast('Credenciales incorrectas', 'error');
        }
    } catch (e) { showToast('Error conectando al servidor', 'error'); }
}

function logout() {
    localStorage.removeItem('nexostock_token');
    window.location.reload();
}

function initApp() {
    document.getElementById('current-username').innerText = currentUser.username;
    if (currentUser.role === 'superadmin') {
        document.getElementById('menu-admin').style.display = 'flex';
        switchView('admin-clients-view', document.querySelector('#menu-admin .nav-item[data-target="admin-clients-view"]'));
        loadClients();
    } else {
        document.getElementById('menu-user').style.display = 'flex';
        switchView('dashboard-view', document.querySelector('#menu-user .nav-item[data-target="dashboard-view"]'));
        loadProducts();
        loadKardex();
    }
}

// 4. MÓDULOS DE SUPERADMIN
async function loadClients() {
    try {
        const res = await fetchAPI('/api/admin');
        const data = await res.json();
        const tbody = document.getElementById('clients-tbody');
        tbody.innerHTML = '';
        data.forEach(c => {
            const badge = c.status === 'activo' ? 'badge active' : 'badge danger';
            tbody.innerHTML += `<tr><td>${c.id}</td><td>${c.name}</td><td>@${c.username}</td><td><span class="${badge}">${c.status}</span></td><td>${String(c.next_payment_date).split('T')[0]}</td></tr>`;
        });
    } catch (e) { console.error("Error cargando clientes"); }
}

async function showNewClientForm() {
    const name = prompt("Nombre de la Tienda:");
    const user = prompt("Usuario:");
    const pass = prompt("Contraseña temporal:");
    const date = prompt("Próximo pago (YYYY-MM-DD):");

    if (name && user && pass && date) {
        const res = await fetchAPI('/api/admin', { method: 'POST', body: JSON.stringify({ name, user, pass, date }) });
        if (res.ok) { showToast("Cliente creado", "success"); loadClients(); }
        else showToast("Error al crear cliente", "error");
    }
}

// 5. MÓDULOS DE INVENTARIO (CLIENTE)
function updateSelects(data) {
    const options = data.map(p => `<option value="${p.id}">${p.code} - ${p.name}</option>`).join('');
    document.getElementById('restock-code').innerHTML = options;
    document.getElementById('transfer-code').innerHTML = options;
    document.getElementById('adjust-code').innerHTML = options;
}

async function loadProducts() {
    try {
        const res = await fetchAPI('/api/products');
        globalProducts = await res.json();
        const tbody = document.getElementById('products-tbody');
        tbody.innerHTML = '';
        
        globalProducts.forEach(p => {
            const marV = p.purchase_price > 0 ? (((p.normal_price - p.purchase_price) / p.purchase_price) * 100).toFixed(1) : 0;
            const marC = p.purchase_price > 0 ? (((p.cache_price - p.purchase_price) / p.purchase_price) * 100).toFixed(1) : 0;
            const stockColor = p.stock <= 5 ? 'var(--danger)' : 'inherit';
            
            tbody.innerHTML += `<tr>
                <td style="color:var(--primary);font-weight:600;">${p.code}</td><td>${p.name}</td>
                <td><span class="badge" style="background:rgba(0,0,0,0.1)">${p.category || 'General'}</span></td>
                <td>$${p.purchase_price}</td><td>$${p.normal_price}</td><td>$${p.cache_price}</td>
                <td><span style="color:var(--success)">${marV}%</span> / <span style="color:var(--warning)">${marC}%</span></td>
                <td style="color:${stockColor};font-weight:bold">${p.stock}</td>
            </tr>`;
        });
        
        updateSelects(globalProducts);
        renderCharts();
    } catch (e) { showToast("Error al cargar inventario", "error"); }
}

async function loadKardex() {
    try {
        const res = await fetchAPI('/api/kardex');
        const data = await res.json();
        const tbody = document.getElementById('kardex-tbody');
        tbody.innerHTML = '';
        data.forEach(k => {
            const date = new Date(k.operation_date).toLocaleString();
            const color = k.quantity_changed > 0 ? 'var(--success)' : 'var(--danger)';
            const qtyStr = k.quantity_changed > 0 ? `+${k.quantity_changed}` : k.quantity_changed;
            tbody.innerHTML += `<tr><td>${date}</td><td>@${k.username}</td><td>${k.operation_type}</td><td>${k.product_name}</td><td style="color:${color};font-weight:bold">${qtyStr}</td></tr>`;
        });
    } catch (e) { console.error("Error al cargar Kardex"); }
}

// 6. OPERACIONES DE PRODUCTO
async function executeProductAction(url, method, body, successMsg) {
    try {
        const res = await fetchAPI(url, { method, body: JSON.stringify(body) });
        if (res.ok) { showToast(successMsg, "success"); loadProducts(); loadKardex(); }
        else { const err = await res.json(); showToast(err.error || "Error en operación", "error"); }
    } catch (e) { showToast("Error de conexión", "error"); }
}

function createProduct() {
    const code = document.getElementById('new-code').value.trim();
    const name = document.getElementById('new-name').value.trim();
    const category = document.getElementById('new-category').value;
    
    // Convertir estrictamente a números para evitar que PostgreSQL rechace la inserción
    const buy = parseFloat(document.getElementById('new-buy').value) || 0;
    const sell = parseFloat(document.getElementById('new-sell').value) || 0;
    const cache = parseFloat(document.getElementById('new-cache').value) || 0;
    const stock = parseInt(document.getElementById('new-stock').value) || 0;

    if (!code || !name) return showToast("El código y nombre son obligatorios", "error");
    
    executeProductAction('/api/products', 'POST', { code, name, category, buy, sell, cache, stock }, "Producto creado exitosamente");
    
    // Limpiar inputs
    document.getElementById('new-code').value = '';
    document.getElementById('new-name').value = '';
    document.getElementById('new-buy').value = '';
    document.getElementById('new-sell').value = '';
    document.getElementById('new-cache').value = '';
    document.getElementById('new-stock').value = '';
}

function processRestock() {
    const id = document.getElementById('restock-code').value;
    const qty = document.getElementById('restock-qty').value;
    if (qty <= 0) return showToast("Cantidad inválida", "error");
    executeProductAction('/api/products', 'PUT', { id, action: 'restock', qty }, "Restock procesado con éxito");
    document.getElementById('restock-qty').value = '';
}

function processTransfer() {
    const id = document.getElementById('transfer-code').value;
    const qty = document.getElementById('transfer-qty').value;
    const desc = document.getElementById('transfer-desc').value;
    if (qty <= 0) return showToast("Cantidad inválida", "error");
    executeProductAction('/api/products', 'PUT', { id, action: 'transfer', qty, desc }, "Traslado procesado con éxito");
    document.getElementById('transfer-qty').value = ''; document.getElementById('transfer-desc').value = '';
}

function processPriceAdjust() {
    const id = document.getElementById('adjust-code').value;
    const sell = document.getElementById('adjust-sell').value;
    const cache = document.getElementById('adjust-cache').value;
    executeProductAction('/api/products', 'PUT', { id, action: 'price', sell, cache }, "Precios actualizados");
    document.getElementById('adjust-sell').value = ''; document.getElementById('adjust-cache').value = '';
}

// 7. DASHBOARD GRÁFICOS (APEXCHARTS)
function renderCharts() {
    let tCap = 0, pCap = 0, alerts = 0;
    let names = [], stocks = [], health = [0, 0, 0]; // Optimo, Bajo, Agotado
    
    globalProducts.forEach(p => {
        tCap += (p.purchase_price * p.stock);
        pCap += (p.cache_price * p.stock);
        if (p.stock === 0) health[2]++; else if (p.stock <= 5) { health[1]++; alerts++; } else health[0]++;
        names.push(p.name); stocks.push(p.stock);
    });

    document.getElementById('kpi-capital').innerText = `$${tCap.toFixed(2)}`;
    document.getElementById('kpi-projected').innerText = `$${pCap.toFixed(2)}`;
    document.getElementById('kpi-alerts').innerText = alerts;

    const themeMode = document.documentElement.getAttribute('data-theme');
    const txtCol = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();

    if(chartsInstance.bar) chartsInstance.bar.destroy();
    chartsInstance.bar = new ApexCharts(document.querySelector("#bar-chart"), {
        series: [{ name: 'Unidades', data: stocks }], chart: { type: 'bar', height: 250, toolbar: { show: false } },
        theme: { mode: themeMode }, plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        xaxis: { categories: names, labels: { style: { colors: txtCol } } }, yaxis: { labels: { style: { colors: txtCol } } }, colors: ['#4299e1']
    });
    chartsInstance.bar.render();

    if(chartsInstance.pie) chartsInstance.pie.destroy();
    chartsInstance.pie = new ApexCharts(document.querySelector("#health-chart"), {
        series: health, labels: ['Óptimo', 'Bajo', 'Agotado'], chart: { type: 'donut', height: 250 },
        theme: { mode: themeMode }, colors: ['#38a169', '#dd6b20', '#e53e3e'], legend: { position: 'bottom', labels:{colors: txtCol} }, dataLabels: {enabled: false}
    });
    chartsInstance.pie.render();
}

// Capital por Categoría (Datos Reales)
    const catData = {};
    globalProducts.forEach(p => {
        catData[p.category || 'General'] = (catData[p.category || 'General'] || 0) + (p.purchase_price * p.stock);
    });
    
    if(chartsInstance.cat) chartsInstance.cat.destroy();
    chartsInstance.cat = new ApexCharts(document.querySelector("#category-chart"), {
        series: Object.values(catData), labels: Object.keys(catData),
        chart: { type: 'pie', height: 250 }, theme: { mode: themeMode },
        legend: { position: 'bottom', labels: { colors: txtCol } }, dataLabels: { enabled: false }, stroke: { show: false }
    });
    chartsInstance.cat.render();

    // Fluctuación de Costos (Estético/Simulado)
    if(chartsInstance.candle) chartsInstance.candle.destroy();
    chartsInstance.candle = new ApexCharts(document.querySelector("#candlestick-chart"), {
        series: [{ data: [
            { x: new Date(2026, 9, 1), y: [120, 135, 110, 125] }, { x: new Date(2026, 9, 8), y: [125, 140, 120, 138] },
            { x: new Date(2026, 9, 15), y: [138, 155, 130, 145] }, { x: new Date(2026, 9, 22), y: [145, 150, 140, 148] }
        ]}],
        chart: { type: 'candlestick', height: 250, toolbar: { show: false } }, theme: { mode: themeMode },
        xaxis: { type: 'datetime', labels: { style: { colors: txtCol } } }, yaxis: { labels: { style: { colors: txtCol } } }
    });
    chartsInstance.candle.render();

    // Flujo de Almacén (Estético/Simulado)
    if(chartsInstance.flow) chartsInstance.flow.destroy();
    chartsInstance.flow = new ApexCharts(document.querySelector("#flow-chart"), {
        series: [
            { name: 'Entradas', data: [120, 80, 150, 40, 90] }, { name: 'Salidas', data: [40, 90, 60, 110, 30] }
        ],
        chart: { type: 'area', height: 250, toolbar: { show: false } }, theme: { mode: themeMode },
        colors: ['#4299e1', '#e53e3e'], dataLabels: { enabled: false }, stroke: { curve: 'smooth', width: 2 },
        xaxis: { categories: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5'], labels: { style: { colors: txtCol } } },
        yaxis: { labels: { style: { colors: txtCol } } }, legend: { position: 'bottom', labels: { colors: txtCol } }
    });
    chartsInstance.flow.render();

// 8. GENERADOR DE REPORTES CLIENT-SIDE
function exportExcel() {
    showToast("Generando Excel...", "info");
    const table = document.getElementById("inventory-table");
    const wb = XLSX.utils.table_to_book(table, {sheet: "Inventario"});
    XLSX.writeFile(wb, "NexoStock_Inventario.xlsx");
    showToast("Descarga completada", "success");
}

function exportPDF() {
    showToast("Generando PDF...", "info");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Historial de Movimientos - NexoStock", 14, 15);
    doc.autoTable({ html: '#kardex-table', startY: 20, theme: 'grid' });
    doc.save('NexoStock_Kardex.pdf');
    showToast("Descarga completada", "success");
}
