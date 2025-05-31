# Video Call SDK

SDK для видеозвонков с использованием WebRTC, [mediasoup](https://mediasoup.org/) и WebSocket. Проект включает пример web-клиента и signaling-сервер.

## 📦 Состав проекта

- `sdk/` — модуль SDK для управления видеозвонками;
- `server/` — signaling-сервер на WebSocket + mediasoup;
- `test-client/` — фронтенд-пример использования SDK на Vite.

## 🚀 Быстрый старт

### Установка зависимостей

```bash
npm ci
```

### Сборка проекта

```bash
# Сборка SDK
npm run build:sdk

# Сборка signaling-сервера
npm run build:server

# Сборка клиентского примера
npm run build:test-client

# Сборка SDK + signaling-сервера + клиентского примера
npm run build
```

### Запуск

#### 1. Signaling-сервер

```bash
npm run start:server
```

По умолчанию сервер запускается на `ws://127.0.0.1:8088/ws`.

#### 2. Тестовый клиент (Vite)

```bash
npm run start:test-client
```

Клиент будет доступен по адресу: [http://localhost:5173](http://localhost:5173)

> ⚠️ Клиент жёстко подключается к `ws://127.0.0.1:8088/ws`. При изменении этого адреса необходимо сделать соответствующие изменения в коде (src/test-client/main.ts)

## 🐳 Docker

### Сборка и запуск

```bash
docker compose up --build

# Тихий запуск
docker compose up --build -d

# Остановка контейнеров
docker compose down
```

Клиент будет доступен по адресу: [http://localhost:5173](http://localhost:5173)

## 🧪 Тесты

```bash
npm test
```

Тесты запускаются с помощью [Vitest](https://vitest.dev/).

## 📁 Структура проекта

```
.
├── sdk/                # SDK WebRTC
├── server/             # Signaling-сервер
├── test-client/        # Пример web-клиента
├── Dockerfile
├── tsconfig.*.json
├── vite.*.config.ts
└── package.json
```
