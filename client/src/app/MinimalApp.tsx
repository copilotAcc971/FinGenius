// Minimal test app to verify React is mounting
import { useState, useEffect } from 'react';

export default function MinimalApp() {
  const [count, setCount] = useState(0);
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    console.log('[MinimalApp] Component mounted successfully!');
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>✅ React App is Working!</h1>
      <p>If you can see this, React has successfully mounted.</p>
      <p>Current time: {time}</p>
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={() => setCount(count + 1)}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Count: {count}
        </button>
      </div>
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f4f4f4', borderRadius: '8px' }}>
        <h2>Debug Information</h2>
        <ul>
          <li>React Version: {useState ? '✓ Hooks working' : '✗ Hooks not working'}</li>
          <li>Window Location: {window.location.href}</li>
          <li>User Agent: {navigator.userAgent.substring(0, 50)}...</li>
        </ul>
      </div>
    </div>
  );
}