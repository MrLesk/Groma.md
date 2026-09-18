<?php
use App\Http\TalkController;
use Illuminate\Support\Facades\Route;

Route::prefix('api')->middleware('auth')->group(function () {
    Route::get('/talks', [TalkController::class, 'index']);
    Route::post('/talks/{id}/comments', [TalkController::class, 'comment']);
    Route::match(['get', 'head'], '/talks/{id}', [TalkController::class, 'show']);
    Route::get('/health', function () {
        return 'ok';
    });
    Route::get(talks_route(), [TalkController::class, 'index']);
});

Route::group(['prefix' => 'internal'], function () {
    Route::delete('/talks/{id}', [TalkController::class, 'destroy']);
});

Route::prefix(config('api.prefix'))->group(function () {
    Route::get('/talks', [TalkController::class, 'index']);
});

Route::get('/legacy/talks', ['as' => 'legacy.talks', 'uses' => 'TalkController@index']);
