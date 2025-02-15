FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python-is-python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install app dependencies
COPY package*.json ./
RUN npm install

COPY . .

CMD [ "npm", "run", "start" ]