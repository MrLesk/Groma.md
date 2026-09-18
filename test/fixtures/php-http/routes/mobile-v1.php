<?php
use App\Http\TalkController;
use Illuminate\Support\Facades\Route;

Route::get('/speakers', [TalkController::class, 'index']);
