FROM python:3.12-slim
ARG BUILDPLATFORM
RUN apt update -y && apt install -y curl

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM" > /log


RUN if [ "$BUILDPLATFORM" = "linux/amd64" ]; then \
    curl -L -o opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64 \
    && chmod +x opa \
    && mv opa /usr/local/bin/opa ; \
    elif [ "$BUILDPLATFORM" = "linux/arm64" ]; then \
    curl -L -o opa https://openpolicyagent.org/downloads/latest/opa_linux_arm64 \
    && chmod +x opa \
    && mv opa /usr/local/bin/opa ; \
    else echo "Unsupported architecture: $TARGETARCH" ; exit 1 ; \
    fi



# System deps (build + runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY ./pyproject.toml ./
COPY ./app/ ./app/

RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
