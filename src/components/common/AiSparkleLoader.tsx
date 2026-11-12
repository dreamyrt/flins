import { Lang } from '../../services/i18n';

interface AiSparkleLoaderProps {
  lang?: Lang;
  size?: 'sm' | 'md' | 'lg';
}

export default function AiSparkleLoader({ lang = 'uk', size = 'md' }: AiSparkleLoaderProps) {
  const tooltipText = lang === 'uk' ? 'Обробка запиту, зачекайте...' : 'Processing request, please wait...';

  // Просторі контейнери під збільшені зірки
  const containerSizes = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  // Центральна зірка: рівно на +6px більше (sm: 22px, md: 30px, lg: 42px)
  const centerSizes = {
    sm: 'text-[22px]',
    md: 'text-[30px]',
    lg: 'text-[42px]',
  };

  // Орбітальні зірочки: рівно на +6px більше (sm: 15px, md: 18px, lg: 20px)
  const satSizes = {
    sm: 'text-[15px]',
    md: 'text-[18px]',
    lg: 'text-[20px]',
  };

  return (
    <div
      className={`group relative flex items-center justify-center ${containerSizes[size]} select-none cursor-wait my-1`}
      title={tooltipText}
    >
      {/* 1. Глибока світлова аура */}
      <div className="anim-glow-breath absolute inset-0 rounded-full bg-cozy-accent/40 dark:bg-night-accent/45 blur-xl pointer-events-none" />
      <div className="anim-glow-breath absolute inset-1.5 rounded-full bg-amber-400/30 dark:bg-purple-400/35 blur-md pointer-events-none" />

      {/* 2. Центральна зірка (+6px) */}
      <span className={`star-glyph ${centerSizes[size]} text-cozy-accent dark:text-night-accent font-bold relative z-10 drop-shadow-md leading-none select-none`}>
        ✦
      </span>

      {/* 3. Перший супутник (+6px, за годинниковою стрілкою) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <span className={`anim-orbit-cw ${satSizes[size]} text-cozy-accent dark:text-night-accent font-bold opacity-90 drop-shadow-sm leading-none`}>
          ✧
        </span>
      </div>

      {/* 4. Другий супутник (+6px, проти годинникової стрілки на ширшій орбіті) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <span className={`star-glyph anim-orbit-ccw ${satSizes[size]} text-amber-500 dark:text-amber-300 font-bold opacity-85 drop-shadow-sm leading-none`}>
          ✦
        </span>
      </div>

      {/* 5. Делікатний тултіп при наведенні */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none absolute -bottom-7 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-cozy-card dark:bg-night-surface border border-cozy-border dark:border-night-border text-[11px] font-sans font-medium text-cozy-text dark:text-night-text shadow-xl whitespace-nowrap z-50">
        {tooltipText}
      </div>
    </div>
  );
}
