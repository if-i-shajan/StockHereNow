import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiPlus, FiSave, FiTrash2 } from "react-icons/fi";
import {
    addCustomer,
    createInvoice,
    getAllCustomers,
    getAllProducts,
    getCachedProducts,
    getInvoiceHeaderSettings,
    saveInvoiceHeaderSettings,
} from "../firebase/firestoreService";
import { formatTaka } from "../utils/formatCurrency";
import { safeFloat, safeInt } from "../utils/parseNumbers";
import { getStockQty } from "../utils/stockUtils";

const DEFAULT_HEADER = {
    companyName: "StockHere",
    tagline: "Agricultural Supplies Invoice",
    address: "",
    phone: "",
    logoUrl: "",
};

const DEFAULT_CUSTOMER = {
    name: "",
    phone: "",
    address: "",
};

const DEFAULT_PAYMENT = {
    method: "Cash",
    paid: "",
    discount: "",
    tax: "",
};

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const buildCustomerKey = (customer) => {
    const name = normalizeText(customer?.name);
    const phone = normalizeText(customer?.phone);
    const address = normalizeText(customer?.address);
    if (!name && !phone && !address) return "";
    return `${name}|${phone}|${address}`;
};

const CUSTOMER_INVOICE_DRAFT_KEY = "stockhere_invoice_customer_draft";

const createInvoiceNumber = () => {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timePart = [now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds()]
        .map((value) => String(value).padStart(2, "0"))
        .join("");
    const randomPart = (() => {
        if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
            const bytes = new Uint8Array(4);
            crypto.getRandomValues(bytes);
            return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        }

        return Math.random().toString(16).slice(2, 10);
    })();

    return `INV-${stamp}-${timePart}-${randomPart}`;
};

const createLineItem = () => ({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: "",
    productName: "",
    unit: "",
    quantity: "",
    unitPrice: "",
});

const formatMoney = (amount) => formatTaka(Number(amount || 0));

const InvoicesPage = () => {
    const [products, setProducts] = useState([]);
    const [header, setHeader] = useState(DEFAULT_HEADER);
    const [customer, setCustomer] = useState(DEFAULT_CUSTOMER);
    const [customers, setCustomers] = useState([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [customerMode, setCustomerMode] = useState("existing");
    const [selectedCustomerKey, setSelectedCustomerKey] = useState("");
    const [pendingCustomerDraft, setPendingCustomerDraft] = useState(null);
    const [payment, setPayment] = useState(DEFAULT_PAYMENT);
    const [notes, setNotes] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [invoiceNumber, setInvoiceNumber] = useState(() => createInvoiceNumber());
    const [items, setItems] = useState([createLineItem()]);
    const [quickItem, setQuickItem] = useState({
        productId: "",
        quantity: "",
        unitPrice: "",
    });
    const [saving, setSaving] = useState(false);
    const [savingHeader, setSavingHeader] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(true);

    useEffect(() => {
        const cached = getCachedProducts();
        if (cached) {
            setProducts(cached);
            setLoadingProducts(false);
        }

        const fetchProducts = async () => {
            try {
                const data = await getAllProducts();
                setProducts(data);
            } catch (error) {
                console.error("Error loading products:", error);
                toast.error("Failed to load products");
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchProducts();
    }, []);

    useEffect(() => {
        const fetchCustomers = async () => {
            setLoadingCustomers(true);
            try {
                const data = await getAllCustomers();
                setCustomers(data);
            } catch (error) {
                console.error("Error loading customers:", error);
                toast.error("Failed to load customers");
            } finally {
                setLoadingCustomers(false);
            }
        };

        fetchCustomers();
    }, []);

    useEffect(() => {
        const loadHeader = async () => {
            try {
                const stored = await getInvoiceHeaderSettings();
                if (stored) {
                    setHeader((prev) => ({ ...prev, ...stored }));
                }
            } catch (error) {
                console.error("Error loading invoice header:", error);
            }
        };

        loadHeader();
    }, []);

    useEffect(() => {
        try {
            const raw = window.sessionStorage.getItem(CUSTOMER_INVOICE_DRAFT_KEY);
            if (!raw) return;
            window.sessionStorage.removeItem(CUSTOMER_INVOICE_DRAFT_KEY);
            const parsed = JSON.parse(raw);
            if (parsed?.customer) {
                setPendingCustomerDraft(parsed.customer);
            }
        } catch (error) {
            console.error("Error loading invoice draft:", error);
        }
    }, []);

    const productMap = useMemo(() => {
        const map = new Map();
        products.forEach((product) => map.set(product.id, product));
        return map;
    }, [products]);

    const customerOptions = useMemo(() => {
        const map = new Map();
        customers.forEach((entry) => {
            const key = entry.customerKey || buildCustomerKey(entry);
            if (!key || map.has(key)) return;
            map.set(key, {
                key,
                id: entry.id,
                name: entry.name || "",
                phone: entry.phone || "",
                address: entry.address || "",
            });
        });
        return Array.from(map.values());
    }, [customers]);

    const customerMap = useMemo(() => {
        const map = new Map();
        customerOptions.forEach((entry) => map.set(entry.key, entry));
        return map;
    }, [customerOptions]);

    const selectedCustomer = customerMode === "existing" ? customerMap.get(selectedCustomerKey) : null;

    const quickProduct = quickItem.productId ? productMap.get(quickItem.productId) : null;
    const quickStock = quickProduct ? getStockQty(quickProduct) : 0;
    const quickUnitCost = quickProduct ? safeFloat(quickProduct.invoicePrice) : 0;
    const quickMinSell = quickProduct
        ? safeFloat(quickProduct.minSellPrice ?? quickProduct.marketPrice)
        : 0;
    const quickQuantity = safeInt(quickItem.quantity);
    const quickUnitPrice = safeFloat(quickItem.unitPrice);
    const quickTotal = quickQuantity * quickUnitPrice;
    const quickProfit = (quickUnitPrice - quickUnitCost) * quickQuantity;

    useEffect(() => {
        if (!quickProduct) return;
        const nextPrice = quickProduct.minSellPrice ?? quickProduct.marketPrice ?? "";
        setQuickItem((prev) => ({ ...prev, unitPrice: nextPrice }));
    }, [quickItem.productId, quickProduct]);

    useEffect(() => {
        if (!pendingCustomerDraft) return;
        const draftKey = buildCustomerKey(pendingCustomerDraft);
        const match = draftKey ? customerMap.get(draftKey) : null;
        if (match) {
            setCustomerMode("existing");
            setSelectedCustomerKey(match.key);
            setCustomer(DEFAULT_CUSTOMER);
        } else {
            setCustomerMode("new");
            setSelectedCustomerKey("");
            setCustomer({
                name: pendingCustomerDraft.name || "",
                phone: pendingCustomerDraft.phone || "",
                address: pendingCustomerDraft.address || "",
            });
        }
        setPendingCustomerDraft(null);
    }, [pendingCustomerDraft, customerMap]);

    useEffect(() => {
        if (loadingCustomers) return;
        if (customerOptions.length === 0) {
            setCustomerMode("new");
            setSelectedCustomerKey("");
            return;
        }
        if (customerMode === "existing" && !selectedCustomerKey) {
            setSelectedCustomerKey(customerOptions[0].key);
        }
    }, [loadingCustomers, customerOptions, customerMode, selectedCustomerKey]);

    const lineItems = useMemo(() => {
        return items.map((item) => {
            const quantity = safeInt(item.quantity);
            const unitPrice = safeFloat(item.unitPrice);
            return {
                ...item,
                quantity,
                unitPrice,
                lineTotal: quantity * unitPrice,
            };
        });
    }, [items]);

    const subTotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.lineTotal, 0), [lineItems]);
    const discount = safeFloat(payment.discount);
    const tax = safeFloat(payment.tax);
    const total = Math.max(0, subTotal - discount + tax);
    const paidAmount = safeFloat(payment.paid);
    const dueAmount = Math.max(0, total - paidAmount);
    const status = dueAmount === 0 ? "Paid" : paidAmount > 0 ? "Partially Paid" : "Unpaid";

    const handleHeaderChange = (field, value) => {
        setHeader((prev) => ({ ...prev, [field]: value }));
    };

    const handleCustomerChange = (field, value) => {
        setCustomer((prev) => ({ ...prev, [field]: value }));
    };

    const handleCustomerModeChange = (mode) => {
        setCustomerMode(mode);
        if (mode === "new") {
            setSelectedCustomerKey("");
            setCustomer(DEFAULT_CUSTOMER);
            return;
        }
        if (customerOptions.length > 0) {
            setSelectedCustomerKey((prev) => prev || customerOptions[0].key);
        }
    };

    const handlePaymentChange = (field, value) => {
        setPayment((prev) => ({ ...prev, [field]: value }));
    };

    const handleItemChange = (id, field, value) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    const handleProductSelect = (id, productId) => {
        const product = productMap.get(productId);
        setItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                if (!product) {
                    return { ...item, productId, productName: "", unit: "", unitPrice: "" };
                }
                return {
                    ...item,
                    productId,
                    productName: product.productName || "",
                    unit: product.unit || "",
                    unitPrice: product.minSellPrice ?? product.marketPrice ?? "",
                };
            })
        );
    };

    const addItemRow = () => {
        setItems((prev) => [...prev, createLineItem()]);
    };

    const removeItemRow = (id) => {
        setItems((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));
    };

    const handleQuickItemChange = (field, value) => {
        setQuickItem((prev) => ({ ...prev, [field]: value }));
    };

    const addQuickItem = () => {
        if (!quickItem.productId) {
            toast.error("Select a product for wholesale");
            return;
        }
        if (quickQuantity <= 0) {
            toast.error("Enter a valid quantity");
            return;
        }
        if (quickUnitPrice <= 0) {
            toast.error("Enter a valid unit price");
            return;
        }
        if (quickQuantity > quickStock) {
            toast.error("Not enough stock available");
            return;
        }

        const payload = {
            productId: quickItem.productId,
            productName: quickProduct?.productName || "",
            unit: quickProduct?.unit || "",
            quantity: String(quickQuantity),
            unitPrice: String(quickUnitPrice),
        };

        setItems((prev) => {
            const emptyIndex = prev.findIndex((item) => !item.productId);
            if (emptyIndex === -1) {
                return [...prev, { ...createLineItem(), ...payload }];
            }
            return prev.map((item, index) => (index === emptyIndex ? { ...item, ...payload } : item));
        });

        setQuickItem({ productId: "", quantity: "", unitPrice: "" });
    };

    const getCustomerDraft = () => {
        if (customerMode === "existing") {
            if (!selectedCustomer) return { ...DEFAULT_CUSTOMER };
            return {
                name: selectedCustomer.name,
                phone: selectedCustomer.phone,
                address: selectedCustomer.address,
                customerKey: selectedCustomer.key,
            };
        }

        const customerKey = buildCustomerKey(customer);
        return { ...customer, customerKey };
    };

    const validateInvoice = (draftCustomer) => {
        if (customerMode === "existing" && !selectedCustomerKey) {
            toast.error("Select a customer.");
            return false;
        }
        if (!draftCustomer.name || !draftCustomer.phone || !draftCustomer.address) {
            toast.error("Customer name, phone, and address are required.");
            return false;
        }

        const validItems = lineItems.filter((item) => item.productId && item.quantity > 0);
        if (validItems.length === 0) {
            toast.error("Add at least one product with quantity.");
            return false;
        }

        for (const item of validItems) {
            const product = productMap.get(item.productId);
            const stock = product ? getStockQty(product) : 0;
            if (item.quantity > stock) {
                toast.error(`Not enough stock for ${item.productName || "selected item"}.`);
                return false;
            }
        }

        if (total <= 0) {
            toast.error("Invoice total must be greater than 0.");
            return false;
        }

        return true;
    };

    const buildInvoicePayload = (draftCustomer) => {
        const normalizedItems = lineItems
            .filter((item) => item.productId && item.quantity > 0)
            .map((item) => ({
                productId: item.productId,
                productName: item.productName,
                unit: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
            }));

        return {
            invoiceNumber,
            invoiceDate,
            header: { ...header },
            customer: { ...draftCustomer },
            payment: {
                method: payment.method,
                paid: paidAmount,
                discount,
                tax,
                status,
            },
            totals: {
                subTotal,
                discount,
                tax,
                total,
                paid: paidAmount,
                due: dueAmount,
            },
            items: normalizedItems,
            notes,
        };
    };

    const handleSaveHeader = async () => {
        setSavingHeader(true);
        try {
            await saveInvoiceHeaderSettings(header);
            toast.success("✅ Header saved!");
        } catch (error) {
            console.error("Error saving header:", error);
            toast.error("❌ Failed to save header");
        } finally {
            setSavingHeader(false);
        }
    };

    const resetInvoice = () => {
        const hasCustomers = customerOptions.length > 0;
        setCustomer(DEFAULT_CUSTOMER);
        setCustomerMode(hasCustomers ? "existing" : "new");
        setSelectedCustomerKey(hasCustomers ? customerOptions[0].key : "");
        setPayment(DEFAULT_PAYMENT);
        setNotes("");
        setItems([createLineItem()]);
        setInvoiceNumber(createInvoiceNumber());
        setInvoiceDate(new Date().toISOString().slice(0, 10));
    };

    const resolveCustomerForInvoice = async (draftCustomer) => {
        if (customerMode === "existing") return draftCustomer;
        const customerKey = draftCustomer.customerKey || buildCustomerKey(draftCustomer);
        if (!customerKey) return draftCustomer;
        const existing = customerMap.get(customerKey);
        if (existing) {
            return {
                name: existing.name,
                phone: existing.phone,
                address: existing.address,
                customerKey: existing.key,
            };
        }
        const id = await addCustomer({
            name: draftCustomer.name,
            phone: draftCustomer.phone,
            address: draftCustomer.address,
            customerKey,
        });
        setCustomers((prev) => [
            ...prev,
            {
                id,
                name: draftCustomer.name,
                phone: draftCustomer.phone,
                address: draftCustomer.address,
                customerKey,
            },
        ]);
        return { ...draftCustomer, customerKey };
    };

    const handleGenerateInvoice = async () => {
        const draftCustomer = getCustomerDraft();
        if (!validateInvoice(draftCustomer)) return;
        setSaving(true);
        try {
            const resolvedCustomer = await resolveCustomerForInvoice(draftCustomer);
            const payload = buildInvoicePayload(resolvedCustomer);
            await createInvoice(payload);
            try {
                await generateInvoicePdf(payload);
                toast.success("✅ Invoice saved and PDF downloaded!");
                resetInvoice();
            } catch (pdfError) {
                console.error("PDF generation failed:", pdfError);
                toast.error("Invoice saved, but PDF download failed.");
            }
        } catch (error) {
            console.error("Error saving invoice:", error);
            toast.error("❌ Failed to save invoice");
        } finally {
            setSaving(false);
        }
    };

    const loadLogoDataUrl = async (logoUrl) => {
        if (!logoUrl) return null;
        const response = await fetch(logoUrl);
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const loadPdfFontBase64 = async () => {
        try {
            const response = await fetch("/fonts/NotoSansBengali-Regular.ttf");
            if (!response.ok) return null;
            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";

            for (let index = 0; index < bytes.length; index += 0x8000) {
                binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
            }

            return btoa(binary);
        } catch (error) {
            console.error("Error loading PDF font:", error);
            return null;
        }
    };

    const getImageFormat = (dataUrl) => {
        if (!dataUrl) return "PNG";
        const match = /^data:image\/(png|jpeg|jpg|webp)/.exec(dataUrl);
        if (!match) return "PNG";
        const ext = match[1].toLowerCase();
        return ext === "jpg" ? "JPEG" : ext.toUpperCase();
    };

    const generateInvoicePdf = async (payload) => {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
            import("jspdf"),
            import("jspdf-autotable"),
        ]);
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont("helvetica", "normal");
        const pdfFontBase64 = await loadPdfFontBase64();
        const amountFontName = "NotoSansBengali";

        if (pdfFontBase64) {
            doc.addFileToVFS("NotoSansBengali-Regular.ttf", pdfFontBase64);
            doc.addFont("NotoSansBengali-Regular.ttf", amountFontName, "normal");
        }

        const amountFont = pdfFontBase64 ? amountFontName : "helvetica";
        const drawAmount = (amount, x, y, options = {}) => {
            doc.setFont(amountFont, "normal");
            doc.text(formatMoney(amount), x, y, options);
            doc.setFont("helvetica", "normal");
        };

        const colors = {
            page: [247, 244, 236],
            panel: [255, 255, 255],
            accent: [43, 111, 77],
            accentSoft: [214, 228, 218],
            text: [41, 52, 47],
            muted: [90, 98, 94],
            border: [214, 224, 216],
            tableAlt: [244, 240, 231],
        };

        doc.setFillColor(...colors.page);
        doc.rect(0, 0, pageWidth, pageHeight, "F");

        const headerHeight = 40;
        doc.setFillColor(...colors.accentSoft);
        doc.rect(0, 0, pageWidth, headerHeight, "F");
        doc.setDrawColor(...colors.accent);
        doc.setLineWidth(0.7);
        doc.line(15, headerHeight, pageWidth - 15, headerHeight);

        const logoDataUrl = await loadLogoDataUrl(payload.header.logoUrl);
        if (logoDataUrl) {
            const format = getImageFormat(logoDataUrl);
            doc.addImage(logoDataUrl, format, pageWidth - 40, 7, 22, 16);
        }

        doc.setFontSize(18);
        doc.setTextColor(...colors.text);
        doc.text(payload.header.companyName || "Invoice", 15, 17);

        doc.setFontSize(10);
        doc.setTextColor(...colors.muted);
        if (payload.header.tagline) {
            doc.text(payload.header.tagline, 15, 24);
        }
        const addressLines = [payload.header.address, payload.header.phone]
            .filter(Boolean)
            .join(" | ");
        if (addressLines) {
            doc.text(addressLines, 15, 30);
        }

        doc.setFontSize(12);
        doc.setTextColor(...colors.accent);
        doc.text("INVOICE", pageWidth - 15, 17, { align: "right" });

        doc.setFontSize(9);
        doc.setTextColor(...colors.muted);
        doc.text(`Invoice No: ${payload.invoiceNumber}`, pageWidth - 15, 24, { align: "right" });
        doc.text(`Date: ${payload.invoiceDate}`, pageWidth - 15, 31, { align: "right" });

        let y = headerHeight + 12;
        const cardWidth = (pageWidth - 40) / 2;
        const leftCardX = 15;
        const rightCardX = leftCardX + cardWidth + 10;
        const cardHeight = 30;

        doc.setFillColor(...colors.panel);
        doc.setDrawColor(...colors.border);
        doc.roundedRect(leftCardX, y, cardWidth, cardHeight, 3, 3, "FD");
        doc.roundedRect(rightCardX, y, cardWidth, cardHeight, 3, 3, "FD");

        doc.setFontSize(11);
        doc.setTextColor(...colors.accent);
        doc.text("Bill To", leftCardX + 4, y + 7);
        doc.text("Payment", rightCardX + 4, y + 7);

        doc.setFontSize(9);
        doc.setTextColor(...colors.text);
        doc.text(payload.customer.name || "", leftCardX + 4, y + 14);
        doc.text(payload.customer.phone || "", leftCardX + 4, y + 20);
        doc.text(payload.customer.address || "", leftCardX + 4, y + 26);

        doc.text(`Method: ${payload.payment.method}`, rightCardX + 4, y + 14);
        doc.text(`Status: ${payload.payment.status}`, rightCardX + 4, y + 20);
        doc.text(`Paid: ${formatMoney(payload.totals.paid)}`, rightCardX + 4, y + 26);

        y += cardHeight + 10;

        const tableBody = payload.items.map((item, index) => [
            `${index + 1}. ${item.productName}`,
            item.unit,
            String(item.quantity),
            formatMoney(item.unitPrice),
            formatMoney(item.lineTotal),
        ]);

        autoTable(doc, {
            head: [["Item", "Unit", "Qty", "Unit Price", "Line Total"]],
            body: tableBody,
            startY: y,
            styles: { font: "helvetica" },
            headStyles: { fillColor: colors.accent, textColor: 255, fontSize: 9 },
            bodyStyles: { textColor: 50, fontSize: 8 },
            alternateRowStyles: { fillColor: colors.tableAlt },
            margin: { left: 15, right: 15 },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                if (data.column.index === 3 || data.column.index === 4) {
                    data.cell.styles.font = amountFont;
                }
            },
        });

        const tableEndY = doc.lastAutoTable?.finalY || y + 40;
        const summaryY = tableEndY + 8;
        const footerReserve = 32;
        const footerY = Math.min(pageHeight - footerReserve, summaryY + 36);
        const summaryLabelX = pageWidth - 74;
        const summaryValueX = pageWidth - 15;

        doc.setFontSize(9);
        doc.setTextColor(...colors.muted);
        doc.text("Subtotal", summaryLabelX, summaryY + 8);
        doc.text("Discount", summaryLabelX, summaryY + 16);
        doc.text("Tax", summaryLabelX, summaryY + 24);
        doc.text("Total", summaryLabelX, summaryY + 33);

        doc.setTextColor(...colors.accent);
        drawAmount(payload.totals.subTotal, summaryValueX, summaryY + 8, { align: "right" });
        drawAmount(payload.totals.discount, summaryValueX, summaryY + 16, { align: "right" });
        drawAmount(payload.totals.tax, summaryValueX, summaryY + 24, { align: "right" });
        doc.setFontSize(10);
        drawAmount(payload.totals.total, summaryValueX, summaryY + 33, { align: "right" });

        doc.setFontSize(9);
        doc.setTextColor(...colors.muted);
        const footerMessage = payload.notes
            ? `Notes: ${payload.notes}`
            : "Thank you for choosing StockHere.";
        doc.text(footerMessage, 15, footerY);

        doc.setFontSize(8);
        doc.setTextColor(...colors.accent);
        doc.text("Developed by: J.M. Ifthakharul Islam Shajan", 15, footerY + 8);
        doc.text("Phone: 01305428030", 15, footerY + 13);
        doc.text("GitHub: https://github.com/if-i-shajan", 15, footerY + 18);

        doc.setFontSize(8);
        doc.setTextColor(...colors.muted);
        doc.text("StockHere Invoice", pageWidth - 15, footerY + 8, { align: "right" });

        doc.save(`stockhere-invoice-${payload.invoiceNumber}.pdf`);
    };

    return (
        <div className="mx-auto w-full max-w-6xl pb-8">
            <div className="mb-6">
                <h1 className="font-merriweather text-2xl font-bold text-agriGreen-900 sm:text-3xl">
                    🧾 Invoice Center
                </h1>
                <p className="font-nunito text-sm text-gray-600">
                    Create invoices, update stock, and download PDFs in one step.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
                <div className="form-card-agri">
                    <h2 className="mb-4 border-b-2 border-agriGreen-200 pb-2 font-merriweather text-lg font-bold text-agriGreen-900">
                        Invoice Header
                    </h2>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="form-label-agri">Company Name</label>
                            <input
                                className="form-field-agri"
                                value={header.companyName}
                                onChange={(e) => handleHeaderChange("companyName", e.target.value)}
                                placeholder="StockHere"
                            />
                        </div>
                        <div>
                            <label className="form-label-agri">Tagline</label>
                            <input
                                className="form-field-agri"
                                value={header.tagline}
                                onChange={(e) => handleHeaderChange("tagline", e.target.value)}
                                placeholder="Agricultural Supplies"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="form-label-agri">Address</label>
                            <input
                                className="form-field-agri"
                                value={header.address}
                                onChange={(e) => handleHeaderChange("address", e.target.value)}
                                placeholder="Street, City, District"
                            />
                        </div>
                        <div>
                            <label className="form-label-agri">Phone</label>
                            <input
                                className="form-field-agri"
                                value={header.phone}
                                onChange={(e) => handleHeaderChange("phone", e.target.value)}
                                placeholder="+8801XXXXXXXXX"
                            />
                        </div>
                        <div>
                            <label className="form-label-agri">Logo URL (optional)</label>
                            <input
                                className="form-field-agri"
                                value={header.logoUrl}
                                onChange={(e) => handleHeaderChange("logoUrl", e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleSaveHeader}
                        disabled={savingHeader}
                        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FiSave size={16} />
                        {savingHeader ? "Saving..." : "Save Header"}
                    </button>
                </div>

                <div className="form-card-agri">
                    <h2 className="mb-4 border-b-2 border-agriGreen-200 pb-2 font-merriweather text-lg font-bold text-agriGreen-900">
                        Customer & Payment
                    </h2>

                    <div className="grid gap-4">
                        <div>
                            <label className="form-label-agri">Invoice Number</label>
                            <input className="form-field-agri" value={invoiceNumber} readOnly />
                        </div>
                        <div>
                            <label className="form-label-agri">Invoice Date</label>
                            <input
                                type="date"
                                className="form-field-agri"
                                value={invoiceDate}
                                onChange={(e) => setInvoiceDate(e.target.value)}
                            />
                        </div>
                        <div className="rounded-2xl border border-agriGreen-100 bg-agriCream/60 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">
                                Customer type
                            </p>
                            <div className="mt-2 flex flex-wrap gap-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <input
                                        type="radio"
                                        name="invoiceCustomerMode"
                                        checked={customerMode === "existing"}
                                        onChange={() => handleCustomerModeChange("existing")}
                                    />
                                    Existing customer
                                </label>
                                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                    <input
                                        type="radio"
                                        name="invoiceCustomerMode"
                                        checked={customerMode === "new"}
                                        onChange={() => handleCustomerModeChange("new")}
                                    />
                                    New customer
                                </label>
                            </div>

                            {customerMode === "existing" ? (
                                <div className="mt-3 grid gap-3">
                                    <div>
                                        <label className="form-label-agri">Customer</label>
                                        <select
                                            className="form-field-agri cursor-pointer"
                                            value={selectedCustomerKey}
                                            onChange={(e) => setSelectedCustomerKey(e.target.value)}
                                            disabled={loadingCustomers}
                                        >
                                            <option value="">Select customer</option>
                                            {customerOptions.map((entry) => (
                                                <option key={entry.key} value={entry.key}>
                                                    {entry.name || "Unknown"}
                                                    {entry.phone ? ` (${entry.phone})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                        {loadingCustomers && (
                                            <p className="mt-1 text-xs text-gray-500">Loading customers...</p>
                                        )}
                                        {!loadingCustomers && customerOptions.length === 0 && (
                                            <p className="mt-1 text-xs text-gray-500">No customers saved yet.</p>
                                        )}
                                    </div>
                                    {selectedCustomer && (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <label className="form-label-agri">Customer Name</label>
                                                <input
                                                    className="form-field-agri"
                                                    value={selectedCustomer.name}
                                                    readOnly
                                                />
                                            </div>
                                            <div>
                                                <label className="form-label-agri">Customer Phone</label>
                                                <input
                                                    className="form-field-agri"
                                                    value={selectedCustomer.phone}
                                                    readOnly
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="form-label-agri">Customer Address</label>
                                                <textarea
                                                    className="form-field-agri min-h-[96px]"
                                                    value={selectedCustomer.address}
                                                    readOnly
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="form-label-agri">Customer Name</label>
                                        <input
                                            className="form-field-agri"
                                            value={customer.name}
                                            onChange={(e) => handleCustomerChange("name", e.target.value)}
                                            placeholder="Customer name"
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label-agri">Customer Phone</label>
                                        <input
                                            className="form-field-agri"
                                            value={customer.phone}
                                            onChange={(e) => handleCustomerChange("phone", e.target.value)}
                                            placeholder="Phone number"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="form-label-agri">Customer Address</label>
                                        <textarea
                                            className="form-field-agri min-h-[96px]"
                                            value={customer.address}
                                            onChange={(e) => handleCustomerChange("address", e.target.value)}
                                            placeholder="Full address"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="form-label-agri">Payment Method</label>
                            <select
                                className="form-field-agri cursor-pointer"
                                value={payment.method}
                                onChange={(e) => handlePaymentChange("method", e.target.value)}
                            >
                                <option value="Cash">Cash</option>
                                <option value="Card">Card</option>
                                <option value="Bank">Bank Transfer</option>
                                <option value="Mobile">Mobile Payment</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <label className="form-label-agri">Discount (৳)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-field-agri"
                                    value={payment.discount}
                                    onChange={(e) => handlePaymentChange("discount", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label-agri">Tax (৳)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-field-agri"
                                    value={payment.tax}
                                    onChange={(e) => handlePaymentChange("tax", e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label-agri">Paid (৳)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-field-agri"
                                    value={payment.paid}
                                    onChange={(e) => handlePaymentChange("paid", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6 form-card-agri">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-merriweather text-lg font-bold text-agriGreen-900">Invoice Items</h2>
                    <button
                        type="button"
                        onClick={addItemRow}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-agriGreen transition hover:bg-agriGreen-50"
                    >
                        <FiPlus size={16} />
                        Add Item
                    </button>
                </div>

                <div className="mb-5 rounded-2xl border border-agriGreen-100 bg-agriCream/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">Wholesale quick entry</p>
                            <h3 className="mt-1 font-merriweather text-lg font-bold text-agriGreen-900">Add item fast</h3>
                        </div>
                        <button
                            type="button"
                            onClick={addQuickItem}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-white shadow-sm transition hover:bg-agriGreen-800"
                        >
                            <FiPlus size={16} />
                            Add to invoice
                        </button>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="form-label-agri">Product</label>
                            <select
                                className="form-field-agri cursor-pointer"
                                value={quickItem.productId}
                                onChange={(e) => handleQuickItemChange("productId", e.target.value)}
                            >
                                <option value="">Select product</option>
                                {products.map((productOption) => (
                                    <option key={productOption.id} value={productOption.id}>
                                        {productOption.productName}
                                    </option>
                                ))}
                            </select>
                            {quickProduct && (
                                <p className="mt-1 text-xs font-semibold text-agriGreen">
                                    Available: {quickStock} {quickProduct.unit}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="form-label-agri">Quantity</label>
                            <input
                                type="number"
                                min="0"
                                className="form-field-agri"
                                value={quickItem.quantity}
                                onChange={(e) => handleQuickItemChange("quantity", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="form-label-agri">Unit Price (৳)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-field-agri"
                                value={quickItem.unitPrice}
                                onChange={(e) => handleQuickItemChange("unitPrice", e.target.value)}
                            />
                            {quickProduct && quickMinSell > 0 && (
                                <p className="mt-1 text-xs text-gray-500">
                                    Min sell: {formatMoney(quickMinSell)}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-agriGreen-100 bg-white p-4">
                        <h4 className="mb-2 font-merriweather text-base font-bold text-agriGreen-900">Quick Summary</h4>
                        <div className="grid gap-2 text-sm font-semibold text-gray-700 sm:grid-cols-2">
                            <div className="flex items-center justify-between">
                                <span>Buying price</span>
                                <span>{formatMoney(quickUnitCost)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Total amount</span>
                                <span>{formatMoney(quickTotal)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Profit</span>
                                <span className={quickProfit >= 0 ? "text-agriGreen-800" : "text-agriRed"}>
                                    {formatMoney(quickProfit)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {loadingProducts ? (
                    <p className="font-nunito text-sm text-gray-500">Loading products...</p>
                ) : (
                    <div className="grid gap-4">
                        {items.map((item) => {
                            const product = productMap.get(item.productId);
                            const stock = product ? getStockQty(product) : 0;
                            return (
                                <div key={item.id} className="rounded-2xl border border-agriGreen-100 bg-white p-4 shadow-sm">
                                    <div className="grid gap-4 lg:grid-cols-[2.5fr_1fr_1fr_1fr_auto]">
                                        <div>
                                            <label className="form-label-agri">Product</label>
                                            <select
                                                className="form-field-agri cursor-pointer"
                                                value={item.productId}
                                                onChange={(e) => handleProductSelect(item.id, e.target.value)}
                                            >
                                                <option value="">Select product</option>
                                                {products.map((productOption) => (
                                                    <option key={productOption.id} value={productOption.id}>
                                                        {productOption.productName}
                                                    </option>
                                                ))}
                                            </select>
                                            {product && (
                                                <p className="mt-1 text-xs font-semibold text-agriGreen">
                                                    Available: {stock} {product.unit}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="form-label-agri">Qty</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="form-field-agri"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(item.id, "quantity", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label-agri">Unit Price (৳)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="form-field-agri"
                                                value={item.unitPrice}
                                                onChange={(e) => handleItemChange(item.id, "unitPrice", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label-agri">Line Total</label>
                                            <div className="form-field-agri flex items-center justify-between bg-agriGreen-50 text-sm font-semibold text-agriGreen-900">
                                                {formatMoney(
                                                    safeInt(item.quantity) * safeFloat(item.unitPrice)
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                type="button"
                                                onClick={() => removeItemRow(item.id)}
                                                className="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-red-200 px-3 text-red-600 transition hover:bg-red-50"
                                                aria-label="Remove item"
                                            >
                                                <FiTrash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                    <div>
                        <label className="form-label-agri">Notes (optional)</label>
                        <textarea
                            className="form-field-agri min-h-[120px]"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Terms, delivery note, or thank you message"
                        />
                    </div>
                    <div className="rounded-2xl border border-agriGreen-100 bg-agriCream p-4 shadow-sm">
                        <h3 className="mb-3 font-merriweather text-base font-bold text-agriGreen-900">Summary</h3>
                        <div className="space-y-2 text-sm font-semibold text-gray-700">
                            <div className="flex items-center justify-between">
                                <span>Subtotal</span>
                                <span>{formatMoney(subTotal)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Discount</span>
                                <span>{formatMoney(discount)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Tax</span>
                                <span>{formatMoney(tax)}</span>
                            </div>
                            <div className="flex items-center justify-between text-base text-agriGreen-900">
                                <span>Total</span>
                                <span>{formatMoney(total)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Paid</span>
                                <span>{formatMoney(paidAmount)}</span>
                            </div>
                            <div className="flex items-center justify-between text-base text-agriGreen-900">
                                <span>Due</span>
                                <span>{formatMoney(dueAmount)}</span>
                            </div>
                        </div>
                        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-agriGreen-900">
                            Status: {status}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                        type="button"
                        onClick={handleGenerateInvoice}
                        disabled={saving}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-agriGreen to-agriGreen-800 px-6 py-3 font-nunito text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FiSave size={16} />
                        {saving ? "Saving..." : "Generate Invoice & Download"}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default InvoicesPage;
