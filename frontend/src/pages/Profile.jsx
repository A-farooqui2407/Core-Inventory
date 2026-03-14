import { useAuth } from '@/contexts/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const username = user?.sub ?? '—';

  return (
    <div className="page">
      <h1>My Profile</h1>
      <section className="card">
        <p><strong>Username</strong>: {username}</p>
      </section>
    </div>
  );
}
