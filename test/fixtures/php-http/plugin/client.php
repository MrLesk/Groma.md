<?php
define('SHOP_ORDERS', '/shop/v1/orders');

function shop_sync_orders(int $id): string
{
    $handle = curl_init();
    curl_setopt_array($handle, [
        CURLOPT_URL => SHOP_ORDERS . '/' . $id,
        CURLOPT_CUSTOMREQUEST => 'PATCH',
    ]);
    return curl_exec($handle);
}

function shop_fetch_orders(): array
{
    return wp_remote_get(rest_url('shop/v1/orders'));
}

function shop_create_order(array $order): array
{
    return wp_remote_post(rest_url('shop/v1/orders'), ['body' => $order]);
}

function shop_replace_order(int $id, array $order): array
{
    return wp_remote_request(rest_url('shop/v1/orders/' . $id), ['method' => 'PUT', 'body' => $order]);
}

function shop_delete_order(int $id): string
{
    $handle = curl_init();
    curl_setopt($handle, CURLOPT_URL, '/shop/v1/orders/' . $id);
    curl_setopt($handle, CURLOPT_CUSTOMREQUEST, 'DELETE');
    return curl_exec($handle);
}

function shop_report(string $url): array
{
    return wp_remote_get($url);
}

function shop_audit(): string
{
    $handle = curl_init('https://audit.example.com/log');
    return curl_exec($handle);
}
