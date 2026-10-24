// public/js/app.js

let chartsInstances = {};

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('nexo_role') !== 'cliente') {
        window.location.href = '/index.html';
    }
    initSPA();
    loadDashboard(); 
});

// --- LÓGICA DE LA SPA Y ACORDEÓN ---
function initSPA() {
    const accordionHeader = document.querySelector('.accordion-header');
    const accordionContent = document.querySelector('.accordion-content');
    
    accordionHeader.addEventListener('click', () => {
        accordionContent.classList.toggle('open');
        accordionHeader.textContent = accordionContent.classList.contains('open') ? '📦 Inventario ▾' : '📦 Inventario ▸';
    });

    const navButtons = document.querySelectorAll('button[data-target]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('button[data-target]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            
            const targetId = e.target.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            if(targetId === 'dashboard') loadDashboard();
            if(targetId === 'viewAll') loadInventory();
            if(targetId === 'restock') loadProductsForSelect();
            if(targetId === 'kardex') loadKardex();
        });
    });
}

// --- FUNCIONES DE INVENTARIO ---
async function loadInventory() {
    const res = await fetchAPI('/api/inventory/products');
    const products = await res.json();
    const tbody = document.getElementById('inventoryBody');
    tbody.innerHTML = '';

    products.forEach(p => {
        const marginNormal = (((p.normal_price - p.purchase_price) / p.purchase_price) * 100).toFixed(1);
        const marginCache = (((p.cache_price - p.purchase_price) / p.purchase_price) * 100).toFixed(1);
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${p.code}</strong></td>
                <td>${p.name}</td>
                <td style="color:${p.stock <= 5 ? 'var(--danger-color)' : 'inherit'}; font-weight:bold;">${p.stock}</td>
                <td>$${p.purchase_price}</td>
                <td>$${p.normal_price} <small style="color:#2ecc71;">(+${marginNormal}%)</small></td>
                <td>$${p.cache_price} <small style="color:#2ecc71;">(+${marginCache}%)</small></td>
            </tr>
        `;
    });
}

document.getElementById('formNewProduct').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        code: document.getElementById('p_code').value,
        name: document.getElementById('p_name').value,
        stock: parseInt(document.getElementById('p_stock').value),
        purchase_price: parseFloat(document.getElementById('p_buy').value),
        normal_price: parseFloat(document.getElementById('p_normal').value),
        cache_price: parseFloat(document.getElementById('p_cache').value)
    };

    try {
        const res = await fetchAPI('/api/inventory/products', { method: 'POST', body: JSON.stringify(body) });
        if(res.ok) {
            alert('Producto guardado con éxito');
            document.getElementById('formNewProduct').reset();
            document.querySelector('[data-target="viewAll"]').click(); 
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch (error) { console.error(error); }
});

// --- RESTOCK ---
async function loadProductsForSelect() {
    const res = await fetchAPI('/api/inventory/products');
    const products = await res.json();
    const select = document.getElementById('r_product');
    select.innerHTML = '<option value="">Selecciona un producto...</option>';
    products.forEach(p => {
        select.innerHTML += `<option value="${p.id}">[${p.code}] ${p.name} (Stock: ${p.stock})</option>`;
    });
}

document.getElementById('formRestock').addEventListener('submit', async (e) => {
    e.preventDefault();
    let qty = parseInt(document.getElementById('r_qty').value);
    const type = document.getElementById('r_type').value;
    
    if (type === 'TRASLADO') qty = -qty; 

    const body = {
        productId: document.getElementById('r_product').value,
        operationType: type,
        quantity: qty,
        description: document.getElementById('r_desc').value
    };

    try {
        const res = await fetchAPI('/api/inventory/restock', { method: 'POST', body: JSON.stringify(body) });
        if(res.ok) {
            alert('Movimiento registrado');
            document.getElementById('formRestock').reset();
            loadProductsForSelect();
        } else {
            const err = await res.json();
            alert(err.error);
        }
    } catch(err) { console.error(err); }
});

// --- KARDEX ---
async function loadKardex() {
    const res = await fetchAPI('/api/kardex/logs');
    const logs = await res.json();
    const tbody = document.getElementById('kardexBody');
    tbody.innerHTML = '';

    logs.forEach(log => {
        const isPositive = log.quantity_changed > 0;
        const color = isPositive ? '#2ecc71' : 'var(--danger-color)';
        const date = new Date(log.operation_date).toLocaleString();

        tbody.innerHTML += `
            <tr>
                <td>${date}</td>
                <td>[${log.code}] ${log.product_name}</td>
                <td><strong>${log.operation_type}</strong></td>
                <td style="color:${color}; font-weight:bold;">${isPositive ? '+' : ''}${log.quantity_changed}</td>
                <td>${log.new_stock}</td>
                <td>${log.description}</td>
            </tr>
        `;
    });
}

// --- LÓGICA DEL DASHBOARD Y APEXCHARTS ---
async function loadDashboard() {
    try {
        const res = await fetchAPI('/api/dashboard/metrics');
        const data = await res.json();

        document.getElementById('kpi-capital').textContent = `$${parseFloat(data.kpis.capital_invertido).toFixed(2)}`;
        document.getElementById('kpi-proyectado').textContent = `$${parseFloat(data.kpis.valor_proyectado).toFixed(2)}`;
        document.getElementById('kpi-alertas').textContent = data.kpis.alertas_stock;

        Object.keys(chartsInstances).forEach(key => {
            if(chartsInstances[key]) chartsInstances[key].destroy();
        });

        const topVolNames = data.topVolume.map(item => item.name);
        const topVolData = data.topVolume.map(item => item.stock);
        
        chartsInstances.topVolume = new ApexCharts(document.querySelector("#topVolumeChart"), {
            chart: { type: 'bar', height: 250, toolbar: { show: false }, background: 'transparent' },
            series: [{ name: 'Unidades', data: topVolData }],
            xaxis: { categories: topVolNames },
            colors: ['#2c3e50']
        });
        chartsInstances.topVolume.render();

        const candleData = data.topVolume.map((item, index) => {
            const base = parseFloat(data.kpis.capital_invertido) / 1000 + index * 10; 
            return { x: item.name, y: [base, base + 25, base - 10, base + 15] };
        });

        chartsInstances.candle = new ApexCharts(document.querySelector("#candleChart"), {
            chart: { type: 'candlestick', height: 250, background: 'transparent', toolbar: { show: false } },
            series: [{ data: candleData }],
            plotOptions: { candlestick: { colors: { upward: '#2ecc71', downward: '#e74c3c' } } }
        });
        chartsInstances.candle.render();

        const healthVals = [
            parseInt(data.health.optimo || 0), 
            parseInt(data.health.bajo || 0), 
            parseInt(data.health.agotado || 0)
        ];
        
        chartsInstances.health = new ApexCharts(document.querySelector("#healthChart"), {
            chart: { type: 'donut', height: 280, background: 'transparent' },
            series: healthVals,
            labels: ['Óptimo (>5)', 'Bajo (1-5)', 'Agotado (0)'],
            colors: ['#2ecc71', '#f39c12', '#e74c3c'],
            dataLabels: { enabled: false }
        });
        chartsInstances.health.render();

        const capNames = data.capital.map(c => c.name);
        const capData = data.capital.map(c => parseFloat(c.total_value));

        chartsInstances.capital = new ApexCharts(document.querySelector("#capitalChart"), {
            chart: { type: 'pie', height: 280, background: 'transparent' },
            series: capData.length > 0 ? capData : [1], 
            labels: capNames.length > 0 ? capNames : ['Sin datos'],
            dataLabels: { enabled: false }
        });
        chartsInstances.capital.render();

        const flowDates = data.flow.map(f => f.date);
        const flowIn = data.flow.map(f => f.entradas);
        const flowOut = data.flow.map(f => f.salidas);

        chartsInstances.flow = new ApexCharts(document.querySelector("#flowChart"), {
            chart: { type: 'area', height: 280, background: 'transparent', toolbar: { show: false } },
            series: [
                { name: 'Entradas (Restock)', data: flowIn },
                { name: 'Salidas (Traslados)', data: flowOut }
            ],
            xaxis: { categories: flowDates },
            colors: ['#2ecc71', '#e74c3c'],
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 2 }
        });
        chartsInstances.flow.render();

    } catch (error) {
        console.error('Error cargando el dashboard:', error);
    }
}