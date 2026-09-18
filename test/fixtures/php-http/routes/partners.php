<?php
use App\Http\TalkController;
use Illuminate\Support\Facades\Route;

Route::get('/deals', [TalkController::class, 'index']);
