"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { signOut, switchRole } from "@/app/sign-in/actions";
import { Glyph } from "../icons/Glyph";
import { UpdatedAgo, LocalTime } from "../ui/LocalTime";
import { Tag } from "../ui/Tag";
import { fmtDate } from "@/lib/dashboard/panel";
import styles from "./dashboard.module.css";

interface Props {
  generatedAt: string | null;
  asOf: string | null;
  source: "live" | "snapshot" | null;
  view: "map" | "list";
  onView: (v: "map" | "list") => void;
  onRefresh: () => void;
  refreshing: boolean;
  role: "network_admin" | "hospital_admin";
  ownHospitalId: string | null;
  hospitals: { id: string; name: string }[];
  demoAuth: boolean;
  onRoleError: (msg: string) => void;
  onLogs: () => void;
  logsOpen: boolean;
  onEvents: () => void;
  eventsOpen: boolean;
}

function roleLabel(role: Props["role"], own: string | null, hospitals: Props["hospitals"]) {
  if (role === "network_admin") return "Network admin";
  return `Hospital admin, ${hospitals.find((h) => h.id === own)?.name ?? own ?? "unknown"}`;
}

/** Floating top bar (`dashboard-header`). XS folds the view toggle and role switcher into a menu. */
export function TopBar(p: Props) {
  const [menu, setMenu] = useState<"role" | "xs" | null>(null);
  const [pending, start] = useTransition();
  const roleBtn = useRef<HTMLButtonElement>(null);
  const xsBtn = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        setMenu(null);
        (menu === "role" ? roleBtn : xsBtn).current?.focus();
        return;
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("keydown", close, true);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close, true);
      document.removeEventListener("mousedown", close);
    };
  }, [menu]);

  const choose = (role: Props["role"], hospitalId?: string) => {
    setMenu(null);
    const fd = new FormData();
    fd.set("role", role);
    if (hospitalId) fd.set("hospitalId", hospitalId);
    start(async () => {
      const res = await switchRole(fd);
      if (res.error) p.onRoleError(res.error);
    });
  };

  const roleItems = (
    <>
      <p className={styles.menuHeading}>Demo role</p>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={p.role === "network_admin"}
        className={styles.menuItem}
        onClick={() => choose("network_admin")}
        data-testid="role-switcher-network_admin"
      >
        Network admin
      </button>
      {p.hospitals.map((h) => (
        <button
          key={h.id}
          type="button"
          role="menuitemradio"
          aria-checked={p.role === "hospital_admin" && p.ownHospitalId === h.id}
          className={styles.menuItem}
          onClick={() => choose("hospital_admin", h.id)}
          data-testid={`role-switcher-hospital_admin-${h.id}`}
        >
          Hospital admin, {h.name}
        </button>
      ))}
    </>
  );

  const viewToggle = (
    <div className={styles.segment} role="group" aria-label="View" data-testid="view-toggle">
      <button type="button" aria-pressed={p.view === "map"} onClick={() => p.onView("map")}>
        <Glyph name="map" /> Map
      </button>
      <button type="button" aria-pressed={p.view === "list"} onClick={() => p.onView("list")}>
        <Glyph name="list" /> List
      </button>
    </div>
  );

  const signOutForm = (
    <form action={signOut}>
      <button type="submit" className={styles.outlineButton} data-testid="sign-out">
        Sign out
      </button>
    </form>
  );

  return (
    <header className={`${styles.topbar} ${menu ? styles.menuOpen : ""}`} data-testid="dashboard-header">
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>
          Sanjeevini
        </h1>
        {p.generatedAt ? (
          <p className={styles.stamp}>
            <span data-testid="header-timestamp" title={`Generated ${p.generatedAt}`}>
              <UpdatedAgo iso={p.generatedAt} />
              <span className={styles.asOf}> · as of {fmtDate(p.asOf)}</span>
            </span>
            {p.source ? <Tag tone={p.source === "live" ? "outline" : "muted"}>{p.source === "live" ? "Live" : "Snapshot"}</Tag> : null}
            <span className="sr-only">
              Generated <LocalTime iso={p.generatedAt} format="datetime" />
            </span>
          </p>
        ) : null}
      </div>

      <div className={styles.controls}>
        {viewToggle}
        <div className={styles.menuWrap} ref={menu === "role" ? menuRef : undefined}>
          <button
            ref={roleBtn}
            type="button"
            className={styles.outlineButton}
            aria-haspopup="menu"
            aria-expanded={menu === "role"}
            onClick={() => setMenu(menu === "role" ? null : "role")}
            disabled={!p.demoAuth || pending}
            title={p.demoAuth ? undefined : "Role switching needs DEMO_AUTH=true"}
            data-testid="role-switcher"
          >
            Role: {roleLabel(p.role, p.ownHospitalId, p.hospitals)}
            <Glyph name="chevron-down" size={12} />
          </button>
          {menu === "role" ? (
            <div className={styles.menu} role="menu" aria-label="Demo role">
              {roleItems}
            </div>
          ) : null}
        </div>
        <a className={styles.outlineButton} href="/insights" data-testid="insights-link">
          Insights
        </a>
        <button type="button" className={styles.outlineButton} onClick={p.onLogs} aria-pressed={p.logsOpen} data-testid="logs-button">
          Logs
        </button>
        <button type="button" className={styles.outlineButton} onClick={p.onEvents} aria-pressed={p.eventsOpen} data-testid="events-button">
          Events
        </button>
        <button type="button" className={styles.outlineButton} onClick={p.onRefresh} disabled={p.refreshing} data-testid="refresh-button">
          <Glyph name="refresh" />
          {p.refreshing ? "Refreshing" : "Refresh"}
        </button>
        {signOutForm}
      </div>

      <div className={styles.xsControls}>
        <button type="button" className={styles.iconButton} onClick={p.onRefresh} aria-label="Refresh results" data-testid="refresh-button-xs">
          <Glyph name="refresh" size={20} />
        </button>
        <div className={styles.menuWrap} ref={menu === "xs" ? menuRef : undefined}>
          <button
            ref={xsBtn}
            type="button"
            className={styles.iconButton}
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menu === "xs"}
            onClick={() => setMenu(menu === "xs" ? null : "xs")}
          >
            <Glyph name="menu" size={20} />
          </button>
          {menu === "xs" ? (
            <div className={styles.menu} role="menu" aria-label="Menu">
              <div className={styles.menuRow}>{viewToggle}</div>
              <div className={styles.menuRule} />
              {p.demoAuth ? roleItems : <p className={styles.menuHeading}>Role: {roleLabel(p.role, p.ownHospitalId, p.hospitals)}</p>}
              <div className={styles.menuRule} />
              <a role="menuitem" className={styles.menuItem} href="/insights">
                Insights (charts)
              </a>
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { setMenu(null); p.onLogs(); }}>
                Activity log
              </button>
              <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { setMenu(null); p.onEvents(); }}>
                Local events
              </button>
              <div className={styles.menuRule} />
              <div className={styles.menuRow}>{signOutForm}</div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
