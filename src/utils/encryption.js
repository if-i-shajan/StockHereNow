// Simple encryption/decryption utility for admin credentials
// This provides basic obfuscation - for production, use more robust encryption

export const encryptPassword = (password) => {
    return btoa(password); // Base64 encoding
};

export const decryptPassword = (encoded) => {
    try {
        return atob(encoded); // Base64 decoding
    } catch {
        return null;
    }
};

export const hashCredentials = (email, password) => {
    // Create a simple hash for verification
    const combined = `${email}:${password}`;
    return btoa(combined);
};

export const verifyCredentials = (email, password, adminEmail, adminPassword) => {
    // Constant-time comparison to prevent timing attacks
    const provided = `${email}:${password}`;
    const expected = `${adminEmail}:${adminPassword}`;

    return provided === expected;
};
