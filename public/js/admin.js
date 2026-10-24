// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // Validar rol visualmente (Seguridad adicional en frontend)
    if (localStorage.getItem('nexo_role') !== 'superadmin') {
        window.location.href = '/index.html';
    }
    loadClients();
});

async function loadClients() {
    try {
        const res = await fetchAPI('/api/admin/clients');
        const clients = await res.json();
        renderClientsTable(clients);
    } catch (error) {
        console.error('Error cargando clientes:', error);
    }
}

function renderClientsTable(clients) {
    const tbody = document.getElementById('clientsBody');
    tbody.innerHTML = '';

    const today = new Date();

    clients.forEach(client => {
        const paymentDate = new Date(client.next_payment_date);
        const isOverdue = paymentDate < today && client.status !== 'congelado';
        
        let statusClass = `status-${client.status}`;
        let statusText = client.status.toUpperCase();

        if (isOverdue) {
            statusClass = 'status-vencido';
            statusText = 'VENCIDO';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${client.id}</td>
            <td><strong>${client.name}</strong></td>
            <td>@${client.username}</td>
            <td class="${statusClass}">${statusText}</td>
            <td class="${isOverdue ? 'status-vencido' : ''}">${paymentDate.toLocaleDateString()}</td>
            <td>
                <button class="btn-action" onclick="toggleStatus(${client.id}, '${client.status}')">
                    ${client.status === 'activo' ? 'Congelar' : 'Activar'}
                </button>
                <button class="btn-action" onclick="renewPayment(${client.id})">Agendar Pago</button>
                <button class="btn-action btn-delete" onclick="deleteClient(${client.id})">Borrar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'activo' ? 'congelado' : 'activo';
    if(confirm(`¿Seguro que deseas ${newStatus} a este cliente?`)) {
        await fetchAPI('/api/admin/clients', {
            method: 'PUT',
            body: JSON.stringify({ id, status: newStatus })
        });
        loadClients();
    }
}

async function deleteClient(id) {
    if(confirm('ALERTA: Vas a borrar toda la tienda y su inventario. ¿Estás seguro?')) {
        await fetchAPI('/api/admin/clients', {
            method: 'DELETE',
            body: JSON.stringify({ id })
        });
        loadClients();
    }
}

async function renewPayment(id) {
    const newDate = prompt("Ingresa la nueva fecha de pago (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (newDate) {
        await fetchAPI('/api/admin/clients', {
            method: 'PUT',
            body: JSON.stringify({ id, nextPaymentDate: newDate, status: 'activo' })
        });
        loadClients();
    }
}

// Simulador rápido para crear cliente (En producción haríamos un modal bonito)
async function showNewClientForm() {
    const storeName = prompt("Nombre de la Tienda:");
    const username = prompt("Usuario para el cliente:");
    const password = prompt("Contraseña temporal:");
    const nextPaymentDate = prompt("Próximo pago (YYYY-MM-DD):");

    if(storeName && username && password && nextPaymentDate) {
        await fetchAPI('/api/admin/clients', {
            method: 'POST',
            body: JSON.stringify({ storeName, username, password, nextPaymentDate })
        });
        loadClients();
    }
}