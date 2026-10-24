// ==========================================
// public/js/admin.js - Panel SuperAdmin
// ==========================================

// 1. Función base para comunicarse con el servidor de forma segura
async function fetchAPI(url, options = {}) {
    const token = localStorage.getItem('nexostock_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };
    return fetch(url, { ...options, headers });
}

// 2. Verificar si eres SuperAdmin al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('nexostock_token');
    const role = localStorage.getItem('nexostock_role');

    // Si no hay token o no es admin, lo expulsa al inicio de sesión
    if (!token || role !== 'superadmin') {
        window.location.href = '/';
        return;
    }

    // Si todo está correcto, dibuja la tabla de clientes
    loadClients();
});

// 3. Dibujar la tabla de clientes leyendo la base de datos
async function loadClients() {
    try {
        const res = await fetchAPI('/api/admin/clients');
        
        if (!res.ok) {
            console.error("Error del servidor:", await res.text());
            return;
        }

        const clients = await res.json();
        console.log("Datos recibidos de Neon:", clients); // Para depurar con F12

        const tbody = document.querySelector('table tbody');
        if (!tbody) {
            console.error("No se encontró la etiqueta <tbody> en tu HTML.");
            return;
        }

        tbody.innerHTML = '';
        
        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay clientes registrados</td></tr>';
            return;
        }

        clients.forEach(c => {
            // Asegura que la fecha no rompa el código si viene vacía o rara
            const dateStr = c.next_payment_date ? String(c.next_payment_date).split('T')[0] : 'Sin fecha';

            tbody.innerHTML += `
                <tr>
                    <td>${c.id}</td>
                    <td>${c.name}</td>
                    <td>${c.username}</td>
                    <td><span class="badge" style="background: #e6f4ea; color: #1e8e3e; padding: 4px 8px; border-radius: 4px;">${c.status || 'activo'}</span></td>
                    <td>${dateStr}</td>
                    <td>
                        <button style="padding: 4px 8px; cursor: pointer; border: none; background: transparent; font-size: 16px;">✏️</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error fatal al dibujar la tabla:", error);
    }
}

// 4. Formulario interactivo para registrar nuevas tiendas (Tu versión)
async function showNewClientForm() {
    const storeName = prompt("Nombre de la Tienda:");
    const username = prompt("Usuario para el cliente:");
    const password = prompt("Contraseña temporal:");
    const nextPaymentDate = prompt("Próximo pago (Obligatorio usar formato YYYY-MM-DD, ej: 2026-11-24):");

    if (storeName && username && password && nextPaymentDate) {
        try {
            const res = await fetchAPI('/api/admin/clients', {
                method: 'POST',
                body: JSON.stringify({ storeName, username, password, nextPaymentDate })
            });
            
            if (res.ok) {
                alert("✅ Cliente registrado exitosamente.");
                loadClients(); // Recarga la tabla automáticamente para mostrar al nuevo cliente
            } else {
                const err = await res.json();
                alert("❌ Error al crear cliente: " + err.error);
            }
        } catch (error) {
            alert("❌ Ocurrió un problema de conexión con el servidor.");
        }
    } else {
        alert("⚠️ Operación cancelada. Debes rellenar todos los campos correctamente.");
    }
}

// 5. Cerrar sesión por seguridad
function logout() {
    localStorage.removeItem('nexostock_token');
    localStorage.removeItem('nexostock_role');
    window.location.href = '/'; 
}
