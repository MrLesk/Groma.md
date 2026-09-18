<?php
use Illuminate\Support\Facades\Route;

Route::get('/ring', function () {
    return 'ring';
});

require __DIR__ . '/web.php';
