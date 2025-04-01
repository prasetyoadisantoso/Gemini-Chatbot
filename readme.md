# Code Analysis Chatbot with Gemini API

This project is a web-based chatbot application that utilizes the Google Gemini API to perform two main functions:
1.  Answer general user questions in a conversational format.
2.  Analyze source code provided by the user, either through a ZIP file upload or by selecting a local folder, to identify potential errors, suggest improvements, and summarize functionality.

The application is built using Node.js and Express on the backend, and vanilla HTML, CSS, and JavaScript on the frontend.

## Key Features

*   **Interactive Chat:** Two-way communication with the AI using Gemini.
*   **Conversation Memory:** Remembers the context of previous conversations within a single browser session using `express-session`.
*   **Code Analysis from ZIP:** Users can upload a `.zip` file containing project source code. The server extracts and sends the relevant file contents to Gemini for analysis.
*   **Code Analysis from Folder:** Users can select a local folder on their computer. The server receives the files from the folder and sends them to Gemini for analysis (requires a browser supporting `webkitdirectory`).
*   **Syntax Highlighting:** Code blocks in the AI's responses are highlighted using Highlight.js.
*   **Markdown Rendering:** Responses from the AI (expected in Markdown format) are correctly rendered in the chat interface using Marked.js.

## Technology Stack

*   **Backend:**
    *   Node.js
    *   Express.js
    *   Google Gemini API (via `node-fetch`)
    *   `express-session` (for session management and chat history)
    *   `multer` (for handling ZIP and folder file uploads)
    *   `extract-zip` (for decompressing ZIP files)
    *   `dotenv` (for managing environment variables)
*   **Frontend:**
    *   HTML5
    *   CSS3
    *   Vanilla JavaScript
    *   Marked.js (for Markdown rendering)
    *   Highlight.js (for code syntax highlighting)

## Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd <project-folder-name>
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    *   Create a file named `.env` in the project's root directory.
    *   Copy the following content into the `.env` file and fill in your values:
        ```dotenv
        # Replace with your API Key from Google AI Studio (https://aistudio.google.com/app/apikey)
        GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE

        # Replace with a VERY STRONG and RANDOM secret string (at least 32 characters)
        # You can generate one online or use tools like 'openssl rand -base64 32'
        SESSION_SECRET=YOUR_SUPER_SECRET_AND_LONG_SESSION_KEY

        # Optional: Specify the server port (defaults to 3001)
        # PORT=3001

        # Optional: Set to 'production' when deploying to enable secure cookies (requires HTTPS)
        # NODE_ENV=production
        ```
    *   **IMPORTANT:** Obtain your `GOOGLE_API_KEY` from [Google AI Studio](https://aistudio.google.com/app/apikey). Ensure the "Generative Language API" is enabled in your Google Cloud Console project.
    *   Replace `SESSION_SECRET` with a strong, unique key. Do not use default or easily guessable keys. **Never commit your `.env` file to version control.**

4.  **Run the Server:**
    ```bash
    node server.js
    ```
    Or, if you use `nodemon` for development:
    ```bash
    nodemon server.js
    ```
    The server will start on `http://localhost:3001` (or the port specified in `.env`).

## Usage

1.  Open your browser and navigate to the server address (e.g., `http://localhost:3001`).
2.  **General Chat:** Type your message or question in the bottom text area and press the "Send" button or use `Shift+Enter` / `Ctrl+Enter`. The chatbot will respond, remembering the previous conversation within that session.
3.  **ZIP Analysis:**
    *   Click the "Browse..." button or the input area under "Upload Project (ZIP)".
    *   Select the `.zip` file containing your project code.
    *   Click the "Upload & Analyze ZIP" button. The analysis results will appear in the chatbox.
4.  **Folder Analysis:**
    *   Click the "Browse..." button or the input area under "Select Project Folder".
    *   A folder selection dialog will appear. Choose your project folder.
    *   Click the "Analyze Folder" button. The analysis results will appear in the chatbox. (Requires a compatible browser).

## Environment Variables (.env)

*   `GOOGLE_API_KEY`: (Required) Your API key to access the Google Gemini API.
*   `GOOGLE_API_URL`: (Required) Your API URL to access the Google Gemini API using generative google.
*   `SESSION_SECRET`: (Required) A strong secret key used to secure user sessions.
*   `PORT`: (Optional) The port on which the server will run. Defaults to `3001`.
*   `NODE_ENV`: (Optional) Set to `production` when deploying to enable security features like secure HTTPS cookies (`secure: true`).

## Notes

*   Ensure the Gemini model specified in `GEMINI_API_URL` within `server.js` (e.g., `gemini-1.5-flash-latest`) is a valid model available for your API key.
*   The folder selection feature depends on browser support for the `webkitdirectory` attribute.

---