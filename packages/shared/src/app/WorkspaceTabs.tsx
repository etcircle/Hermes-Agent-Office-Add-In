import { KeyboardEvent, ReactNode, useRef } from 'react';

export interface OfficeWorkspaceTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface WorkspaceTabsProps {
  workspaces: readonly OfficeWorkspaceTab[];
  activeWorkspaceId: string;
  onSelect: (workspaceId: string) => void;
}

export function WorkspaceTabs({ workspaces, activeWorkspaceId, onSelect }: WorkspaceTabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusWorkspace(workspaceId: string) {
    tabRefs.current[workspaceId]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (!workspaces.length) {
      return;
    }

    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % workspaces.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + workspaces.length) % workspaces.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = workspaces.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextWorkspace = workspaces[nextIndex];

    if (nextWorkspace) {
      onSelect(nextWorkspace.id);
      focusWorkspace(nextWorkspace.id);
    }
  }

  return (
    <div className="ha-workspace-tabs" role="tablist" aria-label="Office workspaces">
      {workspaces.map((workspace, index) => {
        const isActive = workspace.id === activeWorkspaceId;

        return (
          <button
            key={workspace.id}
            id={`workspace-tab-${workspace.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`workspace-panel-${workspace.id}`}
            tabIndex={isActive ? 0 : -1}
            className={`ha-workspace-tabs__tab${isActive ? ' ha-workspace-tabs__tab--active' : ''}`}
            onClick={() => onSelect(workspace.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(node) => {
              tabRefs.current[workspace.id] = node;
            }}
          >
            {workspace.label}
          </button>
        );
      })}
    </div>
  );
}
