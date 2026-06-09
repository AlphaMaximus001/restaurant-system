import { BrowserRouter as Router, Routes, Route, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import CustomerScreen from './CustomerScreen';
import StaffDashboard from './StaffDashboard';
import AdminPanel from './AdminPanel';
import './CustomerScreen.css';

function LandingPage() {
  const navigate = useNavigate();

  const handleSelectTable = (tableNum) => {
    navigate(`/?table=${tableNum}`);
  };

  const handleGoToStaff = () => {
    navigate('/staff');
  };

  const handleGoToAdmin = () => {
    navigate('/admin');
  };

  return (
    <div className="landing-container">
      {/* Modern Dialog Style Box */}
      <div className="pos-dark-frame" style={{ width: '380px', margin: '80px auto 40px auto', padding: '24px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 className="landing-title" style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', color: 'var(--color-text-header)' }}>
            RestauPOS v2.1
          </h1>
          <p className="landing-subtitle" style={{ fontSize: '14px', color: 'var(--color-text-body)', margin: 0 }}>
            Restaurant Point of Sale System
          </p>
        </div>
        
        <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '20px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          <button
            className="btn-primary"
            onClick={() => handleSelectTable(3)}
            style={{ padding: '12px', fontSize: '14px', width: '100%' }}
          >
            Open Table View (Demo)
          </button>
          
          <button
            className="btn-secondary-cta"
            onClick={handleGoToStaff}
            style={{ padding: '12px', fontSize: '14px', width: '100%' }}
          >
            Kitchen Dashboard &rarr;
          </button>

          <button
            className="btn-secondary"
            onClick={handleGoToAdmin}
            style={{ padding: '12px', fontSize: '14px', width: '100%' }}
          >
            Admin Panel &rarr;
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '24px 0 12px 0' }} />
        
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748B' }}>
          Version 2.1.0  |  © 2026 RestauPOS Systems
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const [searchParams] = useSearchParams();
  const table = searchParams.get('table');

  if (table) {
    return <CustomerScreen />;
  }

  return <LandingPage />;
}

function StaffWrapper() {
  const navigate = useNavigate();

  const handleGoToRoot = () => {
    navigate('/');
  };

  return (
    <div>
      <StaffDashboard />
      <button 
        className="btn-secondary"
        onClick={handleGoToRoot}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          padding: '8px 16px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        🏠 Go to Demo Home
      </button>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/staff" element={<StaffWrapper />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
