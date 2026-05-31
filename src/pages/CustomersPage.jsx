import { useEffect, useMemo, useState } from "react";
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

const buildCustomerDisplayLabel = (customer) => {
    const name = String(customer?.name || "Unknown").trim();
    const phone = String(customer?.phone || "").trim();
    return phone ? `${name} (${phone})` : name;
};

const CustomersPage = () => {
    const [customers, setCustomers] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingCustomerId, setEditingCustomerId] = useState("");

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

    const totalOutstandingDebt = useMemo(() => {
        return customerAggregates.reduce((sum, customer) => sum + (customer.totalDebt || 0), 0);
    }, [customerAggregates]);

    const customersWithDue = useMemo(() => {
        return customerAggregates.filter((customer) => (customer.totalDebt || 0) > 0).length;
    }, [customerAggregates]);

    useEffect(() => {
        if (!selectedCustomerKey && customerAggregates.length > 0) {
            setSelectedCustomerKey(customerAggregates[0].key);
        }
    }, [customerAggregates, selectedCustomerKey]);

    const selectedCustomer = customerAggregates.find((customer) => customer.key === selectedCustomerKey);

    const startEditingCustomer = (customer) => {
        if (!customer) return;
        setEditingCustomerId(customer.id || "");
        setSelectedCustomerKey(customer.key);
        setCustomerForm({
            name: customer.name || "",
            phone: customer.phone || "",
            address: customer.address || "",
        });
    };

    const cancelCustomerEdit = () => {
        setEditingCustomerId("");
        setCustomerForm({ name: "", phone: "", address: "" });
    };

    const handleCustomerFormChange = (field, value) => {
        setCustomerForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleCustomerSubmit = async (event) => {
        event.preventDefault();
        if (!customerForm.name || !customerForm.address) {
            toast.error("Name and address are required");
            return;
        }

        const customerKey = buildCustomerKey(customerForm);
        if (!customerKey) {
            toast.error("Invalid customer details");
            return;
        }

        setSavingCustomer(true);
        try {
            if (editingCustomerId) {
                await updateCustomer(editingCustomerId, {
                    ...customerForm,
                    customerKey,
                });
                setCustomers((prev) =>
                    prev.map((customer) =>
                        customer.id === editingCustomerId
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
            setEditingCustomerId("");
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
                    Customer Panel
                </h1>
                <p className="font-nunito text-sm text-gray-600">
                    Store customer details and track outstanding due.
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
                        Customers with due
                    </p>
                    <p className="font-nunito text-base font-semibold text-agriGreen">
                        {customersWithDue}
                    </p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <h2 className="mb-3 font-merriweather text-lg font-bold text-agriGreen-900">
                        {editingCustomerId ? "Edit Customer" : "Add Customer"}
                    </h2>
                    <form className="grid gap-3" onSubmit={handleCustomerSubmit}>
                        <div>
                            <label className="form-label-agri" htmlFor="customer-name">Customer Name</label>
                            <input
                                id="customer-name"
                                type="text"
                                autoComplete="off"
                                className="form-field-agri"
                                value={customerForm.name}
                                onChange={(e) => handleCustomerFormChange("name", e.target.value)}
                                placeholder="Customer name"
                                aria-describedby="customer-name-help"
                            />
                            <p id="customer-name-help" className="mt-1 font-nunito text-xs text-gray-500">
                                This is the primary field used to identify the customer.
                            </p>
                        </div>
                        <div>
                            <label className="form-label-agri" htmlFor="customer-phone">Mobile Number</label>
                            <input
                                id="customer-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                className="form-field-agri"
                                value={customerForm.phone}
                                onChange={(e) => handleCustomerFormChange("phone", e.target.value)}
                                placeholder="Optional"
                                aria-describedby="customer-phone-help"
                            />
                            <p id="customer-phone-help" className="mt-1 font-nunito text-xs text-gray-500">
                                Phone number is optional.
                            </p>
                        </div>
                        <div>
                            <label className="form-label-agri" htmlFor="customer-address">Address</label>
                            <textarea
                                id="customer-address"
                                className="form-field-agri min-h-[96px]"
                                value={customerForm.address}
                                onChange={(e) => handleCustomerFormChange("address", e.target.value)}
                                placeholder="Customer address"
                                aria-describedby="customer-address-help"
                            />
                            <p id="customer-address-help" className="mt-1 font-nunito text-xs text-gray-500">
                                Use a clear location or note so records are easy to find later.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="submit"
                                disabled={savingCustomer}
                                className="min-h-11 rounded-xl bg-agriGreen px-4 py-2 font-nunito text-sm font-semibold text-white shadow-sm transition hover:bg-agriGreen-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                            >
                                {savingCustomer ? "Saving..." : editingCustomerId ? "Update Customer" : "Save Customer"}
                            </button>
                            {editingCustomerId ? (
                                <button
                                    type="button"
                                    onClick={cancelCustomerEdit}
                                    className="min-h-11 rounded-xl border border-agriGreen-200 bg-white px-4 py-2 font-nunito text-sm font-semibold text-agriGreen-800 transition hover:bg-agriGreen-50"
                                >
                                    Cancel edit
                                </button>
                            ) : null}
                        </div>
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

            <div className="mt-6">
                <div className="rounded-2xl bg-white p-4 shadow-md">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-merriweather text-lg font-bold text-agriGreen-900">
                            Customer List
                        </h2>
                        <label className="sr-only" htmlFor="customer-search">Search customer</label>
                        <input
                            id="customer-search"
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
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length === 0 ? (
                                    <tr>
                                        <td className="px-3 py-3 font-nunito text-gray-500" colSpan={4}>
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
                                                tabIndex={0}
                                                role="button"
                                                aria-label={`View details for ${buildCustomerDisplayLabel(customer)}`}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        setSelectedCustomerKey(customer.key);
                                                    }
                                                }}
                                            >
                                                <td className="px-3 py-2 font-nunito font-semibold text-agriGreen-900">
                                                    <button
                                                        type="button"
                                                        className="text-left underline-offset-2 hover:underline"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            startEditingCustomer(customer);
                                                        }}
                                                        aria-label={`Edit customer ${buildCustomerDisplayLabel(customer)}`}
                                                    >
                                                        {customer.name || "Unknown"}
                                                    </button>
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
                                            </tr>
                                        ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <div className="mt-6 rounded-2xl bg-white p-4 shadow-md">
                <h2 className="mb-3 font-merriweather text-lg font-bold text-agriGreen-900">
                    Customer Details
                </h2>
                {!selectedCustomer ? (
                    <p className="font-nunito text-sm text-gray-500">Select a customer to view details.</p>
                ) : (
                    <div className="space-y-2">
                        <p className="font-nunito text-base font-semibold text-agriGreen-900">
                            {selectedCustomer.name || "Unknown"}
                        </p>
                        <p className="font-nunito text-sm text-gray-600">Phone: {selectedCustomer.phone || "-"}</p>
                        <p className="font-nunito text-sm text-gray-600">Address: {selectedCustomer.address || "-"}</p>
                        <button
                            type="button"
                            onClick={() => startEditingCustomer(selectedCustomer)}
                            className="min-h-11 rounded-xl border border-agriGreen-200 bg-white px-4 py-2 font-nunito text-sm font-semibold text-agriGreen-800 transition hover:bg-agriGreen-50"
                        >
                            Edit customer
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
                )}
            </div>
        </div>
    );
};

export default CustomersPage;
