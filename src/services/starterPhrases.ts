import { Lang } from './i18n';

export interface StarterPhrase {
  title: string;
  subtitle: string;
}

export const starterPhrases: Record<Lang, StarterPhrase[]> = {
  uk: [
    { title: "☕ Свіжий ранок і тиша", subtitle: "Запишіть думку, яка щойно спала на думку за першою кавою..." },
    { title: "💡 Іскра раптового задуму", subtitle: "Ідеї спалахують раптово. Зафіксуйте її суть, поки вона палає..." },
    { title: "🌿 Спокійний фокус", subtitle: "Глибокий видих. Що зараз насправді має першочергове значення?..." },
    { title: "🌙 Нічні роздуми", subtitle: "Коли день згасає, приходять найчесніші висновки. Про що мовчить вечір?..." },
    { title: "🎯 Чіткий план дій", subtitle: "Від хаосу до кришталевого порядку: розпишіть перші три прості кроки..." },
    { title: "📖 Чернетка історії", subtitle: "Кожна велика історія чи задум починається з одного невпевненого речення..." },
    { title: "🎨 Творчий політ без меж", subtitle: "Ніяких правил, цензури та оцінок. Пишіть рівно так, як відчуваєте..." },
    { title: "⚡ Швидкий штрих на бігу", subtitle: "Три ключові речі, які не можна загубити в потоці сьогоднішніх подій..." },
    { title: "🕯️ Філософський настрій", subtitle: "Світ навколо кудись поспішає. А що насправді відчуваєте ви прямо зараз?..." },
    { title: "🧭 Пошук відповідей", subtitle: "Складне питання — це просто завдання, розбите на замалу кількість частин..." },
  ],
  en: [
    { title: "☕ Quiet Morning Thoughts", subtitle: "Capture the first thought that came with your morning brew..." },
    { title: "💡 A Sudden Spark", subtitle: "Ideas strike like lightning. Catch the essence before it fades..." },
    { title: "🌿 Calm & Centered", subtitle: "Take a breath. What truly matters most at this very moment?..." },
    { title: "🌙 Late Night Reflections", subtitle: "As the day settles, what thoughts remain whispering?..." },
    { title: "🎯 Blueprint & Clarity", subtitle: "From chaos to clarity: outline your next three decisive steps..." },
    { title: "📖 The Rough Draft", subtitle: "Every great story starts with one imperfect, honest line..." },
    { title: "🎨 Unfiltered Creativity", subtitle: "No rules, no edits. Write freely straight from the heart..." },
    { title: "⚡ Quick Memo", subtitle: "Three essential details you cannot afford to forget today..." },
    { title: "🕯️ Philosophical Mood", subtitle: "The world rushes by. What is your inner compass pointing toward?..." },
    { title: "🧭 Solving the Puzzle", subtitle: "A complex obstacle is just an adventure waiting for its steps..." },
  ],
};

export function getRandomStarterPhrase(lang: Lang): StarterPhrase {
  const list = starterPhrases[lang];
  return list[Math.floor(Math.random() * list.length)];
}
