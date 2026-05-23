/* eslint-disable react-refresh/only-export-components -- context + provider pattern */
import { createContext, useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

export const AdminAuthContext = createContext(null);

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isAdminEmail = (email) => {
    if (!email) return false;
    const normalized = email.toLowerCase();
    if (ADMIN_EMAILS.length === 0) {
        return normalized === "mrmodhu0@gmail.com";
    }
    return ADMIN_EMAILS.includes(normalized);
};

export const AdminAuthProvider = ({ children }) => {
    const [adminUser, setAdminUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && isAdminEmail(user.email)) {
                setAdminUser(user);
            } else {
                if (user) {
                    try {
                        await signOut(auth);
                    } catch {
                        // Ignore sign-out failures on mismatched user.
                    }
                }
                setAdminUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const adminLogin = async (email, password) => {
        setError(null);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            if (!isAdminEmail(userCredential.user?.email)) {
                await signOut(auth);
                const message = "This account is not authorized.";
                setError(message);
                return { success: false, error: message };
            }
            setAdminUser(userCredential.user);
            return { success: true };
        } catch (err) {
            const message =
                err.code === "auth/user-not-found"
                    ? "User not found"
                    : err.code === "auth/wrong-password"
                        ? "Wrong password"
                        : err.code === "auth/invalid-email"
                            ? "Invalid email address"
                            : "Login failed. Please try again.";
            setError(message);
            return { success: false, error: message };
        }
    };

    const adminLogout = async () => {
        setError(null);
        try {
            await signOut(auth);
            setAdminUser(null);
        } catch (err) {
            setError("Logout failed. Please try again.");
            throw err;
        }
    };

    const value = {
        adminUser,
        adminLogin,
        adminLogout,
        isAdmin: !!adminUser,
        loading,
        error,
    };

    return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
};
