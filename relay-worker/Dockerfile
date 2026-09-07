FROM mcr.microsoft.com/playwright:v1.55.0-noble

ENV NODE_ENV=production \
    DISPLAY=:99 \
    USER_DATA_DIR=/data/chrome-profile \
    HEADLESS=false \
    CHROME_CHANNEL=chromium \
    PORT=3000

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends xvfb fluxbox x11vnc novnc websockify \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY start.sh ./start.sh
RUN chmod +x ./start.sh \
    && mkdir -p /data/chrome-profile /root/.vnc

VOLUME ["/data"]
EXPOSE 3000 6080

CMD ["./start.sh"]
