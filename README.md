# DebutFlow

**Interactive chess opening trainer for learning and practicing opening lines.**

DebutFlow is a browser-based chess trainer focused on opening practice. The application lets you choose an opening, train random lines, play from either side of the board, and receive move-by-move feedback.

> 🇷🇺 [Русская версия](#русская-версия)

## Features

- **23 opening sections**;
- **227 training lines**;
- random line selection to make repeated practice less predictable;
- training as **White or Black**;
- two modes: **Study** and **Practice**;
- automatic move validation;
- move-by-move explanations;
- interactive chessboard;
- responsive browser interface.

### About move explanations

Move explanations are currently generated from general chess principles and move context. They are intended as helpful training hints rather than expert annotations. Manual position-specific commentary is planned for future versions.

## Opening data

Opening names and move sequences in this version are based on the open **lichess-org/chess-openings** dataset.

- Source: https://github.com/lichess-org/chess-openings
- Data license: **CC0 / Public Domain Dedication**
- The source data was selected and converted to DebutFlow's internal format.

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for details.

## Tech stack

- HTML5
- CSS3
- JavaScript
- jQuery
- chess.js
- chessboard.js
- JSON

## Project structure

```text
DebutFlow/
├── index.html                         # Application UI
├── style.css                          # Styles
├── trainer.js                         # Training logic and move explanations
├── openings.js                        # Opening data used by the browser
├── DebutFlow_openings_database.json   # Human-readable opening database
├── README.md                          # Project description
└── THIRD_PARTY_NOTICES.md             # Third-party data and licensing notes
```

## Run locally

No build step is required.

1. Download or clone the repository.
2. Open `index.html` in a modern browser.
3. Keep an internet connection available: jQuery, chess.js, chessboard.js and chess piece images are loaded from CDN resources.

## Roadmap

- manually refine position-specific move explanations;
- expand and improve the opening database;
- add training statistics and progress tracking;
- save user progress between sessions;
- continue UI/UX polish.

---

# Русская версия

**DebutFlow — интерактивный веб-тренажёр для изучения и отработки шахматных дебютов.**

Приложение позволяет выбрать дебют, тренировать случайные варианты, играть как за белых, так и за чёрных и получать пояснения после ходов.

## Возможности

- **23 дебютных раздела**;
- **227 тренировочных линий**;
- случайный выбор вариантов, чтобы тренировки не сводились к повторению одной и той же линии;
- тренировка **за белых и за чёрных**;
- два режима: **«Изучение»** и **«Практика»**;
- автоматическая проверка сделанных ходов;
- пояснения к каждому ходу;
- интерактивная шахматная доска;
- адаптивный интерфейс для браузера.

### О комментариях к ходам

Сейчас пояснения формируются автоматически на основе общих шахматных принципов и контекста хода. Они служат учебными подсказками, а не претендуют на уровень экспертных шахматных аннотаций. В дальнейшем планируется ручная доработка комментариев для конкретных позиций.

## Дебютные данные

Названия дебютов и последовательности ходов в этой версии сформированы на основе открытого набора **lichess-org/chess-openings**.

- Источник: https://github.com/lichess-org/chess-openings
- Лицензия данных: **CC0 / Public Domain Dedication**
- Исходные данные были отобраны и преобразованы во внутренний формат DebutFlow.

Подробнее об источниках и лицензиях: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Технологии

- HTML5
- CSS3
- JavaScript
- jQuery
- chess.js
- chessboard.js
- JSON

## Структура проекта

```text
DebutFlow/
├── index.html                         # Интерфейс приложения
├── style.css                          # Стили
├── trainer.js                         # Логика тренировки и пояснений
├── openings.js                        # Дебютная база для работы в браузере
├── DebutFlow_openings_database.json   # База дебютов в читаемом JSON-формате
├── README.md                          # Описание проекта
└── THIRD_PARTY_NOTICES.md             # Источники данных и лицензии
```

## Как запустить

Сборка проекта не требуется.

1. Скачайте или клонируйте репозиторий.
2. Откройте `index.html` в современном браузере.
3. Для загрузки jQuery, chess.js, chessboard.js и изображений фигур требуется подключение к интернету, так как эти ресурсы подключаются через CDN.

## Планы развития

- вручную доработать пояснения для конкретных шахматных позиций;
- расширять и улучшать дебютную базу;
- добавить статистику тренировок и отслеживание прогресса;
- сохранять прогресс пользователя между сессиями;
- точечно улучшать интерфейс и UX.

---

Opening data: **lichess-org/chess-openings — CC0**.
