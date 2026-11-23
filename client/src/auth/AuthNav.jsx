import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

// The header supplies destinations that correspond to its mounted pages.
export default function AuthNav({ links = [] }) {
  const { user, loading, logout } = useAuth();
  if (loading) return null;
  if (!user) return <><Link to="/login">Log in</Link>{' '}<Link to="/register">Register</Link></>;
  return <>
    {links.filter(link => link.roles.includes(user.role)).map(link =>
      <Link key={link.to} to={link.to}>{link.label}</Link>
    )}
    <button type="button" onClick={logout}>Log out</button>
  </>;
}
