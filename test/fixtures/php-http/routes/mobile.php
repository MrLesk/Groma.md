<?php
use App\Http\TalkController;
use Illuminate\Support\Facades\Route;

Route::get('/sessions', [TalkController::class, 'index']);
Route::get('/sessions/{talk}', [TalkController::class, 'show']);

Route::prefix('v1')->group(function () {
    require __DIR__ . '/mobile-v1.php';
});
