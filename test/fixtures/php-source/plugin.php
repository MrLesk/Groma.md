<?php
namespace Example;

file_put_contents(__DIR__ . '/executed', 'must not run');

function normalize(string $value): string {
    return trim($value);
}

class ProposalService {
    public function send(string $value): string {
        return normalize($value);
    }
}
