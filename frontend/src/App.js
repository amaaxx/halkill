import React, { useContext } from 'react';
import ChatBox from "./components/ChatBox";
import Login from "./Login";
import { AuthProvider, AuthContext } from "./AuthContext";

const MainApp = () => {
    const { token } = useContext(AuthContext);
    if (!token) return <Login />;
    return <ChatBox />;
};

function App() {
    return (
        <AuthProvider>
            <MainApp />
        </AuthProvider>
    );
}

export default App;