/* eslint-disable react-refresh/only-export-components -- context + provider pattern */
import { createContext, useState, useEffect } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Track auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });

        // Cleanup subscription
        return unsubscribe;
    }, []);

    // Login function
    const login = async (email, password) => {
        setError(null);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            setCurrentUser(userCredential.user);
            return userCredential.user;
        } catch (err) {
            const errorMessage = err.code === "auth/user-not-found"
                ? "User not found"
                : err.code === "auth/wrong-password"
                    ? "Wrong password"
                    : err.code === "auth/invalid-email"
                        ? "Invalid email address"
                        : "Login failed. Please try again.";

            setError(errorMessage);
            throw new Error(errorMessage, { cause: err });
        }
    };

    // Logout function
    const logout = async () => {
        setError(null);
        try {
            await signOut(auth);
            setCurrentUser(null);
        } catch (err) {
            setError("Logout failed. Please try again.");
            throw err;
        }
    };

    // Loading spinner overlay
    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-agriCream">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-agriGreen"></div>
                    <p className="mt-4 text-agriGreen font-nunito text-lg">Loading...</p>
                </div>
            </div>
        );
    }

    const value = {
        currentUser,
        login,
        logout,
        error,
        setError,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
