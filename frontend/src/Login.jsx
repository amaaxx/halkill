import React, { useState, useContext } from 'react';
import { AuthContext } from './AuthContext';

const Login = () => {
    const { login } = useContext(AuthContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Call the login function from our AuthContext
        const result = await login(username, password);
        
        if (!result.success) {
            setError(result.message || "Failed to log in. Check credentials.");
        }
        setIsLoading(false);
    };

    // A simple, dark-themed styling object to match Halkill
    const styles = {
        container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'sans-serif' },
        box: { backgroundColor: '#1e1e1e', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '300px' },
        input: { width: '100%', padding: '10px', margin: '10px 0', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#2a2a2a', color: '#fff', boxSizing: 'border-box' },
        button: { width: '100%', padding: '10px', marginTop: '15px', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: '#fff', cursor: 'pointer', fontWeight: 'bold' },
        error: { color: '#ff4d4d', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }
    };

    return (
        <div style={styles.container}>
            <div style={styles.box}>
                <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Halkill Login</h2>
                
                {error && <div style={styles.error}>{error}</div>}
                
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        placeholder="Username" 
                        style={styles.input} 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                    <input 
                        type="password" 
                        placeholder="Password" 
                        style={styles.input} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <button type="submit" style={styles.button} disabled={isLoading}>
                        {isLoading ? 'Authenticating...' : 'Enter Vault'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;