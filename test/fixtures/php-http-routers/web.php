<?php
use Illuminate\Support\Facades\Route;

Route::get('/talks', function () {
    return 'talks';
});

$this->app['router']->group(['prefix' => 'packages'], function () {
    Route::get('/talks', function () {
        return 'package talks';
    });
});

Route::prefix('loop')->group(base_path('loop.php'));
