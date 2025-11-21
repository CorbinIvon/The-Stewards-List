"use client";

/**
 * Sidebar navigation component
 * Displays role-based menu items with active route highlighting
 * Mobile-friendly with responsive design
 * Requires AuthProvider to be wrapping the component tree
 */

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthUser, useLogout } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";

// ============================================================================
// MENU ITEM INTERFACE
// ============================================================================

interface MenuItem {
  label: string;
  href: string;
  icon: string;
  requiredRoles?: UserRole[];
}

// ============================================================================
// ICON COMPONENTS
// ============================================================================

const IconDashboard = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 16l9-5V7l-9-4-9 4v12l9 5z"
    />
  </svg>
);

const IconTasks = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const IconUsers = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.354a4 4 0 110 8.048M12 4.354L9.172 8.22a4 4 0 005.656 0L12 4.354zm0 8.048l3.172 3.866a4 4 0 01-5.656 5.656l3.484-4.526m0 0a4 4 0 015.656 0"
    />
  </svg>
);

const IconProfile = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

const IconProjects = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7a2 2 0 012-2h14a2 2 0 012 2m0 0h2.25A2.25 2.25 0 0124 9.25v9.5A2.25 2.25 0 0121.75 21H2.25A2.25 2.25 0 010 18.75v-9.5A2.25 2.25 0 012.25 7H3"
    />
  </svg>
);

const IconSettings = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const IconLogout = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const IconMenu = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);

const IconClose = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({
  isOpen = false,
  onClose,
}: SidebarProps): React.ReactElement {
  const user = useAuthUser();
  const pathname = usePathname();
  const logout = useLogout();

  /**
   * Menu items with role-based visibility
   */
  const menuItems: MenuItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: "dashboard",
    },
    {
      label: "Tasks",
      href: "/tasks",
      icon: "tasks",
    },
    {
      label: "Projects",
      href: "/projects",
      icon: "projects",
    },
    {
      label: "Users",
      href: "/users",
      icon: "users",
      requiredRoles: [UserRole.ADMIN, UserRole.MANAGER],
    }
  ];

  /**
   * Get icon component based on icon name
   */
  const getIcon = (iconName: string): React.ReactElement => {
    switch (iconName) {
      case "dashboard":
        return <IconDashboard />;
      case "tasks":
        return <IconTasks />;
      case "projects":
        return <IconProjects />;
      case "users":
        return <IconUsers />;
      case "profile":
        return <IconProfile />;
      case "settings":
        return <IconSettings />;
      default:
        return <div />;
    }
  };

  /**
   * Check if current user has permission to view menu item
   */
  const canViewMenuItem = (item: MenuItem): boolean => {
    if (!item.requiredRoles) {
      return true;
    }
    return user ? item.requiredRoles.includes(user.role) : false;
  };

  /**
   * Check if route is currently active
   */
  const isActive = (href: string): boolean => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  /**
   * Handle logout
   */
  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      closeSidebar();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  /**
   * Close sidebar on mobile
   */
  const closeSidebar = (): void => {
    onClose?.();
  };

  return (
    <>
      {/* Mobile sidebar overlay - only visible on mobile when open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white shadow-lg z-40 transform transition-transform duration-300 ease-in-out flex flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo/App name section */}
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-white">The Stewards List</h1>
          {user && (
            <p className="text-sm text-slate-400 mt-1">{user.username}</p>
          )}
        </div>

        {/* Navigation menu */}
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-2 px-4">
            {menuItems.map((item) => {
              if (!canViewMenuItem(item)) {
                return null;
              }

              const active = isActive(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {getIcon(item.icon)}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout button at bottom */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-colors duration-200"
            aria-label="Log out"
          >
            <IconLogout />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
