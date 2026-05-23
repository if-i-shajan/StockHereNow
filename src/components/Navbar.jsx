import { NavLink, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { FiLogOut } from "react-icons/fi";
import { MdHome, MdAdd, MdReceiptLong, MdPeople, MdViewList } from "react-icons/md";

const navLinkDesktop =
    "rounded-lg px-3 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/15 hover:text-white";

export const Navbar = () => {
    const { adminUser, adminLogout } = useAdminAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        try {
            adminLogout();
            navigate("/admin-login");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    return (
        <header
            className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-agriGreen-700 via-agriGreen-600 to-agriGreen-700 text-white shadow-lg pt-[env(safe-area-inset-top,0px)]"
            style={{
                paddingLeft: "env(safe-area-inset-left, 0px)",
                paddingRight: "env(safe-area-inset-right, 0px)",
            }}
        >
            <div className="mx-auto flex h-16 max-w-[100vw] items-center justify-between gap-2 px-3 sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                    <div className="shrink-0 text-xl sm:text-2xl" aria-hidden>
                        📦
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-merriweather truncate text-base font-bold sm:text-lg">StockHere</h1>
                        <p className="truncate text-[10px] leading-tight text-agriGreen-100 sm:text-xs">
                            Admin dashboard
                        </p>
                    </div>
                </div>

                <nav
                    className="hidden items-center gap-1 md:flex"
                    aria-label="Sections"
                >
                    <NavLink to="/" end className={({ isActive }) => `${navLinkDesktop} ${isActive ? "bg-white/20 text-white" : ""}`}>
                        <span className="flex items-center gap-1.5">
                            <MdHome size={18} aria-hidden />
                            Home
                        </span>
                    </NavLink>
                    <NavLink to="/products" className={({ isActive }) => `${navLinkDesktop} ${isActive ? "bg-white/20 text-white" : ""}`}>
                        <span className="flex items-center gap-1.5">
                            <MdViewList size={18} aria-hidden />
                            Product List
                        </span>
                    </NavLink>
                    <NavLink to="/add" className={({ isActive }) => `${navLinkDesktop} ${isActive ? "bg-white/20 text-white" : ""}`}>
                        <span className="flex items-center gap-1.5">
                            <MdAdd size={18} aria-hidden />
                            Add
                        </span>
                    </NavLink>
                    <NavLink to="/invoices" className={({ isActive }) => `${navLinkDesktop} ${isActive ? "bg-white/20 text-white" : ""}`}>
                        <span className="flex items-center gap-1.5">
                            <MdReceiptLong size={18} aria-hidden />
                            Invoices
                        </span>
                    </NavLink>
                    <NavLink to="/customers" className={({ isActive }) => `${navLinkDesktop} ${isActive ? "bg-white/20 text-white" : ""}`}>
                        <span className="flex items-center gap-1.5">
                            <MdPeople size={18} aria-hidden />
                            Customers
                        </span>
                    </NavLink>
                </nav>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <div className="hidden max-w-[36vw] text-right lg:block">
                        <p className="truncate text-sm font-semibold">{adminUser?.email}</p>
                        <p className="text-xs text-agriGreen-100">Signed in</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 font-nunito text-sm font-semibold text-agriGreen-700 transition hover:bg-red-50 sm:min-w-0 sm:px-4"
                        aria-label="Log out"
                    >
                        <FiLogOut size={20} className="shrink-0" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

const mobileTabClass = ({ isActive }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 font-nunito text-[11px] font-semibold transition ${isActive ? "bg-agriGreen-50 text-agriGreen-900" : "text-agriGreen-700 active:bg-agriGreen-50/60"
    }`;

const mobileFabSlotClass = ({ isActive }) =>
    `relative -mt-6 flex flex-1 items-center justify-center ${isActive ? "" : ""}`.trim();

export const BottomNav = () => {
    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-[100] md:hidden"
            style={{
                paddingLeft: "env(safe-area-inset-left, 0px)",
                paddingRight: "env(safe-area-inset-right, 0px)",
            }}
        >
            <div className="relative mx-auto max-w-lg pb-[env(safe-area-inset-bottom,0px)]">
                <nav
                    className="flex h-[4.25rem] items-stretch border-t-[3px] border-agriGreen-600 bg-white shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
                    aria-label="Primary navigation"
                >
                    <NavLink to="/" end className={mobileTabClass}>
                        {({ isActive }) => (
                            <>
                                <MdHome size={24} className={isActive ? "text-agriGreen-800" : "opacity-85"} aria-hidden />
                                <span>Home</span>
                                <span
                                    className={`mt-0.5 h-0.5 w-7 rounded-full ${isActive ? "bg-agriGreen-600" : "bg-transparent"}`}
                                    aria-hidden
                                />
                            </>
                        )}
                    </NavLink>

                    <NavLink to="/products" className={mobileTabClass}>
                        {({ isActive }) => (
                            <>
                                <MdViewList size={24} className={isActive ? "text-agriGreen-800" : "opacity-85"} aria-hidden />
                                <span>Products</span>
                                <span
                                    className={`mt-0.5 h-0.5 w-7 rounded-full ${isActive ? "bg-agriGreen-600" : "bg-transparent"}`}
                                    aria-hidden
                                />
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/add" className={mobileFabSlotClass} aria-label="Add new product">
                        {({ isActive }) => (
                            <span
                                className={`flex h-14 w-14 items-center justify-center rounded-full bg-agriGreen font-semibold text-white shadow-lg ring-4 ring-white transition active:scale-95 ${isActive ? "bg-agriGreen-800 ring-agriGreen-100" : "hover:bg-agriGreen-800"
                                    }`}
                            >
                                <MdAdd size={30} aria-hidden />
                            </span>
                        )}
                    </NavLink>
                    <NavLink to="/invoices" className={mobileTabClass}>
                        {({ isActive }) => (
                            <>
                                <MdReceiptLong size={24} className={isActive ? "text-agriGreen-800" : "opacity-85"} aria-hidden />
                                <span>Invoices</span>
                                <span
                                    className={`mt-0.5 h-0.5 w-7 rounded-full ${isActive ? "bg-agriGreen-600" : "bg-transparent"}`}
                                    aria-hidden
                                />
                            </>
                        )}
                    </NavLink>
                    <NavLink to="/customers" className={mobileTabClass}>
                        {({ isActive }) => (
                            <>
                                <MdPeople size={24} className={isActive ? "text-agriGreen-800" : "opacity-85"} aria-hidden />
                                <span>Customers</span>
                                <span
                                    className={`mt-0.5 h-0.5 w-7 rounded-full ${isActive ? "bg-agriGreen-600" : "bg-transparent"}`}
                                    aria-hidden
                                />
                            </>
                        )}
                    </NavLink>
                </nav>
            </div>
        </div>
    );
};
