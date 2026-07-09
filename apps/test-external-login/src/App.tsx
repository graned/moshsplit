import { Routes, Route, Navigate } from 'react-router';
import LoginPage from './pages/LoginPage';
import SummaryPage from './pages/SummaryPage';

export interface LoginSession {
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/summary" element={<SummaryPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
