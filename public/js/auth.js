// public/js/auth.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-message');
    const submitBtn = document.querySelector('.neumorphic-btn');

    submitBtn.textContent = 'Verificando...';
    errorMsg.textContent = '';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error de conexión');
        }

        // Guardar token y rol en el almacenamiento local del navegador
        localStorage.setItem('nexo_token', data.token);
        localStorage.setItem('nexo_role', data.role);

        // Enrutamiento dinámico (Aún no creamos estos HTML, es normal que den error 404 al probar)
        if (data.role === 'superadmin') {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/app.html';
        }

    } catch (error) {
        errorMsg.textContent = error.message;
        submitBtn.textContent = 'Ingresar';
    }
});