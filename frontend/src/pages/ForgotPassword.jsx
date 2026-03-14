import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/services/api';

export default function ForgotPassword() {
  const [username, setUsername] = useState('');
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    authApi.forgotPassword(username.trim()).then((data) => {
      setSent(true);
      if (data.data?.otp) setOtp(data.data.otp);
      setLoading(false);
    }).catch((err) => {
      setError(err.message || 'Request failed');
      setLoading(false);
    });
  };

  return (
    <div className="page login-page">
      <div className="login-card">
        <h1>Forgot password</h1>
        <p className="muted">Enter your username to receive an OTP</p>
        {!sent ? (
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            <label htmlFor="forgot-username">Username</label>
            <input
              id="forgot-username"
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <div>
            <p className="alert alert-success">If the account exists, an OTP has been sent.</p>
            {otp && <p className="muted">Dev OTP: <strong>{otp}</strong></p>}
            <Link to="/reset-password" className="btn btn-primary">Enter OTP and reset password</Link>
          </div>
        )}
        <p className="login-footer"><Link to="/login">Back to sign in</Link></p>
      </div>
    </div>
  );
}
