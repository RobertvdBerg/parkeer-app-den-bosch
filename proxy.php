<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$allowedPrefixes = [
  'https://npropendata.rdw.nl/',
  'https://opd.it-t.nl/',
  'http://opd.it-t.nl/'
];

$url = isset($_GET['url']) ? $_GET['url'] : '';
$ok = false;
foreach ($allowedPrefixes as $p) {
  if (strpos($url, $p) === 0) { $ok = true; break; }
}
if (!$ok) {
  http_response_code(400);
  echo json_encode(['error' => 'URL niet toegestaan']);
  exit;
}

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 20,
  CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_USERAGENT => 'parkeer-app-den-bosch/1.0'
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($body === false) {
  http_response_code(502);
  echo json_encode(['error' => 'fetch mislukt: ' . $err]);
  exit;
}

http_response_code(($code >= 200 && $code < 300) ? 200 : ($code ?: 502));
echo $body;
