import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { FiEye, FiEyeOff } from "react-icons/fi";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await login(email, password);
            navigate("/");
        } catch (err) {
            setError(err.message || "Login failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-agriCream p-4">
            <div className="w-full max-w-md">
                {/* Leaf Icon */}
                <div className="flex justify-center mb-8">
                    <span className="text-6xl">📦</span>
                </div>

                {/* App Title */}
                <h1 className="text-center font-merriweather text-5xl font-bold text-agriGreen mb-2">
                    StockHere
                </h1>

                {/* Subtitle */}
                <p className="text-center text-2xl text-gray-700 mb-8 font-nunito">
                    Pesticide Stock Manager
                </p>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email Input */}
                    <div>
                        <label htmlFor="email" className="block text-lg font-nunito font-semibold text-gray-800 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-5 py-3 text-lg border-2 border-agriGreen rounded-lg focus:outline-none focus:border-agriGreen focus:ring-2 focus:ring-agriGreen focus:ring-opacity-50 bg-white text-gray-800"
                            placeholder="your@email.com"
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label htmlFor="password" className="block text-lg font-nunito font-semibold text-gray-800 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-5 py-3 text-lg border-2 border-agriGreen rounded-lg focus:outline-none focus:border-agriGreen focus:ring-2 focus:ring-agriGreen focus:ring-opacity-50 bg-white text-gray-800"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-agriGreen text-xl focus:outline-none"
                            >
                                {showPassword ? <FiEyeOff size={24} /> : <FiEye size={24} />}
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-agriRed bg-opacity-10 border-2 border-agriRed rounded-lg p-4">
                            <p className="text-agriRed font-nunito font-semibold text-lg">{error}</p>
                        </div>
                    )}

                    {/* Login Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-agriGreen hover:bg-opacity-90 text-white font-nunito font-bold text-lg py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>

                {/* Admin Login Link */}
                <div className="mt-8 pt-6 border-t border-gray-300">
                    <p className="text-center text-gray-600 font-nunito text-sm mb-4">
                        Are you an administrator?
                    </p>
                    <button
                        onClick={() => navigate('/admin-login')}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-nunito font-bold text-base py-2 px-4 rounded-lg transition duration-200"
                    >
                        👨‍💼 Admin Login
                    </button>
                </div>

                {/* Footer Note */}
                <p className="text-center text-gray-600 font-nunito text-xs mt-8">
                    Firebase user accounts required for regular users
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
