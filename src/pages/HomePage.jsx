import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiBarChart2, FiChevronDown, FiChevronUp } from "react-icons/fi";
import toast from "react-hot-toast";
import {
    getAllProducts,
    getCachedProducts,
    getAllInvoices,
    getAllCustomers,
    getAllCustomerLedgerEntries,
    getDailySalesByDateRange,
} from "../firebase/firestoreService";
import { formatTaka } from "../utils/formatCurrency";
import { getLowStockAlert, getStockQty, isLowStockProduct } from "../utils/stockUtils";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const buildCustomerKey = (customer) => {
    const name = normalizeText(customer?.name);
    const phone = normalizeText(customer?.phone);
    const address = normalizeText(customer?.address);
    if (!name && !phone && !address) return "";
    return `${name}|${phone}|${address}`;
};

const toDateKey = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const getLastDateKeys = (days) => {
    const today = new Date();
    const keys = [];
    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        keys.push(toDateKey(d));
    }
    return keys;
};

const getSaleTimestamp = (sale) => {
    const value = sale?.saleDate ?? sale?.createdAt;
    if (!value) return 0;
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    if (typeof value === "number") return value;
    if (typeof value === "string") return new Date(value).getTime();
    return 0;
};

const getSaleProfit = (sale) => {
    if (typeof sale?.profit === "number") return sale.profit;
    const unitPrice = Number(sale?.unitPrice) || 0;
    const unitCost = Number(sale?.unitCost) || 0;
    const quantity = Number(sale?.quantity) || 0;
    return (unitPrice - unitCost) * quantity;
};

const chartPalette = [
    { from: "#34d399", to: "#059669", shadow: "rgba(16, 185, 129, 0.35)" },
    { from: "#60a5fa", to: "#2563eb", shadow: "rgba(37, 99, 235, 0.35)" },
    { from: "#fbbf24", to: "#f97316", shadow: "rgba(249, 115, 22, 0.35)" },
    { from: "#f472b6", to: "#db2777", shadow: "rgba(219, 39, 119, 0.3)" },
    { from: "#a78bfa", to: "#7c3aed", shadow: "rgba(124, 58, 237, 0.35)" },
    { from: "#38bdf8", to: "#0ea5e9", shadow: "rgba(14, 165, 233, 0.35)" },
    { from: "#4ade80", to: "#16a34a", shadow: "rgba(22, 163, 74, 0.35)" },
];

const HomePage = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [dailySales, setDailySales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showLowStock, setShowLowStock] = useState(false);
    const lowStockRef = useRef(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const cached = getCachedProducts();
                if (cached) {
                    setProducts(cached);
                }

                const dateKeys = getLastDateKeys(7);
                const [fetchedProducts, fetchedInvoices, fetchedCustomers, fetchedLedgerEntries, fetchedDailySales] = await Promise.all([
                    getAllProducts(),
                    getAllInvoices(),
                    getAllCustomers(),
                    getAllCustomerLedgerEntries(),
                    getDailySalesByDateRange(dateKeys[0], dateKeys[dateKeys.length - 1]),
                ]);

                setProducts(fetchedProducts);
                setInvoices(fetchedInvoices);
                setCustomers(fetchedCustomers);
                setLedgerEntries(fetchedLedgerEntries);
                setDailySales(fetchedDailySales);
            } catch (error) {
                console.error("Error loading dashboard data:", error);
                toast.error("Failed to load dashboard data");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const stats = useMemo(() => {
        const totalProducts = products.length;
        const stockValue = products.reduce((sum, p) => {
            return sum + (parseFloat(p.invoicePrice) || 0) * (parseInt(p.stockQuantity, 10) || 0);
        }, 0);
        const totalUnits = products.reduce((sum, p) => sum + (parseInt(p.stockQuantity, 10) || 0), 0);
        const lowStockCount = products.filter(isLowStockProduct).length;

        return { totalProducts, stockValue, lowStockCount, totalUnits };
    }, [products]);

    const lowStockProducts = useMemo(() => {
        return products.filter(isLowStockProduct).sort((a, b) => getStockQty(a) - getStockQty(b));
    }, [products]);

    const dailySalesByDate = useMemo(() => {
        const dateKeys = getLastDateKeys(7);
        const map = new Map(dateKeys.map((key) => [key, { dateKey: key, totalAmount: 0, totalQuantity: 0 }]));

        dailySales.forEach((sale) => {
            const key = sale?.dateKey;
            const entry = key ? map.get(key) : null;
            if (!entry) return;
            entry.totalAmount += Number(sale.total) || (Number(sale.unitPrice) || 0) * (Number(sale.quantity) || 0);
            entry.totalQuantity += Number(sale.quantity) || 0;
        });

        return dateKeys.map((key) => map.get(key));
    }, [dailySales]);

    const dailySalesMax = useMemo(() => {
        if (!dailySalesByDate.length) return 1;
        return Math.max(1, ...dailySalesByDate.map((day) => day.totalAmount || 0));
    }, [dailySalesByDate]);

    const dailySalesEntries = useMemo(() => {
        return [...dailySales]
            .sort((a, b) => getSaleTimestamp(b) - getSaleTimestamp(a));
    }, [dailySales]);

    const dailySalesSummary = useMemo(() => {
        return dailySales.reduce(
            (acc, sale) => {
                const total = Number(sale?.total) || (Number(sale?.unitPrice) || 0) * (Number(sale?.quantity) || 0);
                const profit = getSaleProfit(sale);
                acc.total += total;
                acc.profit += profit;
                return acc;
            },
            { total: 0, profit: 0 }
        );
    }, [dailySales]);

    const categoryOverview = useMemo(() => {
        const map = {};
        products.forEach((p) => {
            const category = p.category || "Other";
            if (!map[category]) {
                map[category] = { count: 0, units: 0 };
            }
            map[category].count += 1;
            map[category].units += parseInt(p.stockQuantity, 10) || 0;
        });

        return Object.entries(map)
            .map(([name, value]) => ({ name, ...value }))
            .sort((a, b) => b.count - a.count);
    }, [products]);

    const customerInfoByKey = useMemo(() => {
        const map = new Map();
        customers.forEach((customer) => {
            const key = customer.customerKey || buildCustomerKey(customer);
            if (!key) return;
            map.set(key, {
                name: customer.name || "",
                phone: customer.phone || "",
                address: customer.address || "",
            });
        });
        return map;
    }, [customers]);

    const customerAggregates = useMemo(() => {
        const map = new Map();

        const ensureCustomer = (key, fallback = {}) => {
            if (!key) return null;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: fallback.name || "",
                    phone: fallback.phone || "",
                    address: fallback.address || "",
                    totalPurchased: 0,
                    totalDue: 0,
                });
            }
            return map.get(key);
        };

        customers.forEach((customer) => {
            const key = customer.customerKey || buildCustomerKey(customer);
            if (!key) return;
            ensureCustomer(key, customer);
        });

        invoices.forEach((invoice) => {
            const key = buildCustomerKey(invoice?.customer);
            const row = ensureCustomer(key, invoice?.customer);
            if (!row) return;
            row.totalPurchased += Number(invoice?.totals?.total) || 0;
            row.totalDue += Number(invoice?.totals?.due) || 0;
        });

        ledgerEntries.forEach((entry) => {
            const key = entry?.customerKey || buildCustomerKey(entry);
            const row = ensureCustomer(key, entry);
            if (!row) return;
            const amount = Number(entry.amount) || 0;
            if (entry.type === "payment") {
                row.totalDue = Math.max(0, row.totalDue - amount);
            } else {
                row.totalDue += amount;
            }
        });

        return Array.from(map.values()).map((entry) => ({
            ...entry,
            totalDue: Math.max(0, entry.totalDue),
        }));
    }, [customers, invoices, ledgerEntries]);

    const dailySalesCustomers = useMemo(() => {
        const map = new Map();

        dailySales.forEach((sale) => {
            const key = sale?.customerKey || buildCustomerKey({
                name: sale?.customerName,
                phone: sale?.customerPhone,
                address: sale?.customerAddress,
            });
            if (!key) return;

            const info = customerInfoByKey.get(key);
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: info?.name || sale?.customerName || "Unknown customer",
                    phone: info?.phone || sale?.customerPhone || "",
                    address: info?.address || sale?.customerAddress || "",
                    totalPurchased: 0,
                });
            }

            const row = map.get(key);
            row.totalPurchased += Number(sale?.total) || (Number(sale?.unitPrice) || 0) * (Number(sale?.quantity) || 0);
        });

        return Array.from(map.values());
    }, [dailySales, customerInfoByKey]);

    const customerDueByKey = useMemo(() => {
        const map = new Map();
        customerAggregates.forEach((customer) => {
            map.set(customer.key, customer.totalDue || 0);
        });
        return map;
    }, [customerAggregates]);

    const topBuyers = useMemo(() => {
        return [...dailySalesCustomers]
            .sort((a, b) => b.totalPurchased - a.totalPurchased)
            .slice(0, 5);
    }, [dailySalesCustomers]);

    const topDueCustomers = useMemo(() => {
        return [...dailySalesCustomers]
            .map((customer) => ({
                ...customer,
                totalDue: customerDueByKey.get(customer.key) || 0,
            }))
            .sort((a, b) => {
                if (b.totalDue !== a.totalDue) return b.totalDue - a.totalDue;
                return b.totalPurchased - a.totalPurchased;
            })
            .slice(0, 5);
    }, [dailySalesCustomers, customerDueByKey]);

    const topInvoiceCustomers = useMemo(() => {
        return [...invoices]
            .map((invoice) => ({
                id: invoice.id,
                name: invoice?.customer?.name || "Unknown",
                total: Number(invoice?.totals?.total) || 0,
                due: Number(invoice?.totals?.due) || 0,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [invoices]);

    useEffect(() => {
        if (!showLowStock || !lowStockRef.current) return;
        lowStockRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [showLowStock]);

    if (loading && products.length === 0) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 font-nunito">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-agriGreen border-t-transparent" aria-hidden />
                <p className="font-semibold text-agriGreen">Loading dashboard…</p>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl pb-4">
            <section className="overflow-hidden rounded-[28px] border border-agriGreen-200 bg-gradient-to-br from-agriGreen-900 via-agriGreen-800 to-agriGreen-700 p-5 text-white shadow-xl sm:p-6">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="max-w-2xl">
                            <p className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-agriGreen-50">
                                Home
                            </p>
                            <h1 className="mt-3 font-merriweather text-2xl font-bold sm:text-3xl lg:text-4xl">
                                Report stats
                            </h1>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-agriGreen-50/90 sm:text-base">
                                See your stock overview, sales graph, customer rankings, due list, and category summary here.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-sm backdrop-blur-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-agriGreen-50/80">Products</p>
                            <p className="mt-2 font-nunito text-3xl font-bold text-white">{stats.totalProducts}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-sm backdrop-blur-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-agriGreen-50/80">Stock value</p>
                            <p className="mt-2 break-words font-nunito text-xl font-bold text-white">{formatTaka(stats.stockValue)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/10 p-4 shadow-sm backdrop-blur-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-agriGreen-50/80">Total units</p>
                            <p className="mt-2 font-nunito text-3xl font-bold text-white">{stats.totalUnits.toLocaleString()}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowLowStock((prev) => !prev)}
                            className="group rounded-2xl border border-white/10 bg-white/10 p-4 text-left shadow-sm backdrop-blur-sm transition hover:bg-white/15"
                            aria-expanded={showLowStock}
                            aria-controls="low-stock-section"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-agriGreen-50/80">Low stock</p>
                                <span className="text-agriGreen-50/80">
                                    {showLowStock ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                                </span>
                            </div>
                            <p className={`mt-2 font-nunito text-3xl font-bold ${stats.lowStockCount > 0 ? "text-amber-200" : "text-white"}`}>
                                {stats.lowStockCount}
                            </p>
                            <p className="mt-2 text-xs font-semibold text-agriGreen-50/80">Tap to view details</p>
                        </button>
                    </div>
                </div>
            </section>

            {showLowStock && (
                <section
                    id="low-stock-section"
                    ref={lowStockRef}
                    className="mt-4 rounded-[28px] border border-amber-200 bg-white/95 p-4 shadow-sm sm:p-5"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Low stock</p>
                            <h2 className="mt-1 font-merriweather text-xl font-bold text-amber-900">
                                Low stock product details
                            </h2>
                        </div>
                        <p className="text-sm font-semibold text-amber-800">{lowStockProducts.length} items</p>
                    </div>

                    {lowStockProducts.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                            All products are well stocked.
                        </div>
                    ) : (
                        <div className="mt-4 grid gap-3">
                            {lowStockProducts.map((product) => {
                                const currentQty = getStockQty(product);
                                const alertQty = Math.max(1, getLowStockAlert(product) || 1);
                                const percentage = (currentQty / alertQty) * 100;
                                return (
                                    <div
                                        key={product.id}
                                        className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="font-nunito text-sm font-bold text-gray-900">
                                                    {product.productName}
                                                </p>
                                                <p className="text-xs text-gray-600">
                                                    {product.packSize || ""}{product.packSize ? " · " : ""}{product.company || ""}
                                                </p>
                                                <p className="mt-2 text-xs font-semibold text-amber-900">
                                                    Current: {currentQty} · Alert: {alertQty}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/edit/${product.id}`)}
                                                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-agriGreen px-3 py-2 text-xs font-semibold text-white transition hover:bg-agriGreen-800"
                                            >
                                                Update stock
                                                <FiArrowRight size={14} />
                                            </button>
                                        </div>
                                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amber-100">
                                            <div
                                                className="h-full rounded-full bg-amber-500"
                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {categoryOverview.length > 0 && (
                <section className="mt-4 rounded-[28px] border border-agriGreen-200 bg-white/95 p-4 shadow-sm sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">By category</p>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 font-nunito text-xs [-webkit-overflow-scrolling:touch]">
                        {categoryOverview.map((row) => (
                            <div
                                key={row.name}
                                className="shrink-0 rounded-full border-2 border-agriGreen-200 bg-agriGreen-50 px-3 py-1.5 font-semibold text-agriGreen-900"
                            >
                                {row.name} <span className="opacity-80">({row.count} · {row.units}u)</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="mt-4 rounded-[28px] border border-agriGreen-200 bg-white/95 p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">Daily sales</p>
                        <h2 className="mt-1 font-merriweather text-xl font-bold text-agriGreen-900">7 day sales bar graph</h2>
                    </div>
                    <FiBarChart2 size={20} className="text-agriGreen-700" />
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-3">
                    {dailySalesByDate.map((day, index) => {
                        const date = new Date(`${day.dateKey}T00:00:00`);
                        const label = date.toLocaleDateString("en-BD", { weekday: "short" });
                        const height = `${Math.max(8, Math.round(((day.totalAmount || 0) / dailySalesMax) * 100))}%`;
                        const palette = chartPalette[index % chartPalette.length];
                        const barStyle = day.totalAmount > 0
                            ? {
                                backgroundImage: `linear-gradient(180deg, ${palette.from}, ${palette.to})`,
                                boxShadow: `0 12px 24px ${palette.shadow}`,
                            }
                            : { backgroundColor: "#e2e8f0" };
                        return (
                            <div key={day.dateKey} className="flex flex-col items-center gap-2">
                                <div className="flex h-36 w-full items-end rounded-2xl bg-gradient-to-b from-white via-agriGreen-50 to-agriGreen-100 p-2 sm:h-48">
                                    <div
                                        className="w-full rounded-2xl transition-all"
                                        style={{ height, ...barStyle }}
                                        title={`${day.dateKey}: ${formatTaka(day.totalAmount || 0)}`}
                                    />
                                </div>
                                <p className="text-[11px] font-semibold text-gray-500">{label}</p>
                                <p className="text-[11px] font-bold text-agriGreen-800">{formatTaka(day.totalAmount || 0)}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="mt-4 rounded-[28px] border border-agriGreen-200 bg-white/95 p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">Daily sales updates</p>
                        <h2 className="mt-1 font-merriweather text-xl font-bold text-agriGreen-900">Latest entries</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-agriGreen-700">Last 7 days</p>
                        <p className="font-nunito text-sm font-semibold text-agriGreen-900">Total: {formatTaka(dailySalesSummary.total)}</p>
                        <p className={`font-nunito text-sm font-semibold ${dailySalesSummary.profit >= 0 ? "text-agriGreen-800" : "text-agriRed"}`}>
                            Profit: {formatTaka(dailySalesSummary.profit)}
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid gap-3">
                    {dailySalesEntries.length === 0 ? (
                        <p className="text-sm text-gray-500">No daily sales recorded yet.</p>
                    ) : (
                        dailySalesEntries.map((sale) => {
                            const total = Number(sale?.total) || (Number(sale?.unitPrice) || 0) * (Number(sale?.quantity) || 0);
                            const profit = getSaleProfit(sale);
                            const customerName = sale?.customerName || "Walk-in";
                            const dateLabel = sale?.dateKey || "-";
                            return (
                                <div key={sale.id} className="rounded-2xl border border-agriGreen-100 bg-agriGreen-50/60 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-nunito text-sm font-bold text-gray-900">
                                                {sale?.productName || "Unknown product"}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {customerName} · {dateLabel}
                                            </p>
                                        </div>
                                        <p className="shrink-0 text-sm font-bold text-agriGreen-800">{formatTaka(total)}</p>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                                        <span>Qty: {sale?.quantity || 0} {sale?.unit || ""}</span>
                                        <span>Price: {formatTaka(sale?.unitPrice || 0)}</span>
                                        <span className={`font-semibold ${profit >= 0 ? "text-agriGreen-800" : "text-agriRed"}`}>
                                            Profit: {formatTaka(profit)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-[28px] border border-agriGreen-200 bg-white/95 p-4 shadow-sm sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">Top 5 customers</p>
                    <h2 className="mt-1 font-merriweather text-xl font-bold text-agriGreen-900">By buying product</h2>
                    <div className="mt-4 space-y-3">
                        {topBuyers.length > 0 ? topBuyers.map((customer, index) => (
                            <div key={`${customer.key}-${index}`} className="rounded-2xl border border-agriGreen-100 bg-agriGreen-50/60 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-nunito text-sm font-bold text-gray-900">{customer.name || "Unknown customer"}</p>
                                        <p className="text-xs text-gray-500">{customer.phone || "No phone"}</p>
                                    </div>
                                    <p className="shrink-0 text-sm font-bold text-agriGreen-800">{formatTaka(customer.totalPurchased || 0)}</p>
                                </div>
                            </div>
                        )) : <p className="text-sm text-gray-500">No customer data yet.</p>}
                    </div>
                </div>

                <div className="rounded-[28px] border border-agriGreen-200 bg-white/95 p-4 shadow-sm sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">Top 5 customers</p>
                    <h2 className="mt-1 font-merriweather text-xl font-bold text-agriGreen-900">By due amount</h2>
                    <div className="mt-4 space-y-3">
                        {topDueCustomers.length > 0 ? topDueCustomers.map((customer, index) => (
                            <div key={`${customer.key}-${index}`} className="rounded-2xl border border-agriGreen-100 bg-agriGreen-50/60 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-nunito text-sm font-bold text-gray-900">{customer.name || "Unknown customer"}</p>
                                        <p className="text-xs text-gray-500">{customer.address || "No address"}</p>
                                    </div>
                                    <p className="shrink-0 text-sm font-bold text-agriRed">{formatTaka(customer.totalDue || 0)}</p>
                                </div>
                            </div>
                        )) : <p className="text-sm text-gray-500">No due records yet.</p>}
                    </div>
                </div>

                <div className="rounded-[28px] border border-agriGreen-200 bg-white/95 p-4 shadow-sm sm:p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">Top 5 invoices</p>
                    <h2 className="mt-1 font-merriweather text-xl font-bold text-agriGreen-900">Wholesale customer invoices</h2>
                    <div className="mt-4 space-y-3">
                        {topInvoiceCustomers.length > 0 ? topInvoiceCustomers.map((invoice, index) => (
                            <div key={`${invoice.id}-${index}`} className="rounded-2xl border border-agriGreen-100 bg-agriGreen-50/60 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-nunito text-sm font-bold text-gray-900">{invoice.name}</p>
                                        <p className="text-xs text-gray-500">Due: {formatTaka(invoice.due || 0)}</p>
                                    </div>
                                    <p className="shrink-0 text-sm font-bold text-agriGreen-800">{formatTaka(invoice.total || 0)}</p>
                                </div>
                            </div>
                        )) : <p className="text-sm text-gray-500">No invoices yet.</p>}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
