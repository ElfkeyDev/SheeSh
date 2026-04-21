<?php
header('Content-Type: application/json');

// ================= VALIDATION =================
if (!isset($_FILES['file'])) {
    echo json_encode(["error" => "No file uploaded"]);
    exit;
}

$file = $_FILES['file'];

if ($file['error'] !== 0) {
    echo json_encode(["error" => "Upload error"]);
    exit;
}

// ================= FILE SIZE LIMIT =================
if ($file['size'] > 2 * 1024 * 1024) {
    echo json_encode(["error" => "File too large (max 2MB)"]);
    exit;
}

// ================= TYPE CHECK =================
$allowedTypes = ['text/plain', 'text/csv', 'application/vnd.ms-excel'];
$fileType = mime_content_type($file['tmp_name']);

if (!in_array($fileType, $allowedTypes)) {
    echo json_encode(["error" => "Invalid file type"]);
    exit;
}

// ================= READ FILE =================
$lines = file($file['tmp_name'], FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

$values = [];

foreach ($lines as $line) {
    $parts = str_getcsv($line);

    foreach ($parts as $p) {
        $p = trim($p);

        if ($p !== "" && is_numeric($p)) {
            $values[] = floatval($p);
        }
    }
}

// ================= FINAL CHECK =================
if (empty($values)) {
    echo json_encode(["error" => "No valid numeric data found"]);
    exit;
}

// ================= SUCCESS =================
echo json_encode([
    "values" => $values,
    "count" => count($values)
]);
?>