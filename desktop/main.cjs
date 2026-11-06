const { app, BrowserWindow, dialog, shell } = require("electron");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const path = require("node:path");

const execFileAsync = promisify(execFile);
const appUrl = "http://localhost:8080";
const apiHealthUrl = "http://localhost:8000/health";
const composeProjectName = "mochi-converter";
const packagedProjectDirectory = path.join(process.resourcesPath, "project");
const projectDirectory = app.isPackaged
  ? packagedProjectDirectory
  : path.resolve(__dirname, "..");

let mainWindow;
let ownsComposeStack = false;
let stoppingComposeStack = false;
let allowQuit = false;

function showStatus(message, details = "") {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const safeMessage = escapeHtml(message);
  const safeDetails = escapeHtml(details);
  const html = `<!doctype html>
    <html lang="en">
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Mochi Converter</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center;
          background: #fffaf3; color: #342d49; font: 16px/1.6 "Segoe UI", sans-serif; }
        main { width: min(520px, calc(100% - 36px)); padding: 38px; text-align: center;
          background: #fffdf9; border: 1px solid #e8ddff; border-radius: 28px;
          box-shadow: 0 18px 60px #7c3aed18; }
        img { width: 76px; height: 76px; }
        h1 { margin: 16px 0 8px; font-size: 25px; }
        p { margin: 0; color: #625a73; }
        pre { margin: 20px 0 0; padding: 14px; max-height: 180px; overflow: auto;
          text-align: left; white-space: pre-wrap; overflow-wrap: anywhere;
          background: #f7f3ff; border-radius: 12px; color: #55496c; font-size: 12px; }
      </style>
      <main>
        <img src="${appUrl}/mochi-logo.svg" alt="">
        <h1>${safeMessage}</h1>
        <p>Keep Mochi Converter open while Docker starts your local converter.</p>
        ${safeDetails ? `<pre>${safeDetails}</pre>` : ""}
      </main>
    </html>`;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function runDocker(args, timeout = 20 * 60 * 1000) {
  return execFileAsync("docker", args, {
    cwd: projectDirectory,
    timeout,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
  });
}

async function isConverterReady() {
  try {
    const [frontend, api] = await Promise.all([
      fetch(appUrl, { signal: AbortSignal.timeout(2500) }),
      fetch(apiHealthUrl, { signal: AbortSignal.timeout(2500) }),
    ]);
    return frontend.ok && api.ok;
  } catch {
    return false;
  }
}

async function waitForConverter(timeoutMs = 3 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isConverterReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("The frontend and API did not become ready within three minutes.");
}

async function waitForDocker(timeoutMs = 2 * 60 * 1000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await runDocker(["info"], 10_000);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw lastError || new Error("Docker Desktop did not become ready.");
}

async function startConverter() {
  if (await isConverterReady()) {
    ownsComposeStack = false;
    mainWindow.loadURL(appUrl);
    return;
  }

  showStatus("Waking Mochi up...");
  try {
    await runDocker(["info"], 20_000);
    showStatus("Starting Mochi's local services...");
    await runDocker(["compose", "-p", composeProjectName, "up", "-d"]);
    ownsComposeStack = true;
    showStatus("Waiting for Mochi to be ready...");
    await waitForConverter();
    mainWindow.loadURL(appUrl);
  } catch (error) {
    const output = [error.stderr, error.stdout, error.message].filter(Boolean).join("\n");
    showStatus("Mochi couldn't start", output);
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Mochi Converter could not start",
      message: "Check that Docker Desktop is installed and running, then try again.",
      detail: output.slice(-5000),
      buttons: ["Try again", "Open Docker Desktop", "Quit"],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });

    if (response === 0) {
      await startConverter();
    } else if (response === 1) {
      const dockerDesktopPath = path.join(
        process.env.ProgramFiles || "C:\\Program Files",
        "Docker",
        "Docker",
        "Docker Desktop.exe",
      );
      await shell.openPath(dockerDesktopPath);
      await waitForDocker();
      await startConverter();
    } else {
      app.quit();
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    title: "Mochi Converter",
    backgroundColor: "#fffaf3",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  startConverter().catch((error) => {
    const details = [error.stderr, error.stdout, error.message].filter(Boolean).join("\n");
    showStatus("Mochi couldn't start", details);
    dialog.showErrorBox("Mochi Converter could not start", details);
  });
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", (event) => {
  if (!ownsComposeStack || allowQuit || stoppingComposeStack) return;
  event.preventDefault();
  stoppingComposeStack = true;
  runDocker(["compose", "-p", composeProjectName, "stop"], 60_000)
    .catch((error) => {
      dialog.showErrorBox(
        "Mochi services could not stop",
        `Docker reported an error while stopping the local services:\n${error.message}`,
      );
    })
    .finally(() => {
      allowQuit = true;
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
