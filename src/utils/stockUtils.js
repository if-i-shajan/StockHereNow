/** Normalize Firestore number fields that may be stored as strings */

export function getStockQty(product) {
    const n = parseInt(product?.stockQuantity, 10);
    return Number.isFinite(n) ? n : 0;
}

export function getLowStockAlert(product) {
    const n = parseInt(product?.lowStockAlert, 10);
    return Number.isFinite(n) ? n : 0;
}

export function isLowStockProduct(product) {
    return getStockQty(product) <= getLowStockAlert(product);
}
