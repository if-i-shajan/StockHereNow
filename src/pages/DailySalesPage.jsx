import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiPlus, FiRefreshCw, FiSave, FiTrash2 } from "react-icons/fi";
import {
    addCustomer,
    getAllCustomers,
    getAllProducts,
    getCachedProducts,
    getDailySalesByDateRange,
    recordDailySales,
} from "../firebase/firestoreService";
import { formatTaka } from "../utils/formatCurrency";
import { safeFloat, safeInt } from "../utils/parseNumbers";
import { getStockQty } from "../utils/stockUtils";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const buildCustomerKey = (customer) => {
    const name = normalizeText(customer?.name);
    const phone = normalizeText(customer?.phone);
    const address = normalizeText(customer?.address);
    if (!name && !phone && !address) return "";
    return `${name}|${phone}|${address}`;
};

const createSaleItem = () => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: "",
    quantity: "",
    unitPrice: "",
    sellFertilizerLoose: false,
});

const buildProductLabel = (product) => {
    if (!product) return "";
    const name = String(product.productName || "").trim();
    const pack = String(product.packSize || "").trim();
    const company = String(product.company || "").trim();

    const parts = [name];
    if (pack) {
        parts.push(pack);
    }
    if (company) {
        parts.push(company);
    }
    return parts.filter(Boolean).join(" | ");
};

const DailySalesPage = () => {
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [dailySales, setDailySales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingSales, setLoadingSales] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        dateKey: new Date().toISOString().slice(0, 10),
        customerMode: "existing",
        customerKey: "",
        customerName: "",
        customerPhone: "",
        customerAddress: "",
        items: [createSaleItem()],
    });

    const loadBaseData = async () => {
        setLoading(true);
        try {
            const [productRows, customerRows] = await Promise.all([
                getAllProducts(),
                getAllCustomers(),
            ]);
            setProducts(productRows);
            setCustomers(customerRows);
        } catch (error) {
            console.error("Error loading daily sales data:", error);
            toast.error("Failed to load daily sales data");
        } finally {
            setLoading(false);
        }
    };

    const loadDailySales = async (dateKey) => {
        if (!dateKey) return;
        setLoadingSales(true);
        try {
            const sales = await getDailySalesByDateRange(dateKey, dateKey);
            setDailySales(sales);
        } catch (error) {
            console.error("Error loading daily sales:", error);
            toast.error("Failed to load daily sales");
        } finally {
            setLoadingSales(false);
        }
    };

    useEffect(() => {
        const cached = getCachedProducts();
        if (cached) {
            setProducts(cached);
        }
        loadBaseData();
    }, []);

    useEffect(() => {
        loadDailySales(form.dateKey);
    }, [form.dateKey]);

    const productMap = useMemo(() => {
        const map = new Map();
        products.forEach((product) => map.set(product.id, product));
        return map;
    }, [products]);

    const customerOptions = useMemo(() => {
        return customers
            .map((customer) => {
                const key = customer.customerKey || buildCustomerKey(customer);
                if (!key) return null;
                return {
                    key,
                    id: customer.id,
                    name: customer.name || "",
                    phone: customer.phone || "",
                    address: customer.address || "",
                };
            })
            .filter(Boolean);
    }, [customers]);

    const customerMap = useMemo(() => {
        const map = new Map();
        customerOptions.forEach((customer) => map.set(customer.key, customer));
        return map;
    }, [customerOptions]);

    const lineItems = useMemo(() => {
        return form.items.map((item) => {
            const product = item.productId ? productMap.get(item.productId) : null;
            const stockAvailable = product ? getStockQty(product) : 0;
            const isFertilizerProduct = Boolean(product?.isFertilizer) || product?.category === "Fertilizer";
            const perKgBuyingPrice = product ? safeFloat(product.invoicePricePerKg) : 0;
            const perKgMinSellPrice = product ? safeFloat(product.minSellPricePerKg) : 0;
            const canSellFertilizerLoose = isFertilizerProduct && perKgBuyingPrice > 0 && perKgMinSellPrice > 0;
            const sellFertilizerLoose = canSellFertilizerLoose && item.sellFertilizerLoose;
            const baseUnitCost = product ? safeFloat(product.invoicePrice) : 0;
            const unitCost = sellFertilizerLoose ? perKgBuyingPrice : baseUnitCost;
            const minSellPricePerBag = product
                ? safeFloat(product.minSellPrice ?? product.marketPrice)
                : 0;
            const minSellPrice = sellFertilizerLoose ? perKgMinSellPrice : minSellPricePerBag;
            const saleUnitLabel = sellFertilizerLoose ? "Kg" : (product?.unit || "");
            const quantityValue = safeInt(item.quantity);
            const unitPriceValue = safeFloat(item.unitPrice);
            const totalValue = quantityValue * unitPriceValue;
            const profitValue = (unitPriceValue - unitCost) * quantityValue;

            return {
                ...item,
                product,
                productLabel: buildProductLabel(product),
                stockAvailable,
                isFertilizerProduct,
                canSellFertilizerLoose,
                sellFertilizerLoose,
                unitCost,
                minSellPrice,
                saleUnitLabel,
                quantityValue,
                unitPriceValue,
                totalValue,
                profitValue,
            };
        });
    }, [form.items, productMap]);

    const salesDraftSummary = useMemo(() => {
        return lineItems.reduce(
            (acc, item) => {
                if (!item.productId || item.quantityValue <= 0 || item.unitPriceValue <= 0) {
                    return acc;
                }
                acc.total += item.totalValue;
                acc.profit += item.profitValue;
                acc.rows += 1;
                return acc;
            },
            { total: 0, profit: 0, rows: 0 }
        );
    }, [lineItems]);

    const sortedSales = useMemo(() => {
        return [...dailySales].sort((a, b) => {
            const aDate = a?.createdAt?.toDate ? a.createdAt.toDate().getTime() : Number(a?.createdAt) || 0;
            const bDate = b?.createdAt?.toDate ? b.createdAt.toDate().getTime() : Number(b?.createdAt) || 0;
            return bDate - aDate;
        });
    }, [dailySales]);

    const dailyTotals = useMemo(() => {
        return dailySales.reduce(
            (acc, sale) => {
                const total = Number(sale?.total) || (Number(sale?.unitPrice) || 0) * (Number(sale?.quantity) || 0);
                const profit = typeof sale?.profit === "number"
                    ? sale.profit
                    : (Number(sale?.unitPrice) - Number(sale?.unitCost || 0)) * Number(sale?.quantity || 0);
                acc.total += total;
                acc.profit += profit;
                return acc;
            },
            { total: 0, profit: 0 }
        );
    }, [dailySales]);

    const handleFormChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleItemChange = (itemId, field, value) => {
        setForm((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.id !== itemId) return item;
                if (field !== "productId") {
                    return { ...item, [field]: value };
                }

                const selectedProduct = productMap.get(value);
                if (!selectedProduct) {
                    return {
                        ...item,
                        productId: value,
                        unitPrice: "",
                        sellFertilizerLoose: false,
                    };
                }

                const isFertilizerProduct = Boolean(selectedProduct.isFertilizer) || selectedProduct.category === "Fertilizer";
                const perKgBuyingPrice = safeFloat(selectedProduct.invoicePricePerKg);
                const perKgMinSellPrice = safeFloat(selectedProduct.minSellPricePerKg);
                const canSellFertilizerLoose = isFertilizerProduct && perKgBuyingPrice > 0 && perKgMinSellPrice > 0;
                const nextSellLoose = canSellFertilizerLoose;
                const perBagMinSell = safeFloat(selectedProduct.minSellPrice ?? selectedProduct.marketPrice);
                const nextUnitPrice = nextSellLoose ? perKgMinSellPrice : perBagMinSell;

                return {
                    ...item,
                    productId: value,
                    sellFertilizerLoose: nextSellLoose,
                    unitPrice: Number.isFinite(nextUnitPrice) && nextUnitPrice > 0 ? nextUnitPrice.toFixed(2) : "",
                };
            }),
        }));
    };

    const handleItemLooseToggle = (itemId, checked) => {
        setForm((prev) => ({
            ...prev,
            items: prev.items.map((item) => {
                if (item.id !== itemId) return item;
                const product = productMap.get(item.productId);
                if (!product) return { ...item, sellFertilizerLoose: checked };

                const perBagMinSell = safeFloat(product.minSellPrice ?? product.marketPrice);
                const perKgMinSell = safeFloat(product.minSellPricePerKg);
                const nextUnitPrice = checked ? perKgMinSell : perBagMinSell;
                return {
                    ...item,
                    sellFertilizerLoose: checked,
                    unitPrice: Number.isFinite(nextUnitPrice) && nextUnitPrice > 0 ? nextUnitPrice.toFixed(2) : item.unitPrice,
                };
            }),
        }));
    };

    const addItemRow = () => {
        setForm((prev) => ({
            ...prev,
            items: [...prev.items, createSaleItem()],
        }));
    };

    const removeItemRow = (itemId) => {
        setForm((prev) => {
            if (prev.items.length === 1) return prev;
            return {
                ...prev,
                items: prev.items.filter((item) => item.id !== itemId),
            };
        });
    };

    const handleCustomerModeChange = (mode) => {
        setForm((prev) => ({
            ...prev,
            customerMode: mode,
            customerKey: mode === "existing" ? prev.customerKey : "",
        }));
    };

    const validateForm = () => {
        if (!form.dateKey) {
            toast.error("Select a sales date");
            return false;
        }

        const filledRows = lineItems.filter(
            (item) => item.productId || String(item.quantity || "").trim() || String(item.unitPrice || "").trim()
        );
        if (filledRows.length === 0) {
            toast.error("Add at least one product");
            return false;
        }

        const validRows = lineItems.filter(
            (item) => item.productId && item.quantityValue > 0 && item.unitPriceValue > 0
        );
        if (validRows.length === 0) {
            toast.error("Enter product, quantity, and price for at least one row");
            return false;
        }

        const uniqueProductIds = new Set();
        for (const item of validRows) {
            if (uniqueProductIds.has(item.productId)) {
                toast.error("Duplicate product rows are not allowed in one daily sale entry");
                return false;
            }
            uniqueProductIds.add(item.productId);

            if (item.stockAvailable < item.quantityValue) {
                toast.error(`Not enough stock for ${item.productLabel || "selected product"}`);
                return false;
            }
        }

        if (form.customerMode === "existing" && !form.customerKey) {
            toast.error("Select a customer");
            return false;
        }
        if (form.customerMode === "new") {
            if (!form.customerName || !form.customerPhone || !form.customerAddress) {
                toast.error("Enter customer name, phone, and address");
                return false;
            }
        }
        return true;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validateForm()) return;

        const validRows = lineItems.filter(
            (item) => item.productId && item.quantityValue > 0 && item.unitPriceValue > 0
        );

        setSaving(true);
        try {
            let customerKey = "";
            let customerName = "";
            let customerPhone = "";
            let customerAddress = "";

            if (form.customerMode === "existing") {
                const customer = customerMap.get(form.customerKey);
                customerKey = form.customerKey;
                customerName = customer?.name || "";
                customerPhone = customer?.phone || "";
                customerAddress = customer?.address || "";
            } else {
                const draftCustomer = {
                    name: form.customerName,
                    phone: form.customerPhone,
                    address: form.customerAddress,
                };
                const generatedKey = buildCustomerKey(draftCustomer);
                const existing = customerMap.get(generatedKey);
                if (existing) {
                    customerKey = existing.key;
                    customerName = existing.name;
                    customerPhone = existing.phone;
                    customerAddress = existing.address;
                } else {
                    customerKey = generatedKey;
                    customerName = draftCustomer.name;
                    customerPhone = draftCustomer.phone;
                    customerAddress = draftCustomer.address;
                    const id = await addCustomer({
                        ...draftCustomer,
                        customerKey,
                    });
                    setCustomers((prev) => [...prev, { id, ...draftCustomer, customerKey }]);
                }
            }

            await recordDailySales({
                dateKey: form.dateKey,
                saleDate: form.dateKey,
                customerKey,
                customerName,
                customerPhone,
                customerAddress,
                items: validRows.map((item) => ({
                    productId: item.productId,
                    productName: item.product?.productName || "",
                    productLabel: item.productLabel,
                    unit: item.saleUnitLabel,
                    quantity: item.quantityValue,
                    unitPrice: item.unitPriceValue,
                    unitCost: item.unitCost,
                    minSellPrice: item.minSellPrice,
                })),
            });

            toast.success("Daily sales saved and stock updated");
            setForm((prev) => ({
                ...prev,
                items: [createSaleItem()],
                customerName: "",
                customerPhone: "",
                customerAddress: "",
            }));

            await loadDailySales(form.dateKey);
            const refreshedProducts = await getAllProducts();
            setProducts(refreshedProducts);
        } catch (error) {
            console.error("Error saving daily sales:", error);
            toast.error("Failed to save daily sales");
        } finally {
            setSaving(false);
        }
    };

    const handleRefresh = async () => {
        await loadBaseData();
        await loadDailySales(form.dateKey);
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 font-nunito">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-agriGreen border-t-transparent" aria-hidden />
                <p className="font-semibold text-agriGreen">Loading daily sales...</p>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl pb-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="font-merriweather text-2xl font-bold text-agriGreen-900 sm:text-3xl">Daily Sales Panel</h1>
                    <p className="font-nunito text-sm text-gray-600">
                        Update daily sales, track profit, and link sales to customers.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-agriGreen transition hover:bg-agriGreen-50"
                >
                    <FiRefreshCw size={16} />
                    Refresh
                </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <form onSubmit={handleSubmit} className="form-card-agri">
                    <h2 className="mb-4 border-b-2 border-agriGreen-200 pb-2 font-merriweather text-lg font-bold text-agriGreen-900">
                        Record Daily Sale
                    </h2>

                    <div>
                        <label className="form-label-agri">Sale Date</label>
                        <input
                            type="date"
                            className="form-field-agri max-w-[320px]"
                            value={form.dateKey}
                            onChange={(e) => handleFormChange("dateKey", e.target.value)}
                        />
                    </div>

                    <div className="mt-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-merriweather text-base font-bold text-agriGreen-900">Products</h3>
                            <button
                                type="button"
                                onClick={addItemRow}
                                className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-agriGreen px-3 py-2 font-nunito text-sm font-semibold text-agriGreen transition hover:bg-agriGreen-50"
                            >
                                <FiPlus size={16} />
                                Add product
                            </button>
                        </div>

                        {lineItems.map((item, index) => {
                            const selectedInOtherRows = new Set(
                                form.items
                                    .filter((entry) => entry.id !== item.id && entry.productId)
                                    .map((entry) => entry.productId)
                            );

                            return (
                                <div key={item.id} className="rounded-2xl border border-agriGreen-100 bg-white p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <p className="font-nunito text-sm font-bold text-gray-700">Product row {index + 1}</p>
                                        <button
                                            type="button"
                                            onClick={() => removeItemRow(item.id)}
                                            disabled={form.items.length === 1}
                                            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-agriRed/30 px-2.5 py-1.5 text-xs font-semibold text-agriRed transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <FiTrash2 size={14} />
                                            Remove
                                        </button>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="form-label-agri">Product</label>
                                            <select
                                                className="form-field-agri cursor-pointer"
                                                value={item.productId}
                                                onChange={(e) => handleItemChange(item.id, "productId", e.target.value)}
                                            >
                                                <option value="">Select product</option>
                                                {products.map((product) => (
                                                    <option
                                                        key={product.id}
                                                        value={product.id}
                                                        disabled={selectedInOtherRows.has(product.id)}
                                                    >
                                                        {buildProductLabel(product)}
                                                    </option>
                                                ))}
                                            </select>
                                            {item.product && (
                                                <p className="mt-1 text-xs font-semibold text-agriGreen">
                                                    Available: {item.stockAvailable} {item.saleUnitLabel || item.product.unit}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="form-label-agri">Quantity</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="form-field-agri"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label-agri">Unit Price (BDT)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="form-field-agri"
                                                value={item.unitPrice}
                                                onChange={(e) => handleItemChange(item.id, "unitPrice", e.target.value)}
                                            />
                                            {item.product && item.minSellPrice > 0 && (
                                                <p className="mt-1 text-xs text-gray-500">
                                                    Min sell: {formatTaka(item.minSellPrice)}{item.saleUnitLabel ? ` / ${item.saleUnitLabel}` : ""}
                                                </p>
                                            )}
                                        </div>
                                        <div className="rounded-xl border border-agriGreen-100 bg-agriCream p-3">
                                            <p className="text-xs font-semibold text-gray-700">Line Summary</p>
                                            <div className="mt-2 space-y-1 text-xs text-gray-700">
                                                <div className="flex items-center justify-between">
                                                    <span>Cost</span>
                                                    <span>{formatTaka(item.unitCost)}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span>Total</span>
                                                    <span>{formatTaka(item.totalValue)}</span>
                                                </div>
                                                <div className="flex items-center justify-between font-semibold">
                                                    <span>Profit</span>
                                                    <span className={item.profitValue >= 0 ? "text-agriGreen-800" : "text-agriRed"}>
                                                        {formatTaka(item.profitValue)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {item.isFertilizerProduct && (
                                        <div className="mt-3 rounded-2xl border border-agriGreen-100 bg-agriCream p-3">
                                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                                <input
                                                    type="checkbox"
                                                    checked={item.sellFertilizerLoose}
                                                    onChange={(e) => handleItemLooseToggle(item.id, e.target.checked)}
                                                    className="h-4 w-4 accent-agriGreen"
                                                    disabled={!item.canSellFertilizerLoose}
                                                />
                                                Sell fertilizer by kg (use per kg prices)
                                            </label>
                                            {!item.canSellFertilizerLoose && (
                                                <p className="mt-1 text-xs text-agriRed">
                                                    Set per kg buying and minimum sell prices in the product to enable per kg sale.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 rounded-2xl border border-agriGreen-100 bg-agriCream p-4">
                        <h3 className="mb-2 font-merriweather text-base font-bold text-agriGreen-900">Quick Summary</h3>
                        <div className="grid gap-2 text-sm font-semibold text-gray-700 sm:grid-cols-2">
                            <div className="flex items-center justify-between">
                                <span>Product lines</span>
                                <span>{salesDraftSummary.rows}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Total amount</span>
                                <span>{formatTaka(salesDraftSummary.total)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Profit</span>
                                <span className={salesDraftSummary.profit >= 0 ? "text-agriGreen-800" : "text-agriRed"}>
                                    {formatTaka(salesDraftSummary.profit)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <h3 className="mb-2 font-merriweather text-base font-bold text-agriGreen-900">Customer</h3>
                        <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <input
                                    type="radio"
                                    name="customerMode"
                                    checked={form.customerMode === "existing"}
                                    onChange={() => handleCustomerModeChange("existing")}
                                />
                                Existing customer
                            </label>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <input
                                    type="radio"
                                    name="customerMode"
                                    checked={form.customerMode === "new"}
                                    onChange={() => handleCustomerModeChange("new")}
                                />
                                New customer
                            </label>
                        </div>

                        {form.customerMode === "existing" ? (
                            <div className="mt-3">
                                <label className="form-label-agri">Customer</label>
                                <select
                                    className="form-field-agri cursor-pointer"
                                    value={form.customerKey}
                                    onChange={(e) => handleFormChange("customerKey", e.target.value)}
                                >
                                    <option value="">Select customer</option>
                                    {customerOptions.map((customer) => (
                                        <option key={customer.key} value={customer.key}>
                                            {customer.name || "Unknown"} {customer.phone ? `(${customer.phone})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="form-label-agri">Customer Name</label>
                                    <input
                                        className="form-field-agri"
                                        value={form.customerName}
                                        onChange={(e) => handleFormChange("customerName", e.target.value)}
                                        placeholder="Customer name"
                                    />
                                </div>
                                <div>
                                    <label className="form-label-agri">Customer Phone</label>
                                    <input
                                        className="form-field-agri"
                                        value={form.customerPhone}
                                        onChange={(e) => handleFormChange("customerPhone", e.target.value)}
                                        placeholder="01XXXXXXXXX"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="form-label-agri">Customer Address</label>
                                    <textarea
                                        className="form-field-agri min-h-[84px]"
                                        value={form.customerAddress}
                                        onChange={(e) => handleFormChange("customerAddress", e.target.value)}
                                        placeholder="Customer address"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-agriGreen to-agriGreen-800 px-6 py-3 font-nunito text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FiSave size={16} />
                        {saving ? "Saving..." : "Save Daily Sales"}
                    </button>
                </form>

                <div className="form-card-agri">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="font-merriweather text-lg font-bold text-agriGreen-900">
                                Sales for {form.dateKey}
                            </h2>
                            <p className="font-nunito text-sm text-gray-600">
                                Total: {formatTaka(dailyTotals.total)} | Profit: {formatTaka(dailyTotals.profit)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => loadDailySales(form.dateKey)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-agriGreen transition hover:bg-agriGreen-50"
                        >
                            <FiRefreshCw size={16} />
                            Refresh
                        </button>
                    </div>

                    {loadingSales ? (
                        <p className="font-nunito text-sm text-gray-500">Loading daily sales...</p>
                    ) : sortedSales.length === 0 ? (
                        <p className="font-nunito text-sm text-gray-500">No sales recorded for this date.</p>
                    ) : (
                        <div className="space-y-3">
                            {sortedSales.map((sale) => {
                                const total = Number(sale?.total) || (Number(sale?.unitPrice) || 0) * (Number(sale?.quantity) || 0);
                                const profit = typeof sale?.profit === "number"
                                    ? sale.profit
                                    : (Number(sale?.unitPrice) - Number(sale?.unitCost || 0)) * Number(sale?.quantity || 0);
                                const saleProduct = sale?.productId ? productMap.get(sale.productId) : null;
                                const saleLabel = sale?.productLabel || buildProductLabel(saleProduct) || sale?.productName || "Unknown product";
                                return (
                                    <div key={sale.id} className="rounded-2xl border border-agriGreen-100 bg-white p-4 shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate font-nunito text-sm font-bold text-gray-900">
                                                    {saleLabel}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {sale?.customerName || "Walk-in"}
                                                </p>
                                            </div>
                                            <p className="shrink-0 text-sm font-bold text-agriGreen-800">{formatTaka(total)}</p>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                                            <span>Qty: {sale?.quantity || 0} {sale?.unit || ""}</span>
                                            <span>Price: {formatTaka(sale?.unitPrice || 0)}</span>
                                            <span className={profit >= 0 ? "font-semibold text-agriGreen-800" : "font-semibold text-agriRed"}>
                                                Profit: {formatTaka(profit)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DailySalesPage;
