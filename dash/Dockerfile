FROM denoland/deno:debian-1.32.5

WORKDIR /app
COPY . .
RUN deno cache main.ts

CMD ["run", "-A", "main.ts"]
