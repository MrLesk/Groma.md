<?php
use Illuminate\Support\Facades\Route;

Route::pattern($name, '[0-9]+');

Route::get('/talks/{id}', function () {
    return 'talk';
});

Route::get('/files/{path}', function () {
    return 'file';
})->where('path', '.*');
