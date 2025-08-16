import http from "http";
import { URL } from "url";

interface TestServerOptions {
    port?: number;
}

interface TestServerResult {
    url: string;
    port: number;
    close: () => Promise<void>;
}

export async function startTestServer(options: TestServerOptions = {}): Promise<TestServerResult> {
    const port = options.port || 0; // Use 0 to let the OS assign an available port

    const server = http.createServer((req, res) => {
        const url = new URL(req.url || "/", `http://localhost:${port}`);
        const pathname = url.pathname;

        // Set CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, User-Agent");

        // Handle OPTIONS requests
        if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
        }

        // Handle different status codes based on path
        switch (pathname) {
            case "/200":
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("OK");
                break;

            case "/301":
                res.writeHead(301, {
                    Location: `http://localhost:${port}/200`,
                    "Content-Type": "text/plain"
                });
                res.end("Moved Permanently");
                break;

            case "/302":
                res.writeHead(302, {
                    Location: `http://localhost:${port}/200`,
                    "Content-Type": "text/plain"
                });
                res.end("Found");
                break;

            case "/404":
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not Found");
                break;

            case "/500":
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error");
                break;

            case "/301-external":
                // Redirect to an external URL (for testing external redirects)
                res.writeHead(301, {
                    Location: "https://example.com/",
                    "Content-Type": "text/plain"
                });
                res.end("Moved Permanently");
                break;

            case "/user-agent-required":
                // Requires specific User-Agent header
                if (req.headers["user-agent"] && req.headers["user-agent"].includes("Mozilla")) {
                    res.writeHead(200, { "Content-Type": "text/plain" });
                    res.end("OK - User-Agent accepted");
                } else {
                    res.writeHead(403, { "Content-Type": "text/plain" });
                    res.end("Forbidden - User-Agent required");
                }
                break;

            case "/timeout":
                // Simulate a timeout by not responding
                setTimeout(() => {
                    res.writeHead(200, { "Content-Type": "text/plain" });
                    res.end("Delayed response");
                }, 10000); // 10 seconds delay
                break;

            case "/preferGET":
                // Endpoint that only works with GET method
                // Used to test preferGET option
                if (req.method === "HEAD") {
                    // HEAD request returns 405 Method Not Allowed
                    res.writeHead(405, { "Content-Type": "text/plain" });
                    res.end();
                } else if (req.method === "GET") {
                    // GET request returns 200 OK
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end("<html><body>This endpoint requires GET method</body></html>");
                } else {
                    res.writeHead(405, { "Content-Type": "text/plain" });
                    res.end("Method Not Allowed");
                }
                break;

            default:
                // Default to 200 OK for any other path
                res.writeHead(200, { "Content-Type": "text/plain" });
                res.end("Default OK response");
                break;
        }
    });

    return new Promise((resolve, reject) => {
        server.listen(port, () => {
            const actualPort = (server.address() as any).port;
            const serverUrl = `http://localhost:${actualPort}`;
            console.log(`Test server started on port ${actualPort}`);

            const closeServer = () => {
                return new Promise<void>((resolveClose) => {
                    server.close(() => {
                        console.log("Test server stopped");
                        resolveClose();
                    });
                });
            };

            resolve({
                url: serverUrl,
                port: actualPort,
                close: closeServer
            });
        });

        server.on("error", reject);
    });
}
