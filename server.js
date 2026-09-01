const express = require('express');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const { createClient } = require('@libsql/client');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// Налаштування views для EJS
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'woodcraft_secret_key_123',
    resave: false,
    saveUninitialized: false
}));

// 1. Підключення до Turso (хмарний SQLite)
const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:database.db',
    authToken: process.env.TURSO_AUTH_TOKEN
});

// Ініціалізація таблиць у Turso
async function initDb() {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            price TEXT NOT NULL,
            image TEXT NOT NULL,
            is_popular INTEGER DEFAULT 0
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            subject TEXT,
            message TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    } catch (err) {
        console.error('Помилка ініціалізації БД:', err.message);
    }
}
initDb();

// 2. Налаштування Cloudinary (хмарні фото)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'woodcraft_products',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
    }
});
const upload = multer({ storage: storage });

function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.redirect('/admin/login');
}

/* =========================================================
   РОУТИ ГОЛОВНОГО САЙТУ
========================================================= */

app.get('/', async (req, res) => {
    try {
        const allProductsRes = await db.execute('SELECT * FROM products ORDER BY id DESC');
        const popularProductsRes = await db.execute('SELECT * FROM products WHERE is_popular = 1 ORDER BY id DESC');

        res.render('index', {
            products: allProductsRes.rows || [],
            popularProducts: popularProductsRes.rows || []
        });
    } catch (err) {
        console.error(err);
        res.render('index', { products: [], popularProducts: [] });
    }
});

app.post('/api/request', async (req, res) => {
    const { name, phone, subject, message } = req.body;
    try {
        await db.execute({
            sql: `INSERT INTO requests (name, phone, subject, message) VALUES (?, ?, ?, ?)`,
            args: [name, phone, subject, message]
        });
        res.redirect('/?success=true');
    } catch (err) {
        console.error(err);
        res.redirect('/?error=true');
    }
});

/* =========================================================
   РОУТИ АДМІН-ПАНЕЛІ
========================================================= */

app.get('/admin/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin123') {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'Невірний логін або пароль' });
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});

app.get('/admin', checkAuth, async (req, res) => {
    try {
        const productsRes = await db.execute('SELECT * FROM products ORDER BY id DESC');
        const requestsRes = await db.execute('SELECT * FROM requests ORDER BY id DESC');

        res.render('admin', {
            products: productsRes.rows || [],
            requests: requestsRes.rows || []
        });
    } catch (err) {
        console.error(err);
        res.render('admin', { products: [], requests: [] });
    }
});

// Додавання товару
app.post('/admin/products/add', checkAuth, upload.single('image'), async (req, res) => {
    const { title, description, price, is_popular } = req.body;
    const imagePath = req.file ? req.file.path : '/images/default.jpg';
    const popularValue = is_popular ? 1 : 0;

    try {
        await db.execute({
            sql: `INSERT INTO products (title, description, price, image, is_popular) VALUES (?, ?, ?, ?, ?)`,
            args: [title, description, price, imagePath, popularValue]
        });
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

// Перемикання статусу Популярний / Звичайний
app.post('/admin/products/toggle-popular/:id', checkAuth, async (req, res) => {
    try {
        await db.execute({
            sql: `UPDATE products SET is_popular = CASE WHEN is_popular = 1 THEN 0 ELSE 1 END WHERE id = ?`,
            args: [req.params.id]
        });
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

// Видалення товару
app.post('/admin/products/delete/:id', checkAuth, async (req, res) => {
    try {
        await db.execute({
            sql: `DELETE FROM products WHERE id = ?`,
            args: [req.params.id]
        });
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

// Видалення заявки
app.post('/admin/requests/delete/:id', checkAuth, async (req, res) => {
    try {
        await db.execute({
            sql: `DELETE FROM requests WHERE id = ?`,
            args: [req.params.id]
        });
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.redirect('/admin');
    }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;