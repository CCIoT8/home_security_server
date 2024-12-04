# Use a base Node.js image
FROM node:lts

# Set the working directory in the container
WORKDIR /

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000:3000

# Command to run the application
CMD ["node", "server.js"]
