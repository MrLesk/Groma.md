<?php
use Illuminate\Support\Facades\Route;

Route::pattern($name, '[0-9]+');

Route::get('/talks/{id}', function () {
    return 'talk';
});

Route::get('/files/{path}', function () {
    return 'file';
})->where('path', '.*');

Route::pattern('slug', '[a-z]+');

Route::get('/posts/{slug}', function () {
    return 'post';
});

Route::get('/downloads/{file}', function () {
    return 'download';
})->where($which, '.*');
