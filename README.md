# DebutFlow

🇷🇺 [Русская версия](#русская-версия) | 🇬🇧 [English version](#english-version)

---

# Русская версия

**DebutFlow — интерактивный веб-тренажёр для изучения и отработки шахматных дебютов.**

Приложение позволяет изучать дебютные варианты, тренировать случайные линии, играть как за белых, так и за чёрных и получать пояснения после каждого хода.

## 🎮 Онлайн-версия

Рабочая версия проекта доступна через **GitHub Pages**:

👉 https://timsome1337.github.io/DebutFlow/

Установка не требуется — тренажёр можно открыть прямо в браузере.

## Возможности

- **23 дебютных раздела**
- **227 тренировочных линий**
- случайный выбор вариантов
- тренировка **за белых и за чёрных**
- режим **«Изучение»**
- режим **«Практика»**
- автоматическая проверка ходов
- пояснения после каждого хода
- интерактивная шахматная доска
- адаптивный интерфейс
- поддержка мобильных устройств
- отдельное сенсорное управление ходами на смартфонах и планшетах

## Режимы работы

### 📚 Изучение

В режиме изучения пользователь последовательно проходит дебютную линию и может просматривать ходы и пояснения.

Режим предназначен для знакомства с новым вариантом и понимания последовательности ходов.

### 🎯 Практика

В режиме практики пользователь самостоятельно делает ходы на шахматной доске.

DebutFlow проверяет каждый сделанный ход и сообщает, соответствует ли он выбранной дебютной линии.

## 📱 Управление на мобильных устройствах

Для мобильной версии было добавлено отдельное управление шахматными ходами с помощью касаний.

В режиме **«Практика»** ход выполняется следующим образом:

1. Нажмите один раз на фигуру.
2. Выбранная фигура подсветится.
3. Нажмите на клетку, куда хотите сделать ход.
4. DebutFlow автоматически проверит ход.

То есть на смартфоне используется схема:

**тап по фигуре → тап по клетке → ход**

Долго удерживать фигуру или точно перетаскивать её пальцем не требуется.

На компьютерах сохранено стандартное управление с помощью перетаскивания фигур мышью.

## Последние изменения

В последних версиях проекта:

- добавлена публикация приложения через **GitHub Pages**
- улучшена работа приложения на мобильных устройствах
- добавлено управление ходами с помощью обычных касаний
- сохранено стандартное drag-and-drop управление на компьютерах
- улучшена адаптация интерфейса под сенсорные устройства

## О пояснениях к ходам

Пояснения формируются автоматически на основе общих шахматных принципов и контекста сделанного хода.

Они предназначены в первую очередь для обучения и не претендуют на уровень профессиональных шахматных аннотаций.

В дальнейшем планируется ручная доработка пояснений для конкретных позиций.

## Дебютные данные

Названия дебютов и последовательности ходов сформированы на основе открытого набора данных:

**lichess-org/chess-openings**

Источник:

https://github.com/lichess-org/chess-openings

Лицензия данных:

**CC0 / Public Domain Dedication**

Исходные данные были отобраны и преобразованы во внутренний формат DebutFlow.

Подробнее:

[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)

## Технологии

- HTML5
- CSS3
- JavaScript
- jQuery
- chess.js
- chessboard.js
- JSON
- Git
- GitHub
- GitHub Pages

## Структура проекта

```text
DebutFlow/
├── index.html
├── style.css
├── trainer.js
├── openings.js
├── DebutFlow_openings_database.json
├── README.md
└── THIRD_PARTY_NOTICES.md
```

### Основные файлы

- `index.html` — интерфейс приложения
- `style.css` — оформление и адаптивный интерфейс
- `trainer.js` — основная логика тренажёра, проверка ходов и управление доской
- `openings.js` — база дебютных линий для работы приложения
- `DebutFlow_openings_database.json` — база дебютов в JSON-формате
- `THIRD_PARTY_NOTICES.md` — информация об используемых сторонних данных

## Как запустить локально

Сборка проекта не требуется.

1. Скачайте или клонируйте репозиторий.
2. Откройте файл `index.html` в современном браузере.
3. Для загрузки некоторых библиотек и изображений фигур требуется подключение к интернету.

Также можно воспользоваться готовой онлайн-версией:

👉 https://timsome1337.github.io/DebutFlow/

## Планы развития

- расширение базы дебютов
- улучшение пояснений к шахматным позициям
- добавление статистики тренировок
- отслеживание прогресса пользователя
- сохранение результатов между сессиями
- дальнейшее улучшение мобильного управления
- улучшение UI/UX

---

# English version

**DebutFlow is an interactive web-based chess opening trainer for learning and practicing opening lines.**

The application allows users to study opening variations, practice random lines, play as White or Black, and receive move-by-move feedback.

## 🎮 Live Demo

A live version of DebutFlow is available through **GitHub Pages**:

👉 https://timsome1337.github.io/DebutFlow/

No installation is required.

## Features

- **23 opening sections**
- **227 training lines**
- random variation selection
- training as **White or Black**
- **Study** mode
- **Practice** mode
- automatic move validation
- move-by-move explanations
- interactive chessboard
- responsive browser interface
- mobile device support
- touch-friendly chess controls

## Training modes

### 📚 Study

Study mode allows users to go through an opening line step by step and review moves and explanations.

It is intended for learning unfamiliar opening variations.

### 🎯 Practice

Practice mode allows users to make moves directly on the chessboard.

DebutFlow automatically checks whether each move matches the selected opening line.

## 📱 Mobile controls

Touch-friendly chess controls were added for smartphones and tablets.

In **Practice** mode:

1. Tap the piece you want to move.
2. The selected piece is highlighted.
3. Tap the destination square.
4. DebutFlow validates the move automatically.

The mobile interaction is therefore:

**tap piece → tap destination square → move**

Long pressing or precise drag-and-drop interaction is not required.

Desktop users can continue using standard mouse drag-and-drop controls.

## Recent changes

Recent versions of DebutFlow include:

- deployment through **GitHub Pages**
- improved mobile device support
- tap-to-move controls for touch screens
- preserved desktop drag-and-drop controls
- improved mobile interaction with the chessboard

## About move explanations

Move explanations are generated from general chess principles and the context of each move.

They are intended as educational hints rather than professional chess annotations.

Manual position-specific commentary may be added in future versions.

## Opening data

Opening names and move sequences are based on the open:

**lichess-org/chess-openings**

dataset.

Source:

https://github.com/lichess-org/chess-openings

Data license:

**CC0 / Public Domain Dedication**

The original data was selected and converted into DebutFlow's internal format.

See:

[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)

## Tech stack

- HTML5
- CSS3
- JavaScript
- jQuery
- chess.js
- chessboard.js
- JSON
- Git
- GitHub
- GitHub Pages

## Project structure

```text
DebutFlow/
├── index.html
├── style.css
├── trainer.js
├── openings.js
├── DebutFlow_openings_database.json
├── README.md
└── THIRD_PARTY_NOTICES.md
```

### Main files

- `index.html` — application interface
- `style.css` — styles and responsive layout
- `trainer.js` — training logic, move validation and chessboard controls
- `openings.js` — opening data used by the application
- `DebutFlow_openings_database.json` — human-readable opening database
- `THIRD_PARTY_NOTICES.md` — third-party data and licensing information

## Run locally

No build step is required.

1. Download or clone the repository.
2. Open `index.html` in a modern browser.
3. An internet connection is required for some external libraries and chess piece assets.

You can also use the live version:

👉 https://timsome1337.github.io/DebutFlow/

## Roadmap

- expand the opening database
- improve position-specific explanations
- add training statistics
- add progress tracking
- save progress between sessions
- continue improving mobile controls
- continue UI/UX improvements

---

Opening data: **lichess-org/chess-openings — CC0**
