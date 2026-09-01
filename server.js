const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. БЕЗПЕЧНЕ ПІДКТЮЧЕННЯ БД (sqlite3)
let db = null;
let sqlite3 = null;

try {
    // Використовуємо eval("require") щоб Vercel не падав при деплої бінарників
    sqlite3 = eval("require('sqlite3')").verbose();
    db = new sqlite3.Database('./database.db', (err) => {
        if (err) console.error('Помилка БД:', err.message);
        else console.log('Підключено до БД SQLite.');
    });

    // Створення таблиць (якщо БД доступна)
    if (db) {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                price TEXT NOT NULL,
                image TEXT NOT NULL,
                is_popular INTEGER DEFAULT 0
            )`);

            db.run(`ALTER TABLE products ADD COLUMN is_popular INTEGER DEFAULT 0`, () => {});

            db.run(`CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                subject TEXT,
                message TEXT,
                date DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    }
} catch (e) {
    console.log('SQLite не підтримується на Vercel, включено режим фолбеку.');
}

// 2. БЕЗПЕЧНЕ СТВОРЕННЯ ПАПКИ UPLOADS
const uploadsDir = path.join(__dirname, 'public', 'uploads');
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (e) {
    console.log('Не вдалося створити папку uploads (read-only середовище)');
}

// 3. НАЛАШТУВАННЯ MULTER
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 4. MIDDLEWARE
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'woodcraft_secret_key_123',
    resave: false,
    saveUninitialized: false
}));

function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.redirect('/admin/login');
}

// Демо-дані для Vercel (якщо база не відкрилася)
const fallbackProducts = [
    { id: 1, title: 'Обробна дошка Дуб', description: 'Ручна робота з дуба', price: '850', image: '/images/default.jpg', is_popular: 1 },
    { id: 2, title: 'Тарілка з Ясеня', description: 'Екологічне покриття', price: '600', image: '/images/default.jpg', is_popular: 0 }
];

/* =========================================================
   РОУТИ ГОЛОВНОГО САЙТУ
========================================================= */

app.get('/', (req, res) => {
    if (!db) {
        return res.render('index', {
            products: fallbackProducts,
            popularProducts: fallbackProducts.filter(p => p.is_popular === 1)
        });
    }

    db.all('SELECT * FROM products ORDER BY id DESC', [], (err, allProducts) => {
        db.all('SELECT * FROM products WHERE is_popular = 1 ORDER BY id DESC', [], (err2, popularProducts) => {
            res.render('index', {
                products: allProducts || [],
                popularProducts: popularProducts || []
            });
        });
    });
});

app.post('/api/request', (req, res) => {
    const { name, phone, subject, message } = req.body;
    if (!db) return res.redirect('/?success=true');

    db.run(
        `INSERT INTO requests (name, phone, subject, message) VALUES (?, ?, ?, ?)`,
        [name, phone, subject, message],
        function (err) {
            if (err) console.error(err);
            res.redirect('/?success=true');
        }
    );
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

app.get('/admin', checkAuth, (req, res) => {
    if (!db) {
        return res.render('admin', { products: fallbackProducts, requests: [] });
    }

    db.all('SELECT * FROM products ORDER BY id DESC', [], (err, products) => {
        db.all('SELECT * FROM requests ORDER BY id DESC', [], (err2, requests) => {
            res.render('admin', {
                products: products || [],
                requests: requests || []
            });
        });
    });
});

// Додавання товару
app.post('/admin/products/add', checkAuth, upload.single('image'), (req, res) => {
    if (!db) return res.redirect('/admin');
    const { title, description, price, is_popular } = req.body;
    const imagePath = req.file ? '/uploads/' + req.file.filename : '/images/default.jpg';
    const popularValue = is_popular ? 1 : 0;

    db.run(
        `INSERT INTO products (title, description, price, image, is_popular) VALUES (?, ?, ?, ?, ?)`,
        [title, description, price, imagePath, popularValue],
        function (err) {
            if (err) console.error(err);
            res.redirect('/admin');
        }
    );
});

// Перемикання статусу Популярний / Звичайний
app.post('/admin/products/toggle-popular/:id', checkAuth, (req, res) => {
    if (!db) return res.redirect('/admin');
    const productId = req.params.id;
    db.run(
        `UPDATE products SET is_popular = CASE WHEN is_popular = 1 THEN 0 ELSE 1 END WHERE id = ?`,
        [productId],
        (err) => {
            if (err) console.error(err);
            res.redirect('/admin');
        }
    );
});

// Видалення товару
app.post('/admin/products/delete/:id', checkAuth, (req, res) => {
    if (!db) return res.redirect('/admin');
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

// Видалення заявки
app.post('/admin/requests/delete/:id', checkAuth, (req, res) => {
    if (!db) return res.redirect('/admin');
    db.run(`DELETE FROM requests WHERE id = ?`, [req.params.id], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

// Локальний запуск
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Сервер запущено: http://localhost:${PORT}`);
    });
}

// Експорт для Vercel Serverless
module.exports = app;