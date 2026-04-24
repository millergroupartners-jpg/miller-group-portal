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
import { AdminPropertiesScreen } from './components/screens/admin/AdminPropertiesScreen';
import { AdminMGDealsScreen } from './components/screens/admin/AdminMGDealsScreen';
import { AdminClosingsScreen } from './components/screens/admin/AdminClosingsScreen';
import { AdminInquiriesScreen } from './components/screens/admin/AdminInquiriesScreen';
import { AdminRenovationsScreen } from './components/screens/admin/AdminRenovationsScreen';
import { AdminUtilitiesScreen } from './components/screens/admin/AdminUtilitiesScreen';
import { InvestorUtilitiesScreen } from './components/screens/InvestorUtilitiesScreen';
import { InquiriesScreen } from './components/screens/InquiriesScreen';
import { InvestorRenovationsScreen } from './components/screens/InvestorRenovationsScreen';
import { InvestorTimelineScreen } from './components/screens/InvestorTimelineScreen';
import { SetPasswordScreen } from './components/screens/SetPasswordScreen';
import { DesktopSidebar } from './components/common/DesktopSidebar';
import { BottomTabBar } from './components/common/BottomTabBar';
import { MobileTopActions } from './components/common/MobileTopActions';

// Screens that show the sidebar on desktop
const SIDEBAR_SCREENS = [
  'dashboard','property-detail','documents','media','inquiries','settings','renovations','utilities','timeline',
  'admin-dashboard','admin-investors','admin-investor-detail','admin-properties','admin-mg-deals','admin-closings','admin-inquiries','admin-renovations','admin-utilities',
];

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
      {screen === 'inquiries'           && <InquiriesScreen />}
      {screen === 'renovations'         && <InvestorRenovationsScreen />}
      {screen === 'utilities'           && <InvestorUtilitiesScreen />}
      {screen === 'timeline'            && <InvestorTimelineScreen />}
      {screen === 'settings'            && <SettingsScreen />}

      {/* ── Admin screens ── */}
      {screen === 'admin-dashboard'     && <AdminDashboardScreen />}
      {screen === 'admin-investors'     && <InvestorsListScreen />}
      {screen === 'admin-investor-detail' && selectedInvestorId && (
        <InvestorDetailScreen investorId={selectedInvestorId} />
      )}
      {screen === 'admin-properties'    && <AdminPropertiesScreen />}
      {screen === 'admin-mg-deals'      && <AdminMGDealsScreen />}
      {screen === 'admin-closings'      && <AdminClosingsScreen />}
      {screen === 'admin-inquiries'     && <AdminInquiriesScreen />}
      {screen === 'admin-renovations'   && <AdminRenovationsScreen />}
      {screen === 'admin-utilities'     && <AdminUtilitiesScreen />}

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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {content}
          <BottomTabBar active={screen} />
        </div>
        {/* Mobile-only floating action cluster: bell, settings, back-to-admin */}
        <MobileTopActions active={screen} />
      </div>
    );
  }

  return content;
}
