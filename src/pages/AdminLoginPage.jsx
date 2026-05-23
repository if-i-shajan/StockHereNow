import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';
import toast from 'react-hot-toast';

const AdminLoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { adminLogin, isAdmin } = useAdminAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isAdmin) {
            navigate("/");
        }
    }, [isAdmin, navigate]);

    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await adminLogin(email, password);

            if (result.success) {
                toast.success('✅ Admin login successful!');
                navigate('/');
            } else {
                const message = result.error || 'Invalid admin credentials';
                setError(message);
                toast.error(`❌ ${message}`);
            }
        } catch {
            setError("Login failed. Please try again.");
            toast.error("❌ Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'linear-gradient(135deg, #f5f0e8 0%, #ffffff 50%, #f5f0e8 100%)',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Decorative background */}
            <div style={{
                position: 'absolute',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
            }}>
                <div style={{
                    position: 'absolute',
                    top: '40px',
                    right: '80px',
                    fontSize: '128px',
                    opacity: 0.05,
                }}>🌿</div>
                <div style={{
                    position: 'absolute',
                    bottom: '80px',
                    left: '40px',
                    fontSize: '128px',
                    opacity: 0.05,
                }}>🌾</div>
            </div>

            <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '420px',
                zIndex: 10,
            }}>
                {/* Login Card */}
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '24px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    padding: 'clamp(1.25rem, 4vw, 2.5rem)',
                    borderTop: '4px solid #2D6A4F',
                }}>
                    {/* Logo Section */}
                    <div style={{
                        textAlign: 'center',
                        marginBottom: '48px',
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '96px',
                            height: '96px',
                            background: 'linear-gradient(135deg, #2D6A4F 0%, #1B4332 100%)',
                            borderRadius: '50%',
                            marginBottom: '32px',
                            boxShadow: '0 10px 30px rgba(45, 106, 79, 0.3)',
                        }}>
                            <span style={{ fontSize: '48px' }}>📦</span>
                        </div>
                        <h1 style={{
                            fontSize: 'clamp(1.75rem, 6vw, 2.25rem)',
                            fontWeight: 'bold',
                            marginBottom: '12px',
                            color: '#1B4332',
                            fontFamily: 'Merriweather, serif',
                        }}>
                            StockHere
                        </h1>
                        <p style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#2D6A4F',
                            fontFamily: 'Nunito, sans-serif',
                        }}>
                            Admin Control Panel
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div style={{
                            backgroundColor: '#fee2e2',
                            border: '2px solid #fca5a5',
                            borderRadius: '16px',
                            padding: '16px',
                            marginBottom: '32px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                        }}>
                            <span style={{ fontSize: '24px', flexShrink: 0 }}>⚠️</span>
                            <div>
                                <p style={{
                                    color: '#991b1b',
                                    fontWeight: 'bold',
                                    fontSize: '14px',
                                    fontFamily: 'Nunito, sans-serif',
                                }}>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Email Input */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                marginBottom: '12px',
                                color: '#1B4332',
                                fontFamily: 'Nunito, sans-serif',
                            }}>
                                📧 Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px 20px',
                                    border: '2px solid #74C69D',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    backgroundColor: '#f5f0e8',
                                    outline: 'none',
                                    transition: 'all 0.3s ease',
                                    fontFamily: 'Nunito, sans-serif',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#2D6A4F';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(45, 106, 79, 0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#74C69D';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Password Input */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                marginBottom: '12px',
                                color: '#1B4332',
                                fontFamily: 'Nunito, sans-serif',
                            }}>
                                🔐 Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    required
                                    disabled={loading}
                                    style={{
                                        width: '100%',
                                        padding: '12px 20px',
                                        paddingRight: '48px',
                                        border: '2px solid #74C69D',
                                        borderRadius: '12px',
                                        fontSize: '16px',
                                        backgroundColor: '#f5f0e8',
                                        outline: 'none',
                                        transition: 'all 0.3s ease',
                                        fontFamily: 'Nunito, sans-serif',
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#2D6A4F';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(45, 106, 79, 0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#74C69D';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '16px',
                                        top: '12px',
                                        fontSize: '20px',
                                        background: 'none',
                                        border: 'none',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.6 : 1,
                                        transition: 'opacity 0.2s',
                                    }}
                                    disabled={loading}
                                >
                                    {showPassword ? '👁️' : '👁️‍🗨️'}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: '12px',
                                padding: '16px 24px',
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                color: 'white',
                                border: 'none',
                                background: loading ? '#999' : 'linear-gradient(135deg, #2D6A4F 0%, #1B4332 100%)',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(45, 106, 79, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                minHeight: '48px',
                                fontFamily: 'Nunito, sans-serif',
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? (
                                <>
                                    <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                                    Logging in...
                                </>
                            ) : (
                                <>
                                    <span>🔓</span>
                                    Enter Dashboard
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div style={{
                        margin: '32px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                    }}>
                        <div style={{
                            flex: 1,
                            height: '1px',
                            backgroundColor: '#ddd',
                        }}></div>
                        <span style={{
                            fontSize: '12px',
                            color: '#999',
                            fontFamily: 'Nunito, sans-serif',
                        }}>ADMIN ONLY</span>
                        <div style={{
                            flex: 1,
                            height: '1px',
                            backgroundColor: '#ddd',
                        }}></div>
                    </div>

                    {/* Features List */}
                    <div style={{
                        backgroundColor: '#f5f0e8',
                        borderRadius: '16px',
                        padding: '20px',
                        border: '1px solid #74C69D',
                    }}>
                        <h3 style={{
                            fontSize: '14px',
                            fontWeight: 'bold',
                            marginBottom: '16px',
                            color: '#1B4332',
                            fontFamily: 'Nunito, sans-serif',
                        }}>
                            📊 Dashboard Features:
                        </h3>
                        <ul style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            fontSize: '13px',
                            color: '#555',
                            fontFamily: 'Nunito, sans-serif',
                            listStyle: 'none',
                            padding: 0,
                        }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#2D6A4F' }}>✓</span>
                                <span>Inventory Management</span>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#2D6A4F' }}>✓</span>
                                <span>Stock Reports & Analytics</span>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#2D6A4F' }}>✓</span>
                                <span>Product Management</span>
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#2D6A4F' }}>✓</span>
                                <span>Real-time Tracking</span>
                            </li>
                        </ul>
                    </div>

                    {/* Footer */}
                    <p style={{
                        textAlign: 'center',
                        color: '#999',
                        fontSize: '12px',
                        marginTop: '24px',
                        fontFamily: 'Nunito, sans-serif',
                    }}>
                        🔒 Secure, encrypted admin access
                    </p>
                </div>

                {/* Security Badge */}
                <div style={{
                    textAlign: 'center',
                    marginTop: '32px',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    color: '#2D6A4F',
                    fontFamily: 'Nunito, sans-serif',
                }}>
                    <span>🛡️</span>
                    <span>Encrypted Session Protection</span>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AdminLoginPage;
