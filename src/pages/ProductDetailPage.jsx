import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiArrowLeft, FiEdit2, FiTrash2 } from "react-icons/fi";
import ConfirmModal from "../components/ConfirmModal";
import { getCachedProducts, getProductById, deleteProduct } from "../firebase/firestoreService";
import { formatTaka } from "../utils/formatCurrency";
import { getLowStockAlert, getStockQty, isLowStockProduct } from "../utils/stockUtils";

const ProductDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState({
        isOpen: false,
        isLoading: false,
    });
    const [imageError, setImageError] = useState(false);

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

    // Calculate profit margin
    const calculateProfitMargin = () => {
        if (!product) return 0;
        const invoice = parseFloat(product.invoicePrice) || 0;
        const market = parseFloat(product.marketPrice) || 0;
        if (invoice === 0) return 0;
        return ((market - invoice) / invoice) * 100;
    };

    const profitMargin = calculateProfitMargin();

    const isLowStock = product && isLowStockProduct(product);
    const isOutOfStock = product && getStockQty(product) === 0;
    const soldQty = parseInt(product?.soldQuantity, 10) || 0;
    const lastSoldPrice = parseFloat(product?.lastSoldPrice) || 0;
    const currentCounterPrice = parseFloat(product?.marketPrice) || 0;
    const lastStockCheckAt = product?.lastStockCheckAt || "";

    // Handle delete
    const handleDelete = async () => {
        setDeleteConfirm({ isOpen: true, isLoading: false });
    };

    const confirmDelete = async () => {
        setDeleteConfirm((prev) => ({ ...prev, isLoading: true }));
        try {
            await deleteProduct(id);
            toast.success("✅ Product deleted successfully!");
            navigate("/");
        } catch (error) {
            console.error("Error deleting product:", error);
            toast.error("❌ Failed to delete product. Try again.");
            setDeleteConfirm((prev) => ({ ...prev, isLoading: false }));
        }
    };

    // Loading state
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

    // Not found state
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

    const getProfitMarginBgColor = () => {
        if (profitMargin > 20) return { backgroundColor: '#dcfce7', color: '#166534' };
        if (profitMargin >= 10) return { backgroundColor: '#fef3c7', color: '#92400e' };
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
    };

    const getColorFromString = (str) => {
        const colors = [
            '#ef4444',
            '#3b82f6',
            '#22c55e',
            '#a855f7',
            '#eab308',
            '#ec4899',
            '#6366f1',
        ];
        return colors[str.charCodeAt(0) % colors.length];
    };

    return (
        <div style={{
            paddingBottom: '80px',
            maxWidth: '896px',
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
        }}>
            {/* Back Button and Title */}
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

            <h1 className="text-[clamp(1.25rem,4vw,1.75rem)] leading-snug pr-2" style={{
                fontFamily: 'Merriweather, serif',
                fontWeight: 'bold',
                color: '#1B4332',
                marginBottom: '32px',
            }}>
                Product Details
            </h1>

            {/* SECTION 1: Identity */}
            <div style={{ marginBottom: '32px' }}>
                {/* Product Image or Placeholder */}
                <div style={{
                    marginBottom: '24px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    backgroundColor: '#ddd',
                    maxHeight: '192px',
                }}>
                    {product.imageUrl && !imageError ? (
                        <img
                            src={product.imageUrl}
                            alt={product.productName}
                            onError={() => setImageError(true)}
                            style={{
                                width: '100%',
                                height: '192px',
                                objectFit: 'cover',
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: '100%',
                                height: '192px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '48px',
                                fontWeight: 'bold',
                                color: 'white',
                                backgroundColor: getColorFromString(product.productName),
                            }}
                        >
                            {product.productName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Product Name */}
                <h2 style={{
                    fontSize: '20px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '4px',
                }}>
                    {product.productName}
                </h2>

                {/* Company */}
                <p style={{
                    color: '#666',
                    fontFamily: 'Nunito, sans-serif',
                    marginBottom: '16px',
                }}>
                    {product.company}
                </p>

                {/* Badges Row */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginBottom: '24px',
                }}>
                    <span style={{
                        display: 'inline-block',
                        paddingLeft: '12px',
                        paddingRight: '12px',
                        paddingTop: '4px',
                        paddingBottom: '4px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                    }}>
                        {product.category}
                    </span>
                    <span style={{
                        display: 'inline-block',
                        paddingLeft: '12px',
                        paddingRight: '12px',
                        paddingTop: '4px',
                        paddingBottom: '4px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                    }}>
                        {product.packSize}
                    </span>
                </div>
            </div>

            {/* SECTION 2: Pricing */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{
                    fontSize: '18px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '16px',
                }}>
                    Pricing
                </h3>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px',
                }}>
                    {/* MRP Price Box */}
                    <div style={{
                        backgroundColor: '#fef2f2',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '2px solid #fecaca',
                    }}>
                        <p style={{
                            fontSize: '14px',
                            color: '#666',
                            fontFamily: 'Nunito, sans-serif',
                            marginBottom: '8px',
                        }}>MRP Price</p>
                        <p style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: '#dc2626',
                            fontFamily: 'monospace',
                        }}>
                            {formatTaka(product.mrpPrice)}
                        </p>
                    </div>

                    {/* Purchase Price Box */}
                    <div style={{
                        backgroundColor: '#eff6ff',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '2px solid #bfdbfe',
                    }}>
                        <p style={{
                            fontSize: '14px',
                            color: '#666',
                            fontFamily: 'Nunito, sans-serif',
                            marginBottom: '8px',
                        }}>
                            Purchase Price
                        </p>
                        <p style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: '#2563eb',
                            fontFamily: 'monospace',
                        }}>
                            {formatTaka(product.invoicePrice)}
                        </p>
                    </div>

                    {/* Counter Price Box */}
                    <div style={{
                        backgroundColor: '#f0fdf4',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '2px solid #bbf7d0',
                    }}>
                        <p style={{
                            fontSize: '14px',
                            color: '#666',
                            fontFamily: 'Nunito, sans-serif',
                            marginBottom: '8px',
                        }}>
                            Counter Price
                        </p>
                        <p style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: '#2D6A4F',
                            fontFamily: 'monospace',
                        }}>
                            {formatTaka(currentCounterPrice)}
                        </p>
                    </div>
                </div>

                {/* Profit Margin Badge */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span
                        style={{
                            display: 'inline-block',
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            borderRadius: '9999px',
                            fontSize: '14px',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: '600',
                            ...getProfitMarginBgColor(),
                        }}
                    >
                        Profit Margin: {profitMargin.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* SECTION 3: Stock Info */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{
                    fontSize: '18px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '16px',
                }}>
                    Stock Information
                </h3>

                <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '16px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px',
                        marginBottom: '16px',
                    }}>
                        <p style={{
                            fontSize: '32px',
                            fontWeight: 'bold',
                            color: '#2D6A4F',
                            fontFamily: 'Nunito, sans-serif',
                        }}>
                            {getStockQty(product)}
                        </p>
                        <p style={{
                            color: '#666',
                            fontFamily: 'Nunito, sans-serif',
                            fontSize: '18px',
                        }}>
                            {product.unit}
                        </p>
                    </div>

                    <p style={{
                        fontSize: '14px',
                        color: '#666',
                        fontFamily: 'Nunito, sans-serif',
                    }}>
                        Low Stock Alert: <span style={{ fontWeight: '600' }}>{getLowStockAlert(product)}</span>
                    </p>
                </div>

                {/* Warnings */}
                {isOutOfStock && (
                    <div style={{
                        width: '100%',
                        backgroundColor: '#fee2e2',
                        border: '2px solid #ef5350',
                        color: '#991b1b',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        borderRadius: '8px',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                        marginBottom: '16px',
                    }}>
                        ❌ Out of Stock
                    </div>
                )}

                {isLowStock && !isOutOfStock && (
                    <div style={{
                        width: '100%',
                        backgroundColor: '#fef3c7',
                        border: '2px solid #fcd34d',
                        color: '#92400e',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        borderRadius: '8px',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                        marginBottom: '16px',
                    }}>
                        ⚠️ Stock is running low!
                    </div>
                )}
            </div>

            {/* SECTION 4: Sales & Stock Review */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{
                    fontSize: '18px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '16px',
                }}>
                    Sales & Stock Review
                </h3>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '16px',
                    marginBottom: '20px',
                }}>
                    <div style={{
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '2px solid #e5e7eb',
                    }}>
                        <p style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            fontFamily: 'Nunito, sans-serif',
                            marginBottom: '6px',
                        }}>
                            Sold Units
                        </p>
                        <p style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: '#1B4332',
                            fontFamily: 'Nunito, sans-serif',
                        }}>
                            {soldQty}
                        </p>
                    </div>

                    <div style={{
                        backgroundColor: '#f0fdf4',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '2px solid #bbf7d0',
                    }}>
                        <p style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            fontFamily: 'Nunito, sans-serif',
                            marginBottom: '6px',
                        }}>
                            Current Counter Price
                        </p>
                        <p style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#2D6A4F',
                            fontFamily: 'monospace',
                        }}>
                            {formatTaka(currentCounterPrice)}
                        </p>
                    </div>

                    <div style={{
                        backgroundColor: '#eff6ff',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '2px solid #bfdbfe',
                    }}>
                        <p style={{
                            fontSize: '13px',
                            color: '#6b7280',
                            fontFamily: 'Nunito, sans-serif',
                            marginBottom: '6px',
                        }}>
                            Last Sold Price
                        </p>
                        <p style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#2563eb',
                            fontFamily: 'monospace',
                        }}>
                            {lastSoldPrice ? formatTaka(lastSoldPrice) : "-"}
                        </p>
                    </div>
                </div>

                <div style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid #e5e7eb',
                }}>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px 24px',
                        fontFamily: 'Nunito, sans-serif',
                        color: '#4b5563',
                        fontSize: '14px',
                    }}>
                        <div>
                            Last Checked: <span style={{ fontWeight: 600 }}>{lastStockCheckAt ? formatDate(lastStockCheckAt) : "Not yet"}</span>
                        </div>
                    </div>
                </div>

                {/* Timestamps */}
                <div style={{
                    fontSize: '12px',
                    color: '#999',
                    fontFamily: 'Nunito, sans-serif',
                    marginTop: '24px',
                    paddingTop: '16px',
                    borderTop: '1px solid #ddd',
                }}>
                    <p>Created: {formatDate(product.createdAt)}</p>
                    <p>Last Updated: {formatDate(product.updatedAt)}</p>
                </div>
            </div>

            {/* ACTION BUTTONS */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
            }}>
                <button
                    onClick={() => navigate(`/edit/${id}`)}
                    style={{
                        width: '100%',
                        backgroundColor: '#2D6A4F',
                        color: 'white',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                        fontSize: '16px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        paddingLeft: '24px',
                        paddingRight: '24px',
                        borderRadius: '8px',
                        transition: 'opacity 0.2s',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.85'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                >
                    <FiEdit2 size={20} />
                    Edit Product
                </button>

                <button
                    onClick={handleDelete}
                    style={{
                        width: '100%',
                        border: '2px solid #C0392B',
                        color: '#C0392B',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                        fontSize: '16px',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        paddingLeft: '24px',
                        paddingRight: '24px',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#C0392B';
                        e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'white';
                        e.target.style.color = '#C0392B';
                    }}
                >
                    <FiTrash2 size={20} />
                    Delete Product
                </button>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="Delete Product"
                message={`Are you sure you want to delete "${product.productName}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
                onCancel={() =>
                    setDeleteConfirm({ isOpen: false, isLoading: false })
                }
                isLoading={deleteConfirm.isLoading}
            />
        </div>
    );
};

export default ProductDetailPage;
