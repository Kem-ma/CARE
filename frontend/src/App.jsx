import { HashRouter, Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider } from './context/AuthContext';
import { DraftProvider } from './context/DraftContext';
import { I18nProvider, useI18n } from './i18n';
import AdminSignIn from './pages/admin/AdminSignIn';
import Dashboard from './pages/admin/Dashboard';
import Landing from './pages/Landing';
import LocationStep from './pages/LocationStep';
import MyReports from './pages/MyReports';
import Preview from './pages/Preview';
import ReportForm from './pages/ReportForm';
import SignIn from './pages/SignIn';
import Track from './pages/Track';

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="page">
      <h1>{t('notfound.title')}</h1>
      <p className="sub">{t('notfound.text')} <Link to="/">{t('notfound.home')}</Link></p>
    </div>
  );
}

// HashRouter keeps every address working on static hosting (Amplify) with no rewrite rules.
export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <AuthProvider>
          <DraftProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/report/location" element={<LocationStep />} />
                <Route path="/report" element={<ReportForm />} />
                <Route path="/report/preview" element={<Preview />} />
                <Route path="/my-reports" element={<MyReports />} />
                <Route path="/track" element={<Track />} />
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="/admin/sign-in" element={<AdminSignIn />} />
              <Route path="/admin" element={<Dashboard />} />
            </Routes>
          </DraftProvider>
        </AuthProvider>
      </HashRouter>
    </I18nProvider>
  );
}
