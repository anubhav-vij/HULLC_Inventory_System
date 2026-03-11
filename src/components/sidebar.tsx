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
];

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  user: User;
  onLogout: () => void;
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
      className={cn(
        "w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors text-left",
        isActive
          ? "border-l-[3px] pl-[17px]"
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
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "rgba(128,212,212,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
        }
      }}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span>{item.label}</span>
    </button>
  );
}

export function Sidebar({ activeView, onNavigate, user, onLogout }: SidebarProps) {
  const [configOpen, setConfigOpen] = useState(() =>
    activeView.startsWith("config-") || activeView === "configuration"
  );

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  const isConfigChild = activeView.startsWith("config-");

  return (
    <aside
      className="sidebar-fixed flex flex-col"
      style={{ backgroundColor: "#0d3d3d" }}
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
            // Expandable configuration menu
            const isParentActive = isConfigChild || activeView === "configuration";
            return (
              <div key={item.id}>
                <button
                  onClick={() => setConfigOpen((prev) => !prev)}
                  className={cn(
                    "w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors text-left",
                    "border-l-[3px] border-transparent"
                  )}
                  style={
                    isParentActive && !configOpen
                      ? {
                          backgroundColor: "#155e5e",
                          borderLeftColor: "#80d4d4",
                          color: "#ffffff",
                        }
                      : { color: "#80d4d4" }
                  }
                  onMouseEnter={(e) => {
                    if (!isParentActive || configOpen) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                        "rgba(128,212,212,0.08)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isParentActive || configOpen) {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
                    }
                  }}
                >
                  <Settings className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform opacity-60",
                      configOpen && "rotate-180"
                    )}
                  />
                </button>
                {configOpen && (
                  <div className="ml-4">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = activeView === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => onNavigate(child.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-5 py-2 text-[13px] transition-colors text-left",
                            isChildActive
                              ? "border-l-[2px] pl-[18px]"
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
                          onMouseEnter={(e) => {
                            if (!isChildActive) {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                                "rgba(128,212,212,0.08)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isChildActive) {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
                            }
                          }}
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
              onClick={() => onNavigate(item.id)}
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
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors"
          style={{ color: "#80d4d4" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "rgba(128,212,212,0.08)";
            (e.currentTarget as HTMLButtonElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = "";
            (e.currentTarget as HTMLButtonElement).style.color = "#80d4d4";
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
