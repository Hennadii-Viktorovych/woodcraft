const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Створюємо папку для завантаження фото
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Налаштування Multer
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

// База даних SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Помилка БД:', err.message);
    else console.log('Підключено до БД SQLite.');
});

// Створення таблиць (з полем is_popular)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        price TEXT NOT NULL,
        image TEXT NOT NULL,
        is_popular INTEGER DEFAULT 0
    )`);

    // Перевірка чи є колонка is_popular у старій таблиці
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

// Middleware
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

/* =========================================================
   РОУТИ ГОЛОВНОГО САЙТУ
========================================================= */

app.get('/', (req, res) => {
    // Отримуємо окремо всі товари та окремо популярні
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
    db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

// Видалення заявки
app.post('/admin/requests/delete/:id', checkAuth, (req, res) => {
    db.run(`DELETE FROM requests WHERE id = ?`, [req.params.id], (err) => {
        if (err) console.error(err);
        res.redirect('/admin');
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущено: http://localhost:${PORT}`);
});