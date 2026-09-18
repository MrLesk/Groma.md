<?php
use App\Http\TalkController;
use Illuminate\Support\Facades\Route;

Route::delete('/talks/{id}', [TalkController::class, 'destroy']);
