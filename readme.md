# Chatbot Gemini: Code Assistant with Google Gemini API

This project is a Node.js-based web application that leverages the Google Gemini API to provide chatbot functionality focused on code analysis and understanding. Users can upload code (in ZIP, folder, or individual file formats) and then ask questions about the code to the chatbot. The application stores conversation history and uploaded files in a SQLite database for a more personalized and contextual experience.

## Key Features

*   **Interactive Chatbot:**
    *   Allows users to send text messages and receive responses from the chatbot powered by the Google Gemini API.
    *   Maintains conversation history for continuous interaction.
*   **Code Analysis:**
    *   Supports uploading code in ZIP, folder, or individual file formats.
    *   Automatically extracts code content from uploaded files.
    *   Uses the Google Gemini API to analyze the code and provide insights.
*   **Retrieval-Augmented Generation (RAG):**
    *   Searches and retrieves relevant files based on user messages from the database.
    *   Uses the content of relevant files as additional context when creating prompts to the Gemini API, improving the accuracy and relevance of responses.
*   **Session Management:**
    *   Uses unique sessions for each user, allowing conversation history and uploaded files to be maintained separately.
*   **Simple User Interface:**
    *   An intuitive web-based interface using HTML, CSS, and JavaScript.
    *   Supports code syntax highlighting with Highlight.js and Markdown rendering with Marked.js.

## Technologies Used

*   **Node.js:** Server-side JavaScript runtime environment.
*   **Express:** Web framework for Node.js.
*   **Google Gemini API:** For generating chatbot responses and code analysis.
*   **SQLite:** Lightweight database for storing chat history and uploaded files.
*   **Multer:** Node.js middleware for handling file uploads.
*   **Express-Session:** Middleware for session management.
*   **CORS:** Middleware to enable Cross-Origin Resource Sharing.
*   **node-fetch:** Library to make HTTP requests (used to communicate with Gemini API).
*   **extract-zip:** Library to extract ZIP files.
*   **Highlight.js:** For code syntax highlighting.
*   **Marked.js:** For rendering Markdown.
*   **dotenv:** For managing environment variables.

## Requirements

*   **Node.js:** Version 16 or higher.
*   **npm** (or yarn) as the package manager.
*   **Google Gemini API Key:** Obtain an API key from [Google AI Studio](https://makersuite.google.com/app/apikey).
*   **sqlite3:** Node.js module to interact with SQLite database.

## Installation

1.  **Clone repository:**

    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**

    ```bash
    npm install  # or yarn install
    ```

3.  **Configure environment:**

    *   Create a `.env` file based on `sample-env.txt`.
    *   Fill in the required environment variables:

        *   `PORT`: Server port (default: 3000).
        *   `SESSION_SECRET`: Secret key for the session (must be long and secure).
        *   `GOOGLE_API_KEY`: Your API key from Google AI Studio.
        *   `ALLOWED_ORIGINS`: List of allowed origins (comma-separated) for CORS (e.g., `http://localhost:3000,https://example.com`).
        *   `UPLOAD_DIR`: Directory to store uploaded files (default: `./uploads`).
        *   `MAX_HISTORY_LENGTH`: Maximum number of messages stored in the chat history (default: 20).
        *   `ZIP_MAX_SIZE_MB`: Maximum size for uploaded ZIP files (in MB, default: 10).
        *   `MAX_FILES_IN_FOLDER`: Maximum number of files allowed in an uploaded folder (default: 100).
        *   `MAX_FILE_SIZE_MB`: Maximum size for each file in a folder or multi-file upload (in MB, default: 5).

    Example `.env`:

    ```
    PORT=3000
    SESSION_SECRET=your_long_and_secure_session_secret_key
    GOOGLE_API_KEY=AIzaSy...
    ALLOWED_ORIGINS=http://localhost:3000
    UPLOAD_DIR=./uploads
    MAX_HISTORY_LENGTH=20
    ZIP_MAX_SIZE_MB=10
    MAX_FILES_IN_FOLDER=100
    MAX_FILE_SIZE_MB=5
    SESSION_ID= #use your random (whatever) session id. This is for persistent memory from Gemini
    ```

4.  **Run the application:**

    ```bash
    node server.js  # or yarn start
    ```

    Open `http://localhost:<PORT>` in your browser.

## Code Structure

Here is a brief description of the main files and directories:

*   `server.js`: Main application entry point.
*   `routes/`: Contains API route definitions.
    *   `index.js`: Aggregates all API routes.
    *   `chat.js`: Handles the chat route (`/api/chat`).
    *   `analysis.js`: Handles the file analysis routes (`/api/analyze`).
*   `services/`: Contains service logic.
    *   `gemini.js`: Interacts with the Google Gemini API.
*   `config/`: Contains configuration files.
    *   `constants.js`: Defines configuration constants.
    *   `multer.js`: Multer configuration for file uploads.
    *   `session.js`: Express session configuration.
*   `utils/`: Contains utility functions.
    *   `fileHandler.js`: Handles file operations (reading, cleaning).
    *   `helpers.js`: Contains helper functions (fetch with timeout, history management).
*   `public/`: Contains static files (HTML, CSS, JavaScript).
    *   `index.html`: Main HTML file.
    *   `script.js`: Client-side JavaScript code.
    *   `style.css`: CSS file.
*   `chat_history.db`: SQLite database file.
*   `package.json`: Project metadata file and dependencies.
*   `sample-env.txt`: Example `.env` file.

## Configuration

Application configuration is done through environment variables. See the "Installation" section for details on how to set environment variables. Constants such as file size limits, upload directory, and list of allowed file extensions are defined in `config/constants.js`.

## Usage

1.  Open the application in your browser.
2.  Type a message in the input area and press "Send" to interact with the chatbot.
3.  Upload code files (ZIP, folder, or individual files) using the available upload options.
4.  Ask specific questions about the uploaded code.
5.  The chatbot will attempt to provide responses based on the uploaded code and conversation history.

## Further Enhancements

Here are some ideas for further enhancements:

*   **Advanced File Search:** Implement semantic search using embeddings or a vector database to improve the relevance of search results.
*   **Prompt Engineering:** Optimize the prompts used to interact with the Gemini API to improve the accuracy and relevance of responses.
*   **Error Handling:** Improve error handling on the client and server sides.
*   **Scalability:** Use a more scalable database (e.g., PostgreSQL) and cloud infrastructure (e.g., AWS, Google Cloud, Azure) to handle many users.
*   **Security:** Implement security best practices to protect the application from vulnerabilities, including input validation, output sanitization, and protection against CSRF and XSS attacks.
*   **Evaluation:** Add evaluation metrics to measure the effectiveness of the RAG implementation.
*   **Integrate with version control systems (Git):** Allow users to connect their Git repositories directly to the chatbot.

## License

[MIT](LICENSE) (Add a LICENSE file if you want to use the MIT license)

## Contributing

Contributions are welcome! Fork this repository and submit a pull request.

## Author

Prasetyo Adi Santoso

