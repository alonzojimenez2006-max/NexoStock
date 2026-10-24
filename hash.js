// hash.js
const bcrypt = require('bcrypt');
bcrypt.hash('admin123', 10).then(hash => {
    console.log("Tu hash es:", hash);
    console.log("Ejecuta este SQL en Neon:");
    console.log(`INSERT INTO users (username, password_hash, role) VALUES ('admin', '${hash}', 'superadmin');`);
});