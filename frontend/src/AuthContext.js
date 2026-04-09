import React, { createContext, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // Check if we already have a token saved in the browser from a previous visit
    const [token, setToken] = useState(localStorage.getItem('token') || null);

    const login = async (username, password) => {
        // CRITICAL: FastAPI OAuth2 expects URL-encoded Form Data, NOT JSON!
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await fetch(`${API_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                setToken(data.access_token);
                localStorage.setItem('token', data.access_token); // Save it to browser
                return { success: true };
            } else {
                const errorData = await response.json();
                return { success: false, message: errorData.detail };
            }
        } catch (error) {
            return { success: false, message: "Server connection failed." };
        }
    };

    const logout = () => {
        setToken(null);
        localStorage.removeItem('token'); // Destroy the ID card
    };

    return (
        <AuthContext.Provider value={{ token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};