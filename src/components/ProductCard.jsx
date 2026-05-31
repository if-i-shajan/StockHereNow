import { useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import { formatTaka } from "../utils/formatCurrency";
import { calculateProfitMarginPercent } from "../utils/pricing";
import { getStockQty, isLowStockProduct } from "../utils/stockUtils";
import { incrementStockQuantity } from "../firebase/firestoreService";

const ProductCard = memo(function ProductCard({ product, onDelete, onStockUpdate }) {
    const navigate = useNavigate();
    const [stockInput, setStockInput] = useState("");
    const [updatingStock, setUpdatingStock] = useState(false);

    const getCategoryBgColor = (category) => {
        const colors = {
            Insecticide: { bg: '#fee2e2', text: '#991b1b' },
            Fungicide: { bg: '#dbeafe', text: '#1e40af' },
            Herbicide: { bg: '#fed7aa', text: '#92400e' },
            Rodenticide: { bg: '#e9d5ff', text: '#6b21a8' },
            Nematicide: { bg: '#e0e7ff', text: '#3730a3' },
            Biofertilizer: { bg: '#dcfce7', text: '#166534' },
            Other: { bg: '#f3f4f6', text: '#374151' },
        };
        return colors[category] || { bg: '#f3f4f6', text: '#374151' };
    };

    const profitMargin = calculateProfitMarginPercent({
        invoicePrice: product.invoicePrice,
        minSellPrice: product.minSellPrice,
        marketPrice: product.marketPrice,
    });

    const getProfitMarginColor = () => {
        if (profitMargin > 20) return { bg: '#dcfce7', text: '#166534' };
        if (profitMargin >= 10) return { bg: '#fef3c7', text: '#92400e' };
        return { bg: '#fee2e2', text: '#991b1b' };
    };

    // Stock status
    const isLowStock = isLowStockProduct(product);
    const isOutOfStock = getStockQty(product) === 0;
    const qty = getStockQty(product);

    const handleCardClick = (e) => {
        if (e.target.closest("button, input, textarea, select, a")) {
            return;
        }
        navigate(`/product/${product.id}`);
    };

    const handleDelete = () => {
        onDelete(product);
    };

    const handleQuickStockUpdate = async (e) => {
        e.stopPropagation();
        const amount = parseInt(stockInput, 10) || 0;

        if (amount <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }

        setUpdatingStock(true);
        try {
            await incrementStockQuantity(product.id, amount);
            toast.success(`✅ Added ${amount} units`);
            setStockInput("");
            if (onStockUpdate) {
                onStockUpdate();
            }
        } catch (error) {
            console.error("Error updating stock:", error);
            toast.error("❌ Failed to update stock");
        } finally {
            setUpdatingStock(false);
        }
    };

    const categoryColor = getCategoryBgColor(product.category);
    const marginColor = getProfitMarginColor();

    return (
        <div
            onClick={handleCardClick}
            style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                padding: '16px',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s',
                borderLeft: isLowStock ? '4px solid #fcd34d' : 'none',
            }}
            className="motion-safe:md:hover:-translate-y-0.5 motion-safe:md:hover:shadow-lg"
        >
            {/* TOP SECTION: Product Info */}
            <div style={{ marginBottom: '16px' }}>
                <h3 style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    fontFamily: 'Merriweather, serif',
                    marginBottom: '4px',
                }}>
                    {product.productName}
                </h3>
                <p style={{
                    fontSize: '14px',
                    color: '#999',
                    fontFamily: 'Nunito, sans-serif',
                    marginBottom: '12px',
                }}>
                    {product.company}
                </p>

                {/* Category and Pack Size Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                }}>
                    <span
                        style={{
                            display: 'inline-block',
                            paddingLeft: '12px',
                            paddingRight: '12px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: '600',
                            backgroundColor: categoryColor.bg,
                            color: categoryColor.text,
                        }}
                    >
                        {product.category}
                    </span>
                    <span style={{
                        fontSize: '12px',
                        color: '#666',
                        fontFamily: 'Nunito, sans-serif',
                    }}>
                        {product.packSize}
                    </span>
                </div>
            </div>

            {/* MIDDLE SECTION: Prices */}
            <div style={{
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            }}>
                {/* MRP Price */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <span style={{
                        fontSize: '14px',
                        color: '#333',
                        fontFamily: 'Nunito, sans-serif',
                    }}>🏷️ MRP:</span>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#dc2626',
                        fontFamily: 'monospace',
                    }}>
                        {formatTaka(product.mrpPrice)}
                    </span>
                </div>

                {/* Buying Price */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <span style={{
                        fontSize: '14px',
                        color: '#333',
                        fontFamily: 'Nunito, sans-serif',
                    }}>
                        🧾 Buying:
                    </span>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#2563eb',
                        fontFamily: 'monospace',
                    }}>
                        {formatTaka(product.invoicePrice)}
                    </span>
                </div>

                {/* Minimum Sell Price */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <span style={{
                        fontSize: '14px',
                        color: '#333',
                        fontFamily: 'Nunito, sans-serif',
                    }}>
                        ✅ Min Sell:
                    </span>
                    <span style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#2D6A4F',
                        fontFamily: 'monospace',
                    }}>
                        {formatTaka(product.minSellPrice ?? product.marketPrice)}
                    </span>
                </div>

                {/* Profit Margin */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    marginTop: '12px',
                }}>
                    <span
                        style={{
                            fontSize: '12px',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: '600',
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                            borderRadius: '9999px',
                            backgroundColor: marginColor.bg,
                            color: marginColor.text,
                        }}
                    >
                        Margin: {profitMargin.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* STOCK ROW */}
            <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <span style={{
                        fontSize: '14px',
                        color: '#333',
                        fontFamily: 'Nunito, sans-serif',
                    }}>
                        📦 Stock: {qty} {product.unit}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {isOutOfStock ? (
                            <span style={{
                                fontSize: '12px',
                                fontFamily: 'Nunito, sans-serif',
                                fontWeight: '600',
                                paddingLeft: '8px',
                                paddingRight: '8px',
                                paddingTop: '4px',
                                paddingBottom: '4px',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                borderRadius: '9999px',
                            }}>
                                ❌ Out of Stock
                            </span>
                        ) : isLowStock ? (
                            <span style={{
                                fontSize: '12px',
                                fontFamily: 'Nunito, sans-serif',
                                fontWeight: '600',
                                paddingLeft: '8px',
                                paddingRight: '8px',
                                paddingTop: '4px',
                                paddingBottom: '4px',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                borderRadius: '9999px',
                                animation: 'pulse 2s infinite',
                            }}>
                                ⚠️ Low Stock
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* QUICK STOCK UPDATE */}
            <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: 'rgba(45, 106, 79, 0.05)',
                borderRadius: '8px',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <input
                        type="number"
                        min="1"
                        value={stockInput}
                        onChange={(e) => setStockInput(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Qty"
                        inputMode="numeric"
                        style={{
                            flex: 1,
                            paddingLeft: '12px',
                            paddingRight: '12px',
                            paddingTop: '10px',
                            paddingBottom: '10px',
                            fontSize: '16px',
                            border: '2px solid #2D6A4F',
                            borderRadius: '8px',
                            outline: 'none',
                            fontFamily: 'Nunito, sans-serif',
                            transition: 'box-shadow 0.2s',
                        }}
                        onFocus={(e) => {
                            e.target.style.boxShadow = '0 0 0 3px rgba(45, 106, 79, 0.1)';
                        }}
                        onBlur={(e) => {
                            e.target.style.boxShadow = 'none';
                        }}
                    />
                    <button
                        onClick={handleQuickStockUpdate}
                        disabled={updatingStock || !stockInput}
                        style={{
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            backgroundColor: updatingStock || !stockInput ? '#ccc' : '#2D6A4F',
                            color: 'white',
                            borderRadius: '8px',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            border: 'none',
                            cursor: updatingStock || !stockInput ? 'not-allowed' : 'pointer',
                            transition: 'opacity 0.2s',
                            opacity: updatingStock || !stockInput ? '0.6' : '1',
                            minHeight: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {updatingStock ? "..." : "➕"}
                    </button>
                </div>
            </div>

            {/* BOTTOM SECTION: Action Buttons */}
            <div style={{
                display: 'flex',
                gap: '12px',
            }}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/edit/${product.id}`);
                    }}
                    style={{
                        flex: 1,
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        border: '2px solid #2D6A4F',
                        color: '#2D6A4F',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#2D6A4F';
                        e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'white';
                        e.target.style.color = '#2D6A4F';
                    }}
                >
                    <FiEdit2 size={18} />
                    <span>Edit</span>
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                    }}
                    style={{
                        flex: 1,
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        border: '2px solid #ef5350',
                        color: '#ef5350',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        fontFamily: 'Nunito, sans-serif',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#ef5350';
                        e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'white';
                        e.target.style.color = '#ef5350';
                    }}
                >
                    <FiTrash2 size={18} />
                    <span>Delete</span>
                </button>
            </div>

            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
    );
});

export default ProductCard;
