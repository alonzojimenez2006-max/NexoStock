-- 1. Tabla de Tiendas / Clientes (Gestión SaaS)
CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'activo', -- activo, congelado
    next_payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Usuarios (SuperAdmin y Clientes)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE, -- NULL para el SuperAdmin
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'superadmin' o 'cliente'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Categorías (Aisladas por tienda)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL
);

-- 4. Tabla de Productos
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    entry_date DATE NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL,
    normal_price DECIMAL(10, 2) NOT NULL,
    cache_price DECIMAL(10, 2) NOT NULL,
    stock INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, code) -- Un código no se puede repetir dentro de una misma tienda
);

-- 5. Libro Mayor Logístico (Kardex)
CREATE TABLE kardex (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    operation_type VARCHAR(50) NOT NULL, -- INGRESO_INICIAL, RESTOCK, TRASLADO, AJUSTE
    quantity_changed INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- INSERCIÓN POR DEFECTO: Crear tu usuario SuperAdmin para poder arrancar
-- Nota: La contraseña encriptada abajo equivale a 'admin123' (usando bcrypt)
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2b$10$xyz...', 'superadmin'); 
-- (Generaremos el hash real de 'admin123' en la Fase 2)