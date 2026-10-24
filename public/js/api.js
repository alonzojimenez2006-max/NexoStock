// public/js/api.js
// Función global para hacer peticiones seguras
async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('nexo_token');
    
    if (!token) {
        window.location.href = '/index.html'; // Si no hay token, al login
        throw new Error('No estás autenticado');
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    const response = await fetch(endpoint, { ...options, headers });
    
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = '/index.html';
    }

    return response;
}

function logout() {
    localStorage.clear();
    window.location.href = '/index.html';
}