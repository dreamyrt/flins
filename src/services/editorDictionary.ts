// Повний український словник для команд і плейсхолдерів BlockNote
export const ukEditorDictionary: any = {
  slash_menu: {
    heading: {
      title: "Заголовок 1",
      subtext: "Головний великий розділ",
      aliases: ["h1", "заголовок", "розділ"],
      group: "Заголовки",
    },
    heading_2: {
      title: "Заголовок 2",
      subtext: "Підрозділ теми",
      aliases: ["h2", "підзаголовок"],
      group: "Заголовки",
    },
    heading_3: {
      title: "Заголовок 3",
      subtext: "Дрібний підзаголовок",
      aliases: ["h3"],
      group: "Заголовки",
    },
    numbered_list: {
      title: "Нумерований список",
      subtext: "Список із послідовними числами",
      aliases: ["ol", "числа", "список"],
      group: "Базові блоки",
    },
    bullet_list: {
      title: "Маркований список",
      subtext: "Список із крапками",
      aliases: ["ul", "маркер", "список"],
      group: "Базові блоки",
    },
    check_list: {
      title: "Список завдань",
      subtext: "Список із прапорцями виконання",
      aliases: ["чек", "завдання", "справи", "todo"],
      group: "Базові блоки",
    },
    paragraph: {
      title: "Звичайний текст",
      subtext: "Простий абзац",
      aliases: ["текст", "параграф", "p"],
      group: "Базові блоки",
    },
    table: {
      title: "Таблиця",
      subtext: "Створити сітку таблиці",
      aliases: ["таблиця", "сітка"],
      group: "Розширені",
    },
    code_block: {
      title: "Блок коду",
      subtext: "Фрагмент коду з підсвіткою",
      aliases: ["код", "програма"],
      group: "Розширені",
    },
    image: {
      title: "Зображення",
      subtext: "Вставити фото або картинку",
      aliases: ["фото", "картинка", "image"],
      group: "Медіа",
    },
    video: {
      title: "Відео",
      subtext: "Вставити відео",
      aliases: ["відео", "video"],
      group: "Медіа",
    },
    audio: {
      title: "Аудіо",
      subtext: "Вставити аудіозапис",
      aliases: ["аудіо", "звук", "audio"],
      group: "Медіа",
    },
    file: {
      title: "Файл",
      subtext: "Прикріпити документ",
      aliases: ["файл", "документ", "file"],
      group: "Медіа",
    },
    emoji: {
      title: "Емодзі",
      subtext: "Вставити символ",
      aliases: ["смайл", "емодзі", "emoji"],
      group: "Медіа",
    },
  },
  placeholders: {
    default: "Введіть текст або натисніть '/' для вибору команд...",
    heading: "Заголовок",
    bulletListItem: "Елемент списку",
    numberedListItem: "Елемент списку",
    checkListItem: "Завдання...",
  },
  file_panel: {
    upload: {
      title: "Завантажити файл",
      file_placeholder: { default: "Оберіть файл на комп'ютері" },
      upload_error: "Помилка під час завантаження файлу",
    },
    embed: {
      title: "Вставити посилання",
      embed_button: { default: "Вставити" },
      url_placeholder: "Введіть посилання на файл...",
    },
  },
  side_menu: {
    add_block_label: "Додати блок знизу",
    drag_handle_label: "Потягніть для переміщення",
  },
};
