import { useState, useEffect } from 'react';
import { X, FileText, Globe, FileCode, Copy, Check, CheckCircle2 } from 'lucide-react';
import { Lang, t } from '../../services/i18n';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  documentTitle: string;
  currentPageContent: any[];
  allPages: { id: string; title: string; content: any[] }[];
}

export default function ExportModal({
  isOpen,
  onClose,
  lang,
  documentTitle,
  currentPageContent,
  allPages,
}: ExportModalProps) {
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Стан для плавної анімації закриття
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
    }
  }, [isOpen]);

  const handleStartClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleStartClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen && !isClosing) return null;
  const strings = t[lang];

  const safeFilename = documentTitle
    .replace(/[/\\?%*:|"<>.,]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Flins_Document';

  const blocksToMarkdown = (blocks: any[]): string => {
    return blocks
      .map((block) => {
        let text = "";
        if (Array.isArray(block.content)) {
          text = block.content.map((c: any) => c.text || "").join("");
        } else if (typeof block.content === 'string') {
          text = block.content;
        }

        switch (block.type) {
          case 'heading':
            const level = block.props?.level || 1;
            return `${'#'.repeat(level)} ${text}\n`;
          case 'bulletListItem':
            return `- ${text}`;
          case 'numberedListItem':
            return `1. ${text}`;
          case 'checkListItem':
            return `- [${block.props?.checked ? 'x' : ' '}] ${text}`;
          case 'paragraph':
          default:
            return `${text}\n`;
        }
      })
      .join('\n');
  };

  const getFullMarkdown = () => {
    if (exportScope === 'current') {
      return `# ${documentTitle}\n\n` + blocksToMarkdown(currentPageContent);
    } else {
      return (
        `# ${documentTitle}\n\n` +
        allPages
          .map((p, idx) => `## ${p.title || `Sheet ${idx + 1}`}\n\n${blocksToMarkdown(p.content || [])}`)
          .join('\n\n---\n\n')
      );
    }
  };

  const triggerSafeDownload = (content: string, filename: string, formatLabel: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setDownloadSuccess(formatLabel);

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);

    setTimeout(() => {
      setDownloadSuccess(null);
      handleStartClose();
    }, 1200);
  };

  const handleExportMarkdown = () => {
    triggerSafeDownload(getFullMarkdown(), `${safeFilename}_${exportScope}.md`, 'Markdown (.md)');
  };

  const handleExportHTML = () => {
    const md = getFullMarkdown();
    const htmlTemplate = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${documentTitle}</title>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Lora', Georgia, serif; background-color: #FAF7F2; color: #3C3836; line-height: 1.8; padding: 40px 20px; margin: 0; }
    .paper { max-width: 720px; margin: 0 auto; background: #FFFFFF; padding: 50px 60px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    h1 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 26px; border-bottom: 2px solid #E8E1D7; padding-bottom: 12px; margin-bottom: 24px; color: #C87D55; }
    h2 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; margin-top: 36px; color: #3C3836; }
    hr { border: 0; border-top: 1px dashed #E8E1D7; margin: 40px 0; }
    p { margin-bottom: 16px; font-size: 16px; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #C87D55; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-family: sans-serif; font-size: 13px; cursor: pointer; }
    @media print { body { background: white !important; padding: 0 !important; } .paper { box-shadow: none !important; padding: 0 !important; max-width: 100% !important; } .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">${lang === 'uk' ? 'Зберегти як PDF / Друк' : 'Print / Save as PDF'}</button>
  <div class="paper">
    ${md
      .split('\n')
      .map(line => {
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
        if (line.startsWith('---')) return `<hr/>`;
        if (line.trim() === '') return '';
        return `<p>${line}</p>`;
      })
      .join('\n')}
  </div>
</body>
</html>`;

    triggerSafeDownload(htmlTemplate, `${safeFilename}.html`, 'HTML / PDF');
  };

  const handleExportJSON = () => {
    const data = {
      title: documentTitle,
      exportDate: new Date().toISOString(),
      scope: exportScope,
      pages: exportScope === 'current' ? [{ title: documentTitle, content: currentPageContent }] : allPages,
    };

    triggerSafeDownload(JSON.stringify(data, null, 2), `${safeFilename}_backup.json`, 'JSON');
  };

  const handleCopyClipboard = async () => {
    await navigator.clipboard.writeText(getFullMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={handleStartClose}
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 select-none ${
        isClosing ? 'anim-modal-backdrop-out' : 'anim-modal-backdrop-in'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-2xl p-6 shadow-xl relative overflow-hidden ${
          isClosing ? 'anim-modal-box-out' : 'anim-modal-box-in'
        }`}
      >
        {downloadSuccess && (
          <div className="absolute inset-0 bg-cozy-surface/95 dark:bg-night-surface/95 z-20 flex flex-col items-center justify-center gap-2 p-6 animate-fadeIn">
            <CheckCircle2 size={36} className="text-emerald-500 animate-bounce" />
            <h3 className="text-sm font-semibold text-cozy-text dark:text-night-text">
              {strings.downloadSuccess}
            </h3>
            <p className="text-xs text-cozy-muted text-center">
              {downloadSuccess} {strings.savedToDownloads}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pb-3 border-b border-cozy-border/60 dark:border-night-border/60">
          <h2 className="text-base font-serif font-bold text-cozy-text dark:text-night-text">
            {strings.exportTitle}
          </h2>
          <button
            onClick={handleStartClose}
            className="p-1 rounded-lg text-cozy-muted hover:text-cozy-text dark:hover:text-night-text"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-cozy-muted uppercase tracking-wider block">
              {strings.exportScope}
            </label>
            <div className="grid grid-cols-2 gap-2 bg-cozy-card dark:bg-night-card p-1 rounded-xl border border-cozy-border/60 dark:border-night-border/60">
              <button
                onClick={() => setExportScope('current')}
                className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                  exportScope === 'current'
                    ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg shadow-xs'
                    : 'text-cozy-muted hover:text-cozy-text'
                }`}
              >
                {strings.currentSheet}
              </button>
              <button
                onClick={() => setExportScope('all')}
                className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
                  exportScope === 'all'
                    ? 'bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg shadow-xs'
                    : 'text-cozy-muted hover:text-cozy-text'
                }`}
              >
                {strings.allSheets} ({allPages.length})
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-cozy-muted uppercase tracking-wider block">
              {strings.chooseFormat}
            </label>

            <div
              onClick={handleExportMarkdown}
              className="flex items-center justify-between p-3 rounded-xl bg-cozy-card dark:bg-night-card border border-cozy-border/60 dark:border-night-border/60 hover:border-cozy-accent cursor-pointer group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center">
                  <FileText size={17} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-cozy-text dark:text-night-text group-hover:text-cozy-accent">
                    Markdown (.md)
                  </h4>
                  <p className="text-[11px] text-cozy-muted">
                    {strings.mdDesc}
                  </p>
                </div>
              </div>
            </div>

            <div
              onClick={handleExportHTML}
              className="flex items-center justify-between p-3 rounded-xl bg-cozy-card dark:bg-night-card border border-cozy-border/60 dark:border-night-border/60 hover:border-cozy-accent cursor-pointer group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <Globe size={17} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-cozy-text dark:text-night-text group-hover:text-cozy-accent">
                    {strings.htmlTitle}
                  </h4>
                  <p className="text-[11px] text-cozy-muted">
                    {strings.htmlDesc}
                  </p>
                </div>
              </div>
            </div>

            <div
              onClick={handleExportJSON}
              className="flex items-center justify-between p-3 rounded-xl bg-cozy-card dark:bg-night-card border border-cozy-border/60 dark:border-night-border/60 hover:border-cozy-accent cursor-pointer group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <FileCode size={17} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-cozy-text dark:text-night-text group-hover:text-cozy-accent">
                    {strings.jsonTitle}
                  </h4>
                  <p className="text-[11px] text-cozy-muted">
                    {strings.jsonDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-cozy-border/60 dark:border-night-border/60 flex items-center justify-between">
          <button
            onClick={handleCopyClipboard}
            className="flex items-center gap-1.5 text-xs text-cozy-muted hover:text-cozy-accent transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            <span>{copied ? strings.copied : strings.copyText}</span>
          </button>

          <button
            onClick={handleStartClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-cozy-card dark:bg-night-card hover:bg-cozy-border border border-cozy-border dark:border-night-border text-cozy-text dark:text-night-text"
          >
            {strings.close}
          </button>
        </div>
      </div>
    </div>
  );
}
