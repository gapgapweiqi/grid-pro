import { LayoutDashboard, FilePlus, Clock, CreditCard, Package, Users, UserRound, Briefcase, Settings, UserCircle, BarChart3, Shield, Bell, Download, Ticket, PackageMinus } from 'lucide-svelte';
export interface NavItem {
  path: string;
  label: string;
  icon: any;
  /** Permission key for team access control (maps to PATH_PERM_MAP) */
  permission?: string;
  /** Show this item on the mobile bottom nav bar */
  showOnBottomNav?: boolean;
  /** Show as FAB (floating action button) on bottom nav */
  bottomNavFab?: boolean;
  /** Visual divider before this item */
  dividerBefore?: boolean;
  /** Only visible to admin users */
  adminOnly?: boolean;
}

/**
 * Single source of truth for all navigation items.
 * Used by Sidebar, MobileMenu, and BottomNav.
 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard, permission: 'dashboard', showOnBottomNav: true },
  { path: '/documents', label: 'ออกเอกสาร', icon: FilePlus, permission: 'documents', showOnBottomNav: true, bottomNavFab: true },
  { path: '/documents/history', label: 'ประวัติเอกสาร', icon: Clock, permission: 'history' },
  { path: '/payments', label: 'ติดตามชำระเงิน', icon: CreditCard, permission: 'payments' },
  { path: '/products', label: 'สินค้า/บริการ', icon: Package, permission: 'products', showOnBottomNav: true, dividerBefore: true },
  { path: '/stock', label: 'คลังสินค้า', icon: PackageMinus, permission: 'products' },
  { path: '/customers', label: 'ลูกค้า/ผู้ขาย', icon: Users, permission: 'customers', showOnBottomNav: true },
  { path: '/salespersons', label: 'พนักงานขาย', icon: UserRound, permission: 'salespersons' },
  { path: '/companies', label: 'บริษัทของฉัน', icon: Briefcase, permission: 'companies', dividerBefore: true },
  { path: '/settings', label: 'ตั้งค่า', icon: Settings, permission: 'settings' },
  { path: '/account', label: 'บัญชีของฉัน', icon: UserCircle },
  { path: '/install', label: 'ติดตั้งแอป', icon: Download },
];

/** Sandbox overrides: replace /dashboard with /sandbox */
export const SANDBOX_NAV_ITEMS: NavItem[] = NAV_ITEMS.map(item =>
  item.path === '/dashboard' ? { ...item, path: '/sandbox', label: 'Sandbox' } : item
);

/** Admin-only nav items (shown after main items) */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: 'Admin Dashboard', icon: BarChart3, adminOnly: true },
  { path: '/admin/users', label: 'จัดการผู้ใช้', icon: Shield, adminOnly: true },
  { path: '/admin/notifications', label: 'แจ้งเตือน Push', icon: Bell, adminOnly: true },
  { path: '/admin/coupons', label: 'คูปองส่วนลด', icon: Ticket, adminOnly: true },
];
