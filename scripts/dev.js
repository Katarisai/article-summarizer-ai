const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

const serverDir = path.resolve(__dirname, "..", "backend");
const clientDir = path.resolve(__dirname, "..", "frontend");
const npmCommand = "npm";

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });

    socket.setTimeout(500);

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      resolve(false);
    });
  });

const startedProcesses = [];
let shuttingDown = false;

const shutdown = (exitCode = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const childProcess of startedProcesses) {
    childProcess.kill();
  }

  process.exit(exitCode);
};

const startProcess = (label, cwd, args) => {
  const childProcess = spawn(npmCommand, args, {
    cwd,
    stdio: "inherit",
    shell: true
  });

  startedProcesses.push(childProcess);
  childProcess.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    console.error(`${label} exited with code ${code ?? 1}.`);
    shutdown(code ?? 1);
  });

  return childProcess;
};

const main = async () => {
  const [serverInUse, clientInUse] = await Promise.all([isPortOpen(5000), isPortOpen(3000)]);

  if (serverInUse) {
    console.log("Port 5000 is already in use; leaving the API server running.");
  } else {
    startProcess("API server", serverDir, ["run", "dev"]);
  }

  if (clientInUse) {
    console.log("Port 3000 is already in use; leaving the React client running.");
  } else {
    startProcess("React client", clientDir, ["start"]);
  }

  if (startedProcesses.length === 0) {
    console.log("Both dev servers are already running.");
    process.exit(0);
  }
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error);
  shutdown(1);
});