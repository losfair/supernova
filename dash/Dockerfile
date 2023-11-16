FROM denoland/deno:debian-1.38.1

WORKDIR /app
COPY . .
RUN rm -f deno.lock && deno cache main.ts

CMD ["run", "-A", "main.ts"]
