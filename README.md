# Cognitum

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#screenshots">Screenshots</a></li>
    <li><a href="#built-with">Built With</a></li>
    <li><a href="#project-structure">Project Structure</a></li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
        <li><a href="#environment-configuration">Environment Configuration</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#run-the-ai-summarizer-service">Run The AI Summarizer Service</a></li>
        <li><a href="#run-the-spring-boot-backend">Run The Spring Boot Backend</a></li>
        <li><a href="#run-the-tauri-application">Run The Tauri Application</a></li>
        <li><a href="#build-the-tauri-application">Build The Tauri Application</a></li>
        <li><a href="#train-the-summary-model">Train The Summary Model</a></li>
        <li><a href="#use-the-summary-inference-script">Use The Summary Inference Script</a></li>
      </ul>
    </li>
    <li>
      <a href="#testing-and-evaluation">Testing And Evaluation</a>
      <ul>
        <li><a href="#backend-unit-tests">Backend Unit Tests</a></li>
        <li><a href="#backend-integration-tests">Backend Integration Tests</a></li>
        <li><a href="#frontend-e2e-tests">Frontend E2E Tests</a></li>
        <li><a href="#summary-model-evaluation">Summary Model Evaluation</a></li>
      </ul>
    </li>
    <li><a href="#troubleshooting">Troubleshooting</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## About The Project

Cognitum is an AI-integrated intelligent note-taking application designed to enhance the learning experience of students. Similar to note-taking applications such as Obsidian, Cognitum supports advanced notation through LaTeX while integrating AI-powered features directly into the editor.

The application bridges the gap between note-taking and information recall by transforming basic note-taking into a more structured learning workflow. It provides three main AI features: summarisation for quick comprehension, context-aware explanations for understanding complex topics, and a spaced-repetition system that uses AI-generated flashcards to support long-term knowledge retention.

## Built With

* [![Tauri][Tauri.app]][Tauri-url]
* [![React][React.js]][React-url]
* [![TypeScript][TypeScript]][TypeScript-url]
* [![Tailwind][Tailwind.css]][Tailwind-url]
* [![Rust][Rust]][Rust-url]
* [![Spring Boot][Spring-Boot]][Spring-Boot-url]
* [![Postgres][Postgres]][Postgres-url]
* [![PyTorch][Pytorch]][Pytorch-url]

## Project Structure

```text
Cognitum/
|-- AI/                 # Model training, evaluation, inference, and LitServe API
|-- backend/            # Spring Boot REST API, persistence, authentication, and AI clients
|-- frontend/           # React, TypeScript, Tauri desktop application, and Playwright tests
`-- README.md
```

The main local services are:

* Frontend/Tauri dev server: `http://localhost:1420`
* Spring Boot backend: `http://localhost:8080`
* AI summarizer service: `http://localhost:8000`
* PostgreSQL database: `cognitum`, using schema `cognitum_data`

The trained summarization model is not included in this repository. Before running summary generation, train the model or place a compatible trained model at `AI/models/final_model`.

## Getting Started

### Prerequisites

Install the following before running the full application locally:

* [Node.js](https://nodejs.org/en/download) `>= 22.20.0`
* [Python](https://www.python.org/) `>= 3.10`
* [JDK](https://dev.java/download/) `>= 17`
* [PostgreSQL](https://www.postgresql.org/download/) `>= 17`
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [Docker Engine](https://docs.docker.com/engine/install/) for integration tests

The backend includes the Gradle wrapper, so a separate Gradle installation is not required for normal local usage.

### Installation

Clone the repository:

```bash
git clone https://github.com/vermilion-exe/Cognitum.git
cd Cognitum
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Install AI dependencies:

```bash
cd ../AI
python -m venv .venv
```

On Windows, activate the virtual environment with:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS or Linux, activate it with:

```bash
source .venv/bin/activate
```

Then install the Python packages:

```bash
pip install -r requirements.txt
```

Build the backend from the `backend` directory:

```powershell
cd ../backend
.\gradlew.bat build
```

On macOS or Linux:

```bash
cd ../backend
./gradlew build
```

### Environment Configuration

Create a `.env` file in the `backend` directory:

```env
DB_PASSWORD=
MAIL_PASSWORD=
NVIDIA_API_KEY=
JWT_SECRET_KEY=
TEST_JWT_SECRET_KEY=
```

Spring Boot imports this file automatically from `backend/.env` when the app is run from the repository root or from the `backend` directory. No IntelliJ run configuration changes are required.

Environment variables:

* `DB_PASSWORD`: Password for the PostgreSQL user configured in `backend/src/main/resources/application.yml`.
* `MAIL_PASSWORD`: Gmail app password used to send account confirmation emails. See Google's guide for [app passwords](https://support.google.com/mail/answer/185833).
* `NVIDIA_API_KEY`: NVIDIA NIM API key used for explanation and flashcard generation.
* `JWT_SECRET_KEY`: Secret key used to sign application JWTs.
* `TEST_JWT_SECRET_KEY`: Secret key used by tests.

The default backend configuration expects a local PostgreSQL database named `cognitum` and schema named `cognitum_data`:

```sql
CREATE DATABASE cognitum;
\c cognitum
CREATE SCHEMA IF NOT EXISTS cognitum_data;
```

If your local PostgreSQL username is not `postgres`, update this value in `backend/src/main/resources/application.yml`:

```yml
spring:
  datasource:
    username: your-db-username
```

For first-time local database creation, you can temporarily set Hibernate to create the tables:

```yml
spring:
  jpa:
    hibernate:
      ddl-auto: create
```

After the tables are created, change it back to `update` or another appropriate setting.

User account confirmation is automatic by default. To require email activation codes, set dev mode to `false`:

```yml
app:
  is-dev-mode: false
```

## Usage

For the full local application, run the AI summarizer service, the Spring Boot backend, and the Tauri frontend.

### Run The AI Summarizer Service

The summarizer service requires a trained model. Train one first with the [training script](#train-the-summary-model), or provide a compatible model directory with `--model_dir`.

From the `AI` directory, start the LitServe summarizer API:

```bash
python -m server.server
```

Optional arguments:

* `--model_dir`: Path to the trained model directory. Defaults to `./models/final_model`.
* `--port`: Port to run the API server on. Defaults to `8000`.

Generation settings such as `max_input_len`, `num_beams`, and `recursive` are accepted in the request body sent to the LitServe API.

### Run The Spring Boot Backend

From the `backend` directory, run the Spring Boot application:

```powershell
.\gradlew.bat bootRun
```

On macOS or Linux:

```bash
./gradlew bootRun
```

You can also run the backend from IntelliJ IDEA by opening the `backend` project and running `BackendApplication`.

### Run The Tauri Application

From the `frontend` directory, start the desktop application:

```bash
npm run tauri dev
```

### Build The Tauri Application

From the `frontend` directory, build the desktop application:

```bash
npm run tauri build
```

On Windows, the executable is created under:

```text
frontend/src-tauri/target/release/
```

Installer bundles are created under:

```text
frontend/src-tauri/target/release/bundle/
```

### Train The Summary Model

The trained model is not committed to the repository. The training script for the summary model is located at `AI/training/train.py`. From the `AI/training` directory, run:

```bash
python train.py --train_file ../data/summ/train.jsonl --val_file ../data/summ/val.jsonl
```

Common arguments:

* `--train_file`: Path to the training file.
* `--val_file`: Path to the validation file.
* `--output_dir`: Directory where the trained model will be stored.
* `--model_name`: Hugging Face model name or local model path.
* `--max_input_len`: Maximum token length for input notes.
* `--max_target_len`: Maximum token length for generated summaries.
* `--batch_size`: Number of samples processed per batch.
* `--epochs`: Number of training epochs.
* `--precision`: Numeric precision mode. Supported values are `16-mixed` and `32-true`.
* `--devices`: Devices used for training, such as GPU count or `auto`.
* `--accelerator`: Hardware accelerator used for training, such as `cpu`, `gpu`, or `auto`.

Run the script with `--help` to see the complete argument list.

### Use The Summary Inference Script

The inference script also requires a trained model at `AI/models/final_model`, unless you pass a different path with `--model_dir`.

From the `AI` directory, summarize a Markdown file with:

```bash
python -m inference.infer --input_file path/to/file.md
```

Common arguments:

* `--model_dir`: Path to the trained model directory. Defaults to `./models/final_model`.
* `--input_file`: Path to the input Markdown file.
* `--max_input_len`: Maximum token length for each input chunk.
* `--overlap_ratio`: Fraction of overlap between chunks during long-text summarization.
* `--max_new_tokens`: Maximum number of tokens generated in the summary.
* `--num_beams`: Number of beams used for beam-search generation.
* `--recursive`: Enables recursive summarization for long inputs.

Run the script with `--help` to see the complete argument list.

## Testing And Evaluation

### Backend Unit Tests

From the `backend` directory, run service unit tests:

```powershell
.\gradlew.bat test --tests "com.cognitum.backend.service.impl.*"
```

On macOS or Linux:

```bash
./gradlew test --tests "com.cognitum.backend.service.impl.*"
```

### Backend Integration Tests

Integration tests use Testcontainers, so Docker must be running first.

From the `backend` directory:

```powershell
.\gradlew.bat test --tests "com.cognitum.backend.integration.*"
```

On macOS or Linux:

```bash
./gradlew test --tests "com.cognitum.backend.integration.*"
```

### Frontend E2E Tests

Make sure the backend is running in dev mode and the Tauri application is running in test mode:

```bash
npm run tauri:test
```

In another terminal, from the `frontend` directory, run Playwright:

```bash
npx playwright test
```

### Summary Model Evaluation

Evaluation requires a trained model at `AI/models/final_model`, unless you pass a different path with `--model_dir`.

To evaluate the summary model, run the evaluation script from the `AI` directory:

```bash
python -m eval.evaluation
```

Common arguments:

* `--model_dir`: Path to the trained model directory.
* `--test_data`: Path to the test dataset file.
* `--max_input_len`: Maximum token length for each input chunk.
* `--max_new_tokens`: Maximum number of tokens generated in each prediction.
* `--num_beams`: Number of beams used for beam-search generation.
* `--bert_model`: BERT model used for BERTScore.
* `--bert_device`: Device used to run the BERTScore model.

Run the script with `--help` to see the complete argument list.

## Troubleshooting

* If the backend cannot connect to PostgreSQL, confirm that the `cognitum` database exists, the `cognitum_data` schema exists, and `DB_PASSWORD` matches the configured datasource user.
* If account confirmation emails are not sent, confirm `app.is-dev-mode` is `false`, the configured Gmail account matches the app password, and SMTP access is enabled.
* If summarisation fails in the app, confirm the LitServe API is running on `http://localhost:8000` or update `app.summarizer.client.base-url` in `backend/src/main/resources/application.yml`.
* If Playwright tests cannot find the app, confirm `npm run tauri:test` is still running before launching `npx playwright test`.

## Contact

Farhad Garaisa - farhad.garaisa@gmail.com

Project Link - https://github.com/vermilion-exe/Cognitum

[Tauri.app]: https://img.shields.io/badge/Tauri-24C8D8?style=for-the-badge&logo=tauri&logoColor=fff
[Tauri-url]: https://v2.tauri.app/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[TypeScript]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=fff
[TypeScript-url]: https://www.typescriptlang.org/
[Tailwind.css]: https://img.shields.io/badge/Tailwind%20CSS-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white
[Tailwind-url]: https://tailwindcss.com/
[Rust]: https://img.shields.io/badge/Rust-%23000000.svg?e&style=for-the-badge&logo=rust&logoColor=white
[Rust-url]: https://rust-lang.org/
[Spring-Boot]: https://img.shields.io/badge/Spring%20Boot-6DB33F?style=for-the-badge&logo=springboot&logoColor=fff
[Spring-Boot-url]: https://spring.io/projects/spring-boot
[Postgres]: https://img.shields.io/badge/Postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white
[Postgres-url]: https://www.postgresql.org/
[Pytorch]: https://img.shields.io/badge/PyTorch-ee4c2c?style=for-the-badge&logo=pytorch&logoColor=white
[Pytorch-url]: https://pytorch.org/
