<?php
// Дозволяємо запити лише методу POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Метод не дозволений');
}

// Отримуємо сирі JSON дані від JS
$json_data = file_get_contents('php://input');

// Перевіряємо, чи це валідний JSON (щоб не зламати файл)
if (json_decode($json_data) === null) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Невалідний JSON"]);
    exit;
}

// Записуємо дані у файл (знаходиться на рівень вище від папки admin, тому ../)
if (file_put_contents('../products.json', $json_data)) {
    echo json_encode(["status" => "success"]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Не вдалося записати файл"]);
}
?>
