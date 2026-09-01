const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Явно вказуємо шлях до папки з views для Vercel
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

// Спроба підключення SQLite тільки якщо середовище не Vercel
let db = null;
if (!process.env.VERCEL) {
    try {
        const sqlite3 = require('sqlite3').verbose();
        db = new sqlite3.Database('./database.db');
    } catch (e) {
        console.log('SQLite local init error:', e.message);
    }
}

// Запасні дані для демо на Vercel
const fallbackProducts = [
    { id: 1, title: 'Обробна дошка Дуб', description: 'Ручна робота з дуба', price: '850', image: '/images/default.jpg', is_popular: 1 },
    { id: 2, title: 'Тарілка з Ясеня', description: 'Екологічне покриття', price: '600', image: '/images/default.jpg', is_popular: 0 }
];

// Безпечне налаштування Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, '/tmp'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.redirect('/admin/login');
}

/* РОУТИ */
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
    res.redirect('/?success=true');
});

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
            res.render('admin', { products: products || [], requests: requests || [] });
        });
    });
});

app.post('/admin/products/add', checkAuth, upload.single('image'), (req, res) => {
    res.redirect('/admin');
});

app.post('/admin/products/delete/:id', checkAuth, (req, res) => {
    res.redirect('/admin');
});

app.post('/admin/requests/delete/:id', checkAuth, (req, res) => {
    res.redirect('/admin');
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;