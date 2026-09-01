const express = require('express');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const { createClient } = require('@libsql/client');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

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

// 1. Налаштування Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? process.env.CLOUDINARY_CLOUD_NAME.trim() : '',
    api_key: process.env.CLOUDINARY_API_KEY ? process.env.CLOUDINARY_API_KEY.trim() : '',
    api_secret: process.env.CLOUDINARY_API_SECRET ? process.env.CLOUDINARY_API_SECRET.trim() : ''
});

// Використовуємо memoryStorage (найкраще для Vercel)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // Макс 5МБ
});

// 2. Підключення до Turso
let db = null;
if (process.env.TURSO_DATABASE_URL) {
    try {
        let dbUrl = process.env.TURSO_DATABASE_URL.trim();
        if (dbUrl.startsWith('https://')) {
            dbUrl = dbUrl.replace('https://', 'libsql://');
        }

        db = createClient({
            url: dbUrl,
            authToken: process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.trim() : undefined
        });

        db.execute(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            price TEXT NOT NULL,
            image TEXT NOT NULL,
            is_popular INTEGER DEFAULT 0
        )`).catch(e => console.error('Turso table init error:', e.message));

        db.execute(`CREATE TABLE IF NOT EXISTS requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            subject TEXT,
            message TEXT,
            date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`).catch(e => console.error('Turso table init error:', e.message));
    } catch (e) {
        console.error('Turso Client Init Error:', e.message);
    }
}

function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.redirect('/admin/login');
}

const fallbackProducts = [
    { id: 1, title: 'Обробна дошка Дуб', description: 'Ручна робота з дуба', price: '850', image: '/images/default.jpg', is_popular: 1 }
];

// Допоміжна функція завантаження в Cloudinary з буфера
const uploadToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: 'woodcraft_products' },
            (error, result) => {
                if (result) resolve(result.secure_url);
                else reject(error);
            }
        );
        stream.end(fileBuffer);
    });
};

/* РОУТИ */

app.get('/', async (req, res) => {
    if (!db) return res.render('index', { products: fallbackProducts, popularProducts: fallbackProducts });
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
    if (db) {
        try {
            await db.execute({
                sql: `INSERT INTO requests (name, phone, subject, message) VALUES (?, ?, ?, ?)`,
                args: [name, phone, subject, message]
            });
        } catch (err) {
            console.error(err);
        }
    }
    res.redirect('/?success=true');
});

app.get('/admin/login', (req, res) => res.render('login', { error: null }));

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
    if (!db) return res.render('admin', { products: fallbackProducts, requests: [] });
    try {
        const productsRes = await db.execute('SELECT * FROM products ORDER BY id DESC');
        const requestsRes = await db.execute('SELECT * FROM requests ORDER BY id DESC');
        res.render('admin', { products: productsRes.rows || [], requests: requestsRes.rows || [] });
    } catch (err) {
        console.error(err);
        res.render('admin', { products: [], requests: [] });
    }
});

// Додавання товару з бекапом зображення
app.post('/admin/products/add', checkAuth, upload.single('image'), async (req, res) => {
    const { title, description, price, is_popular } = req.body;
    let imageUrl = '/images/default.jpg';

    if (req.file && process.env.CLOUDINARY_CLOUD_NAME) {
        try {
            imageUrl = await uploadToCloudinary(req.file.buffer);
        } catch (err) {
            console.error('Cloudinary upload error:', err);
        }
    }

    const popularValue = is_popular ? 1 : 0;

    if (db) {
        try {
            await db.execute({
                sql: `INSERT INTO products (title, description, price, image, is_popular) VALUES (?, ?, ?, ?, ?)`,
                args: [title, description, price, imageUrl, popularValue]
            });
        } catch (err) {
            console.error('Turso insert error:', err);
        }
    }

    res.redirect('/admin');
});

app.post('/admin/products/toggle-popular/:id', checkAuth, async (req, res) => {
    if (db) {
        try {
            await db.execute({
                sql: `UPDATE products SET is_popular = CASE WHEN is_popular = 1 THEN 0 ELSE 1 END WHERE id = ?`,
                args: [req.params.id]
            });
        } catch (err) {
            console.error(err);
        }
    }
    res.redirect('/admin');
});

app.post('/admin/products/delete/:id', checkAuth, async (req, res) => {
    if (db) {
        try {
            await db.execute({
                sql: `DELETE FROM products WHERE id = ?`,
                args: [req.params.id]
            });
        } catch (err) {
            console.error(err);
        }
    }
    res.redirect('/admin');
});

app.post('/admin/requests/delete/:id', checkAuth, async (req, res) => {
    if (db) {
        try {
            await db.execute({
                sql: `DELETE FROM requests WHERE id = ?`,
                args: [req.params.id]
            });
        } catch (err) {
            console.error(err);
        }
    }
    res.redirect('/admin');
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;