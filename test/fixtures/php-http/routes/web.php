<?php
use App\Http\TalkController;
use Illuminate\Support\Facades\Route;

require __DIR__ . '/auth.php';

Route::prefix('api')->middleware('auth')->group(function () {
    Route::get('/talks', [TalkController::class, 'index']);
    Route::post('/talks/{id}/comments', [TalkController::class, 'comment']);
    Route::match(['get', 'head'], '/talks/{id}', [TalkController::class, 'show'])->whereNumber('id');
    Route::get('/health', function () {
        return 'ok';
    });
    Route::get('/archive/' . talks_route(), [TalkController::class, 'index']);
    Route::get('/archive/latest', [TalkController::class, 'index']);
});

Route::group(['prefix' => 'internal'], function () {
    Route::delete('/talks/{id}', [TalkController::class, 'destroy']);
});

Route::prefix('beta/' . config('api.prefix'))->group(function () {
    Route::get('/talks', [TalkController::class, 'index']);
});

Route::get('/legacy/talks', ['as' => 'legacy.talks', 'uses' => 'TalkController@index']);

Route::redirect('/old/talks', '/api/talks');

Route::get('/latest', 'show');

Route::controller(TalkController::class)->group(function () {
    Route::get('/featured', 'show');
});

Route::prefix('tenant')->domain('admin.example.com')->group(function () {
    Route::get('/dashboard', [TalkController::class, 'index']);
});

Route::group(['prefix' => 'panel', 'domain' => 'admin.example.com'], function () {
    Route::get('/dashboard', [TalkController::class, 'index']);
});

Route::prefix('hosted')->group(function () {
    Route::get('/console', [TalkController::class, 'index'])->domain('admin.example.com');
});

Route::prefix('admin')->group(base_path('routes/admin.php'));

Route::prefix('v2')->get('/talks', [TalkController::class, 'index']);

Route::get('/docs/{path}', function () {
    return 'docs';
})->where('path', '.*');

Route::get('/reports/{name}', function () {
    return 'report';
});

Route::get('/reports/daily', function () {
    return 'daily';
});

Cache::get('/api/cached', function () {
    return [];
});
