import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import { FolderOpen } from 'lucide-react';
import type { AnchorHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditorStore } from '@/stores/useEditorStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { parseLocalFileHref } from '@/utils/localFileLinks';

function openInFilesPanel(path: string) {
  const layout = useLayoutStore.getState();
  layout.setRightPanelOpen(true);
  layout.setActiveRightPanelTab('files');
  useEditorStore.getState().openFile(path);
}

/**
 * Link renderer for chat markdown. A link to a file the agent saved opens it in
 * the Files panel (with a small button to show it in Explorer); web links open
 * in the system browser instead of the renderer's unsupported external-link
 * dialog.
 */
export function MarkdownLink({ href, children }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { t } = useTranslation('thread');
  const localPath = parseLocalFileHref(href);

  if (localPath) {
    return (
      <span className="inline-flex items-center gap-1 align-baseline">
        <button
          type="button"
          className="text-primary underline underline-offset-2 hover:opacity-80"
          onClick={() => openInFilesPanel(localPath)}
        >
          {children}
        </button>
        <button
          type="button"
          aria-label={t('item.showInFolder')}
          title={t('item.showInFolder')}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => revealItemInDir(localPath)}
        >
          <FolderOpen className="size-3.5" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      onClick={(event) => {
        event.preventDefault();
        if (href) void openUrl(href);
      }}
    >
      {children}
    </a>
  );
}
