# Cognitum
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#launching-the-tauri-application">Launching The Tauri Application</a></li>
        <li><a href="#launching-the-spring-boot-application">Launching The Spring Boot Application</a></li>
        <ul>
          <li><a href="#spring-boot-configuration">Spring Boot Configuration</a></li>
        </ul>
        <li><a href="#deploying-the-model">Deploying The Model</a></li>
        <ul>
          <li><a href="#using-summary-inference-script">Using Summary Inference Script</a></li>
        </ul>
      </ul>
    </li>
    <li><a href="#testing-and-evaluation">Testing And Evaluation</a></li>
    <ul>
      <li><a href="#unit-testing">Unit Testing</a></li>
      <li><a href="#integration-testing">Integration Testing</a></li>
      <li><a href="#e2e-testing">E2E Testing</a></li>
      <li><a href="#summary-model-evaluation">Summary Model Evaluation</a></li>
    </ul>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

# About The Project

Cognitum is an AI-integrated intelligent note-taking application designed to enhance the learning experience of students. Similar to note-taking applications such as Obsidian, Cognitum supports advanced notation through LaTeX while integrating AI-powered features directly into the editor.

The application bridges the gap between note-taking and information recall by transforming basic note-taking into a more structured learning workflow. It provides three main AI features: summarisation for quick comprehension, context-aware explanations for understanding complex topics, and a spaced-repetition system that uses AI-generated flashcards to support long-term knowledge retention.

## Built With
* [![Tauri][Tauri.app]][Tauri-url]
* [![React][React.js]][React-url]
* [![TypeScript]][TypeScript-url]
* [![Tailwind][Tailwind.css]][Tailwind-url]
* [![Rust]][Rust-url]
* [![Spring-Boot]][Spring-Boot-url]
* [![Postgres]][Postgres-url]
* [![Pytorch]][Pytorch-url]

# Getting Started

## Prerequisites

The train the AI model and run additional scripts, [Python](https://www.python.org/) should be installed. Launching the Tauri frontend requires [Node.js](https://nodejs.org/en/download) $\ge$ v22.20.0. Launching the Spring Boot backend requires [JDK](https://dev.java/download/) $\ge$ 17. If deploying the database locally, download [PostgreSQL](https://www.postgresql.org/download/) $\ge$ 17. You would also need [Gradle](https://gradle.org/) $\ge$ 9.3.1 to launch the Spring Boot application. For Integration Tests, you must install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or the [Docker Engine on Linux](https://docs.docker.com/engine/install/).

## Installation

1. Clone the repo
```
git clone https://github.com/vermilion-exe/Cognitum.git
```
2. Install NPM packages in directory [`frontend`](frontend) with
```
npm install
```
3. It is advisory to use [IntelliJ](https://www.jetbrains.com/idea/) to launch the Spring Boot application, as the necessary dependencies will be automatically downloaded. Otherwise, you can use the following command to install the dependencies.
```
.\gradlew.bat build
```
Or on Unix:
```
./gradlew build
```

## Train The Summary Model

The training script for the summary model is located at [`AI/training/train.py`](AI/training/train.py). The training can be done with this default command:
<br>
```
python train.py --train_file ../data/summ/train.jsonl --val_file ../data/summ/val.jsonl
```

Here are all arguments that can be passed:
- `--train_file`: The path to the training file.
- `--val_file`: The path to the validation file.
- `--output_dir`: The final directory in which the trained model will be stored.
- `--model_name`: Hugging Face model name or path to use as the base model.
- `--max_input_len`: Maximum token length for input notes.
- `--max_target_len`: Maximum token length for generated summaries.
- `--batch_size`: Number of samples processed per batch.
- `--grad_accum`: Number of batches to accumulate before each optimizer step.
- `--epochs`: Number of full training passes over the dataset.
- `--lr`: Learning rate used by the optimizer.
- `--weight_decay`: Weight decay value used for regularization.
- `--warmup_ratio`: Fraction of total training steps used for learning-rate warmup.
- `--num_math_placeholders`: Maximum number of math spans replaced with placeholder tokens.
- `--pad_to_multiple_of`: Pads sequences to a multiple of this value, or disables this when set to `0`.
- `--precision`: Numeric precision mode used during training.
- `--devices`: Devices used for training, such as GPU count or `auto`.
- `--accelerator`: Hardware accelerator used for training, such as CPU, GPU, or `auto`.

# Usage

## Launching The Tauri Application

The Tauri application can be launched from the [`frontend`](frontend) directory using this command:
```
npm run tauri dev
```

## Launching The Spring Boot Application

Before you launch the application, make sure to see [Spring Boot Configuration](#spring-boot-configuration). The Spring Boot application can be simply launched by pressing the run button in IntelliJ. If you prefer to use the terminal, you can use the following command:
```
.\gradlew.bat bootRun
```
Or on Unix:
```
./gradlew bootRun
```

### Spring Boot Configuration
If you are launching the application for the first time, make sure to set the `ddl-auto` parameter in [application.yml](backend/src/main/resources/application.yml) to `create`, so the tables are created in the schema.
```yml
spring:
  jpa:
    hibernate:
      ddl-auto: create
```

The user account confirmation is automatic by default. If you want to disable it, and allow Cognitum to send emails with and activation code, set this setting to `false`:
```yml
app:
  is-dev-mode: false
```

To launch the application, you also need a `.env` file in the root directory of [backend](backend). Here are the environment variables you must define:
- `DB_PASSWORD`: The password for the DB user on your local machine. Make sure the username defined in [application.yml](backend/src/main/resources/application.yml) also matches the DB username on your local machine.
```yml
spring:
  datasource:
    username: your-db-username
```
- `MAIL_PASSWORD`: This is the gmail password for the user that is used to send emails with code confirmation. You can find how to create app passwords for gmail [here](https://support.google.com/mail/answer/185833?hl=en&utm_source=chatgpt.com). The email used should also be changed to the one you create the gmail password for.
```yml
spring:
  mail:
    username: your-email
```
- `NVIDIA_API_KEY`: This is the NVIDIA NIM API key used for text explanation and flashcard generation features. You can acquire one [here](https://build.nvidia.com/explore/discover?integrate_nim=true&hosted_api=true&modal=integrate-nim).
- `JWT_SECRET_KEY` and `TEST_JWT_SECRET_KEY`: These are the secret key used for JWT token generation and can be generated [here](https://randomkeygen.com/jwt-secret).

After defining these values in the `.env` file, you can confidently launch the Spring Boot Application

## Deploying The Model

The model can be deployed via LitServe using the script located at [`AI/server/server.py`](AI/server/server.py). Use the following command to start the server (make sure to be in directory [`AI`](AI) when doing this):
<br>
```
python -m server.server
```

Here are all arguments that can be passed:
- `--model_dir`: Path to the trained model directory.
- `--port`: The port to deploy the summary model on.

### Using Summary Inference Script

You can also use the [inference script](AI/inference/infer.py) to create summaries for individual files with the following command:
```
python -m inference.infer --input_file [markdown-file]
```

Here are all parameters you can pass to this command:
- `--model_dir`: Path to the trained model directory.
- `--input_file`: Path to the input file to summarize.
- `--max_input_len`: Maximum token length for each input chunk.
- `--overlap_ratio`: Fraction of overlap between chunks during long-text summarization.
- `--max_new_tokens`: Maximum number of tokens generated in the summary.
- `--num_beams`: Number of beams used for beam-search generation.
- `--length_penalty`: Controls whether generated summaries are shorter or longer.
- `--recursive`: Enables recursive summarization for long inputs.
- `--no_repeat_ngram_size`: Prevents repeated n-grams of this size.
- `--repetition_penalty`: Penalizes repeated tokens in the generated summary.
- `--encoder_repetition_penalty`: Penalizes repetition based on the input text.
- `--num_math_placeholders`: Maximum number of math spans protected with placeholders.

# Testing And Evaluation

## Unit Testing

To launch Unit tests for the Spring Boot application, you can either use the "run tests" option in IntelliJ, or use the following command:
```
./gradlew test --tests "com.cognitum.backend.service.impl.*"
```

## Integration Testing

Before you run the Integration tests for Spring Boot, make sure you've checked the [prequisites](#prequisites). You can use the following command to run the tests:
```
./gradlew test --tests "com.cognitum.backend.integration.*"
```

## E2E Testing

To run the end-to-end tests, make sure to run the Tauri application in test mode first:
```
npm run tauri:test
```

Also, make sure the Spring Boot application is in dev mode, as described [here](#spring-boot-configuration). This will ensure no account confirmation is needed during tests.

## Summary Model Evaluation

To evaluate the summary model to derive the automated evaluation scores, you can use the [evaluation script](AI/eval/evaluation.py). Use the following command:
```
python -m eval.evaluation
```

Here are the arguments you can pass to this command:

- `--model_dir`: Path to the trained model directory.
- `--test_data`: Path to the test dataset file.
- `--max_input_len`: Maximum token length for each input chunk.
- `--overlap_ratio`: Fraction of overlap between chunks during long-text summarization.
- `--max_new_tokens`: Maximum number of tokens generated in each prediction.
- `--num_beams`: Number of beams used for beam-search generation.
- `--length_penalty`: Controls whether generated summaries are shorter or longer.
- `--recursive`: Enables recursive summarization for long inputs.
- `--no_repeat_ngram_size`: Prevents repeated n-grams of this size.
- `--repetition_penalty`: Penalizes repeated tokens in generated summaries.
- `--encoder_repetition_penalty`: Penalizes repetition based on the input text.
- `--num_math_placeholders`: Maximum number of math spans protected with placeholders.
- `--bert_model`: BERT model used for calculating BERTScore.
- `--bert_device`: Device used to run the BERTScore model.

# Contact

Farhad Garaisa - farhad.garaisa@gmail.com
<br>
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