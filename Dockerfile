FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create src directory and copy files
RUN mkdir -p src
COPY src/VideoGenerator.js src/

CMD [ "npm", "run", "start" ]