import { useState } from "react";
import { calculateProfitMarginPercent } from "../utils/pricing";

function buildFormState(data = {}) {
    const isFertilizerCategory = data.category === "Fertilizer";
    return {
        productName: data.productName || "",
        company: data.company || "",
        category: data.category || "",
        packSize: data.packSize || "",
        unit: data.unit || "",
        mrpPrice: data.mrpPrice || "",
        invoicePrice: data.invoicePrice || "",
        invoicePricePerKg: data.invoicePricePerKg ?? "",
        minSellPrice: data.minSellPrice ?? data.marketPrice ?? "",
        minSellPricePerKg: data.minSellPricePerKg ?? "",
        isFertilizer: Boolean(data.isFertilizer || isFertilizerCategory),
        fertilizerBagSize: data.fertilizerBagSize ?? "",
        stockQuantity: data.stockQuantity || "",
        lowStockAlert: data.lowStockAlert ?? 10,
    };
}

const sectionTitleClass =
    "mb-4 border-b-2 border-agriGreen-200 pb-2 font-merriweather text-lg font-bold text-agriGreen-900 sm:text-xl";

function FormInputField({
    label,
    name,
    type = "text",
    placeholder = "",
    required = false,
    formData,
    errors,
    onChange,
    className = "",
    ...props
}) {
    const err = errors[name];
    const base = `form-field-agri ${err ? "form-field-agri-error" : ""} ${className}`.trim();
    return (
        <div className="mb-5">
            <label htmlFor={name} className="form-label-agri">
                {label} {required && <span className="text-agriRed">*</span>}
            </label>
            <input
                id={name}
                type={type}
                name={name}
                value={formData[name]}
                onChange={onChange}
                placeholder={placeholder}
                className={base}
                {...props}
            />
            {err && <p className="mt-1 font-nunito text-sm text-agriRed">{err}</p>}
        </div>
    );
}

function FormSelectField({ label, name, options, required = false, formData, errors, onChange }) {
    const err = errors[name];
    const base = `form-field-agri cursor-pointer bg-[#f5f0e8] ${err ? "form-field-agri-error" : ""}`.trim();
    return (
        <div className="mb-5">
            <label htmlFor={name} className="form-label-agri">
                {label} {required && <span className="text-agriRed">*</span>}
            </label>
            <select id={name} name={name} value={formData[name]} onChange={onChange} className={base}>
                <option value="">Select {label.toLowerCase()}</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
            {err && <p className="mt-1 font-nunito text-sm text-agriRed">{err}</p>}
        </div>
    );
}

const ProductForm = ({ initialData = {}, onSubmit, isLoading = false }) => {
    const [formData, setFormData] = useState(() => buildFormState(initialData));
    const [errors, setErrors] = useState({});

    const isFertilizerCategory = formData.category === "Fertilizer";

    const requiredFields = [
        "productName",
        "company",
        "category",
        "packSize",
        "unit",
        "mrpPrice",
        "invoicePrice",
        "minSellPrice",
        "stockQuantity",
    ];

    const validateForm = () => {
        const newErrors = {};

        requiredFields.forEach((field) => {
            if (!formData[field] || formData[field].toString().trim() === "") {
                newErrors[field] = "This field is required";
            }
        });

        if (formData.mrpPrice && parseFloat(formData.mrpPrice) < 0) {
            newErrors.mrpPrice = "Price must be positive";
        }
        if (formData.invoicePrice && parseFloat(formData.invoicePrice) < 0) {
            newErrors.invoicePrice = "Price must be positive";
        }
        if (formData.minSellPrice && parseFloat(formData.minSellPrice) < 0) {
            newErrors.minSellPrice = "Price must be positive";
        }

        if (formData.stockQuantity && parseFloat(formData.stockQuantity) < 0) {
            newErrors.stockQuantity = "Stock quantity cannot be negative";
        }

        if (isFertilizerCategory) {
            const bagSize = parseFloat(formData.fertilizerBagSize);
            if (!Number.isFinite(bagSize) || bagSize <= 0) {
                newErrors.fertilizerBagSize = "Bag size must be greater than 0";
            }
            const perKgBuying = parseFloat(formData.invoicePricePerKg);
            if (!Number.isFinite(perKgBuying) || perKgBuying <= 0) {
                newErrors.invoicePricePerKg = "Per kg buying price must be greater than 0";
            }
            const perKgMinSell = parseFloat(formData.minSellPricePerKg);
            if (!Number.isFinite(perKgMinSell) || perKgMinSell <= 0) {
                newErrors.minSellPricePerKg = "Per kg minimum sell price must be greater than 0";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const nextValue = type === "checkbox" ? checked : value;
        setFormData((prev) => {
            const next = {
                ...prev,
                [name]: nextValue,
            };
            if (name === "category") {
                const isFertilizer = nextValue === "Fertilizer";
                next.isFertilizer = isFertilizer;
                if (!isFertilizer) {
                    next.fertilizerBagSize = "";
                    next.invoicePricePerKg = "";
                    next.minSellPricePerKg = "";
                }
            }
            return next;
        });

        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validateForm()) {
            onSubmit(formData);
        }
    };

    const profitMargin = calculateProfitMarginPercent({
        invoicePrice: formData.invoicePrice,
        minSellPrice: formData.minSellPrice,
    });

    const profitMarginClass =
        profitMargin > 20
            ? "bg-green-100 text-green-800 border-green-500"
            : profitMargin >= 10
                ? "bg-yellow-100 text-yellow-800 border-yellow-500"
                : "bg-red-100 text-red-800 border-red-500";

    const fi = { formData, errors, onChange: handleChange };

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-8 pb-2">
            <div className="mb-8">
                <h2 className={sectionTitleClass}>Basic Information</h2>

                <FormInputField label="Product Name" name="productName" placeholder="e.g., Parathion 50 EC" required {...fi} />

                <FormInputField label="Company / Manufacturer" name="company" placeholder="e.g., Syngenta, BASF" required {...fi} />

                <FormSelectField
                    label="Category"
                    name="category"
                    required
                    options={["Insecticide", "Fungicide", "Herbicide", "Rodenticide", "Nematicide", "Fertilizer", "Biofertilizer", "Other"]}
                    {...fi}
                />

                <FormInputField label="Pack Size" name="packSize" placeholder="e.g., 100ml / 1kg / 250g" required {...fi} />

                <FormSelectField
                    label="Unit"
                    name="unit"
                    required
                    options={["Bottle", "Packet", "Bag", "Box", "Can", "Litre", "Kg"]}
                    {...fi}
                />
            </div>

            <div className="mb-8">
                <h2 className={sectionTitleClass}>Pricing (৳)</h2>

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FormInputField
                        label={isFertilizerCategory ? "MRP Price (per bag)" : "MRP Price"}
                        name="mrpPrice"
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        required
                        {...fi}
                    />

                    {!isFertilizerCategory && (
                        <>
                            <FormInputField
                                label="Buying Price"
                                name="invoicePrice"
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                required
                                {...fi}
                            />

                            <FormInputField
                                label="Minimum Sell Price"
                                name="minSellPrice"
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                required
                                {...fi}
                            />
                        </>
                    )}
                </div>

                <div className={`rounded-xl border-2 p-4 font-nunito text-base font-semibold sm:text-lg ${profitMarginClass}`}>
                    Profit Margin: {profitMargin.toFixed(2)}%
                </div>
                <p className="mt-2 font-nunito text-xs text-gray-600">
                    Final selling price is set during invoicing; minimum sell price is your floor price.
                </p>

                {isFertilizerCategory && (
                    <div className="mt-4 rounded-2xl border border-agriGreen-100 bg-agriCream p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-merriweather text-base font-bold text-agriGreen-900">Fertilizer pricing</h3>
                            <span className="rounded-full border border-agriGreen-200 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-agriGreen-700">
                                Per bag + per kg
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600">
                            Enter per-bag and per-kg prices separately. They are independent.
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormInputField
                                label="Bag size (kg)"
                                name="fertilizerBagSize"
                                type="number"
                                placeholder="0"
                                step="0.01"
                                min="0"
                                required
                                {...fi}
                            />
                            <FormInputField
                                label="Buying Price (per bag)"
                                name="invoicePrice"
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                required
                                {...fi}
                            />
                            <FormInputField
                                label="Buying Price (per kg)"
                                name="invoicePricePerKg"
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                required
                                {...fi}
                            />
                            <FormInputField
                                label="Minimum Sell Price (per bag)"
                                name="minSellPrice"
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                required
                                {...fi}
                            />
                            <FormInputField
                                label="Minimum Sell Price (per kg)"
                                name="minSellPricePerKg"
                                type="number"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                required
                                {...fi}
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-600">
                            Stock quantity should be stored in kg. Daily sales can use per kg pricing for fertilizer.
                        </p>
                    </div>
                )}
            </div>

            <div className="mb-8">
                <h2 className={sectionTitleClass}>Stock</h2>

                <FormInputField label="Stock Quantity" name="stockQuantity" type="number" placeholder="0" min="0" required {...fi} />

                <FormInputField label="Low Stock Alert Quantity" name="lowStockAlert" type="number" placeholder="10" min="0" {...fi} />

                <p className="-mt-2 mb-6 font-nunito text-sm text-gray-600">Alert when stock goes below this number</p>

            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-agriGreen to-agriGreen-800 py-3.5 font-nunito text-base font-bold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99] sm:text-lg"
            >
                {isLoading ? (
                    <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving…
                    </>
                ) : (
                    "Save Product"
                )}
            </button>
        </form>
    );
};

export default ProductForm;
