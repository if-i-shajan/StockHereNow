export function safeInt(value, fallback = 0) {
    const n = parseInt(String(value ?? "").trim(), 10);
    return Number.isFinite(n) ? n : fallback;
}

export function safeFloat(value, fallback = 0) {
    const n = parseFloat(String(value ?? "").trim());
    return Number.isFinite(n) ? n : fallback;
}
