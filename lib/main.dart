import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/services/firebase_service.dart';
import 'core/theme/app_theme.dart';
import 'core/providers/providers.dart';
import 'core/models/models.dart';
import 'features/auth/auth_screen.dart';
import 'features/auth/force_password_change_screen.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'features/businesses/businesses_screen.dart';
import 'features/branches/branches_screen.dart';
import 'features/reviews/reviews_screen.dart';
import 'features/analytics/analytics_screen.dart';
import 'features/reports/reports_screen.dart';
import 'features/notifications/notification_center_screen.dart';
import 'features/team/team_screen.dart';
import 'features/licenses/license_screen.dart';
import 'features/super_admin/super_admin_screen.dart';
import 'features/public_review/public_customer_review_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FirebaseService.initialize();
  runApp(const ProviderScope(child: ReviewFlowApp()));
}

class ReviewFlowApp extends StatelessWidget {
  const ReviewFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ReviewFlow',
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.light,
      debugShowCheckedModeBanner: false,
      onGenerateRoute: (settings) {
        // Handle public customer QR review experience route: /review/:token
        final uri = Uri.parse(settings.name ?? '/');
        if (uri.pathSegments.isNotEmpty && uri.pathSegments.first == 'review') {
          final token = uri.pathSegments.length > 1 ? uri.pathSegments[1] : '';
          return MaterialPageRoute(
            builder: (_) => PublicCustomerReviewScreen(token: token),
          );
        }
        return MaterialPageRoute(builder: (_) => const AppRootGate());
      },
    );
  }
}

class AppRootGate extends ConsumerWidget {
  const AppRootGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    return authState.when(
      data: (user) {
        if (user == null) {
          return const AuthScreen();
        }

        final userProfileAsync = ref.watch(currentUserProfileProvider);
        return userProfileAsync.when(
          data: (profile) {
            if (profile == null) {
              return const Scaffold(body: Center(child: Text('Loading profile...')));
            }

            if (profile.forcePasswordChange) {
              return const ForcePasswordChangeScreen();
            }

            return const MainNavigationShell();
          },
          loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
          error: (e, _) => Scaffold(
            body: Center(child: Text('Error loading user profile: $e')),
          ),
        );
      },
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('Auth error: $e'))),
    );
  }
}

class MainNavigationShell extends ConsumerStatefulWidget {
  const MainNavigationShell({super.key});

  @override
  ConsumerState<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends ConsumerState<MainNavigationShell> {
  int _currentIndex = 0;

  final List<Widget> _primaryScreens = const [
    DashboardScreen(),
    BusinessesScreen(),
    BranchesScreen(),
    ReviewsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final userProfile = ref.watch(currentUserProfileProvider).value;

    return Scaffold(
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: AppColors.brandPrimary),
              accountName: Text(userProfile?.name ?? 'User', style: const TextStyle(fontWeight: FontWeight.bold)),
              accountEmail: Text('${userProfile?.email ?? ""} • ${userProfile?.role.value ?? ""}'),
              currentAccountPicture: CircleAvatar(
                backgroundColor: AppColors.brandLight,
                child: Text(
                  userProfile?.name.isNotEmpty == true ? userProfile!.name[0].toUpperCase() : 'U',
                  style: const TextStyle(color: AppColors.brandPrimary, fontWeight: FontWeight.bold, fontSize: 24),
                ),
              ),
            ),
            if (userProfile?.hasPermission(AppPermissions.viewDashboard) ?? true) ...[
              ListTile(
                leading: const Icon(Icons.analytics_outlined),
                title: const Text('Analytics'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const AnalyticsScreen()));
                },
              ),
            ],
            if (userProfile?.hasPermission(AppPermissions.viewReports) ?? true) ...[
              ListTile(
                leading: const Icon(Icons.picture_as_pdf_outlined),
                title: const Text('Reports & Export'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const ReportsScreen()));
                },
              ),
            ],
            if (userProfile?.hasPermission(AppPermissions.receiveAlerts) ?? true) ...[
              ListTile(
                leading: const Icon(Icons.notifications_outlined),
                title: const Text('Notifications'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationCenterScreen()));
                },
              ),
            ],
            if (userProfile?.hasPermission(AppPermissions.manageTeam) ?? false) ...[
              ListTile(
                leading: const Icon(Icons.group_outlined),
                title: const Text('Team Management'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const TeamScreen()));
                },
              ),
            ],
            if (userProfile?.hasPermission(AppPermissions.manageLicense) ?? false) ...[
              ListTile(
                leading: const Icon(Icons.card_membership_outlined),
                title: const Text('License & Billing'),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const LicenseScreen()));
                },
              ),
            ],
            if (userProfile?.role == UserRole.superAdmin) ...[
              const Divider(),
              ListTile(
                leading: const Icon(Icons.admin_panel_settings_outlined, color: AppColors.poor),
                title: const Text('Super Admin Portal', style: TextStyle(color: AppColors.poor, fontWeight: FontWeight.bold)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const SuperAdminScreen()));
                },
              ),
            ],
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout_rounded),
              title: const Text('Sign Out'),
              onTap: () async {
                await ref.read(authServiceProvider).signOut();
              },
            ),
          ],
        ),
      ),
      body: _primaryScreens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard_rounded),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.storefront_outlined),
            activeIcon: Icon(Icons.storefront_rounded),
            label: 'Businesses',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.location_on_outlined),
            activeIcon: Icon(Icons.location_on_rounded),
            label: 'Branches',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.rate_review_outlined),
            activeIcon: Icon(Icons.rate_review_rounded),
            label: 'Reviews',
          ),
        ],
      ),
    );
  }
}
