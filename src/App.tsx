import { useNavigation } from './context/NavigationContext';
import { LoginScreen } from './components/screens/LoginScreen';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { PropertyDetailScreen } from './components/screens/PropertyDetailScreen';
import { DocumentsScreen } from './components/screens/DocumentsScreen';
import { MediaScreen } from './components/screens/MediaScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { AdminDashboardScreen } from './components/screens/admin/AdminDashboardScreen';
import { InvestorsListScreen } from './components/screens/admin/InvestorsListScreen';
import { InvestorDetailScreen } from './components/screens/admin/InvestorDetailScreen';
import { AddInvestorScreen } from './components/screens/admin/AddInvestorScreen';
import { AddPropertyScreen } from './components/screens/admin/AddPropertyScreen';
import { SetPasswordScreen } from './components/screens/SetPasswordScreen';
import { DesktopSidebar } from './components/common/DesktopSidebar';

// Screens that show the sidebar on desktop
const SIDEBAR_SCREENS = ['dashboard','property-detail','documents','media','settings'];

export default function App() {
  const { navState } = useNavigation();
  const { screen, selectedPropertyId, selectedInvestorId, investorName } = navState;

  const showSidebar = SIDEBAR_SCREENS.includes(screen);

  const content = (
    <div
      key={screen}
      className="screen-enter-forward app-content"
    >
      {screen === 'login'               && <LoginScreen />}
      {screen === 'dashboard'           && <DashboardScreen />}
      {screen === 'property-detail'     && selectedPropertyId && (
        <PropertyDetailScreen propertyId={selectedPropertyId} />
      )}
      {screen === 'documents'           && <DocumentsScreen />}
      {screen === 'media'               && <MediaScreen />}
      {screen === 'settings'            && <SettingsScreen />}

      {/* ── Admin screens ── */}
      {screen === 'admin-dashboard'     && <AdminDashboardScreen />}
      {screen === 'admin-investors'     && <InvestorsListScreen />}
      {screen === 'admin-investor-detail' && selectedInvestorId && (
        <InvestorDetailScreen investorId={selectedInvestorId} />
      )}
      {screen === 'admin-add-investor'  && <AddInvestorScreen />}
      {screen === 'admin-add-property'  && <AddPropertyScreen />}

      {screen === 'set-password' && selectedInvestorId && (
        <SetPasswordScreen
          investorMondayId={selectedInvestorId}
          investorName={investorName ?? ''}
        />
      )}
    </div>
  );

  if (showSidebar) {
    return (
      <div className="app-layout">
        <DesktopSidebar active={screen} />
        {content}
      </div>
    );
  }

  return content;
}
