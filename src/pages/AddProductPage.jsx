import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft } from "react-icons/fi";
import ProductForm from "../components/ProductForm";
import { addProduct } from "../firebase/firestoreService";
import { safeFloat, safeInt } from "../utils/parseNumbers";

const EMPTY_INITIAL = {};

const AddProductPage = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (formData) => {
        setIsLoading(true);
        try {
            const productData = {
                ...formData,
                mrpPrice: safeFloat(formData.mrpPrice),
                invoicePrice: safeFloat(formData.invoicePrice),
                marketPrice: safeFloat(formData.marketPrice),
                stockQuantity: safeInt(formData.stockQuantity),
                lowStockAlert: safeInt(formData.lowStockAlert, 10),
            };

            await addProduct(productData);
            toast.success("✅ Product added successfully!");
            navigate("/");
        } catch (error) {
            console.error("Error adding product:", error);
            toast.error("❌ Failed to add product. Try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="relative min-h-0"
            style={{
                minHeight: "calc(100dvh - 5rem)",
            }}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                <div
                    className="absolute right-10 top-10 text-9xl opacity-5"
                    style={{ fontSize: "7rem" }}
                >
                    🌿
                </div>
                <div
                    className="absolute bottom-16 left-6 text-9xl opacity-5"
                    style={{ fontSize: "7rem" }}
                >
                    🌾
                </div>
            </div>

            <div className="relative z-10 mx-auto w-full max-w-xl px-4 pb-8 sm:px-6">
                <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="mb-4 flex min-h-11 items-center gap-2 font-nunito text-sm font-semibold text-agriGreen transition hover:opacity-80 sm:text-base"
                >
                    <FiArrowLeft size={22} aria-hidden />
                    Back to dashboard
                </button>

                <div className="form-card-agri px-4 py-6 sm:px-6 sm:py-8">
                    <div className="mb-6 text-center sm:mb-8">
                        <div
                            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-agriGreen to-agriGreen-800 text-2xl shadow-lg sm:h-16 sm:w-16"
                            aria-hidden
                        >
                            ➕
                        </div>
                        <h1 className="font-merriweather text-xl font-bold text-agriGreen-900 sm:text-3xl">
                            Add New Product
                        </h1>
                        <p className="mt-2 font-nunito text-sm font-semibold text-agriGreen">
                            Add product details and counter price. Final selling price is handled in invoices.
                        </p>
                    </div>

                    <ProductForm initialData={EMPTY_INITIAL} onSubmit={handleSubmit} isLoading={isLoading} />
                </div>
            </div>
        </div>
    );
};

export default AddProductPage;
