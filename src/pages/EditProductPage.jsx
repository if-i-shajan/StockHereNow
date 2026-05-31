import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft } from "react-icons/fi";
import ProductForm from "../components/ProductForm";
import { getCachedProducts, getProductById, updateProduct } from "../firebase/firestoreService";
import { safeFloat, safeInt } from "../utils/parseNumbers";

const EditProductPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch product on mount
    useEffect(() => {
        const cached = getCachedProducts();
        const cachedProduct = cached?.find((item) => item.id === id);
        const hasCached = Boolean(cachedProduct);

        if (cachedProduct) {
            setProduct(cachedProduct);
            setLoading(false);
        }

        const fetchProduct = async () => {
            try {
                const fetchedProduct = await getProductById(id);
                if (fetchedProduct) {
                    setProduct(fetchedProduct);
                } else {
                    setNotFound(true);
                }
            } catch (error) {
                console.error("Error fetching product:", error);
                if (!hasCached) {
                    setNotFound(true);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [id]);

    // Format date for display
    const formatDate = (timestamp) => {
        if (!timestamp) return "Unknown";

        let date;
        // Handle Firestore Timestamp object
        if (timestamp.toDate) {
            date = timestamp.toDate();
        } else if (typeof timestamp === "number") {
            date = new Date(timestamp);
        } else {
            date = new Date(timestamp);
        }

        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();

        return `${day}/${month}/${year}`;
    };

    const handleSubmit = async (formData) => {
        setIsSubmitting(true);
        try {
            // Convert string values to appropriate types
            const productData = {
                ...formData,
                mrpPrice: safeFloat(formData.mrpPrice),
                invoicePrice: safeFloat(formData.invoicePrice),
                invoicePricePerKg: safeFloat(formData.invoicePricePerKg),
                minSellPrice: safeFloat(formData.minSellPrice),
                minSellPricePerKg: safeFloat(formData.minSellPricePerKg),
                isFertilizer: formData.category === "Fertilizer",
                fertilizerBagSize: safeFloat(formData.fertilizerBagSize),
                stockQuantity: safeInt(formData.stockQuantity),
                lowStockAlert: safeInt(formData.lowStockAlert, 10),
            };

            await updateProduct(id, productData);
            toast.success("✅ Product updated!");
            navigate("/");
        } catch (error) {
            console.error("Error updating product:", error);
            toast.error("❌ Update failed. Try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading State
    if (loading) {
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
                        Loading product...
                    </p>
                </div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Product Not Found
    if (notFound || !product) {
        return (
            <div style={{ paddingBottom: '80px' }}>
                <button
                    onClick={() => navigate("/")}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#2D6A4F',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        marginBottom: '24px',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                        fontSize: '16px',
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                >
                    <FiArrowLeft size={24} />
                    Back
                </button>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '384px',
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
                    <h2 style={{
                        fontSize: '20px',
                        fontFamily: 'Merriweather, serif',
                        fontWeight: 'bold',
                        color: '#333',
                        marginBottom: '16px',
                    }}>
                        Product Not Found
                    </h2>
                    <p style={{
                        color: '#666',
                        fontFamily: 'Nunito, sans-serif',
                        marginBottom: '24px',
                    }}>
                        The product you're looking for doesn't exist.
                    </p>
                    <button
                        onClick={() => navigate("/")}
                        style={{
                            backgroundColor: '#2D6A4F',
                            color: 'white',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: '600',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            paddingTop: '12px',
                            paddingBottom: '12px',
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                        onMouseLeave={(e) => e.target.style.opacity = '1'}
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative mx-auto w-full max-w-xl pb-8">
            <button
                type="button"
                onClick={() => navigate("/")}
                className="mb-4 flex min-h-11 items-center gap-2 font-nunito text-base font-semibold text-agriGreen transition hover:opacity-80"
            >
                <FiArrowLeft size={22} aria-hidden />
                Back to dashboard
            </button>

            <div className="form-card-agri">
                <div className="mb-6 text-center">
                    <div
                        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-agriGreen to-agriGreen-800 text-2xl shadow-lg"
                        aria-hidden
                    >
                        ✏️
                    </div>
                    <h1 className="font-merriweather text-2xl font-bold text-agriGreen-900 sm:text-3xl">
                        Edit Product
                    </h1>
                    <p className="mt-2 font-nunito text-sm text-gray-500">
                        Last updated: {formatDate(product.updatedAt)}
                    </p>
                </div>

                <ProductForm
                    key={product.id}
                    initialData={product}
                    onSubmit={handleSubmit}
                    isLoading={isSubmitting}
                />
            </div>
        </div>
    );
};

export default EditProductPage;
