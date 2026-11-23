import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

function AccountForm({ registering }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setSaving(true);
    try {
      if (registering) {
        await register(fields);
        navigate('/login', { replace: true, state: { ...location.state, registered: true } });
      } else {
        await login(fields);
        navigate(location.state?.from || '/', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="account-heading">
      <h1 id="account-heading">{registering ? 'Create an account' : 'Log in'}</h1>
      {!registering && location.state?.registered && <p role="status">Account created. Log in to continue.</p>}
      <form onSubmit={submit}>
        {registering && <label>Full name <input name="full_name" autoComplete="name" maxLength={100} required /></label>}
        <label>Email <input type="email" name="email" autoComplete="email" maxLength={255} required /></label>
        <label>Password <input type="password" name="password"
          autoComplete={registering ? 'new-password' : 'current-password'}
          minLength={registering ? 8 : undefined} required /></label>
        {error && <p role="alert">{error}</p>}
        <button disabled={saving}>{registering ? 'Create account' : 'Log in'}</button>
      </form>
      <Link to={registering ? '/login' : '/register'} state={{ from: location.state?.from }}>
        {registering ? 'Already have an account? Log in' : 'Create an account'}
      </Link>
    </section>
  );
}

export function Login() {
  return <AccountForm registering={false} />;
}

export function Register() {
  return <AccountForm registering />;
}
