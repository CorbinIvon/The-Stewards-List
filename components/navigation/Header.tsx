"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthUser, useLogout } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";

/**
 * Header component props interface
 */
interface HeaderProps {
  /** Callback when mobile menu toggle is clicked */
  onMobileMenuClick?: () => void;
  /** Whether to show mobile menu button */
  showMobileMenu?: boolean;
  /** Custom title to override breadcrumb title */
  title?: string;
}

/**
 * Get role badge color
 */
const getRoleBadgeColor = (
  role: UserRole
):
  | "bg-blue-100 text-blue-800"
  | "bg-purple-100 text-purple-800"
  | "bg-green-100 text-green-800"
  | "bg-gray-100 text-gray-800" => {
  switch (role) {
    case UserRole.ADMIN:
      return "bg-blue-100 text-blue-800";
    case UserRole.MANAGER:
      return "bg-purple-100 text-purple-800";
    case UserRole.MEMBER:
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

/**
 * Header component for dashboard
 * Displays page breadcrumbs/title and user menu with profile, settings, and logout options.
 *
 * Features:
 * - Breadcrumb navigation based on current route
 * - User menu dropdown with role display
 * - Links to profile and settings
 * - Logout functionality
 * - Mobile hamburger button support
 * - Accessible keyboard navigation (Escape to close, arrow keys to navigate)
 * - Click outside to close dropdown
 * - Tailwind CSS styling with white background and bottom border
 *
 * @example
 * ```tsx
 * const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
 *
 * return (
 *   <Header
 *     onMobileMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
 *     showMobileMenu={true}
 *     title="My Dashboard"
 *   />
 * );
 * ```
 */
export const Header = React.forwardRef<HTMLElement, HeaderProps>(
  ({ onMobileMenuClick, showMobileMenu = true, title }, ref) => {
    const pathname = usePathname();
    const router = useRouter();
    const user = useAuthUser();
    const logout = useLogout();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const dropdownItemsRef = useRef<(HTMLAnchorElement | HTMLButtonElement)[]>(
      []
    );
    const [focusedItemIndex, setFocusedItemIndex] = useState<number>(-1);

    // Generate page title from pathname if no custom title provided
    const getPageTitle = (path: string): string => {
      if (title) return title;

      const segments = path.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];

      if (!lastSegment || lastSegment === "dashboard") {
        return "Dashboard";
      }

      // Convert kebab-case or snake_case to Title Case
      return lastSegment
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    };

    const pageTitle = getPageTitle(pathname);

    /**
     * Handle logout with navigation
     */
    const handleLogout = useCallback(async (): Promise<void> => {
      try {
        await logout();
        setIsDropdownOpen(false);
        router.push("/login");
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }, [logout, router]);

    /**
     * Close dropdown
     */
    const closeDropdown = useCallback((): void => {
      setIsDropdownOpen(false);
      setFocusedItemIndex(-1);
      menuButtonRef.current?.focus();
    }, []);

    /**
     * Handle keyboard navigation in dropdown
     */
    const handleDropdownKeyDown = useCallback(
      (event: React.KeyboardEvent): void => {
        if (!isDropdownOpen) {
          return;
        }

        const items = dropdownItemsRef.current;
        const itemCount = items.length;

        switch (event.key) {
          case "Escape":
            event.preventDefault();
            closeDropdown();
            break;

          case "ArrowDown":
            event.preventDefault();
            setFocusedItemIndex((prev) =>
              prev < itemCount - 1 ? prev + 1 : 0
            );
            break;

          case "ArrowUp":
            event.preventDefault();
            setFocusedItemIndex((prev) =>
              prev > 0 ? prev - 1 : itemCount - 1
            );
            break;

          case "Home":
            event.preventDefault();
            setFocusedItemIndex(0);
            break;

          case "End":
            event.preventDefault();
            setFocusedItemIndex(itemCount - 1);
            break;

          case "Enter":
          case " ":
            event.preventDefault();
            if (focusedItemIndex >= 0 && focusedItemIndex < itemCount) {
              // eslint-disable-next-line security/detect-object-injection
              items[focusedItemIndex]?.click();
            }
            break;

          default:
            break;
        }
      },
      [isDropdownOpen, focusedItemIndex, closeDropdown]
    );

    /**
     * Focus management for dropdown keyboard navigation
     */
    useEffect(() => {
      if (isDropdownOpen && focusedItemIndex >= 0) {
        // eslint-disable-next-line security/detect-object-injection
        dropdownItemsRef.current[focusedItemIndex]?.focus();
      }
    }, [isDropdownOpen, focusedItemIndex]);

    /**
     * Handle click outside dropdown to close it
     */
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent): void => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          menuButtonRef.current &&
          !menuButtonRef.current.contains(event.target as Node)
        ) {
          setIsDropdownOpen(false);
          setFocusedItemIndex(-1);
        }
      };

      if (isDropdownOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
      }
    }, [isDropdownOpen]);

    if (!user) {
      return null;
    }

    const displayName = user.username || user.email;
    const roleBadgeColor = getRoleBadgeColor(user.role);

    return (
      <header
        ref={ref}
        className="sticky top-0 z-30 w-full bg-[color:var(--panel)] border-b border-[color:var(--border)] shadow-sm"
      >
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left section: Mobile menu button and breadcrumbs/title */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Mobile hamburger button */}
              {showMobileMenu && (
                <button
                  onClick={onMobileMenuClick}
                  className="lg:hidden p-2 text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--border)] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="Toggle mobile menu"
                  type="button"
                >
                  <svg
                    className="w-6 h-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
              )}

              {/* Page title */}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-[color:var(--text)] truncate">
                  {pageTitle}
                </h1>
              </div>
            </div>

            {/* Right section: User menu */}
            <div className="relative" ref={dropdownRef}>
              {/* Menu button */}
              <button
                ref={menuButtonRef}
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen);
                  setFocusedItemIndex(-1);
                }}
                onKeyDown={handleDropdownKeyDown}
                className="flex items-center gap-2 px-3 py-2 text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--border)] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                aria-label={`User menu for ${displayName}`}
                type="button"
              >
                {/* User avatar */}
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>

                {/* User info - hidden on mobile */}
                <div className="hidden sm:flex flex-col items-start min-w-0">
                  <span className="text-sm font-medium text-[color:var(--text)] truncate">
                    {displayName}
                  </span>
                  <span className="text-xs text-[color:var(--muted)] truncate">
                    {user.email}
                  </span>
                </div>

                {/* Chevron icon */}
                <svg
                  className={cn(
                    "w-4 h-4 text-[color:var(--muted)] transition-transform flex-shrink-0",
                    isDropdownOpen && "rotate-180"
                  )}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </button>

              {/* Dropdown menu */}
              {isDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-[color:var(--panel)] border-[color:var(--border)] rounded-lg shadow-lg py-1 z-50"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {/* User info header - shown on mobile */}
                  <div className="sm:hidden px-4 py-3 border-b border-[color:var(--border)]">
                    <p className="text-sm font-medium text-[color:var(--text)]">
                      {displayName}
                    </p>
                    <p className="text-xs text-[color:var(--muted)] mt-1">
                      {user.email}
                    </p>
                  </div>

                  {/* Role badge */}
                  <div className="px-4 py-3 border-b border-[color:var(--border)]">
                    <span
                      className={cn(
                        "inline-block px-2 py-1 text-xs font-medium rounded",
                        roleBadgeColor
                      )}
                    >
                      {user.role}
                    </span>
                  </div>

                  {/* Profile link */}
                  <Link
                    href="/profile"
                    ref={(el) => {
                      if (el) dropdownItemsRef.current[0] = el;
                    }}
                    onKeyDown={handleDropdownKeyDown}
                    className="block w-full text-left px-4 py-2 text-sm text-[color:var(--text)] hover:bg-[color:var(--border)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    My Profile
                  </Link>

                  {/* Settings link */}
                  <Link
                    href="/settings"
                    ref={(el) => {
                      if (el) dropdownItemsRef.current[1] = el;
                    }}
                    onKeyDown={handleDropdownKeyDown}
                    className="block w-full text-left px-4 py-2 text-sm text-[color:var(--text)] hover:bg-[color:var(--border)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    Settings
                  </Link>

                  {/* Divider */}
                  <div className="border-t border-[color:var(--border)]" />

                  {/* Logout button */}
                  <button
                    ref={(el) => {
                      if (el) dropdownItemsRef.current[2] = el;
                    }}
                    onClick={handleLogout}
                    onKeyDown={handleDropdownKeyDown}
                    className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[color:var(--border)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset"
                    role="menuitem"
                    type="button"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }
);

Header.displayName = "Header";

export default Header;
