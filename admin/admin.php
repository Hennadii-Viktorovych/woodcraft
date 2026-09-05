<?php
/**
 * admin/admin.php — бекенд адмінки WoodCraft UA
 * Файли зберігання:
 *   ../json/products.json   — каталог товарів
 *   ../json/orders.json     — замовлення
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ── НАЛАШТУВАННЯ ─────────────────────────────────────
define('ADMIN_PASSWORD', 'woodcraft2024');        // ← ЗМІНИТИ!
define('PRODUCTS_FILE',  __DIR__ . '/../json/products.json');
define('ORDERS_FILE',    __DIR__ . '/../json/orders.json');
define('IMAGES_DIR',     __DIR__ . '/../images/products/'); // папка для завантажених фото
define('IMAGES_URL',     './images/products/');             // публічний шлях

// ── ХЕЛПЕРИ ──────────────────────────────────────────
function resp($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}
function err($msg, $code = 400) { resp(['ok' => false, 'error' => $msg], $code); }

function read_json($file, $default = []) {
    if (!file_exists($file)) return $default;
    $d = json_decode(file_get_contents($file), true);
    return is_array($d) ? $d : $default;
}
function write_json($file, $data) {
    // Переконуємось що папка існує
    $dir = dirname($file);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function make_token() {
    return hash('sha256', ADMIN_PASSWORD . date('Ymd') . ($_SERVER['HTTP_HOST'] ?? 'local'));
}
function check_token($t) { return hash_equals(make_token(), (string)$t); }

// ── ВХІДНІ ДАНІ ──────────────────────────────────────
// Для file upload використовується multipart/form-data ($_POST), інакше JSON
$is_upload = isset($_FILES['image']);
if ($is_upload) {
    $body = $_POST;
} else {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
}
$action = $_GET['action'] ?? $body['action'] ?? '';
$token  = $_SERVER['HTTP_X_TOKEN'] ?? $body['token'] ?? $_GET['token'] ?? '';

// ── РОУТЕР ───────────────────────────────────────────
switch ($action) {

    // ════ LOGIN ══════════════════════════════════════
    case 'login':
        if (($body['password'] ?? '') !== ADMIN_PASSWORD) err('Невірний пароль', 401);
        resp(['ok' => true, 'token' => make_token()]);

    // ════ GET PRODUCTS (публічно — для лендінгу) ════
    case 'get_products':
        $products = read_json(PRODUCTS_FILE, []);
        resp(['ok' => true, 'products' => array_values($products)]);

    // ════ SAVE PRODUCT (додати / редагувати) ════════
    case 'save_product':
        if (!check_token($token)) err('Не авторизовано', 401);

        $products = read_json(PRODUCTS_FILE, []);
        $id = $body['id'] ?? null;

        // Нові або існуючі поля
        $item = $id ? ($products[$id] ?? []) : [];
        $item['id']          = $id ?: uniqid('prod_');
        $item['name']        = strip_tags(trim($body['name']        ?? ''));
        $item['description'] = strip_tags(trim($body['description'] ?? ''));
        $item['price']       = (float)($body['price'] ?? 0);
        $item['category']    = strip_tags(trim($body['category']    ?? ''));
        $item['image']       = strip_tags(trim($body['image']       ?? ''));
        $item['in_stock']    = isset($body['in_stock']) ? (bool)$body['in_stock'] : true;
        $item['updated_at']  = date('Y-m-d H:i:s');
        if (!$id) $item['created_at'] = date('Y-m-d H:i:s');

        if (!$item['name']) err('Назва товару обов\'язкова');

        $products[$item['id']] = $item;
        write_json(PRODUCTS_FILE, $products);
        resp(['ok' => true, 'product' => $item]);

    // ════ DELETE PRODUCT ═════════════════════════════
    case 'delete_product':
        if (!check_token($token)) err('Не авторизовано', 401);
        $id = $body['id'] ?? '';
        $products = read_json(PRODUCTS_FILE, []);
        if (!isset($products[$id])) err('Товар не знайдено', 404);
        unset($products[$id]);
        write_json(PRODUCTS_FILE, $products);
        resp(['ok' => true]);

    // ════ TOGGLE STOCK ═══════════════════════════════
    case 'toggle_stock':
        if (!check_token($token)) err('Не авторизовано', 401);
        $id = $body['id'] ?? '';
        $products = read_json(PRODUCTS_FILE, []);
        if (!isset($products[$id])) err('Товар не знайдено', 404);
        $products[$id]['in_stock'] = !$products[$id]['in_stock'];
        write_json(PRODUCTS_FILE, $products);
        resp(['ok' => true, 'in_stock' => $products[$id]['in_stock']]);

    // ════ GET ORDERS ═════════════════════════════════
    case 'get_orders':
        if (!check_token($token)) err('Не авторизовано', 401);
        $orders = read_json(ORDERS_FILE, []);
        usort($orders, fn($a, $b) => strcmp($b['date'] ?? '', $a['date'] ?? ''));
        resp(['ok' => true, 'orders' => $orders, 'total' => count($orders)]);

    // ════ UPDATE ORDER STATUS ════════════════════════
    case 'update_order':
        if (!check_token($token)) err('Не авторизовано', 401);
        $id     = $body['id']     ?? '';
        $status = $body['status'] ?? '';
        $allowed_statuses = ['new', 'processing', 'shipped', 'done', 'cancelled'];
        if (!in_array($status, $allowed_statuses)) err('Невірний статус');

        $orders = read_json(ORDERS_FILE, []);
        foreach ($orders as &$o) {
            if ($o['id'] === $id) { $o['status'] = $status; break; }
        }
        write_json(ORDERS_FILE, $orders);
        resp(['ok' => true]);

    // ════ DELETE ORDER ═══════════════════════════════
    case 'delete_order':
        if (!check_token($token)) err('Не авторизовано', 401);
        $id = $body['id'] ?? '';
        $orders = read_json(ORDERS_FILE, []);
        $orders = array_values(array_filter($orders, fn($o) => $o['id'] !== $id));
        write_json(ORDERS_FILE, $orders);
        resp(['ok' => true]);

    // ════ SUBMIT ORDER (публічно — з лендінгу) ══════
    case 'submit_order':
        $name    = strip_tags(trim($body['name']    ?? ''));
        $phone   = strip_tags(trim($body['phone']   ?? ''));
        $subject = strip_tags(trim($body['subject'] ?? ''));
        $message = strip_tags(trim($body['message'] ?? ''));
        $items   = $body['cart'] ?? [];

        if (!$name || !$phone) err('Вкажіть ім\'я та телефон');

        // Валідація товарів
        $clean_items = [];
        if (is_array($items)) {
            foreach ($items as $item) {
                $clean_items[] = [
                    'id'    => strip_tags($item['id']    ?? ''),
                    'name'  => strip_tags($item['name']  ?? ''),
                    'price' => (float)($item['price']    ?? 0),
                    'qty'   => (int)($item['qty']        ?? 1),
                ];
            }
        }

        $total = array_reduce($clean_items, fn($s, $i) => $s + $i['price'] * $i['qty'], 0);

        $orders = read_json(ORDERS_FILE, []);
        $orders[] = [
            'id'      => uniqid('ord_'),
            'name'    => $name,
            'phone'   => $phone,
            'subject' => $subject,
            'message' => $message,
            'cart'    => $clean_items,
            'total'   => $total,
            'status'  => 'new',
            'date'    => date('Y-m-d H:i:s'),
        ];
        write_json(ORDERS_FILE, $orders);
        resp(['ok' => true, 'message' => 'Дякуємо! Ми зв\'яжемось із вами.']);

    // ════ UPLOAD IMAGE ═══════════════════════════════
    case 'upload_image':
        if (!check_token($token)) err('Не авторизовано', 401);

        if (!isset($_FILES['image'])) err('Файл не знайдено');

        $file    = $_FILES['image'];
        $allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $ext_map = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

        // Перевірка типу через finfo (безпечніше ніж $_FILES['type'])
        $finfo    = finfo_open(FILEINFO_MIME_TYPE);
        $mime     = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, $allowed)) err('Дозволені лише JPG, PNG, WEBP, GIF');
        if ($file['size'] > 5 * 1024 * 1024) err('Файл більше 5 МБ');
        if ($file['error'] !== UPLOAD_ERR_OK) err('Помилка завантаження файлу');

        // Створюємо папку якщо немає
        if (!is_dir(IMAGES_DIR)) mkdir(IMAGES_DIR, 0755, true);

        $filename  = uniqid('img_') . '.' . $ext_map[$mime];
        $dest      = IMAGES_DIR . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) err('Не вдалося зберегти файл');

        resp(['ok' => true, 'path' => IMAGES_URL . $filename, 'filename' => $filename]);

    // ════ DELETE IMAGE ════════════════════════════════
    case 'delete_image':
        if (!check_token($token)) err('Не авторизовано', 401);

        $filename = basename($body['filename'] ?? ''); // basename — захист від path traversal
        if (!$filename) err('Не вказано файл');

        $path = IMAGES_DIR . $filename;
        if (file_exists($path)) unlink($path);

        resp(['ok' => true]);

    default:
        err('Невідома дія', 404);
}