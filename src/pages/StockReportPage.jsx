import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowRight } from "react-icons/fi";
import {
    getAllProducts,
    getCachedProducts,
    updateProduct,
    recordDailySale,
    getDailySalesByDateRange,
} from "../firebase/firestoreService";
import { formatTaka } from "../utils/formatCurrency";
import { getStockQty, getLowStockAlert, isLowStockProduct } from "../utils/stockUtils";

const parseDateValue = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "string") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value?.toDate === "function") {
        return value.toDate();
    }
    return null;
};

const formatShortDate = (value) => {
    const date = parseDateValue(value);
    return date ? date.toLocaleDateString("en-BD") : "Unknown";
};

const toDateKey = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const dateFromKey = (key) => {
    if (!key) return null;
    const [year, month, day] = key.split("-").map((val) => parseInt(val, 10));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
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

const weeklyChartPalette = [
    { from: "#34d399", to: "#059669", shadow: "rgba(16, 185, 129, 0.35)" },
    { from: "#60a5fa", to: "#2563eb", shadow: "rgba(37, 99, 235, 0.35)" },
    { from: "#fbbf24", to: "#f97316", shadow: "rgba(249, 115, 22, 0.35)" },
    { from: "#f472b6", to: "#db2777", shadow: "rgba(219, 39, 119, 0.3)" },
    { from: "#a78bfa", to: "#7c3aed", shadow: "rgba(124, 58, 237, 0.35)" },
    { from: "#38bdf8", to: "#0ea5e9", shadow: "rgba(14, 165, 233, 0.35)" },
    { from: "#4ade80", to: "#16a34a", shadow: "rgba(22, 163, 74, 0.35)" },
];

const StockReportPage = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dailySale, setDailySale] = useState(() => ({
        saleDate: toDateKey(new Date()),
        productId: "",
        unit: "",
        quantity: "",
        unitPrice: "",
        sellFertilizerLoose: false,
    }));
    const [savingDailySale, setSavingDailySale] = useState(false);
    const [weeklySales, setWeeklySales] = useState([]);
    const [weeklySalesLoading, setWeeklySalesLoading] = useState(true);

    // Fetch products on mount
    useEffect(() => {
        const cached = getCachedProducts();
        if (cached) {
            setProducts(cached);
            setLoading(false);
        }

        const fetchProducts = async () => {
            try {
                const fetchedProducts = await getAllProducts();
                setProducts(fetchedProducts);
            } catch (error) {
                console.error("Error fetching products:", error);
                toast.error("Failed to load report data");
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const productMap = useMemo(() => {
        const map = new Map();
        products.forEach((product) => map.set(product.id, product));
        return map;
    }, [products]);

    const unitOptions = useMemo(() => {
        const units = new Set();
        products.forEach((product) => {
            if (product.unit) units.add(product.unit);
        });
        return Array.from(units);
    }, [products]);

    const selectedProduct = dailySale.productId ? productMap.get(dailySale.productId) : null;
    const availableStock = selectedProduct ? getStockQty(selectedProduct) : 0;
    const isFertilizerProduct = Boolean(selectedProduct?.isFertilizer) || selectedProduct?.category === "Fertilizer";
    const perKgBuyingPrice = selectedProduct ? Number(selectedProduct.invoicePricePerKg) || 0 : 0;
    const perKgMinSellPrice = selectedProduct ? Number(selectedProduct.minSellPricePerKg) || 0 : 0;
    const canSellFertilizerLoose = isFertilizerProduct && perKgBuyingPrice > 0 && perKgMinSellPrice > 0;
    const sellFertilizerLoose = canSellFertilizerLoose && dailySale.sellFertilizerLoose;
    const baseUnitCost = Number(selectedProduct?.invoicePrice) || 0;
    const unitCost = sellFertilizerLoose ? perKgBuyingPrice : baseUnitCost;
    const minSellPricePerBag = Number(selectedProduct?.minSellPrice ?? selectedProduct?.marketPrice) || 0;
    const minSellPricePerUnit = sellFertilizerLoose ? perKgMinSellPrice : minSellPricePerBag;
    const saleUnitLabel = sellFertilizerLoose ? "Kg" : (dailySale.unit || selectedProduct?.unit || "");
    const saleQuantity = Number(dailySale.quantity) || 0;
    const saleUnitPrice = Number(dailySale.unitPrice) || 0;
    const saleTotal = saleQuantity * saleUnitPrice;
    const remainingStock = availableStock - saleQuantity;

    const loadWeeklySales = async () => {
        const dateKeys = getLastDateKeys(7);
        setWeeklySalesLoading(true);
        try {
            const sales = await getDailySalesByDateRange(dateKeys[0], dateKeys[dateKeys.length - 1]);
            const buckets = new Map(
                dateKeys.map((key) => [key, { dateKey: key, totalAmount: 0, totalQuantity: 0 }])
            );

            sales.forEach((sale) => {
                const key = sale?.dateKey;
                const entry = key ? buckets.get(key) : null;
                if (!entry) return;
                const qty = Number(sale.quantity) || 0;
                const total = Number(sale.total) || (Number(sale.unitPrice) || 0) * qty;
                entry.totalQuantity += qty;
                entry.totalAmount += total;
            });

            setWeeklySales(dateKeys.map((key) => buckets.get(key)));
        } catch (error) {
            console.error("Error loading weekly sales:", error);
            toast.error("Failed to load weekly sales");
            setWeeklySales(dateKeys.map((key) => ({ dateKey: key, totalAmount: 0, totalQuantity: 0 })));
        } finally {
            setWeeklySalesLoading(false);
        }
    };

    useEffect(() => {
        loadWeeklySales();
    }, []);

    // Calculate summary statistics
    const stats = useMemo(() => {
        const totalProducts = products.length;
        const totalInvoiceValue = products.reduce((sum, p) => {
            return sum + (parseFloat(p.invoicePrice) || 0) * (parseInt(p.stockQuantity) || 0);
        }, 0);
        const totalMRPValue = products.reduce((sum, p) => {
            return sum + (parseFloat(p.mrpPrice) || 0) * (parseInt(p.stockQuantity) || 0);
        }, 0);
        const potentialProfit = totalMRPValue - totalInvoiceValue;

        return {
            totalProducts,
            totalInvoiceValue,
            totalMRPValue,
            potentialProfit,
        };
    }, [products]);

    // Get category breakdown
    const categoryBreakdown = useMemo(() => {
        const categories = {};

        products.forEach((product) => {
            const category = product.category || "Other";
            if (!categories[category]) {
                categories[category] = {
                    count: 0,
                    totalStock: 0,
                    totalInvoiceValue: 0,
                };
            }
            categories[category].count += 1;
            categories[category].totalStock += parseInt(product.stockQuantity) || 0;
            categories[category].totalInvoiceValue +=
                (parseFloat(product.invoicePrice) || 0) * (parseInt(product.stockQuantity) || 0);
        });

        return Object.entries(categories)
            .map(([name, data]) => ({
                name,
                ...data,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [products]);

    // Get low stock products
    const lowStockProducts = useMemo(() => {
        return products.filter(isLowStockProduct).sort((a, b) => getStockQty(a) - getStockQty(b));
    }, [products]);

    const salesRows = useMemo(() => {
        return products
            .map((product) => {
                const soldQty = parseInt(product.soldQuantity, 10) || 0;
                const lastSoldPrice = parseFloat(product.lastSoldPrice) || 0;
                const minSellPrice = parseFloat(product.minSellPrice ?? product.marketPrice) || 0;
                return {
                    id: product.id,
                    name: String(product.productName || ""),
                    soldQty,
                    minSellPrice,
                    lastSoldPrice,
                };
            })
            .sort((a, b) => b.soldQty - a.soldQty || a.name.localeCompare(b.name));
    }, [products]);

    const reviewReminders = useMemo(() => {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return products
            .map((product) => ({
                ...product,
                reminderDate: parseDateValue(product.stockReviewReminder),
            }))
            .filter((product) => product.reminderDate && product.reminderDate <= startOfToday)
            .sort((a, b) => a.reminderDate - b.reminderDate);
    }, [products]);

    const weeklyTotalAmount = useMemo(() => {
        return weeklySales.reduce((sum, day) => sum + (day?.totalAmount || 0), 0);
    }, [weeklySales]);

    const weeklyMaxAmount = useMemo(() => {
        if (!weeklySales.length) return 1;
        return Math.max(1, ...weeklySales.map((day) => day?.totalAmount || 0));
    }, [weeklySales]);

    const handleMarkReviewed = async (productId) => {
        // eslint-disable-next-line react-hooks/purity
        const now = Date.now();
        try {
            await updateProduct(productId, { lastStockCheckAt: now, stockReviewReminder: "" });
            setProducts((prev) =>
                prev.map((product) =>
                    product.id === productId
                        ? { ...product, lastStockCheckAt: now, stockReviewReminder: "" }
                        : product
                )
            );
            toast.success("✅ Stock check saved");
        } catch (error) {
            console.error("Error updating stock review:", error);
            toast.error("Could not save stock check");
        }
    };

    const handleDailySaleChange = (field, value) => {
        setDailySale((prev) => {
            const next = { ...prev, [field]: value };
            if (field === "sellFertilizerLoose" && selectedProduct) {
                const perBag = Number(selectedProduct.minSellPrice ?? selectedProduct.marketPrice) || 0;
                const perKg = Number(selectedProduct.minSellPricePerKg) || 0;
                const perUnit = value ? perKg : perBag;
                if (Number.isFinite(perUnit) && perUnit > 0) {
                    next.unitPrice = perUnit.toFixed(2);
                }
                next.unit = value ? "Kg" : (selectedProduct.unit || next.unit);
            }
            return next;
        });
    };

    const handleProductSelect = (productId) => {
        const product = productMap.get(productId);
        const perKgBuy = Number(product?.invoicePricePerKg) || 0;
        const perKgMinSell = Number(product?.minSellPricePerKg) || 0;
        const isFertilizer = (Boolean(product?.isFertilizer) || product?.category === "Fertilizer")
            && perKgBuy > 0
            && perKgMinSell > 0;
        setDailySale((prev) => ({
            ...prev,
            productId,
            unit: isFertilizer ? "Kg" : (product?.unit || ""),
            sellFertilizerLoose: isFertilizer,
        }));
    };

    const handleDailySaleSubmit = async (event) => {
        event.preventDefault();
        if (!dailySale.productId) {
            toast.error("Select a product to sell");
            return;
        }
        if (!dailySale.saleDate) {
            toast.error("Pick a sale date");
            return;
        }
        if (!Number.isFinite(saleQuantity) || saleQuantity <= 0) {
            toast.error("Enter a valid quantity");
            return;
        }
        if (!Number.isFinite(saleUnitPrice) || saleUnitPrice <= 0) {
            toast.error("Enter a valid selling price");
            return;
        }
        if (saleQuantity > availableStock) {
            toast.error("Not enough stock available");
            return;
        }

        setSavingDailySale(true);
        try {
            await recordDailySale({
                productId: dailySale.productId,
                productName: selectedProduct?.productName || "",
                unit: saleUnitLabel,
                quantity: saleQuantity,
                unitPrice: saleUnitPrice,
                unitCost,
                minSellPrice: minSellPricePerUnit,
                dateKey: dailySale.saleDate,
                saleDate: dailySale.saleDate,
            });

            setProducts((prev) =>
                prev.map((product) => {
                    if (product.id !== dailySale.productId) return product;
                    const currentQty = parseInt(product.stockQuantity, 10) || 0;
                    const currentSold = parseInt(product.soldQuantity, 10) || 0;
                    return {
                        ...product,
                        stockQuantity: currentQty - saleQuantity,
                        soldQuantity: currentSold + saleQuantity,
                        lastSoldPrice: saleUnitPrice,
                    };
                })
            );

            toast.success("✅ Daily sale saved and stock updated!");
            setDailySale((prev) => ({
                ...prev,
                quantity: "",
                unitPrice: "",
            }));
            await loadWeeklySales();
        } catch (error) {
            console.error("Error saving daily sale:", error);
            toast.error("❌ Failed to save daily sale");
        } finally {
            setSavingDailySale(false);
        }
    };

    // CSV Export function
    const handleCSVExport = () => {
        const headers = ["Product Name", "Company", "Category", "Pack Size", "MRP", "Purchase", "Min Sell", "Stock Qty", "Unit"];
        const rows = products.map((p) => [
            p.productName,
            p.company,
            p.category,
            p.packSize,
            p.mrpPrice,
            p.invoicePrice,
            p.minSellPrice ?? p.marketPrice,
            p.stockQuantity,
            p.unit,
        ]);

        const csv = [
            headers.join(","),
            ...rows.map((row) =>
                row
                    .map((cell) => `"${cell}"`)
                    .join(",")
            ),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        const today = new Date().toISOString().split("T")[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `stockhere-report-${today}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast.success("✅ CSV downloaded successfully!");
    };

    // PDF export (lazy-loaded to keep initial bundle smaller)
    const handlePDFExport = async () => {
        try {
            const [{ jsPDF }, { default: autoTable }] = await Promise.all([
                import("jspdf"),
                import("jspdf-autotable"),
            ]);
            const doc = new jsPDF();
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            let yPosition = 20;

            doc.setFontSize(24);
            doc.setTextColor(45, 106, 79);
            doc.text("STOCKHERE INVENTORY REPORT", pageWidth / 2, yPosition, { align: "center" });
            yPosition += 15;

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            const reportDate = new Date().toLocaleDateString("en-BD");
            doc.text(`Report Generated: ${reportDate}`, pageWidth / 2, yPosition, { align: "center" });
            yPosition += 12;

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text("SUMMARY STATISTICS", 15, yPosition);
            yPosition += 8;

            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            doc.text(`Total Products: ${stats.totalProducts}`, 20, yPosition);
            yPosition += 6;
            doc.text(`Total Purchase Value: ৳ ${stats.totalInvoiceValue.toLocaleString("en-BD")}`, 20, yPosition);
            yPosition += 6;
            doc.text(`Total MRP Value: ৳ ${stats.totalMRPValue.toLocaleString("en-BD")}`, 20, yPosition);
            yPosition += 6;
            doc.text(`Potential Profit: ৳ ${stats.potentialProfit.toLocaleString("en-BD")}`, 20, yPosition);
            yPosition += 12;

            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text("PRODUCT INVENTORY", 15, yPosition);
            yPosition += 8;

            const tableHeaders = ["Name", "Company", "Category", "Stock", "Unit", "Purchase", "Min Sell"];
            const tableData = products.map((p) => [
                String(p.productName).substring(0, 18),
                String(p.company).substring(0, 14),
                String(p.category).substring(0, 12),
                String(p.stockQuantity),
                String(p.unit),
                `৳${parseFloat(p.invoicePrice || 0).toFixed(0)}`,
                `৳${parseFloat(p.minSellPrice ?? p.marketPrice ?? 0).toFixed(0)}`,
            ]);

            autoTable(doc, {
                head: [tableHeaders],
                body: tableData,
                startY: yPosition,
                headStyles: { fillColor: [45, 106, 79], textColor: 255, fontSize: 9 },
                bodyStyles: { textColor: 0, fontSize: 8 },
                alternateRowStyles: { fillColor: [245, 240, 232] },
                margin: 15,
                didDrawPage: (data) => {
                    doc.setFontSize(8);
                    doc.setTextColor(150);
                    doc.text(
                        `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
                        pageWidth / 2,
                        pageHeight - 10,
                        { align: "center" }
                    );
                },
            });

            const fileStamp = new Date().toISOString().split("T")[0];
            doc.save(`stockhere-invoice-${fileStamp}.pdf`);
            toast.success("✅ PDF invoice downloaded successfully!");
        } catch (err) {
            console.error("PDF export failed:", err);
            toast.error("Could not create PDF. Try again.");
        }
    };

    // Loading state
    if (loading && products.length === 0) {
        return (
            <div style={{
                paddingBottom: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                    <div style={{
                        animation: 'spin 1s linear infinite',
                        borderRadius: '50%',
                        height: '64px',
                        width: '64px',
                        borderBottom: '4px solid #2D6A4F',
                    }}></div>
                    <p style={{
                        marginTop: '16px',
                        color: '#2D6A4F',
                        fontFamily: 'Nunito, sans-serif',
                        fontSize: '18px',
                    }}>
                        Loading report...
                    </p>
                </div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: '80px' }}>
            {/* Page Title and Subtitle */}
            <div style={{ marginBottom: '32px' }}>
                <h1 className="text-[clamp(1.5rem,5vw,2.25rem)] leading-tight" style={{
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '8px',
                }}>
                    📊 Stock Report
                </h1>
                <p style={{
                    color: '#666',
                    fontFamily: 'Nunito, sans-serif',
                }}>
                    Overview of your pesticide inventory
                </p>
            </div>

            {/* SECTION 1: Summary Statistics */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                gap: '16px',
                marginBottom: '32px',
            }}>
                {/* Total Products Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '24px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div>
                            <p style={{
                                fontSize: '14px',
                                color: '#666',
                                fontFamily: 'Nunito, sans-serif',
                                marginBottom: '4px',
                            }}>
                                Total Products
                            </p>
                            <p style={{
                                fontSize: '32px',
                                fontWeight: 'bold',
                                color: '#2D6A4F',
                                fontFamily: 'Nunito, sans-serif',
                            }}>
                                {stats.totalProducts}
                            </p>
                        </div>
                        <span style={{ fontSize: '40px' }}>📦</span>
                    </div>
                </div>

                {/* Total Purchase Value Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '24px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div>
                            <p style={{
                                fontSize: '14px',
                                color: '#666',
                                fontFamily: 'Nunito, sans-serif',
                                marginBottom: '4px',
                            }}>
                                Total Purchase Value
                            </p>
                            <p style={{
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: '#2563eb',
                                fontFamily: 'monospace',
                                wordBreak: 'break-word',
                            }}>
                                {formatTaka(stats.totalInvoiceValue)}
                            </p>
                        </div>
                        <span style={{ fontSize: '40px' }}>🧾</span>
                    </div>
                </div>

                {/* Total MRP Value Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '24px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div>
                            <p style={{
                                fontSize: '14px',
                                color: '#666',
                                fontFamily: 'Nunito, sans-serif',
                                marginBottom: '4px',
                            }}>
                                Total MRP Value
                            </p>
                            <p style={{
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: '#dc2626',
                                fontFamily: 'monospace',
                                wordBreak: 'break-word',
                            }}>
                                {formatTaka(stats.totalMRPValue)}
                            </p>
                        </div>
                        <span style={{ fontSize: '40px' }}>🏷️</span>
                    </div>
                </div>

                {/* Potential Profit Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '24px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <div>
                            <p style={{
                                fontSize: '14px',
                                color: '#666',
                                fontFamily: 'Nunito, sans-serif',
                                marginBottom: '4px',
                            }}>
                                Potential Profit
                            </p>
                            <p style={{
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: '#2D6A4F',
                                fontFamily: 'monospace',
                                wordBreak: 'break-word',
                            }}>
                                {formatTaka(stats.potentialProfit)}
                            </p>
                        </div>
                        <span style={{ fontSize: '40px' }}>💰</span>
                    </div>
                </div>
            </div>

            {/* SECTION 2: Daily Sales Update */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{
                    fontSize: '24px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '16px',
                }}>
                    Daily Sales Update
                </h2>

                <div
                    className="overflow-x-auto"
                    style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '20px',
                    }}
                >
                    <form onSubmit={handleDailySaleSubmit}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                            gap: '14px',
                        }}>
                            <div>
                                <label className="form-label-agri" htmlFor="saleDate">Sale Date</label>
                                <input
                                    id="saleDate"
                                    type="date"
                                    className="form-field-agri"
                                    value={dailySale.saleDate}
                                    onChange={(e) => handleDailySaleChange("saleDate", e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="form-label-agri" htmlFor="saleProduct">Select Product</label>
                                <select
                                    id="saleProduct"
                                    className="form-field-agri"
                                    value={dailySale.productId}
                                    onChange={(e) => handleProductSelect(e.target.value)}
                                    required
                                >
                                    <option value="">Select product</option>
                                    {products.map((product) => (
                                        <option key={product.id} value={product.id}>
                                            {product.productName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="form-label-agri" htmlFor="saleUnit">Stock Unit</label>
                                <input
                                    id="saleUnit"
                                    list="sale-unit-options"
                                    className="form-field-agri"
                                    placeholder="e.g. pcs, bottle"
                                    value={sellFertilizerLoose ? "Kg" : dailySale.unit}
                                    onChange={(e) => handleDailySaleChange("unit", e.target.value)}
                                    disabled={sellFertilizerLoose}
                                />
                                <datalist id="sale-unit-options">
                                    {unitOptions.map((unit) => (
                                        <option key={unit} value={unit} />
                                    ))}
                                </datalist>
                            </div>

                            {isFertilizerProduct && (
                                <div>
                                    <label className="form-label-agri">Fertilizer sale</label>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={dailySale.sellFertilizerLoose}
                                            onChange={(e) => handleDailySaleChange("sellFertilizerLoose", e.target.checked)}
                                            className="h-4 w-4 accent-agriGreen"
                                            disabled={!canSellFertilizerLoose}
                                        />
                                        Sell by kg (use per kg prices)
                                    </label>
                                    {!canSellFertilizerLoose && (
                                        <p className="mt-1 text-xs text-agriRed">
                                            Set per kg buying and minimum sell prices in the product to enable per kg sale.
                                        </p>
                                    )}
                                    {canSellFertilizerLoose && (
                                        <p className="mt-1 text-xs text-gray-600">
                                            Per kg buy: {formatTaka(perKgBuyingPrice)} · Per kg min sell: {formatTaka(perKgMinSellPrice)}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="form-label-agri" htmlFor="saleQty">Quantity Sold</label>
                                <input
                                    id="saleQty"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-field-agri"
                                    placeholder="0"
                                    value={dailySale.quantity}
                                    onChange={(e) => handleDailySaleChange("quantity", e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="form-label-agri" htmlFor="salePrice">Selling Price</label>
                                <input
                                    id="salePrice"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-field-agri"
                                    placeholder="0"
                                    value={dailySale.unitPrice}
                                    onChange={(e) => handleDailySaleChange("unitPrice", e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="form-label-agri" htmlFor="saleTotal">Total</label>
                                <input
                                    id="saleTotal"
                                    className="form-field-agri"
                                    value={formatTaka(saleTotal)}
                                    placeholder="0"
                                    readOnly
                                />
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            marginTop: '16px',
                        }}>
                            <p style={{
                                fontFamily: 'Nunito, sans-serif',
                                color: '#374151',
                                fontSize: '14px',
                            }}>
                                Available stock: <strong>{availableStock}</strong>{" "}
                                {saleUnitLabel ? ` ${saleUnitLabel}` : ""}
                                {Number.isFinite(remainingStock) && (
                                    <> · Remaining after sale: <strong>{Math.max(remainingStock, 0)}</strong></>
                                )}
                            </p>
                            <button
                                type="submit"
                                disabled={savingDailySale}
                                style={{
                                    backgroundColor: savingDailySale ? '#94a3b8' : '#2D6A4F',
                                    color: 'white',
                                    paddingLeft: '20px',
                                    paddingRight: '20px',
                                    paddingTop: '10px',
                                    paddingBottom: '10px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: savingDailySale ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {savingDailySale ? 'Saving...' : 'Save Daily Sale'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* SECTION 3: Weekly Sales Bar Chart */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '16px',
                }}>
                    <h2 style={{
                        fontSize: '24px',
                        fontFamily: 'Merriweather, serif',
                        fontWeight: 'bold',
                        color: '#1B4332',
                    }}>
                        7-Day Sales Summary
                    </h2>
                    <p style={{
                        fontFamily: 'Nunito, sans-serif',
                        color: '#1B4332',
                        fontWeight: '600',
                    }}>
                        Total: {formatTaka(weeklyTotalAmount)}
                    </p>
                </div>

                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '20px',
                }}>
                    {weeklySalesLoading ? (
                        <p style={{
                            fontFamily: 'Nunito, sans-serif',
                            color: '#6b7280',
                        }}>
                            Loading weekly sales...
                        </p>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, minmax(40px, 1fr))',
                            gap: '8px',
                            alignItems: 'end',
                            height: '170px',
                            paddingTop: '8px',
                        }}>
                            {weeklySales.map((day, index) => {
                                const heightPercent = weeklyMaxAmount
                                    ? Math.round((day.totalAmount / weeklyMaxAmount) * 100)
                                    : 0;
                                const barHeight = day.totalAmount > 0 ? Math.max(10, heightPercent) : 4;
                                const date = dateFromKey(day.dateKey);
                                const weekLabel = date
                                    ? date.toLocaleDateString('en-BD', { weekday: 'short' })
                                    : day.dateKey;
                                const dateLabel = date
                                    ? date.toLocaleDateString('en-BD', { day: '2-digit', month: 'short' })
                                    : day.dateKey;
                                const palette = weeklyChartPalette[index % weeklyChartPalette.length];
                                const barStyle = day.totalAmount > 0
                                    ? {
                                        backgroundImage: `linear-gradient(180deg, ${palette.from}, ${palette.to})`,
                                        boxShadow: `0 10px 18px ${palette.shadow}`,
                                    }
                                    : { backgroundColor: '#e5e7eb' };

                                return (
                                    <div
                                        key={day.dateKey}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '6px',
                                            height: '100%',
                                        }}
                                    >
                                        <div
                                            title={`${formatTaka(day.totalAmount)} · ${day.totalQuantity} units`}
                                            style={{
                                                width: '100%',
                                                height: `${barHeight}%`,
                                                maxHeight: '100%',
                                                borderRadius: '8px 8px 4px 4px',
                                                transition: 'height 0.3s ease',
                                                ...barStyle,
                                            }}
                                        ></div>
                                        <div style={{
                                            fontFamily: 'Nunito, sans-serif',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: '#1B4332',
                                        }}>
                                            {weekLabel}
                                        </div>
                                        <div style={{
                                            fontFamily: 'Nunito, sans-serif',
                                            fontSize: '11px',
                                            color: '#6b7280',
                                            textAlign: 'center',
                                        }}>
                                            {dateLabel}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 4: Category Breakdown Table */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{
                    fontSize: '24px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '16px',
                }}>
                    📂 Category Breakdown
                </h2>

                <div style={{
                    overflowX: 'auto',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                    }}>
                        <thead>
                            <tr style={{
                                backgroundColor: '#2D6A4F',
                                color: 'white',
                            }}>
                                <th style={{
                                    border: '2px solid #2D6A4F',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    textAlign: 'left',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: 'bold',
                                }}>
                                    Category
                                </th>
                                <th style={{
                                    border: '2px solid #2D6A4F',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    textAlign: 'left',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: 'bold',
                                }}>
                                    Products
                                </th>
                                <th style={{
                                    border: '2px solid #2D6A4F',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    textAlign: 'left',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: 'bold',
                                }}>
                                    Total Stock Units
                                </th>
                                <th style={{
                                    border: '2px solid #2D6A4F',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    textAlign: 'left',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: 'bold',
                                }}>
                                    Total Invoice Value
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {categoryBreakdown.map((category, index) => (
                                <tr
                                    key={category.name}
                                    style={{
                                        border: '2px solid #e5e7eb',
                                        backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                                    }}
                                >
                                    <td style={{
                                        paddingLeft: '16px',
                                        paddingRight: '16px',
                                        paddingTop: '12px',
                                        paddingBottom: '12px',
                                        fontFamily: 'Nunito, sans-serif',
                                        fontWeight: '600',
                                        color: '#1B4332',
                                    }}>
                                        {category.name}
                                    </td>
                                    <td style={{
                                        paddingLeft: '16px',
                                        paddingRight: '16px',
                                        paddingTop: '12px',
                                        paddingBottom: '12px',
                                        fontFamily: 'Nunito, sans-serif',
                                        color: '#666',
                                    }}>
                                        {category.count}
                                    </td>
                                    <td style={{
                                        paddingLeft: '16px',
                                        paddingRight: '16px',
                                        paddingTop: '12px',
                                        paddingBottom: '12px',
                                        fontFamily: 'Nunito, sans-serif',
                                        color: '#666',
                                    }}>
                                        {category.totalStock}
                                    </td>
                                    <td style={{
                                        paddingLeft: '16px',
                                        paddingRight: '16px',
                                        paddingTop: '12px',
                                        paddingBottom: '12px',
                                        fontFamily: 'monospace',
                                        fontWeight: '600',
                                        color: '#1B4332',
                                    }}>
                                        {formatTaka(category.totalInvoiceValue)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION 5: Sales Snapshot */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{
                    fontSize: '24px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '16px',
                }}>
                    Sales Snapshot
                </h2>

                <div style={{
                    overflowX: 'auto',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                    }}>
                        <thead>
                            <tr style={{
                                backgroundColor: '#1B4332',
                                color: 'white',
                            }}>
                                <th style={{
                                    border: '2px solid #1B4332',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    textAlign: 'left',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: 'bold',
                                }}>
                                    Product
                                </th>
                                <th style={{
                                    border: '2px solid #1B4332',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    textAlign: 'left',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: 'bold',
                                }}>
                                    Sold Units
                                </th>
                                <th style={{
                                    border: '2px solid #1B4332',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    textAlign: 'left',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: 'bold',
                                }}>
                                    Minimum Sell Price
                                </th>
                                <th style={{
                                    border: '2px solid #1B4332',
                                    paddingLeft: '16px',
                                    paddingRight: '16px',
                                    paddingTop: '12px',
                                    paddingBottom: '12px',
                                    textAlign: 'left',
                                    fontFamily: 'Nunito, sans-serif',
                                    fontWeight: 'bold',
                                }}>
                                    Last Sold Price
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {salesRows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={4}
                                        style={{
                                            padding: '16px',
                                            fontFamily: 'Nunito, sans-serif',
                                            color: '#6b7280',
                                        }}
                                    >
                                        No sales data yet.
                                    </td>
                                </tr>
                            ) : (
                                salesRows.map((row, index) => (
                                    <tr
                                        key={row.id}
                                        style={{
                                            border: '2px solid #e5e7eb',
                                            backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                                        }}
                                    >
                                        <td style={{
                                            paddingLeft: '16px',
                                            paddingRight: '16px',
                                            paddingTop: '12px',
                                            paddingBottom: '12px',
                                            fontFamily: 'Nunito, sans-serif',
                                            fontWeight: '600',
                                            color: '#1B4332',
                                        }}>
                                            {row.name}
                                        </td>
                                        <td style={{
                                            paddingLeft: '16px',
                                            paddingRight: '16px',
                                            paddingTop: '12px',
                                            paddingBottom: '12px',
                                            fontFamily: 'Nunito, sans-serif',
                                            color: '#374151',
                                        }}>
                                            {row.soldQty}
                                        </td>
                                        <td style={{
                                            paddingLeft: '16px',
                                            paddingRight: '16px',
                                            paddingTop: '12px',
                                            paddingBottom: '12px',
                                            fontFamily: 'monospace',
                                            fontWeight: '600',
                                            color: '#1B4332',
                                        }}>
                                            {formatTaka(row.minSellPrice)}
                                        </td>
                                        <td style={{
                                            paddingLeft: '16px',
                                            paddingRight: '16px',
                                            paddingTop: '12px',
                                            paddingBottom: '12px',
                                            fontFamily: 'monospace',
                                            fontWeight: '600',
                                            color: '#2563eb',
                                        }}>
                                            {row.lastSoldPrice ? formatTaka(row.lastSoldPrice) : "-"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION 6: Stock Review Reminders */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{
                    fontSize: '24px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '16px',
                }}>
                    Stock Review Reminders
                </h2>

                {reviewReminders.length === 0 ? (
                    <div style={{
                        backgroundColor: '#ecfdf5',
                        border: '2px solid #10b981',
                        borderRadius: '12px',
                        padding: '24px',
                        textAlign: 'center',
                    }}>
                        <p style={{
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: '600',
                            fontSize: '16px',
                        }}>
                            No stock review reminders due today.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {reviewReminders.map((product) => (
                            <div
                                key={product.id}
                                style={{
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                    padding: '16px',
                                    borderLeft: '4px solid #0ea5e9',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <div>
                                    <h4 style={{
                                        fontFamily: 'Nunito, sans-serif',
                                        fontWeight: 'bold',
                                        color: '#1B4332',
                                        fontSize: '16px',
                                        marginBottom: '4px',
                                    }}>
                                        {product.productName}
                                    </h4>
                                    <p style={{
                                        fontSize: '13px',
                                        color: '#6b7280',
                                        fontFamily: 'Nunito, sans-serif',
                                    }}>
                                        Reminder: <span style={{ fontWeight: 600 }}>{formatShortDate(product.reminderDate)}</span>
                                        {" "}· Last checked:{" "}
                                        <span style={{ fontWeight: 600 }}>
                                            {product.lastStockCheckAt ? formatShortDate(product.lastStockCheckAt) : "Not yet"}
                                        </span>
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleMarkReviewed(product.id)}
                                    style={{
                                        backgroundColor: '#0ea5e9',
                                        color: 'white',
                                        paddingLeft: '14px',
                                        paddingRight: '14px',
                                        paddingTop: '8px',
                                        paddingBottom: '8px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontFamily: 'Nunito, sans-serif',
                                        fontWeight: '600',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Mark Checked
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SECTION 7: Low Stock Alert List */}
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{
                    fontSize: '24px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#C0392B',
                    marginBottom: '16px',
                }}>
                    ⚠️ Low Stock Products
                </h2>

                {lowStockProducts.length === 0 ? (
                    <div style={{
                        backgroundColor: '#dcfce7',
                        border: '2px solid #22c55e',
                        borderRadius: '12px',
                        padding: '24px',
                        textAlign: 'center',
                    }}>
                        <p style={{
                            color: '#166534',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: '600',
                            fontSize: '18px',
                        }}>
                            ✅ All products are well stocked!
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {lowStockProducts.map((product) => {
                            const alertQty = Math.max(1, getLowStockAlert(product) || 1);
                            const percentage = (getStockQty(product) / alertQty) * 100;

                            return (
                                <div
                                    key={product.id}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        padding: '16px',
                                        borderLeft: '4px solid #ef5350',
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        gap: '16px',
                                        marginBottom: '12px',
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{
                                                fontFamily: 'Nunito, sans-serif',
                                                fontWeight: 'bold',
                                                color: '#1B4332',
                                                fontSize: '18px',
                                                marginBottom: '4px',
                                            }}>
                                                {product.productName}
                                            </h4>
                                            <p style={{
                                                fontSize: '14px',
                                                color: '#666',
                                                fontFamily: 'Nunito, sans-serif',
                                            }}>
                                                Current: <span style={{ fontWeight: '600' }}>{getStockQty(product)}</span> | Alert:{" "}
                                                <span style={{ fontWeight: '600' }}>{getLowStockAlert(product)}</span>
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/edit/${product.id}`)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                backgroundColor: '#2D6A4F',
                                                color: 'white',
                                                paddingLeft: '16px',
                                                paddingRight: '16px',
                                                paddingTop: '8px',
                                                paddingBottom: '8px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                fontFamily: 'Nunito, sans-serif',
                                                fontWeight: '600',
                                                fontSize: '14px',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                whiteSpace: 'nowrap',
                                            }}
                                            onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                                            onMouseLeave={(e) => e.target.style.opacity = '1'}
                                        >
                                            Update Stock
                                            <FiArrowRight size={16} />
                                        </button>
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{
                                        width: '100%',
                                        backgroundColor: '#e5e7eb',
                                        borderRadius: '9999px',
                                        height: '8px',
                                        overflow: 'hidden',
                                    }}>
                                        <div
                                            style={{
                                                height: '100%',
                                                transition: 'all 0.3s ease',
                                                backgroundColor: percentage > 50
                                                    ? '#eab308'
                                                    : percentage > 25
                                                        ? '#f97316'
                                                        : '#ef4444',
                                                width: `${Math.min(percentage, 100)}%`,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Export Buttons */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
                <button
                    type="button"
                    onClick={handleCSVExport}
                    className="w-full min-h-12 sm:w-auto sm:min-w-[10rem]"
                    style={{
                        backgroundColor: '#2563eb',
                        color: 'white',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        paddingLeft: '32px',
                        paddingRight: '32px',
                        borderRadius: '8px',
                        border: 'none',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        minHeight: '48px',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
                >
                    ⬇️ Download CSV
                </button>

                <button
                    type="button"
                    onClick={handlePDFExport}
                    className="w-full min-h-12 sm:w-auto sm:min-w-[10rem]"
                    style={{
                        backgroundColor: '#dc2626',
                        color: 'white',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        paddingLeft: '32px',
                        paddingRight: '32px',
                        borderRadius: '8px',
                        border: 'none',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        minHeight: '48px',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#b91c1c'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#dc2626'}
                >
                    📄 Download PDF Invoice
                </button>

                <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full min-h-12 sm:w-auto sm:min-w-[10rem]"
                    style={{
                        backgroundColor: '#2D6A4F',
                        color: 'white',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: 'bold',
                        fontSize: '16px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        paddingLeft: '32px',
                        paddingRight: '32px',
                        borderRadius: '8px',
                        border: 'none',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        minHeight: '48px',
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#1B4332'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#2D6A4F'}
                >
                    🖨️ Print Report
                </button>
            </div>

            {/* Print Styles */}
            <style>{`
        @media print {
          nav, .fixed {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
        </div >
    );
};

export default StockReportPage;
