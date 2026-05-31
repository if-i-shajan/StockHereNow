import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiSearch } from "react-icons/fi";
import toast from "react-hot-toast";
import ProductCard from "../components/ProductCard";
import ConfirmModal from "../components/ConfirmModal";
import { getAllProducts, deleteProduct, getCachedProducts } from "../firebase/firestoreService";

const ProductListPage = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [deleteConfirm, setDeleteConfirm] = useState({
        isOpen: false,
        product: null,
        isLoading: false,
    });

    const categories = [
        "All",
        "Insecticide",
        "Fungicide",
        "Herbicide",
        "Rodenticide",
        "Nematicide",
        "Biofertilizer",
        "Other",
    ];

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
                toast.error("Failed to load products");
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const handleRefreshProducts = async () => {
        try {
            const cached = getCachedProducts();
            if (cached) {
                setProducts(cached);
            }
            const fetchedProducts = await getAllProducts();
            setProducts(fetchedProducts);
        } catch (error) {
            console.error("Error refreshing products:", error);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            const matchesSearch =
                product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.company.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, selectedCategory]);

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

    const handleDelete = (product) => {
        setDeleteConfirm({
            isOpen: true,
            product,
            isLoading: false,
        });
    };

    const confirmDelete = async () => {
        setDeleteConfirm((prev) => ({ ...prev, isLoading: true }));
        try {
            await deleteProduct(deleteConfirm.product.id);
            setProducts((prev) => prev.filter((p) => p.id !== deleteConfirm.product.id));
            toast.success("✅ Product deleted successfully!");
            setDeleteConfirm({ isOpen: false, product: null, isLoading: false });
        } catch (error) {
            console.error("Error deleting product:", error);
            toast.error("❌ Failed to delete product. Try again.");
        }
    };

    if (loading && products.length === 0) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 font-nunito">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-agriGreen border-t-transparent" aria-hidden />
                <p className="font-semibold text-agriGreen">Loading products…</p>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-7xl pb-4">
            <section className="rounded-[28px] border border-agriGreen-200 bg-white/95 p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-agriGreen-700">Find products</p>
                        <h1 className="mt-1 font-merriweather text-2xl font-bold text-agriGreen-900">Product list</h1>
                        <p className="mt-1 font-nunito text-sm text-gray-600">
                            Search every added product and check its price and stock from one place.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate("/add")}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-agriGreen px-4 py-3 font-nunito text-sm font-bold text-white shadow-md transition hover:bg-agriGreen-800"
                    >
                        <FiPlus size={18} />
                        Add product
                    </button>
                </div>

                <div className="mt-4 space-y-4">
                    <div className="relative">
                        <FiSearch
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            size={20}
                        />
                        <input
                            type="search"
                            placeholder="Search name or company…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="form-field-agri w-full pl-11 pr-3 py-3"
                        />
                    </div>

                    <div className="-mx-1 overflow-x-auto px-1">
                        <div className="flex min-w-max gap-2 pb-1">
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() => setSelectedCategory(category)}
                                    className={`shrink-0 rounded-full border-2 px-4 py-2 font-nunito text-sm font-semibold transition ${selectedCategory === category
                                        ? "border-agriGreen bg-agriGreen text-white"
                                        : "border-agriGreen bg-white text-agriGreen hover:bg-agriGreen-50"
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>

                    {categoryOverview.length > 0 && (
                        <div className="rounded-2xl border border-agriGreen-100 bg-agriGreen-50/60 p-3">
                            <p className="mb-2 font-nunito text-xs font-bold uppercase tracking-wide text-agriGreen-800">
                                By category
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-1 font-nunito text-xs [-webkit-overflow-scrolling:touch]">
                                {categoryOverview.map((row) => (
                                    <button
                                        key={row.name}
                                        type="button"
                                        onClick={() => setSelectedCategory(row.name)}
                                        className={`shrink-0 rounded-full border-2 px-3 py-1.5 font-semibold transition ${selectedCategory === row.name
                                            ? "border-agriGreen bg-agriGreen text-white"
                                            : "border-agriGreen-200 bg-white text-agriGreen-900 hover:border-agriGreen"
                                            }`}
                                    >
                                        {row.name} <span className="opacity-80">({row.count} · {row.units}u)</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <div className="mb-3 mt-4 flex items-center justify-between gap-2">
                <div>
                    <p className="font-nunito text-sm text-gray-500">Products · {filteredProducts.length} shown</p>
                    <p className="font-nunito text-xs text-gray-500">Each card shows product price and stock details.</p>
                </div>
            </div>

            {filteredProducts.length > 0 ? (
                <div
                    className="grid gap-3 sm:gap-4"
                    style={{
                        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
                    }}
                >
                    {filteredProducts.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onDelete={handleDelete}
                            onStockUpdate={handleRefreshProducts}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-md">
                    <span className="mb-3 text-5xl" aria-hidden>
                        🌱
                    </span>
                    <h3 className="mb-2 font-merriweather text-lg font-bold text-gray-800">Nothing to show</h3>
                    {products.length === 0 ? (
                        <p className="mb-6 max-w-sm font-nunito text-gray-600">
                            Start by adding a product — use the <strong className="text-agriGreen">Add product</strong> button.
                        </p>
                    ) : (
                        <p className="mb-6 font-nunito text-gray-600">Try another search or category.</p>
                    )}
                    <button
                        type="button"
                        onClick={() => navigate("/add")}
                        className="rounded-xl bg-gradient-to-r from-agriGreen to-agriGreen-800 px-6 py-3 font-nunito font-bold text-white shadow-md transition hover:opacity-95 active:scale-[0.98]"
                    >
                        Add product
                    </button>
                </div>
            )}

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                title="Delete Product"
                message={`Are you sure you want to delete "${deleteConfirm.product?.productName}"? This action cannot be undone.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirm({ isOpen: false, product: null, isLoading: false })}
                isLoading={deleteConfirm.isLoading}
            />
        </div>
    );
};

export default ProductListPage;
