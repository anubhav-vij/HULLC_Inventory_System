"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  CheckSquare,
  ArrowLeftRight,
  Truck,
  Settings,
  LogOut,
  ChevronDown,
  Users,
  Building2,
  FolderKanban,
  Factory,
  MapPin,
  BarChart3,
  PackagePlus,
  PackageMinus,
  PieChart,
} from "lucide-react";
import type { User } from "@/lib/types";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  roles?: string[];
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "inventory", label: "HULLC Inventory", icon: Package },
  { id: "requests", label: "Product Requests", icon: ClipboardList },
  { id: "approvals", label: "Approvals", icon: CheckSquare, roles: ["Director"] },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight, roles: ["Admin", "ProjectManager", "Chief"] },
  { id: "fulfillments", label: "Fulfillments", icon: Truck, roles: ["Admin", "ProjectManager", "Chief"] },
  {
    id: "configuration",
    label: "Configuration",
    icon: Settings,
    roles: ["Admin", "ProjectManager", "Chief"],
    children: [
      { id: "config-users", label: "Users", icon: Users },
      { id: "config-groups", label: "Functional Groups", icon: Building2 },
      { id: "config-projects", label: "Projects", icon: FolderKanban },
      { id: "config-manufacturers", label: "Manufacturers", icon: Factory },
      { id: "config-locations", label: "Storage Locations", icon: MapPin },
    ],
  },
  {
    id: "metrics",
    label: "Metrics",
    icon: BarChart3,
    roles: ["Admin", "Chief"],
    children: [
      { id: "metrics-dashboard", label: "Charts Dashboard", icon: PieChart },
      { id: "metrics-received", label: "Inventory Received", icon: PackagePlus },
      { id: "metrics-disbursed", label: "Inventory Disbursed", icon: PackageMinus },
    ],
  },
];

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  user: User;
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "sidebar-nav-btn w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors text-left",
        isActive
          ? "sidebar-nav-btn--active border-l-[3px] pl-[17px]"
          : "border-l-[3px] border-transparent hover:pl-[17px]"
      )}
      style={
        isActive
          ? {
              backgroundColor: "#155e5e",
              borderLeftColor: "#80d4d4",
              color: "#ffffff",
            }
          : { color: "#80d4d4" }
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span>{item.label}</span>
    </button>
  );
}

export function Sidebar({ activeView, onNavigate, user, onLogout, mobileOpen, onMobileClose }: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Auto-expand the group that contains the active view
    for (const item of NAV_ITEMS) {
      if (item.children) {
        if (item.children.some(c => c.id === activeView) || activeView === item.id) {
          initial.add(item.id);
        }
      }
    }
    return initial;
  });

  const toggleMenu = (id: string) => {
    setOpenMenus(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  const handleNavClick = (view: string) => {
    onNavigate(view);
    onMobileClose?.();
  };

  return (
    <>
    {mobileOpen && <div className="sidebar-overlay md:hidden" onClick={onMobileClose} />}
    <aside
      className={cn("sidebar-fixed flex flex-col", mobileOpen && "sidebar-open")}
      style={{ backgroundColor: "#0d3d3d" }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo area */}
      <div className="px-6 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <p className="font-bold text-lg leading-tight" style={{ color: "#80d4d4" }}>HULLC</p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(128,212,212,0.55)" }}>
          Inventory System
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {visibleItems.map((item) => {
          if (item.children) {
            // Expandable menu group (Configuration, Metrics, etc.)
            const isOpen = openMenus.has(item.id);
            const isParentActive = item.children.some(c => activeView === c.id) || activeView === item.id;
            const ParentIcon = item.icon;
            return (
              <div key={item.id}>
                <button
                  onClick={() => toggleMenu(item.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    "sidebar-nav-btn w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors text-left",
                    "border-l-[3px] border-transparent",
                    isParentActive && !isOpen && "sidebar-nav-btn--active"
                  )}
                  style={
                    isParentActive && !isOpen
                      ? {
                          backgroundColor: "#155e5e",
                          borderLeftColor: "#80d4d4",
                          color: "#ffffff",
                        }
                      : { color: "#80d4d4" }
                  }
                >
                  <ParentIcon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform opacity-60",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="ml-4" role="group" aria-label={item.label}>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = activeView === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => handleNavClick(child.id)}
                          aria-current={isChildActive ? "page" : undefined}
                          className={cn(
                            "sidebar-nav-btn sidebar-nav-btn--child w-full flex items-center gap-3 px-5 py-2 text-[13px] transition-colors text-left",
                            isChildActive
                              ? "sidebar-nav-btn--active border-l-[2px] pl-[18px]"
                              : "border-l-[2px] border-transparent"
                          )}
                          style={
                            isChildActive
                              ? {
                                  backgroundColor: "#155e5e",
                                  borderLeftColor: "#80d4d4",
                                  color: "#ffffff",
                                }
                              : { color: "rgba(128,212,212,0.75)" }
                          }
                        >
                          <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <NavButton
              key={item.id}
              item={item}
              isActive={isActive}
              onClick={() => handleNavClick(item.id)}
            />
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
            style={{ backgroundColor: "#1a7070", color: "#fff" }}
          >
            {getInitials(user.fullName, user.email)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user.fullName ?? user.email ?? "User"}
            </p>
            <p className="text-xs truncate" style={{ color: "#80d4d4" }}>
              {user.role}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="sidebar-logout-btn w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors"
          style={{ color: "#80d4d4" }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
    </>
  );
}
