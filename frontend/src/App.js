import React, { useContext } from 'react';
import ChatBox from "./components/ChatBox";
import Login from "./Login";
import { AuthProvider, AuthContext } from "./AuthContext";

// 1. The Traffic Controller
const MainApp = () => {
    // Grab the token and the logout function from our global brain
    const { token, logout } = useContext(AuthContext);

    // If there is no VIP pass, force them to the Login screen
    if (!token) {
        return <Login />;
    }

    // If they have a token, show the ChatBox with a logout button layered on top
    return (
        <div style={{ position: 'relative', height: '100vh', width: '100vw' }}>
            <button 
                onClick={logout} 
                style={{ 
                    position: 'absolute', 
                    top: '20px', 
                    right: '20px', 
                    zIndex: 1000, 
                    padding: '8px 16px', 
                    backgroundColor: '#ff4d4d', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                Logout
            </button>
            
            {/* Your original app UI */}
            <ChatBox />
        </div>
    );
};

// 2. The Wrapper
function App() {
    return (
        <AuthProvider>
            <MainApp />
        </AuthProvider>
    );
}

export default App;