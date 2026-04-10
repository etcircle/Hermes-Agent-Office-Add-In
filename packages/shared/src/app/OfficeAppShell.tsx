import { ReactNode, useEffect, useMemo, useState } from 'react';
import { OfficeWorkspaceTab, WorkspaceTabs } from './WorkspaceTabs';

interface OfficeAppShellProps {
  productName: string;
  hostName: string;
  workspaces: readonly OfficeWorkspaceTab[];
  defaultWorkspaceId?: string;
  onLogout?: () => void | Promise<void>;
  logoutLabel?: string;
  logoutDisabled?: boolean;
  toolbarContent?: ReactNode;
}

export function OfficeAppShell({
  productName,
  hostName,
  workspaces,
  defaultWorkspaceId,
  onLogout,
  logoutLabel = 'Log out',
  logoutDisabled = false,
  toolbarContent,
}: OfficeAppShellProps) {
  const initialWorkspaceId = useMemo(
    () => defaultWorkspaceId ?? workspaces[0]?.id ?? '',
    [defaultWorkspaceId, workspaces],
  );
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(initialWorkspaceId);

  useEffect(() => {
    if (!workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
      setActiveWorkspaceId(initialWorkspaceId);
    }
  }, [activeWorkspaceId, initialWorkspaceId, workspaces]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="ha-office-shell">
      <div className="ha-office-shell__toolbar">
        <div>
          <div className="ha-office-shell__product">{productName}</div>
          <div className="ha-office-shell__host">{hostName}</div>
        </div>
        <div className="ha-office-shell__toolbar-actions">
          {toolbarContent}
          {onLogout ? (
            <button
              type="button"
              className="ha-office-shell__logout"
              onClick={() => void onLogout()}
              disabled={logoutDisabled}
            >
              {logoutLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className="ha-card ha-office-shell__card">
        <WorkspaceTabs
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspace.id}
          onSelect={setActiveWorkspaceId}
        />
        {workspaces.map((workspace) => {
          const isActive = workspace.id === activeWorkspace.id;

          return (
            <div
              key={workspace.id}
              id={`workspace-panel-${workspace.id}`}
              role="tabpanel"
              aria-labelledby={`workspace-tab-${workspace.id}`}
              className={`ha-office-shell__workspace${isActive ? ' ha-office-shell__workspace--active' : ''}`}
              hidden={!isActive}
            >
              {workspace.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { OfficeWorkspaceTab } from './WorkspaceTabs';
