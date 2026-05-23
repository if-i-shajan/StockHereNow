import { useEffect } from "react";
import { FiX } from "react-icons/fi";

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, isLoading }) => {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }

        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Handle overlay click to close
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    return (
        <div
            onClick={handleOverlayClick}
            role="presentation"
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
                maxWidth: '420px',
                width: '100%',
                maxHeight: 'min(90dvh, 640px)',
                overflowY: 'auto',
                padding: '24px',
                position: 'relative',
                WebkitOverflowScrolling: 'touch',
            }}
            >
                {/* Close Button */}
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        color: '#999',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#333'}
                    onMouseLeave={(e) => e.target.style.color = '#999'}
                >
                    <FiX size={24} />
                </button>

                {/* Title */}
                <h2
                    id="confirm-modal-title"
                    style={{
                    fontSize: '20px',
                    fontFamily: 'Merriweather, serif',
                    fontWeight: 'bold',
                    color: '#1B4332',
                    marginBottom: '8px',
                    paddingRight: '40px',
                }}
                >
                    {title}
                </h2>

                {/* Message */}
                <p style={{
                    color: '#666',
                    fontFamily: 'Nunito, sans-serif',
                    fontSize: '16px',
                    marginBottom: '24px',
                    lineHeight: '1.5',
                }}>{message}</p>

                {/* Buttons - Responsive: stacked on mobile, side-by-side on md+ */}
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            paddingTop: '12px',
                            paddingBottom: '12px',
                            backgroundColor: isLoading ? '#ddd' : '#e5e7eb',
                            color: '#1B4332',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: '600',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: 'none',
                            transition: 'background-color 0.2s',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? '0.6' : '1',
                        }}
                        onMouseEnter={(e) => !isLoading && (e.target.style.backgroundColor = '#d1d5db')}
                        onMouseLeave={(e) => !isLoading && (e.target.style.backgroundColor = '#e5e7eb')}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        style={{
                            flex: 1,
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            paddingTop: '12px',
                            paddingBottom: '12px',
                            backgroundColor: isLoading ? '#999' : '#C0392B',
                            color: 'white',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: '600',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: 'none',
                            transition: 'background-color 0.2s',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            opacity: isLoading ? '0.7' : '1',
                        }}
                        onMouseEnter={(e) => !isLoading && (e.target.style.backgroundColor = '#a02520')}
                        onMouseLeave={(e) => !isLoading && (e.target.style.backgroundColor = '#C0392B')}
                    >
                        {isLoading ? (
                            <>
                                <div style={{
                                    animation: 'spin 1s linear infinite',
                                    borderRadius: '50%',
                                    height: '20px',
                                    width: '20px',
                                    borderBottom: '2px solid white',
                                }}></div>
                                <span>Deleting...</span>
                            </>
                        ) : (
                            "Yes, Delete"
                        )}
                    </button>
                </div>

                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
};

export default ConfirmModal;
