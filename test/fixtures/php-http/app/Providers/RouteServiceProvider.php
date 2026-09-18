<?php
namespace App\Providers;

use Illuminate\Support\Facades\Route;

final class RouteServiceProvider
{
    public function boot(): void
    {
        Route::pattern('talk', '[0-9]+');
        Route::prefix('partners/' . config('partners.prefix'))->group(base_path('routes/partners.php'));
    }
}
