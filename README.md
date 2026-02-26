# ГдеДешевле

PWA для сравнения цен на продукты в магазинах Санкт-Петербурга.

## Функции

- Список покупок с поиском по каталогу
- Сравнение цен в 5 магазинах (Пятёрочка, Магнит, Лента, Перекрёсток, ВкусВилл)
- Умная разбивка — оптимальный маршрут по 1-3 магазинам
- Тёмная и светлая тема
- PWA с оффлайн-поддержкой

## Стек

**Frontend:** React 19, TypeScript, MobX, Mantine, Vite, vite-plugin-pwa

**Backend:** Node.js, Express, TypeScript

**Database:** PostgreSQL + Redis (6-hour cache TTL)

**Scrapers:** Playwright headless (5 магазинов), node-cron (каждые 12 часов)

## Структура

```
gde-deshevle/
├── src/                  # Frontend (React PWA)
├── server/               # Backend API + Scrapers
│   ├── src/
│   │   ├── routes/       # REST API endpoints
│   │   ├── services/     # Business logic (prices, products)
│   │   ├── scrapers/     # Playwright scrapers for 5 stores
│   │   ├── cron/         # Scrape scheduler (every 12h)
│   │   ├── db/           # PostgreSQL schema + seed data
│   │   └── cache/        # Redis cache layer
│   ├── Dockerfile
│   └── docker-compose.yml
└── package.json
```

## Запуск frontend

```bash
npm install
npm run dev
```

## Запуск backend

```bash
cd server
cp .env.example .env
docker compose up -d db redis   # PostgreSQL + Redis
npm install
npm run db:init                  # Create tables + seed data
npm run dev                      # Start API on :3001
```

## API

```
GET /api/products/search?q=мол&limit=10
GET /api/prices?productIds=1,2,3&city=spb
GET /api/stores?city=spb
GET /api/health
```

## Docker (полный стек)

```bash
cd server
docker compose up --build
```
