import { useState, useEffect } from 'react';
import { X, Cpu, ShieldCheck, Download, AlertTriangle, Sparkles } from 'lucide-react';
import { Lang } from '../i18n';

interface AiHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
}

export default function AiHelpModal({ isOpen, onClose, lang }: AiHelpModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const frame = requestAnimationFrame(() => setIsAnimated(true));
      return () => cancelAnimationFrame(frame);
    } else {
      setIsAnimated(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none transition-opacity duration-200 ${
        isAnimated ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl bg-cozy-surface dark:bg-night-surface border border-cozy-border dark:border-night-border rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5 transition-all duration-200 transform ${
          isAnimated ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-3 border-b border-cozy-border/60 dark:border-night-border/60">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-cozy-accent/15 dark:bg-night-accent/20 text-cozy-accent dark:text-night-accent flex items-center justify-center">
              <Cpu size={18} />
            </span>
            <h2 className="text-sm font-serif font-bold text-cozy-text dark:text-night-text tracking-wide">
              {lang === 'uk' ? 'Локальний ШІ: Довідка та моделі' : 'Local AI: Guide & Models'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-cozy-muted hover:text-cozy-text dark:hover:text-night-text hover:bg-cozy-card dark:hover:bg-night-card transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. Що таке локальний ШІ */}
        <div className="p-3.5 bg-cozy-card dark:bg-night-card rounded-2xl border border-cozy-border/60 dark:border-night-border/60 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
            <ShieldCheck size={16} />
            <span>{lang === 'uk' ? 'Абсолютна приватність' : 'Complete Privacy'}</span>
          </div>
          <p className="text-xs text-cozy-muted leading-relaxed">
            {lang === 'uk'
              ? 'На відміну від хмарних сервісів, локальна нейромережа працює виключно на залізі вашого ПК. Жодна літера ваших особистих думок, щоденників чи записів ніколи не відправляється в інтернет. Єдиний вихід назовні — перевірка оновлень на GitHub (її можна вимкнути в Налаштуваннях → Оновлення); під час неї передається лише версія застунку, жодних ваших даних.'
              : 'Unlike cloud services, a local neural network runs entirely on your PC. Not a single word of your personal thoughts or entries ever leaves your device. The only outbound call is the update check to GitHub (disable it in Settings → Updates); it sends only the app version, never your data.'}
          </p>
          <p className="text-[11px] text-cozy-muted/80 leading-relaxed">
            {lang === 'uk'
              ? '⚙️ Мережеві винятки (жодних ваших даних): пошук локального ШІ-сервера на вашому ж ПК та опційна перевірка оновлень на GitHub (раз на добу, вимикається в Налаштуваннях → Оновлення).'
              : '⚙️ Network exceptions (contain none of your data): local AI server discovery on your own machine, and an optional once-a-day GitHub update check (disable in Settings → Updates).'}
          </p>
        </div>

        {/* 2. Загальний покроковий гайд */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-cozy-muted flex items-center gap-1.5">
            <Download size={13} className="text-cozy-accent dark:text-night-accent" />
            <span>{lang === 'uk' ? 'Як налаштувати:' : 'How to set up:'}</span>
          </h3>

          <div className="space-y-2 text-xs text-cozy-text dark:text-night-text">
            <div className="flex gap-2.5 p-2.5 rounded-xl bg-cozy-card/50 dark:bg-night-card/50 border border-cozy-border/40 dark:border-night-border/40 items-start">
              <span className="w-5 h-5 rounded-full bg-cozy-accent/20 text-cozy-accent dark:text-night-accent font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              <div>
                <strong className="block text-cozy-text dark:text-night-text font-serif">
                  {lang === 'uk' ? 'Встановіть програму для локального ШІ' : 'Install a local AI app'}
                </strong>
                <span className="text-[11px] text-cozy-muted">
                  {lang === 'uk'
                    ? 'Завантажте LM Studio, Ollama або іншу подібну програму для запуску моделей.'
                    : 'Download LM Studio, Ollama, or any compatible local model runner.'}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 p-2.5 rounded-xl bg-cozy-card/50 dark:bg-night-card/50 border border-cozy-border/40 dark:border-night-border/40 items-start">
              <span className="w-5 h-5 rounded-full bg-cozy-accent/20 text-cozy-accent dark:text-night-accent font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              <div>
                <strong className="block text-cozy-text dark:text-night-text font-serif">
                  {lang === 'uk' ? 'Завантажте бажану модель' : 'Download your preferred model'}
                </strong>
                <span className="text-[11px] text-cozy-muted">
                  {lang === 'uk'
                    ? 'Знайдіть та завантажте рекомендовану або будь-яку сумісну модель.'
                    : 'Search and download a recommended or compatible model.'}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5 p-2.5 rounded-xl bg-cozy-card/50 dark:bg-night-card/50 border border-cozy-border/40 dark:border-night-border/40 items-start">
              <span className="w-5 h-5 rounded-full bg-cozy-accent/20 text-cozy-accent dark:text-night-accent font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              <div className="space-y-1">
                <strong className="block text-cozy-text dark:text-night-text font-serif">
                  {lang === 'uk' ? 'Увімкніть локальний сервер та CORS' : 'Start the local server & enable CORS'}
                </strong>
                <span className="text-[11px] text-cozy-muted block">
                  {lang === 'uk'
                    ? 'Запустіть локальний сервер (сумісний з OpenAI API). Переконайтеся, що адреса співпадає з полем у Flins (за замовчуванням http://localhost:1234/v1).'
                    : 'Start the local OpenAI-compatible server. Ensure the URL matches Flins (default http://localhost:1234/v1).'}
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block">
                  {lang === 'uk'
                    ? '⚠️ Важливо: У налаштуваннях сервера (Server Settings) обов’язково увімкніть тумблер CORS, щоб система дозволила локальне підключення.'
                    : '⚠️ Important: In Server Settings, make sure to enable the CORS toggle so the app can connect locally.'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Рекомендовані моделі (Оновлено: Qwen та Gemma, Mistral видалено) */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-cozy-muted flex items-center gap-1.5">
            <Sparkles size={13} className="text-cozy-accent dark:text-night-accent" />
            <span>{lang === 'uk' ? 'Рекомендовані моделі:' : 'Recommended Models:'}</span>
          </h3>

          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="p-3 bg-cozy-card dark:bg-night-card rounded-xl border border-cozy-accent/40 dark:border-night-accent/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-cozy-accent dark:text-night-accent font-serif">
                  🌟 Qwen X (Instruct)
                </span>
                <span className="text-[10px] bg-cozy-accent/10 dark:bg-night-accent/20 text-cozy-accent dark:text-night-accent px-1.5 py-0.5 rounded font-mono font-semibold">
                  {lang === 'uk' ? 'Топ вибір' : 'Top pick'}
                </span>
              </div>
              <p className="text-[11px] text-cozy-muted leading-relaxed">
                {lang === 'uk'
                  ? 'Найкраще розуміння української мови, художній стиль та чітке слідування інструкціям і настрою.'
                  : 'Best multilingual support, rich literary style, and precise prompt following.'}
              </p>
            </div>

            <div className="p-2.5 bg-cozy-card/60 dark:bg-night-card/60 rounded-xl border border-cozy-border/60 dark:border-night-border/60 space-y-0.5">
              <span className="font-semibold text-cozy-text dark:text-night-text font-serif">
                Gemma X (Instruct)
              </span>
              <p className="text-[11px] text-cozy-muted">
                {lang === 'uk'
                  ? 'Швидка, збалансована та надійна модель від Google для повсякденних записів.'
                  : 'Fast, well-balanced, and reliable model by Google for everyday journaling.'}
              </p>
            </div>
          </div>
        </div>

        {/* 4. Офіційна відмова від відповідальності */}
        <div className="p-3.5 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-2xl space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold text-xs">
            <AlertTriangle size={15} />
            <span>{lang === 'uk' ? 'Відмова від відповідальності' : 'Disclaimer'}</span>
          </div>
          <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed font-sans">
            {lang === 'uk'
              ? 'Функції локального штучного інтелекту надаються за принципом «як є». Ви підключаєте власні моделі та стороннє програмне забезпечення на свій власний страх і ризик. Розробник не несе відповідальності за зміст згенерованих текстів, можливі галюцинації моделі, невідповідність порад або технічне навантаження на процесор і пам\'ять вашого пристрою.'
              : 'Local AI features are provided "as is". You connect custom models via third-party software at your own risk. The developer is not responsible for generated content, hallucinations, advice accuracy, or hardware load on your device.'}
          </p>
        </div>

        {/* Кнопка закриття */}
        <div className="pt-2 border-t border-cozy-border/60 dark:border-night-border/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-xl bg-cozy-accent text-white dark:bg-night-accent dark:text-night-bg shadow-xs hover:scale-102 transition-transform cursor-pointer"
          >
            {lang === 'uk' ? 'Зрозуміло' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
