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
                loadClients();
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
