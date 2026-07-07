# Using Docker For running

## 1. Create your env file

```
cp .env.example .env
```

## Fill in API keys in .env

> (optional usage)

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen2.5:14b
```

## 2. Build and start everything

```
docker compose up --build
```

## 3. (First run) Pull the Ollama model

```
docker compose exec ollama ollama pull qwen2.5:14b
```
