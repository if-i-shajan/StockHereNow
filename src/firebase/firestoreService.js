import { db } from "./firebaseConfig";
import { isLowStockProduct } from "../utils/stockUtils.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    orderBy,
    where,
    serverTimestamp,
    increment,
    writeBatch,
} from "firebase/firestore";

const PRODUCTS_CACHE_KEY = "stockhere_products_cache";
let productsCache = null;
let cacheLoaded = false;

const canUseStorage = () => {
    try {
        return typeof window !== "undefined" && Boolean(window.sessionStorage);
    } catch {
        return false;
    }
};

const normalizeTimestamp = (value) => {
    if (!value) return value;
    if (typeof value === "number" || typeof value === "string") return value;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    if (typeof value.seconds === "number") return value.seconds * 1000;
    return value;
};

const normalizeProduct = (data = {}) => ({
    ...data,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
});

const normalizeProductPatch = (patch = {}) => {
    const next = { ...patch };
    if (Object.prototype.hasOwnProperty.call(next, "createdAt")) {
        next.createdAt = normalizeTimestamp(next.createdAt);
    }
    if (Object.prototype.hasOwnProperty.call(next, "updatedAt")) {
        next.updatedAt = normalizeTimestamp(next.updatedAt);
    }
    return next;
};

const sortProductsByName = (products) =>
    [...products].sort((a, b) =>
        String(a.productName ?? "").localeCompare(String(b.productName ?? ""), undefined, {
            sensitivity: "base",
        })
    );

const loadCache = () => {
    if (cacheLoaded || !canUseStorage()) return;
    cacheLoaded = true;
    try {
        const raw = window.sessionStorage.getItem(PRODUCTS_CACHE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            productsCache = parsed;
        }
    } catch {
        try {
            window.sessionStorage.removeItem(PRODUCTS_CACHE_KEY);
        } catch {
            // Ignore cache cleanup errors.
        }
    }
};

const persistCache = (products) => {
    productsCache = products;
    if (!canUseStorage()) return;
    try {
        window.sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
    } catch {
        // Ignore storage quota errors.
    }
};

const ensureCacheArray = () => {
    loadCache();
    return Array.isArray(productsCache);
};

const updateCachedProduct = (id, patch) => {
    if (!ensureCacheArray()) return;
    const index = productsCache.findIndex((product) => product.id === id);
    if (index === -1) return;
    const next = {
        ...productsCache[index],
        ...normalizeProductPatch(patch),
        id,
    };
    const nextCache = [...productsCache];
    nextCache[index] = next;
    persistCache(sortProductsByName(nextCache));
};

const upsertCachedProduct = (product) => {
    if (!ensureCacheArray()) return;
    const normalized = normalizeProduct(product);
    const index = productsCache.findIndex((item) => item.id === normalized.id);
    const nextCache = [...productsCache];

    if (index === -1) {
        nextCache.push(normalized);
    } else {
        nextCache[index] = { ...nextCache[index], ...normalized };
    }

    persistCache(sortProductsByName(nextCache));
};

const removeCachedProduct = (id) => {
    if (!ensureCacheArray()) return;
    const nextCache = productsCache.filter((product) => product.id !== id);
    persistCache(nextCache);
};

function mapDocs(querySnapshot) {
    const products = [];
    querySnapshot.forEach((d) => {
        products.push({ id: d.id, ...normalizeProduct(d.data()) });
    });
    return products;
}

/**
 * All products, sorted by name. Falls back to client-side sort if index/orderBy fails.
 */
export const getAllProducts = async () => {
    const col = collection(db, "products");
    try {
        const q = query(col, orderBy("productName"));
        const querySnapshot = await getDocs(q);
        const products = sortProductsByName(mapDocs(querySnapshot));
        persistCache(products);
        return products;
    } catch (error) {
        console.warn("[StockHere] orderBy(productName) failed; fetching unsorted.", error);
        const querySnapshot = await getDocs(col);
        const products = sortProductsByName(mapDocs(querySnapshot));
        persistCache(products);
        return products;
    }
};

export const getCachedProducts = () => {
    loadCache();
    if (!Array.isArray(productsCache)) return null;
    return [...productsCache];
};

export const getProductById = async (id) => {
    if (!id) return null;
    try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...normalizeProduct(docSnap.data()) };
        }
        return null;
    } catch (error) {
        console.error("Error getting product:", error);
        throw error;
    }
};

export const addProduct = async (data) => {
    try {
        const docRef = await addDoc(collection(db, "products"), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        upsertCachedProduct({
            id: docRef.id,
            ...data,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding product:", error);
        throw error;
    }
};

export const updateProduct = async (id, data) => {
    try {
        const docRef = doc(db, "products", id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        updateCachedProduct(id, { ...data, updatedAt: Date.now() });
    } catch (error) {
        console.error("Error updating product:", error);
        throw error;
    }
};

export const deleteProduct = async (id) => {
    try {
        await deleteDoc(doc(db, "products", id));
        removeCachedProduct(id);
    } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
    }
};

export const incrementStockQuantity = async (id, amount) => {
    try {
        const docRef = doc(db, "products", id);
        await updateDoc(docRef, {
            stockQuantity: increment(amount),
            updatedAt: serverTimestamp(),
        });
        if (ensureCacheArray()) {
            const cached = productsCache.find((product) => product.id === id);
            if (cached) {
                const currentQty = parseInt(cached.stockQuantity, 10) || 0;
                updateCachedProduct(id, {
                    stockQuantity: currentQty + amount,
                    updatedAt: Date.now(),
                });
            }
        }
    } catch (error) {
        console.error("Error incrementing stock:", error);
        throw error;
    }
};

const INVOICE_HEADER_DOC = { collection: "settings", doc: "invoiceHeader" };

export const getInvoiceHeaderSettings = async () => {
    try {
        const docRef = doc(db, INVOICE_HEADER_DOC.collection, INVOICE_HEADER_DOC.doc);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (error) {
        console.error("Error loading invoice header settings:", error);
        throw error;
    }
};

export const saveInvoiceHeaderSettings = async (settings) => {
    try {
        const docRef = doc(db, INVOICE_HEADER_DOC.collection, INVOICE_HEADER_DOC.doc);
        await setDoc(docRef, settings, { merge: true });
        return true;
    } catch (error) {
        console.error("Error saving invoice header settings:", error);
        throw error;
    }
};

export const createInvoice = async (invoice) => {
    try {
        const invoiceRef = doc(collection(db, "invoices"));
        const batch = writeBatch(db);

        const salesByProduct = new Map();
        (invoice.items || []).forEach((item) => {
            if (!item?.productId || !item?.quantity) return;
            const quantity = Number(item.quantity) || 0;
            if (!quantity) return;
            const unitPrice = Number(item.unitPrice) || 0;
            const current = salesByProduct.get(item.productId) || { quantity: 0, lastSoldPrice: unitPrice };
            salesByProduct.set(item.productId, {
                quantity: current.quantity + quantity,
                lastSoldPrice: unitPrice,
            });
        });

        batch.set(invoiceRef, {
            ...invoice,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        salesByProduct.forEach((entry, productId) => {
            const productRef = doc(db, "products", productId);
            batch.update(productRef, {
                stockQuantity: increment(-entry.quantity),
                soldQuantity: increment(entry.quantity),
                lastSoldPrice: entry.lastSoldPrice,
                updatedAt: serverTimestamp(),
            });
        });

        await batch.commit();

        if (ensureCacheArray()) {
            salesByProduct.forEach((entry, productId) => {
                const cached = productsCache.find((product) => product.id === productId);
                if (!cached) return;
                const currentQty = parseInt(cached.stockQuantity, 10) || 0;
                const currentSold = parseInt(cached.soldQuantity, 10) || 0;
                updateCachedProduct(productId, {
                    stockQuantity: currentQty - entry.quantity,
                    soldQuantity: currentSold + entry.quantity,
                    lastSoldPrice: entry.lastSoldPrice,
                    updatedAt: Date.now(),
                });
            });
        }

        return invoiceRef.id;
    } catch (error) {
        console.error("Error creating invoice:", error);
        throw error;
    }
};

export const getAllInvoices = async () => {
    try {
        const col = collection(db, "invoices");
        const q = query(col, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach((docSnap) => {
            results.push({ id: docSnap.id, ...docSnap.data() });
        });
        return results;
    } catch (error) {
        console.error("Error loading invoices:", error);
        throw error;
    }
};

export const getAllCustomers = async () => {
    try {
        const col = collection(db, "customers");
        const q = query(col, orderBy("name"));
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach((docSnap) => {
            results.push({ id: docSnap.id, ...docSnap.data() });
        });
        return results;
    } catch (error) {
        console.error("Error loading customers:", error);
        throw error;
    }
};

export const addCustomer = async (customer) => {
    try {
        const docRef = await addDoc(collection(db, "customers"), {
            ...customer,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding customer:", error);
        throw error;
    }
};

export const updateCustomer = async (id, customer) => {
    try {
        const docRef = doc(db, "customers", id);
        await updateDoc(docRef, {
            ...customer,
            updatedAt: serverTimestamp(),
        });
        return true;
    } catch (error) {
        console.error("Error updating customer:", error);
        throw error;
    }
};

export const createCustomerLedgerEntry = async (entry) => {
    try {
        const docRef = await addDoc(collection(db, "customerLedger"), {
            ...entry,
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving customer ledger entry:", error);
        throw error;
    }
};

export const getAllCustomerLedgerEntries = async () => {
    try {
        const col = collection(db, "customerLedger");
        const q = query(col, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach((docSnap) => {
            results.push({ id: docSnap.id, ...docSnap.data() });
        });
        return results;
    } catch (error) {
        console.error("Error loading customer ledger entries:", error);
        throw error;
    }
};

const normalizeDateKey = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (value instanceof Date) {
        const yyyy = value.getFullYear();
        const mm = String(value.getMonth() + 1).padStart(2, "0");
        const dd = String(value.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
    return "";
};

export const recordDailySale = async ({
    productId,
    productName = "",
    unit = "",
    quantity,
    unitPrice,
    dateKey,
    saleDate,
}) => {
    if (!productId) throw new Error("Missing productId");
    const safeQuantity = Number(quantity) || 0;
    const safeUnitPrice = Number(unitPrice) || 0;
    if (safeQuantity <= 0) throw new Error("Quantity must be greater than 0");

    const resolvedDateKey = normalizeDateKey(dateKey || saleDate) || normalizeDateKey(new Date());
    const saleDateValue = resolvedDateKey
        ? new Date(`${resolvedDateKey}T00:00:00`)
        : new Date();
    const total = safeQuantity * safeUnitPrice;

    try {
        const saleRef = doc(collection(db, "dailySales"));
        const productRef = doc(db, "products", productId);
        const batch = writeBatch(db);

        batch.set(saleRef, {
            productId,
            productName,
            unit,
            quantity: safeQuantity,
            unitPrice: safeUnitPrice,
            total,
            dateKey: resolvedDateKey,
            saleDate: saleDateValue,
            createdAt: serverTimestamp(),
        });

        batch.update(productRef, {
            stockQuantity: increment(-safeQuantity),
            soldQuantity: increment(safeQuantity),
            lastSoldPrice: safeUnitPrice,
            updatedAt: serverTimestamp(),
        });

        await batch.commit();

        if (ensureCacheArray()) {
            const cached = productsCache.find((product) => product.id === productId);
            if (cached) {
                const currentQty = parseInt(cached.stockQuantity, 10) || 0;
                const currentSold = parseInt(cached.soldQuantity, 10) || 0;
                updateCachedProduct(productId, {
                    stockQuantity: currentQty - safeQuantity,
                    soldQuantity: currentSold + safeQuantity,
                    lastSoldPrice: safeUnitPrice,
                    updatedAt: Date.now(),
                });
            }
        }

        return saleRef.id;
    } catch (error) {
        console.error("Error recording daily sale:", error);
        throw error;
    }
};

export const getDailySalesByDateRange = async (startDateKey, endDateKey) => {
    if (!startDateKey || !endDateKey) return [];
    try {
        const salesCol = collection(db, "dailySales");
        const q = query(
            salesCol,
            where("dateKey", ">=", startDateKey),
            where("dateKey", "<=", endDateKey),
            orderBy("dateKey")
        );
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach((docSnap) => {
            results.push({ id: docSnap.id, ...docSnap.data() });
        });
        return results;
    } catch (error) {
        console.error("Error loading daily sales:", error);
        throw error;
    }
};

/** Client-side filter (Firestore cannot compare two fields in one where). */
export const getLowStockProducts = async () => {
    const all = await getAllProducts();
    return all.filter(isLowStockProduct);
};
