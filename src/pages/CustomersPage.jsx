import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
    addCustomer,
    updateCustomer,
    getAllCustomers,
    getAllInvoices,
    createCustomerLedgerEntry,
    getAllCustomerLedgerEntries,
} from "../firebase/firestoreService";
import { formatTaka } from "../utils/formatCurrency";

const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

const buildCustomerKey = (customer) => {
    const name = normalizeText(customer?.name);
    const phone = normalizeText(customer?.phone);
    const address = normalizeText(customer?.address);
    if (!name && !phone && !address) return "";
    return `${name}|${phone}|${address}`;
};

const formatDate = (value) => {
    if (!value) return "-";
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-BD");
    }
    if (typeof value?.toDate === "function") {
        return value.toDate().toLocaleDateString("en-BD");
    }
    if (typeof value === "number") {
        return new Date(value).toLocaleDateString("en-BD");
    }
    return "-";
};

const CUSTOMER_INVOICE_DRAFT_KEY = "stockhere_invoice_customer_draft";

const CustomersPage = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const [customerForm, setCustomerForm] = useState({
        name: "",
        phone: "",
        address: "",
    });

    const [ledgerForm, setLedgerForm] = useState({
        customerKey: "",
        type: "debt",
        amount: "",
        note: "",
        entryDate: new Date().toISOString().slice(0, 10),
    });

    const [selectedCustomerKey, setSelectedCustomerKey] = useState("");
    const [savingCustomer, setSavingCustomer] = useState(false);
    const [savingLedger, setSavingLedger] = useState(false);

    const handleGenerateInvoice = (customer) => {
        if (!customer) return;
        try {
            window.sessionStorage.setItem(
                CUSTOMER_INVOICE_DRAFT_KEY,
                JSON.stringify({
                    customer: {
                        name: customer.name || "",
                        phone: customer.phone || "",
                        address: customer.address || "",
                    },
                })
            );
        } catch (error) {
            console.error("Error saving invoice draft:", error);
            toast.error("Could not prepare invoice draft");
            return;
        }

        navigate("/invoices");
        toast.success("Customer loaded into invoice panel");
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [customerRows, invoiceRows, ledgerRows] = await Promise.all([
                getAllCustomers(),
                getAllInvoices(),
                getAllCustomerLedgerEntries(),
            ]);
            setCustomers(customerRows);
            setInvoices(invoiceRows);
            setLedgerEntries(ledgerRows);
        } catch (error) {
            console.error("Error loading customer data:", error);
            toast.error("Failed to load customer panel");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const customerInfoByKey = useMemo(() => {
        const map = new Map();
        customers.forEach((customer) => {
            const key = customer.customerKey || buildCustomerKey(customer);
            if (!key) return;
            map.set(key, {
                key,
                id: customer.id,
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
                    invoiceDue: 0,
                    manualDebt: 0,
                    manualPayments: 0,
                    invoices: [],
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
            const customer = invoice?.customer || {};
            const key = buildCustomerKey(customer);
            const entry = ensureCustomer(key, customer);
            if (!entry) return;
            const total = Number(invoice?.totals?.total) || 0;
            const due = Number(invoice?.totals?.due) || 0;
            entry.totalPurchased += total;
            entry.invoiceDue += due;
            entry.invoices.push(invoice);
        });

        ledgerEntries.forEach((entry) => {
            const key = entry?.customerKey || buildCustomerKey(entry);
            const row = ensureCustomer(key, entry);
            if (!row) return;
            const amount = Number(entry.amount) || 0;
            if (entry.type === "payment") {
                row.manualPayments += amount;
            } else {
                row.manualDebt += amount;
            }
        });

        const list = Array.from(map.values()).map((entry) => {
            const info = customerInfoByKey.get(entry.key);
            if (info) {
                entry.name = info.name || entry.name;
                entry.phone = info.phone || entry.phone;
                entry.address = info.address || entry.address;
                entry.id = info.id;
            }
            const debt = entry.invoiceDue + entry.manualDebt - entry.manualPayments;
            entry.totalDebt = Math.max(0, debt);
            entry.invoices.sort((a, b) => {
                const aDate = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
                const bDate = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
                return bDate - aDate;
            });
            return entry;
        });

        return list;
    }, [customers, invoices, ledgerEntries, customerInfoByKey]);

    const filteredCustomers = useMemo(() => {
        const q = normalizeText(searchQuery);
        if (!q) return customerAggregates;
        return customerAggregates.filter((customer) => {
            return (
                normalizeText(customer.name).includes(q) ||
                normalizeText(customer.phone).includes(q) ||
                normalizeText(customer.address).includes(q)
            );
        });
    }, [customerAggregates, searchQuery]);

    const topBuyers = useMemo(() => {
        return [...customerAggregates]
            .sort((a, b) => b.totalPurchased - a.totalPurchased)
            .slice(0, 10);
    }, [customerAggregates]);

    const totalOutstandingDebt = useMemo(() => {
        return customerAggregates.reduce((sum, customer) => sum + (customer.totalDebt || 0), 0);
    }, [customerAggregates]);

    useEffect(() => {
        if (!selectedCustomerKey && customerAggregates.length > 0) {
            setSelectedCustomerKey(customerAggregates[0].key);
        }
    }, [customerAggregates, selectedCustomerKey]);

    const selectedCustomer = customerAggregates.find((customer) => customer.key === selectedCustomerKey);

    const selectedCustomerProducts = useMemo(() => {
        if (!selectedCustomer?.invoices?.length) return [];
        const map = new Map();
        selectedCustomer.invoices.forEach((invoice) => {
            (invoice.items || []).forEach((item) => {
                const name = item.productName || "Unknown";
                const current = map.get(name) || { name, quantity: 0, total: 0 };
                const quantity = Number(item.quantity) || 0;
                const total = Number(item.lineTotal) || 0;
                current.quantity += quantity;
                current.total += total;
                map.set(name, current);
            });
        });
        return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
    }, [selectedCustomer]);

    const handleCustomerFormChange = (field, value) => {
        setCustomerForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleCustomerSubmit = async (event) => {
        event.preventDefault();
        if (!customerForm.name || !customerForm.phone || !customerForm.address) {
            toast.error("Name, phone, and address are required");
            return;
        }

        const customerKey = buildCustomerKey(customerForm);
        if (!customerKey) {
            toast.error("Invalid customer details");
            return;
        }

        const existing = customers.find((customer) => {
            const key = customer.customerKey || buildCustomerKey(customer);
            return key === customerKey;
        });

        setSavingCustomer(true);
        try {
            if (existing) {
                await updateCustomer(existing.id, {
                    ...customerForm,
                    customerKey,
                });
                setCustomers((prev) =>
                    prev.map((customer) =>
                        customer.id === existing.id
                            ? { ...customer, ...customerForm, customerKey }
                            : customer
                    )
                );
                toast.success("✅ Customer updated");
            } else {
                const id = await addCustomer({
                    ...customerForm,
                    customerKey,
                });
                setCustomers((prev) => [
                    ...prev,
                    { id, ...customerForm, customerKey },
                ]);
                toast.success("✅ Customer added");
            }

            setCustomerForm({ name: "", phone: "", address: "" });
        } catch (error) {
            console.error("Error saving customer:", error);
            toast.error("❌ Failed to save customer");
        } finally {
            setSavingCustomer(false);
        }
    };

    const handleLedgerFormChange = (field, value) => {
        setLedgerForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleLedgerSubmit = async (event) => {
        event.preventDefault();
        if (!ledgerForm.customerKey) {
            toast.error("Select a customer");
            return;
        }
        const amount = Number(ledgerForm.amount) || 0;
        if (amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }

        const customerInfo = customerAggregates.find((item) => item.key === ledgerForm.customerKey);
        const entry = {
            customerKey: ledgerForm.customerKey,
            customerName: customerInfo?.name || "",
            customerPhone: customerInfo?.phone || "",
            customerAddress: customerInfo?.address || "",
            type: ledgerForm.type,
            amount,
            note: ledgerForm.note || "",
            entryDate: ledgerForm.entryDate,
            dateKey: ledgerForm.entryDate,
        };

        setSavingLedger(true);
        try {
            const id = await createCustomerLedgerEntry(entry);
            setLedgerEntries((prev) => [{ id, ...entry, createdAt: Date.now() }, ...prev]);
            toast.success("✅ Ledger updated");
            setLedgerForm((prev) => ({
                ...prev,
                amount: "",
                note: "",
            }));
        } catch (error) {
            console.error("Error saving ledger:", error);
            toast.error("❌ Failed to save ledger entry");
        } finally {
            setSavingLedger(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 font-nunito">
                <div
                    className="h-12 w-12 animate-spin rounded-full border-2 border-agriGreen border-t-transparent"
                    aria-hidden
                />
                <p className="font-semibold text-agriGreen">Loading customers…</p>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl pb-6">
            <div className="mb-4">
                <h1 className="font-merriweather text-xl font-bold text-agriGreen-900 sm:text-2xl">
                    Customer Debt Panel
                </h1>
                <p className="font-nunito text-sm text-gray-600">
                    Track purchases, debt, and payments in one place.
                </p>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Customers
                    </p>
                    <p className="font-nunito text-2xl font-bold text-agriGreen">{customerAggregates.length}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Total outstanding debt
                    </p>
                    <p className="font-nunito text-lg font-bold text-agriRed">{formatTaka(totalOutstandingDebt)}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <p className="font-nunito text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Top buyer
                    </p>
                    <p className="font-nunito text-base font-semibold text-agriGreen">
                        {topBuyers[0]?.name || "-"}
                    </p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <h2 className="mb-3 font-merriweather text-lg font-bold text-agriGreen-900">
                        Add / Update Customer
                    </h2>
                    <form className="grid gap-3" onSubmit={handleCustomerSubmit}>
                        <div>
                            <label className="form-label-agri">Customer Name</label>
                            <input
                                className="form-field-agri"
                                value={customerForm.name}
                                onChange={(e) => handleCustomerFormChange("name", e.target.value)}
                                placeholder="Customer name"
                            />
                        </div>
                        <div>
                            <label className="form-label-agri">Mobile Number</label>
                            <input
                                className="form-field-agri"
                                value={customerForm.phone}
                                onChange={(e) => handleCustomerFormChange("phone", e.target.value)}
                                placeholder="01XXXXXXXXX"
                            />
                        </div>
                        <div>
                            <label className="form-label-agri">Address</label>
                            <textarea
                                className="form-field-agri min-h-[96px]"
                                value={customerForm.address}
                                onChange={(e) => handleCustomerFormChange("address", e.target.value)}
                                placeholder="Customer address"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={savingCustomer}
                            className="min-h-11 rounded-xl bg-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-white shadow-sm transition hover:bg-agriGreen-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                            {savingCustomer ? "Saving..." : "Save Customer"}
                        </button>
                    </form>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <h2 className="mb-3 font-merriweather text-lg font-bold text-agriGreen-900">
                        Debt / Payment Entry
                    </h2>
                    <form className="grid gap-3" onSubmit={handleLedgerSubmit}>
                        <div>
                            <label className="form-label-agri">Customer</label>
                            <select
                                className="form-field-agri cursor-pointer"
                                value={ledgerForm.customerKey}
                                onChange={(e) => handleLedgerFormChange("customerKey", e.target.value)}
                            >
                                <option value="">Select customer</option>
                                {customerAggregates.map((customer) => (
                                    <option key={customer.key} value={customer.key}>
                                        {customer.name || "Unknown"} {customer.phone ? `(${customer.phone})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="form-label-agri">Type</label>
                                <select
                                    className="form-field-agri cursor-pointer"
                                    value={ledgerForm.type}
                                    onChange={(e) => handleLedgerFormChange("type", e.target.value)}
                                >
                                    <option value="debt">Add Debt</option>
                                    <option value="payment">Record Payment</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label-agri">Amount (৳)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="form-field-agri"
                                    value={ledgerForm.amount}
                                    onChange={(e) => handleLedgerFormChange("amount", e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="form-label-agri">Entry Date</label>
                            <input
                                type="date"
                                className="form-field-agri"
                                value={ledgerForm.entryDate}
                                onChange={(e) => handleLedgerFormChange("entryDate", e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="form-label-agri">Note</label>
                            <input
                                className="form-field-agri"
                                value={ledgerForm.note}
                                onChange={(e) => handleLedgerFormChange("note", e.target.value)}
                                placeholder="Optional note"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={savingLedger}
                            className="min-h-11 rounded-xl bg-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-white shadow-sm transition hover:bg-agriGreen-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                            {savingLedger ? "Saving..." : "Save Entry"}
                        </button>
                    </form>
                </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-merriweather text-lg font-bold text-agriGreen-900">
                            Customer List
                        </h2>
                        <input
                            type="search"
                            placeholder="Search customer"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="form-field-agri w-full sm:w-56"
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-agriGreen-700 text-white">
                                    <th className="px-3 py-2 font-nunito">Customer</th>
                                    <th className="px-3 py-2 font-nunito">Phone</th>
                                    <th className="px-3 py-2 font-nunito">Purchased</th>
                                    <th className="px-3 py-2 font-nunito">Debt</th>
                                    <th className="px-3 py-2 font-nunito">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td className="px-3 py-3 font-nunito text-gray-500" colSpan={5}>
                                            No customers found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCustomers
                                        .sort((a, b) => b.totalDebt - a.totalDebt)
                                        .map((customer) => (
                                            <tr
                                                key={customer.key}
                                                className={`cursor-pointer border-b border-gray-100 ${selectedCustomerKey === customer.key
                                                    ? "bg-agriGreen-50"
                                                    : "hover:bg-gray-50"
                                                    }`}
                                                onClick={() => setSelectedCustomerKey(customer.key)}
                                            >
                                                <td className="px-3 py-2 font-nunito font-semibold text-agriGreen-900">
                                                    {customer.name || "Unknown"}
                                                </td>
                                                <td className="px-3 py-2 font-nunito text-gray-600">
                                                    {customer.phone || "-"}
                                                </td>
                                                <td className="px-3 py-2 font-nunito text-gray-700">
                                                    {formatTaka(customer.totalPurchased)}
                                                </td>
                                                <td className="px-3 py-2 font-nunito font-semibold text-agriRed">
                                                    {formatTaka(customer.totalDebt)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGenerateInvoice(customer);
                                                        }}
                                                        className="rounded-lg border border-agriGreen px-3 py-1.5 font-nunito text-xs font-semibold text-agriGreen transition hover:bg-agriGreen hover:text-white"
                                                    >
                                                        Generate Invoice
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <h2 className="mb-3 font-merriweather text-lg font-bold text-agriGreen-900">
                        Top 10 Buyers
                    </h2>
                    {topBuyers.length === 0 ? (
                        <p className="font-nunito text-sm text-gray-500">No purchases yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {topBuyers.map((buyer, index) => (
                                <div
                                    key={buyer.key}
                                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-agriCream/40 px-3 py-2"
                                >
                                    <div>
                                        <p className="font-nunito text-sm font-semibold text-agriGreen-900">
                                            {index + 1}. {buyer.name || "Unknown"}
                                        </p>
                                        <p className="font-nunito text-xs text-gray-600">
                                            {buyer.phone || buyer.address || ""}
                                        </p>
                                    </div>
                                    <p className="font-nunito text-sm font-semibold text-agriGreen">
                                        {formatTaka(buyer.totalPurchased)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white p-4 shadow-md">
                <h2 className="mb-3 font-merriweather text-lg font-bold text-agriGreen-900">
                    Customer Details
                </h2>
                {!selectedCustomer ? (
                    <p className="font-nunito text-sm text-gray-500">Select a customer to view details.</p>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="space-y-2">
                            <p className="font-nunito text-base font-semibold text-agriGreen-900">
                                {selectedCustomer.name || "Unknown"}
                            </p>
                            <p className="font-nunito text-sm text-gray-600">Phone: {selectedCustomer.phone || "-"}</p>
                            <p className="font-nunito text-sm text-gray-600">Address: {selectedCustomer.address || "-"}</p>
                            <button
                                type="button"
                                onClick={() => handleGenerateInvoice(selectedCustomer)}
                                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-white shadow-sm transition hover:bg-agriGreen-800"
                            >
                                Generate Invoice
                            </button>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div className="rounded-xl bg-agriCream/40 p-3">
                                    <p className="font-nunito text-xs uppercase tracking-wide text-gray-500">Purchased</p>
                                    <p className="font-nunito text-sm font-semibold text-agriGreen">
                                        {formatTaka(selectedCustomer.totalPurchased)}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-agriCream/40 p-3">
                                    <p className="font-nunito text-xs uppercase tracking-wide text-gray-500">Outstanding debt</p>
                                    <p className="font-nunito text-sm font-semibold text-agriRed">
                                        {formatTaka(selectedCustomer.totalDebt)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-2 font-nunito text-sm font-semibold text-agriGreen-900">
                                Top Purchased Products
                            </h3>
                            {selectedCustomerProducts.length === 0 ? (
                                <p className="font-nunito text-sm text-gray-500">No products recorded yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {selectedCustomerProducts.map((item) => (
                                        <div
                                            key={item.name}
                                            className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2"
                                        >
                                            <div>
                                                <p className="font-nunito text-sm font-semibold text-agriGreen-900">
                                                    {item.name}
                                                </p>
                                                <p className="font-nunito text-xs text-gray-500">
                                                    Qty: {item.quantity}
                                                </p>
                                            </div>
                                            <p className="font-nunito text-sm font-semibold text-agriGreen">
                                                {formatTaka(item.total)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {selectedCustomer?.invoices?.length > 0 && (
                    <div className="mt-4">
                        <h3 className="mb-2 font-nunito text-sm font-semibold text-agriGreen-900">
                            Recent Purchases
                        </h3>
                        <div className="space-y-2">
                            {selectedCustomer.invoices.slice(0, 5).map((invoice) => (
                                <div
                                    key={invoice.id}
                                    className="rounded-xl border border-gray-100 px-3 py-2"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="font-nunito text-sm font-semibold text-agriGreen-900">
                                            Invoice #{invoice.invoiceNumber || invoice.id}
                                        </p>
                                        <p className="font-nunito text-xs text-gray-500">
                                            {formatDate(invoice.invoiceDate || invoice.createdAt)}
                                        </p>
                                    </div>
                                    <p className="font-nunito text-xs text-gray-600">
                                        Items: {(invoice.items || []).length} · Total: {formatTaka(invoice?.totals?.total || 0)} · Due: {formatTaka(invoice?.totals?.due || 0)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomersPage;
