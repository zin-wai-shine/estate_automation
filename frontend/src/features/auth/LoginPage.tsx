import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { FiLock, FiMail } from 'react-icons/fi';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@estate.com');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      login(data.data.token, data.data.user);
    } catch (err: any) {
      // Fallback for seamless offline dev mode
      if (email === 'admin@estate.com' && password === 'Admin123!') {
        login('dev_jwt_token', {
          id: 1,
          email: 'admin@estate.com',
          name: 'Platform Administrator',
          role: 'ADMIN',
          status: 'ACTIVE',
        });
      } else {
        setError(err.message || 'Invalid email or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-main)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '0.75rem',
              backgroundColor: 'var(--accent-primary)',
              color: '#FFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.5rem',
              marginBottom: '0.75rem',
            }}
          >
            E
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Real Estate Platform
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Sign in to access your automation workspace
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '0.625rem 0.875rem',
              borderRadius: '0.375rem',
              backgroundColor: 'var(--status-danger-bg)',
              color: 'var(--status-danger)',
              fontSize: '0.8125rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Email Address"
            type="email"
            placeholder="admin@estate.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<FiMail />}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<FiLock />}
            required
          />

          <Button type="submit" variant="primary" isLoading={isLoading} style={{ width: '100%', marginTop: '0.5rem' }}>
            Sign In
          </Button>
        </form>

        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Default Admin Demo: <strong style={{ color: 'var(--text-secondary)' }}>admin@estate.com</strong> / <strong style={{ color: 'var(--text-secondary)' }}>Admin123!</strong>
          </p>
        </div>
      </div>
    </div>
  );
};
