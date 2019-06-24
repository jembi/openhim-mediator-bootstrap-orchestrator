FROM node:10
WORKDIR /app

# Install node packages
COPY package.json /app
COPY package-lock.json /app
RUN npm install

# Copy app files into container
COPY . /app

# Set ENV variables
ARG openhim_api_url=https://openhim-core:8080
ENV OPENHIM_API_URL=$openhim_api_url
ARG openhim_trust_self_signed=false
ENV OPENHIM_TRUST_SELF_SIGNED=$openhim_trust_self_signed

CMD npm start
EXPOSE 3001