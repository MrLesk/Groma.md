<?php
use App\Http\TalkController;
use Illuminate\Support\Facades\Route;

Route::get('/login', [TalkController::class, 'index']);
